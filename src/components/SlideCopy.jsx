import { createElement, Fragment, useMemo, useState } from 'react';
import { M } from '../lib/motion.jsx';
import { EASE } from '../lib/brand.js';
import { useFontsReady } from '../hooks/useFontsReady.js';
import StepChip from './brand/StepChip.jsx';
import { CHIP, KICKER, SUB, fitFrame, LOBBY_THEMES, lobbyTheme } from '../lib/lobbyFrame.js';
import {
  HANDOFF, copyBeats, entranceHold, exitDelay, holdThenLand, holdThenLeave, vanishAtSwap,
} from '../lib/lobbyMotion.js';

/** A length in the lobby's unit (see src/lib/lobbyFrame.js). */
const u = (n) => `calc(${n} * var(--u))`;

// The fit measures words in these faces, and a face the browser has not
// fetched yet measures as its fallback. Web fonts load on first use, so ask
// for all four as soon as the lobby is imported: the first slide is then
// fitted in the real faces instead of refitting a beat later.
if (typeof document !== 'undefined' && document.fonts?.load) {
  for (const font of ['400 1em Galindo', '800 1em "Figtree Variable"', '700 1em "Figtree Variable"', '400 1em "Londrina Solid"']) {
    document.fonts.load(font).catch(() => {});
  }
}

/**
 * One piece of copy that lands and leaves on its own beat. `still` (the slide
 * editor's thumbnails) renders the plain element at rest; otherwise it is an
 * M element whose entrance is one "hold, then land" keyframe list, fixed at
 * mount, and whose exit is a variant AnimatePresence resolves with its
 * `custom` (true: the stinger is covering the change).
 */
function Piece({ tag = 'span', still, enter, leave, children, ...rest }) {
  if (still) return createElement(tag, rest, children);
  const Tag = M[tag];
  return (
    <Tag
      {...rest}
      initial={enter.initial}
      animate={enter.animate}
      transition={enter.transition}
      variants={leave}
      exit="leave"
    >
      {children}
    </Tag>
  );
}

/** Lift away (a hand-off) or wait for the wave and go (a wipe). */
function leaveFor(i, n) {
  return {
    leave: (wipe) => (wipe
      ? vanishAtSwap({ opacity: 1 }, { opacity: 0 })
      : holdThenLeave(exitDelay(i, n), HANDOFF.exit, { opacity: 1, y: '0em' }, { opacity: 0, y: '-0.5em' }, EASE.exit)),
  };
}

/**
 * The lobby's copy frame, from the approved mockup: a kicker in Londrina
 * Solid, the headline in true-size Galindo with a hard offset shadow, an
 * optional supporting line and an optional stepped chip, centred on the
 * upper middle of the 16:9 stage box. Sizes and line breaks come from the
 * pure fit (src/lib/lobbyFrame.js), measured in the real faces and redone
 * when a web font finishes loading.
 *
 * On a hand-off the incoming copy mounts beside the outgoing one and holds
 * invisible until the outgoing words have lifted clear (`via` decides how
 * long); then the kicker lands, the words land one by one and the chip pops
 * last. Every colour rides on the copy itself, so an outgoing slide never
 * repaints in the incoming slide's theme mid-exit.
 *
 * @param {{
 *   frame: import('../lib/lobbyFrame.js').Frame,
 *   theme?: string,
 *   via?: import('../lib/lobbyMotion.js').Via,
 *   still?: boolean,
 *   slide?: boolean,
 *   sizeClass?: string,
 *   className?: string,
 * }} props
 *
 * `slide` marks a slide's copy (the slideshow and the editor's thumbnails)
 * with the typed-slide class names the rest of the app already looks for
 * (manual-slide-eyebrow / -text / -subtext); the idle placeholder is not a
 * slide and never carries them.
 */
export default function SlideCopy({ frame, theme = 'sky', via = 'boot', still = false, slide = false, sizeClass = '', className = '' }) {
  const loads = useFontsReady();
  const { kicker, headline, sub, chip, textSize } = frame;
  const chipLabel = chip?.label ?? '';
  const chipValue = chip?.value ?? '';
  const fit = useMemo(() => {
    void loads; // re-measure once the real faces have loaded
    return fitFrame({
      kicker, headline, sub, textSize,
      chip: chipLabel && chipValue ? { label: chipLabel, value: chipValue } : null,
    });
  }, [kicker, headline, sub, textSize, chipLabel, chipValue, loads]);
  // How long this copy waits before it lands, fixed at mount.
  const [hold] = useState(() => entranceHold(via));

  const t = LOBBY_THEMES[lobbyTheme(theme)];
  const { mode, lines } = fit.headline;
  const beats = copyBeats(fit, hold);
  const leave = (beat) => leaveFor(beat.index, beats.pieces);

  return (
    <div
      className={`lobby-copy ${className}`.trim()}
      style={{
        top: u(fit.top),
        '--lobby-kicker': t.kicker,
        '--lobby-face': t.face,
        '--lobby-shadow': t.shadow,
        '--lobby-sub': t.sub,
      }}
    >
      {fit.kicker && (
        <Piece
          tag="div"
          still={still}
          className={`lobby-kicker${slide ? ' manual-slide-eyebrow' : ''}`}
          style={{ fontSize: u(fit.kicker.size), marginBottom: lines.length ? u(KICKER.gap) : 0 }}
          enter={holdThenLand(beats.kicker.at, HANDOFF.kicker, { opacity: 0, y: '0.52em' }, { opacity: 1, y: '0em' }, EASE.settle)}
          leave={leave(beats.kicker)}
        >
          {fit.kicker.text}
        </Piece>
      )}

      {lines.length > 0 && (
        <p
          className={`lobby-headline lobby-headline--${mode}${fit.headline.overflow ? ' lobby-headline--overflow' : ''}${slide ? ` manual-slide-text ${sizeClass}` : ''}`.trim()}
          style={{ fontSize: u(fit.headline.size), lineHeight: fit.headline.lineHeight }}
        >
          {mode === 'shout'
            // Every word is a sibling, the lines split by <br>: a refit that
            // moves a word to another line (a web font landing late) keeps
            // the same element, so it never replays its entrance.
            ? beats.lines.flatMap((line, li) => line.words.map((w, wi) => (
              <Fragment key={w.index}>
                {wi > 0 && ' '}
                {li > 0 && wi === 0 && <>{' '}<br /></>}
                <Piece
                  still={still}
                  className="lobby-word"
                  enter={holdThenLand(w.at, HANDOFF.word, { opacity: 0, y: '0.45em', scale: 0.85 }, { opacity: 1, y: '0em', scale: 1 }, EASE.settle)}
                  leave={leave(w)}
                >
                  {w.text}
                </Piece>
              </Fragment>
            )))
            : beats.lines.map((line, li) => (
              <Fragment key={li}>
                {li > 0 && ' '}
                <Piece
                  still={still}
                  className="lobby-line"
                  enter={holdThenLand(line.at, HANDOFF.word, { opacity: 0, y: '0.45em' }, { opacity: 1, y: '0em' }, EASE.settle)}
                  leave={leave(line)}
                >
                  {lines[li].join(' ')}
                </Piece>
              </Fragment>
            ))}
        </p>
      )}

      {fit.sub && (
        <Piece
          tag="p"
          still={still}
          className={`lobby-sub${slide ? ' manual-slide-subtext' : ''}`}
          style={{ fontSize: u(fit.sub.size), marginTop: u(SUB.gap) }}
          enter={holdThenLand(beats.sub.at, HANDOFF.word, { opacity: 0, y: '0.4em' }, { opacity: 1, y: '0em' }, EASE.settle)}
          leave={leave(beats.sub)}
        >
          {fit.sub.lines.map((l, i) => <span key={i} className="lobby-sub__line">{i > 0 && ' '}{l}</span>)}
        </Piece>
      )}

      {fit.chip && (
        <div className="lobby-chip-row" style={{ marginTop: u(CHIP.gap) }}>
          <Piece
            tag="div"
            still={still}
            className="lobby-chip"
            style={{ fontSize: u(fit.chip.size) }}
            enter={holdThenLand(beats.chip.at, HANDOFF.chip, { opacity: 0, scale: 0.4, rotate: -8 }, { opacity: 1, scale: 1, rotate: 0 }, EASE.pop)}
            leave={leave(beats.chip)}
          >
            <StepChip label={fit.chip.label} value={fit.chip.value} size="1em" />
          </Piece>
        </div>
      )}
    </div>
  );
}
