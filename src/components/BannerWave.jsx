import { M } from '../lib/motion.jsx';

/**
 * The wavy crest along the top of the lower-third banner band — the
 * same organic wave language as the catalog's club divider pages
 * (a soft, full two-hump curve), so the banner reads as part of the
 * scene instead of a box over it. A translucent offset wave behind the
 * main one adds depth, and the two layers drift against each other so
 * the crest keeps rolling the whole time the banner is up.
 *
 * Paths overshoot the 0–1600 viewBox by 60 units each side so the
 * horizontal drift never exposes a gap at the edges.
 */
const CREST = 'M-60 86 C240 24 520 22 820 62 C1120 102 1380 96 1660 44 L1660 130 L-60 130 Z';

export default function BannerWave() {
  return (
    <svg className="banner-wave" viewBox="0 0 1600 130" preserveAspectRatio="none" aria-hidden>
      <M.path
        d={CREST}
        fill="rgba(255, 255, 255, 0.35)"
        initial={{ y: -16 }}
        animate={{ x: [18, -18], y: [-16, -13, -16] }}
        transition={{
          x: { duration: 13, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' },
          y: { duration: 6, repeat: Infinity, ease: 'easeInOut' },
        }}
      />
      <M.path
        d={CREST}
        fill="var(--band-top)"
        animate={{ x: [-18, 18] }}
        transition={{ x: { duration: 9, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' } }}
      />
    </svg>
  );
}
