import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';

vi.mock('../hooks/useCalendarEvents.js', () => ({ useCalendarEvents: () => [] }));

import { SlideshowView } from './SlideshowView.jsx';
import { nightLabel, nightOf } from './Slide.jsx';

const NOW = new Date('2026-09-16T18:00:30');
const press = (code) => act(() => { fireEvent.keyDown(window, { code }); });

const deck = (props = {}) => (
  <SlideshowView deck="opening" now={NOW} onExit={() => {}} {...props} />
);

// The opening deck's order (config.js): welcome, the two pledges, a blackout.
describe('SlideshowView: the operator\'s keys still drive the deck', () => {
  afterEach(cleanup);

  it('opens on the welcome, kicked by the night it is', () => {
    const { container } = render(deck());
    expect(container.textContent).toMatch(/Wednesday night/);
    expect(container.textContent).toMatch(/WELCOME TO AWANA/);
    // No change yet, so no sweep on the wall.
    expect(container.querySelector('[data-sweep]')).toBeNull();
  });

  it('Space, → and PageDown advance; each change sweeps the club colours once', () => {
    const { container } = render(deck());
    press('Space');
    expect(container.textContent).toMatch(/Pledge of Allegiance/);
    expect(container.querySelectorAll('[data-sweep]')).toHaveLength(1);
    press('ArrowRight');
    expect(container.textContent).toMatch(/Awana Pledge/);
    press('PageDown');
    // The closing blackout: nothing new lands on it.
    expect(container.querySelectorAll('[data-sweep]')).toHaveLength(1);
  });

  it('← and PageUp step back, sweeping the other way', () => {
    const { container } = render(deck());
    press('Space');
    press('ArrowLeft');
    expect(container.textContent).toMatch(/WELCOME TO AWANA/);
    press('PageUp'); // already at the start: nothing happens
    expect(container.querySelectorAll('[data-sweep]')).toHaveLength(1);
  });

  it('the sweep is six club waves, in the club colours', () => {
    const { container } = render(deck());
    press('Space');
    const fills = [...container.querySelectorAll('[data-sweep] path')].map((p) => p.getAttribute('fill'));
    expect(fills).toEqual(['#1DB6D9', '#4C72B8', '#F04A4B', '#58BD79', '#047E71', '#8A649D']);
  });

  it('the blackout reports a bare wall (App takes the mark away) and back again', () => {
    const onBareChange = vi.fn();
    render(deck({ onBareChange }));
    expect(onBareChange).toHaveBeenLastCalledWith(false);
    press('Space');
    press('Space');
    press('Space');
    expect(onBareChange).toHaveBeenLastCalledWith(true);
    press('ArrowLeft');
    expect(onBareChange).toHaveBeenLastCalledWith(false);
  });

  it('one more press past the blackout hands off to games', () => {
    const onFinish = vi.fn();
    render(deck({ onFinish }));
    for (let i = 0; i < 3; i++) press('Space');
    expect(onFinish).not.toHaveBeenCalled();
    press('Space');
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('Escape is press-twice, with the toast between', () => {
    const onExit = vi.fn();
    const { container } = render(deck({ onExit }));
    press('Escape');
    expect(onExit).not.toHaveBeenCalled();
    expect(container.querySelector('[aria-label="EXIT SLIDES Press ESC again"]')).not.toBeNull();
    press('Escape');
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('the pledges keep their clock', () => {
    const { container } = render(deck());
    expect(container.querySelector('.pj-slide-clock')).toBeNull();
    press('Space');
    expect(container.querySelector('.pj-slide-clock')).not.toBeNull();
  });
});

describe('slide copy helpers', () => {
  it('names the night it is', () => {
    expect(nightOf(new Date('2026-09-16T18:00:00'))).toBe('Wednesday night');
  });

  it('labels an upcoming night for its chip', () => {
    expect(nightLabel(new Date('2026-09-23T00:00:00'))).toMatch(/^WED SEP 23$/);
  });
});
