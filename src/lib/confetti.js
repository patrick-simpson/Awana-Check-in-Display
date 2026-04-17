import confetti from 'canvas-confetti';

// Standard celebration: two side cannons using the club's colors.
export function fireStandard(colors) {
  const defaults = { spread: 60, ticks: 180, gravity: 0.9, scalar: 1.1, colors };
  confetti({ ...defaults, particleCount: 80, angle: 60, origin: { x: 0, y: 0.75 } });
  confetti({ ...defaults, particleCount: 80, angle: 120, origin: { x: 1, y: 0.75 } });
}

// Birthday: a fireworks-style burst plus a rainbow shower from the top.
export function fireBirthday() {
  const colors = ['#FF1744', '#F50057', '#AA00FF', '#FFD600', '#00E676', '#2979FF'];
  const end = Date.now() + 1500;
  (function frame() {
    confetti({
      particleCount: 6, angle: 60, spread: 80,
      origin: { x: 0, y: 0.6 }, colors, scalar: 1.2,
    });
    confetti({
      particleCount: 6, angle: 120, spread: 80,
      origin: { x: 1, y: 0.6 }, colors, scalar: 1.2,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
  // One big center pop on top.
  setTimeout(() => {
    confetti({
      particleCount: 200, spread: 180, startVelocity: 40, ticks: 250,
      origin: { x: 0.5, y: 0.35 }, colors,
      shapes: ['star', 'circle'], scalar: 1.4,
    });
  }, 200);
}

// First-timer: gentle golden stars drifting down.
export function fireFirstTimer() {
  const colors = ['#FFD54F', '#FFB300', '#FFF176', '#FFFFFF'];
  confetti({
    particleCount: 150, spread: 160, startVelocity: 35, ticks: 260,
    origin: { x: 0.5, y: 0.3 }, colors,
    shapes: ['star'], scalar: 1.3,
    gravity: 0.6,
  });
  setTimeout(() => {
    confetti({
      particleCount: 40, spread: 360, startVelocity: 15, ticks: 200,
      origin: { x: 0.5, y: 0.5 }, colors,
      shapes: ['star'], scalar: 1.0,
    });
  }, 500);
}
