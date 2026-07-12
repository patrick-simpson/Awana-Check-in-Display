/**
 * The wavy crest along the top of the lower-third banner band — the
 * same organic wave language as the catalog (and the slide themes),
 * so the banner reads as part of the scene instead of a box over it.
 * A translucent offset wave behind the main one adds depth.
 * Colors come from the band's --band-top custom property.
 */
export default function BannerWave() {
  return (
    <svg className="banner-wave" viewBox="0 0 1600 130" preserveAspectRatio="none" aria-hidden>
      <path
        d="M0 92 C260 30 520 22 800 66 C1080 110 1340 106 1600 48 L1600 130 L0 130 Z"
        fill="rgba(255, 255, 255, 0.35)"
        transform="translate(0 -16)"
      />
      <path
        d="M0 92 C260 30 520 22 800 66 C1080 110 1340 106 1600 48 L1600 130 L0 130 Z"
        fill="var(--band-top)"
      />
    </svg>
  );
}
