import JSZip from 'jszip';

// ─────────────────────────────────────────────────────────────
// Local .pptx parsing — hand-rolled on JSZip + the browser's native
// DOMParser (zero new runtime dependencies; pptxjs/pptx-preview were
// evaluated and rejected for bundle size and abandonware risk).
//
// parsePptxToModel() turns a deck into a plain-JSON slide model the
// PptxSlideshow component renders as positioned DOM:
//   { widthEmu, heightEmu, slides: [{ durationMs, background, shapes }] }
//
// Fidelity limits (documented in the Settings hint): no animations,
// SmartArt, charts or tables; fonts substitute to the system stack;
// theme color transforms (lumMod/lumOff/tint/shade) are close
// approximations.
// ─────────────────────────────────────────────────────────────

const RELS_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

/**
 * Convert OneDrive embed/share URL to download URL
 */
export function convertToDownloadUrl(url) {
  if (!url) return null;

  // Already a download URL
  if (/[?&]download=/i.test(url)) return url;

  // OneDrive embed URL: replace 'embed' with 'download'
  if (/onedrive\.live\.com\/embed\?/i.test(url)) {
    return url.replace(/\/embed\?/i, '/download?');
  }

  // OneDrive share URL: add download param
  if (/onedrive\.live\.com/i.test(url)) {
    return url + (url.includes('?') ? '&' : '?') + 'download=1';
  }

  // 1drv.ms shortened URL: add download param
  if (/1drv\.ms/i.test(url)) {
    return url + (url.includes('?') ? '&' : '?') + 'download=1';
  }

  return url;
}

/**
 * Download PPTX file from URL. Secondary input path — OneDrive links
 * often lack CORS headers, which is why file upload (pptxStore) is the
 * primary way decks get in.
 */
export async function downloadPptx(url) {
  const downloadUrl = convertToDownloadUrl(url);
  if (!downloadUrl) throw new Error('Invalid OneDrive URL');

  const response = await fetch(downloadUrl);
  if (!response.ok) throw new Error(`Failed to download presentation: HTTP ${response.status}`);
  return await response.blob();
}

async function readZipText(zip, path) {
  const file = zip.file(path);
  if (!file) throw new Error(`Presentation is missing ${path} — not a valid .pptx?`);
  return file.async('text');
}

async function readZipTextOrNull(zip, path) {
  const file = zip.file(path);
  return file ? file.async('text') : null;
}

function parseXml(text) {
  return new DOMParser().parseFromString(text, 'text/xml');
}

// Namespace-tolerant helpers: OOXML uses a:/p: prefixes and
// querySelector prefix escaping is brittle, so match on localName.
function childrenByTag(el, localName) {
  const out = [];
  if (!el) return out;
  for (const child of el.children) {
    if (child.localName === localName) out.push(child);
  }
  return out;
}

function firstByTag(el, localName) {
  if (!el) return null;
  for (const child of el.children) {
    if (child.localName === localName) return child;
  }
  return null;
}

function descendantsByTag(el, localName) {
  if (!el) return [];
  return Array.from(el.getElementsByTagName('*')).filter((n) => n.localName === localName);
}

function firstDescendantByTag(el, localName) {
  return descendantsByTag(el, localName)[0] || null;
}

function relId(el, attr) {
  if (!el) return null;
  return el.getAttribute(`r:${attr}`) || el.getAttributeNS(RELS_NS, attr);
}

// ── Relationship files ────────────────────────────────────────────────────────
function resolveTarget(baseDir, target) {
  const parts = (baseDir + '/' + target).split('/');
  const out = [];
  for (const p of parts) {
    if (p === '..') out.pop();
    else if (p !== '.' && p !== '') out.push(p);
  }
  return out.join('/');
}

async function loadRels(zip, ownerPath) {
  // ppt/slides/slide1.xml → ppt/slides/_rels/slide1.xml.rels
  const dir = ownerPath.slice(0, ownerPath.lastIndexOf('/'));
  const name = ownerPath.slice(ownerPath.lastIndexOf('/') + 1);
  const relsText = await readZipTextOrNull(zip, `${dir}/_rels/${name}.rels`);
  const map = {};
  if (!relsText) return map;
  const doc = parseXml(relsText);
  for (const rel of Array.from(doc.getElementsByTagName('Relationship'))) {
    map[rel.getAttribute('Id')] = {
      type: rel.getAttribute('Type') || '',
      target: resolveTarget(dir, rel.getAttribute('Target') || ''),
    };
  }
  return map;
}

function relByTypeEnd(rels, suffix) {
  return Object.values(rels).find((r) => r.type.endsWith(suffix)) || null;
}

// ── Theme colors ──────────────────────────────────────────────────────────────
function parseThemeColors(themeDoc) {
  const scheme = firstDescendantByTag(themeDoc.documentElement, 'clrScheme');
  const colors = {};
  if (!scheme) return colors;
  for (const entry of scheme.children) {
    const srgb = firstByTag(entry, 'srgbClr');
    const sys = firstByTag(entry, 'sysClr');
    if (srgb) colors[entry.localName] = `#${srgb.getAttribute('val')}`;
    else if (sys) colors[entry.localName] = `#${sys.getAttribute('lastClr') || 'FFFFFF'}`;
  }
  return colors;
}

function parseClrMap(masterDoc) {
  const clrMap = firstDescendantByTag(masterDoc.documentElement, 'clrMap');
  const map = { bg1: 'lt1', tx1: 'dk1', bg2: 'lt2', tx2: 'dk2' };
  if (clrMap) {
    for (const key of ['bg1', 'tx1', 'bg2', 'tx2']) {
      const v = clrMap.getAttribute(key);
      if (v) map[key] = v;
    }
  }
  return map;
}

// Approximate OOXML color transforms (tint/shade/lumMod/lumOff) on hex.
function applyColorTransforms(hex, el) {
  let [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const pct = (tag) => {
    const node = firstByTag(el, tag);
    return node ? Number(node.getAttribute('val')) / 100000 : null;
  };
  const tint = pct('tint');
  if (tint !== null) { r = r * tint + (1 - tint); g = g * tint + (1 - tint); b = b * tint + (1 - tint); }
  const shade = pct('shade');
  if (shade !== null) { r *= shade; g *= shade; b *= shade; }
  const lumMod = pct('lumMod');
  if (lumMod !== null) { r *= lumMod; g *= lumMod; b *= lumMod; }
  const lumOff = pct('lumOff');
  if (lumOff !== null) { r += lumOff; g += lumOff; b += lumOff; }
  const to2 = (v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0');
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}

// Resolve an <a:solidFill>-style color child (srgbClr | schemeClr | sysClr).
function resolveColor(el, ctx) {
  if (!el) return null;
  const srgb = firstByTag(el, 'srgbClr');
  if (srgb) return applyColorTransforms(`#${srgb.getAttribute('val')}`, srgb);
  const sys = firstByTag(el, 'sysClr');
  if (sys) return `#${sys.getAttribute('lastClr') || '000000'}`;
  const scheme = firstByTag(el, 'schemeClr');
  if (scheme) {
    let name = scheme.getAttribute('val');
    if (ctx.clrMap[name]) name = ctx.clrMap[name];
    const base = ctx.themeColors[name];
    if (!base) return null;
    return applyColorTransforms(base, scheme);
  }
  return null;
}

// ── Fills ─────────────────────────────────────────────────────────────────────
function parseFill(parent, ctx) {
  if (!parent) return null;
  const solid = firstByTag(parent, 'solidFill');
  if (solid) {
    const color = resolveColor(solid, ctx);
    return color ? { type: 'solid', color } : null;
  }
  const grad = firstByTag(parent, 'gradFill');
  if (grad) {
    const stops = [];
    for (const gs of descendantsByTag(grad, 'gs')) {
      const color = resolveColor(gs, ctx);
      if (color) stops.push({ pos: Number(gs.getAttribute('pos') || 0) / 100000, color });
    }
    stops.sort((a, b) => a.pos - b.pos);
    const lin = firstByTag(grad, 'lin');
    // OOXML angle: 60000ths of a degree, 0 = left→right. CSS 0deg = up.
    const angle = lin ? (Number(lin.getAttribute('ang') || 0) / 60000 + 90) % 360 : 135;
    return stops.length >= 2 ? { type: 'gradient', stops, angle } : null;
  }
  const blip = firstByTag(parent, 'blipFill');
  if (blip) {
    const rid = relId(firstByTag(blip, 'blip'), 'embed');
    if (rid) return { type: 'image', rid };
  }
  return null;
}

function parseBackground(doc, ctx) {
  const bg = firstDescendantByTag(doc.documentElement, 'bg');
  if (!bg) return null;
  const bgPr = firstByTag(bg, 'bgPr');
  if (bgPr) return parseFill(bgPr, ctx);
  const bgRef = firstByTag(bg, 'bgRef');
  if (bgRef) {
    const color = resolveColor(bgRef, ctx);
    if (color) return { type: 'solid', color };
  }
  return null;
}

// ── Shapes ────────────────────────────────────────────────────────────────────
function parseXfrm(spPr) {
  const xfrm = firstByTag(spPr, 'xfrm');
  if (!xfrm) return null;
  const off = firstByTag(xfrm, 'off');
  const ext = firstByTag(xfrm, 'ext');
  if (!off || !ext) return null;
  const nums = [off.getAttribute('x'), off.getAttribute('y'), ext.getAttribute('cx'), ext.getAttribute('cy')].map(Number);
  if (nums.some((n) => !Number.isFinite(n))) return null;
  return { x: nums[0], y: nums[1], w: nums[2], h: nums[3] };
}

function placeholderKey(sp) {
  const ph = firstDescendantByTag(sp, 'ph');
  if (!ph) return null;
  return `${ph.getAttribute('type') || 'body'}:${ph.getAttribute('idx') || ''}`;
}

// Index a layout/master's placeholder geometry so slide shapes without
// their own xfrm inherit position from the template chain.
function indexPlaceholders(doc) {
  const map = {};
  if (!doc) return map;
  for (const sp of descendantsByTag(doc.documentElement, 'sp')) {
    const key = placeholderKey(sp);
    if (!key) continue;
    const spPr = firstDescendantByTag(sp, 'spPr');
    const xfrm = spPr && parseXfrm(spPr);
    if (xfrm && !map[key]) map[key] = xfrm;
  }
  return map;
}

function parseTextBody(sp, ctx) {
  const txBody = firstDescendantByTag(sp, 'txBody');
  if (!txBody) return null;
  const paragraphs = [];
  for (const p of childrenByTag(txBody, 'p')) {
    const pPr = firstByTag(p, 'pPr');
    const align = (pPr && pPr.getAttribute('algn')) || 'l';
    const runs = [];
    for (const r of childrenByTag(p, 'r')) {
      const t = firstByTag(r, 't');
      if (!t || !t.textContent) continue;
      const rPr = firstByTag(r, 'rPr');
      const fill = rPr && firstByTag(rPr, 'solidFill');
      runs.push({
        text: t.textContent,
        bold: !!(rPr && rPr.getAttribute('b') === '1'),
        italic: !!(rPr && rPr.getAttribute('i') === '1'),
        sizePt: rPr && rPr.getAttribute('sz') ? Number(rPr.getAttribute('sz')) / 100 : null,
        color: fill ? resolveColor(fill, ctx) : null,
      });
    }
    if (runs.length) paragraphs.push({ align, runs });
  }
  return paragraphs.length ? paragraphs : null;
}

function parseShapes(slideDoc, ctx, layoutPh, masterPh) {
  const spTree = firstDescendantByTag(slideDoc.documentElement, 'spTree');
  if (!spTree) return [];
  const shapes = [];

  for (const node of spTree.children) {
    try {
      if (node.localName === 'sp') {
        const spPr = firstDescendantByTag(node, 'spPr');
        let xfrm = spPr && parseXfrm(spPr);
        if (!xfrm) {
          const key = placeholderKey(node);
          xfrm = (key && (layoutPh[key] || masterPh[key])) || null;
        }
        const paragraphs = parseTextBody(node, ctx);
        if (!paragraphs || !xfrm) continue;
        const fill = spPr ? parseFill(spPr, ctx) : null;
        shapes.push({
          type: 'text', ...xfrm, paragraphs,
          fill: fill && fill.type === 'solid' ? fill.color : null,
        });
      } else if (node.localName === 'pic') {
        const spPr = firstDescendantByTag(node, 'spPr');
        const xfrm = spPr && parseXfrm(spPr);
        const rid = relId(firstDescendantByTag(node, 'blip'), 'embed');
        if (xfrm && rid) shapes.push({ type: 'image', ...xfrm, rid });
      }
    } catch {
      // One bad shape must not take out the slide.
    }
  }
  return shapes;
}

// ── Timing ────────────────────────────────────────────────────────────────────
// p:transition@advTm is "advance after N ms" — the value the old stub
// always replaced with 5000.
function parseDuration(slideDoc) {
  const transition = firstDescendantByTag(slideDoc.documentElement, 'transition');
  if (transition) {
    const advTm = transition.getAttribute('advTm');
    if (advTm !== null && advTm !== '' && Number.isFinite(Number(advTm))) {
      return Math.max(1000, Number(advTm));
    }
  }
  return null; // caller applies the configured default
}

// ── Media extraction ──────────────────────────────────────────────────────────
const MIME_BY_EXT = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', svg: 'image/svg+xml', webp: 'image/webp' };

async function extractImage(zip, path) {
  const file = zip.file(path);
  if (!file) return null;
  const data = await file.async('blob');
  const ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
  return new Blob([data], { type: MIME_BY_EXT[ext] || 'image/png' });
}

// ── Main entry ────────────────────────────────────────────────────────────────
/**
 * Parse a .pptx blob into a renderable plain-JSON model:
 *   { widthEmu, heightEmu,
 *     slides: [{ durationMs|null, background, shapes, error? }],
 *     images: { [zipPath]: Blob } }
 * Image shapes/backgrounds carry an `imageKey` into `images`; the
 * component turns blobs into object URLs and revokes them on unmount.
 */
export async function parsePptxToModel(blob) {
  const zip = await JSZip.loadAsync(blob);

  const presDoc = parseXml(await readZipText(zip, 'ppt/presentation.xml'));
  const sldSz = firstDescendantByTag(presDoc.documentElement, 'sldSz');
  const widthEmu = sldSz ? Number(sldSz.getAttribute('cx')) : 12192000;
  const heightEmu = sldSz ? Number(sldSz.getAttribute('cy')) : 6858000;

  const presRels = await loadRels(zip, 'ppt/presentation.xml');
  const slideIds = descendantsByTag(presDoc.documentElement, 'sldId');
  const images = {};
  const slides = [];

  for (const sldId of slideIds) {
    const rid = relId(sldId, 'id');
    const rel = presRels[rid];
    if (!rel || !rel.type.endsWith('/slide')) continue;

    try {
      const slidePath = rel.target;
      const slideDoc = parseXml(await readZipText(zip, slidePath));
      const slideRels = await loadRels(zip, slidePath);

      // Template chain: slide → layout → master → theme.
      let layoutDoc = null;
      let masterDoc = null;
      let themeColors = {};
      let clrMap = { bg1: 'lt1', tx1: 'dk1', bg2: 'lt2', tx2: 'dk2' };
      let layoutRels = {};
      let masterRels = {};
      const layoutRel = relByTypeEnd(slideRels, '/slideLayout');
      if (layoutRel) {
        const layoutText = await readZipTextOrNull(zip, layoutRel.target);
        if (layoutText) {
          layoutDoc = parseXml(layoutText);
          layoutRels = await loadRels(zip, layoutRel.target);
          const masterRel = relByTypeEnd(layoutRels, '/slideMaster');
          if (masterRel) {
            const masterText = await readZipTextOrNull(zip, masterRel.target);
            if (masterText) {
              masterDoc = parseXml(masterText);
              masterRels = await loadRels(zip, masterRel.target);
              clrMap = parseClrMap(masterDoc);
              const themeRel = relByTypeEnd(masterRels, '/theme');
              if (themeRel) {
                const themeText = await readZipTextOrNull(zip, themeRel.target);
                if (themeText) themeColors = parseThemeColors(parseXml(themeText));
              }
            }
          }
        }
      }

      const ctx = { themeColors, clrMap };
      const layoutPh = indexPlaceholders(layoutDoc);
      const masterPh = indexPlaceholders(masterDoc);

      // Background: slide's own, else layout's, else master's.
      let background = parseBackground(slideDoc, ctx);
      let bgRels = slideRels;
      if (!background && layoutDoc) { background = parseBackground(layoutDoc, ctx); bgRels = layoutRels; }
      if (!background && masterDoc) { background = parseBackground(masterDoc, ctx); bgRels = masterRels; }

      const shapes = parseShapes(slideDoc, ctx, layoutPh, masterPh);

      const materialize = async (imgRid, rels) => {
        const imgRel = rels[imgRid];
        if (!imgRel) return null;
        const key = imgRel.target;
        if (!(key in images)) images[key] = await extractImage(zip, imgRel.target);
        return images[key] ? key : null;
      };
      if (background && background.type === 'image') {
        background.imageKey = await materialize(background.rid, bgRels);
        if (!background.imageKey) background = null;
      }
      for (const shape of shapes) {
        if (shape.type === 'image') shape.imageKey = await materialize(shape.rid, slideRels);
      }

      slides.push({
        durationMs: parseDuration(slideDoc),
        background,
        shapes: shapes.filter((s) => s.type !== 'image' || s.imageKey),
      });
    } catch (err) {
      // Per-slide failure → placeholder slide, deck keeps playing.
      console.warn('pptx: slide failed to parse:', err);
      slides.push({ durationMs: null, background: null, shapes: [], error: true });
    }
  }

  if (!slides.length) throw new Error('No slides found in presentation');
  return { widthEmu, heightEmu, slides, images };
}
