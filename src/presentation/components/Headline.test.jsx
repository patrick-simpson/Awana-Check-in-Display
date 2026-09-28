import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { Headline, fittedSize } from './Headline.jsx';
import { measureEm } from '../lib/chip.js';

describe('the one headline', () => {
  afterEach(cleanup);

  it('sets each word as its own unbreakable unit, in the shout voice', () => {
    const { container } = render(<Headline text="Welcome to Awana" />);
    const h = container.querySelector('h1.pj-headline');
    expect(h.textContent).toBe('Welcome to Awana');
    expect([...h.querySelectorAll('.w')].map((w) => w.textContent)).toEqual(['Welcome', 'to', 'Awana']);
  });

  it('fits a title to one line, within its bounds', () => {
    const short = fittedSize('HI', { maxU: 7.6, widthU: 82 });
    expect(short).toBe('calc(7.600 * var(--u))');
    const em = measureEm('HAVE A GREAT NIGHT!');
    expect(fittedSize('Have a great night!', { maxU: 20, widthU: 82, minU: 1 })).toBe(`calc(${(82 / em).toFixed(3)} * var(--u))`);
    // Too long for one line: it stops shrinking and wraps between words.
    expect(fittedSize('x '.repeat(80), { maxU: 7.6, widthU: 82, minU: 5 })).toBe('calc(5.000 * var(--u))');
  });
});
