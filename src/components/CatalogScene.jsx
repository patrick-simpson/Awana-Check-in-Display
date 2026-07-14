import { useEffect, useId, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

// The catalog visual language — sky, drifting sparkle doodles, tone-on-tone
// blobs, and the big wave along the bottom — shared by the setup
// placeholder and typed slides. Each theme swaps the gradients while
// keeping the same shapes.
//
// The scene is ALIVE by default: the wave rolls in two parallax layers,
// every doodle twinkles on its own cycle, the blobs breathe, and every so
// often a little sparkle burst "winks" somewhere in the sky. All of it is
// transform/opacity only so cheap signage sticks hold 60fps, and
// <MotionConfig reducedMotion="user"> stills the transforms for viewers
// who prefer less motion. `still` renders a frozen frame — the slide
// editor shows many scenes at once in 0.15-scale thumbnails, where a
// dozen animation loops each would burn CPU for no visible payoff.
// Exported so sibling slide content (e.g. the weather glyph) can pick
// stroke/fill colors that match the scene it's floating in.
export const THEMES = {
  sky: {
    background: 'linear-gradient(180deg, #cae0f2 0%, var(--awana-sky) 55%, #a9c9e6 100%)',
    wave: ['#FFB81C', '#F26B21'],
    doodleStroke: '#ffffff',
    doodleFill: '#ffffff',
    blob: 'rgba(140, 176, 212, 0.35)',
  },
  sunset: {
    background: 'linear-gradient(180deg, #ffe9bd 0%, #ffd28a 55%, #ffb45e 100%)',
    wave: ['#E14B4B', '#F26B21'],
    doodleStroke: '#f28b21',
    doodleFill: '#ffffff',
    blob: 'rgba(240, 166, 80, 0.32)',
  },
  night: {
    background: 'linear-gradient(180deg, #1e2f5c 0%, #3054a8 60%, #24418c 100%)',
    wave: ['#FFB81C', '#F26B21'],
    doodleStroke: '#b9d5ec',
    doodleFill: '#ffd98a',
    blob: 'rgba(23, 38, 82, 0.45)',
  },
  meadow: {
    background: 'linear-gradient(180deg, #d9efda 0%, #c4e8c5 55%, #a5d6a7 100%)',
    wave: ['#4CAF50', '#3B8C3F'],
    doodleStroke: '#ffffff',
    doodleFill: '#ffffff',
    blob: 'rgba(140, 195, 143, 0.4)',
  },
  // The 2026–27 catalog cover: soft lavender sky behind the kids.
  lavender: {
    background: 'linear-gradient(180deg, #cfc9e6 0%, #b7aed6 60%, #a79dcb 100%)',
    wave: ['#FFB81C', '#F26B21'],
    doodleStroke: '#ffffff',
    doodleFill: '#ffffff',
    blob: 'rgba(146, 134, 185, 0.4)',
  },
};

// Sky doodles in scene (1600×900) coordinates — the catalog divider set:
// squiggles, rings, dots, ×'s, sparkles, plus zigzag / stair-step /
// loose-spiral marks. Stroked marks "draw themselves" on mount.
const STROKE_DOODLES = [
  { d: 'M120 180 C160 120 210 120 250 170', w: 4 },
  { d: 'M1370 210 C1400 170 1450 170 1480 205', w: 4 },
  { d: 'M1445 420 l26 26 M1471 420 l-26 26', w: 6 },
  { d: 'M180 430 l22 22 M202 430 l-22 22', w: 5 },
  // zigzag (right-mid, like the Sparks divider)
  { d: 'M1350 600 l22 -26 l22 22 l22 -24 l22 20 l16 -14', w: 5 },
  // stair-step outline (upper-left, like the Puggles divider)
  { d: 'M90 320 v-44 h40 v-40 h40 v-30', w: 4 },
  // loose spiral (upper area, like the Cubbies divider)
  { d: 'M560 210 c-6 -26 18 -48 44 -42 c20 5 30 28 18 44 c-9 12 -28 12 -36 0 c-6 -9 0 -22 11 -23', w: 4 },
];
const RING_DOODLES = [{ cx: 1300, cy: 520, r: 14 }, { cx: 260, cy: 640, r: 10 }];
const DOT_DOODLES = [{ cx: 340, cy: 120, r: 6 }, { cx: 1180, cy: 130, r: 7 }, { cx: 940, cy: 90, r: 5 }];
const SPARKLE_DOODLES = [
  { d: 'M480 100 c3 18 13 28 31 31 c-18 3 -28 13 -31 31 c-3 -18 -13 -28 -31 -31 c18 -3 28 -13 31 -31z' },
  { d: 'M1120 620 c4 22 16 34 38 38 c-22 4 -34 16 -38 38 c-4 -22 -16 -34 -38 -38 c22 -4 34 -16 38 -38z' },
  { d: 'M200 760 c2.5 15 11 23.5 26 26 c-15 2.5 -23.5 11 -26 26 c-2.5 -15 -11 -23.5 -26 -26 c15 -2.5 23.5 -11 26 -26z' },
  { d: 'M1490 700 c3 18 13 28 31 31 c-18 3 -28 13 -31 31 c-3 -18 -13 -28 -31 -31 c18 -3 28 -13 31 -31z' },
];

// One shared twinkle, phase-shifted per mark so the sky never pulses in
// lockstep. transformBox: 'fill-box' makes scale/rotate pivot on each
// mark's own center instead of the SVG origin.
function twinkle(i, extra = {}) {
  return {
    style: { transformBox: 'fill-box', transformOrigin: 'center' },
    animate: { opacity: [0.35, 0.95, 0.35], scale: [0.85, 1.12, 0.85], rotate: [0, 8, 0], ...extra },
    transition: { duration: 3.4 + (i % 5) * 0.7, delay: (i * 1.3) % 4, repeat: Infinity, ease: 'easeInOut' },
  };
}

const WAVE_PATH = 'M0 190 C220 80 420 80 640 160 C880 250 1120 250 1330 150 C1430 105 1530 100 1600 130 L1600 420 L0 420 Z';

function SceneWave({ gradientId, colors, still }) {
  const svg = (back) => (
    <svg className="scene-wave-svg" viewBox="0 0 1600 420" preserveAspectRatio="none" aria-hidden>
      {!back && (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={colors[0]} />
            <stop offset="1" stopColor={colors[1]} />
          </linearGradient>
        </defs>
      )}
      <path fill={back ? colors[0] : `url(#${gradientId})`} opacity={back ? 0.4 : 1} d={WAVE_PATH} />
    </svg>
  );

  if (still) return <div className="scene-wave-layer">{svg(false)}</div>;

  return (
    <>
      {/* Back swell: drifts the opposite way, slightly higher — parallax. */}
      <motion.div
        className="scene-wave-layer scene-wave-layer--back"
        animate={{ x: ['1.4%', '-1.4%'], y: ['-1.2%', '0.6%'] }}
        transition={{
          x: { duration: 26, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' },
          y: { duration: 11, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' },
        }}
      >
        {svg(true)}
      </motion.div>
      <motion.div
        className="scene-wave-layer"
        animate={{ x: ['-1.4%', '1.4%'], y: ['0.8%', '-0.6%'] }}
        transition={{
          x: { duration: 18, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' },
          y: { duration: 8, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' },
        }}
      >
        {svg(false)}
      </motion.div>
    </>
  );
}

// Every 40–60 seconds a tiny sparkle burst pops somewhere in the sky —
// the screen "winks" while idle so it never reads as a freeze-frame.
const WINK_SPARKLE = 'M12 0C13.1 6.9 17.1 10.9 24 12C17.1 13.1 13.1 17.1 12 24C10.9 17.1 6.9 13.1 0 12C6.9 10.9 10.9 6.9 12 0Z';

function SceneWinks({ color }) {
  const [wink, setWink] = useState(null);

  useEffect(() => {
    let showTimer;
    let clearTimer;
    let cancelled = false;
    const schedule = () => {
      showTimer = setTimeout(() => {
        if (cancelled) return;
        setWink({
          id: Date.now(),
          // Upper two-thirds only, clear of the wave.
          x: 8 + Math.random() * 84,
          y: 6 + Math.random() * 52,
        });
        clearTimer = setTimeout(() => { if (!cancelled) setWink(null); }, 1600);
        schedule();
      }, 40000 + Math.random() * 20000);
    };
    schedule();
    return () => { cancelled = true; clearTimeout(showTimer); clearTimeout(clearTimer); };
  }, []);

  return (
    <div className="scene-winks" aria-hidden>
      <AnimatePresence>
        {wink && (
          <motion.div
            key={wink.id}
            className="scene-wink"
            style={{ left: `${wink.x}%`, top: `${wink.y}%` }}
            exit={{ opacity: 0 }}
          >
            {[0, 1, 2, 3, 4].map((i) => {
              const angle = (i / 5) * Math.PI * 2;
              return (
                <motion.svg
                  key={i}
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
                  animate={{
                    x: Math.cos(angle) * 46,
                    y: Math.sin(angle) * 46,
                    scale: [0, 1, 0.2],
                    opacity: [1, 1, 0],
                  }}
                  transition={{ duration: 1.2, ease: 'easeOut' }}
                >
                  <path d={WINK_SPARKLE} fill={color} />
                </motion.svg>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function CatalogScene({ theme = 'sky', still = false, children }) {
  // Editor thumbnails and the fullscreen slideshow render many scenes at
  // once; SVG gradient ids are document-global, so a shared id would
  // silently paint every wave with the first theme's colors.
  const gradientId = useId();
  const t = THEMES[theme] || THEMES.sky;

  return (
    <div className={`catalog-scene catalog-scene--${THEMES[theme] ? theme : 'sky'}`} style={{ background: t.background }}>
      {/* Tone-on-tone blobs behind everything — the catalog dividers float
          a darker organic shape behind the subject. Transform-only
          breathing (drift/rotate/scale), never repainted. */}
      <div className="scene-blobs" aria-hidden>
        <motion.div
          className="scene-blob scene-blob--a"
          style={{ background: t.blob }}
          animate={still ? undefined : { x: [0, 26, 0], y: [0, -18, 0], rotate: [0, 6, 0], scale: [1, 1.05, 1] }}
          transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="scene-blob scene-blob--b"
          style={{ background: t.blob }}
          animate={still ? undefined : { x: [0, -30, 0], y: [0, 14, 0], rotate: [0, -5, 0], scale: [1, 1.06, 1] }}
          transition={{ duration: 30, repeat: Infinity, ease: 'easeInOut', delay: 6 }}
        />
      </div>

      {/* Sparkle doodles twinkling in the sky. */}
      <svg className="scene-doodles" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <g fill="none" stroke={t.doodleStroke} strokeLinecap="round" strokeLinejoin="round" opacity="0.75">
          {STROKE_DOODLES.map((s, i) =>
            still ? (
              <path key={i} d={s.d} strokeWidth={s.w} />
            ) : (
              <motion.g key={i} {...twinkle(i)}>
                <motion.path
                  d={s.d}
                  strokeWidth={s.w}
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.4, delay: 0.3 + i * 0.25, ease: 'easeOut' }}
                />
              </motion.g>
            ),
          )}
          {RING_DOODLES.map((r, i) =>
            still ? (
              <circle key={i} cx={r.cx} cy={r.cy} r={r.r} strokeWidth="3.5" />
            ) : (
              <motion.circle key={i} cx={r.cx} cy={r.cy} r={r.r} strokeWidth="3.5" {...twinkle(i + 7)} />
            ),
          )}
        </g>
        <g fill={t.doodleStroke}>
          {DOT_DOODLES.map((d, i) =>
            still ? (
              <circle key={i} cx={d.cx} cy={d.cy} r={d.r} />
            ) : (
              <motion.circle key={i} cx={d.cx} cy={d.cy} r={d.r} {...twinkle(i + 9)} />
            ),
          )}
        </g>
        <g fill={t.doodleFill} opacity="0.9">
          {SPARKLE_DOODLES.map((s, i) =>
            still ? (
              <path key={i} d={s.d} />
            ) : (
              <motion.path key={i} d={s.d} {...twinkle(i + 12, { rotate: [0, 14, 0] })} />
            ),
          )}
        </g>
      </svg>

      {!still && <SceneWinks color={t.doodleFill} />}

      {/* The big catalog wave rolling along the bottom. It must paint
          BEFORE the children: on tall/narrow screens the wave reaches
          high enough to swallow bottom-anchored text (the setup hint),
          and words are never allowed to hide behind decoration. */}
      <SceneWave gradientId={gradientId} colors={t.wave} still={still} />

      {children}
    </div>
  );
}
