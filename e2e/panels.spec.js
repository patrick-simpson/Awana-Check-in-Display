import { expect, test } from '@playwright/test';

// The operator panels (Settings, the slide editor) in the brand kit: the
// guarantees a stylesheet can quietly break without any unit test noticing,
// checked in a real browser. Keyboard focus must stay visible, and
// ?lowPower=1 must mean zero animation.

const NO_KEY = () => localStorage.setItem('awanaConfig.v1', JSON.stringify({ pusherAppKey: '' }));

async function boot(page, query = '') {
  await page.route(/open-meteo|pusher|twotimtwo/, (route) => route.abort());
  await page.addInitScript(NO_KEY);
  await page.goto(`/index.html${query}`);
  await expect(page.locator('.stage')).toBeVisible();
}

async function openSettingsTab(page, name) {
  await page.keyboard.press('Control+Shift+S');
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('tab', { name }).click();
  return dialog;
}

/** WCAG contrast ratio of two CSS rgb()/rgba() colours, in the page. */
const CONTRAST = `(a, b) => {
  const lum = (c) => {
    const [r, g, bl] = c.match(/[\\d.]+/g).slice(0, 3).map(Number).map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}`;

// After a move the editor sends focus to the moved card's index line when the
// arrow just pressed is now disabled. That line sits on the Awana-blue corner
// tab, so its ring must not be the panels' Awana-blue :focus-visible ring,
// which a KEYBOARD move matches.
test('a keyboard move leaves a visible focus ring on the slide index line', async ({ page }) => {
  await boot(page);
  await page.keyboard.press('Control+Shift+E');
  const editor = page.getByRole('dialog', { name: 'Typed slides' });
  await expect(editor).toBeVisible();
  for (let i = 0; i < 3; i += 1) await editor.getByRole('button', { name: '+ Add slide' }).click();

  for (const name of ['Move slide 3 to the top', 'Move slide 1 to the bottom']) {
    await editor.getByRole('button', { name }).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.slide-card-index:focus')).toHaveCount(1);
    const ring = await page.evaluate(`(() => {
      const contrast = ${CONTRAST};
      const el = document.activeElement;
      const cs = getComputedStyle(el);
      const fill = getComputedStyle(el.closest('.brand-tab').querySelector('path')).fill;
      return {
        focusVisible: el.matches(':focus-visible'),
        style: cs.outlineStyle,
        width: parseFloat(cs.outlineWidth),
        contrast: contrast(cs.outlineColor, fill),
      };
    })()`);
    expect(ring.focusVisible, name).toBe(true);
    expect(ring.style, name).toBe('solid');
    expect(ring.width, name).toBeGreaterThanOrEqual(2);
    expect(ring.contrast, name).toBeGreaterThanOrEqual(3);
  }
});

// ?lowPower=1 is ZERO animation (CLAUDE.md). The kit checkbox pops its check
// on a ::before, which a `.zero-animation-mode *` rule alone never reaches
// (`*` matches elements only, and transitions are not inherited).
test('under ?lowPower=1 no panel pseudo-element animates, and a checkbox ticks with no transition', async ({ page }) => {
  await boot(page, '?lowPower=1');
  await expect(page.locator('html.zero-animation-mode')).toHaveCount(1);
  const dialog = await openSettingsTab(page, 'Connection');

  for (const name of ['Connection', 'Background', 'Banners & celebrations', 'Display', 'Calendar & Weather']) {
    await dialog.getByRole('tab', { name }).click();
    const moving = await dialog.evaluate((root) => {
      const out = [];
      for (const el of [root, ...root.querySelectorAll('*')]) {
        for (const pseudo of ['::before', '::after']) {
          const cs = getComputedStyle(el, pseudo);
          if (cs.content === 'none' || cs.content === 'normal') continue;
          const timed = (list) => list.split(',').some((d) => parseFloat(d) > 0);
          if (timed(cs.transitionDuration) || cs.animationName !== 'none') {
            out.push(`${el.tagName.toLowerCase()}.${el.className}${pseudo} ${cs.transitionDuration} ${cs.animationName}`);
          }
        }
      }
      return out;
    });
    expect(moving, name).toEqual([]);
  }

  await dialog.getByRole('tab', { name: 'Display' }).click();
  const box = dialog.locator('input[type="checkbox"]:visible').first();
  await expect(box).toBeVisible();
  await box.click();
  const running = await page.evaluate(() => document.getAnimations()
    .filter((a) => a.effect && /** @type {KeyframeEffect} */ (a.effect).pseudoElement)
    .map((a) => `${/** @type {KeyframeEffect} */ (a.effect).pseudoElement} ${a.constructor.name}`));
  expect(running).toEqual([]);
});
