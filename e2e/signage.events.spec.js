import { expect, test } from '@playwright/test';

// End-to-end coverage of the signage page's EVENT rendering.
//
// Until demo mode existed there was no way to get an event into this page from
// a test: the only seam was the live Pusher socket, which index-smoke.spec.js
// deliberately aborts to stay hermetic. So the signage app — the thing families
// actually look at — had exactly two e2e assertions: it boots, and overlay mode
// works. Nothing checked that a check-in produces a banner.
//
// The debug panel's simulators now route through the same sanitizers as real
// wire traffic (see src/hooks/useSocket.js simulateEvent), so driving them here
// exercises the real path: sanitize → handler → queue → render. A payload the
// wire could not deliver is dropped, which means these tests also fail if a
// simulator's shape drifts from the contract.
//
// Deliberately in the `smoke` project but wired into ci.yml only, NOT
// deploy.yml — same reasoning the visual tests carry: a multi-step
// timing-sensitive test must never stand between someone and a live fix at
// 5:55pm on a club night.

/** Abort every cross-origin fetch so the run is hermetic and offline-safe. */
async function goSignage(page, query = '') {
  await page.route(/open-meteo|pusher|twotimtwo/, (route) => route.abort());
  await page.goto(`/index.html${query}`);
  await expect(page.locator('.stage')).toBeVisible();
}

/** Open the debug panel (Ctrl+Shift+D) and wait for it. */
async function openDebug(page) {
  await page.keyboard.press('Control+Shift+D');
  await expect(page.locator('.debug')).toBeVisible();
}

// Names the simulators draw from — asserted rather than assumed, because the
// whole point of that list is that nothing on screen during a demo can be
// mistaken for a real child.
const FAKE_NAME = /TEST KID|DEMO KID|SAMPLE STAR|PRETEND PAL|PRACTICE RUN/i;

test('a simulated check-in renders a welcome banner', async ({ page }) => {
  await goSignage(page);
  await openDebug(page);

  await expect(page.locator('.demo-pill')).toHaveCount(0);

  await page.getByRole('button', { name: 'Standard welcome' }).click();

  const banner = page.locator('.banner').first();
  await expect(banner).toBeVisible();
  await expect(banner).toContainText(FAKE_NAME);
});

test('firing a simulator raises the demo badge and it stays up', async ({ page }) => {
  await goSignage(page);
  await openDebug(page);
  await page.getByRole('button', { name: 'Standard welcome' }).click();

  const badge = page.locator('.demo-pill');
  await expect(badge).toBeVisible();
  await expect(badge).toContainText(/not real check-ins/i);

  // A training badge that expires would fail at exactly the wrong moment, so
  // it must survive the banner it was raised by.
  await page.waitForTimeout(2000);
  await expect(badge).toBeVisible();
});

test('birthday and first-timer check-ins render their own banner modes', async ({ page }) => {
  await goSignage(page);
  await openDebug(page);

  await page.getByRole('button', { name: 'Birthday welcome' }).click();
  await expect(page.locator('.banner.birthday')).toBeVisible();
  // The birthday banner's art is hand-drawn SVG on purpose — no emoji.
  await expect(page.locator('.banner.birthday .cake svg').first()).toBeVisible();

  // Let the queue drain before asking for the next mode, so we're asserting on
  // the new banner rather than the previous one.
  await page.waitForTimeout(6000);

  await page.getByRole('button', { name: 'First-timer welcome' }).click();
  await expect(page.locator('.banner')).toBeVisible();
});

test('a notice event renders the announcement banner verbatim', async ({ page }) => {
  await goSignage(page);
  await openDebug(page);

  await page.getByRole('button', { name: 'Show cancellation alert' }).click();
  // `message` is the only free-text field on the channel; it is church-authored
  // and shown as-is, so this asserts the real copy reaches the screen.
  await expect(page.getByText(/CLUB CANCELLED TONIGHT/i)).toBeVisible();
  // The simulated bar holds for hours like a real one; the Debug panel can take it down.
  await page.getByRole('button', { name: 'Clear notice banner' }).click();
  await expect(page.getByText(/CLUB CANCELLED TONIGHT/i)).toHaveCount(0);
});

test('a tonight event renders the ticker counters', async ({ page }) => {
  await goSignage(page);
  await openDebug(page);

  await page.getByRole('button', { name: 'Show tonight ticker' }).click();
  // The simulator sends checkedIn: 63 — a number that cannot appear by accident.
  await expect(page.getByText(/63/).first()).toBeVisible();
});

test('a 20-kid rush queues rather than dropping banners', async ({ page }) => {
  await goSignage(page);
  await openDebug(page);

  // Burst mode is the behaviour that matters most on a real club night: five
  // families arriving at once must each still get their moment.
  await page.getByRole('button', { name: /20-kid rush/ }).click();

  await expect(page.locator('.banner').first()).toBeVisible();
  // The panel reports queue depth; a rush must actually enqueue.
  await expect(page.locator('.debug-stats')).toContainText(/queued: [1-9]/);
});

test('a tally broadcast reconciles the corner counter, including counting DOWN', async ({ page }) => {
  // Force sticker mode so the corner counter renders immediately instead of
  // waiting its turn in DataCycle's rotation.
  await page.addInitScript(() => {
    localStorage.setItem('awanaConfig.v1', JSON.stringify({ widgetDisplayMode: 'stickers' }));
  });
  await goSignage(page);
  await openDebug(page);

  // Climb well past the tally simulator's fixed total (9+16+23+30 = 78, see
  // DebugPanel.jsx) so the reconciliation below has to count DOWN — the
  // undo case a real operator hits when they void a mis-scanned check-in.
  const rush = page.getByRole('button', { name: /20-kid rush/ });
  await rush.click();
  await rush.click();
  await rush.click();
  await rush.click();

  const tallyCount = page.locator('.tally .tally-count');
  await expect(tallyCount).toHaveText('80');

  await page.getByRole('button', { name: 'Simulate club tally (counts)' }).click();
  await expect(tallyCount).toHaveText('78');
});

test('simulated events do not raise page errors', async ({ page }) => {
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !/net::ERR_FAILED|Failed to load resource/.test(msg.text())) {
      consoleErrors.push(msg.text());
    }
  });

  await goSignage(page);
  await openDebug(page);

  for (const name of [
    'Standard welcome',
    'Birthday welcome',
    'First-timer welcome',
    'Simulate recap replay (quiet banners)',
    'Simulate print failure (ops)',
    'Simulate club tally (counts)',
    'Show tonight ticker',
    'Show info notice',
  ]) {
    await page.getByRole('button', { name }).click();
    await page.waitForTimeout(150);
  }

  await page.waitForTimeout(1500);
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

// NOTE: the "a malformed payload is rejected rather than rendered" property —
// the thing that makes the debug panel a live contract check — is covered by
// src/hooks/simulateEvent.test.js, which can call the seam directly. It is
// deliberately NOT duplicated here: these specs run against the built bundle,
// where a raw module import doesn't resolve, and a permanently-skipped test
// reads as coverage that doesn't exist.
