import { expect, test } from '@playwright/test';

// The permanent flagship slide (src/lib/flagship.js, FlagshipSlide.jsx): the
// first thing a typed-deck screen shows. Under ?lowPower=1 (which is also how
// the paused-clock visual suite sees it) every beat is already at its last
// keyframe, so the finished slide must be on screen at once.

const CONFIG = {
  pusherAppKey: 'e2e-key',
  pusherCluster: 'us2',
  backgroundSource: 'manual',
  calendarEnabled: false,
  seasonPromos: false,
  manualSlides: [],
  showClock: false,
  showTally: false,
  showWeatherChip: false,
  particleEffect: 'off',
  confettiLevel: 'off',
  firstArrivalMoment: false,
};

async function boot(page, query = '?lowPower=1', config = CONFIG) {
  await page.route(/open-meteo|pusher/, (r) => r.abort());
  await page.addInitScript((c) => {
    localStorage.setItem('awanaConfig.v1', JSON.stringify(c));
    localStorage.setItem('awanaSetupCardDismissed.v1', '1');
  }, config);
  await page.goto(`/index.html${query}`);
  await expect(page.locator('.flagship')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

test('a screen with no slides of its own opens on the finished flagship, at rest under ?lowPower=1', async ({ page }) => {
  await boot(page);
  await expect(page.locator('.flagship')).toHaveAttribute('aria-label', /welcome to awana/i);
  // Every letter of both rows, fully lit and in place.
  const letters = await page.locator('.flagship-letter').evaluateAll((els) => els.map((e) => ({
    op: Number(getComputedStyle(e).opacity),
    t: getComputedStyle(e).transform,
  })));
  expect(letters.length).toBe('WELCOME'.length + 'TOAWANA!'.length);
  for (const l of letters) {
    expect(l.op).toBe(1);
    expect(['none', 'matrix(1, 0, 0, 1, 0, 0)']).toContain(l.t);
  }
  // Six club plates, each with its mark, all resting.
  const plates = await page.locator('.flagship-plate').evaluateAll((els) => els.map((e) => ({ op: Number(getComputedStyle(e).opacity), img: !!e.querySelector('img'), w: e.getBoundingClientRect().width })));
  expect(plates).toHaveLength(6);
  for (const p of plates) { expect(p.op).toBe(1); expect(p.img).toBe(true); expect(p.w).toBeGreaterThan(50); }
  // Zero animation: nothing is moving, and the sheen has left.
  expect(await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length)).toBe(0);
  expect(Number(await page.locator('.flagship-sheen').evaluate((e) => getComputedStyle(e).opacity))).toBe(0);
});

test('the headline and the plates stay clear of the corner tab and the foot at every common size', async ({ page }) => {
  await boot(page);
  for (const [w, h] of [[1024, 768], [1280, 720], [1366, 768], [1920, 1080], [3840, 2160]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(150);
    const boxes = await page.evaluate(() => {
      const r = (sel) => { const e = document.querySelector(sel); const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; };
      const rows = [...document.querySelectorAll('.flagship-row')].map((e) => { const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; });
      const plates = [...document.querySelectorAll('.flagship-plate')].map((e) => { const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; });
      return { tab: r('.flagship-tab'), rows, plates, vw: innerWidth, vh: innerHeight };
    });
    const u = Math.min(boxes.vw / 100, boxes.vh / 56.25);
    const frameTop = (boxes.vh - 56.25 * u) / 2;
    const overlap = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
    for (const row of boxes.rows) {
      expect(overlap(row, boxes.tab), `${w}x${h}: a headline row under the corner tab`).toBe(false);
      expect(row.l, `${w}x${h}`).toBeGreaterThan(0);
      expect(row.r, `${w}x${h}`).toBeLessThan(boxes.vw);
    }
    // The lobby's content ends 45u down (LAYOUT.safeBottom): nothing of this slide's text or plates below it.
    for (const p of boxes.plates) expect(p.b - frameTop, `${w}x${h}: a plate below 45u`).toBeLessThanOrEqual(45.2 * u);
    // ...and the plates do not touch the headline above them.
    const lowestRow = Math.max(...boxes.rows.map((r) => r.b));
    for (const p of boxes.plates) expect(p.t, `${w}x${h}: a plate up in the headline`).toBeGreaterThan(lowestRow - 0.5 * u);
  }
});
