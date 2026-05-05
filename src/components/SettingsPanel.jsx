import { useState } from 'react';

export default function SettingsPanel({ config, onChange, onReset, onClose }) {
  const [form, setForm] = useState({
    pusherAppKey: config.pusherAppKey || '',
    pusherCluster: config.pusherCluster || 'us2',
    powerpointEmbedUrl: config.powerpointEmbedUrl || '',
    slideshowDelaySec: config.slideshowDelaySec ?? 5,
    countdownTargetTime: config.countdownTargetTime || '',
    standardDisplayMs: config.standardDisplayMs ?? 6000,
    specialDisplayMs: config.specialDisplayMs ?? 8000,
    audioMuted: !!config.audioMuted,
    showConnectionStatus: !!config.showConnectionStatus,
  });

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
      standardDisplayMs: Math.max(2000, Math.min(20000, form.standardDisplayMs)),
      specialDisplayMs: Math.max(3000, Math.min(25000, form.specialDisplayMs)),
      slideshowDelaySec: Math.max(0, Math.min(120, form.slideshowDelaySec)),
    });
    onClose();
  };

  const reset = () => {
    if (window.confirm('Clear all saved overrides and go back to the defaults in config.js?')) {
      onReset();
      onClose();
    }
  };

  return (
    <div className="panel-backdrop" onClick={onClose}>
      <div className="panel" onClick={(e) => e.stopPropagation()}>
        <h2>Settings</h2>

        <div className="field">
          <label htmlFor="pkey">Pusher App Key</label>
          <input
            id="pkey" type="text" value={form.pusherAppKey}
            onChange={set('pusherAppKey')}
            placeholder="abcdef1234567890"
          />
          <span className="hint">
            From your Pusher Channels app's <code>App Keys</code> page — the <code>key</code> value (public, safe to ship).
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
            From the same page (e.g. <code>us2</code>, <code>eu</code>, <code>ap1</code>).
          </span>
        </div>

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
            How long each slide stays on screen. 0 = let the PowerPoint file control its own timing.
          </span>
        </div>

        <div className="field">
          <label htmlFor="countdown">Club start time (24-hour)</label>
          <input
            id="countdown" type="time" value={form.countdownTargetTime}
            onChange={set('countdownTargetTime')}
          />
          <span className="hint">
            Leave blank to hide the countdown.
          </span>
        </div>

        <div className="field">
          <label htmlFor="std">Standard banner duration (ms)</label>
          <input
            id="std" type="number" min="2000" max="20000" step="500"
            value={form.standardDisplayMs}
            onChange={set('standardDisplayMs')}
          />
        </div>

        <div className="field">
          <label htmlFor="special">Birthday / first-timer banner duration (ms)</label>
          <input
            id="special" type="number" min="3000" max="25000" step="500"
            value={form.specialDisplayMs}
            onChange={set('specialDisplayMs')}
          />
        </div>

        <div className="toggle">
          <div>
            <div style={{ fontWeight: 600 }}>Sound on</div>
            <div className="hint">
              Play a short chime alongside each welcome animation.
            </div>
          </div>
          <input
            type="checkbox" checked={!form.audioMuted}
            onChange={(e) => setForm((f) => ({ ...f, audioMuted: !e.target.checked }))}
          />
        </div>

        <div className="toggle">
          <div>
            <div style={{ fontWeight: 600 }}>Show connection status dot</div>
            <div className="hint">
              Tiny indicator showing whether we're connected to your server.
            </div>
          </div>
          <input
            type="checkbox" checked={form.showConnectionStatus}
            onChange={set('showConnectionStatus')}
          />
        </div>

        <div className="actions">
          <button className="danger" onClick={reset}>Reset to defaults</button>
          <button onClick={onClose}>Cancel</button>
          <button className="primary" onClick={save}>Save</button>
        </div>
      </div>
    </div>
  );
}
