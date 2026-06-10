import { describe, it, expect } from 'vitest';
import { normalizeEmbedUrl } from './BackgroundIframe.jsx';

describe('normalizeEmbedUrl', () => {
  it('decodes &amp; separators copied from iframe HTML snippets', () => {
    const url = 'https://onedrive.live.com/embed?resid=ABC&amp;authkey=xyz&amp;em=2&amp;wdSlideShowDelay=0';
    expect(normalizeEmbedUrl(url)).toBe(
      'https://onedrive.live.com/embed?resid=ABC&authkey=xyz&em=2&wdSlideShowDelay=0',
    );
  });

  it('adds em=2 and wdSlideShowDelay to OneDrive embed URLs', () => {
    const out = normalizeEmbedUrl('https://onedrive.live.com/embed?resid=ABC', 5);
    expect(out).toContain('em=2');
    expect(out).toContain('wdSlideShowDelay=5000');
  });

  it('converts the delay from seconds to milliseconds', () => {
    expect(normalizeEmbedUrl('https://onedrive.live.com/embed?resid=A', 10)).toContain('wdSlideShowDelay=10000');
    // 0 = let the presentation's own timings drive the show.
    expect(normalizeEmbedUrl('https://onedrive.live.com/embed?resid=A', 0)).toContain('wdSlideShowDelay=0');
  });

  it('falls back to 5s when the delay is invalid', () => {
    expect(normalizeEmbedUrl('https://onedrive.live.com/embed?resid=A', NaN)).toContain('wdSlideShowDelay=5000');
    expect(normalizeEmbedUrl('https://onedrive.live.com/embed?resid=A', -3)).toContain('wdSlideShowDelay=5000');
  });

  it('does not duplicate an existing wdSlideShowDelay', () => {
    const url = 'https://onedrive.live.com/embed?resid=A&em=2&wdSlideShowDelay=3000';
    expect(normalizeEmbedUrl(url, 5)).toBe(url);
  });

  it('upgrades SharePoint Doc.aspx links to embed view', () => {
    const out = normalizeEmbedUrl('https://contoso.sharepoint.com/:p:/Doc.aspx?sourcedoc=x');
    expect(out).toContain('action=embedview');
  });

  it('leaves non-Office URLs untouched', () => {
    const url = 'https://example.com/some-page?foo=1';
    expect(normalizeEmbedUrl(url, 5)).toBe(url);
  });

  it('passes through empty values', () => {
    expect(normalizeEmbedUrl('')).toBe('');
    expect(normalizeEmbedUrl(null)).toBeNull();
  });
});
