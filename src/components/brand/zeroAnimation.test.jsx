import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { ZeroAnimationContext } from '../../lib/motion.jsx';
import Wave from './Wave.jsx';
import CornerTab from './CornerTab.jsx';
import Sticker from './Sticker.jsx';
import DoodleCluster from './DoodleCluster.jsx';

// Under ?lowPower=1 (the Pi Zero embed) nothing may move, and whatever a
// primitive is animating toward is the frame that screen shows for good.
// This renders each primitive through the REAL framer-motion (no mock)
// inside zero-animation mode and checks that every element lands on its
// resting frame at once: full opacity, no leftover transform, and for the
// doodles' endless twinkle, the loop's last keyframe (full size, upright).
//
// The later stages sample the same thing on the live page once these are
// wired into screens; until then this is the gate the plan promised.

afterEach(cleanup);

const zero = (ui) => render(<ZeroAnimationContext.Provider value>{ui}</ZeroAnimationContext.Provider>);

// Far shorter than any entrance below (the shortest runs 460 ms, most wait
// out a delay first), so only an instant jump can pass inside it.
const INSTANT = { timeout: 150 };

/** An element is at rest when nothing about it is still mid-entrance. */
function atRest(el) {
  const opacity = el.style.opacity === '' ? 1 : Number(el.style.opacity);
  const t = el.style.transform;
  return opacity === 1 && (t === '' || t === 'none');
}

// The entrances the check-in moment will actually use (stage 3's plan):
// a wave that rises, a tab that slides in, a sticker that pops.
const ENTRANCES = {
  wave: { initial: { y: '100%' }, animate: { y: 0 }, transition: { duration: 0.64, ease: [0.76, 0, 0.24, 1] } },
  tab: { initial: { x: '-100%', opacity: 0 }, animate: { x: 0, opacity: 1 }, transition: { duration: 0.52, delay: 0.3 } },
  sticker: { initial: { scale: 0, rotate: -30 }, animate: { scale: 1, rotate: 0 }, transition: { duration: 0.46, delay: 0.9 } },
};

describe('brand primitives under zero-animation mode', () => {
  it('a rising wave is already risen', async () => {
    const { container } = zero(<Wave color="#F04A4B" {...ENTRANCES.wave} />);
    const el = container.querySelector('.brand-wave');
    await waitFor(() => expect(atRest(el)).toBe(true), INSTANT);
  });

  it('a sliding corner tab is already in place', async () => {
    const { container } = zero(<CornerTab color="#58BD79" {...ENTRANCES.tab}>T&amp;T</CornerTab>);
    const el = container.querySelector('.brand-tab');
    await waitFor(() => expect(atRest(el)).toBe(true), INSTANT);
  });

  it('a popping sticker is already stuck on', async () => {
    const { container } = zero(<Sticker {...ENTRANCES.sticker}>NEW!</Sticker>);
    const el = container.querySelector('.brand-sticker');
    await waitFor(() => expect(atRest(el)).toBe(true), INSTANT);
  });

  it('every doodle has landed, and the twinkle rests at full size', async () => {
    const items = [
      { kind: 'sparkle', x: '0', y: '0', size: '1em' },
      { kind: 'dot', x: '0', y: '0', size: '1em' },
      { kind: 'ring', x: '0', y: '0', size: '1em' },
    ];
    const { container } = zero(<DoodleCluster items={items} delay={1.2} twinkle />);
    const doodles = [...container.querySelectorAll('.brand-doodle')];
    const twinkles = [...container.querySelectorAll('.brand-doodle__twinkle')];
    expect(doodles).toHaveLength(3);
    expect(twinkles).toHaveLength(3);
    await waitFor(() => {
      for (const el of [...doodles, ...twinkles]) expect(atRest(el)).toBe(true);
    }, INSTANT);
  });

  it('a rotated doodle rests at its own angle, not mid-spin', async () => {
    const { container } = zero(<DoodleCluster items={[{ kind: 'sparkle', x: '0', y: '0', size: '1em', rotate: 20 }]} />);
    const el = container.querySelector('.brand-doodle');
    await waitFor(() => {
      expect(Number(el.style.opacity || 1)).toBe(1);
      expect(el.style.transform).toBe('rotate(20deg)');
    }, INSTANT);
  });
});
