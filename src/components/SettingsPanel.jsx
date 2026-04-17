import { useState } from 'react';

export default function SettingsPanel({ config, onChange, onReset, onClose }) {
  const [form, setForm] = useState({
    websocketUrl: config.websocketUrl || '',
    powerpointEmbedUrl: config.powerpointEmbedUrl || '',
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
    onChange(form);
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
          <label htmlFor="ws">WebSocket server URL</label>
          <input
            id="ws" type="text" value={form.websocketUrl}
            onChange={set('websocketUrl')}
            placeholder="ws://localhost:3000"
          />
          <span className="hint">
            Where your local check-in server is running. Use <code>ws://</code> on
            your own network or <code>https://</code> / <code>wss://</code> for hosted servers.
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
          <label htmlFor="countdown">Club start time (24-hour)</label>
          <input
            id="countdown" type="text" value={form.countdownTargetTime}
            onChange={set('countdownTargetTime')}
            placeholder="18:30"
          />
          <span className="hint">
            Format: <code>HH:MM</code>. Leave blank to hide the countdown.
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
