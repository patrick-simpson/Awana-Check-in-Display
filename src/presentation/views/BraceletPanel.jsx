import React, { useEffect, useRef, useSyncExternalStore } from 'react';
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

/** Keys that close the panel (B toggles it, as its hint says). */
const CLOSE_KEYS = new Set(['Escape', 'KeyB']);

export const BraceletPanel = ({ onClose, active }) => {
  const s = useSyncExternalStore(subscribeBraceletSettings, getBraceletSettings);
  const changed = braceletSettingsChanged(s);
  const sound = audioState();
  const auto = s.display === 'auto';
  const dialog = useRef(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);

  // While it is open the panel owns the keyboard. Focus starts on its first
  // control and Tab stays inside it; B and Escape close it; and NO key
  // reaches the wall's own shortcuts underneath (Escape would arm the
  // slideshow's exit, Space would skip the countdown or advance the pledge,
  // the arrows would change slides). Stopping the event in the window's
  // capture phase keeps it from every listener after this one, while a
  // focused button still clicks on Space and Enter (that is the browser's
  // default action, not a listener). Focus goes back where it was on close.
  useEffect(() => {
    const before = document.activeElement;
    const controls = () => [...(dialog.current?.querySelectorAll('button:not([disabled])') ?? [])];
    controls()[0]?.focus();
    const onKey = (e) => {
      e.stopPropagation();
      if (CLOSE_KEYS.has(e.code) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        close.current();
        return;
      }
      if (e.code !== 'Tab') return;
      const list = controls();
      if (!list.length) return;
      const i = list.indexOf(document.activeElement);
      const next = e.shiftKey ? (i <= 0 ? list.length - 1 : i - 1) : (i === -1 || i === list.length - 1 ? 0 : i + 1);
      e.preventDefault();
      list[next].focus();
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      if (before && before instanceof HTMLElement && document.contains(before)) before.focus();
    };
  }, []);

  return (
    <div className="pj-bpanel__backdrop" onClick={onClose} role="presentation">
      <div ref={dialog} role="dialog" aria-modal="true" aria-label="Bracelet Time controls" onClick={(e) => e.stopPropagation()}>
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
                disabled={s.still || !active}
                title={active ? undefined : 'Plays during Bracelet Time'}
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
