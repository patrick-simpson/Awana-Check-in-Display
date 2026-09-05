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

// Slide sync, end to end from the cache: a screen that received a published
// deck renders THAT deck after a reboot — no network, no local slides. This
// is the boot path every display takes at 5pm on club night.
test('a cached synced deck renders in place of local slides', async ({ page }) => {
  await page.route(/open-meteo|pusher|twotimtwo/, (route) => route.abort());
  await page.addInitScript(() => {
    localStorage.setItem('awanaConfig.v1', JSON.stringify({ backgroundSource: 'manual' }));
    localStorage.setItem('awanaSyncedSlides.v1', JSON.stringify({
      deckRev: 7,
      publishedAt: 1789939800000,
      slides: [{
        id: 's_sync', eyebrow: 'Awana Clubs', text: 'Synced from the check-in desk',
        theme: 'sky', textSize: 'auto', durationSec: 0,
      }],
    }));
  });
  await page.goto('/index.html');
  await expect(page.locator('.manual-slide-text')).toHaveText('Synced from the check-in desk');
});

// The published deck is the DEFAULT background: a freshly logged-in screen
// with NO background setting saved shows the deck the check-in machine
// published, not the welcome placeholder.
test('a published deck shows on a screen with no background setting saved', async ({ page }) => {
  await page.route(/open-meteo|pusher|twotimtwo/, (route) => route.abort());
  await page.addInitScript(() => {
    localStorage.setItem('awanaSyncedSlides.v1', JSON.stringify({
      deckRev: 8,
      publishedAt: 1789939800000,
      slides: [{
        id: 's_sync', eyebrow: 'Awana Clubs', text: 'Published with nothing else set',
        theme: 'sky', textSize: 'auto', durationSec: 0,
      }],
    }));
  });
  await page.goto('/index.html');
  await expect(page.locator('.manual-slide-text')).toHaveText('Published with nothing else set');
});

// ?key= must reach the socket (an OBS/ProPresenter embed has no localStorage).
// Pusher itself is aborted, so the dot leaves "not set up" for connecting or
// disconnected — either proves the flag reached `new Pusher(...)`.
test('the ?key= URL flag reaches the socket', async ({ page }) => {
  await page.route(/open-meteo|pusher|twotimtwo/, (route) => route.abort());
  await page.addInitScript(() => {
    localStorage.setItem('awanaConfig.v1', JSON.stringify({ showConnectionStatus: true }));
  });
  await page.goto('/index.html');
  await expect(page.locator('.status-dot')).toContainText('not set up');
  await page.goto('/index.html?key=abc123&cluster=us2');
  await expect(page.locator('.status-dot')).not.toContainText('not set up');
});

// Saving the Pusher key in Settings connects the socket in the SAME tab —
// no reload. This is the first thing a volunteer does on a new screen.
test('saving the Pusher key in Settings connects without a reload', async ({ page }) => {
  await page.route(/open-meteo|pusher|twotimtwo/, (route) => route.abort());
  await page.goto('/index.html');
  await expect(page.locator('.status-dot')).toContainText('not set up');
  await page.keyboard.press('Control+Shift+S');
  // With no key the Advanced fold is already open.
  await page.getByLabel('Pusher App Key').fill('abc123');
  await page.getByLabel('Pusher Cluster').fill('us2');
  await page.locator('jelly-button:has-text("Save")').click();
  await expect(page.locator('.status-dot')).not.toContainText('not set up');
});
