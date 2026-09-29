import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';

// THE LOBBY DIRECTOR (rebrand stage 4), wired end to end.
//
// The pieces each have their own tests (the queue's hold in checkInQueue,
// the pause and the slide reports in ManualSlideshow, the snapshots in
// cornerInfo). These are whole-App tests of the seams between them, which is
// where the headline behaviour lives: a slide that holds check-ins really
// does hold the line, names really do pause the deck, the corner really does
// step aside, and a waiting child really does keep the screen from reloading
// underneath them.
//
// Fake timers drive the slideshow and the queue; framer-motion runs its
// frames on the real clock (it captures requestAnimationFrame at import), so
// `settle()` waits a few real frames for an exit to finish. Zero-animation
// mode makes every exit a one-frame jump.

const realSetTimeout = globalThis.setTimeout;
const settle = () => act(() => new Promise((r) => realSetTimeout(r, 30)));
// Time passes in short steps with the frames in between, the way it does on
// a real screen: inside one long act() React holds every effect (so every
// timer an effect would start) until the act ends, which is not a clock any
// screen runs on.
async function tick(ms) {
  for (let left = ms; left > 0; left -= 250) {
    await act(async () => { await vi.advanceTimersByTimeAsync(Math.min(250, left)); });
    await settle();
  }
  if (ms === 0) await act(async () => { await vi.advanceTimersByTimeAsync(0); });
}

let bound = {};
vi.mock('pusher-js', () => ({
  default: class FakePusher {
    constructor() {
      this.connection = { state: 'connected', bind: () => {}, unbind: () => {} };
    }
    subscribe() { return { bind: (evt, fn) => { bound[evt] = fn; }, unbind_all: () => {} }; }
    unsubscribe() {}
    disconnect() {}
    connect() {}
  },
}));

// The self-update poller, captured rather than run: the test asks the same
// "may this screen reload right now?" question the poller would.
let reloadBusy = null;
vi.mock('./hooks/useBuildReload.js', () => ({
  useBuildReload: (isBusy) => { reloadBusy = isBusy; },
}));

const App = (await import('./App.jsx')).default;
const cfg = await import('./hooks/useConfig.js');

function todayKey(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const A = { id: 's_a', text: 'Slide A', durationSec: 5 };
const H = { id: 's_h', text: 'Held poster', durationSec: 10, holdCheckIns: true };
const B = { id: 's_b', text: 'Slide B', durationSec: 5 };

function configure(over = {}) {
  localStorage.setItem('awanaConfig.v1', JSON.stringify({
    pusherAppKey: 'k',
    pusherCluster: 'us2',
    confettiLevel: 'off',
    firstArrivalMoment: false,
    reduceMotion: true,
    backgroundSource: 'manual',
    calendarEnabled: false,
    seasonPromos: false,
    showWeatherChip: false,
    showClock: true,
    showTally: true,
    slideshowDelaySec: 5,
    standardDisplayMs: 6000,
    manualSlides: [A, H, B],
    ...over,
  }));
  cfg._resetForTest();
}

async function mount() {
  await act(async () => { render(<App />); });
  await tick(0);
  expect(bound.checkin).toBeTypeOf('function');
}

const onScreen = (text) => [...document.querySelectorAll('.manual-slide')].some((el) => el.textContent.includes(text));
const banner = () => document.querySelector('.checkin');
const waiting = () => document.querySelector('.corner-chip--waiting');
const cornerIds = () => [...document.querySelectorAll('.corner-chip')]
  .map((el) => [...el.classList].find((c) => /^corner-chip--(clock|tally|weather)$/.test(c)))
  .filter(Boolean)
  .map((c) => c.replace('corner-chip--', ''));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
  bound = {};
  reloadBusy = null;
  localStorage.clear();
  sessionStorage.clear();
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// Each test waits out ~30 ms of real frames per 250 ms of screen time, so a
// run of 20-odd screen seconds costs 2-4 s of wall clock on an idle machine:
// too close to vitest's 5 s default for a busy one. The budget is wall clock
// only; every assertion about screen time runs on the fake clock.
describe('the lobby director, end to end', { timeout: 20_000 }, () => {
  it('a held slide makes arrivals wait, then they play in full and pause the deck', async () => {
    configure();
    await mount();
    expect(onScreen('Slide A')).toBe(true);

    await tick(5000);
    await settle();
    expect(onScreen('Held poster')).toBe(true);

    await act(async () => { bound.checkin({ firstName: 'Ann', club: 'Sparks', id: 'a1', at: Date.now() }); });
    // Held: no name over the poster, but the room is told someone is coming.
    expect(banner()).toBeNull();
    expect(waiting()?.getAttribute('aria-label')).toBe('1 child waiting to be welcomed');
    // Six quiet seconds later (past BUILD_QUIET_MS) the stage is still empty,
    // but the line lives only in memory, so a waiting child is a busy screen.
    await tick(6000);
    expect(banner()).toBeNull();
    expect(reloadBusy()).toBe(true);

    // The poster ends: Ann plays at once, on the next slide.
    await tick(4000);
    await settle();
    expect(onScreen('Slide B')).toBe(true);
    expect(banner()).not.toBeNull();
    expect(waiting()).toBeNull();

    // Her name pauses the deck: well past Slide B's 5 seconds it is still up.
    await tick(5500);
    await settle();
    expect(banner()).not.toBeNull();
    expect(onScreen('Slide B')).toBe(true);
    expect(onScreen('Slide A')).toBe(false);

    // Her full 6 seconds, then the slide keeps the time it had (none).
    await tick(1000);
    await settle();
    expect(banner()).toBeNull();
    await tick(4000);
    await settle();
    expect(onScreen('Slide B')).toBe(true);
    await tick(1500);
    await settle();
    expect(onScreen('Slide A')).toBe(true);
  });

  it('the corner steps aside on a held slide without spending an item there', async () => {
    localStorage.setItem('awanaTally.v1', JSON.stringify({ date: todayKey(), count: 7 }));
    configure();
    await mount();
    await settle();
    expect(cornerIds()).toEqual(['clock']);

    await tick(5000);
    await settle();
    expect(onScreen('Held poster')).toBe(true);
    expect(cornerIds()).toEqual([]);

    // The first ordinary slide after the poster picks up where the corner
    // left off: the tally, which the poster's load would otherwise have eaten.
    await tick(10000);
    await settle();
    expect(onScreen('Slide B')).toBe(true);
    expect(cornerIds()).toEqual(['tally']);
  });

  it('a tally correction reaches the corner with the corrected number, once', async () => {
    localStorage.setItem('awanaTally.v1', JSON.stringify({ date: todayKey(), count: 80 }));
    configure({ manualSlides: [A, B] });
    await mount();
    await tick(5000);
    const tallyChip = () => document.querySelector('.corner-chip--tally');
    const value = () => tallyChip()?.querySelector('[role="img"]').getAttribute('aria-label');
    const note = () => tallyChip()?.querySelector('.corner-chip__note')?.textContent ?? null;
    expect(value()).toBe('TONIGHT 80');

    // An 80 → 78 correction lands while the tally is up. The chip is frozen
    // until the next load, so it must not explain a number it is not showing.
    await act(async () => { bound.tally({ counts: { Sparks: 78 }, total: 78, at: Date.now() }); });
    expect(value()).toBe('TONIGHT 80');
    expect(note()).toBeNull();

    // The next time the tally comes round (past any few-second timer), it
    // shows the corrected number, explained...
    await tick(10000);
    expect(value()).toBe('TONIGHT 78');
    expect(note()).toBe('synced with the check-in desk');

    // ...and the time after that it is an ordinary one.
    await tick(10000);
    expect(value()).toBe('TONIGHT 78');
    expect(note()).toBeNull();
  });

  it('an idle lobby with nobody waiting may reload', async () => {
    configure();
    await mount();
    await tick(4000);
    expect(reloadBusy()).toBe(false);
  });
});

// Inside the Journey kiosk's iframe, Journey keeps its own buttons in one
// column in this page's bottom-right corner (src/lib/embed.js). The layout
// half is CSS under html.embedded (embed.test.js pins it; e2e/embedded.spec.js
// measures it in Chromium); this pins what App decides, and that the
// top-right, which is ours, is decided exactly as it is standalone.
describe('embedded in the Journey kiosk\'s frame', { timeout: 20_000 }, () => {
  const framed = () => vi.stubGlobal('top', { name: 'the Journey kiosk' });
  const html = () => document.documentElement.classList.contains('embedded');

  it('marks <html> embedded only while framed, and never standalone', async () => {
    configure();
    await mount();
    expect(html()).toBe(false);
    cleanup();

    framed();
    bound = {};
    configure();
    await mount();
    expect(html()).toBe(true);
    cleanup();
    expect(html()).toBe(false);
  });

  // (jsdom has no ResizeObserver, so the sticker's measured height never
  // reads tall: this is the short-sticker case.)
  it.each([[false], [true]])('framed %s: with a short problem sticker up, the WAITING chip keeps the top slot', async (isFramed) => {
    if (isFramed) framed();
    configure({ showConnectionStatus: true });
    await mount();
    await tick(5000);
    await settle();
    expect(onScreen('Held poster')).toBe(true);
    expect(document.querySelector('.corner-stack .status-dot')).not.toBeNull();

    await act(async () => { bound.checkin({ firstName: 'Ann', club: 'Sparks', id: 'e1', at: Date.now() }); });
    expect(waiting()?.closest('.corner-top')).not.toBeNull();
  });
});
