import React, { useEffect, useRef, useState } from 'react';
import { CLUBS } from '../config.js';
import { SCHEDULE_CONFIG } from '../lib/shared-config.js';
import { stateKey, stateForWindow, windowsForDate } from '../lib/schedule.js';
import { parseBirthdayCSV } from '../lib/birthdays.js';
import { clearBirthdays, saveBirthdays, useBirthdayRoster } from '../hooks/useBirthdays.js';
import { useConfig } from '../../hooks/useConfig.js';
import { GlassPanel } from '../components/GlassPanel.jsx';

/**
 * Hidden operator menu. Its hover zone is only the top-right corner —
 * the old version keyed off the whole screen, so any mouse nudge
 * anywhere revealed it. Windows listed are the ones in effect on
 * `now`'s date (special dates can replace the normal table), and the
 * active probe uses the app clock so it is honest under `?now=` QA.
 */
export const QuickNav = ({ now, state, isOverride, onSelect, onResume }) => {
  const activeKey = stateKey(state);
  const windows = windowsForDate(now) ?? SCHEDULE_CONFIG.windows;

  return (
    <div className="absolute top-0 right-0 z-50 p-4 pl-16 pb-16 group/nav">
      <div className="opacity-0 group-hover/nav:opacity-100 transition-opacity duration-300">
        <GlassPanel className="p-2 flex flex-col gap-1">
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
          <BirthdayUpload />
          <DisplaySettings />
        </GlassPanel>
      </div>
    </div>
  );
};

/**
 * Operator control for the birthday roster: pick a CSV (name, birthday,
 * club per row), which is parsed and stored in localStorage. Birthdays
 * then appear on each club's game-time screen during their week. The
 * roster also self-populates from the print server's weekly broadcast
 * ("live" count); Clear wipes both sources.
 */
const BirthdayUpload = () => {
  const fileRef = useRef(null);
  const { csvCount, liveCount } = useBirthdayRoster();
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;
    try {
      const { entries, errors } = parseBirthdayCSV(await file.text());
      if (entries.length === 0) {
        setNotice({ text: 'No valid rows (need name, birthday, club)', ok: false });
        return;
      }
      saveBirthdays(entries);
      setNotice({
        text: `${entries.length} birthdays loaded${errors.length > 0 ? ` · ${errors.length} skipped` : ''}`,
        ok: true,
      });
    } catch {
      setNotice({ text: 'Could not read that file', ok: false });
    }
  };

  return (
    <div
      className="mt-2 pt-2 border-t border-white/10 flex flex-col gap-1"
      style={{ fontFamily: 'var(--font-condensed)', letterSpacing: '0.12em' }}
    >
      <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
      <button
        onClick={() => fileRef.current?.click()}
        className="px-3 py-1.5 text-xs uppercase text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all text-right flex items-center justify-end gap-2"
        style={{ fontWeight: 700 }}
      >
        Upload Birthdays CSV
        <span style={{ letterSpacing: 0 }}>🎂</span>
      </button>
      {csvCount + liveCount > 0 && (
        <div className="px-3 flex items-center justify-end gap-2 text-[0.65rem] uppercase text-gray-500">
          <span style={{ fontWeight: 700 }}>
            {csvCount} loaded{liveCount > 0 ? ` · ${liveCount} live` : ''}
          </span>
          <button
            onClick={() => {
              clearBirthdays();
              setNotice({ text: 'Birthdays cleared', ok: true });
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
const DisplaySettings = () => {
  const { config, updateConfig } = useConfig();
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(config.pusherAppKey || '');
  const [cluster, setCluster] = useState(config.pusherCluster || 'us2');
  const [saved, setSaved] = useState(false);

  const save = () => {
    updateConfig({ pusherAppKey: key.trim(), pusherCluster: cluster.trim() });
    setSaved(true);
    setTimeout(() => setSaved(false), 4000);
  };

  const inputStyle =
    'px-2 py-1 text-xs rounded bg-white/10 border border-white/15 text-white placeholder-gray-500 outline-none focus:border-white/40 w-40';

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
            Live data key (Pusher, public)
          </label>
          <input
            className={inputStyle}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="public key — blank = off"
            spellCheck={false}
          />
          <input
            className={inputStyle}
            value={cluster}
            onChange={(e) => setCluster(e.target.value)}
            placeholder="cluster (us2)"
            spellCheck={false}
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
        style={{ backgroundColor: dotColor, boxShadow: `0 0 8px ${dotColor}` }}
      />
    )}
  </button>
);
