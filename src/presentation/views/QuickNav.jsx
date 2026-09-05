import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { CLUBS } from '../config.js';
import { stateKey, stateForWindow, windowsForDate } from '../lib/schedule.js';
import { localDateKey } from '../lib/shared-config.js';
import { addSkipDate, overlayEntries, removeSkipDate, subscribeOverlay } from '../lib/scheduleOverlay.js';
import { setStingersEnabled, stingersEnabled, subscribeStingers } from '../lib/stingers.js';
import { clearBirthdays, useBirthdays } from '../hooks/useBirthdays.js';
import { useEffectiveSchedule } from '../hooks/useEffectiveSchedule.js';
import { lowPowerPreference, setLowPowerPreference, useLowPower } from '../hooks/useLowPower.js';
import { useClockDrift } from '../hooks/useClockDrift.js';
import { useConfig } from '../../hooks/useConfig.js';
import { useDisplayLogin } from '../../hooks/useDisplayLogin.js';
import { useDisplayKey } from '../../hooks/useDisplayKey.js';
import { maskDisplayKey } from '../../lib/displayKey.js';
import { isPlausibleKey } from '../../lib/envelope.js';
import { GlassPanel } from '../components/GlassPanel.jsx';

/**
 * Hidden operator menu. Its hover zone is only the top-right corner —
 * the old version keyed off the whole screen, so any mouse nudge
 * anywhere revealed it. Windows listed are the ones in effect on
 * `now`'s date (special dates can replace the normal table), and the
 * active probe uses the app clock so it is honest under `?now=` QA.
 */
export const QuickNav = ({ now, state, isOverride, onSelect, onResume, socketStatus }) => {
  const activeKey = stateKey(state);
  const cfg = useEffectiveSchedule();
  const windows = windowsForDate(now, cfg) ?? cfg.windows;
  const skewMs = useClockDrift();

  return (
    <div className="absolute top-0 right-0 z-50 p-4 pl-16 pb-16 group/nav">
      {/* Clock-drift warning is visible WITHOUT hovering — a wrong clock
          means every screen below is wrong, so it must not hide. */}
      {skewMs !== null && (
        <div
          className="absolute top-3 right-3 px-3 py-1 rounded-full text-[0.65rem] uppercase text-amber-300 bg-amber-500/15 border border-amber-400/40"
          style={{ fontFamily: 'var(--font-condensed)', fontWeight: 800, letterSpacing: '0.1em' }}
          title="This device's clock disagrees with the web server — the countdown and schedule may be wrong. Fix the system clock / enable network time."
        >
          ⚠ clock off by ~{Math.round(Math.abs(skewMs) / 60000)} min
        </div>
      )}
      <div className="opacity-0 group-hover/nav:opacity-100 transition-opacity duration-300">
        <GlassPanel className="p-2 flex flex-col gap-1 max-h-[92vh] overflow-y-auto">
          <NavButton
            label="Main Countdown"
            active={activeKey === 'countdown'}
            onClick={() => onSelect({ type: 'countdown' })}
          />
          {windows.map((window, index) => (
            <NavButton
              key={window.title}
              label={window.title}
              dotColor={window.kind === 'game' ? CLUBS[window.clubs[0]].color : undefined}
              active={activeKey === stateKey(stateForWindow(window, now))}
              onClick={() => onSelect({ type: 'window', index })}
            />
          ))}
          {isOverride && (
            <button
              onClick={onResume}
              className="mt-2 px-3 py-1.5 text-xs uppercase text-emerald-400 hover:bg-emerald-400/10 rounded-lg transition-all border border-emerald-400/20 text-center"
              style={{ fontFamily: 'var(--font-condensed)', fontWeight: 800, letterSpacing: '0.12em' }}
            >
              Resume Schedule
            </button>
          )}
          <SkipWeeks now={now} cfg={cfg} />
          <BirthdayStatus />
          <TogglesRow />
          <DisplaySettings socketStatus={socketStatus} />
          <p
            className="mt-2 pt-2 border-t border-white/10 px-3 pb-1 text-[0.55rem] uppercase text-gray-500 text-right leading-relaxed"
            style={{ fontFamily: 'var(--font-condensed)', fontWeight: 700, letterSpacing: '0.1em' }}
          >
            Awana® is a trademark of Awana Clubs International.
            <br />
            Not affiliated or endorsed by Awana Clubs International.
          </p>
        </GlassPanel>
      </div>
    </div>
  );
};

/**
 * Operator "skip weeks" editor (device-local overlay over the shared
 * schedule): cancel an upcoming club night without a deploy. Entries
 * baked into shared/schedule.json show read-only; reshaped window
 * tables still require editing the JSON (validated in CI).
 */
const SkipWeeks = ({ now, cfg }) => {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState('');
  const [error, setError] = useState(null);
  const overlay = useSyncExternalStore(subscribeOverlay, overlayEntries, overlayEntries);

  const todayKey = localDateKey(now);
  const upcoming = Object.entries(cfg.specialDates)
    .filter(([key, val]) => key >= todayKey && val.noClub)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .slice(0, 6);

  const add = () => {
    const err = addSkipDate(date, 'No club (set at the projector)');
    setError(err);
    if (!err) setDate('');
  };

  const inputStyle =
    'px-2 py-1 text-xs rounded bg-white/10 border border-white/15 text-white outline-none focus:border-white/40 w-40';

  return (
    <div
      className="mt-2 pt-2 border-t border-white/10 flex flex-col gap-1"
      style={{ fontFamily: 'var(--font-condensed)', letterSpacing: '0.12em' }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="px-3 py-1.5 text-xs uppercase text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all text-right flex items-center justify-end gap-2"
        style={{ fontWeight: 700 }}
      >
        Skip Weeks
        <span style={{ letterSpacing: 0 }}>{open ? '▴' : '📅'}</span>
      </button>
      {open && (
        <div className="px-3 pb-1 flex flex-col items-end gap-1.5">
          {upcoming.length > 0 && (
            <ul className="flex flex-col items-end gap-1">
              {upcoming.map(([key, val]) => (
                <li key={key} className="flex items-center gap-2 text-[0.65rem] uppercase text-gray-400">
                  <span style={{ fontWeight: 700 }}>
                    {key} — no club{val.label ? ` (${val.label})` : ''}
                  </span>
                  {key in overlay ? (
                    <button
                      onClick={() => removeSkipDate(key)}
                      className="text-red-400/70 hover:text-red-400 transition-colors"
                      style={{ fontWeight: 700 }}
                    >
                      Undo
                    </button>
                  ) : (
                    <span className="text-gray-600" title="Baked into shared/schedule.json — edit the file to change">
                      (shared)
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          <input
            type="date"
            className={inputStyle}
            value={date}
            onChange={(e) => { setDate(e.target.value); setError(null); }}
          />
          <button
            onClick={add}
            className="px-3 py-1 text-xs uppercase text-amber-300 hover:bg-amber-400/10 rounded-lg transition-all border border-amber-400/25"
            style={{ fontWeight: 800 }}
          >
            Mark “no club”
          </button>
          <p className="text-[0.6rem] uppercase text-gray-500 text-right" style={{ fontWeight: 700 }}>
            {error ? error : 'This device only · shared/schedule.json is the master copy'}
          </p>
        </div>
      )}
    </div>
  );
};

/** Low-power mode + countdown-stinger switches. */
const TogglesRow = () => {
  useLowPower(); // subscribe so the row re-renders when either side flips
  const stingers = useSyncExternalStore(subscribeStingers, stingersEnabled, stingersEnabled);

  return (
    <div
      className="mt-2 pt-2 border-t border-white/10 flex flex-col gap-1"
      style={{ fontFamily: 'var(--font-condensed)', letterSpacing: '0.12em' }}
    >
      <ToggleButton
        label="Low power mode"
        hint="Hides particle / weather layers for weak hardware"
        on={lowPowerPreference()}
        onToggle={() => setLowPowerPreference(!lowPowerPreference())}
      />
      <ToggleButton
        label="Countdown sounds"
        hint="Chimes at 1hr/30/10/5/1min — off by default"
        on={stingers}
        onToggle={() => setStingersEnabled(!stingers)}
      />
    </div>
  );
};

const ToggleButton = ({ label, hint, on, onToggle }) => (
  <button
    onClick={onToggle}
    title={hint}
    className={`px-3 py-1.5 text-xs uppercase rounded-lg transition-all text-right flex items-center justify-end gap-2 ${
      on ? 'text-emerald-300 bg-emerald-400/10' : 'text-gray-400 hover:text-white hover:bg-white/10'
    }`}
    style={{ fontFamily: 'var(--font-condensed)', fontWeight: 700, letterSpacing: '0.12em' }}
  >
    {label}
    <span
      className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${on ? 'bg-emerald-400' : 'bg-gray-600'}`}
    />
  </button>
);

/**
 * Birthday roster status. The roster fills itself from the print
 * server's `birthdays` broadcast (through the sanitized socket — the
 * exact source the check-in display uses), so the only operator
 * control left is Clear; the list refills on the next broadcast. The
 * CSV upload this replaced is gone on purpose: two sources meant a
 * stale spreadsheet could contradict the live one.
 */
const BirthdayStatus = () => {
  const roster = useBirthdays();
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  return (
    <div
      className="mt-2 pt-2 border-t border-white/10 flex flex-col gap-1"
      style={{ fontFamily: 'var(--font-condensed)', letterSpacing: '0.12em' }}
    >
      <div className="px-3 py-1.5 flex items-center justify-end gap-2 text-xs uppercase text-gray-400" style={{ fontWeight: 700 }}>
        {roster.length > 0 ? `${roster.length} birthdays · synced live` : 'Birthdays sync from check-in'}
        <span style={{ letterSpacing: 0 }}>🎂</span>
      </div>
      {roster.length > 0 && (
        <div className="px-3 flex items-center justify-end gap-2 text-[0.65rem] uppercase text-gray-500">
          <button
            onClick={() => {
              clearBirthdays();
              setNotice({ text: 'Cleared — refills on the next broadcast', ok: true });
            }}
            className="text-red-400/70 hover:text-red-400 transition-colors"
            style={{ fontWeight: 700 }}
          >
            Clear
          </button>
        </div>
      )}
      {notice && (
        <p
          className={`px-3 text-right text-[0.65rem] uppercase ${notice.ok ? 'text-emerald-400' : 'text-amber-400'}`}
          style={{ fontWeight: 700 }}
        >
          {notice.text}
        </p>
      )}
    </div>
  );
};

/**
 * Display settings (#42): the live-data connection, editable on the
 * display machine itself instead of via URL flags. The Pusher key is
 * the PUBLIC subscribe-only key (the print server holds the secret).
 * Credentials live in the display's shared device config
 * (`awanaConfig.v1` via useConfig) — the same store the signage page's
 * Settings panel writes — and the sanctioned socket picks changes up
 * immediately (no reload needed).
 */
const DisplaySettings = ({ socketStatus }) => {
  const { config, updateConfig } = useConfig();
  const [open, setOpen] = useState(false);
  // The by-hand fold opens itself when it IS the fix: no Pusher key yet.
  const [advanced, setAdvanced] = useState(() => socketStatus === 'off');
  const [key, setKey] = useState(config.pusherAppKey || '');
  const [cluster, setCluster] = useState(config.pusherCluster || 'us2');
  const [saved, setSaved] = useState(false);
  // Display login: one passphrase provisions the display key + publish token
  // (the sealed birthday list needs the key). Same store the signage page's
  // Settings uses — src/lib/displayLogin.js.
  const { frameStatus, loginStatus, kid, pendingLogin, login, logout } = useDisplayLogin();
  const [passphrase, setPassphrase] = useState('');
  const [reveal, setReveal] = useState(false);
  const [loginNote, setLoginNote] = useState('');
  const [loginTone, setLoginTone] = useState('muted');
  // The display key by hand — the same slot the signage Settings writes.
  const secure = Boolean(globalThis.crypto?.subtle);
  const { displayKey, setDisplayKey } = useDisplayKey();
  const [editingKey, setEditingKey] = useState(false);
  const [keyDraft, setKeyDraft] = useState('');
  const [keyNote, setKeyNote] = useState('');

  const save = () => {
    updateConfig({ pusherAppKey: key.trim(), pusherCluster: cluster.trim() });
    setSaved(true);
    setTimeout(() => setSaved(false), 4000);
  };

  const busy = loginStatus === 'busy';
  const canLogin = secure && !busy && passphrase.trim().length > 0;

  const doLogin = async () => {
    const p = passphrase.trim();
    if (!p || !canLogin) return;
    const result = await login(p);
    if (result === 'logged-in') setPassphrase('');
    const notes = {
      'logged-in': ['Logged in — birthdays + names unlocked', 'ok'],
      wrong: ['Wrong passphrase — check the dashboard (Settings → Display login)', 'bad'],
      'no-frame': ['Waiting for the print server — will log in when its frame arrives', 'muted'],
      unsupported: ['Insecure page — open this page over https:// to log in', 'bad'],
      storage: ['Could not save (storage blocked)', 'bad'],
    };
    const [note, tone] = notes[result] || ['', 'muted'];
    setLoginNote(note);
    setLoginTone(tone);
  };

  // Status first: the print server is usually fine and the screen is simply
  // not connected yet — the old line blamed the server for every wait.
  let loginLine;
  let lineTone = 'muted';
  if (!secure) { loginLine = 'Insecure page — open over https:// to log in'; lineTone = 'bad'; }
  else if (loginStatus === 'logged-in') { loginLine = `Logged in${kid ? ` · key ${kid}` : ''}`; lineTone = 'ok'; }
  else if (loginStatus === 'stale') { loginLine = 'Passphrase changed — log in again'; lineTone = 'bad'; }
  else if (busy) loginLine = 'Checking…';
  else if (socketStatus === 'off') { loginLine = 'Not connected — add the live data key under Advanced first'; lineTone = 'bad'; }
  else if (socketStatus === 'disconnected') { loginLine = 'Not connected — check the network, then the key under Advanced'; lineTone = 'bad'; }
  else if (socketStatus === 'connecting') loginLine = 'Connecting…';
  else if (loginStatus === 'wrong') { loginLine = 'Wrong passphrase'; lineTone = 'bad'; }
  else if (pendingLogin) loginLine = 'Will log in when the print server is heard';
  else if (frameStatus === 'received') loginLine = 'Type the display passphrase';
  else if (frameStatus === 'miss') loginLine = 'Print server has not published lately';
  else loginLine = 'Waiting for the print server…';
  const tone = loginNote ? loginTone : lineTone;
  const toneClass = tone === 'ok' ? 'text-emerald-400' : tone === 'bad' ? 'text-red-400' : 'text-gray-400';

  const inputStyle =
    'px-2 py-1 text-xs rounded bg-white/10 border border-white/15 text-white placeholder-gray-500 outline-none focus:border-white/40 w-40 disabled:opacity-40';
  const pillGrey = 'px-3 py-1 text-xs uppercase text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all border border-white/15';
  const pillGreen = 'px-3 py-1 text-xs uppercase text-emerald-400 hover:bg-emerald-400/10 rounded-lg transition-all border border-emerald-400/20 disabled:opacity-40';

  const saveKey = () => {
    const next = keyDraft.trim();
    if (!isPlausibleKey(next)) return;
    const ok = setDisplayKey(next);
    setKeyNote(ok ? 'Saved — applies immediately' : 'Could not save (storage blocked)');
    if (ok) { setKeyDraft(''); setEditingKey(false); }
  };

  return (
    <div
      className="mt-2 pt-2 border-t border-white/10 flex flex-col gap-1.5"
      style={{ fontFamily: 'var(--font-condensed)', letterSpacing: '0.12em' }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="px-3 py-1.5 text-xs uppercase text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all text-right flex items-center justify-end gap-2"
        style={{ fontWeight: 700 }}
      >
        Display Settings
        <span style={{ letterSpacing: 0 }}>{open ? '▴' : '⚙️'}</span>
      </button>
      {open && (
        <div className="px-3 pb-1 flex flex-col items-end gap-1.5">
          <label className="text-[0.6rem] uppercase text-gray-500" style={{ fontWeight: 700 }}>
            Display login
          </label>
          {loginStatus !== 'logged-in' ? (
            <>
              <div className="flex items-center gap-1.5">
                <input
                  className={inputStyle}
                  type={reveal ? 'text' : 'password'}
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && canLogin) doLogin(); }}
                  placeholder="display passphrase"
                  spellCheck={false}
                  autoComplete="off"
                  disabled={!secure || busy}
                  aria-label="Display passphrase"
                />
                <button
                  onClick={() => setReveal((v) => !v)}
                  aria-pressed={reveal}
                  className="px-2 py-0.5 text-[0.6rem] uppercase text-gray-400 hover:text-white rounded"
                  style={{ fontWeight: 700 }}
                >
                  {reveal ? 'Hide' : 'Show'}
                </button>
              </div>
              <button
                onClick={doLogin}
                disabled={!canLogin}
                className={pillGreen}
                style={{ fontWeight: 800 }}
              >
                Log in
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                if (window.confirm('Log this screen out? It forgets the display key and publish token too.')) { logout(); setLoginNote(''); }
              }}
              className={pillGrey}
              style={{ fontWeight: 800 }}
            >
              Log out
            </button>
          )}
          <p className={`text-xs uppercase text-right ${toneClass}`} style={{ fontWeight: 700 }}>
            {loginNote || loginLine}
          </p>

          <button
            onClick={() => setAdvanced((v) => !v)}
            className="px-2 py-0.5 text-[0.6rem] uppercase text-gray-500 hover:text-white rounded transition-all"
            style={{ fontWeight: 700 }}
          >
            {advanced ? '▴ Advanced' : '▾ Advanced (paste keys by hand)'}
          </button>
          {advanced && (
            <>
              <label className="text-[0.6rem] uppercase text-gray-500" style={{ fontWeight: 700 }}>
                Live data key (Pusher, public)
              </label>
              <input
                className={inputStyle}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="public key — blank = off"
                spellCheck={false}
                aria-label="Pusher app key"
              />
              <input
                className={inputStyle}
                value={cluster}
                onChange={(e) => setCluster(e.target.value)}
                placeholder="cluster (us2)"
                spellCheck={false}
                aria-label="Pusher cluster"
              />
              <button
                onClick={save}
                className="px-3 py-1 text-xs uppercase text-emerald-400 hover:bg-emerald-400/10 rounded-lg transition-all border border-emerald-400/20"
                style={{ fontWeight: 800 }}
              >
                Save
              </button>
              <p className="text-[0.6rem] uppercase text-gray-500 text-right" style={{ fontWeight: 700 }}>
                {saved ? 'Saved — applies immediately' : 'Powers live counts + birthday sync'}
              </p>

              <label className="text-[0.6rem] uppercase text-gray-500 mt-1" style={{ fontWeight: 700 }}>
                Display key (names + birthdays)
              </label>
              {!secure ? (
                <p className="text-xs text-red-400 text-right" style={{ fontWeight: 700 }}>
                  Insecure page — encrypted names cannot be read here. Open this page over https://
                </p>
              ) : displayKey && !editingKey ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-300" style={{ fontFamily: 'monospace', letterSpacing: 0 }}>
                    {maskDisplayKey(displayKey)}
                  </span>
                  <button onClick={() => setEditingKey(true)} className={pillGrey} style={{ fontWeight: 800 }}>Replace</button>
                  <button
                    onClick={() => {
                      if (window.confirm('Remove the display key from THIS screen? Names and birthdays stop here until it is set again.')) setDisplayKey('');
                    }}
                    className={pillGrey}
                    style={{ fontWeight: 800 }}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <input
                    className={inputStyle}
                    type="password"
                    value={keyDraft}
                    onChange={(e) => setKeyDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveKey(); }}
                    placeholder="paste the 44-character key"
                    spellCheck={false}
                    autoComplete="off"
                    aria-label="Display key"
                  />
                  <button disabled={!isPlausibleKey(keyDraft.trim())} onClick={saveKey} className={pillGreen} style={{ fontWeight: 800 }}>
                    Save key
                  </button>
                  {editingKey && (
                    <button onClick={() => { setEditingKey(false); setKeyDraft(''); }} className={pillGrey} style={{ fontWeight: 800 }}>
                      Cancel
                    </button>
                  )}
                </div>
              )}
              {keyNote && (
                <p className="text-[0.65rem] uppercase text-gray-400 text-right" style={{ fontWeight: 700 }}>{keyNote}</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

const NavButton = ({ label, active, dotColor, onClick }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 text-xs uppercase rounded-lg transition-all text-right flex items-center justify-end gap-2 ${
      active ? 'text-white bg-white/20' : 'text-gray-400 hover:text-white hover:bg-white/10'
    }`}
    style={{ fontFamily: 'var(--font-condensed)', fontWeight: 700, letterSpacing: '0.12em' }}
  >
    {label}
    {dotColor && (
      <span
        className="inline-block w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: dotColor }}
      />
    )}
  </button>
);
