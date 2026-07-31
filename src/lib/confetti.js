import confetti from 'canvas-confetti';

// Every burst respects prefers-reduced-motion (canvas-confetti no-ops the
// call entirely), keeping the display comfortable on low-power signage
// sticks and for motion-sensitive viewers.
const BASE = { disableForReducedMotion: true };

// During a check-in rush banners (and their confetti) fire back-to-back;
// thinning the particles keeps the animation at 60fps on cheap hardware.
let loadFactor = 1;
export function setConfettiLoad(bursting) {
  loadFactor = bursting ? 0.5 : 1;
}

// Operator-tunable room-wide intensity (Settings → Banners):
// 'full' 1×, 'reduced' 0.5×, 'off' skips every burst entirely.
let levelFactor = 1;
export function setConfettiLevel(level) {
  levelFactor = level === 'off' ? 0 : level === 'reduced' ? 0.5 : 1;
}
const off = () => levelFactor === 0;
const scaled = (count) => Math.max(1, Math.round(count * loadFactor * levelFactor));

// Standard celebration: two side cannons using the club's colors.
export function fireStandard(colors) {
  if (off()) return;
  const defaults = { ...BASE, spread: 60, ticks: 180, gravity: 0.9, scalar: 1.1, colors };
  confetti({ ...defaults, particleCount: scaled(80), angle: 60, origin: { x: 0, y: 0.75 } });
  confetti({ ...defaults, particleCount: scaled(80), angle: 120, origin: { x: 1, y: 0.75 } });
}

// Birthday: a fireworks-style burst plus a rainbow shower from the top.
export function fireBirthday() {
  if (off()) return;
  const colors = ['#FF1744', '#F50057', '#AA00FF', '#FFD600', '#00E676', '#2979FF'];
  const end = Date.now() + 1500;
  (function frame() {
    confetti({
      ...BASE,
      particleCount: scaled(6), angle: 60, spread: 80,
      origin: { x: 0, y: 0.6 }, colors, scalar: 1.2,
    });
    confetti({
      ...BASE,
      particleCount: scaled(6), angle: 120, spread: 80,
      origin: { x: 1, y: 0.6 }, colors, scalar: 1.2,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
  // One big center pop on top.
  setTimeout(() => {
    confetti({
      ...BASE,
      particleCount: scaled(200), spread: 180, startVelocity: 40, ticks: 250,
      origin: { x: 0.5, y: 0.35 }, colors,
      shapes: ['star', 'circle'], scalar: 1.4,
    });
  }, 200);
}

// First-timer: gentle golden stars drifting down.
export function fireFirstTimer() {
  if (off()) return;
  const colors = ['#FFD54F', '#FFB300', '#FFF176', '#FFFFFF'];
  confetti({
    ...BASE,
    particleCount: scaled(150), spread: 160, startVelocity: 35, ticks: 260,
    origin: { x: 0.5, y: 0.3 }, colors,
    shapes: ['star'], scalar: 1.3,
    gravity: 0.6,
  });
  setTimeout(() => {
    confetti({
      ...BASE,
      particleCount: scaled(40), spread: 360, startVelocity: 15, ticks: 200,
      origin: { x: 0.5, y: 0.5 }, colors,
      shapes: ['star'], scalar: 1.0,
    });
  }, 500);
}

// Tally milestone (every Nth check-in): a big room-wide moment in Awana
// gold and club colors, bigger than any single kid's banner burst.
/**
 * Room-wide milestone burst.
 *
 * `big` escalates it for a named night threshold (the 100th kid) so that reads
 * as an occasion rather than another routine every-25 toast. It only scales the
 * existing burst — it does NOT bypass `scaled()` or `off()`, so the rush
 * throttle, the operator's confetti-level setting and reduced-motion all still
 * win. A milestone is never a reason to override someone's accessibility
 * preference.
 *
 * @param {{ big?: boolean }} [opts]
 */
export function fireMilestone(opts) {
  if (off()) return;
  const big = !!(opts && opts.big);
  const colors = ['#F7A41C', '#FFD257', '#FFFFFF', '#4CAF50', '#2979FF', '#E53935'];
  confetti({
    ...BASE,
    particleCount: scaled(big ? 260 : 160),
    spread: big ? 150 : 120,
    startVelocity: big ? 52 : 45,
    ticks: big ? 340 : 280,
    origin: { x: 0.5, y: 0.65 }, colors, scalar: big ? 1.5 : 1.3,
    shapes: ['star', 'circle'],
  });
  setTimeout(() => {
    const cannons = { ...BASE, spread: 70, ticks: 220, colors, scalar: 1.15 };
    const n = scaled(big ? 110 : 70);
    confetti({ ...cannons, particleCount: n, angle: 60, origin: { x: 0, y: 0.85 } });
    confetti({ ...cannons, particleCount: n, angle: 120, origin: { x: 1, y: 0.85 } });
  }, 250);
  // A big milestone gets a second wave so it visibly outlasts a normal one.
  if (big) {
    setTimeout(() => {
      confetti({
        ...BASE,
        particleCount: scaled(120), spread: 130, startVelocity: 40, ticks: 260,
        origin: { x: 0.5, y: 0.5 }, colors, scalar: 1.4, shapes: ['star'],
      });
    }, 700);
  }
}
