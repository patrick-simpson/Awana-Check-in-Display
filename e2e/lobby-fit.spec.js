import { expect, test } from '@playwright/test';

// The lobby's copy frame on a real screen (rebrand stage 4b): whatever the
// operator types, the words stay inside the safe box, clear of the house
// waves, the corner tab and the top-right stack, and read in their own order.
// src/lib/lobbyFrame.test.js pins the fit's model; this pins what Chromium
// actually lays out from it, in the real faces, frozen under ?lowPower=1.

const URL130 = 'https://kvbc.example.org/awana/registration/2026-27/fall-family-sign-up-form?ref=lobby-tv&utm_source=signage&utm_campaign=fall-welcome-26';
const NAMES = 'Ava Ben Cal Dee Eli Fay Gus Hal Ivy Jo Kit Lu Max Ned Oli Pia Quin Rose Sam Tess Uma Vic Wes Xan Yui Zane'.split(' ');

async function showSlide(page, { eyebrow = '', text, config = {}, weather = null }) {
  await page.route(/pusher|twotimtwo|sockjs/, (route) => route.abort());
  if (weather) {
    await page.route(/open-meteo/, (route) => route.fulfill({
      body: JSON.stringify({ current: { temperature_2m: 72, apparent_temperature: 70, weather_code: weather, is_day: 1 } }),
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
    }));
  } else {
    await page.route(/open-meteo/, (route) => route.abort());
  }
  await page.addInitScript((cfg) => {
    localStorage.setItem('awanaSetupCardDismissed.v1', '1');
    localStorage.setItem('awanaConfig.v1', JSON.stringify(cfg));
  }, {
    pusherAppKey: '',
    backgroundSource: 'manual',
    calendarEnabled: false,
    seasonPromos: false,
    slideshowDelaySec: 3,
    manualSlides: [{ id: 's_fit', eyebrow, text, theme: 'sky', textSize: 'auto', durationSec: 0 }],
    ...config,
  });
  await page.goto('/index.html?lowPower=1');
  await expect(page.locator('.lobby-headline')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  // A face that lands after the first fit refits; let that settle.
  await page.waitForTimeout(300);
}

/** Boxes in px: the stage (the 16:9 box, u = its width / 100), the headline's and kicker's text, the waves. */
const measure = (page) => page.evaluate(() => {
  const rect = (r) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
  const textBox = (el) => {
    if (!el) return null;
    const range = document.createRange();
    range.selectNodeContents(el);
    const rs = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
    return {
      left: Math.min(...rs.map((r) => r.left)),
      top: Math.min(...rs.map((r) => r.top)),
      right: Math.max(...rs.map((r) => r.right)),
      bottom: Math.max(...rs.map((r) => r.bottom)),
      rects: rs.map(rect),
    };
  };
  const stage = document.querySelector('.lobby-stage').getBoundingClientRect();
  return {
    screen: { width: innerWidth, height: innerHeight },
    stage: rect(stage),
    u: stage.width / 100,
    headline: textBox(document.querySelector('.lobby-headline')),
    kicker: textBox(document.querySelector('.lobby-kicker')),
    waves: rect(document.querySelector('.lobby-waves').getBoundingClientRect()),
    fontSize: parseFloat(getComputedStyle(document.querySelector('.lobby-headline')).fontSize),
    words: [...document.querySelectorAll('.lobby-headline .lobby-word')].map((w) => ({ text: w.textContent, ...rect(w.getBoundingClientRect()) })),
    text: document.querySelector('.lobby-headline').textContent,
  };
});

test('a long list, one name per line, stays above the house waves', async ({ page }) => {
  await showSlide(page, { eyebrow: 'Thank you', text: ['Book finishers!', ...NAMES].join('\n') });
  const m = await measure(page);
  expect(m.headline.bottom).toBeLessThanOrEqual(m.waves.top);
  for (const name of NAMES) expect(m.text).toContain(name);
  // Still a size a room can read.
  expect(m.fontSize / m.u).toBeGreaterThanOrEqual(1.5);
});

test('a pasted URL wraps inside the read layout\'s width, at a readable size', async ({ page }) => {
  await showSlide(page, { text: URL130 });
  const m = await measure(page);
  const mid = (m.stage.left + m.stage.right) / 2;
  expect(m.headline.left).toBeGreaterThanOrEqual(mid - 38.5 * m.u);
  expect(m.headline.right).toBeLessThanOrEqual(mid + 38.5 * m.u);
  expect(m.headline.bottom).toBeLessThanOrEqual(m.waves.top);
  expect(m.fontSize / m.u).toBeGreaterThanOrEqual(2.4);
});

test('a Chinese sentence wraps between its words instead of shrinking to one line', async ({ page }) => {
  await showSlide(page, { eyebrow: '本周', text: '欢迎来到今晚的俱乐部活动请带上你的手册和圣经我们一起学习一起玩游戏欢迎你们大家' });
  const m = await measure(page);
  expect(new Set(m.words.map((w) => Math.round(w.top))).size).toBeGreaterThan(1);
  expect(m.fontSize / m.u).toBeGreaterThanOrEqual(4);
  expect(m.headline.right - m.headline.left).toBeLessThanOrEqual(77 * m.u);
});

test('a Hebrew headline reads right to left, word by word', async ({ page }) => {
  await showSlide(page, { text: 'ברוכים הבאים לאוואנה הערב' });
  const m = await measure(page);
  const [first, second] = m.words;
  expect(first.text).toBe('ברוכים');
  expect(Math.round(first.top)).toBe(Math.round(second.top));
  expect(first.left).toBeGreaterThan(second.left);
});

test('a kicker at the editor\'s full length stays on the screen', async ({ page }) => {
  await showSlide(page, { eyebrow: '通'.repeat(60), text: 'Hi there' });
  const m = await measure(page);
  expect(m.kicker.left).toBeGreaterThanOrEqual(0);
  expect(m.kicker.right).toBeLessThanOrEqual(m.screen.width);
  expect(m.kicker.right - m.kicker.left).toBeLessThanOrEqual(84.5 * m.u);
});

test.describe('at 1280x720', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('a long kicker on a full slide stays clear of the top-right stack', async ({ page }) => {
    await showSlide(page, {
      eyebrow: 'IMPORTANT ANNOUNCEMENT FOR ALL PARENTS AND GUARDIANS TONIGHT',
      text: 'Parents, please remember that pick-up is at the gym doors this week while the lobby floor is refinished. '.repeat(6).slice(0, 500),
      config: { showConnectionStatus: true },
      weather: 96, // "Thunderstorm with hail": the widest weather chip there is
    });
    // The corner shows one item at a time; wait for the weather's turn.
    await expect(page.locator('.corner-top .corner-chip')).toBeVisible({ timeout: 12_000 });
    await page.waitForTimeout(400);
    const stack = await page.locator('.corner-stack .sticker-chip, .corner-top .corner-chip').evaluateAll((els) => els.map((e) => {
      const r = e.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    }));
    const m = await measure(page);
    const hits = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    for (const box of stack) {
      for (const r of [...m.kicker.rects, ...m.headline.rects]) expect(hits(box, r)).toBe(false);
    }
    expect(m.headline.bottom).toBeLessThanOrEqual(m.waves.top);
  });
});
