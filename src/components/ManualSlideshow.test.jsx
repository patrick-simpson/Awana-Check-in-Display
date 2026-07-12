import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import ManualSlideshow from './ManualSlideshow.jsx';

const deck = [
  { id: 's_1', eyebrow: '', text: 'First slide', theme: 'sky', durationSec: 0 },
  { id: 's_2', eyebrow: 'Awana', text: 'Second slide', theme: 'night', durationSec: 4 },
  { id: 's_3', eyebrow: '', text: 'Third slide', theme: 'auto', durationSec: 0 },
];

describe('ManualSlideshow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders the first slide text and eyebrow-less layout', () => {
    render(<ManualSlideshow slides={deck} slideshowDelaySec={5} />);
    expect(screen.getByText('First slide')).toBeTruthy();
  });

  it('advances to the next slide after the global delay', () => {
    render(<ManualSlideshow slides={deck} slideshowDelaySec={5} />);
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByText('Second slide')).toBeTruthy();
    expect(screen.getByText('Awana')).toBeTruthy();
  });

  it('honors a per-slide duration over the global delay', () => {
    render(<ManualSlideshow slides={deck} slideshowDelaySec={10} />);
    act(() => vi.advanceTimersByTime(10000)); // → slide 2 (4s own duration)
    act(() => vi.advanceTimersByTime(4000)); // slide 2's 4s, not the global 10s
    expect(screen.getByText('Third slide')).toBeTruthy();
  });

  it('wraps from the last slide back to the first', () => {
    render(<ManualSlideshow slides={deck} slideshowDelaySec={5} />);
    act(() => vi.advanceTimersByTime(5000)); // → 2
    act(() => vi.advanceTimersByTime(4000)); // → 3
    act(() => vi.advanceTimersByTime(5000)); // → back to 1
    expect(screen.getByText('First slide')).toBeTruthy();
  });

  it('idles on a single slide forever', () => {
    render(<ManualSlideshow slides={[deck[0]]} slideshowDelaySec={5} />);
    act(() => vi.advanceTimersByTime(60000));
    expect(screen.getByText('First slide')).toBeTruthy();
  });

  it('renders nothing (not a crash) with an empty deck', () => {
    const { container } = render(<ManualSlideshow slides={[]} slideshowDelaySec={5} />);
    expect(container.innerHTML).toBe('');
  });

  it('survives the deck shrinking below the current index', () => {
    const { rerender } = render(<ManualSlideshow slides={deck} slideshowDelaySec={5} />);
    act(() => vi.advanceTimersByTime(5000)); // → 2
    act(() => vi.advanceTimersByTime(4000)); // → 3 (index 2)
    rerender(<ManualSlideshow slides={deck.slice(0, 1)} slideshowDelaySec={5} />);
    expect(screen.getByText('First slide')).toBeTruthy();
  });
});
