import { devices, expect, test } from '@playwright/test';

// The projector page on phones and tablets (owner, 2026-09-30: "I want this
// website to fully work on mobile. I tested it out and couldn't push B").
// Everything a finger needs is gated on the primary pointer (src/presentation/
// lib/touch.js), so these run in real touch contexts (isMobile + hasTouch,
// Chromium's emulation, where `(hover: none) and (pointer: coarse)` is true)
// and the desktop suites (countdown-modes, bracelets, setup-card, the visual
// baselines) stay the proof that the projector PC's wall did not change.
//
// The device descriptors' own viewports are the visible area under the
// browser's toolbars (an iPhone 14 is 390x664 in Safari, not its 390x844
// screen), which is what a page really gets. Their defaultBrowserType is
// dropped: only Chromium runs here, and it emulates each of them.

const device = (name) => {
  const { defaultBrowserType: _browser, ...rest } = devices[name];
  return rest;
};
const DEVICES = [
  ['iPhone 14', device('iPhone 14')],
  ['iPhone 14 landscape', device('iPhone 14 landscape')],
  ['Pixel 7', device('Pixel 7')],
  ['iPad Pro 11', device('iPad Pro 11')],
  ['iPad Pro 11 landscape', device('iPad Pro 11 landscape')],
];

const at = (now, extra = '') => `/countdown.html?now=${now}&freeze=1${extra}`;
const TUESDAY = '2026-09-15T18:30:00';
const BRACELETS = '2026-09-30T18:07:15';

test.beforeEach(async ({ page }) => {
  await page.route(/open-meteo|pusher|twotimtwo/, (route) => route.abort());
  // The first-run note is its own subject below; everywhere else it is dismissed.
  await page.addInitScript(() => localStorage.setItem('awanaSetupChecklistDismissed.v1', '1'));
});

/** A box {x, y, width, height} entirely on the screen, and at least 44x44. */
async function expectTarget(locator, name) {
  const box = await locator.boundingBox();
  expect(box, name).not.toBeNull();
  const vp = locator.page().viewportSize();
  expect(box.width, `${name} width`).toBeGreaterThanOrEqual(44);
  expect(box.height, `${name} height`).toBeGreaterThanOrEqual(44);
  expect(box.x, `${name} left`).toBeGreaterThanOrEqual(0);
  expect(box.y, `${name} top`).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width, `${name} right`).toBeLessThanOrEqual(vp.width + 0.5);
  expect(box.y + box.height, `${name} bottom`).toBeLessThanOrEqual(vp.height + 0.5);
}

/** Every visible, enabled button inside `root`: each one must be a finger's target. */
async function expectAllTargets(root) {
  const sizes = await root.evaluate((el) => [...el.querySelectorAll('button')]
    .filter((b) => b.offsetParent !== null && !b.disabled)
    .map((b) => {
      const r = b.getBoundingClientRect();
      return { name: (b.getAttribute('aria-label') || b.textContent).trim().slice(0, 30), w: r.width, h: r.height };
    }));
  expect(sizes.length).toBeGreaterThan(3);
  const small = sizes.filter((s) => s.w < 44 - 0.5 || s.h < 44 - 0.5);
  expect(small).toEqual([]);
}

const menuButton = (page) => page.getByRole('button', { name: 'Open the menu' });
const sheet = (page) => page.getByRole('dialog', { name: 'Projector menu' });

for (const [name, use] of DEVICES) {
  test.describe(name, () => {
    test.use(use);

    test('is a touch page: a visible menu button, and no hover panel on the wall', async ({ page }) => {
      await page.goto(at(TUESDAY));
      await expect(page.locator('[data-mode="countdown"]')).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('data-touch', '1');
      await expectTarget(menuButton(page), 'menu button');
      // The hover menu is not on the page at all: nothing of it can catch a tap.
      await expect(page.getByRole('button', { name: 'Main Countdown' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /Display Settings/ })).toHaveCount(0);
    });

    test('the menu opens by tap, covers the screen, and every control in it is a finger\'s size', async ({ page }) => {
      await page.goto(at(TUESDAY));
      await menuButton(page).tap();
      const s = sheet(page);
      await expect(s).toBeVisible();
      const box = await s.boundingBox();
      const vp = page.viewportSize();
      expect(Math.round(box.width)).toBe(vp.width);
      expect(Math.round(box.height)).toBe(vp.height);
      // Open the folds so their controls are measured too.
      await s.getByRole('button', { name: /Skip Weeks/ }).tap();
      await s.getByRole('button', { name: /Display Settings/ }).tap();
      await expectAllTargets(s);
      // Its fields are 16px or more, so iOS never zooms the page into one.
      const fonts = await s.locator('input').evaluateAll((els) => els.map((e) => parseFloat(getComputedStyle(e).fontSize)));
      expect(fonts.length).toBeGreaterThan(1);
      for (const f of fonts) expect(f).toBeGreaterThanOrEqual(16);
      await s.getByRole('button', { name: 'Close the menu' }).tap();
      await expect(s).toHaveCount(0);
    });

    test('its picks change the wall, and the sheet gets out of the way', async ({ page }) => {
      await page.goto(`/countdown.html?now=${TUESDAY}`);
      await menuButton(page).tap();
      await sheet(page).getByRole('button', { name: 'Opening Ceremony' }).tap();
      await expect(sheet(page)).toHaveCount(0);
      await expect(page.locator('[data-mode="slideshow"][data-deck="opening"]')).toBeVisible();
      // A pick holds the wall: Resume Schedule is on offer now, and goes back.
      await menuButton(page).tap();
      await sheet(page).getByRole('button', { name: 'Resume Schedule' }).tap();
      await expect(page.locator('[data-mode="countdown"]')).toBeVisible();
      await menuButton(page).tap();
      await sheet(page).getByRole('button', { name: 'T&T Game Time' }).tap();
      await expect(page.locator('[data-mode="game-time"]')).toBeVisible();
    });

    test('the switches flip by tap, with their hints written out', async ({ page }) => {
      await page.goto(at(TUESDAY));
      await menuButton(page).tap();
      const low = sheet(page).getByRole('switch', { name: /Low power mode/ });
      await expect(low).toHaveAttribute('aria-checked', 'false');
      await expect(sheet(page).getByText('Hides particle / weather layers for weak hardware')).toBeVisible();
      await low.tap();
      await expect(low).toHaveAttribute('aria-checked', 'true');
      expect(await page.evaluate(() => localStorage.getItem('awanaPresentationLowPower.v1'))).toBe('1');
      await low.tap();
      await expect(low).toHaveAttribute('aria-checked', 'false');
    });

    test('taps on the wall never reach a hidden menu', async ({ page }) => {
      await page.goto(`/countdown.html?now=${TUESDAY}`);
      await expect(page.locator('[data-mode="countdown"]')).toBeVisible();
      const vp = page.viewportSize();
      // The timer is a control of its own (a tap on it skips the countdown),
      // and a finger is not a point: Chromium snaps a tap that lands near a
      // control onto it, as a phone does. Everywhere else is only the wall.
      const timer = await page.locator('[data-timer]').boundingBox();
      const pad = 64;
      const onTimer = (x, y) => x >= timer.x - pad && x <= timer.x + timer.width + pad
        && y >= timer.y - pad && y <= timer.y + timer.height + pad;
      // Where the hover panel's invisible buttons used to sit (the top-right
      // two thirds of a phone), and the wall's other corners.
      for (const [fx, fy] of [[0.5, 0.12], [0.75, 0.3], [0.9, 0.55], [0.3, 0.2], [0.5, 0.92], [0.1, 0.9], [0.95, 0.35]]) {
        const [x, y] = [Math.round(vp.width * fx), Math.round(vp.height * fy)];
        if (!onTimer(x, y)) await page.touchscreen.tap(x, y);
      }
      await expect(page.locator('[data-mode="countdown"]')).toBeVisible();
      await expect(sheet(page)).toHaveCount(0);
      expect(await page.evaluate(() => [
        localStorage.getItem('awanaCountdownStingers.v1'),
        localStorage.getItem('awanaPresentationLowPower.v1'),
        localStorage.getItem('awanaScheduleOverlay.v1'),
      ])).toEqual([null, null, null]);
    });
  });
}

/* ── Bracelet Time by tap (tonight, 2026-09-30, and Oct 7) ─────────────── */

for (const [name, use] of [DEVICES[0], DEVICES[1], DEVICES[3]]) {
  test.describe(`Bracelet Time on ${name}`, () => {
    test.use(use);

    test('the controls open from the menu, a held step can be chosen, and Reset goes back, all by tap', async ({ page }) => {
      await page.goto(at(BRACELETS));
      await expect(page.locator('[data-bracelet-step]')).toHaveAttribute('data-bracelet-step', '4');
      await menuButton(page).tap();
      await sheet(page).getByRole('button', { name: 'Bracelet Time controls' }).tap();
      await expect(sheet(page)).toHaveCount(0);
      const panel = page.getByRole('dialog', { name: 'Bracelet Time controls' });
      await expect(panel).toBeVisible();
      await expect(panel.getByText(/Tap ✕ or anywhere outside this panel/)).toBeVisible();
      await expect(panel.getByText(/B opens and closes/)).toHaveCount(0);
      // A bottom sheet on the screen, with its own scroll, every control a finger's size.
      const box = await panel.boundingBox();
      const vp = page.viewportSize();
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 0.5);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 0.5);
      await expectAllTargets(panel);

      await panel.getByRole('button', { name: 'K2' }).tap();
      await expect(page.locator('[data-bracelet-phase]')).toHaveAttribute('data-bracelet-phase', 'hold');
      await expect(page.locator('[data-bracelet-step]')).toHaveAttribute('data-bracelet-step', '9');
      await expect(panel.getByText(/Holding knot 2:/)).toBeVisible();
      await panel.getByRole('button', { name: 'Full instructions' }).tap();
      await expect(page.locator('[data-bracelet-phase]')).toHaveAttribute('data-bracelet-phase', 'overview');
      await panel.getByRole('button', { name: 'Reset' }).tap();
      await expect(page.locator('[data-bracelet-phase]')).toHaveAttribute('data-bracelet-phase', 'steps');
      await panel.getByRole('button', { name: 'Close' }).tap();
      await expect(panel).toHaveCount(0);
    });

    test('a tap outside the controls closes them, and never reaches the wall under them', async ({ page }) => {
      await page.goto(at(BRACELETS));
      await menuButton(page).tap();
      await sheet(page).getByRole('button', { name: 'Bracelet Time controls' }).tap();
      const panel = page.getByRole('dialog', { name: 'Bracelet Time controls' });
      await expect(panel).toBeVisible();
      const box = await panel.boundingBox();
      // The backdrop above the sheet (there is always some: the sheet stops short of the top).
      await page.touchscreen.tap(Math.round(box.x + box.width / 2), Math.max(2, Math.round(box.y / 2)));
      await expect(panel).toHaveCount(0);
      await expect(page.locator('[data-mode="game-time"][data-activity="bracelets"]')).toBeVisible();
      await expect(sheet(page)).toHaveCount(0);
    });
  });
}

test.describe('Bracelet Time on another night', () => {
  test.use(DEVICES[0][1]);

  test('the touch menu has no Bracelet Time row', async ({ page }) => {
    await page.goto(at('2026-10-14T18:07:00'));
    await expect(page.locator('[data-mode="game-time"]')).toBeVisible();
    await menuButton(page).tap();
    await expect(sheet(page)).toBeVisible();
    await expect(sheet(page).getByRole('button', { name: /Bracelet Time/ })).toHaveCount(0);
  });
});
