// Awana Lobby Display: the lobby signage, packaged for the sound room PC.
//
// A tray app that starts with Windows. On club nights (shared/schedule.json
// plus the site's calendar feed, see src/clubNight.js) it puts the LIVE
// signage page full screen on the monitor someone picked once, from 5:00 pm
// to exactly 8:00 pm, and takes it down again. The tray can show it by hand
// (for three hours), hide it until the next club night, pick the monitor, and
// resume the schedule. Everything about WHEN lives in the pure modules under
// src/; this file only wires them to Electron.

import { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, net, powerMonitor, powerSaveBlocker, screen, shell } from 'electron';
import updaterPkg from 'electron-updater';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLOSE_AT_MIN, OPEN_AT_MIN, displayWindow, nextClubNight } from './src/clubNight.js';
import { NO_OVERRIDES, decideVisibility, hide, showNow, tidy } from './src/visibility.js';
import { findDisplay, rememberDisplay } from './src/displays.js';

const { autoUpdater } = updaterPkg;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_NAME = 'Awana Lobby Display';

// The live site. Development runs may point at a local preview instead
// (AWANA_LOBBY_SITE), fake the clock (AWANA_LOBBY_NOW, an ISO time that then
// runs on) and use a scratch profile (AWANA_LOBBY_USERDATA); a packaged
// install ignores all three.
const DEV = !app.isPackaged;
const SITE = (DEV && process.env.AWANA_LOBBY_SITE) || 'https://patrick-simpson.github.io/Awana-Check-in-Display/';
const PAGE_URL = new URL('index.html', SITE).href;
const SCHEDULE_URL = new URL('shared/schedule.json', SITE).href;
const FEED_URL = new URL('calendar-feed.json', SITE).href;
const SITE_ORIGIN = new URL(SITE).origin;
const CLOCK_OFFSET = (() => {
  const fake = DEV && process.env.AWANA_LOBBY_NOW ? Date.parse(process.env.AWANA_LOBBY_NOW) : NaN;
  return Number.isFinite(fake) ? fake - Date.now() : 0;
})();
const now = () => new Date(Date.now() + CLOCK_OFFSET);
// The release pipeline's install check (build-desktop.yml): open the lobby at
// once whatever the clock says, write what loaded to smoke.json in userData,
// and touch nothing else (no login item, no saved overrides, no updates).
const SMOKE = process.argv.includes('--smoke-test');
// ...and keep their state apart from a real install's.
if (DEV && process.env.AWANA_LOBBY_USERDATA) app.setPath('userData', process.env.AWANA_LOBBY_USERDATA);

const SOURCES_EVERY_MS = 60 * 60 * 1000; // re-read the schedule and feed hourly
const UPDATE_EVERY_MS = 4 * 60 * 60 * 1000;
const RETRY_LOAD_MS = 30 * 1000;
const CURSOR_IDLE_MS = 3000;

/* ── Files in userData ─────────────────────────────────────────────── */

const userDir = () => app.getPath('userData');
const statePath = () => path.join(userDir(), 'state.json');
const sourcesPath = () => path.join(userDir(), 'sources.json');
const logPath = () => path.join(userDir(), 'lobby-display.log');

function log(...parts) {
  const line = `${new Date().toISOString()} ${parts.map((p) => (p instanceof Error ? p.stack || p.message : typeof p === 'string' ? p : JSON.stringify(p))).join(' ')}\n`;
  try {
    const file = logPath();
    if (fs.existsSync(file) && fs.statSync(file).size > 1024 * 1024) fs.renameSync(file, `${file}.1`);
    fs.appendFileSync(file, line);
  } catch { /* logging never breaks the display */ }
  if (DEV) process.stdout.write(line);
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

/** Written to a temp file and renamed, so a power cut never leaves half a file. */
function writeJson(file, value) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
    fs.renameSync(tmp, file);
  } catch (err) { log('write failed', file, err); }
}

/** @type {{ display: import('./src/displays.js').SavedDisplay | null, overrides: import('./src/visibility.js').Overrides, autostartSet?: boolean, quietRelaunch?: boolean }} */
let state = { display: null, overrides: NO_OVERRIDES };
const saveState = () => writeJson(statePath(), state);

/** @type {{ schedule: any, feed: any, fetchedAt: number }} */
let sources = { schedule: null, feed: null, fetchedAt: 0 };

/* ── The schedule and the feed ─────────────────────────────────────── */

async function fetchJson(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await net.fetch(`${url}?t=${Date.now()}`, { signal: ctrl.signal, cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Keeps the last good copy of each file on disk: a church whose internet is
 * down at 5 pm still opens on the right night. A file that fails to load or
 * does not look like itself keeps the copy we had.
 */
async function refreshSources() {
  const [schedule, feed] = await Promise.allSettled([fetchJson(SCHEDULE_URL), fetchJson(FEED_URL)]);
  let changed = false;
  if (schedule.status === 'fulfilled' && schedule.value && typeof schedule.value === 'object' && schedule.value.meeting) {
    sources.schedule = schedule.value;
    changed = true;
  } else if (schedule.status === 'rejected') log('schedule fetch failed', String(schedule.reason));
  if (feed.status === 'fulfilled' && feed.value && Array.isArray(feed.value.events)) {
    sources.feed = feed.value;
    changed = true;
  } else if (feed.status === 'rejected') log('feed fetch failed', String(feed.reason));
  if (changed) {
    sources.fetchedAt = Date.now();
    writeJson(sourcesPath(), sources);
  }
  evaluate();
}

/* ── The lobby window ──────────────────────────────────────────────── */

/** @type {BrowserWindow | null} */
let lobby = null;
let blocker = -1;
let retryTimer = null;
let closingByApp = false;
let placedAs = null; // 'fullscreen' | 'windowed'

/**
 * Where the lobby goes: the remembered monitor, full screen. With nothing
 * remembered and only one monitor, that one. Otherwise (the TV is off or
 * unplugged, or nobody has picked yet) a normal window on the main screen,
 * so someone notices; it moves to the TV the moment Windows sees it.
 */
function target() {
  const displays = screen.getAllDisplays();
  const saved = findDisplay(displays, state.display);
  if (saved) return { display: saved, fullscreen: true };
  if (!state.display && displays.length === 1) return { display: displays[0], fullscreen: true };
  return { display: screen.getPrimaryDisplay(), fullscreen: false };
}

function place() {
  if (!lobby || lobby.isDestroyed()) return;
  const { display, fullscreen } = target();
  const wa = display.workArea;
  if (fullscreen) {
    const b = display.bounds;
    const current = lobby.getBounds();
    const onIt = lobby.isFullScreen() && current.x === b.x && current.y === b.y && current.width === b.width && current.height === b.height;
    if (!onIt) {
      if (lobby.isFullScreen()) lobby.setFullScreen(false);
      lobby.setBounds(b);
      lobby.setFullScreen(true);
    }
    lobby.setTitle(APP_NAME);
    placedAs = 'fullscreen';
  } else {
    if (placedAs !== 'windowed') {
      if (lobby.isFullScreen()) lobby.setFullScreen(false);
      const width = Math.min(1280, Math.round(wa.width * 0.8));
      const height = Math.round(width * 9 / 16);
      lobby.setBounds({ x: wa.x + Math.round((wa.width - width) / 2), y: wa.y + Math.round((wa.height - height) / 2), width, height });
    }
    lobby.setTitle(state.display
      ? `${APP_NAME}: the lobby TV is not connected (it will move there when it is)`
      : `${APP_NAME}: choose the lobby TV from the tray icon`);
    placedAs = 'windowed';
  }
  if (!lobby.isVisible()) lobby.show();
  updateTray();
}

const CURSOR_CSS = 'html.lobby-cursor-idle, html.lobby-cursor-idle * { cursor: none !important; }';
// The mouse lives in the booth: it hides itself over the lobby TV after a
// few seconds of stillness, and comes back the moment it moves.
const CURSOR_JS = `(() => {
  if (window.__lobbyCursor) return; window.__lobbyCursor = true;
  const root = document.documentElement; let t = 0;
  const wake = () => { root.classList.remove('lobby-cursor-idle'); clearTimeout(t); t = setTimeout(() => root.classList.add('lobby-cursor-idle'), ${CURSOR_IDLE_MS}); };
  addEventListener('mousemove', wake, true); addEventListener('mousedown', wake, true); wake();
})();`;

function isSitePage(url) {
  try { return new URL(url).origin === SITE_ORIGIN; } catch { return false; }
}

function openLobby() {
  if (lobby && !lobby.isDestroyed()) { place(); return; }
  placedAs = null;
  lobby = new BrowserWindow({
    show: false,
    title: APP_NAME,
    icon: path.join(HERE, 'build', 'icon.png'),
    backgroundColor: '#B3D0E7',
    autoHideMenuBar: true,
    webPreferences: {
      // One persistent profile: the page's own settings (display login,
      // Pusher, slides) and its offline cache survive every restart.
      partition: 'persist:lobby',
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      autoplayPolicy: 'no-user-gesture-required',
      spellcheck: false,
    },
  });
  const wc = lobby.webContents;
  wc.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  wc.on('will-navigate', (event, url) => {
    if (isSitePage(url) || url.startsWith('file:')) return;
    event.preventDefault();
    if (/^https?:/i.test(url)) shell.openExternal(url);
  });
  if (SMOKE) {
    wc.once('did-finish-load', () => setTimeout(() => writeJson(path.join(userDir(), 'smoke.json'), {
      version: app.getVersion(), url: wc.getURL(), title: wc.getTitle(), fullscreen: lobby?.isFullScreen() ?? false, at: new Date().toISOString(),
    }), 3000));
  }
  wc.on('dom-ready', () => {
    if (!isSitePage(wc.getURL())) return;
    wc.insertCSS(CURSOR_CSS).catch(() => {});
    wc.executeJavaScript(CURSOR_JS).catch(() => {});
  });
  wc.on('did-fail-load', (_e, code, desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3 /* aborted by a newer load */) return;
    log('page failed to load', code, desc, url);
    wc.loadFile(path.join(HERE, 'static', 'offline.html')).catch(() => {});
    clearTimeout(retryTimer);
    retryTimer = setTimeout(() => { if (lobby && !lobby.isDestroyed()) lobby.loadURL(PAGE_URL); }, RETRY_LOAD_MS);
  });
  wc.on('render-process-gone', (_e, details) => {
    log('page crashed', details);
    setTimeout(() => { if (lobby && !lobby.isDestroyed()) lobby.loadURL(PAGE_URL); }, 3000);
  });
  // The page's own double-click fullscreen can leave the window part of it
  // behind when it ends; put the lobby back where it belongs.
  lobby.on('leave-html-full-screen', () => setTimeout(place, 50));
  // Closing it by hand (Alt+F4, or the window's X while it is windowed) is
  // the tray's Hide: gone until the next club night.
  lobby.on('close', () => {
    if (closingByApp) return;
    state.overrides = hide(state.overrides, currentWindow());
    saveState();
    log('closed by hand: hidden until the next club night');
  });
  lobby.on('closed', () => {
    lobby = null;
    placedAs = null;
    stopBlocker();
    updateTray();
  });
  lobby.once('ready-to-show', place);
  // A page that hangs before its first paint still gets a window.
  setTimeout(() => { if (lobby && !lobby.isDestroyed() && !lobby.isVisible()) place(); }, 10_000);
  lobby.loadURL(PAGE_URL);
  if (blocker < 0) blocker = powerSaveBlocker.start('prevent-display-sleep');
  log('lobby opened');
}

function stopBlocker() {
  if (blocker >= 0 && powerSaveBlocker.isStarted(blocker)) powerSaveBlocker.stop(blocker);
  blocker = -1;
}

function closeLobby() {
  clearTimeout(retryTimer);
  if (!lobby || lobby.isDestroyed()) return;
  closingByApp = true;
  try { lobby.destroy(); } finally { closingByApp = false; }
  lobby = null;
  placedAs = null;
  stopBlocker();
  log('lobby closed');
}

/* ── The clock ─────────────────────────────────────────────────────── */

const currentWindow = () => displayWindow(now(), sources);
let lastReason = null;

/**
 * "Show it" from a person (the tray, or opening the app again). Already up
 * for club night, it only brings the window back where it belongs: a click
 * must not turn the schedule's showing into a three-hour manual one that
 * outlasts the 8:00 pm close.
 */
function requestShow() {
  const t = now();
  const { reason } = decideVisibility(displayWindow(t, sources), state.overrides, t.getTime());
  if (reason !== 'schedule') {
    state.overrides = showNow(state.overrides, t.getTime());
    saveState();
  }
  evaluate();
  if (lobby && !lobby.isDestroyed()) { place(); lobby.focus(); }
}

/** The whole rule, re-asked every minute on the minute and after anything changes. */
function evaluate() {
  const t = now();
  const win = displayWindow(t, sources);
  const tidied = tidy(state.overrides, win, t.getTime());
  if (tidied !== state.overrides) { state.overrides = tidied; saveState(); }
  const { visible, reason } = SMOKE ? { visible: true, reason: 'manual' } : decideVisibility(win, state.overrides, t.getTime());
  if (reason !== lastReason) { log('state', reason, win.dateKey); lastReason = reason; }
  if (visible) openLobby(); else closeLobby();
  updateTray();
  if (!visible) maybeInstallUpdate();
}

let tickTimer = null;
function scheduleTick() {
  clearTimeout(tickTimer);
  // On the minute (plus a hair), so 5:00 and 8:00 land on time.
  const ms = 60_000 - (now().getTime() % 60_000) + 150;
  tickTimer = setTimeout(() => { evaluate(); scheduleTick(); }, ms);
}

/* ── Choosing the monitor ──────────────────────────────────────────── */

/** @type {Map<number, { win: BrowserWindow, display: Electron.Display }>} */
const choosers = new Map();

function closeChoosers() {
  for (const { win } of choosers.values()) if (!win.isDestroyed()) win.destroy();
  choosers.clear();
}

/** One numbered card on every monitor; the one clicked becomes the lobby TV. */
function openChooser() {
  closeChoosers();
  const displays = screen.getAllDisplays();
  const savedHere = findDisplay(displays, state.display);
  displays.forEach((display, i) => {
    const wa = display.workArea;
    const width = Math.min(620, wa.width - 40);
    const height = Math.min(420, wa.height - 40);
    const win = new BrowserWindow({
      x: wa.x + Math.round((wa.width - width) / 2),
      y: wa.y + Math.round((wa.height - height) / 2),
      width, height,
      frame: false, resizable: false, minimizable: false, maximizable: false, fullscreenable: false,
      alwaysOnTop: true, skipTaskbar: true, show: false, backgroundColor: '#FAA41D',
      title: `${APP_NAME}: choose the lobby TV`,
      webPreferences: { preload: path.join(HERE, 'static', 'chooser-preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false },
    });
    const id = win.webContents.id;
    choosers.set(id, { win, display });
    win.on('closed', () => choosers.delete(id));
    win.loadFile(path.join(HERE, 'static', 'chooser.html'), {
      query: {
        n: String(i + 1),
        label: display.label || `Monitor ${i + 1}`,
        size: `${display.size.width} x ${display.size.height}`,
        current: savedHere && savedHere.id === display.id ? '1' : '',
      },
    });
    win.once('ready-to-show', () => win.show());
  });
}

ipcMain.on('chooser:choose', (event) => {
  const picked = choosers.get(event.sender.id);
  if (!picked) return;
  state.display = rememberDisplay(picked.display);
  saveState();
  log('lobby TV chosen', state.display);
  closeChoosers();
  place();
  evaluate();
});
ipcMain.on('chooser:cancel', () => closeChoosers());

/* ── The tray ──────────────────────────────────────────────────────── */

/** @type {Tray | null} */
let tray = null;

const fmtTime = (ms) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const clock = (min) => {
  const h = Math.floor(min / 60); const m = min % 60;
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

function statusLine() {
  const t = now();
  const win = displayWindow(t, sources);
  const { reason } = decideVisibility(win, state.overrides, t.getTime());
  if (reason === 'schedule') return `On screen for club night, until ${clock(CLOSE_AT_MIN)}`;
  if (reason === 'manual') return `Shown by hand, until ${fmtTime(state.overrides.manualUntil)}`;
  if (reason === 'hidden') return 'Hidden until the next club night';
  const next = nextClubNight(t, sources);
  if (!next) return 'No club night in the next two months';
  const [y, m, d] = next.split('-').map(Number);
  const day = new Date(y, m - 1, d).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  return `Next club night: ${day}, ${clock(OPEN_AT_MIN)}`;
}

function autostartOn() {
  return DEV ? false : app.getLoginItemSettings({ args: ['--autostart'] }).openAtLogin;
}
function setAutostart(on) {
  if (DEV) return;
  app.setLoginItemSettings({ openAtLogin: on, args: ['--autostart'] });
}

let updateStatus = '';
let updateReady = false;

function updateTray() {
  if (!tray) return;
  const t = now();
  const win = displayWindow(t, sources);
  const { visible, reason } = decideVisibility(win, state.overrides, t.getTime());
  const overridden = state.overrides.manualUntil > t.getTime() || state.overrides.hiddenForWindow != null;
  const lines = [{ label: statusLine(), enabled: false }];
  if (lobby && placedAs === 'windowed') {
    lines.push({ label: state.display ? 'Lobby TV not found: showing in a window' : 'No lobby TV chosen yet', enabled: false });
  }
  const menu = Menu.buildFromTemplate([
    ...lines,
    { type: 'separator' },
    { label: 'Show now (for 3 hours)', enabled: reason !== 'schedule', click: requestShow },
    { label: 'Hide until the next club night', enabled: visible, click: () => { state.overrides = hide(state.overrides, currentWindow()); saveState(); evaluate(); } },
    { label: 'Resume schedule', enabled: overridden, click: () => { state.overrides = NO_OVERRIDES; saveState(); evaluate(); } },
    { type: 'separator' },
    { label: 'Choose the lobby TV...', click: openChooser },
    { label: 'Reload the page', enabled: Boolean(lobby), click: () => lobby?.loadURL(PAGE_URL) },
    { type: 'separator' },
    { label: 'Start with Windows', type: 'checkbox', checked: autostartOn(), enabled: !DEV, click: (item) => setAutostart(item.checked) },
    { label: updateReady ? 'Restart to update now' : 'Check for updates', enabled: !DEV, click: () => (updateReady ? installUpdate() : checkForUpdates(true)) },
    { label: `Version ${app.getVersion()}${updateStatus ? ` (${updateStatus})` : ''}`, enabled: false },
    { label: 'Open log file', click: () => shell.openPath(logPath()) },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
  tray.setToolTip(`${APP_NAME}\n${statusLine()}`);
}

/* ── Updates ───────────────────────────────────────────────────────── */

// Downloaded in the background, installed only while nothing is on screen:
// a club night is never interrupted to install a fix.
function checkForUpdates(byHand = false) {
  if (DEV) return;
  updateStatus = byHand ? 'checking' : updateStatus;
  updateTray();
  autoUpdater.checkForUpdates().catch((err) => { log('update check failed', err); updateStatus = 'update check failed'; updateTray(); });
}

function installUpdate() {
  log('installing update');
  // The installer relaunches the app with no arguments, which would read as
  // a person opening it (and show the lobby for three hours at 2 am).
  state.quietRelaunch = true;
  saveState();
  closingByApp = true;
  autoUpdater.quitAndInstall(true, true);
}

function maybeInstallUpdate() {
  if (!updateReady || lobby || choosers.size) return;
  installUpdate();
}

function wireUpdater() {
  if (DEV) return;
  autoUpdater.autoDownload = true;
  autoUpdater.disableWebInstaller = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = { info: (m) => log('updater', m), warn: (m) => log('updater', m), error: (m) => log('updater', m), debug: () => {} };
  autoUpdater.on('update-not-available', () => { updateStatus = 'up to date'; updateTray(); });
  autoUpdater.on('update-available', (info) => { updateStatus = `downloading ${info.version}`; updateTray(); });
  autoUpdater.on('update-downloaded', (info) => {
    updateReady = true;
    updateStatus = `${info.version} ready`;
    log('update downloaded', info.version);
    updateTray();
    evaluate();
  });
  autoUpdater.on('error', (err) => { log('updater error', err); updateStatus = 'update failed'; updateTray(); });
  setTimeout(() => checkForUpdates(), 30_000);
  setInterval(() => checkForUpdates(), UPDATE_EVERY_MS);
}

/* ── Start ─────────────────────────────────────────────────────────── */

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.setAppUserModelId('org.kvbc.awana-lobby-display');

  // Opening the app again (the Start menu or desktop icon) means "show it".
  app.on('second-instance', requestShow);

  // A tray app: closing its last window is not quitting.
  app.on('window-all-closed', () => {});
  app.on('before-quit', () => { closingByApp = true; });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    state = { display: null, overrides: NO_OVERRIDES, ...readJson(statePath(), {}) };
    if (!state.overrides || typeof state.overrides !== 'object') state.overrides = NO_OVERRIDES;
    sources = { schedule: null, feed: null, fetchedAt: 0, ...readJson(sourcesPath(), {}) };
    log(`start ${app.getVersion()}`, { site: SITE, argv: process.argv.slice(1), clockOffset: CLOCK_OFFSET });

    // Start with Windows from the first run on; the tray can turn it off.
    if (!DEV && !SMOKE && !state.autostartSet) {
      setAutostart(true);
      state.autostartSet = true;
      saveState();
    }

    // The .ico carries every size, so the tray stays sharp at any Windows scale.
    const trayIcon = process.platform === 'win32'
      ? path.join(HERE, 'build', 'icon.ico')
      : nativeImage.createFromPath(path.join(HERE, 'build', 'icon.png')).resize({ width: 22, height: 22, quality: 'best' });
    tray = new Tray(trayIcon);
    tray.on('click', () => tray?.popUpContextMenu());

    // Started by hand rather than by Windows at sign-in: the person wants to
    // see it (and on the very first run, to set it up).
    const quiet = SMOKE || process.argv.includes('--autostart') || state.quietRelaunch === true;
    if (state.quietRelaunch) { delete state.quietRelaunch; saveState(); }
    if (!quiet) {
      const t = now();
      if (decideVisibility(displayWindow(t, sources), state.overrides, t.getTime()).reason !== 'schedule') {
        state.overrides = showNow(state.overrides, t.getTime());
        saveState();
      }
    }

    evaluate();
    scheduleTick();
    refreshSources();
    setInterval(refreshSources, SOURCES_EVERY_MS);
    if (!SMOKE) wireUpdater();

    // First run with more than one monitor: ask which one is the lobby TV.
    if (!SMOKE && !state.display && screen.getAllDisplays().length > 1) openChooser();

    for (const ev of ['display-added', 'display-removed', 'display-metrics-changed']) {
      screen.on(ev, () => {
        log('displays changed', ev);
        place();
        if (!state.display && screen.getAllDisplays().length > 1 && !choosers.size) openChooser();
      });
    }
    powerMonitor.on('resume', () => { evaluate(); scheduleTick(); refreshSources(); });
    powerMonitor.on('unlock-screen', evaluate);
  });
}
