import React, { useState } from 'react';
import { FLAGS } from '../lib/flags.js';
import { useBirthdayRoster } from '../hooks/useBirthdays.js';
import { useConfig } from '../../hooks/useConfig.js';
import { GlassPanel } from './GlassPanel.jsx';

// Migration cutover helper (MIGRATION.md step 3): localStorage does not
// cross origins, so a kiosk bookmark moved from the old countdown site
// arrives here with no Pusher key and no birthday CSV. Until both exist
// (or the operator dismisses it), show a quiet corner checklist that
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
  const { csvCount } = useBirthdayRoster();
  const [hidden, setHidden] = useState(dismissed);

  const hasKey = Boolean(config.pusherAppKey);
  const hasRoster = csvCount > 0;
  // Operator chrome stays out of screenshot/visual-regression mode.
  if (FLAGS.vr || hidden || (hasKey && hasRoster)) return null;

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
          New display? two quick setup steps
        </p>
        <ul
          className="flex flex-col gap-1 text-xs text-gray-300"
          style={{ fontFamily: 'var(--font-condensed)', fontWeight: 600, letterSpacing: '0.06em' }}
        >
          <li>{hasKey ? '✅' : '⬜'} Live data key — hover the top-right corner → Display Settings</li>
          <li>{hasRoster ? '✅' : '⬜'} Birthday roster — same menu → Upload Birthdays CSV</li>
        </ul>
        <p className="text-[0.65rem] text-gray-500" style={{ fontFamily: 'var(--font-condensed)', fontWeight: 600 }}>
          Settings don't follow bookmarks between sites, so a display moved from the old
          countdown page needs these entered once here.
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
