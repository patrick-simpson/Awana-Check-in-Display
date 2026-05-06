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

  try {
    const response = await fetch(downloadUrl);
    if (!response.ok) throw new Error(`Failed to download: ${response.status}`);
    return await response.blob();
  } catch (err) {
    console.error('PPTX download error:', err);
    throw err;
  }
}

/**
 * Parse PPTX blob and extract slides with timing info
 */
export async function parsePptx(blob) {
  try {
    const zip = await JSZip.loadAsync(blob);

    // Get presentation.xml to find slide list
    const presXml = await zip.file('ppt/presentation.xml').async('text');
    const presDoc = new DOMParser().parseFromString(presXml, 'text/xml');

    // Get slide IDs
    const slideIds = Array.from(
      presDoc.querySelectorAll('p\\:sldId, sldId')
    ).map(el => ({
      id: el.getAttribute('id'),
      rid: el.getAttribute('r:id') || el.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id')
    }));

    // Get slide file names from relationships
    const relsXml = await zip.file('ppt/_rels/presentation.xml.rels').async('text');
    const relsDoc = new DOMParser().parseFromString(relsXml, 'text/xml');

    const slideMap = {};
    relsDoc.querySelectorAll('Relationship').forEach(rel => {
      if (rel.getAttribute('Type').includes('slide')) {
        slideMap[rel.getAttribute('Id')] = rel.getAttribute('Target');
      }
    });

    // Parse each slide
    const slides = [];
    for (const slideId of slideIds) {
      const slidePath = `ppt/${slideMap[slideId.rid]}`;
      const slideXml = await zip.file(slidePath).async('text');
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
  } catch (err) {
    console.error('PPTX parse error:', err);
    throw err;
  }
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
