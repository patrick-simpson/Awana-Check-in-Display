import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import NoticeBanner from './NoticeBanner.jsx';
import { NOTICE_MAX_AGE_MS } from '../lib/constants.js';

// Same rationale as TonightTicker.test.jsx / DataCycle.test.jsx: the
// staleness timer is what's under test, not framer-motion's tweening.
vi.mock('framer-motion', async (importOriginal) => {
  const mod = await importOriginal();
  return { ...mod, AnimatePresence: ({ children }) => children };
});

describe('NoticeBanner', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 14, 18, 0, 0));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  const notice = (overrides = {}) => ({
    level: 'info',
    message: 'Snacks are in the fellowship hall tonight.',
    at: Date.now(),
    ...overrides,
  });

  it('renders nothing without a notice', () => {
    const { container } = render(<NoticeBanner notice={null} />);
    expect(container.querySelector('.notice-banner')).toBeNull();
  });

  it('renders a critical notice as an unmissable, full-width, top alert', () => {
    const { container } = render(
      <NoticeBanner notice={notice({ level: 'critical', message: 'CLUB CANCELLED TONIGHT' })} />
    );
    const el = container.querySelector('.notice-banner--critical');
    expect(el).not.toBeNull();
    expect(el.textContent).toContain('CLUB CANCELLED TONIGHT');
    expect(screen.getByRole('alert').getAttribute('aria-live')).toBe('assertive');
  });

  it('renders a warn notice as a softer strip', () => {
    const { container } = render(
      <NoticeBanner notice={notice({ level: 'warn', message: 'Doors close at 6:15 tonight.' })} />
    );
    const el = container.querySelector('.notice-banner--warn');
    expect(el).not.toBeNull();
    expect(container.querySelector('.notice-banner--critical')).toBeNull();
    expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite');
  });

  it('renders an info notice as the quietest treatment', () => {
    const { container } = render(<NoticeBanner notice={notice({ level: 'info' })} />);
    const el = container.querySelector('.notice-banner--info');
    expect(el).not.toBeNull();
    expect(container.querySelector('.notice-banner--warn')).toBeNull();
    expect(container.querySelector('.notice-banner--critical')).toBeNull();
  });

  it('only one severity renders at a time, swapping as new notices arrive', () => {
    const { container, rerender } = render(<NoticeBanner notice={notice({ level: 'critical' })} />);
    expect(container.querySelector('.notice-banner--critical')).not.toBeNull();

    rerender(<NoticeBanner notice={notice({ level: 'warn', at: Date.now() + 1 })} />);
    expect(container.querySelector('.notice-banner--critical')).toBeNull();
    expect(container.querySelector('.notice-banner--warn')).not.toBeNull();
    // Never both at once.
    expect(container.querySelectorAll('.notice-banner')).toHaveLength(1);
  });

  it('renders the message as plain text — never HTML, even if markup-shaped', () => {
    const hostile = "<b>ALERT</b><script>window.__pwned = true;</script> club cancelled";
    const { container } = render(<NoticeBanner notice={notice({ level: 'critical', message: hostile })} />);
    expect(container.querySelector('b')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).toContain(hostile);
  });

  it('expires after NOTICE_MAX_AGE_MS so a stale cancellation does not haunt the screen', () => {
    const { container } = render(<NoticeBanner notice={notice({ level: 'critical' })} />);
    expect(container.querySelector('.notice-banner')).not.toBeNull();

    act(() => vi.advanceTimersByTime(NOTICE_MAX_AGE_MS + 60000));
    expect(container.querySelector('.notice-banner')).toBeNull();
  });

  it('stays visible just before the expiry threshold', () => {
    render(<NoticeBanner notice={notice({ level: 'warn' })} />);
    act(() => vi.advanceTimersByTime(NOTICE_MAX_AGE_MS - 60000));
    expect(screen.getByRole('status')).toBeTruthy();
  });
});
