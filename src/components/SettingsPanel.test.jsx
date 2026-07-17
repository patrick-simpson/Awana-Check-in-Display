import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import SettingsPanel from './SettingsPanel.jsx';
import defaults from '../config.js';

// No global test setup file in this repo, so RTL's automatic cleanup
// (which needs a global afterEach) doesn't run — do it explicitly.
afterEach(cleanup);

// The Save control is a <jelly-button> web component (vendored script,
// loaded via index.html — not in jsdom). Its accessible button role
// lives in its shadow DOM, so tests target the host element by tag;
// React's onClick is attached to the host and fires the same way.

const baseProps = () => ({
  config: { ...defaults, audioMuted: true },
  status: 'off',
  lastEventAt: null,
  calendar: { events: [], source: 'none', generatedAt: null, refresh: vi.fn() },
  onChange: vi.fn(),
  onReset: vi.fn(),
  onClose: vi.fn(),
  onTest: vi.fn(),
  onResetTally: vi.fn(),
  onOpenSlideEditor: vi.fn(),
  onOpenDebug: vi.fn(),
});

describe('SettingsPanel (tabbed)', () => {
  it('renders all five tabs with Connection active first', () => {
    render(<SettingsPanel {...baseProps()} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual([
      'Connection', 'Background', 'Banners', 'Display', 'Calendar & Weather',
    ]);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(screen.getByLabelText('Pusher App Key')).toBeTruthy();
  });

  it('switches tabs on click and shows that tab’s fields', () => {
    render(<SettingsPanel {...baseProps()} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Calendar & Weather' }));
    expect(screen.getByLabelText('Calendar page URL')).toBeTruthy();
    expect(screen.queryByLabelText('Pusher App Key')).toBeNull();
  });

  it('moves between tabs with arrow keys, Home, and End', () => {
    render(<SettingsPanel {...baseProps()} />);
    const [first] = screen.getAllByRole('tab');
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Background' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Background' }), { key: 'ArrowLeft' });
    expect(screen.getByRole('tab', { name: 'Connection' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Connection' }), { key: 'End' });
    expect(screen.getByRole('tab', { name: 'Calendar & Weather' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Calendar & Weather' }), { key: 'Home' });
    expect(screen.getByRole('tab', { name: 'Connection' }).getAttribute('aria-selected')).toBe('true');
  });

  it('keeps edits from multiple tabs and saves them in one patch', () => {
    const props = baseProps();
    render(<SettingsPanel {...props} />);

    fireEvent.change(screen.getByLabelText('Pusher App Key'), { target: { value: 'key123' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Calendar & Weather' }));
    fireEvent.change(screen.getByLabelText('Welcome wording (regular nights)'), {
      target: { value: 'Welcome to KVB Awana!' },
    });
    // Edits on the first tab survive the round trip.
    fireEvent.click(screen.getByRole('tab', { name: 'Connection' }));
    expect(screen.getByLabelText('Pusher App Key').value).toBe('key123');

    fireEvent.click(screen.getByText('Save', { selector: 'jelly-button' }));
    expect(props.onChange).toHaveBeenCalledTimes(1);
    const patch = props.onChange.mock.calls[0][0];
    expect(patch.pusherAppKey).toBe('key123');
    expect(patch.calendarWelcomeText).toBe('Welcome to KVB Awana!');
    expect(props.onClose).toHaveBeenCalled();
  });

  it('clamps out-of-range values on save', () => {
    const props = baseProps();
    render(<SettingsPanel {...props} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Banners' }));
    fireEvent.change(screen.getByLabelText('Standard banner duration (ms)'), { target: { value: '999999' } });
    fireEvent.click(screen.getByText('Save', { selector: 'jelly-button' }));
    expect(props.onChange.mock.calls[0][0].standardDisplayMs).toBe(20000);
  });

  it('round-trips the widget display mode and cycle interval', () => {
    const props = baseProps();
    render(<SettingsPanel {...props} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Display' }));

    // Default mode is the animated cycle, defaulting to 3s, with its
    // interval field shown.
    expect(screen.getByLabelText('Animated cycle (recommended)').checked).toBe(true);
    expect(screen.getByLabelText('Seconds per item').value).toBe('3');
    fireEvent.change(screen.getByLabelText('Seconds per item'), { target: { value: '1' } });

    fireEvent.click(screen.getByLabelText('Classic corner stickers'));
    // The interval only matters in cycle mode, so the field hides.
    expect(screen.queryByLabelText('Seconds per item')).toBeNull();

    fireEvent.click(screen.getByText('Save', { selector: 'jelly-button' }));
    const patch = props.onChange.mock.calls[0][0];
    expect(patch.widgetDisplayMode).toBe('stickers');
    // Out-of-range interval edits still get clamped on save.
    expect(patch.cycleIntervalSec).toBe(2);
  });

  it('Cancel closes without writing anything', () => {
    const props = baseProps();
    render(<SettingsPanel {...props} />);
    fireEvent.change(screen.getByLabelText('Pusher App Key'), { target: { value: 'discard-me' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(props.onChange).not.toHaveBeenCalled();
    expect(props.onClose).toHaveBeenCalled();
  });

  it('Escape closes the panel', () => {
    const props = baseProps();
    render(<SettingsPanel {...props} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(props.onClose).toHaveBeenCalled();
  });

  it('shows the live calendar preview line when data is loaded', () => {
    const props = baseProps();
    props.calendar = {
      events: [
        { date: '2099-01-06', kind: 'club', title: 'Awana meeting', isCancelled: false, isSpecial: false },
        { date: '2099-01-13', kind: 'club', title: 'Water Night', isCancelled: false, isSpecial: true },
      ],
      source: 'feed',
      generatedAt: new Date().toISOString(),
      refresh: vi.fn(),
    };
    render(<SettingsPanel {...props} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Calendar & Weather' }));
    expect(screen.getByText(/2 events loaded/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh now' }));
    expect(props.calendar.refresh).toHaveBeenCalled();
  });
});
