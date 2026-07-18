import { expect, test } from '@playwright/test';

// The signage page must boot cleanly with no Pusher key (socket status
// 'off' by design) and no network beyond its own origin. Cross-origin
// fetches (weather, calendar scrape) are aborted so the test is
// hermetic — the app is built to treat those as ordinary offline.
test('signage stage boots with no errors and no external network', async ({ page }) => {
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));
  page.on('console', (msg) => {
    // Resource-load failures for the fetches we deliberately abort are
    // browser noise, not app errors.
    if (msg.type() === 'error' && !/net::ERR_FAILED|Failed to load resource/.test(msg.text())) {
      consoleErrors.push(msg.text());
    }
  });
  await page.route(/open-meteo|pusher|twotimtwo/, (route) => route.abort());

  await page.goto('/index.html');
  await expect(page.locator('.stage')).toBeVisible();
  // The placeholder background ("screen is never blank") should render
  // since no PowerPoint embed URL is configured.
  await page.waitForTimeout(1500);

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test('overlay mode renders a transparent stage', async ({ page }) => {
  await page.route(/open-meteo|pusher|twotimtwo/, (route) => route.abort());
  await page.goto('/index.html?overlay=1');
  await expect(page.locator('.stage.overlay')).toBeVisible();
});
