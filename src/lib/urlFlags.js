// URL flags for embedding the display inside other systems — an OBS
// browser source, ProPresenter web page, vMix, etc.
//
//   ?overlay=1            transparent stage, banners + confetti only
//   ?chroma=00b140        solid key color instead of transparency
//                         (implies overlay mode)
//   ?key=...&cluster=us2  Pusher app key/cluster, so an embedded browser
//                         with no localStorage access can still connect.
//                         The key is Pusher's PUBLIC subscribe key —
//                         safe to put in a URL.
//
// Example OBS browser source URL:
//   https://…/Awana-Check-in-Display/?overlay=1&key=abc123&cluster=us2
export function parseUrlFlags(search = window.location.search) {
  const params = new URLSearchParams(search);

  const overlayParam = (params.get('overlay') || '').toLowerCase();
  const chromaRaw = (params.get('chroma') || '').replace(/^#/, '');
  const chroma = /^[0-9a-fA-F]{6}$/.test(chromaRaw) ? `#${chromaRaw.toLowerCase()}` : null;

  const key = (params.get('key') || '').trim();
  const cluster = (params.get('cluster') || '').trim();

  // ?config=<https-url>: fetch a JSON of config overrides at startup —
  // central management for a fleet of displays. Precedence stays
  // defaults < remote config < this device's saved overrides < ?key.
  const configRaw = (params.get('config') || '').trim();
  let configUrl = null;
  try {
    if (configRaw) {
      const u = new URL(configRaw);
      if (u.protocol === 'https:' || u.protocol === 'http:') configUrl = u.href;
    }
  } catch { /* malformed — ignore */ }

  return {
    overlay: ['1', 'true', 'yes'].includes(overlayParam) || chroma !== null,
    chroma,
    pusherAppKey: key || null,
    pusherCluster: cluster || null,
    configUrl,
  };
}
