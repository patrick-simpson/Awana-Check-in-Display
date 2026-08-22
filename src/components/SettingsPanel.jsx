import { useEffect, useRef, useState } from 'react';
import { deleteDeck, getDeck, putDeck } from '../lib/pptxStore.js';
import { BACKGROUND_VIDEO_ID, deleteVideo, getVideo, putVideo } from '../lib/videoStore.js';
import { BACKGROUND_VIDEO_CHANGED_EVENT } from './VideoBackground.jsx';
import { parseAndCacheDeck } from '../lib/pptxModel.js';
import { geocodeLocation } from '../lib/weather.js';
import { deriveClubInfo, formatShortDate, isStoreNight, localDateStr, splitTitle } from '../lib/calendarLogic.js';
import { SAMPLE_NAMES, pick } from '../lib/demoNames.js';
import { NIGHT_THEME_VALUES, skinOptions } from '../lib/skins.js';
import { useDisplayKey } from '../hooks/useDisplayKey.js';
import { maskDisplayKey } from '../lib/displayKey.js';
import { isPlausibleKey } from '../lib/envelope.js';

const TABS = [
  { id: 'connection', label: 'Connection' },
  { id: 'background', label: 'Background' },
  { id: 'banners', label: 'Banners' },
  { id: 'display', label: 'Display' },
  { id: 'calendar', label: 'Calendar & Weather' },
];

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export default function SettingsPanel({
  config, overrides, status, lastEventAt, calendar, phase, scheduleSource, opsFailures,
  remoteConfigError, wakeLockStatus,
  onChange, onReset, onClose, onTest, onResetTally, onOpenSlideEditor, onOpenDebug,
}) {
  const [form, setForm] = useState({
    pusherAppKey: config.pusherAppKey || '',
    pusherCluster: config.pusherCluster || 'us2',
    backgroundSource: ['manual', 'pptx', 'video'].includes(config.backgroundSource) ? config.backgroundSource : 'powerpoint',
    powerpointEmbedUrl: config.powerpointEmbedUrl || '',
    slideshowDelaySec: config.slideshowDelaySec ?? 5,
    countdownTargetTime: config.countdownTargetTime || '',
    standardDisplayMs: config.standardDisplayMs ?? 6000,
    specialDisplayMs: config.specialDisplayMs ?? 8000,
    audioMuted: !!config.audioMuted,
    showConnectionStatus: !!config.showConnectionStatus,
    showTally: config.showTally !== false,
    keepScreenAwake: config.keepScreenAwake !== false,
    panicMode: !!config.panicMode,
    showClock: !!config.showClock,
    widgetDisplayMode: config.widgetDisplayMode === 'stickers' ? 'stickers' : 'cycle',
    // Reads the one skin table. When this repeated the ids by hand, a saved
    // skin the list had never heard of (thanksgiving, easter, vbs) was silently
    // reset to 'none' the moment Settings was opened.
    nightTheme: NIGHT_THEME_VALUES.includes(config.nightTheme) ? config.nightTheme : 'none',
    followPrinterTheme: config.followPrinterTheme !== false,
    mascotMoments: config.mascotMoments !== false,
    aprilFools: config.aprilFools === true,
    particleEffect: ['auto', 'snow', 'rain', 'sparkle', 'off'].includes(config.particleEffect)
      ? config.particleEffect
      : 'auto',
    weatherTheme: config.weatherTheme === true,
    confettiLevel: ['reduced', 'off'].includes(config.confettiLevel) ? config.confettiLevel : 'full',
    burstFloorMs: config.burstFloorMs ?? 2500,
    clubMilestoneEvery: config.clubMilestoneEvery ?? 10,
    checkoutBoardMode: ['pickup', 'always'].includes(config.checkoutBoardMode) ? config.checkoutBoardMode : 'off',
    checkoutBoardNamesAbove: config.checkoutBoardNamesAbove ?? 3,
    checkoutBoardStaleMin: config.checkoutBoardStaleMin ?? 8,
    cycleIntervalSec: config.cycleIntervalSec ?? 3,
    milestoneEvery: config.milestoneEvery ?? 25,
    calendarEnabled: config.calendarEnabled !== false,
    calendarUrl: config.calendarUrl || '',
    calendarWelcomeText: config.calendarWelcomeText || 'Welcome to Awana!',
    calendarShowWelcome: config.calendarShowWelcome !== false,
    calendarShowNextWeek: config.calendarShowNextWeek !== false,
    calendarShowRemaining: config.calendarShowRemaining !== false,
    showWeatherChip: config.showWeatherChip !== false,
    weatherLocationName: config.weatherLocationName || '',
    weatherLat: config.weatherLat ?? 44.552,
    weatherLon: config.weatherLon ?? -69.6317,
    weatherUnits: config.weatherUnits === 'celsius' ? 'celsius' : 'fahrenheit',
  });

  const [tab, setTab] = useState('connection');
  // Snapshot at open — the header line doesn't need to tick live.
  const [openedAt] = useState(() => Date.now());
  const tabRefs = useRef({});

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

  const save = () => {
    onChange({
      ...form,
      standardDisplayMs: clamp(form.standardDisplayMs, 2000, 20000),
      specialDisplayMs: clamp(form.specialDisplayMs, 3000, 25000),
      slideshowDelaySec: clamp(form.slideshowDelaySec, 0, 120),
      milestoneEvery: clamp(Math.round(form.milestoneEvery) || 0, 0, 10000),
      clubMilestoneEvery: clamp(Math.round(form.clubMilestoneEvery) || 0, 0, 1000),
      checkoutBoardNamesAbove: clamp(Math.round(form.checkoutBoardNamesAbove) || 0, 0, 200),
      checkoutBoardStaleMin: clamp(Math.round(form.checkoutBoardStaleMin) || 8, 1, 120),
      burstFloorMs: clamp(Math.round(form.burstFloorMs) || 2500, 1000, 10000),
      cycleIntervalSec: clamp(Math.round(form.cycleIntervalSec) || 3, 2, 120),
      calendarUrl: form.calendarUrl.trim(),
      calendarWelcomeText: form.calendarWelcomeText.trim().slice(0, 80) || 'Welcome to Awana!',
      weatherLocationName: form.weatherLocationName.trim().slice(0, 80),
      weatherLat: clamp(Number(form.weatherLat) || 0, -90, 90),
      weatherLon: clamp(Number(form.weatherLon) || 0, -180, 180),
    });
    onClose();
  };

  const reset = () => {
    if (window.confirm('Clear all saved overrides and go back to the defaults in config.js? This also deletes any typed slides saved on this device.')) {
      onReset();
      onClose();
    }
  };

  // #35: move a display's whole setup between machines as a JSON file.
  // Exports the OVERRIDES (what differs from defaults), so importing on
  // a fresh install reproduces this screen. Local video/deck bytes stay
  // on their device — only the slide metadata travels.
  const exportSettings = () => {
    const blob = new Blob(
      [JSON.stringify(overrides || {}, null, 2)],
      { type: 'application/json' }
    );
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'awana-display-settings.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importSettings = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(reader.result);
        onChange(raw); // updateConfig sanitizes key-by-key
        window.alert('Settings imported. Note: video files and uploaded decks do not travel — re-add those on this device.');
        onClose();
      } catch {
        window.alert('That file is not a valid settings export.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const sendTest = () => {
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

  // Escape closes from anywhere in the panel.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const statusText = {
    connected: 'Connected — check-ins will appear instantly',
    connecting: 'Connecting to Pusher…',
    disconnected: 'Disconnected — check the App Key and Cluster',
    off: 'Not set up yet — add your Pusher App Key',
  }[status] || status;

  return (
    <div className="panel-backdrop" onClick={onClose}>
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
            <ConnectionTab form={form} set={set} lastEventAt={lastEventAt} />
          )}
          {tab === 'background' && (
            <BackgroundTab form={form} set={set} config={config} onOpenSlideEditor={onOpenSlideEditor} />
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
          <button className="ghost" onClick={sendTest} title="Show a sample welcome banner">
            Preview a check-in
          </button>
          <button className="ghost" onClick={exportSettings} title="Download this display's settings as a JSON file">
            Export
          </button>
          <label className="ghost" style={{ cursor: 'pointer' }} title="Import a settings JSON exported from another display">
            Import
            <input type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={importSettings} />
          </label>
          {onOpenDebug && (
            <button className="ghost" onClick={onOpenDebug} title="Simulate check-ins, view connection stats">
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
          <button onClick={onClose}>Cancel</button>
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

function Toggle({ checked, onChange, title, hint }) {
  return (
    <div className="toggle">
      <div>
        <div className="toggle-title">{title}</div>
        {hint ? <div className="hint">{hint}</div> : null}
      </div>
      <input type="checkbox" checked={checked} onChange={onChange} />
    </div>
  );
}

function ConnectionTab({ form, set, lastEventAt }) {
  return (
    <>
      <div className="hint tab-intro">
        The display listens for check-ins from the label print server over Pusher Channels.
        Last check-in received:{' '}
        <strong>
          {lastEventAt
            ? new Date(lastEventAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
            : 'none yet this session'}
        </strong>
      </div>

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
          dashboard's "Test Welcome Screen" button to verify end-to-end.
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

      <DisplayKeyField />
    </>
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
function DisplayKeyField() {
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
      <label htmlFor="dkey">Display key</label>
      {!editing ? (
        <div className="display-key-row">
          <code className="display-key-value">
            {configured ? maskDisplayKey(displayKey) : 'not set — names will not appear'}
          </code>
          <button type="button" className="ghost" onClick={() => { setEditing(true); setSaved(false); }}>
            {configured ? 'Replace' : 'Paste key'}
          </button>
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
      ) : (
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
      )}
      <span className="hint">
        {editing && draft.trim() && !valid && (
          <><strong>That does not look like a display key.</strong> It should be 44 characters ending in <code>=</code>. </>
        )}
        {saved && <><strong>Saved.</strong> Press <em>Night Test</em> on the print-server dashboard to confirm. </>}
        Children&apos;s names travel <strong>encrypted</strong>, because the realtime channel itself is public.
        Generate this key once on the print-server dashboard (its front page says whether names are
        encrypted; the button there opens <code>Settings → Realtime privacy</code>) and paste
        the same value into every screen. Without it the clock, weather, counts, countdown and slides all still
        work — only the welcome banners stop.
        {' '}<strong>Never</strong> email it, put it in a URL, or include it in a settings export — it is the one
        secret here that is worth something.
      </span>
    </div>
  );
}

function BackgroundTab({ form, set, config, onOpenSlideEditor }) {
  return (
    <>
      <div className="field">
        <label>Background source</label>
        <div className="radio-row">
          <label className="radio-option">
            <input
              type="radio"
              name="backgroundSource"
              value="powerpoint"
              checked={form.backgroundSource === 'powerpoint'}
              onChange={set('backgroundSource')}
            />
            Looping PowerPoint
          </label>
          <label className="radio-option">
            <input
              type="radio"
              name="backgroundSource"
              value="manual"
              checked={form.backgroundSource === 'manual'}
              onChange={set('backgroundSource')}
            />
            Typed slides
          </label>
          <label className="radio-option">
            <input
              type="radio"
              name="backgroundSource"
              value="pptx"
              checked={form.backgroundSource === 'pptx'}
              onChange={set('backgroundSource')}
            />
            Uploaded PowerPoint
          </label>
          <label className="radio-option">
            <input
              type="radio"
              name="backgroundSource"
              value="video"
              checked={form.backgroundSource === 'video'}
              onChange={set('backgroundSource')}
            />
            Looping video
          </label>
        </div>
        <span className="hint">
          Typed slides are free-typed right here in the app — no PowerPoint needed — and get
          the joyful catalog look automatically. They can also include local video files
          (kept on this device), and the calendar slides join their rotation.
        </span>
      </div>

      {form.backgroundSource === 'manual' && (
        <div className="field">
          <span className="hint">
            {(config.manualSlides?.length || 0) === 0
              ? 'No slides typed yet — the calendar slides (if enabled) play on their own until you add some.'
              : `${config.manualSlides.length} slide${config.manualSlides.length === 1 ? '' : 's'} saved on this device.`}
          </span>
          <button
            type="button"
            className="ghost"
            style={{ alignSelf: 'flex-start' }}
            onClick={onOpenSlideEditor}
          >
            Edit slides… (Ctrl+Shift+E)
          </button>
        </div>
      )}

      {form.backgroundSource === 'pptx' && <PptxUploadField />}

      {form.backgroundSource === 'video' && <VideoUploadField />}

      <div className="field">
        <label htmlFor="iframe">OneDrive PowerPoint embed URL</label>
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

      <div className="field">
        <label htmlFor="countdown">Club start time (24-hour)</label>
        <input
          id="countdown" type="time" value={form.countdownTargetTime}
          onChange={set('countdownTargetTime')}
        />
        <span className="hint">
          The corner countdown ticks down to this time on club nights
          (every day if the calendar is off). Leave blank to hide it.
        </span>
      </div>
    </>
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

      <Toggle
        checked={!form.audioMuted}
        onChange={(e) => setForm((f) => ({ ...f, audioMuted: !e.target.checked }))}
        title="Sound on"
        hint="Play a short chime alongside each welcome animation."
      />
    </>
  );
}

function DisplayTab({ form, set }) {
  const cycleMode = form.widgetDisplayMode !== 'stickers';
  const boardOn = form.checkoutBoardMode !== 'off';
  return (
    <>
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
              Below this many children, the board hides the names and shows
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
          time, tonight's tally, weather, and the pre-club countdown — each tumbling in and
          out playfully. Classic stickers pin them to the corners all at once.
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

      <Toggle
        checked={form.mascotMoments === true}
        onChange={set('mascotMoments')}
        title="Mascot moments between check-ins"
        hint="Every few quiet minutes, an official club mascot peeks up from the bottom of the screen or scoots across it. Hidden instantly when a banner shows; off under reduce-motion and panic mode."
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

      <div className="field" style={{ marginTop: '1rem' }}>
        <label htmlFor="milestone">Milestone celebration (every N check-ins)</label>
        <input
          id="milestone" type="number" min="0" max="10000" step="5"
          value={form.milestoneEvery}
          onChange={set('milestoneEvery')}
        />
        <span className="hint">
          Every Nth kid triggers a room-wide confetti moment with a "{form.milestoneEvery || 25} kids
          checked in tonight!" toast. Set to 0 to turn it off.
        </span>
      </div>

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
        checked={form.showClock}
        onChange={set('showClock')}
        title="Wall clock"
        hint="The current time of day — joins the cycle, or sits top-right as a sticker."
      />

      <Toggle
        checked={form.keepScreenAwake}
        onChange={set('keepScreenAwake')}
        title="Keep screen awake"
        hint="Ask the browser to stop the TV/monitor from sleeping while the display is open."
      />

      <Toggle
        checked={form.showConnectionStatus}
        onChange={set('showConnectionStatus')}
        title="Show connection status dot"
        hint="Tiny corner indicator. Even when off, it appears by itself if the connection drops."
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
        hint='Auto-generate "Welcome to…", "Next week is…", and nights-remaining slides from the church calendar. They join the typed-slides rotation.'
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
        title="Next-week slide" hint='"Next week is…!" announcements and break-week notices.' />
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
