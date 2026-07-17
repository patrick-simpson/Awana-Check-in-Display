import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { parsePptxToModel } from './pptxHandler.js';

// A 1×1 transparent PNG.
const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

// Build a minimal two-slide deck in memory: no binary fixture to
// maintain, and the test exercises the exact zip/rels/theme paths the
// parser walks.
async function buildFixtureDeck() {
  const zip = new JSZip();

  zip.file('ppt/presentation.xml', `<?xml version="1.0"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldIdLst>
    <p:sldId id="256" r:id="rId1"/>
    <p:sldId id="257" r:id="rId2"/>
  </p:sldIdLst>
  <p:sldSz cx="12192000" cy="6858000"/>
</p:presentation>`);

  zip.file('ppt/_rels/presentation.xml.rels', `<?xml version="1.0"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/>
</Relationships>`);

  // Slide 1: solid background, one centered title run, advTm=3000.
  zip.file('ppt/slides/slide1.xml', `<?xml version="1.0"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld>
    <p:bg><p:bgPr><a:solidFill><a:srgbClr val="112233"/></a:solidFill></p:bgPr></p:bg>
    <p:spTree>
      <p:sp>
        <p:spPr>
          <a:xfrm><a:off x="1219200" y="685800"/><a:ext cx="9753600" cy="1371600"/></a:xfrm>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/>
          <a:p>
            <a:pPr algn="ctr"/>
            <a:r>
              <a:rPr b="1" sz="4400"><a:solidFill><a:srgbClr val="FFCC00"/></a:solidFill></a:rPr>
              <a:t>Welcome to Awana!</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
  <p:transition advTm="3000"/>
</p:sld>`);

  // Slide 2: schemeClr background via layout→master→theme chain + a picture.
  zip.file('ppt/slides/slide2.xml', `<?xml version="1.0"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld>
    <p:bg><p:bgPr><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></p:bgPr></p:bg>
    <p:spTree>
      <p:pic>
        <p:blipFill><a:blip r:embed="rId5"/></p:blipFill>
        <p:spPr>
          <a:xfrm><a:off x="0" y="0"/><a:ext cx="6096000" cy="3429000"/></a:xfrm>
        </p:spPr>
      </p:pic>
    </p:spTree>
  </p:cSld>
</p:sld>`);

  zip.file('ppt/slides/_rels/slide1.xml.rels', `<?xml version="1.0"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`);

  zip.file('ppt/slides/_rels/slide2.xml.rels', `<?xml version="1.0"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/>
</Relationships>`);

  zip.file('ppt/slideLayouts/slideLayout1.xml', `<?xml version="1.0"?>
<p:sldLayout xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree/></p:cSld></p:sldLayout>`);
  zip.file('ppt/slideLayouts/_rels/slideLayout1.xml.rels', `<?xml version="1.0"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`);

  zip.file('ppt/slideMasters/slideMaster1.xml', `<?xml version="1.0"?>
<p:sldMaster xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld><p:spTree/></p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2"/>
</p:sldMaster>`);
  zip.file('ppt/slideMasters/_rels/slideMaster1.xml.rels', `<?xml version="1.0"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>`);

  zip.file('ppt/theme/theme1.xml', `<?xml version="1.0"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <a:themeElements>
    <a:clrScheme name="Test">
      <a:dk1><a:srgbClr val="000000"/></a:dk1>
      <a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>
      <a:dk2><a:srgbClr val="222222"/></a:dk2>
      <a:lt2><a:srgbClr val="EEEEEE"/></a:lt2>
      <a:accent1><a:srgbClr val="4CAF50"/></a:accent1>
      <a:accent2><a:srgbClr val="E14B4B"/></a:accent2>
    </a:clrScheme>
  </a:themeElements>
</a:theme>`);

  zip.file('ppt/media/image1.png', PNG_B64, { base64: true });

  return zip.generateAsync({ type: 'blob' });
}

describe('parsePptxToModel', () => {
  it('parses geometry, text, colors, images and timing from a real zip', async () => {
    const blob = await buildFixtureDeck();
    const model = await parsePptxToModel(blob);

    expect(model.widthEmu).toBe(12192000);
    expect(model.heightEmu).toBe(6858000);
    expect(model.slides).toHaveLength(2);

    const [s1, s2] = model.slides;

    // Slide 1 — solid bg, one bold centered 44pt yellow run, advTm honored
    // (the old stub always returned 5000).
    expect(s1.background).toEqual({ type: 'solid', color: '#112233' });
    expect(s1.durationMs).toBe(3000);
    expect(s1.shapes).toHaveLength(1);
    const text = s1.shapes[0];
    expect(text.type).toBe('text');
    expect(text.x).toBe(1219200);
    expect(text.w).toBe(9753600);
    expect(text.paragraphs[0].align).toBe('ctr');
    const run = text.paragraphs[0].runs[0];
    expect(run.text).toBe('Welcome to Awana!');
    expect(run.bold).toBe(true);
    expect(run.sizePt).toBe(44);
    expect(run.color).toBe('#ffcc00');

    // Slide 2 — schemeClr resolved through layout → master → theme; the
    // picture is extracted into the images map.
    expect(s2.background).toEqual({ type: 'solid', color: '#4caf50' });
    expect(s2.durationMs).toBeNull();
    expect(s2.shapes).toHaveLength(1);
    expect(s2.shapes[0].type).toBe('image');
    expect(s2.shapes[0].imageKey).toBe('ppt/media/image1.png');
    expect(model.images['ppt/media/image1.png']).toBeInstanceOf(Blob);
  });

  it('rejects a zip with no slides', async () => {
    const zip = new JSZip();
    zip.file('ppt/presentation.xml', '<?xml version="1.0"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>');
    zip.file('ppt/_rels/presentation.xml.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>');
    const blob = await zip.generateAsync({ type: 'blob' });
    await expect(parsePptxToModel(blob)).rejects.toThrow(/No slides/);
  });
});
