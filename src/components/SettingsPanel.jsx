import { useEffect, useRef, useState } from 'react';
import { geocodeLocation } from '../lib/weather.js';
import { deriveClubInfo, formatShortDate, isStoreNight, localDateStr, splitTitle } from '../lib/calendarLogic.js';

// Obviously-fake names only: a preview banner on the lobby TV must
// never look like (or match) a real kid checking in.
const TEST_NAMES = ['Test Kid', 'Demo Kid', 'Sample Star', 'Pretend Pal', 'Practice Run'];

const TABS = [
  { id: 'connection', label: 'Connection' },
  { id: 'background', label: 'Background' },
  { id: 'banners', label: 'Banners' },
  { id: 'display', label: 'Display' },
  { id: 'calendar', label: 'Calendar & Weather' },
];

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export default function SettingsPanel({
  config, status, lastEventAt, calendar,
  onChange, onReset, onClose, onTest, onResetTally, onOpenSlideEditor, onOpenDebug,
}) {
  const [form, setForm] = useState({
    pusherAppKey: config.pusherAppKey || '',
    pusherCluster: config.pusherCluster || 'us2',
    backgroundSource: config.backgroundSource === 'manual' ? 'manual' : 'powerpoint',
    powerpointEmbedUrl: config.powerpointEmbedUrl || '',
    slideshowDelaySec: config.slideshowDelaySec ?? 5,
    countdownTargetTime: config.countdownTargetTime || '',
    standardDisplayMs: config.standardDisplayMs ?? 6000,
    specialDisplayMs: config.specialDisplayMs ?? 8000,
    audioMuted: !!config.audioMuted,
    showConnectionStatus: !!config.showConnectionStatus,
    showTally: config.showTally !== false,
    keepScreenAwake: config.keepScreenAwake !== false,
    showClock: !!config.showClock,
    milestoneEvery: config.milestoneEvery ?? 25,
    calendarEnabled: config.calendarEnabled !== false,
    calendarUrl: config.calendarUrl || '',
    calendarCorsProxy: config.calendarCorsProxy || '',
    calendarWelcomeText: config.calendarWelcomeText || 'Welcome to Awana!',
    calendarShowWelcome: config.calendarShowWelcome !== false,
    calendarShowNextWeek: config.calendarShowNextWeek !== false,
    calendarShowRemaining: config.calendarShowRemaining !== false,
    calendarShowWeather: config.calendarShowWeather !== false,
    weatherLocationName: config.weatherLocationName || '',
    weatherLat: config.weatherLat ?? 44.552,
    weatherLon: config.weatherLon ?? -69.6317,
    weatherUnits: config.weatherUnits === 'celsius' ? 'celsius' : 'fahrenheit',
  });

  const [tab, setTab] = useState('connection');
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
      calendarUrl: form.calendarUrl.trim(),
      calendarCorsProxy: form.calendarCorsProxy.trim(),
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

  const sendTest = () => {
    onTest?.({
      firstName: TEST_NAMES[Math.floor(Math.random() * TEST_NAMES.length)],
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
          {onOpenDebug && (
            <button className="ghost" onClick={onOpenDebug} title="Simulate check-ins, view connection stats">
              Debug panel
            </button>
          )}
          {onResetTally && (
            <button
              className="ghost"
              onClick={() => { if (window.confirm("Reset tonight's counter to zero?")) onResetTally(); }}
            >
              Reset counter
            </button>
          )}
          <button className="danger" onClick={reset}>Reset to defaults</button>
          <button onClick={onClose}>Cancel</button>
          <button className="primary" onClick={save}>Save</button>
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
    </>
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
        </div>
        <span className="hint">
          Typed slides are free-typed right here in the app — no PowerPoint needed — and get
          the joyful catalog look automatically. They can also include local video files
          (kept on this device), and the calendar &amp; weather slides join their rotation.
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
          The corner countdown ticks down to this time. Leave blank to hide it.
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
  return (
    <>
      <Toggle
        checked={form.showTally}
        onChange={set('showTally')}
        title="Tonight's check-in counter"
        hint='A small "checked in tonight" tally in the corner. Counts only a number, resets daily.'
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

      <Toggle
        checked={form.showClock}
        onChange={set('showClock')}
        title="Wall clock"
        hint="Show the current time in the top-right corner all night."
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
        hint='Auto-generate "Welcome to…", "Next week is…", nights-remaining, and weather slides from the church calendar. They join the typed-slides rotation.'
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
          data file the display reads; this URL is the fallback the display scrapes live if
          that file goes stale.
        </span>
      </div>

      <div className="field">
        <label htmlFor="calproxy">Fallback fetch proxy</label>
        <input
          id="calproxy" type="text" value={form.calendarCorsProxy}
          onChange={set('calendarCorsProxy')}
          placeholder="https://api.allorigins.win/raw?url={url}"
        />
        <span className="hint">
          Only used when the nightly data file is missing or stale — the calendar site blocks
          direct browser fetches, so the fallback goes through this CORS proxy.
          <code>{'{url}'}</code> is replaced with the calendar URL. Leave blank to disable.
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
        title="Next-week slide" hint='"Next week is…!" announcements and "No club next week" notices.' />
      <Toggle checked={form.calendarShowRemaining} onChange={set('calendarShowRemaining')}
        title="Nights-remaining slide" hint="A countdown nudge once fewer than 10 club nights remain." />
      <Toggle checked={form.calendarShowWeather} onChange={set('calendarShowWeather')}
        title="Weather slide" hint="Current conditions, shown when next week has nothing special to tease." />

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
