import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CLUBS } from '../config.js';
import { ScreenFrame } from '../components/ScreenFrame.jsx';
import { ClubWave } from '../components/ClubWave.jsx';
import { Headline, fittedSize } from '../components/Headline.jsx';
import { Kicker } from '../components/Kicker.jsx';
import { StepChip } from '../components/StepChip.jsx';
import { useLowPower } from '../hooks/useLowPower.js';
import { secondsUntil } from '../lib/schedule.js';
import { WARNING_LABELS, WARNING_STINGER_INTENSITY, warningFor } from '../lib/gameWarning.js';
import { playStinger } from '../lib/stingers.js';
import { countForClub } from '../lib/tally.js';
import { FAR_WAVE_KEEP, HOUSE, WARNING_TONES, shade } from '../lib/kit.js';
import { DUR, EASE } from '../lib/motion-tokens.js';
import { BRACELET_STEPS, EPIC_LEAD_SEC, braceletFrame, windowSpan } from '../lib/bracelets.js';
import { getBraceletSettings, manualEpicStart, subscribeBraceletSettings } from '../lib/braceletSettings.js';
import { chimeOnce } from '../lib/chime.js';
import { BEAD_TONES } from '../lib/braceletArt.js';
import { StepArt } from '../components/bracelet/StepArt.jsx';
import { BraceletStage, EpicStage, currentEpicStep } from '../components/bracelet/BraceletStage.jsx';
import handout1 from '../assets/bracelets/handout-1.jpg';
import handout2 from '../assets/bracelets/handout-2.jpg';

// ─────────────────────────────────────────────────────────────
// Bracelet Time (owner, 2026-09-30): on the two bracelet nights the T&T and
// Sparks game windows show how to make the salvation bracelet instead of a
// game clock. One step at a time (STEP_SEC each), an epic how-to every five
// minutes with a chime and a countdown on the wall 10 s before it, and a
// small corner chip keeping the window's end time and its warnings. What it
// shows can be overridden from the Bracelet Time controls (B, or QuickNav):
// hold one step, the epic or the chime off, animations off, the whole sheet
// at once, or the original handout pages. The cadence is lib/bracelets.js;
// the art is components/bracelet/.
// ─────────────────────────────────────────────────────────────

const TALLY_STALE_MS = 10 * 60 * 1000;
const CORNER_U = 2.3;
const OVERVIEW_PAGE_SEC = 20;
const COLOR_WORDS = ['black', 'red', 'white', 'blue', 'green', 'yellow', 'clear'];
const INK_ON = { white: HOUSE.ink, yellow: HOUSE.ink, clear: '#FFFFFF' };

function useBraceletSettings() {
  const settings = useSyncExternalStore(subscribeBraceletSettings, getBraceletSettings);
  const manual = useSyncExternalStore(subscribeBraceletSettings, manualEpicStart);
  return { settings, manual };
}

/** 1-7 are the bead steps, 8-13 the handout's knot steps 1-6. */
const chipFor = (i) => (i < 7 ? { label: 'Step', value: i + 1 } : { label: 'Knot', value: i - 6 });

export const BraceletTimeView = ({ now, window: w, endsAt, tally }) => {
  const { settings, manual } = useBraceletSettings();
  const lowPower = useLowPower();
  const club = CLUBS[w.clubs[0]];
  const nowMs = now.getTime();

  // A QuickNav pick of this window before its start runs from when the page
  // opened it, so the wall never sits on a title card for minutes.
  const [mountedAt] = useState(nowMs);
  const span = windowSpan(w, now);
  const startMs = nowMs < span.startMs ? Math.min(span.startMs, mountedAt) : span.startMs;

  const still = settings.still || lowPower;
  const auto = settings.display === 'auto';
  const frame = braceletFrame(nowMs, startMs, span.endMs, {
    epics: auto && settings.epic && !settings.still && settings.hold == null,
    manualEpicAt: auto && !settings.still && settings.hold == null ? manual : null,
  });

  // The chime, once per showing, 10 s ahead. Silent unless a person has
  // pressed a key or clicked the page since it loaded (see lib/chime.js);
  // the wall's own countdown carries the moment either way.
  const chiming = auto && settings.chime && frame.chime;
  useEffect(() => {
    if (chiming && frame.nextEpicMs != null) chimeOnce(String(frame.nextEpicMs));
  }, [chiming, frame.nextEpicMs]);

  // The window's warnings, exactly as game time does them.
  const seconds = secondsUntil(endsAt, now);
  const warning = warningFor(seconds);
  const announced = useRef('none');
  useEffect(() => {
    if (warning === announced.current) return;
    announced.current = warning;
    const intensity = WARNING_STINGER_INTENSITY[warning];
    if (intensity != null) playStinger(intensity);
  }, [warning]);

  const endTimeStr = endsAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
  const tallyFresh = tally != null && nowMs - tally.at.getTime() < TALLY_STALE_MS;
  const count = tallyFresh ? countForClub(tally, club.id) : null;
  const leadSec = frame.chime && frame.nextEpicMs != null ? Math.max(1, Math.ceil((frame.nextEpicMs - nowMs) / 1000)) : null;

  let body;
  if (settings.display === 'handout1' || settings.display === 'handout2') {
    body = <Handout page={settings.display === 'handout1' ? 1 : 2} />;
  } else if (settings.display === 'overview') {
    body = <Overview nowMs={nowMs} club={club} />;
  } else if (settings.hold != null) {
    body = <StepCard index={settings.hold} club={club} stepStartMs={nowMs - ((nowMs - startMs) % 10_000)} still={still} />;
  } else if (frame.mode === 'epic') {
    body = <Epic startMs={frame.epicStartMs} nowMs={nowMs} club={club} still={still} />;
  } else if (frame.mode === 'intro') {
    body = <Intro club={club} leadSec={leadSec} />;
  } else {
    body = <StepCard index={frame.stepIndex} club={club} stepStartMs={frame.stepStartMs} still={still} />;
  }

  const bodyKey = settings.display !== 'auto' ? settings.display
    : settings.hold != null ? `hold:${settings.hold}`
      : frame.mode === 'epic' ? `epic:${frame.epicStartMs}`
        : frame.mode === 'intro' ? 'intro' : `step:${frame.stepStartMs}`;

  return (
    <ScreenFrame
      layers={
        <>
          <ClubWave color={shade(club.deep, FAR_WAVE_KEEP)} position="bottom" height={9} flip drift={!lowPower} />
          <ClubWave color={club.deep} position="bottom" height={6} delay={0.08} />
        </>
      }
    >
      <div
        className="pj-frame pj-bracelet"
        data-activity="bracelets"
        data-bracelet-phase={settings.display !== 'auto' ? settings.display : settings.hold != null ? 'hold' : frame.mode}
        data-bracelet-step={frame.mode === 'steps' || settings.hold != null ? (settings.hold ?? frame.stepIndex) + 1 : undefined}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={bodyKey}
            className="pj-bracelet__body"
            initial={still ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0, transition: still ? { duration: 0 } : { duration: DUR.settle, ease: EASE.settle } }}
            exit={still ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: -10, transition: { duration: DUR.exit, ease: EASE.exit } }}
          >
            {body}
          </motion.div>
        </AnimatePresence>

        {/* One message at a time up top-right: the pre-roll, else the window's end. */}
        <div className="pj-bracelet__corner" data-warning={warning !== 'none' ? warning : undefined}>
          {count != null && (
            <StepChip label="Checked in" value={count} size={`calc(${CORNER_U} * var(--u))`} plate={club.deep} />
          )}
          {warning !== 'none' ? (
            <StepChip
              label={`${club.name} craft ends ${endTimeStr}`}
              value={WARNING_LABELS[warning]}
              size={`calc(${CORNER_U + 0.4} * var(--u))`}
              plate={WARNING_TONES[warning].plate}
            />
          ) : leadSec != null && auto ? (
            <StepChip label="Big how-to in" value={`0:${String(leadSec).padStart(2, '0')}`} size={`calc(${CORNER_U + 0.4} * var(--u))`} plate={HOUSE.blueDeep ?? HOUSE.blue} />
          ) : (
            <StepChip label={`${club.name} craft time`} value={`Ends ${endTimeStr}`} size={`calc(${CORNER_U} * var(--u))`} plate={club.deep} />
          )}
        </div>
      </div>
    </ScreenFrame>
  );
};

/** The thirteen steps as a threaded rail: done, current, still to come. */
const Rail = ({ index }) => (
  <div className="pj-bracelet__rail" aria-hidden="true">
    {BRACELET_STEPS.map((s, i) => {
      const tone = s.color ? BEAD_TONES[s.color] : s.kind === 'finish' ? BEAD_TONES.clear : null;
      return (
        <span
          key={s.n}
          className={`pj-bracelet__pip${i === index ? ' is-current' : ''}${i < index ? ' is-done' : ''}${tone ? '' : ' is-knot'}`}
          style={tone ? { background: tone.tone, borderColor: s.color === 'black' ? '#FFFFFF' : tone.dark } : undefined}
        />
      );
    })}
  </div>
);

/** A title with its colour word on a pill of the bead's own colour ("ADD A [RED] BEAD"). */
const BeadTitle = ({ text, color: bead }) => {
  const size = fittedSize(text, { maxU: 5.4, widthU: 84, minU: 4.2 });
  const word = bead && COLOR_WORDS.find((c) => text.toLowerCase().includes(c));
  if (!word) return <Headline text={text} fit={{ maxU: 5.4, widthU: 84, minU: 4.2 }} className="pj-bracelet__title" />;
  const at = text.toLowerCase().indexOf(word);
  const tone = BEAD_TONES[word];
  return (
    <h1 className="pj-headline pj-bracelet__title" style={{ fontSize: size }}>
      {text.slice(0, at)}
      <span className="pj-bracelet__pill" style={{ background: tone.tone, color: INK_ON[word] ?? '#FFFFFF', boxShadow: word === 'black' ? '0 0 0 0.06em #FFFFFF' : undefined }}>
        {text.slice(at, at + word.length)}
      </span>
      {text.slice(at + word.length)}
    </h1>
  );
};

const StepCard = ({ index, club, stepStartMs, still }) => {
  const step = BRACELET_STEPS[index];
  const chip = chipFor(index);
  return (
    <div className="pj-bracelet__card">
      <Kicker size="calc(2.4 * var(--u))" className="pj-bracelet__kicker">{index < 7 ? 'Make your bracelet' : 'Tie the knot'}</Kicker>
      <Rail index={index} />
      <div className="pj-bracelet__chip">
        <StepChip label={chip.label} value={chip.value} size="calc(5.4 * var(--u))" plate={club.deep} />
      </div>
      <div className="pj-bracelet__stage">
        <BraceletStage step={index} startMs={stepStartMs} still={still} />
      </div>
      <div className="pj-bracelet__caption">
        <BeadTitle text={step.title} color={step.color} />
        <p className="pj-body pj-bracelet__words">{step.words}</p>
      </div>
    </div>
  );
};

const Epic = ({ startMs, nowMs, club, still }) => {
  const sec = Math.max(0, (nowMs - startMs) / 1000);
  const i = currentEpicStep(sec);
  const title = i == null ? (sec < 10 ? "Let's make a bracelet!" : 'Your turn!') : BRACELET_STEPS[i].title;
  return (
    <div className="pj-bracelet__card pj-bracelet__card--epic">
      <Kicker size="calc(2.4 * var(--u))" className="pj-bracelet__kicker">Watch how!</Kicker>
      {i != null && <Rail index={i} />}
      <div className="pj-bracelet__stage pj-bracelet__stage--epic">
        <EpicStage startMs={startMs} still={still} />
      </div>
      <div className="pj-bracelet__caption">
        <BeadTitle text={title} color={i != null ? BRACELET_STEPS[i].color : undefined} />
        {i != null && <p className="pj-body pj-bracelet__words">{chipFor(i).label} {chipFor(i).value}</p>}
      </div>
      <span className="sr-only">{club.name}</span>
    </div>
  );
};

const Intro = ({ club, leadSec }) => (
  <div className="pj-bracelet__card pj-bracelet__card--intro">
    <Kicker size="calc(3 * var(--u))">{club.name} craft time</Kicker>
    <Headline text="Bracelet time!" color={club.color} size="calc(10 * var(--u))" parts={{ start: 1, hold: 0.2 }} />
    <p className="pj-body pj-bracelet__words">
      {leadSec != null ? `Watch the wall: how to make it in ${leadSec}…` : 'Make a bracelet, one bead at a time.'}
    </p>
  </div>
);

/** The whole sheet at once, like the handout: the bead page, then the knot page. */
const Overview = ({ nowMs, club }) => {
  const knots = Math.floor(nowMs / 1000 / OVERVIEW_PAGE_SEC) % 2 === 1;
  const steps = BRACELET_STEPS.map((s, i) => ({ s, i })).filter(({ i }) => (knots ? i >= 7 : i < 7));
  return (
    <div className="pj-bracelet__overview">
      <Kicker size="calc(2.6 * var(--u))">{knots ? 'How to tie an adjustable knot' : 'Make your bracelet'}</Kicker>
      <div className={`pj-bracelet__grid${knots ? ' is-knots' : ''}`}>
        {steps.map(({ s, i }) => (
          <div key={s.n} className="pj-bracelet__cell">
            <StepChip label={chipFor(i).label} value={chipFor(i).value} size="calc(2.2 * var(--u))" plate={club.deep} />
            <StepArt step={i} p={1} className="pj-bracelet__thumb" />
            <p className="pj-body pj-bracelet__cell-words">{s.words}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

const Handout = ({ page }) => (
  <div className="pj-bracelet__handout">
    <img src={page === 1 ? handout1 : handout2} alt={page === 1 ? 'Bracelet handout, page 1: add the beads' : 'Bracelet handout, page 2: tie an adjustable knot'} draggable={false} />
  </div>
);
