import React, { useSyncExternalStore } from 'react';
import { GlassPanel } from '../components/GlassPanel.jsx';
import { BRACELET_STEPS } from '../lib/bracelets.js';
import {
  braceletSettingsChanged, getBraceletSettings, playEpicNow, resetBraceletSettings,
  setBraceletSettings, subscribeBraceletSettings,
} from '../lib/braceletSettings.js';
import { audioState, playBraceletChime, unlockAudio } from '../lib/chime.js';
import { currentTime } from '../hooks/useClock.js';

// The Bracelet Time controls (owner, 2026-09-30): a panel on the projector
// PC, opened with B or from QuickNav, whose choices are saved on this PC
// until Reset. Plain buttons, no animation of its own: it is an operator
// tool, and it must work the same under ?vr=1 and low power.

const DISPLAY_CHOICES = [
  ['auto', 'Step by step'],
  ['overview', 'Full instructions'],
  ['handout1', 'Handout page 1'],
  ['handout2', 'Handout page 2'],
];

const Choice = ({ on, onClick, children, title }) => (
  <button
    type="button"
    className={`pj-bpanel__choice${on ? ' is-on' : ''}`}
    aria-pressed={on}
    onClick={onClick}
    title={title}
  >
    {children}
  </button>
);

export const BraceletPanel = ({ onClose, active }) => {
  const s = useSyncExternalStore(subscribeBraceletSettings, getBraceletSettings);
  const changed = braceletSettingsChanged(s);
  const sound = audioState();
  const auto = s.display === 'auto';

  return (
    <div className="pj-bpanel__backdrop" onClick={onClose} role="presentation">
      <div role="dialog" aria-label="Bracelet Time controls" onClick={(e) => e.stopPropagation()}>
        <GlassPanel className="pj-bpanel">
          <div className="pj-bpanel__head">
            <h2 className="pj-bpanel__title">Bracelet Time controls</h2>
            <button type="button" className="pj-bpanel__close" onClick={onClose} aria-label="Close">✕</button>
          </div>
          <p className="pj-bpanel__note">
            {active
              ? 'Showing now: T&T and Sparks craft time on bracelet nights.'
              : 'Not showing right now. Bracelet Time runs 6:05 to 7:00 pm on Sept 30 and Oct 7.'}{' '}
            Saved on this PC until you press Reset.
          </p>

          <section className="pj-bpanel__group">
            <h3>On the wall</h3>
            <div className="pj-bpanel__row">
              {DISPLAY_CHOICES.map(([id, label]) => (
                <Choice key={id} on={s.display === id} onClick={() => setBraceletSettings({ display: id })}>{label}</Choice>
              ))}
            </div>
          </section>

          <section className="pj-bpanel__group" aria-disabled={!auto}>
            <h3>Hold one step</h3>
            <div className="pj-bpanel__row pj-bpanel__row--steps">
              <Choice on={s.hold == null} onClick={() => setBraceletSettings({ hold: null })}>Off</Choice>
              {BRACELET_STEPS.map((step, i) => (
                <Choice key={step.n} on={s.hold === i} title={step.title} onClick={() => setBraceletSettings({ hold: i, display: 'auto' })}>
                  {i < 7 ? step.n : `K${i - 6}`}
                </Choice>
              ))}
            </div>
          </section>

          <section className="pj-bpanel__group">
            <h3>Epic how-to</h3>
            <div className="pj-bpanel__row">
              <Choice on={s.epic} onClick={() => setBraceletSettings({ epic: !s.epic })}>{s.epic ? 'Every 5 minutes: on' : 'Every 5 minutes: off'}</Choice>
              <button
                type="button"
                className="pj-bpanel__action"
                disabled={s.still}
                onClick={() => {
                  setBraceletSettings({ display: 'auto', hold: null });
                  playEpicNow(currentTime().getTime());
                  onClose();
                }}
              >
                Play it now
              </button>
            </div>
          </section>

          <section className="pj-bpanel__group">
            <h3>Sound and motion</h3>
            <div className="pj-bpanel__row">
              <Choice on={s.chime} onClick={() => setBraceletSettings({ chime: !s.chime })}>{s.chime ? 'Chime: on' : 'Chime: off'}</Choice>
              <button type="button" className="pj-bpanel__action" onClick={() => { unlockAudio(); setTimeout(() => playBraceletChime(), 60); }}>
                Test chime
              </button>
              <Choice on={!s.still} onClick={() => setBraceletSettings({ still: !s.still })}>{s.still ? 'Animations: off' : 'Animations: on'}</Choice>
            </div>
            {sound !== 'running' && (
              <p className="pj-bpanel__warn">
                Sound is not armed yet: click anywhere on this page or press any key once, and the chime can play.
              </p>
            )}
          </section>

          <div className="pj-bpanel__foot">
            <button type="button" className="pj-bpanel__action" disabled={!changed} onClick={resetBraceletSettings}>Reset</button>
            <span className="pj-bpanel__hint">B opens and closes this panel.</span>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
};
