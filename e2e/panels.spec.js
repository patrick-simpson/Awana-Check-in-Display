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

// The soft squish (app.css, "The soft squish: operator presses"): a press
// squashes a control on the individual `scale` and springs it back on release.
// Held with the mouse and released OFF the button, on the panel's own header
// (the click then lands on the dialog, which keeps it from the backdrop, so
// nothing closes), then read from the computed style.
/** Press and hold Settings' Cancel; returns what it reads while held, and a way to let go. */
async function holdCancel(page) {
  const dialog = await openSettingsTab(page, 'Connection');
  // Let the panel's own entrance finish first, so the button holds still.
  await expect.poll(() => dialog.evaluate((el) => el.getAnimations().filter((a) => a.playState === 'running').length), { timeout: 3000 }).toBe(0);
  const cancel = dialog.locator('.actions button', { hasText: /^cancel$/i });
  const box = await cancel.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(250);
  const held = await cancel.evaluate((el) => ({ scale: getComputedStyle(el).scale, translate: getComputedStyle(el).translate }));
  const panel = await dialog.boundingBox();
  return {
    cancel,
    held,
    release: async () => {
      await page.mouse.move(panel.x + 12, panel.y + 12);
      await page.mouse.up();
    },
  };
}

test('a panel button squishes onto its ledge while pressed and springs back to rest', async ({ page }) => {
  await boot(page);
  const { cancel, held, release } = await holdCancel(page);
  const [x, y] = held.scale.split(' ').map(Number);
  expect(x).toBeCloseTo(1.04, 2);
  expect(y).toBeCloseTo(0.92, 2);
  expect(held.translate).toBe('0px 2px');
  await release();
  // The release rides a CSS transition on `scale` (the spring), then rests.
  const springing = await cancel.evaluate((el) => el.getAnimations().map((a) => a.transitionProperty));
  expect(springing).toContain('scale');
  await expect.poll(() => cancel.evaluate((el) => getComputedStyle(el).scale), { timeout: 2000 }).toBe('none');
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
});

// The squash pulls a pressed control's top edge down 4-6px. A press that began
// in that band and is held past the 100 ms squash must still come up ON the
// control: otherwise the click goes to the common ancestor and nothing
// happens (holdCancel above releases off the button on purpose; this is the
// in-place case). An invisible strip under :active keeps the hit area whole.
for (const inside of [1, 3, 5, 8]) {
  test(`a press ${inside}px inside a button's top edge, held past the squash, still clicks it`, async ({ page }) => {
    await boot(page);
    const dialog = await openSettingsTab(page, 'Connection');
    await expect.poll(() => dialog.evaluate((el) => el.getAnimations().filter((a) => a.playState === 'running').length), { timeout: 3000 }).toBe(0);
    await page.evaluate(() => {
      window.__clickTargets = [];
      window.addEventListener('click', (e) => window.__clickTargets.push(e.target.closest('button')?.textContent ?? `ancestor:${e.target.className}`), true);
    });
    const cancel = dialog.locator('.actions button', { hasText: /^cancel$/i });
    const box = await cancel.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + inside);
    await page.mouse.down();
    await page.waitForTimeout(250);
    // It really has shrunk out from under the pointer, so only the strip holds the press.
    const held = await cancel.evaluate((el) => ({ top: el.getBoundingClientRect().top, scale: getComputedStyle(el).scale }));
    expect(held.scale).not.toBe('none');
    expect(held.top).toBeGreaterThan(box.y + 3);
    await page.mouse.up();
    expect(await page.evaluate(() => window.__clickTargets)).toEqual(['Cancel']);
    await expect(dialog).toBeHidden();
  });
}

test('the hit-area strip exists only while a squashed press is held, and never under ?lowPower=1', async ({ page }) => {
  await boot(page, '?lowPower=1');
  const dialog = await openSettingsTab(page, 'Connection');
  const cancel = dialog.locator('.actions button', { hasText: /^cancel$/i });
  const box = await cancel.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(150);
  expect(await cancel.evaluate((el) => getComputedStyle(el, '::after').content)).toBe('none');
  await page.mouse.move(box.x + box.width / 2, box.y + 1);
  await page.mouse.up();
});

test('under ?lowPower=1 a press is the flat, instant 2px sink, and nothing on the panels animates', async ({ page }) => {
  await boot(page, '?lowPower=1');
  const { held, release } = await holdCancel(page);
  expect(held).toEqual({ scale: 'none', translate: '0px 2px' });
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  await release();
  // Save is the kit's plain primary button here, not Jelly UI's canvas one.
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await expect(dialog.locator('jelly-button')).toHaveCount(0);
  await expect(dialog.locator('.actions button.primary', { hasText: /^save$/i })).toBeVisible();
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
});

test.describe('with the OS set to reduce motion', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } });

  test('a press is the flat 2px sink, with no squash and no spring', async ({ page }) => {
    await boot(page);
    expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
    const { held, release } = await holdCancel(page);
    expect(held).toEqual({ scale: 'none', translate: '0px 2px' });
    await release();
    const panelMoving = await page.getByRole('dialog', { name: 'Settings' }).evaluate((root) => [root, ...root.querySelectorAll('*')]
      .flatMap((el) => el.getAnimations()).length);
    expect(panelMoving).toBe(0);
  });
});
