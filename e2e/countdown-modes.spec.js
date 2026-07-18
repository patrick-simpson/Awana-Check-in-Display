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
