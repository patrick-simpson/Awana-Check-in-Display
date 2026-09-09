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

  // #351 — an 80 → 78 correction is a two-step move, so the counter says
  // where it came from. Without this the room reads a counter that drops as
  // a broken screen.
  await expect(page.locator('.tally .tally-sync-note')).toHaveText(/synced with the check-in desk/i);
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

test('a birthday later this week rides a ribbon instead of claiming today', async ({ page }) => {
  // The weekly `birthdays` roster now reaches the signage page too. Both
  // simulators name the same fixed child/club pair on purpose — the ribbon
  // only fires on a unique name+club match, so a random pick could never
  // drive this path.
  await goSignage(page);
  await openDebug(page);

  await page.getByRole('button', { name: /Seed birthday-week roster/ }).click();
  await page.getByRole('button', { name: /Welcome the birthday-week kid/ }).click();

  const banner = page.locator('.banner').first();
  await expect(banner).toBeVisible();
  await expect(banner.locator('.birthday-week-ribbon')).toContainText(/Birthday this \w+!/);

  // Let the queue drain, as the other multi-banner tests here do.
  await page.waitForTimeout(6000);

  await page.getByRole('button', { name: /Birthday banner for that kid/ }).click();
  const cake = page.locator('.banner.birthday');
  await expect(cake.locator('.birthday-week-ribbon')).toContainText(/Birthday this \w+!/);
  // "It's your special day" is simply wrong three days early.
  await expect(cake).not.toContainText(/special day/i);
});

test('books finished tonight get their own toast, one at a time', async ({ page }) => {
  await goSignage(page);
  await openDebug(page);

  // #358 — the tonight simulator ramps books by 4 a press. The first payload
  // is only a baseline (a screen booting at 8pm must not replay the evening),
  // so it takes two presses to cross the default 5-book threshold.
  const tonight = page.getByRole('button', { name: 'Show tonight ticker' });
  await tonight.click();
  await tonight.click();

  // That second press also crosses the 100-kid night threshold, which is
  // exactly the pile-up useCelebrationQueue exists for: whatever is showing,
  // there is never more than ONE toast on screen.
  await expect(page.locator('.milestone-toast')).toHaveCount(1);

  // The handbook toast gets its own copy and its green handbook edge — it may
  // be queued behind the night milestone's hold, hence the longer wait.
  const books = page.locator('.milestone-toast.handbook-milestone');
  await expect(books).toBeVisible({ timeout: 20000 });
  await expect(books).toContainText(/Handbooks/i);
  await expect(books).toContainText(/5 books finished tonight!/i);
  await expect(page.locator('.milestone-toast')).toHaveCount(1);
});

test('a club milestone toast wears that club’s wordmark', async ({ page }) => {
  await goSignage(page);
  await openDebug(page);

  // The first tally of the night is only a baseline, so it takes two presses
  // to produce a crossing: 9 / 16 / 23 / 30, then +10 per club. With the
  // default clubMilestoneEvery of 10 several clubs cross at once and the
  // queue plays their toasts one at a time.
  const tally = page.getByRole('button', { name: 'Simulate club tally (counts)' });
  await tally.click();
  await tally.click();

  const toast = page.locator('.milestone-toast.club-milestone');
  await expect(toast).toBeVisible();
  // The badge is the club's own wordmark art, sized by the toast-scoped CSS.
  const logo = toast.locator('.club-logo');
  await expect(logo).toBeVisible();
  const box = await logo.boundingBox();
  expect(box.width).toBeGreaterThan(0);
  // Whatever the art's intrinsic size, it must stay inside the pill.
  const toastBox = await toast.boundingBox();
  expect(box.width).toBeLessThan(toastBox.width);
  // The mascot sticker is banner-scale art and is deliberately hidden here.
  await expect(toast.locator('.club-mascot')).toBeHidden();
});

test('the night’s first check-in raises the doors-are-open flourish, exactly once', async ({ page }) => {
  // #335 is phase-gated, and resolvePhase reads the real wall clock — a CI run
  // on a Wednesday evening would otherwise resolve 'game-time' and see no
  // flourish at all. So pin the phase hermetically: blank the shared-schedule
  // URL (so nothing is fetched) and seed the cache with today marked no-club,
  // which resolvePhase turns into 'off' at any hour on any day.
  await page.addInitScript(() => {
    const pad = (n) => String(n).padStart(2, '0');
    const d = new Date();
    const today = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    localStorage.setItem('awanaConfig.v1', JSON.stringify({ sharedScheduleUrl: '' }));
    localStorage.setItem('awanaSchedule.v1', JSON.stringify({
      fetchedAt: d.toISOString(),
      raw: {
        meeting: { day: d.getDay() },
        windows: [{ start: '18:00', end: '19:30', kind: 'game' }],
        specialDates: { [today]: { noClub: true } },
      },
    }));
  });
  await goSignage(page);
  await openDebug(page);

  await page.getByRole('button', { name: 'Standard welcome' }).click();

  const flourish = page.locator('.milestone-toast.first-milestone');
  await expect(flourish).toBeVisible();
  await expect(flourish).toContainText(/Doors are open/i);
  await expect(flourish).toContainText(/is first in tonight!/i);
  // Only a first name reaches it — the same name the banner itself shows.
  await expect(flourish).toContainText(FAKE_NAME);

  // It retires after MILESTONE_TOAST_MS, and the SECOND child of the night
  // gets a banner and no flourish: the whole point is that it happens once.
  await expect(flourish).toHaveCount(0, { timeout: 15000 });
  await page.getByRole('button', { name: 'Standard welcome' }).click();
  await expect(page.locator('.banner').first()).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(page.locator('.milestone-toast.first-milestone')).toHaveCount(0);
});
