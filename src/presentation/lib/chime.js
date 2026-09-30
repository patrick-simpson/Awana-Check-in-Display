// The chime 10 seconds before each Bracelet Time epic (owner, 2026-09-30).
// A synthesized bell (no audio file), on its own AudioContext so it never
// depends on the countdown stingers' toggle (which is off by default).
//
// Browsers only let a page make sound after a person has pressed a key or
// clicked it. App.jsx calls unlockAudio() from EVERY keydown and pointerdown
// (not once: a projector's audio device can change and suspend the context
// again). playBraceletChime() plays only on a context that is already
// running, and never queues a sound on a suspended one, which would blast it
// minutes later at the operator's next click. The wall shows its own visual
// countdown in those 10 seconds, so a silent room still looks up.

let ctx = null;

function context() {
  if (ctx) return ctx;
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    return null;
  }
  return ctx;
}

/** Called inside a user gesture: wakes the context (and primes Safari with a silent buffer). */
export function unlockAudio() {
  const ac = context();
  if (!ac) return;
  try {
    if (ac.state !== 'running') ac.resume().catch(() => {});
    const buf = ac.createBuffer(1, 1, 22050);
    const src = ac.createBufferSource();
    src.buffer = buf;
    src.connect(ac.destination);
    src.start(0);
  } catch {
    /* audio unavailable */
  }
}

/** 'running' when a chime would be heard now, else why not. */
export function audioState() {
  const ac = context();
  if (!ac) return 'unsupported';
  return ac.state;
}

/**
 * A bright four-note bell (E5, G#5, B5, E6). Returns whether it played.
 * @param {number} [volume] peak gain, 0..0.5
 */
export function playBraceletChime(volume = 0.25) {
  const ac = context();
  if (!ac || ac.state !== 'running') return false;
  try {
    const t0 = ac.currentTime + 0.02;
    const master = ac.createGain();
    master.gain.value = Math.min(0.5, Math.max(0, volume));
    const comp = ac.createDynamicsCompressor();
    master.connect(comp).connect(ac.destination);
    [659.25, 830.61, 987.77, 1318.51].forEach((freq, i) => {
      const start = t0 + i * 0.16;
      for (const [type, mul, amp, decay] of [['sine', 1, 1, 1.6], ['triangle', 2, 0.18, 0.7]]) {
        const osc = ac.createOscillator();
        const g = ac.createGain();
        osc.type = /** @type {OscillatorType} */ (type);
        osc.frequency.value = freq * mul;
        g.gain.setValueAtTime(0.0001, start);
        g.gain.exponentialRampToValueAtTime(amp, start + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, start + decay);
        osc.connect(g).connect(master);
        osc.start(start);
        osc.stop(start + decay + 0.05);
      }
    });
    return true;
  } catch {
    return false;
  }
}

// One chime per showing, however often the view remounts or re-renders.
const chimed = new Set();
/** @param {string} key e.g. `${epicStartMs}` */
export function chimeOnce(key, volume) {
  if (chimed.has(key)) return false;
  chimed.add(key);
  return playBraceletChime(volume);
}
