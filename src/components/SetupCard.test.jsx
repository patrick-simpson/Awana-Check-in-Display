import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const loginState = vi.hoisted(() => ({ loginStatus: 'logged-out' }));
vi.mock('../hooks/useDisplayLogin.js', () => ({ useDisplayLogin: () => ({ ...loginState }) }));

const SetupCard = (await import('./SetupCard.jsx')).default;
const { SETUP_CARD_DISMISS_KEY } = await import('./SetupCard.jsx');

beforeEach(() => { localStorage.clear(); loginState.loginStatus = 'logged-out'; });
afterEach(cleanup);

describe('SetupCard (signage first-run)', () => {
  it('shows two steps on a fresh screen', () => {
    render(<SetupCard status="off" hasDisplayKey={false} onOpenSettings={() => {}} />);
    expect(screen.getByText(/Two quick setup steps/)).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(document.querySelectorAll('li.done')).toHaveLength(0);
  });

  it('shows one step, with the connection ticked, once Pusher is set up', () => {
    render(<SetupCard status="connected" hasDisplayKey={false} onOpenSettings={() => {}} />);
    expect(screen.getByText(/One quick setup step/)).toBeTruthy();
    expect(document.querySelectorAll('li.done')).toHaveLength(1);
  });

  it('hides when connected and keyed — by login or by a pasted key', () => {
    const { container, rerender } = render(<SetupCard status="connected" hasDisplayKey onOpenSettings={() => {}} />);
    expect(container.innerHTML).toBe('');
    loginState.loginStatus = 'logged-in';
    rerender(<SetupCard status="connected" hasDisplayKey={false} onOpenSettings={() => {}} />);
    expect(container.innerHTML).toBe('');
  });

  it('never renders in overlay-less contexts where the screen is set up, but stays for a keyed yet disconnected screen', () => {
    render(<SetupCard status="off" hasDisplayKey onOpenSettings={() => {}} />);
    expect(screen.getByText(/One quick setup step/)).toBeTruthy();
  });

  it('Open Settings calls back', () => {
    const open = vi.fn();
    render(<SetupCard status="off" hasDisplayKey={false} onOpenSettings={open} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open Settings' }));
    expect(open).toHaveBeenCalled();
  });

  it("Don't show again persists per device", () => {
    const { container, unmount } = render(<SetupCard status="off" hasDisplayKey={false} onOpenSettings={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /show again/ }));
    expect(container.innerHTML).toBe('');
    expect(localStorage.getItem(SETUP_CARD_DISMISS_KEY)).toBe('1');
    unmount();
    const again = render(<SetupCard status="off" hasDisplayKey={false} onOpenSettings={() => {}} />);
    expect(again.container.innerHTML).toBe('');
  });
});
