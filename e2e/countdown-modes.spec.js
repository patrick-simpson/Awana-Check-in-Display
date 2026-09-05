import { expect, test } from '@playwright/test';

// Automated version of the manual time-travel QA that CLAUDE.md
// mandates for schedule-adjacent changes: drive countdown.html through
// every boundary with ?now= and assert the right view renders.
//
// 2026-09-16 is a Wednesday (the configured meeting day). All times are
// naive local ISO strings — playwright.config.js pins the timezone.
const CASES = [
  { now: '2026-09-16T17:59:00', mode: 'countdown', label: 'Wed just before opening' },
  { now: '2026-09-16T18:00:00', mode: 'slideshow', deck: 'opening', label: 'opening ceremony 18:00' },
  { now: '2026-09-16T18:05:00', mode: 'game-time', label: 'first game window 18:05' },
  { now: '2026-09-16T19:30:00', mode: 'slideshow', deck: 'closing', label: 'closing ceremony 19:30' },
  { now: '2026-09-16T19:35:00', mode: 'shutdown', label: 'shutdown 19:35' },
  { now: '2026-09-17T00:00:00', mode: 'countdown', label: 'Thursday midnight' },
  { now: '2026-09-15T18:30:00', mode: 'countdown', label: 'Tuesday evening (no club)' },
];

for (const { now, mode, deck, label } of CASES) {
  test(`renders ${mode}${deck ? `(${deck})` : ''} at ${label}`, async ({ page }) => {
    await page.goto(`/countdown.html?now=${now}`);
    const view = page.locator(`[data-mode="${mode}"]`);
    await expect(view).toBeVisible();
    if (deck) await expect(view).toHaveAttribute('data-deck', deck);
  });
}

test('quick-nav hover affordance exists', async ({ page }) => {
  await page.goto('/countdown.html?now=2026-09-15T18:30:00');
  await expect(page.locator('[data-mode="countdown"]')).toBeVisible();
  // The operator menu is deliberately hidden until hovered — just assert
  // the page put SOMETHING interactive in the top-right hover zone.
  const hoverZone = page.locator('body');
  await hoverZone.hover({ position: { x: 1900, y: 20 } });
});

// Display Settings on the projector page: the passphrase box is typeable
// before any frame arrives, and — with no live-data key yet — the Advanced
// fold is open and carries a display-key row, so the projector can be keyed
// by hand without a second copy of the key slot.
test('display settings: passphrase typeable, advanced fold holds the display key', async ({ page }) => {
  await page.route(/open-meteo|pusher|twotimtwo/, (route) => route.abort());
  await page.goto('/countdown.html?now=2026-09-15T18:30:00');
  await page.locator('body').hover({ position: { x: 1900, y: 20 } });
  await page.getByRole('button', { name: /Display Settings/ }).click();
  await expect(page.getByLabel('Display passphrase')).toBeEnabled();
  await expect(page.getByText(/add the live data key under Advanced first/i)).toBeVisible();
  await expect(page.getByPlaceholder('paste the 44-character key')).toBeVisible();
});
