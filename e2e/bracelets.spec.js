import { expect, test } from '@playwright/test';

// Bracelet Time on the projector (owner, 2026-09-30): on the two bracelet
// nights the T&T and Sparks game windows show how to make the bracelet;
// everything else is exactly as before. Time travel with ?now= (the zone is
// pinned in playwright.config.js); &freeze=1 where the cadence matters,
// because a ticking clock can cross a beat while the page loads.

const at = (now, extra = '') => `/countdown.html?now=${now}&freeze=1${extra}`;

test.beforeEach(async ({ page }) => {
  await page.route(/open-meteo|pusher|twotimtwo/, (route) => route.abort());
  await page.addInitScript(() => localStorage.setItem('awanaPresentationSetupDismissed.v1', '1'));
});

const CASES = [
  // [now, bracelets?, phase, label]
  ['2026-09-30T18:05:04', true, 'steps', 'T&T opens on step 1, the chime lead in the corner only'],
  ['2026-09-30T18:05:40', true, 'epic', 'the epic how-to 10 s in'],
  ['2026-09-30T18:07:15', true, 'steps', 'one step at a time after it'],
  ['2026-09-30T18:31:50', true, 'steps', 'Sparks too'],
  ['2026-10-07T18:12:30', true, 'steps', 'and on Oct 7'],
  ['2026-09-30T19:05:00', false, null, 'Puggles & Cubbies keep game time'],
  ['2026-09-23T18:07:00', false, null, 'an ordinary week keeps game time'],
  ['2026-10-14T18:35:00', false, null, 'and so does the week after'],
];

for (const [now, bracelets, phase, label] of CASES) {
  test(`${label} (${now})`, async ({ page }) => {
    await page.goto(at(now));
    const view = page.locator('[data-mode="game-time"]');
    await expect(view).toBeVisible();
    if (bracelets) {
      await expect(view).toHaveAttribute('data-activity', 'bracelets');
      await expect(view.locator('[data-bracelet-phase]')).toHaveAttribute('data-bracelet-phase', phase);
    } else {
      await expect(view).not.toHaveAttribute('data-activity', /.*/);
      await expect(view.locator('[data-bracelet-phase]')).toHaveCount(0);
      await expect(view.getByText('GAME TIME!', { exact: false })).toBeVisible();
    }
  });
}

test('the opening ceremony on a bracelet night is untouched', async ({ page }) => {
  await page.goto(at('2026-09-30T18:00:30'));
  await expect(page.locator('[data-mode="slideshow"][data-deck="opening"]')).toBeVisible();
});

test('steps go in the handout\'s order, each for its own slot, from step 1 after the epic', async ({ page }) => {
  // The 18:05:10 epic ends 18:06:40. Bead steps are 9 s, step 7 14 s, then the
  // knot steps 15, 16, 12, 15, 16, 15 s: 18:06:45 is step 1, 18:07:15 step 4,
  // 18:07:55 knot step 1 (step 8), 18:08:35 knot step 4 (step 11).
  for (const [now, step] of [['18:06:45', '1'], ['18:07:15', '4'], ['18:07:55', '8'], ['18:08:35', '11']]) {
    await page.goto(at(`2026-09-30T${now}`));
    await expect(page.locator('[data-bracelet-step]')).toHaveAttribute('data-bracelet-step', step);
  }
});

test('the 10 s before a showing counts down on the wall', async ({ page }) => {
  await page.goto(at('2026-09-30T18:10:03'));
  await expect(page.locator('.pj-bracelet__corner')).toContainText(/BIG HOW-TO IN/i);
  await expect(page.locator('.pj-bracelet__corner')).toContainText('0:07');
});

test('the window\'s two-minute warning still shows', async ({ page }) => {
  await page.goto(at('2026-09-30T18:28:30'));
  await expect(page.locator('[data-warning="two-minute"]')).toContainText(/TWO MINUTES/);
});

test('the controls: B opens them, a held step stays up, the handout shows, Reset goes back', async ({ page }) => {
  await page.goto(at('2026-09-30T18:07:15'));
  await expect(page.locator('[data-bracelet-step]')).toHaveAttribute('data-bracelet-step', '4');
  await page.keyboard.press('b');
  const panel = page.getByRole('dialog', { name: 'Bracelet Time controls' });
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: 'K2' }).click();
  await expect(page.locator('[data-bracelet-phase]')).toHaveAttribute('data-bracelet-phase', 'hold');
  await expect(page.locator('[data-bracelet-step]')).toHaveAttribute('data-bracelet-step', '9');
  // Saved on this PC: a reload keeps it.
  await page.reload();
  await expect(page.locator('[data-bracelet-step]')).toHaveAttribute('data-bracelet-step', '9');
  await page.keyboard.press('b');
  await panel.getByRole('button', { name: 'Handout page 2' }).click();
  await expect(page.locator('[data-bracelet-phase]')).toHaveAttribute('data-bracelet-phase', 'handout2');
  await expect(page.getByRole('img', { name: /page 2/ })).toBeVisible();
  await panel.getByRole('button', { name: 'Full instructions' }).click();
  await expect(page.locator('[data-bracelet-phase]')).toHaveAttribute('data-bracelet-phase', 'overview');
  await panel.getByRole('button', { name: 'Reset' }).click();
  await expect(page.locator('[data-bracelet-phase]')).toHaveAttribute('data-bracelet-phase', 'steps');
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
});

test('animations off: still pictures and no epic', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('awanaBraceletSettings.v1', JSON.stringify({ still: true })));
  await page.goto(at('2026-09-30T18:05:40'));
  await expect(page.locator('[data-bracelet-phase]')).toHaveAttribute('data-bracelet-phase', 'steps');
});

test('QuickNav opens the controls too', async ({ page }) => {
  await page.goto(at('2026-09-30T18:07:15'));
  await page.locator('body').hover({ position: { x: 1900, y: 20 } });
  await page.getByRole('button', { name: /Bracelet Time controls/ }).click();
  await expect(page.getByRole('dialog', { name: 'Bracelet Time controls' })).toBeVisible();
});

test('on any other night B does nothing, and QuickNav has no Bracelet Time button', async ({ page }) => {
  await page.goto(at('2026-10-14T18:07:00'));
  await expect(page.locator('[data-mode]')).toHaveAttribute('data-mode', 'game-time');
  await page.keyboard.press('b');
  await expect(page.getByRole('dialog', { name: 'Bracelet Time controls' })).toHaveCount(0);
  await page.locator('body').hover({ position: { x: 1900, y: 20 } });
  await expect(page.getByRole('button', { name: /Bracelet Time controls/ })).toHaveCount(0);
});

test('the open panel owns the keyboard: focus starts inside it, and Escape never reaches the opening deck', async ({ page }) => {
  await page.goto(at('2026-09-30T18:02:00'));
  const mode = page.locator('[data-mode]');
  await expect(mode).toHaveAttribute('data-mode', 'slideshow');
  await page.keyboard.press('b');
  const panel = page.getByRole('dialog', { name: 'Bracelet Time controls' });
  await expect(panel).toBeVisible();
  expect(await panel.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  // Tab walks the panel's own controls, never the hidden QuickNav behind it.
  for (let i = 0; i < 30; i += 1) await page.keyboard.press('Tab');
  expect(await panel.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  // Arrow keys and Space do not move the deck behind it.
  const slide = page.locator('[data-slide]').first();
  const before = await slide.getAttribute('data-slide');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Space');
  await page.waitForTimeout(1200);
  expect(await slide.getAttribute('data-slide')).toBe(before);
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  await expect(page.locator('[data-pj-bottom-overlay]')).toHaveCount(0);
  await expect(mode).toHaveAttribute('data-mode', 'slideshow');
});

test('"Play it now" waits for Bracelet Time', async ({ page }) => {
  await page.goto(at('2026-09-30T18:02:00'));
  await expect(page.locator('[data-mode]')).toHaveAttribute('data-mode', 'slideshow');
  await page.keyboard.press('b');
  await expect(page.getByRole('dialog', { name: 'Bracelet Time controls' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play it now' })).toBeDisabled();
});


// The epic's caption (the step's title and its whole instruction, which can
// run to two lines) must end above the club waves along the bottom of a 16:9
// wall, with room to spare: at 1280x720 and 1920x1080 a two-line instruction
// once sat on the far wave's top edge. Measured against the waves' own boxes
// (a wave never draws above its box), once they have risen in and stopped.
for (const [w, h] of [[1280, 720], [1920, 1080], [1024, 768]]) {
  for (const [now, step] of [['18:06:00', 'knot step 2, the wraps'], ['18:05:45', 'step 7, the clear beads']]) {
    test(`the epic's caption clears the waves at ${w}x${h}: ${step}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto(at(`2026-09-30T${now}`));
      await expect(page.locator('[data-bracelet-phase]')).toHaveAttribute('data-bracelet-phase', 'epic');
      const caption = page.locator('.pj-bracelet__caption');
      await expect(caption.locator('.pj-bracelet__words')).toBeVisible();
      const waves = page.locator('[data-mode="game-time"] .pj-wave');
      await expect(waves).toHaveCount(2);
      // At rest: no wave still carrying its rise-in transform.
      await expect.poll(() => waves.evaluateAll((els) => els.every((el) => {
        const t = getComputedStyle(el).transform;
        return t === 'none' || new DOMMatrix(t).m42 === 0;
      })), { timeout: 5000 }).toBe(true);
      const { gap, lines } = await page.evaluate(() => {
        const words = document.querySelector('.pj-bracelet__caption .pj-bracelet__words');
        const bottom = document.querySelector('.pj-bracelet__caption').getBoundingClientRect().bottom;
        const top = Math.min(...[...document.querySelectorAll('[data-mode="game-time"] .pj-wave')].map((el) => el.getBoundingClientRect().top));
        return { gap: top - bottom, lines: Math.round(words.getBoundingClientRect().height / parseFloat(getComputedStyle(words).lineHeight)) };
      });
      expect(gap).toBeGreaterThanOrEqual(h * 0.015);
      // Both instructions run to two lines, and are there in full, not cut to fit.
      expect(lines).toBe(2);
      const words = await caption.locator('.pj-bracelet__words').textContent();
      if (now === '18:06:00') expect(words).toBe('Lay the bottom string along your pointer finger. Wrap the top string under and around it 3 times.');
      else expect(words).toBe('Add a clear bead on each side of your colors. Tie a knot next to each one.');
    });
  }
}
