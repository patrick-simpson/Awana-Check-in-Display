import JSZip from 'jszip';

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
 * Download PPTX file from URL
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

/**
 * Parse PPTX blob and extract slides with timing info
 */
export async function parsePptx(blob) {
  const zip = await JSZip.loadAsync(blob);

  // Get presentation.xml to find slide list
  const presXml = await readZipText(zip, 'ppt/presentation.xml');
  const presDoc = new DOMParser().parseFromString(presXml, 'text/xml');

  // Get slide IDs
  const slideIds = Array.from(
    presDoc.querySelectorAll('p\\:sldId, sldId')
  ).map(el => ({
    id: el.getAttribute('id'),
    rid: el.getAttribute('r:id') || el.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id')
  }));

  // Get slide file names from relationships
  const relsXml = await readZipText(zip, 'ppt/_rels/presentation.xml.rels');
  const relsDoc = new DOMParser().parseFromString(relsXml, 'text/xml');

  const slideMap = {};
  relsDoc.querySelectorAll('Relationship').forEach(rel => {
    // Match the slide relationship type exactly — "slideLayout" and
    // "slideMaster" relationship types also contain the word "slide".
    if (/\/relationships\/slide$/.test(rel.getAttribute('Type') || '')) {
      slideMap[rel.getAttribute('Id')] = rel.getAttribute('Target');
    }
  });

  // Parse each slide
  const slides = [];
  for (const slideId of slideIds) {
    const target = slideMap[slideId.rid];
    if (!target) continue; // dangling relationship id — skip rather than crash
    const slidePath = `ppt/${target.replace(/^\//, '').replace(/^ppt\//, '')}`;
    const slideXml = await readZipText(zip, slidePath);
    const slideDoc = new DOMParser().parseFromString(slideXml, 'text/xml');

    // Extract timing
    const timing = extractTiming(slideDoc);

    slides.push({
      id: slideId.id,
      duration: timing.duration,
      path: slidePath,
      xml: slideXml
    });
  }

  return {
    slides,
    zip
  };
}

/**
 * Extract slide duration from slide XML
 * PowerPoint stores timing in milliseconds in the XML
 */
function extractTiming(slideDoc) {
  // Look for animation/transition timing
  const timing = slideDoc.querySelector('p\\:timing, timing');

  if (timing) {
    // Try to find slide duration
    const tnLst = timing.querySelector('p\\:tnLst, tnLst');
    if (tnLst) {
      // This is complex; for now return default
      return { duration: 5000 };
    }
  }

  // Default to 5 seconds if no timing found
  return { duration: 5000 };
}

/**
 * Render slide to canvas or get preview image
 * This is simplified - just return XML for now
 */
export function getSlideInfo(slide) {
  return {
    duration: slide.duration,
    id: slide.id
  };
}
