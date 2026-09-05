import { useState } from 'react';
import { useDisplayLogin } from '../hooks/useDisplayLogin.js';

// First-run helper for the SIGNAGE page. An unconfigured TV used to look
// exactly like a healthy one — placeholder scene, no status sticker, the
// gear faded out — so a volunteer had nothing to click and no idea why no
// check-in ever appeared. Mirrors the countdown page's SetupChecklist
// (which is Tailwind and must stay out of this CSS graph) with signage-
// native markup: the card is a `.panel`, so it inherits the cream paper,
// hint and button styles with one positioning rule.
//
// Hidden once the screen is connected AND keyed (logged in or a pasted
// key), or once dismissed on this device. No framer-motion here; if it
// ever animates it must use M from src/lib/motion.jsx.
export const SETUP_CARD_DISMISS_KEY = 'awanaSetupCardDismissed.v1';

function dismissed() {
  try {
    return localStorage.getItem(SETUP_CARD_DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

export default function SetupCard({ status, hasDisplayKey, onOpenSettings }) {
  const { loginStatus } = useDisplayLogin();
  const [hidden, setHidden] = useState(dismissed);

  const connected = status !== 'off';
  const keyed = loginStatus === 'logged-in' || hasDisplayKey;
  if (hidden || (connected && keyed)) return null;

  const remaining = (connected ? 0 : 1) + (keyed ? 0 : 1);
  const dismiss = () => {
    try {
      localStorage.setItem(SETUP_CARD_DISMISS_KEY, '1');
    } catch {
      /* storage blocked — hide for this session at least */
    }
    setHidden(true);
  };

  return (
    <div className="panel setup-card" role="region" aria-label="Display setup">
      <h3>New display? {remaining === 1 ? 'One quick setup step' : 'Two quick setup steps'}</h3>
      <ol>
        <li className={connected ? 'done' : ''}>
          Connect to Pusher — Settings → Connection → <strong>Advanced</strong>: paste the App Key and Cluster
          from the print-server dashboard (Settings → Pusher Integration). Skipped when the site was built
          with them baked in.
        </li>
        <li className={keyed ? 'done' : ''}>
          Log in with the church&rsquo;s display passphrase — Settings → Connection → <strong>Display login</strong>.
          The passphrase is on the print-server dashboard (Settings → Display login).
        </li>
      </ol>
      <span className="hint">
        Names, published slides and tonight&rsquo;s counter then sync themselves. Settings is the gear in the
        bottom-left corner, or <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd>.
      </span>
      <div className="actions">
        <button type="button" className="primary" onClick={onOpenSettings}>Open Settings</button>
        <button type="button" className="ghost" onClick={dismiss}>Don&rsquo;t show again</button>
      </div>
    </div>
  );
}
