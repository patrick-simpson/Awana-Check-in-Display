import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { M } from '../lib/motion.jsx';
import { NAME_ENTRANCES } from '../lib/nameAccent.js';
import AnimatedName from './AnimatedName.jsx';

// The banners orchestrate these letters through a parent variant ("hidden" →
// "show"), so the entrance is only observable from the parent's hidden state —
// which is exactly the frame that has to differ per entrance.
function renderAt(entrance, name = 'Mia!') {
  return render(
    <M.h1 initial="hidden">
      <AnimatedName name={name} entrance={entrance} />
    </M.h1>
  );
}

const letters = (container) => [...container.querySelectorAll('.name-letter')];
const startY = (el) => {
  const m = /translateY\(([-\d.]+)px\)/.exec(el.style.transform ?? '');
  return m ? Number(m[1]) : 0;
};

describe('AnimatedName entrances (#336)', () => {
  afterEach(cleanup);

  it('renders the name per letter whichever entrance it is given', () => {
    for (const entrance of NAME_ENTRANCES) {
      const { container, unmount } = renderAt(entrance);
      expect(letters(container)).toHaveLength(4); // M i a !
      expect(container.textContent).toBe('Mia!');
      unmount();
    }
  });

  it('starts "pop" below the line, as it always did', () => {
    const { container } = renderAt('pop');
    for (const el of letters(container)) expect(startY(el)).toBe(34);
  });

  it('starts "drop" above the line instead', () => {
    const { container } = renderAt('drop');
    for (const el of letters(container)) expect(startY(el)).toBe(-46);
  });

  it('starts "wave" at a different height per letter, some above and some below', () => {
    const { container } = renderAt('wave', 'Jonathan!');
    const ys = letters(container).map(startY);
    expect(new Set(ys).size).toBeGreaterThan(3);
    expect(Math.min(...ys)).toBeLessThan(0);
    expect(Math.max(...ys)).toBeGreaterThan(0);
  });

  it('defaults to "pop" with no prop, so the component stays usable anywhere', () => {
    const { container } = render(<M.h1 initial="hidden"><AnimatedName name="Mia!" /></M.h1>);
    for (const el of letters(container)) expect(startY(el)).toBe(34);
  });

  it('falls back to "pop" for an unknown id rather than dropping the name', () => {
    const { container } = renderAt('nonsense');
    expect(container.textContent).toBe('Mia!');
    for (const el of letters(container)) expect(startY(el)).toBe(34);
  });

  it('animates long names per WORD, so the per-letter guard still holds', () => {
    // Over PER_LETTER_MAX (14): the word path has no entrance table at all, so
    // a cheap signage stick never runs dozens of springs for one banner.
    const { container } = renderAt('wave', 'Bartholomew Fitzgerald!');
    expect(letters(container)).toHaveLength(2);
    for (const el of letters(container)) expect(startY(el)).toBe(26);
  });
});
