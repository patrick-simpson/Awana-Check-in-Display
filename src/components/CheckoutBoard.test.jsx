import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { ZeroAnimationContext } from '../lib/motion.jsx';
import CheckoutBoard from './CheckoutBoard.jsx';
import { getClubPalette } from '../lib/clubs.js';

// The board's visibility and naming rules live in src/lib/checkoutBoard.js
// (decideBoard, tested there); this pins that the kit card renders each
// decision it is handed with its wording intact.
afterEach(cleanup);
const still = (ui) => render(<ZeroAnimationContext.Provider value>{ui}</ZeroAnimationContext.Provider>);

const checkout = {
  entries: [
    { firstName: 'Sample Star', club: 'Sparks' },
    { firstName: 'Demo Kid', club: 'Sparks' },
    { firstName: 'Test Kid', club: 'T&T' },
  ],
  printed: 43,
  at: Date.now(),
};

describe('CheckoutBoard', () => {
  it('renders nothing for a hidden decision', () => {
    const { container } = still(<CheckoutBoard decision={{ state: 'hidden' }} checkout={checkout} />);
    expect(container.innerHTML).toBe('');
  });

  it('names each child as a chip in their club\'s colour, with the honest foot', () => {
    const { container } = still(<CheckoutBoard decision={{ state: 'names', ageMin: 3 }} checkout={checkout} />);
    const board = container.querySelector('.checkout-board.names');
    expect(board.querySelector('.checkout-title').textContent).toBe('Still to be picked up');
    const sparks = [...board.querySelectorAll('.checkout-club')].find((li) => li.textContent.includes('Sparks'));
    expect(sparks.style.getPropertyValue('--club')).toBe(getClubPalette('Sparks').primary);
    expect([...sparks.querySelectorAll('.checkout-name__chip')].map((c) => c.textContent)).toEqual(['Demo Kid', 'Sample Star']);
    // Still reads as the old list, separators and all.
    expect(sparks.querySelector('.checkout-names').textContent).toBe('Demo Kid · Sample Star');
    const foot = board.querySelector('.checkout-foot');
    expect(foot.querySelector('.checkout-count').textContent).toBe('3');
    expect(foot.textContent).toBe('3 not checked out yet · 43 labels printed tonight · updated 3 min ago');
    expect(board.textContent).not.toMatch(/still in the building/i);
  });

  it('names nobody when the decision is anonymous', () => {
    const { container } = still(<CheckoutBoard decision={{ state: 'anonymous', ageMin: 0 }} checkout={checkout} />);
    expect(container.querySelector('.checkout-name__chip')).toBeNull();
    expect(container.textContent).not.toMatch(/Demo Kid|Sample Star|Test Kid/);
    expect(container.textContent).toContain('Almost everyone has been picked up. Please see the check-in desk.');
  });

  it('keeps the stale and empty wording', () => {
    const stale = still(<CheckoutBoard decision={{ state: 'stale', ageMin: 20 }} checkout={checkout} />).container;
    expect(stale.textContent).toContain('This list stopped updating about 20 min ago — please check with the check-in desk rather than relying on it.');
    cleanup();
    const empty = still(<CheckoutBoard decision={{ state: 'empty', ageMin: 0 }} checkout={{ ...checkout, entries: [] }} />).container;
    expect(empty.textContent).toContain('Everyone has been checked out. Thanks for a great night!');
  });
});

describe('CheckoutBoard at the foot', () => {
  // Where it goes is overlayFit.js boardPlacement; at the foot it is one line
  // beside the slides, in the same words.
  it('lists nobody at the foot: a live list there is its honest count line', () => {
    const { container } = still(<CheckoutBoard decision={{ state: 'names', ageMin: 3 }} checkout={checkout} placement="foot" />);
    expect(container.querySelector('.checkout-region--foot')).not.toBeNull();
    const board = container.querySelector('.checkout-board.names.checkout-board--foot');
    expect(board.querySelector('.checkout-title').textContent).toBe('Still to be picked up');
    // A partial list must never pass for the whole one: no names at all.
    expect(board.querySelector('.checkout-name__chip')).toBeNull();
    expect(board.textContent).not.toMatch(/Demo Kid|Sample Star|Test Kid/);
    expect(board.querySelector('.checkout-foot').textContent)
      .toBe('3 not checked out yet · 43 labels printed tonight · updated 3 min ago');
  });

  it('keeps the stale, empty and anonymous wording at the foot', () => {
    const stale = still(<CheckoutBoard decision={{ state: 'stale', ageMin: 1560 }} checkout={checkout} placement="foot" />).container;
    expect(stale.querySelector('.checkout-board--foot').textContent)
      .toContain('This list stopped updating about 1560 min ago — please check with the check-in desk rather than relying on it.');
    cleanup();
    const empty = still(<CheckoutBoard decision={{ state: 'empty', ageMin: 0 }} checkout={{ ...checkout, entries: [] }} placement="foot" />).container;
    expect(empty.textContent).toContain('Everyone has been checked out. Thanks for a great night!');
    cleanup();
    const anon = still(<CheckoutBoard decision={{ state: 'anonymous', ageMin: 0 }} checkout={checkout} placement="foot" />).container;
    expect(anon.textContent).toContain('Almost everyone has been picked up. Please see the check-in desk.');
    expect(anon.textContent).not.toMatch(/\d+ not checked out/);
  });

  it('the middle is the default, and lists the names', () => {
    const { container } = still(<CheckoutBoard decision={{ state: 'names', ageMin: 0 }} checkout={checkout} />);
    expect(container.querySelector('.checkout-region--foot')).toBeNull();
    expect(container.querySelectorAll('.checkout-name__chip')).toHaveLength(3);
  });
});
