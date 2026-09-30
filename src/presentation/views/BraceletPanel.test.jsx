import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

// The Bracelet Time controls on a phone or tablet: the same panel, opened
// from the touch menu instead of B, a bottom sheet (index.css's touch
// block), and words that never ask a finger for a key or a click. It keeps
// owning the keyboard exactly as on the PC (a tablet can have one).

const device = vi.hoisted(() => ({ touch: false }));
vi.mock('../lib/touch.js', () => ({ useTouch: () => device.touch }));
vi.mock('../lib/chime.js', () => ({ audioState: () => 'suspended', playBraceletChime: vi.fn(), unlockAudio: vi.fn() }));

const { BraceletPanel } = await import('./BraceletPanel.jsx');
const { getBraceletSettings, resetBraceletSettings } = await import('../lib/braceletSettings.js');

beforeEach(() => {
  device.touch = false;
  localStorage.clear();
  resetBraceletSettings();
});
afterEach(cleanup);

describe('the Bracelet Time controls', () => {
  it('on the PC: B is the hint, clicks and keys arm the sound (unchanged)', () => {
    render(<BraceletPanel active onClose={() => {}} />);
    expect(screen.getByText('B opens and closes this panel.')).toBeTruthy();
    expect(screen.getByText(/click anywhere on this page or press any key once/)).toBeTruthy();
    expect(screen.getByText(/Saved on this PC until you press Reset/)).toBeTruthy();
    expect(screen.queryByText(/Holding/)).toBeNull();
  });

  it('on a phone or tablet: no B, no clicks, and the held step named out loud', () => {
    device.touch = true;
    render(<BraceletPanel active onClose={() => {}} />);
    expect(screen.queryByText(/B opens and closes/)).toBeNull();
    expect(screen.getByText(/Tap ✕ or anywhere outside this panel to close it/)).toBeTruthy();
    expect(screen.getByText(/tap anywhere on this page once/)).toBeTruthy();
    expect(screen.getByText(/Saved on this device until you press Reset/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'K2' }));
    expect(getBraceletSettings().hold).toBe(8);
    expect(screen.getByText(/Holding knot 2:/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '4' }));
    expect(screen.getByText(/Holding step 4:/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(getBraceletSettings().hold).toBeNull();
    expect(screen.queryByText(/Holding/)).toBeNull();
  });

  it('on touch it still owns the keyboard: Escape closes it and no key reaches the wall', () => {
    device.touch = true;
    const onClose = vi.fn();
    const wall = vi.fn();
    window.addEventListener('keydown', wall);
    try {
      render(<BraceletPanel active onClose={onClose} />);
      fireEvent.keyDown(document.body, { key: ' ', code: 'Space' });
      expect(wall).not.toHaveBeenCalled();
      fireEvent.keyDown(document.body, { key: 'Escape', code: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener('keydown', wall);
    }
  });

  it('a tap outside the panel closes it, a tap inside does not', () => {
    device.touch = true;
    const onClose = vi.fn();
    const { container } = render(<BraceletPanel active onClose={onClose} />);
    fireEvent.click(screen.getByRole('dialog', { name: 'Bracelet Time controls' }));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(container.querySelector('.pj-bpanel__backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
