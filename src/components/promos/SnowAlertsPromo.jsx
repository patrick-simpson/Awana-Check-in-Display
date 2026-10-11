import { M } from '../../lib/motion.jsx';
import { landsAt, keyframes, seeded, EASE_SLAM, EASE_OUT } from './kit.jsx';
import { ALERTS_SHORT, alertsQrPath } from '../../lib/alertsQr.js';
import { snowAlertCopy } from '../../lib/snowAlerts.js';

// ─────────────────────────────────────────────────────────────
// Snow alerts: "Know before you go." The text-message sign-up, told as the
// text itself (owner's concept pick, 2026-10-11).
//
// Not a printed poster, so it wears the lobby's own kit (Paytone One shouts,
// Londrina labels, Figtree reading copy), never the posters' faces: every
// class here is `.snow-alerts*`, not `.promo-*` (src/lib/promoFonts.test.js).
// Which week it is, how often it airs and what it says are decided in the
// pure src/lib/snowAlerts.js; this is only the art.
//
// Beat sheet (seconds into the 20 s hold):
//   0.4  a night blizzard comes up in three depths, each one tiled snow the
//        GPU only moves (never redraws), the near one blowing past on the
//        phone's side of the frame only, so it never crosses the words.
//   1.3  the SNOW DAY? kicker slams in (the storm week's names the night).
//   1.7  KNOW BEFORE / YOU GO. drop in word by word.
//   2.6  the phone falls into frame and settles at its tilt; 3.5 its screen
//        wakes to a lock screen; a glow comes up behind it.
//   4.2  the text slides down onto the lock screen and the phone BUZZES,
//        rings running out of it (again at 10.0 and 15.5). The EXAMPLE TEXT
//        tag lands on it at 4.6: the bubble is a sample, never news.
//   4.8  the line under the headline; 5.2 the snowdrifts rise across the
//        foot, burying the phone's base.
//   5.8  the QR plate pops onto the drift, 6.2 the label and the address.
//        Everything is in place by 6.6 and HOLDS, still, to the end: 13+
//        seconds for a parent to get a phone out and scan.
//
// The LAST keyframe of everything is the finished card, which is the frame
// ?lowPower=1 freezes on (the rings end invisible, the buzz at rest, every
// snow loop one whole tile on, which looks exactly like where it started).
// ─────────────────────────────────────────────────────────────

// Each poster exports its detail lines; this one has no rotating line, but
// the table keeps PromoSlide's index whole and names the copy in one place.
export const DETAILS = Object.freeze({
  default: Object.freeze([snowAlertCopy(null).body]),
});

const QR = alertsQrPath();
const BUZZES = Object.freeze([4.25, 10.0, 15.5]);

// ── Snow: three tiles, one per depth ─────────────────────────
// A tile is 600 x 400 user units; the layer moves exactly one tile down and
// across per loop (60 x 40 vmin), so the loop is seamless. Flakes keep clear
// of the tile's edges so its seams never cut one. The wind blows down and to
// the right; a streak is the flake's motion blur, trailing up and left.
const TILE = Object.freeze({ w: 600, h: 400, vw: 60, vh: 40 });

function tileUrl(seed, count, { rMin, rMax, oMin, oMax, streak = 0 }) {
  const rnd = seeded(seed);
  const angle = Math.atan2(TILE.h, TILE.w);
  const pad = rMax + streak + 2;
  let body = '';
  for (let i = 0; i < count; i += 1) {
    const x = pad + rnd() * (TILE.w - pad * 2);
    const y = pad + rnd() * (TILE.h - pad * 2);
    const r = rMin + rnd() ** 2 * (rMax - rMin);
    const o = oMin + rnd() * (oMax - oMin);
    if (streak && r > (rMin + rMax) / 2.4) {
      const len = streak * (r / rMax) * (0.6 + rnd() * 0.8);
      const x2 = x - Math.cos(angle) * len;
      const y2 = y - Math.sin(angle) * len;
      body += `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#fff" stroke-width="${(r * 1.1).toFixed(2)}" stroke-linecap="round" opacity="${(o * 0.5).toFixed(2)}"/>`;
    }
    body += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" fill="#fff" opacity="${o.toFixed(2)}"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${TILE.w} ${TILE.h}">${body}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

const LAYERS = Object.freeze([
  { depth: 'far', image: tileUrl(11, 70, { rMin: 0.9, rMax: 2.2, oMin: 0.3, oMax: 0.6 }), loop: 16, at: 0.4 },
  { depth: 'mid', image: tileUrl(12, 34, { rMin: 1.6, rMax: 3.4, oMin: 0.45, oMax: 0.85, streak: 16 }), loop: 8.5, at: 0.6 },
  { depth: 'near', image: tileUrl(13, 9, { rMin: 3.5, rMax: 8, oMin: 0.6, oMax: 0.95, streak: 46 }), loop: 3.2, at: 0.9 },
]);

function SnowLayer({ layer, storm }) {
  const drift = {
    initial: { x: '0vmin', y: '0vmin' },
    animate: { x: ['0vmin', `${TILE.vw}vmin`], y: ['0vmin', `${TILE.vh}vmin`] },
    transition: { duration: layer.loop * (storm ? 0.75 : 1), ease: 'linear', repeat: Infinity },
  };
  return (
    <M.div
      className={`snow-alerts__snow snow-alerts__snow--${layer.depth}`}
      aria-hidden="true"
      {...landsAt(layer.at, 0.9, { opacity: [0, 1] }, 'easeOut')}
    >
      <M.div
        className="snow-alerts__tile"
        style={{ backgroundImage: layer.image, backgroundSize: `${TILE.vw}vmin ${TILE.vh}vmin` }}
        {...drift}
      />
    </M.div>
  );
}

// ── The copy ─────────────────────────────────────────────────
const KICKER = landsAt(1.3, 0.55, { opacity: [0, 1, 1], scale: [0.55, 1.08, 1], rotate: [-6, 1.5, -2] }, EASE_SLAM);
const WORD_AT = Object.freeze([1.7, 1.86, 2.08, 2.24]);
const word = (i) => landsAt(WORD_AT[i], 0.6, {
  opacity: [0, 1, 1],
  y: ['-0.7em', '0.06em', '0em'],
  rotate: [i % 2 ? 9 : -9, i % 2 ? -1.5 : 1.5, 0],
}, EASE_SLAM);
const BODY = landsAt(4.8, 0.7, { opacity: [0, 1], y: ['0.8em', '0em'] }, EASE_OUT);

// ── The phone ────────────────────────────────────────────────
const PHONE_DROP = keyframes([
  [0, { opacity: 0, y: '-70vh', rotate: -14 }],
  [2.6, { opacity: 0, y: '-70vh', rotate: -14 }],
  [2.62, { opacity: 1 }],
  [3.15, { y: '1.4vh', rotate: 9 }],
  [3.45, { y: '-0.5vh', rotate: 6.4 }],
  [3.7, { y: '0vh', rotate: 7, opacity: 1 }],
], ['linear', 'linear', [0.55, 0, 1, 0.45], EASE_OUT, EASE_OUT]);

// A buzz is a quick side-to-side shudder; it ends where it started.
const BUZZ = keyframes([
  [0, { x: 0, rotate: 0 }],
  ...BUZZES.flatMap((t) => [
    [t, { x: 0, rotate: 0 }],
    [t + 0.06, { x: 7, rotate: 1.2 }],
    [t + 0.12, { x: -7, rotate: -1.2 }],
    [t + 0.18, { x: 6, rotate: 1 }],
    [t + 0.24, { x: -6, rotate: -1 }],
    [t + 0.3, { x: 4, rotate: 0.6 }],
    [t + 0.36, { x: -4, rotate: -0.6 }],
    [t + 0.46, { x: 0, rotate: 0 }],
  ]),
], 'easeInOut');
const RINGS = BUZZES.flatMap((t) => [0, 0.22, 0.44].map((lag, k) => ({
  key: `${t}-${k}`,
  anim: landsAt(t + lag, 1.1, { opacity: [0, 0.7, 0], scale: [0.55, 1.2, 2.1] }, EASE_OUT),
})));
const WAKE = landsAt(3.5, 0.45, { opacity: [0, 1] }, 'easeOut');
const GLOW = landsAt(3.5, 1.1, { opacity: [0, 1] }, 'easeOut');
const NOTE = landsAt(4.2, 0.55, { opacity: [0, 1, 1], y: ['-130%', '6%', '0%'], scale: [0.92, 1.01, 1] }, EASE_SLAM);
const TAG = landsAt(4.6, 0.5, { opacity: [0, 1, 1], scale: [0.4, 1.12, 1], rotate: [-18, 4, 0] }, EASE_SLAM);
const SCREEN_SNOW = (() => {
  const rnd = seeded(77);
  return Array.from({ length: 34 }, (_, i) => ({
    key: i, cx: (rnd() * 100).toFixed(1), cy: (rnd() * 100).toFixed(1), r: (0.25 + rnd() * 0.6).toFixed(2), o: (0.25 + rnd() * 0.5).toFixed(2),
  }));
})();

// ── The drifts and the code ──────────────────────────────────
const DRIFT = (at) => landsAt(at, 0.8, { y: ['30%', '-1.5%', '0%'] }, EASE_OUT);
const DRIFT_BACK = DRIFT(5.2);
const DRIFT_MID = DRIFT(5.35);
const DRIFT_FRONT = DRIFT(5.5);
const PLATE = landsAt(5.8, 0.55, { opacity: [0, 1, 1], scale: [0.4, 1.07, 1], rotate: [-8, 1.5, 0] }, EASE_SLAM);
const SCAN = landsAt(6.2, 0.5, { opacity: [0, 1], x: ['-1.2em', '0em'] }, EASE_OUT);
const URL = landsAt(6.35, 0.55, { opacity: [0, 1], x: ['-0.6em', '0em'] }, EASE_OUT);

/** Each headline word lands on its own beat, counted across both lines. */
function headlineLines(headline) {
  const out = [];
  let first = 0;
  for (const line of headline) {
    const words = line.split(' ');
    out.push({ line, words, first });
    first += words.length;
  }
  return out;
}

function Snowflake({ size }) {
  let d = '';
  for (let k = 0; k < 6; k += 1) {
    const a = (Math.PI / 3) * k;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const p = (r, t) => `${(ca * r - sa * t).toFixed(2)} ${(sa * r + ca * t).toFixed(2)}`;
    d += `M0 0L${p(10, 0)}M${p(5.5, 0)}L${p(7.8, 2)}M${p(5.5, 0)}L${p(7.8, -2)}`;
  }
  return (
    <svg width={size} height={size} viewBox="-12 -12 24 24" aria-hidden="true">
      <path d={d} fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export default function SnowAlertsPromo({ promo }) {
  const copy = snowAlertCopy(promo?.snow ?? null);
  const lines = headlineLines(copy.headline);

  return (
    <div
      className={`promo-slide promo-slide--snow snow-alerts${copy.storm ? ' snow-alerts--storm' : ''}`}
      role="img"
      aria-label={`${copy.kicker}. ${copy.headline.join(' ')} ${copy.body} Scan the code or visit ${ALERTS_SHORT}.`}
    >
      <div className="snow-alerts__sky" aria-hidden="true" />
      <SnowLayer layer={LAYERS[0]} storm={copy.storm} />
      <SnowLayer layer={LAYERS[1]} storm={copy.storm} />

      {/* The phone, and the glow and rings it throws, sit behind the drifts. */}
      <div className="snow-alerts__stage" aria-hidden="true">
        <M.div className="snow-alerts__glow" {...GLOW} />
        <div className="snow-alerts__rings">
          {RINGS.map((r) => <M.div key={r.key} className="snow-alerts__ring" {...r.anim} />)}
        </div>
        <M.div className="snow-alerts__phone-slot" {...PHONE_DROP}>
          <M.div className="snow-alerts__phone" {...BUZZ}>
            <div className="snow-alerts__screen">
              <M.div className="snow-alerts__lock" {...WAKE}>
                <svg className="snow-alerts__screen-snow" viewBox="0 0 100 100" preserveAspectRatio="none">
                  {SCREEN_SNOW.map((f) => <circle key={f.key} cx={f.cx} cy={f.cy} r={f.r} fill="#fff" opacity={f.o} />)}
                </svg>
                <div className="snow-alerts__clock">
                  <span className="snow-alerts__day">Wednesday</span>
                  <span className="snow-alerts__time">4:30</span>
                </div>
                <M.div className="snow-alerts__note" {...NOTE}>
                  <div className="snow-alerts__note-head">
                    <span className="snow-alerts__app"><Snowflake size="72%" /></span>
                    <span className="snow-alerts__sender">KVB Church</span>
                    <span className="snow-alerts__now">now</span>
                  </div>
                  <div className="snow-alerts__note-title">Snow day: no Awana tonight</div>
                  <div className="snow-alerts__note-body">Roads are bad, so club is canceled. Stay warm, see you next week!</div>
                </M.div>
              </M.div>
              <div className="snow-alerts__island" />
            </div>
          </M.div>
          <M.div className="snow-alerts__tag" {...TAG}>Example text</M.div>
        </M.div>
      </div>

      <svg className="snow-alerts__drifts" viewBox="0 0 1600 900" preserveAspectRatio="none" aria-hidden="true">
        <M.path {...DRIFT_BACK} d="M0 770 C220 720 380 780 600 752 C860 718 1020 790 1260 748 C1400 724 1500 740 1600 728 V940 H0Z" fill="#c9daf2" />
        <M.path {...DRIFT_MID} d="M0 812 C260 776 470 836 720 808 C980 778 1180 842 1400 806 C1490 792 1550 800 1600 796 V940 H0Z" fill="#e4eefb" />
        <M.path {...DRIFT_FRONT} d="M0 856 C300 828 560 878 860 852 C1120 830 1360 880 1600 846 V940 H0Z" fill="#ffffff" />
      </svg>

      {/* The words and the code, above the drifts. */}
      <div className="snow-alerts__stage">
        <div className="snow-alerts__copy">
          <M.div className="snow-alerts__kicker" {...KICKER}>{copy.kicker}</M.div>
          <h2 className="snow-alerts__headline" aria-label={copy.headline.join(' ')}>
            {lines.map(({ line, words: lineWords, first }) => (
              <span className="snow-alerts__line" key={line} aria-hidden="true">
                {lineWords.map((w, wi) => (
                  <M.span className="snow-alerts__word" key={`${w}-${wi}`} {...word(Math.min(first + wi, WORD_AT.length - 1))}>{w}</M.span>
                ))}
              </span>
            ))}
          </h2>
          <M.p className="snow-alerts__body" {...BODY}>{copy.body}</M.p>
        </div>

        <div className="snow-alerts__scan">
          <M.div className="snow-alerts__plate" {...PLATE}>
            <svg className="snow-alerts__qr" viewBox={`-2 -2 ${QR.size + 4} ${QR.size + 4}`} shapeRendering="crispEdges" role="img" aria-label={`QR code for ${ALERTS_SHORT}`}>
              <rect x="-2" y="-2" width={QR.size + 4} height={QR.size + 4} fill="#fff" />
              <path d={QR.d} fill="#0b1633" />
            </svg>
          </M.div>
          <div className="snow-alerts__where">
            <M.div className="snow-alerts__scan-label" {...SCAN}>Scan for the text</M.div>
            <M.div className="snow-alerts__url" {...URL}>{ALERTS_SHORT}</M.div>
          </div>
        </div>
      </div>

      <div className="snow-alerts__near" aria-hidden="true">
        <SnowLayer layer={LAYERS[2]} storm={copy.storm} />
      </div>
    </div>
  );
}
