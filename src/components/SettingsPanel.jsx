import { useCallback, useEffect, useId, useRef, useState } from 'react';
import defaults from '../config.js';
import { sanitizeOverrides } from '../hooks/useConfig.js';
import { deleteDeck, getDeck, putDeck } from '../lib/pptxStore.js';
import { BACKGROUND_VIDEO_ID, deleteVideo, getVideo, putVideo } from '../lib/videoStore.js';
import { BACKGROUND_VIDEO_CHANGED_EVENT } from './VideoBackground.jsx';
import { parseAndCacheDeck } from '../lib/pptxModel.js';
import { geocodeLocation } from '../lib/weather.js';
import { deriveClubInfo, formatShortDate, isStoreNight, localDateStr, splitTitle } from '../lib/calendarLogic.js';
import { SAMPLE_NAMES, pick } from '../lib/demoNames.js';
import { NIGHT_THEME_VALUES, skinOptions } from '../lib/skins.js';
import { getAllClubs } from '../lib/clubs.js';
import { useDisplayKey } from '../hooks/useDisplayKey.js';
import { useDisplayLogin } from '../hooks/useDisplayLogin.js';
import { maskDisplayKey } from '../lib/displayKey.js';
import { isPlausibleKey } from '../lib/envelope.js';
import { loadDisplayKey } from '../lib/displayKey.js';
import { loadPublishToken, maskPublishToken, savePublishToken } from '../lib/publishToken.js';

const TABS = [
  { id: 'connection', label: 'Connection' },
  { id: 'background', label: 'Background' },
  { id: 'banners', label: 'Banners & celebrations' },
  { id: 'display', label: 'Display' },
  { id: 'calendar', label: 'Calendar & Weather' },
];

// Radio order = the setup journey: the typed/published deck is the default
// and the one the print server can drive; the others are per-device choices.
const SOURCE_LABELS = {
  manual: 'Typed slides',
  powerpoint: 'Looping PowerPoint',
  pptx: 'Uploaded PowerPoint',
  video: 'Looping video',
};

// One string for the one situation nothing on this page can fix: without
// crypto.subtle neither login nor a hand-pasted key can decrypt anything.
const INSECURE_CONTEXT_COPY = (
  <>
    <strong>This page is not in a secure context</strong>, so this browser cannot read encrypted names at
    all — logging in or pasting a key by hand will not help. Open the display over <code>https://</code>{' '}
    (or <code>http://localhost</code>).
  </>
);

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

// The form is seeded from the STORED config (savedConfig): never the
// panic-masked or URL-flagged one the stage renders, so a Save while
// simplified mode is on cannot write the placeholder values into storage.
function seedForm(c) {
  return {
    pusherAppKey: c.pusherAppKey || '',
    pusherCluster: c.pusherCluster || 'us2',
    backgroundSource: ['powerpoint', 'pptx', 'video'].includes(c.backgroundSource) ? c.backgroundSource : 'manual',
    powerpointEmbedUrl: c.powerpointEmbedUrl || '',
    slideshowDelaySec: c.slideshowDelaySec ?? 5,
    standardDisplayMs: c.standardDisplayMs ?? 6000,
    specialDisplayMs: c.specialDisplayMs ?? 8000,
    audioMuted: !!c.audioMuted,
    showConnectionStatus: !!c.showConnectionStatus,
    showTally: c.showTally !== false,
    keepScreenAwake: c.keepScreenAwake !== false,
    panicMode: !!c.panicMode,
    showClock: !!c.showClock,
    widgetDisplayMode: c.widgetDisplayMode === 'stickers' ? 'stickers' : 'cycle',
    // Reads the one skin table. When this repeated the ids by hand, a saved
    // skin the list had never heard of (thanksgiving, easter, vbs) was silently
    // reset to 'none' the moment Settings was opened.
    nightTheme: NIGHT_THEME_VALUES.includes(c.nightTheme) ? c.nightTheme : 'none',
    followPrinterTheme: c.followPrinterTheme !== false,
    followPublishedSlides: c.followPublishedSlides !== false,
    aprilFools: c.aprilFools === true,
    particleEffect: ['auto', 'snow', 'rain', 'sparkle', 'off'].includes(c.particleEffect)
      ? c.particleEffect
      : 'auto',
    weatherTheme: c.weatherTheme === true,
    confettiLevel: ['reduced', 'off'].includes(c.confettiLevel) ? c.confettiLevel : 'full',
    reduceMotion: c.reduceMotion === true,
    burstFloorMs: c.burstFloorMs ?? 2500,
    clubMilestoneEvery: c.clubMilestoneEvery ?? 10,
    clubPhrases: { ...(c.clubPhrases || {}) },
    checkoutBoardMode: ['pickup', 'always'].includes(c.checkoutBoardMode) ? c.checkoutBoardMode : 'off',
    checkoutBoardNamesAbove: c.checkoutBoardNamesAbove ?? 3,
    checkoutBoardStaleMin: c.checkoutBoardStaleMin ?? 8,
    cycleIntervalSec: c.cycleIntervalSec ?? 3,
    milestoneEvery: c.milestoneEvery ?? 25,
    calendarEnabled: c.calendarEnabled !== false,
    calendarUrl: c.calendarUrl || '',
    calendarWelcomeText: c.calendarWelcomeText || 'Welcome to Awana!',
    calendarShowWelcome: c.calendarShowWelcome !== false,
    calendarShowNextWeek: c.calendarShowNextWeek !== false,
    calendarShowRemaining: c.calendarShowRemaining !== false,
    showWeatherChip: c.showWeatherChip !== false,
    weatherLocationName: c.weatherLocationName || '',
    weatherLat: c.weatherLat ?? 44.552,
    weatherLon: c.weatherLon ?? -69.6317,
    weatherUnits: c.weatherUnits === 'celsius' ? 'celsius' : 'fahrenheit',
  };
}

// The clamp table Save has always applied — now applied to the seed too, so
// the diff below compares like with like.
function normalize(f) {
  return {
    ...f,
    standardDisplayMs: clamp(f.standardDisplayMs, 2000, 20000),
    specialDisplayMs: clamp(f.specialDisplayMs, 3000, 25000),
    slideshowDelaySec: clamp(f.slideshowDelaySec, 0, 120),
    milestoneEvery: clamp(Math.round(f.milestoneEvery) || 0, 0, 10000),
    clubMilestoneEvery: clamp(Math.round(f.clubMilestoneEvery) || 0, 0, 1000),
    checkoutBoardNamesAbove: clamp(Math.round(f.checkoutBoardNamesAbove) || 0, 0, 200),
    checkoutBoardStaleMin: clamp(Math.round(f.checkoutBoardStaleMin) || 8, 1, 120),
    burstFloorMs: clamp(Math.round(f.burstFloorMs) || 2500, 1000, 10000),
    cycleIntervalSec: clamp(Math.round(f.cycleIntervalSec) || 3, 2, 120),
    calendarUrl: f.calendarUrl.trim(),
    calendarWelcomeText: f.calendarWelcomeText.trim().slice(0, 80) || 'Welcome to Awana!',
    weatherLocationName: f.weatherLocationName.trim().slice(0, 80),
    weatherLat: clamp(Number(f.weatherLat) || 0, -90, 90),
    weatherLon: clamp(Number(f.weatherLon) || 0, -180, 180),
  };
}

export default function SettingsPanel({
  config, savedConfig, status, nameStatus, demoActive, lastEventAt, calendar, phase, scheduleSource,
  opsFailures, remoteConfigError, wakeLockStatus, layerFaults,
  initialTab = 'connection', onTabChange,
  onChange, onReset, onClose, onTest, onResetTally, onOpenSlideEditor, onOpenDebug,
  syncedDeck, slidesStatus, onForgetSyncedDeck,
}) {
  const seed = savedConfig ?? config;
  const [initial] = useState(() => seedForm(seed));
  const [form, setForm] = useState(initial);

  const [tab, setTabState] = useState(() => (TABS.some((t) => t.id === initialTab) ? initialTab : 'connection'));
  const setTab = (id) => { setTabState(id); onTabChange?.(id); };
  // Snapshot at open — the header line doesn't need to tick live.
  const [openedAt] = useState(() => Date.now());
  const tabRefs = useRef({});
  const importRef = useRef(null);

  const { displayKey } = useDisplayKey();
  const login = useDisplayLogin();
  const secure = Boolean(globalThis.crypto?.subtle);
  const keyed = Boolean(displayKey) || login.loginStatus === 'logged-in';

  // One shared form across all tabs: switching tabs never loses edits,
  // and Save writes everything in a single clamped patch.
  const set = (key) => (e) => {
    const value = e.target.type === 'checkbox'
      ? e.target.checked
      : e.target.type === 'number'
        ? Number(e.target.value)
        : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
  };

  // Only what changed since the panel opened. An untouched key is never
  // written, so a baked build key or a ?config= fleet value is never pinned
  // as a device override by someone who only turned the confetti down — and
  // an untouched Save is a guaranteed no-op. JSON compare so the one object
  // value (clubPhrases) behaves like the scalars.
  const buildPatch = () => {
    const next = normalize(form);
    const base = normalize(initial);
    return Object.fromEntries(
      Object.entries(next).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(base[k]))
    );
  };
  const dirty = Object.keys(buildPatch()).length > 0;
  const commit = () => {
    const patch = buildPatch();
    if (Object.keys(patch).length) onChange(patch);
  };

  const save = () => { commit(); onClose(); };

  // Escape, the backdrop and Cancel all go through here: a stray click on a
  // TV with a trackpad must not throw away edits on five tabs.
  const requestClose = useCallback(() => {
    if (!dirty || window.confirm('Discard the settings changes you have not saved?')) onClose();
  }, [dirty, onClose]);

  const reset = () => {
    if (window.confirm('Clear every setting saved on this screen and go back to the defaults? This also deletes any typed slides saved on this device.')) {
      onReset();
      onClose();
    }
  };

  // #35: move a display's whole setup between machines as a JSON file.
  // Exports what differs from the baked defaults — device overrides plus any
  // ?config= values — so importing on a fresh install reproduces this screen
  // even when it was configured centrally and `overrides` is empty. Never
  // URL flags, never the panic mask, and structurally never the display key,
  // publish token or login key: sanitizeOverrides is VALIDATORS-bound and
  // none of the three is a config key (see src/lib/displayKey.js).
  const exportSettings = () => {
    const baseline = { ...defaults, audioMuted: !defaults.audioEnabledByDefault };
    const payload = Object.fromEntries(
      Object.entries(sanitizeOverrides(seed)).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(baseline[k]))
    );
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'awana-display-settings.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 0);
  };

  const importSettings = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      let raw;
      try {
        raw = JSON.parse(reader.result);
      } catch {
        window.alert('That file is not a valid settings export.');
        return;
      }
      // Count what would actually apply — a slides export is valid JSON and
      // used to be greeted with "Settings imported." while changing nothing.
      const clean = sanitizeOverrides(raw);
      const n = Object.keys(clean).length;
      if (!n) {
        window.alert('That file has no display settings in it — is it a slides export? (Slide decks are imported from the slide editor’s Import button.)');
        return;
      }
      if (!window.confirm(`Import ${n} setting${n === 1 ? '' : 's'} from this file? Matching settings on this display are replaced; anything not in the file is left as it is.`)) return;
      onChange(clean);
      window.alert(`Imported ${n} setting${n === 1 ? '' : 's'}. Video files and uploaded decks do not travel — re-add those on this device.`);
      onClose();
    };
    reader.onerror = () => window.alert('Could not read that file.');
    reader.readAsText(file);
  };

  // "Save, then show me": the preview must reflect the banner settings the
  // operator just tuned, not the ones from before they opened the panel.
  const sendTest = () => {
    commit();
    onTest?.({
      firstName: pick(SAMPLE_NAMES),
      club: 'Sparks',
    });
    onClose(); // get out of the way so the banner is visible
  };

  // Roving-tabindex keyboard navigation on the tab rail.
  const onTabKeyDown = (e) => {
    const i = TABS.findIndex((t) => t.id === tab);
    let next = null;
    if (e.key === 'ArrowRight') next = TABS[(i + 1) % TABS.length].id;
    else if (e.key === 'ArrowLeft') next = TABS[(i - 1 + TABS.length) % TABS.length].id;
    else if (e.key === 'Home') next = TABS[0].id;
    else if (e.key === 'End') next = TABS[TABS.length - 1].id;
    if (next) {
      e.preventDefault();
      setTab(next);
      tabRefs.current[next]?.focus();
    }
  };

  // Escape closes from anywhere in the panel (through the unsaved-edits guard).
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') requestClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [requestClose]);

  // Names the step the tab actually leads with for each state: logging in
  // cannot work before Pusher is connected, so 'off' points at Advanced.
  const statusText = {
    connected: keyed
      ? 'Connected — check-ins will appear instantly'
      : 'Connected — not logged in yet (Connection → Display login)',
    connecting: 'Connecting to Pusher…',
    disconnected: 'Disconnected — check the network, then the App Key and Cluster under Connection → Advanced',
    off: 'Not set up yet — add the Pusher App Key under Connection → Advanced',
  }[status] || status;

  return (
    <div className="panel-backdrop" onClick={requestClose}>
      <div className="panel panel--tabbed" role="dialog" aria-label="Settings" onClick={(e) => e.stopPropagation()}>
        <div className="panel-header">
          <h2>Settings</h2>
          <div className={`status-line ${status}`}>
            <span className="dot" />
            <span>{statusText}</span>
          </div>
          <div className="hint" style={{ marginTop: '0.35rem' }}>
            {lastEventAt
              ? `Last event ${Math.max(0, Math.round((openedAt - lastEventAt) / 60000))} min ago`
              : 'No events yet this session'}
            {phase ? ` · program phase: ${phase}` : ''}
            {scheduleSource ? ` (schedule: ${scheduleSource})` : ''}
            {calendar?.source && calendar.source !== 'none' ? ` · calendar: ${calendar.source}` : ''}
            {opsFailures?.length
              ? ` · ⚠ ${opsFailures.length} printer problem${opsFailures.length > 1 ? 's' : ''} tonight`
              : ''}
          </div>
          {opsFailures?.length > 0 && (
            <div className="hint" style={{ marginTop: '0.25rem', color: '#ff8a80' }}>
              Printer reported failures{opsFailures[0]?.club ? ` (latest: ${opsFailures[0].club}` : ' (latest'}
              {' at '}
              {new Date(opsFailures[0].at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })})
              — check the print server dashboard.
            </div>
          )}
          {layerFaults?.length > 0 && (
            <div className="hint" style={{ marginTop: '0.25rem', color: '#ff8a80' }}>
              A screen layer crashed and is being retried every 30 s: {layerFaults.join(', ')}. If it keeps
              failing, reload the page (F5) — and report it.
            </div>
          )}
          {remoteConfigError && (
            <div className="hint" style={{ marginTop: '0.25rem', color: '#ff8a80' }}>
              The central config from this page's <code>?config=</code> URL could not be
              applied ({remoteConfigError}) — this display is running on its baked
              defaults and local overrides instead.
            </div>
          )}
          {wakeLockStatus && wakeLockStatus !== 'active' && wakeLockStatus !== 'off' && wakeLockStatus !== 'requesting' && (
            <div className="hint" style={{ marginTop: '0.25rem', color: '#ffcc80' }}>
              {wakeLockStatus === 'unsupported'
                ? 'This browser has no Screen Wake Lock — the TV may sleep mid-club; disable sleep in the device settings instead.'
                : 'The browser refused the screen wake lock (battery saver?) — the TV may sleep mid-club.'}
            </div>
          )}
          {demoActive && (
            <div className="hint" style={{ marginTop: '0.25rem', color: '#ff8a80' }}>
              Demo mode — a sample or simulated check-in was fired on this screen, so the red “not real
              check-ins” badge stays up until the page reloads.{' '}
              <button
                type="button"
                className="ghost small"
                onClick={() => {
                  if (!dirty || window.confirm('Reload now and discard the settings changes you have not saved?')) {
                    window.location.reload();
                  }
                }}
              >
                Reload display
              </button>
            </div>
          )}
        </div>

        <div className="panel-tabs" role="tablist" aria-label="Settings sections" onKeyDown={onTabKeyDown}>
          {TABS.map((t) => (
            <button
              key={t.id}
              ref={(el) => { tabRefs.current[t.id] = el; }}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`tabpanel-${t.id}`}
              tabIndex={tab === t.id ? 0 : -1}
              className="panel-tab"
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div
          className="panel-body"
          role="tabpanel"
          id={`tabpanel-${tab}`}
          aria-labelledby={`tab-${tab}`}
          tabIndex={-1}
        >
          {tab === 'connection' && (
            <ConnectionTab
              form={form}
              set={set}
              status={status}
              nameStatus={nameStatus}
              lastEventAt={lastEventAt}
              secure={secure}
              displayKey={displayKey}
              login={login}
            />
          )}
          {tab === 'background' && (
            <BackgroundTab
              form={form}
              set={set}
              setForm={setForm}
              config={seed}
              commit={commit}
              onOpenSlideEditor={onOpenSlideEditor}
              syncedDeck={syncedDeck}
              slidesStatus={slidesStatus}
              onForgetSyncedDeck={onForgetSyncedDeck}
              loggedIn={login.loginStatus === 'logged-in'}
            />
          )}
          {tab === 'banners' && (
            <BannersTab form={form} set={set} setForm={setForm} />
          )}
          {tab === 'display' && (
            <DisplayTab form={form} set={set} />
          )}
          {tab === 'calendar' && (
            <CalendarTab form={form} set={set} setForm={setForm} calendar={calendar} />
          )}
        </div>

        <div className="actions">
          <button
            className="ghost"
            onClick={sendTest}
            title="Save, then show a sample welcome banner. This marks the screen ‘demo mode’ (red badge at the top) until it is reloaded."
          >
            Preview a check-in
          </button>
          <button className="ghost" onClick={exportSettings} title="Download this display's settings as a JSON file">
            Export
          </button>
          <button
            className="ghost"
            onClick={() => importRef.current?.click()}
            title="Import a settings JSON exported from another display"
          >
            Import
          </button>
          <input
            ref={importRef}
            type="file"
            accept=".json,application/json"
            hidden
            data-testid="import-settings-file"
            onChange={importSettings}
          />
          {onOpenDebug && (
            <button
              className="ghost"
              onClick={() => { commit(); onOpenDebug(); }}
              title="Save, then simulate check-ins and view connection stats"
            >
              Debug panel
            </button>
          )}
          {onResetTally && (
            <button
              className="ghost"
              onClick={() => { if (window.confirm("Reset tonight's counter to zero? It will re-sync automatically from the print server's next count broadcast.")) onResetTally(); }}
            >
              Reset counter
            </button>
          )}
          <button className="danger" onClick={reset}>Reset to defaults</button>
          <button onClick={requestClose}>Cancel</button>
          <jelly-button variant="mint" onClick={save}>Save</jelly-button>
        </div>
        <div className="hint" style={{ marginTop: '0.6rem', opacity: 0.8 }}>
          Awana® and the Awana club names are trademarks of Awana Clubs International.
          This display is an independent church project — NOT AFFILIATED OR ENDORSED BY
          AWANA CLUBS INTERNATIONAL.
        </div>
      </div>
    </div>
  );
}

// A real <label>: the whole row — title and hint — is the hit target, and
// the checkbox gets an accessible name (getByRole('checkbox', { name })).
function Toggle({ checked, onChange, title, hint, disabled }) {
  const id = useId();
  return (
    <label className="toggle">
      <span className="toggle-copy">
        <span className="toggle-title" id={`${id}-t`}>{title}</span>
        {hint ? <span className="hint" id={`${id}-h`}>{hint}</span> : null}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        aria-labelledby={`${id}-t`}
        aria-describedby={hint ? `${id}-h` : undefined}
      />
    </label>
  );
}

function ConnectionTab({ form, set, status, nameStatus, lastEventAt, secure, displayKey, login }) {
  // The by-hand fields fold away behind the login — unless they are the
  // fix: no Pusher connection, or no secure crypto.
  const [advancedOpen, setAdvancedOpen] = useState(() => status === 'off' || status === 'disconnected' || !secure);

  const realtime = {
    connected: 'connected',
    connecting: 'connecting…',
    disconnected: 'disconnected',
    off: 'not set up — no Pusher App Key',
  }[status] || status;
  const lastSeen = lastEventAt
    ? new Date(lastEventAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : 'none yet this session';

  let loginLine;
  if (login.loginStatus === 'logged-in') {
    loginLine = `logged in${login.kid ? ` (key ${login.kid})` : ''} — display key and publish token filled in automatically`;
  } else if (login.loginStatus === 'stale') {
    loginLine = 'passphrase changed on the print server — log in again below (names keep working meanwhile)';
  } else if (login.loginStatus === 'busy') {
    loginLine = 'checking…';
  } else if (displayKey) {
    loginLine = `not logged in — display key pasted by hand (${maskDisplayKey(displayKey)})`;
  } else {
    loginLine = 'not logged in — no display key on this screen, so names will not appear';
  }

  const namesLine = {
    'no-key': 'encrypted names are arriving but this screen has no key — log in below',
    'bad-key': 'encrypted names are arriving but will not open with this screen’s key — log in again, or paste the current key under Advanced',
    downgraded: 'the print server is sending names unencrypted and this keyed screen refuses them — set the display key on the print server',
  }[nameStatus] ?? (displayKey
    ? 'this screen can read encrypted names'
    : 'no key yet — encrypted names will not open here until you log in');

  return (
    <>
      <div className="hint tab-intro conn-summary" role="status">
        <div><strong>Realtime:</strong> {realtime} · last check-in {lastSeen}</div>
        <div><strong>Display login:</strong> {loginLine}</div>
        {status !== 'off' && <div><strong>Names:</strong> {namesLine}</div>}
      </div>

      <DisplayLoginField status={status} secure={secure} login={login} />

      <details
        className="advanced-fields"
        open={advancedOpen}
        onToggle={(e) => setAdvancedOpen(e.currentTarget.open)}
      >
        <summary>Advanced — paste keys by hand</summary>
        <span className="hint">
          Only needed when this screen cannot log in — no Pusher App Key yet, no print server on this network,
          or a page not served over https. A logged-in screen fills the display key and publish token in by
          itself.
        </span>

        <div className="field">
          <label htmlFor="pkey">Pusher App Key</label>
          <input
            id="pkey" type="text" value={form.pusherAppKey}
            onChange={set('pusherAppKey')}
            placeholder="abcdef1234567890"
          />
          <span className="hint">
            From your Pusher Channels app's <code>App Keys</code> page — the <code>key</code> value (public, safe to ship).
            Must be the <strong>same app</strong> the label print server is configured with — then use its
            dashboard's "Test Welcome Screen" button to verify end-to-end. A site built with the repository
            variables (see the README) has this filled in already.
          </span>
        </div>

        <div className="field">
          <label htmlFor="pcluster">Pusher Cluster</label>
          <input
            id="pcluster" type="text" value={form.pusherCluster}
            onChange={set('pusherCluster')}
            placeholder="us2"
          />
          <span className="hint">
            From the same page (e.g. <code>us2</code>, <code>eu</code>, <code>ap1</code>) — must also match the print server.
          </span>
        </div>

        <DisplayKeyField secure={secure} />
      </details>
    </>
  );
}

/**
 * Display login — the one thing a volunteer types on a new screen. The print
 * server publishes the display key + publish token sealed under a
 * passphrase-derived key; typing the passphrase here opens that frame and
 * fills both secrets in. Like the key and token fields below it, this is
 * deliberately NOT part of `form`/`set`: the derived login key lives in its
 * own storage slot (src/lib/displayLogin.js) so it never rides the settings
 * export, a `?config=` file, or a URL.
 */
function DisplayLoginField({ status, secure, login }) {
  const { frameStatus, loginStatus, kid, pendingLogin } = login;
  const [draft, setDraft] = useState('');
  const [reveal, setReveal] = useState(false);
  const [note, setNote] = useState('');

  const busy = loginStatus === 'busy';
  const canSubmit = secure && !busy && draft.trim().length > 0;

  const submit = async () => {
    const p = draft.trim();
    if (!p || !canSubmit) return;
    setNote('');
    const result = await login.login(p);
    if (result === 'logged-in') { setDraft(''); setNote('Logged in. Names and published slides now work on this screen.'); }
    else if (result === 'storage') setNote('This screen cannot save the keys — browser storage is blocked.');
    // 'wrong', 'no-frame' and 'unsupported' are described by the status line below.
  };

  // In the order a volunteer needs them: the one thing nothing here can fix,
  // then the settled states, then whatever is standing between them and
  // logging in — starting with the socket, because the print server is
  // usually fine and the screen simply is not connected yet.
  let statusCopy;
  if (!secure || loginStatus === 'unsupported') {
    statusCopy = INSECURE_CONTEXT_COPY;
  } else if (loginStatus === 'logged-in') {
    statusCopy = <><strong>Logged in</strong>{kid ? <> · key <code>{kid}</code></> : null} — the display key and publish token were filled in automatically and will follow rotations on the print server.</>;
  } else if (loginStatus === 'stale') {
    statusCopy = <><strong>The display passphrase was changed on the print server.</strong> Names keep working with the key this screen already holds until you log in again.</>;
  } else if (busy) {
    statusCopy = <>Checking… (this takes a few seconds on a small TV stick — it only happens once)</>;
  } else if (status === 'off') {
    statusCopy = <><strong>This screen is not connected to Pusher yet.</strong> Open <em>Advanced</em> below, add the App Key and Cluster from the print-server dashboard (Settings → Pusher Integration) and press Save — then log in here.</>;
  } else if (status === 'disconnected') {
    statusCopy = <><strong>Not connected to Pusher</strong> — check the network, then the App Key and Cluster under <em>Advanced</em>. The print server is probably fine.</>;
  } else if (status === 'connecting') {
    statusCopy = <>Connecting to Pusher… the login frame arrives as soon as the connection is up.</>;
  } else if (loginStatus === 'wrong') {
    statusCopy = <><strong>That passphrase does not match the print server’s.</strong> Check the dashboard → Settings → Display login and try again.</>;
  } else if (pendingLogin) {
    statusCopy = <><strong>Waiting for the print server’s login frame</strong> — this passphrase will be tried automatically the moment it arrives.</>;
  } else if (frameStatus === 'waiting') {
    statusCopy = <>Connected — waiting for the print server’s login frame. It must be running, with a display key <em>and</em> a display passphrase set (dashboard → Settings → Display login). You can type the passphrase now; it is tried as soon as the frame lands.</>;
  } else if (frameStatus === 'miss') {
    statusCopy = <><strong>The print server has not published a login frame in the last 30 minutes.</strong> Start it (or check its Pusher settings), then try again.</>;
  } else {
    statusCopy = <>Type the church’s display passphrase from the print-server dashboard (Settings → Display login). This screen then receives the display key and publish token by itself.</>;
  }

  const loggedIn = loginStatus === 'logged-in';
  return (
    <div className="field">
      {!loggedIn ? (
        <>
          <label htmlFor="dlogin">Display login</label>
          <div className="display-key-row">
            <input
              id="dlogin"
              type={reveal ? 'text' : 'password'}
              autoComplete="off"
              spellCheck={false}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && canSubmit) submit(); }}
              placeholder="display passphrase"
              disabled={!secure || busy}
            />
            <button
              type="button"
              className="ghost"
              aria-pressed={reveal}
              aria-label={reveal ? 'Hide passphrase' : 'Show passphrase'}
              onClick={() => setReveal((v) => !v)}
            >
              {reveal ? 'Hide' : 'Show'}
            </button>
            <button type="button" className="ghost" disabled={!canSubmit} onClick={submit}>Log in</button>
          </div>
        </>
      ) : (
        <>
          <span className="field-label" id="dlogin-label">Display login</span>
          <div className="display-key-row" role="group" aria-labelledby="dlogin-label">
            <code className="display-key-value">logged in{kid ? ` · key ${kid}` : ''}</code>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                if (window.confirm('Log this screen out? It forgets the login key, the display key and the publish token — names and published slides stop here until someone logs in again.')) {
                  login.logout();
                  setNote('');
                }
              }}
            >
              Log out
            </button>
          </div>
        </>
      )}
      <span className="hint">
        {note && <><strong>{note}</strong> </>}
        {statusCopy}
      </span>
    </div>
  );
}

/**
 * The display key — the secret that lets this screen read children's names.
 *
 * Deliberately NOT part of `form`/`set` like every other field on this panel.
 * `form` is the config overrides object, and that object is what
 * `exportSettings()` writes to a downloadable JSON file and what a
 * `?config=<url>` file can populate. Routing the key through it would publish
 * it through two workflows the docs actively recommend. See the long comment in
 * src/lib/displayKey.js; src/lib/displayKey.test.js asserts both stay closed.
 */
function DisplayKeyField({ secure }) {
  const { displayKey, setDisplayKey } = useDisplayKey();
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  const configured = Boolean(displayKey);
  const valid = isPlausibleKey(draft.trim());

  const commit = () => {
    const next = draft.trim();
    if (next && !isPlausibleKey(next)) return;
    const ok = setDisplayKey(next);
    setSaved(ok);
    setEditing(false);
    setDraft('');
    if (!ok) window.alert('This screen cannot save the key — browser storage is blocked, so names will not appear.');
  };

  return (
    <div className="field">
      {editing ? (
        <>
          <label htmlFor="dkey">Display key</label>
          <div className="display-key-row">
            <input
              id="dkey"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (valid || !draft.trim())) commit(); }}
              placeholder="paste the 44-character key"
            />
            <button type="button" className="ghost" disabled={!valid} onClick={commit}>Save</button>
            <button type="button" className="ghost" onClick={() => { setEditing(false); setDraft(''); }}>Cancel</button>
          </div>
        </>
      ) : (
        <>
          <span className="field-label" id="dkey-label">Display key</span>
          <div className="display-key-row" role="group" aria-labelledby="dkey-label">
            <code className="display-key-value">
              {configured ? maskDisplayKey(displayKey) : (secure ? 'not set — names will not appear' : 'not set')}
            </code>
            {secure && (
              <button type="button" className="ghost" onClick={() => { setEditing(true); setSaved(false); }}>
                {configured ? 'Replace' : 'Paste key'}
              </button>
            )}
            {configured && (
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  if (window.confirm('Remove the display key from THIS screen? Names will stop appearing here until you paste it again.')) {
                    setDisplayKey('');
                  }
                }}
              >
                Remove
              </button>
            )}
          </div>
        </>
      )}
      <span className="hint">
        {!secure && <>{INSECURE_CONTEXT_COPY} </>}
        {editing && draft.trim() && !valid && (
          <><strong>That does not look like a display key.</strong> It should be 44 characters ending in <code>=</code>. </>
        )}
        {saved && <><strong>Saved.</strong> Press <em>Night Test</em> on the print-server dashboard to confirm. </>}
        Children&apos;s names travel <strong>encrypted</strong>, because the realtime channel itself is public.
        Normally filled in by Display login above. To do it by hand: generate the key once on the print-server
        dashboard (its front page says whether names are encrypted; the button there opens
        <code>Settings → Realtime privacy</code>) and paste the same value into every screen. Without it the
        clock, weather, counts and slides all still work — only the welcome banners stop.
        {' '}<strong>Never</strong> email it, put it in a URL, or include it in a settings export — it is the one
        secret here that is worth something.
      </span>
    </div>
  );
}

function BackgroundTab({
  form, set, setForm, config, commit, onOpenSlideEditor, syncedDeck, slidesStatus, onForgetSyncedDeck, loggedIn,
}) {
  const n = config.manualSlides?.length || 0;
  const typedLine = form.backgroundSource === 'manual'
    ? (n === 0
      ? 'No slides typed yet — the calendar slides (if enabled) play on their own until you add some.'
      : `${n} slide${n === 1 ? '' : 's'} saved on this device.`)
    : (n === 0
      ? 'No typed slides on this device yet. Typed slides (and any published deck) only show while Background source is Typed slides.'
      : `${n} typed slide${n === 1 ? '' : 's'} saved on this device — shown only while Background source is Typed slides.`);

  return (
    <>
      <div className="field">
        <label>Background source</label>
        <div className="radio-row">
          {Object.entries(SOURCE_LABELS).map(([value, label]) => (
            <label className="radio-option" key={value}>
              <input
                type="radio"
                name="backgroundSource"
                value={value}
                checked={form.backgroundSource === value}
                onChange={set('backgroundSource')}
              />
              {label}
            </label>
          ))}
        </div>
        <span className="hint">
          Typed slides are free-typed right here in the app — no PowerPoint needed — and get
          the joyful catalog look automatically. Publish them from the check-in computer and every
          screen shows the same deck; each screen can also add local video files (kept on that
          device), and the calendar slides join the rotation.
        </span>
      </div>

      {/* Reachable from every source, and it saves first: the "Typed slides"
          radio the volunteer just clicked used to be discarded on the way to
          the editor, so they typed a deck and the screen kept its placeholder. */}
      <div className="field">
        <span className="hint">{typedLine}</span>
        <button
          type="button"
          className="ghost"
          style={{ alignSelf: 'flex-start' }}
          onClick={() => { commit(); onOpenSlideEditor(); }}
        >
          Edit slides… (Ctrl+Shift+E)
        </button>
      </div>

      <SlideSyncSection
        form={form}
        set={set}
        backgroundSource={form.backgroundSource}
        onUseTypedSlides={() => setForm((f) => ({ ...f, backgroundSource: 'manual' }))}
        syncedDeck={syncedDeck}
        slidesStatus={slidesStatus}
        onForgetSyncedDeck={onForgetSyncedDeck}
        loggedIn={loggedIn}
      />

      {form.backgroundSource === 'pptx' && <PptxUploadField />}

      {form.backgroundSource === 'video' && <VideoUploadField />}

      {(form.backgroundSource === 'powerpoint' || form.backgroundSource === 'pptx') && (
        <div className="field">
          <label htmlFor="iframe">
            {form.backgroundSource === 'pptx'
              ? 'OneDrive PowerPoint embed URL (fallback if the uploaded deck cannot render)'
              : 'OneDrive PowerPoint embed URL'}
          </label>
          <input
            id="iframe" type="url" value={form.powerpointEmbedUrl}
            onChange={set('powerpointEmbedUrl')}
            placeholder="https://onedrive.live.com/embed?…"
          />
          <span className="hint">
            In OneDrive, open your <code>.pptx</code> → File → Share → Embed, then paste the
            URL from the <code>&lt;iframe src="…"&gt;</code> snippet here.
          </span>
        </div>
      )}

      {form.backgroundSource !== 'video' && (
        <div className="field">
          <label htmlFor="slideDelay">Slide auto-advance (seconds)</label>
          <input
            id="slideDelay" type="number" min="0" max="120" step="1"
            value={form.slideshowDelaySec}
            onChange={set('slideshowDelaySec')}
          />
          <span className="hint">
            How long each slide stays on screen — for typed slides too, unless a slide sets its
            own time. 0 = let the PowerPoint file control its own timing (typed slides fall back
            to 8 seconds).
          </span>
        </div>
      )}
    </>
  );
}


/**
 * Slide sync — the per-display view of the PUBLISHED deck: whether this screen
 * follows it, what it last received, why it might not be receiving, and the
 * recovery lever. Rendered on every background source, because a published
 * deck that this screen is set to ignore is exactly the thing the operator
 * needs told. The publish side (token + button) lives with the editor on
 * whichever machine does the editing; this section carries the token field so
 * that machine has somewhere to paste it.
 */
function SlideSyncSection({
  form, set, backgroundSource, onUseTypedSlides, syncedDeck, slidesStatus, onForgetSyncedDeck, loggedIn,
}) {
  const hasKey = Boolean(loadDisplayKey()) || loggedIn;
  const following = form.followPublishedSlides !== false;
  // Snapshot at open — the age line doesn't need to tick live.
  const [nowAt] = useState(() => Date.now());

  let statusLine;
  if (syncedDeck) {
    const when = new Date(syncedDeck.publishedAt);
    const mins = Math.max(0, Math.round((nowAt - syncedDeck.publishedAt) / 60000));
    const age = mins < 1 ? 'just now' : mins < 60 ? `${mins} min ago` : `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
    statusLine = `Received rev ${syncedDeck.deckRev} — ${syncedDeck.slides.length} slide${syncedDeck.slides.length === 1 ? '' : 's'}, published ${when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} (${age}).`;
  } else {
    statusLine = 'Never received a published deck on this screen.';
  }

  // Why frames might not be opening — worded by fix, not by mechanism, and
  // leading with the login (pasting the key by hand is the fallback).
  let hintLine = null;
  if (following && !hasKey) {
    hintLine = 'This screen is not logged in, so it cannot read published decks — type the church’s display passphrase under Connection → Display login (or paste the display key by hand under Connection → Advanced).';
  } else if (slidesStatus === 'bad-key') {
    hintLine = 'Published decks are arriving but will not open with this screen’s key — log in again under Connection → Display login to pick up the current key (or re-paste it under Advanced).';
  } else if (slidesStatus === 'no-key') {
    hintLine = 'Published decks are arriving but this screen has no usable key — log in under Connection → Display login.';
  } else if (slidesStatus === 'refused-plaintext') {
    hintLine = 'The print server is publishing slides UNENCRYPTED (no display key set there); this keyed screen refuses them. Set the display key on the print server.';
  }

  const ignored = syncedDeck && backgroundSource !== 'manual';

  return (
    <div className="field">
      {ignored && (
        <div className="notice-warn" role="status">
          A published deck has arrived (rev {syncedDeck.deckRev}, {syncedDeck.slides.length} slide
          {syncedDeck.slides.length === 1 ? '' : 's'}) but this screen is set to{' '}
          {SOURCE_LABELS[backgroundSource] || backgroundSource}, so it is not showing.{' '}
          <button type="button" className="ghost small" onClick={onUseTypedSlides}>Use Typed slides</button>
          {' '}<span className="hint">then press Save.</span>
        </div>
      )}
      <Toggle
        checked={following}
        onChange={set('followPublishedSlides')}
        title="Follow published slides"
        hint="Show the deck published from the print server / check-in machine instead of this device’s own typed slides. Video slides saved on this device still play alongside it (their files only exist here). The editor still works — publishing from it updates every screen."
      />
      <span className="hint">
        {statusLine}
        {hintLine && <> <strong>{hintLine}</strong></>}
      </span>
      {syncedDeck && (
        <button
          type="button"
          className="ghost"
          style={{ alignSelf: 'flex-start' }}
          onClick={() => {
            if (window.confirm('Forget the received deck on THIS screen? It falls back to its locally saved slides until the next publish arrives.')) {
              onForgetSyncedDeck?.();
            }
          }}
        >
          Forget received deck
        </button>
      )}
      <PublishTokenField />
    </div>
  );
}

/**
 * The publish token — the credential the print server requires before THIS
 * machine's slide editor may publish to every screen. Deliberately NOT part of
 * `form`/`set`, for exactly the reasons the display key is not: `form` backs
 * the settings export and the ?config= merge, and a credential must ride
 * neither. See src/lib/publishToken.js; publishToken.test.js pins the paths.
 */
function PublishTokenField() {
  const [token, setToken] = useState(loadPublishToken);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);

  const commit = () => {
    const next = draft.trim();
    const ok = savePublishToken(next);
    if (ok) setToken(next);
    else window.alert('This machine cannot save the token — browser storage is blocked.');
    setEditing(false);
    setDraft('');
  };

  return (
    <div className="field" style={{ marginTop: '0.5rem' }}>
      {editing ? (
        <>
          <label htmlFor="ptoken">Publish token</label>
          <div className="display-key-row">
            <input
              id="ptoken"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
              placeholder="paste the token from the printer dashboard"
            />
            <button type="button" className="ghost" disabled={!draft.trim()} onClick={commit}>Save</button>
            <button type="button" className="ghost" onClick={() => { setEditing(false); setDraft(''); }}>Cancel</button>
          </div>
        </>
      ) : (
        <>
          <span className="field-label" id="ptoken-label">Publish token</span>
          <div className="display-key-row" role="group" aria-labelledby="ptoken-label">
            <code className="display-key-value">
              {token ? maskPublishToken(token) : 'not set — the Publish button will explain how to get one'}
            </code>
            <button type="button" className="ghost" onClick={() => setEditing(true)}>
              {token ? 'Replace' : 'Paste token'}
            </button>
            {token && (
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  if (window.confirm('Remove the publish token from this machine? Its Publish button will stop working; other screens are unaffected.')) {
                    savePublishToken('');
                    setToken('');
                  }
                }}
              >
                Remove
              </button>
            )}
          </div>
        </>
      )}
      <span className="hint">
        Only needed on the machine that edits slides, and filled in automatically on a logged-in screen.
        By hand: print-server dashboard → <strong>Lobby Slides</strong> → Generate. It stays on this machine —
        never in a settings export, a <code>?config=</code> file, or a URL.
      </span>
    </div>
  );
}

function BannersTab({ form, set, setForm }) {
  return (
    <>
      <div className="field">
        <label htmlFor="std">Standard banner duration (ms)</label>
        <input
          id="std" type="number" min="2000" max="20000" step="500"
          value={form.standardDisplayMs}
          onChange={set('standardDisplayMs')}
        />
        <span className="hint">
          During a big rush the display automatically shortens banners so the line never backs up.
        </span>
      </div>

      <div className="field">
        <label htmlFor="special">Birthday / first-timer banner duration (ms)</label>
        <input
          id="special" type="number" min="3000" max="25000" step="500"
          value={form.specialDisplayMs}
          onChange={set('specialDisplayMs')}
        />
        <span className="hint">
          The extra-celebratory banners hold a little longer than standard ones.
        </span>
      </div>

      <div className="field">
        <label htmlFor="burstFloor">Rush-mode minimum banner time (ms)</label>
        <input
          id="burstFloor" type="number" min="1000" max="10000" step="250"
          value={form.burstFloorMs}
          onChange={set('burstFloorMs')}
        />
        <span className="hint">
          During a check-in rush banners shrink to keep up with the door — but never below this.
          Lower drains a backlog faster; higher keeps every name readable longer.
        </span>
      </div>

      <Toggle
        checked={!form.audioMuted}
        onChange={(e) => setForm((f) => ({ ...f, audioMuted: !e.target.checked }))}
        title="Sound on"
        hint="Play a short chime alongside each welcome animation."
      />

      <h3 className="section">Celebrations</h3>

      <div className="field">
        <label htmlFor="confettiLevel">Confetti intensity</label>
        <select id="confettiLevel" value={form.confettiLevel} onChange={set('confettiLevel')}>
          <option value="full">Full celebration</option>
          <option value="reduced">Reduced (half the particles)</option>
          <option value="off">Off (banners and chimes only)</option>
        </select>
        <span className="hint">
          Room-wide setting for every burst — welcomes, birthdays, milestones. "Reduced" helps
          weak signage sticks keep 60fps on busy nights.
        </span>
      </div>

      <div className="field">
        <label htmlFor="milestone">Milestone celebration (every N check-ins)</label>
        <input
          id="milestone" type="number" min="0" max="10000" step="5"
          value={form.milestoneEvery}
          onChange={set('milestoneEvery')}
        />
        <span className="hint">
          {form.milestoneEvery > 0
            ? <>Every {form.milestoneEvery} check-ins, a room-wide confetti moment with a &ldquo;{form.milestoneEvery} kids checked in tonight!&rdquo; toast.</>
            : <>Milestone celebrations are off. Set a number (25 is typical) to turn them on.</>}
        </span>
      </div>

      <div className="field">
        <label htmlFor="clubMilestone">Club milestone celebration (every N per club)</label>
        <input
          id="clubMilestone" type="number" min="0" max="1000" step="5"
          value={form.clubMilestoneEvery}
          onChange={set('clubMilestoneEvery')}
        />
        <span className="hint">
          Uses the printer's live per-club counts — "Sparks 20 kids strong!". 0 turns it off.
        </span>
      </div>

      <h3 className="section">Club phrases</h3>
      <span className="hint" style={{ display: 'block', marginBottom: '0.75rem' }}>
        A short line under the child’s name on their welcome banner, one per club. Leave a club blank for no
        line. Up to 80 characters.
      </span>
      {getAllClubs().map((name) => {
        const key = name.toLowerCase();
        const id = `phrase-${key.replace(/[^a-z0-9]/g, '-')}`;
        return (
          <div className="field" key={key}>
            <label htmlFor={id}>{name} phrase</label>
            <input
              id={id}
              type="text"
              maxLength={80}
              value={form.clubPhrases[key] || ''}
              onChange={(e) => setForm((f) => ({ ...f, clubPhrases: { ...f.clubPhrases, [key]: e.target.value } }))}
              placeholder="Shine bright tonight!"
            />
          </div>
        );
      })}
    </>
  );
}

function DisplayTab({ form, set }) {
  const cycleMode = form.widgetDisplayMode !== 'stickers';
  const boardOn = form.checkoutBoardMode !== 'off';
  return (
    <>
      <h3 className="section">Corner widgets</h3>

      <div className="field">
        <label>Corner widgets</label>
        <div className="radio-row">
          <label className="radio-option">
            <input
              type="radio"
              name="widgetDisplayMode"
              value="cycle"
              checked={cycleMode}
              onChange={set('widgetDisplayMode')}
            />
            Animated cycle (recommended)
          </label>
          <label className="radio-option">
            <input
              type="radio"
              name="widgetDisplayMode"
              value="stickers"
              checked={!cycleMode}
              onChange={set('widgetDisplayMode')}
            />
            Classic corner stickers
          </label>
        </div>
        <span className="hint">
          The animated cycle shows one big data point at a time in the bottom-right corner —
          time, tonight's tally and the weather — each tumbling in and out playfully. Classic
          stickers pin them to the corners all at once.
        </span>
      </div>

      {cycleMode && (
        <div className="field">
          <label htmlFor="cycleInterval">Seconds per item</label>
          <input
            id="cycleInterval" type="number" min="2" max="120" step="1"
            value={form.cycleIntervalSec}
            onChange={set('cycleIntervalSec')}
          />
          <span className="hint">
            How long each data point holds the corner before the next one takes over.
          </span>
        </div>
      )}

      <Toggle
        checked={form.showTally}
        onChange={set('showTally')}
        title="Tonight's check-in counter"
        hint='A "checked in tonight" tally — joins the cycle, or sits top-left as a sticker. Counts only a number, resets daily.'
      />

      <Toggle
        checked={form.showClock}
        onChange={set('showClock')}
        title="Wall clock"
        hint="The current time of day — joins the cycle, or sits top-right as a sticker."
      />

      <Toggle
        checked={form.showConnectionStatus}
        onChange={set('showConnectionStatus')}
        title="Show connection status dot"
        hint="Tiny corner indicator. Even when off, it appears by itself if the connection drops or the screen is not set up."
      />

      <h3 className="section">Who&apos;s still here</h3>

      <div className="field">
        <label htmlFor="cbmode">Who&apos;s still here board</label>
        <select id="cbmode" value={form.checkoutBoardMode} onChange={set('checkoutBoardMode')}>
          <option value="off">Off</option>
          <option value="pickup">Only during pickup</option>
          <option value="always">Whenever data is arriving</option>
        </select>
        <span className="hint">
          Lists children who have <strong>not been checked out yet</strong> in the check-in system,
          so a volunteer can see at a glance who is still waiting. Needs the print server and a
          volunteer with the check-in page open — when that tab closes, the board shows its age
          instead of freezing.
          {' '}<strong>It is not a verified headcount:</strong> it reflects whether checkout was
          actually recorded, which during a busy pickup often lags. Treat it as a prompt to go
          look, never as proof the building is clear.
        </span>
      </div>

      {boardOn && (
        <>
          <div className="field">
            <label htmlFor="cbnames">Stop showing names at or below</label>
            <input
              id="cbnames" type="number" min="0" max="200"
              value={form.checkoutBoardNamesAbove}
              onChange={set('checkoutBoardNamesAbove')}
            />
            <span className="hint">
              At or below this many children, the board hides the names and shows
              &ldquo;almost everyone has been picked up&rdquo; instead.
              {' '}<strong>This is the setting that matters.</strong> A long list is anonymous —
              one name among forty tells a passer-by nothing. A list of two names, late in the
              evening, points at two specific children who are not yet with a parent. 0 turns the
              guard off entirely, which is not recommended on a public screen.
            </span>
          </div>

          <div className="field">
            <label htmlFor="cbstale">Treat the list as stale after (minutes)</label>
            <input
              id="cbstale" type="number" min="1" max="120"
              value={form.checkoutBoardStaleMin}
              onChange={set('checkoutBoardStaleMin')}
            />
            <span className="hint">
              After this long with no update the board says so, rather than showing a frozen list
              that still looks live.
            </span>
          </div>
        </>
      )}

      <h3 className="section">Look &amp; atmosphere</h3>

      <div className="field">
        <label htmlFor="nightTheme">Themed night skin</label>
        <select id="nightTheme" value={form.nightTheme} onChange={set('nightTheme')}>
          <option value="none">None (classic)</option>
          {/* Generated from SKIN_TABLE so a new season needs one edit, not five. */}
          {skinOptions().filter((o) => o.value !== 'none').map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <span className="hint">
          Dresses the stage for the season. Banners always keep their club colors.
          Auto reads tonight&apos;s calendar title (Easter, VBS, Thanksgiving&hellip;) and
          falls back to the month.
        </span>
      </div>

      <Toggle
        checked={form.followPrinterTheme === true}
        onChange={set('followPrinterTheme')}
        title="Follow the printer's season"
        hint="When the label printer broadcasts its season theme, this screen wears the matching skin so labels and screens switch together. Only applies while the skin above is set to Auto; picking a skin by hand always wins."
      />

      <div className="field">
        <label htmlFor="particleEffect">Ambient particles</label>
        <select id="particleEffect" value={form.particleEffect} onChange={set('particleEffect')}>
          <option value="auto">Auto — match the weather</option>
          <option value="off">Off</option>
          <option value="snow">Snow</option>
          <option value="rain">Rain</option>
          <option value="sparkle">Sparkles</option>
        </select>
        <span className="hint">
          A gentle full-screen effect behind the corner widgets. Auto (the
          default) mirrors the sky outside — snowfall when it&rsquo;s snowing, rain
          when it&rsquo;s raining — and needs a weather location (Calendar &amp;
          Weather). Or force one: snowfall for a Christmas party night,
          sparkles for awards night. Pauses automatically under reduce-motion
          and panic mode.
        </span>
      </div>

      <Toggle
        checked={form.weatherTheme === true}
        onChange={set('weatherTheme')}
        title="Let the weather set the mood"
        hint="A rainy or snowy night cools and dims the background scene. The season still picks the colors, so a chosen skin never disappears in bad weather. Needs a weather location set under Calendar & Weather."
      />

      <h3 className="section">Screen</h3>

      <Toggle
        checked={form.keepScreenAwake}
        onChange={set('keepScreenAwake')}
        title="Keep screen awake"
        hint="Ask the browser to stop the TV/monitor from sleeping while the display is open."
      />

      <Toggle
        checked={form.reduceMotion}
        onChange={set('reduceMotion')}
        title="Reduce motion on this screen"
        hint="Freezes every animation on this screen — banners still appear, just instantly. For weak TV sticks, or when the movement is distracting."
      />

      <Toggle
        checked={form.aprilFools === true}
        onChange={set('aprilFools')}
        title="April Fools: flip this screen upside down"
        hint="Only does anything on April 1st — every other day it's a plain, boring toggle. Labels and the printer stay serious, and this settings panel (plus its gear) stays right-side up so you can always turn it off."
      />

      <Toggle
        checked={form.panicMode}
        onChange={set('panicMode')}
        title="Simplified mode (panic switch)"
        hint="Strips the screen to a placeholder background and the clock while banners keep working. Also toggles live with Ctrl+Shift+X."
      />
    </>
  );
}

// Live summary of what the calendar logic resolves to right now, so a
// leader can sanity-check the feed without waiting for club night.
function calendarPreview(calendar) {
  if (!calendar) return null;
  const { events, source, generatedAt } = calendar;
  if (!events?.length) {
    return source === 'none' ? null : 'No calendar data loaded yet.';
  }
  const info = deriveClubInfo(events, localDateStr());
  const parts = [`${events.length} events loaded`];
  if (source === 'feed' && generatedAt) {
    const days = Math.max(0, Math.round((Date.now() - Date.parse(generatedAt)) / 86400000));
    parts[0] += days === 0 ? ' (updated today)' : ` (updated ${days}d ago)`;
  } else if (source === 'proxy') {
    parts[0] += ' (live fetch)';
  } else if (source === 'cache') {
    parts[0] += ' (offline cache)';
  }
  if (info.tonight) {
    parts.push(`Tonight: ${splitTitle(info.tonight.title).title}`);
  } else if (info.nextNight) {
    const masked = !info.nextNight.isSpecial || isStoreNight(info.nextNight.title);
    const when = formatShortDate(info.nextNight.date);
    parts.push(`Next night: ${masked ? when : `${splitTitle(info.nextNight.title).title} (${when})`}`);
  }
  parts.push(`${info.nightsRemaining} night${info.nightsRemaining === 1 ? '' : 's'} left after tonight`);
  return parts.join(' · ');
}

function CalendarTab({ form, set, setForm, calendar }) {
  const [lookup, setLookup] = useState({ state: 'idle', message: '' });

  const lookUpLocation = async () => {
    setLookup({ state: 'busy', message: 'Looking up…' });
    const hit = await geocodeLocation(form.weatherLocationName);
    if (hit) {
      setForm((f) => ({ ...f, weatherLocationName: hit.name, weatherLat: hit.lat, weatherLon: hit.lon }));
      setLookup({ state: 'done', message: `Found: ${hit.name} (${hit.lat.toFixed(2)}, ${hit.lon.toFixed(2)})` });
    } else {
      setLookup({ state: 'error', message: 'No match found — try "Town, State".' });
    }
  };

  const preview = calendarPreview(calendar);

  return (
    <>
      <Toggle
        checked={form.calendarEnabled}
        onChange={set('calendarEnabled')}
        title="Calendar-aware slides"
        hint='Auto-generate "Welcome to…", "Next week…", and nights-remaining slides from the church calendar. They join the typed-slides rotation.'
      />

      {preview && form.calendarEnabled ? (
        <div className="calendar-preview">
          <span>{preview}</span>
          {calendar?.refresh ? (
            <button type="button" className="ghost small" onClick={() => calendar.refresh()}>
              Refresh now
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="field" style={{ marginTop: '1rem' }}>
        <label htmlFor="calurl">Calendar page URL</label>
        <input
          id="calurl" type="url" value={form.calendarUrl}
          onChange={set('calendarUrl')}
          placeholder="https://yourchurch.twotimtwo.com/calendar/index"
        />
        <span className="hint">
          The public club calendar (twotimtwo format). A nightly GitHub Action turns it into a
          data file the display reads; if that file goes stale the display tries a direct
          fetch of this URL (usually blocked by the browser) and then its last good copy.
        </span>
      </div>

      <div className="field">
        <label htmlFor="calwelcome">Welcome wording (regular nights)</label>
        <input
          id="calwelcome" type="text" maxLength="80" value={form.calendarWelcomeText}
          onChange={set('calendarWelcomeText')}
          placeholder="Welcome to Awana!"
        />
        <span className="hint">
          Special nights use their calendar title instead — "Welcome to Water Night!".
        </span>
      </div>

      <Toggle checked={form.calendarShowWelcome} onChange={set('calendarShowWelcome')}
        title="Welcome slide" hint="Tonight's greeting — or a pointer to the next club night." />
      <Toggle checked={form.calendarShowNextWeek} onChange={set('calendarShowNextWeek')}
        title="Next-week slide" hint='"Next week…!" announcements and break-week notices.' />
      <Toggle checked={form.calendarShowRemaining} onChange={set('calendarShowRemaining')}
        title="Nights-remaining slide" hint="A countdown nudge once fewer than 10 club nights remain." />
      <Toggle checked={form.showWeatherChip} onChange={set('showWeatherChip')}
        title="Corner weather" hint="Animated temperature with a living doodle of the sky — joins the cycle, or sits top-right as a sticker. Updates every 15 minutes; works over any background." />

      <div className="field" style={{ marginTop: '1rem' }}>
        <label htmlFor="wloc">Weather location</label>
        <div className="lookup-row">
          <input
            id="wloc" type="text" value={form.weatherLocationName}
            onChange={set('weatherLocationName')}
            placeholder="Waterville, Maine"
          />
          <button
            type="button"
            className="ghost"
            onClick={lookUpLocation}
            disabled={lookup.state === 'busy'}
          >
            Look up
          </button>
        </div>
        {lookup.message ? (
          <span className={`hint lookup-${lookup.state}`}>{lookup.message}</span>
        ) : (
          <span className="hint">
            Type a town and press <strong>Look up</strong> to fill the coordinates
            (currently {Number(form.weatherLat).toFixed(2)}, {Number(form.weatherLon).toFixed(2)}).
          </span>
        )}
      </div>

      <div className="field">
        <label htmlFor="wunits">Temperature units</label>
        <select id="wunits" value={form.weatherUnits} onChange={set('weatherUnits')}>
          <option value="fahrenheit">Fahrenheit (°F)</option>
          <option value="celsius">Celsius (°C)</option>
        </select>
      </div>
    </>
  );
}

function PptxUploadField() {
  const [stored, setStored] = useState(null);
  const [busy, setBusy] = useState(false);
  // Inline status line (replaces window.alert): { tone, text }.
  const [status, setStatus] = useState(null);
  useEffect(() => {
    let live = true;
    getDeck().then((d) => { if (live) setStored(d); });
    return () => { live = false; };
  }, []);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setStatus({ tone: 'info', text: 'Reading deck…' });

    const ok = await putDeck(file, file.name);
    if (!ok) {
      setBusy(false);
      setStatus({ tone: 'warn', text: 'Could not save the deck on this device (storage blocked or full).' });
      e.target.value = '';
      return;
    }
    // Re-read so the model cache is keyed to the real stored savedAt.
    const deck = await getDeck();
    setStored(deck || { blob: file, name: file.name, savedAt: Date.now() });

    try {
      const model = await parseAndCacheDeck(file, deck?.savedAt);
      const broken = model.slides.filter((s) => s.error).length;
      const ready = model.slides.length - broken;
      setStatus({
        tone: 'ok',
        text: `Saved: ${file.name} — ${ready} slide${ready === 1 ? '' : 's'} ready`
          + (broken
            ? ` · ${broken} slide${broken === 1 ? ' has' : 's have'} unsupported content and will show the placeholder`
            : ''),
      });
    } catch (err) {
      console.warn('pptx: uploaded deck failed to parse:', err);
      setStatus({
        tone: 'warn',
        text: `Saved ${file.name}, but it couldn't be read as a presentation — the display will fall back to the embed URL or placeholder.`,
      });
    }
    setBusy(false);
    e.target.value = '';
  };

  const remove = async () => {
    if (!window.confirm(`Remove ${stored?.name || 'the uploaded deck'} from this device? The file is not stored anywhere else — you would need the original .pptx to upload it again.`)) return;
    await deleteDeck();
    setStored(null);
    setStatus(null);
  };

  return (
    <div className="field">
      <label htmlFor="pptx-upload">Upload a .pptx</label>
      <input id="pptx-upload" type="file" accept=".pptx" onChange={onFile} disabled={busy} />
      {status && (
        <span
          className="hint"
          role="status"
          style={status.tone === 'warn' ? { color: '#ff8a80' } : undefined}
        >
          {status.text}
        </span>
      )}
      <span className="hint">
        {stored
          ? `Saved on this device: ${stored.name || 'presentation.pptx'} — it renders locally, no iframe.`
          : 'The deck is stored on this device only (never uploaded). '}
        Rendering covers backgrounds, text, pictures and solid/gradient shapes (with rotation
        and per-slide timings); animations, SmartArt, charts and tables are not rendered, and
        fonts substitute to the system stack. If the deck cannot render, the OneDrive embed
        URL below is the automatic fallback.
      </span>
      {stored && (
        <button type="button" className="ghost" style={{ alignSelf: 'flex-start' }} onClick={remove}>
          Remove uploaded deck
        </button>
      )}
    </div>
  );
}

// One background video, stored in this browser's IndexedDB under the single
// well-known slot (#25) — mirrors PptxUploadField's one-deck model. The file
// never leaves this device; exported settings carry only the source choice.
function VideoUploadField() {
  const [stored, setStored] = useState(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  useEffect(() => {
    let live = true;
    getVideo(BACKGROUND_VIDEO_ID).then((blob) => { if (live) setStored(blob); });
    return () => { live = false; };
  }, []);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setStatus({ tone: 'info', text: 'Storing video…' });
    try {
      // A File survives IndexedDB structured clone with .name/.size intact,
      // so the slot needs no side-channel metadata.
      await putVideo(BACKGROUND_VIDEO_ID, file);
      setStored(file);
      setStatus({ tone: 'ok', text: `Saved: ${file.name} — it plays full-screen on a loop, muted.` });
      // Tell a mounted background to re-read the slot — see VideoBackground.
      window.dispatchEvent(new Event(BACKGROUND_VIDEO_CHANGED_EVENT));
    } catch {
      setStatus({ tone: 'warn', text: 'Could not save the video on this device (storage blocked or full).' });
    }
    setBusy(false);
    e.target.value = '';
  };

  const remove = async () => {
    if (!window.confirm(`Remove ${stored?.name || 'the video'} from this device? The file is not stored anywhere else — you would need the original to upload it again.`)) return;
    await deleteVideo(BACKGROUND_VIDEO_ID);
    setStored(null);
    setStatus(null);
    window.dispatchEvent(new Event(BACKGROUND_VIDEO_CHANGED_EVENT));
  };

  return (
    <div className="field">
      <label htmlFor="video-upload">Upload a video</label>
      <input id="video-upload" type="file" accept="video/*" onChange={onFile} disabled={busy} />
      {status && (
        <span
          className="hint"
          role="status"
          style={status.tone === 'warn' ? { color: '#ff8a80' } : undefined}
        >
          {status.text}
        </span>
      )}
      <span className="hint">
        {stored
          ? `Saved on this device: ${stored.name || 'video'}`
            + (stored.size > 0 ? ` · ${(stored.size / 1e6).toFixed(1)} MB` : '')
            + '. '
          : 'The video is stored on this device only (never uploaded). '}
        It plays muted on an endless loop behind the banners — MP4 (H.264) is the safest
        format for kiosk hardware. If the video is missing or cannot play, the friendly
        welcome scene shows instead, so the screen is never black.
      </span>
      {stored && (
        <button type="button" className="ghost" style={{ alignSelf: 'flex-start' }} onClick={remove}>
          Remove video
        </button>
      )}
    </div>
  );
}
