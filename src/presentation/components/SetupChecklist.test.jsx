import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const state = vi.hoisted(() => ({ pusherAppKey: '', loginStatus: 'logged-out', vr: false }));
vi.mock('../../hooks/useConfig.js', () => ({ useConfig: () => ({ config: { pusherAppKey: state.pusherAppKey } }) }));
vi.mock('../../hooks/useDisplayLogin.js', () => ({ useDisplayLogin: () => ({ loginStatus: state.loginStatus }) }));
vi.mock('../lib/flags.js', () => ({ FLAGS: { get vr() { return state.vr; } } }));

const { SETUP_NOTE, SetupChecklist } = await import('./SetupChecklist.jsx');
const { COMING_UP } = await import('../views/Slide.jsx');

const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8');

beforeEach(() => {
  localStorage.clear();
  Object.assign(state, { pusherAppKey: '', loginStatus: 'logged-out', vr: false });
});
afterEach(cleanup);

describe('the projector\'s first-run setup note', () => {
  it('names two steps on a screen with neither the key nor the login', () => {
    render(<SetupChecklist />);
    expect(screen.getByText(/two quick setup steps/)).toBeTruthy();
    expect(screen.getByText(/Live data key/)).toBeTruthy();
    expect(screen.getByText(/Log in with the display passphrase/)).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Display setup' }).textContent).toMatch(/Display Settings/);
    expect(screen.getByRole('region', { name: 'Display setup' }).textContent).toMatch(/Settings → Display login/);
  });

  it('drops the key step once the build carries one, and ticks the login when it is done', () => {
    state.pusherAppKey = 'k';
    const { rerender } = render(<SetupChecklist />);
    expect(screen.getByText(/one quick setup step/)).toBeTruthy();
    expect(screen.queryByText(/Live data key/)).toBeNull();
    expect(screen.getByText(/Log in with the display passphrase/).textContent.startsWith('⬜')).toBe(true);
    // Logged in but with no key yet: the login is ticked, the key still asked for.
    state.pusherAppKey = '';
    state.loginStatus = 'logged-in';
    rerender(<SetupChecklist />);
    expect(screen.getByText(/Log in with the display passphrase/).textContent.startsWith('✅')).toBe(true);
    expect(screen.getByText(/Live data key/)).toBeTruthy();
  });

  it('is gone once the screen is keyed and logged in, and never shows in screenshot mode', () => {
    state.pusherAppKey = 'k';
    state.loginStatus = 'logged-in';
    expect(render(<SetupChecklist />).container.innerHTML).toBe('');
    cleanup();
    state.pusherAppKey = '';
    state.loginStatus = 'logged-out';
    state.vr = true;
    expect(render(<SetupChecklist />).container.innerHTML).toBe('');
  });

  it("Don't show again persists per device", () => {
    const { container, unmount } = render(<SetupChecklist />);
    fireEvent.click(screen.getByRole('button', { name: /show again/i }));
    expect(container.innerHTML).toBe('');
    expect(localStorage.getItem('awanaSetupChecklistDismissed.v1')).toBe('1');
    unmount();
    expect(render(<SetupChecklist />).container.innerHTML).toBe('');
  });

  it('is one region with the heading and steps first and the button last (reading and tab order)', () => {
    render(<SetupChecklist />);
    const region = screen.getByRole('region', { name: 'Display setup' });
    expect([...region.querySelectorAll('p, ul, button')].map((el) => el.tagName)).toEqual(['P', 'UL', 'P', 'BUTTON']);
  });
});

describe('where the note stands', () => {
  it('starts below the Upcoming Awana Nights list, the lowest thing any view draws', () => {
    expect(SETUP_NOTE.top).toBeGreaterThanOrEqual(COMING_UP.bottom);
    expect(SETUP_NOTE.top).toBeLessThan(COMING_UP.frame);
  });

  it('is as wide as the slides\' own text block, centred on the frame', () => {
    const rule = /\.pj-setup-note \{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(rule).toMatch(new RegExp(`width: calc\\(${SETUP_NOTE.width} \\* var\\(--u\\)\\)`));
    expect(rule).toMatch(new RegExp(`left: calc\\(50% - ${SETUP_NOTE.width / 2} \\* var\\(--u\\)\\)`));
    // .pj-slide runs from 8u to 92u.
    const slide = /\.pj-slide \{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(slide).toMatch(new RegExp(`left: calc\\(${(100 - SETUP_NOTE.width) / 2} \\* var\\(--u\\)\\)`));
  });

  it('is anchored to the window\'s bottom, so a 4:3 window has the black band under the frame too', () => {
    const rule = /\.pj-setup-note \{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(rule).toMatch(/bottom: max\(calc\(0\.5 \* var\(--u\)\), 6px\)/);
    expect(rule).toMatch(/position: absolute/);
  });
});
