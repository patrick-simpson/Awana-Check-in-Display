import React, { useState } from 'react';
import { FLAGS } from '../lib/flags.js';
import { useConfig } from '../../hooks/useConfig.js';
import { useDisplayLogin } from '../../hooks/useDisplayLogin.js';
import { GlassPanel } from './GlassPanel.jsx';

// First-run helper: a new screen needs (a) the Pusher key — baked into the
// build when the repository variables are set, else typed — and (b) to be
// logged in with the church's display passphrase, which provisions the
// display key (sealed birthdays) and the publish token. Until both are
// true (or the operator dismisses it), show a quiet corner note that
// points at the QuickNav menu. Dismissal is remembered per device.
const DISMISS_KEY = 'awanaSetupChecklistDismissed.v1';

function dismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

export const SetupChecklist = () => {
  const { config } = useConfig();
  const { loginStatus } = useDisplayLogin();
  const [hidden, setHidden] = useState(dismissed);

  const hasKey = Boolean(config.pusherAppKey);
  const loggedIn = loginStatus === 'logged-in';
  // Operator chrome stays out of screenshot/visual-regression mode.
  if (FLAGS.vr || hidden || (hasKey && loggedIn)) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* storage blocked — hide for this session at least */
    }
    setHidden(true);
  };

  return (
    <div className="absolute bottom-4 left-4 z-40" style={{ maxWidth: '22rem' }}>
      <GlassPanel className="p-4 flex flex-col gap-2">
        <p
          className="text-xs uppercase text-amber-300"
          style={{ fontFamily: 'var(--font-condensed)', fontWeight: 800, letterSpacing: '0.12em' }}
        >
          New display? {hasKey ? 'one quick setup step' : 'two quick setup steps'}
        </p>
        <ul
          className="flex flex-col gap-1 text-xs text-gray-300"
          style={{ fontFamily: 'var(--font-condensed)', fontWeight: 600, letterSpacing: '0.06em' }}
        >
          {!hasKey && <li>⬜ Live data key — hover the top-right corner → Display Settings → Advanced</li>}
          <li>{loggedIn ? '✅' : '⬜'} Log in with the display passphrase — hover the top-right corner → Display Settings</li>
          <li className="text-gray-500">Counts, names and birthdays then sync themselves from check-in.</li>
        </ul>
        <p className="text-[0.65rem] text-gray-500" style={{ fontFamily: 'var(--font-condensed)', fontWeight: 600 }}>
          The passphrase is on the print-server dashboard (Settings → Display login). Settings don't
          follow bookmarks between sites, so a display moved from the old countdown page needs this once here.
        </p>
        <button
          onClick={dismiss}
          className="self-end px-3 py-1 text-[0.65rem] uppercase text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
          style={{ fontFamily: 'var(--font-condensed)', fontWeight: 700, letterSpacing: '0.1em' }}
        >
          Don't show again
        </button>
      </GlassPanel>
    </div>
  );
};
