import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import ManualSlideshow, { MISSING_VIDEO_SKIP_MS } from './ManualSlideshow.jsx';
import { getVideo } from '../lib/videoStore.js';

vi.mock('../lib/videoStore.js', () => ({
  getVideo: vi.fn(),
}));

const deck = [
  { id: 's_1', eyebrow: '', text: 'First slide', theme: 'sky', durationSec: 0 },
  { id: 's_2', eyebrow: 'Awana', text: 'Second slide', theme: 'night', durationSec: 4 },
  { id: 's_3', eyebrow: '', text: 'Third slide', theme: 'auto', durationSec: 0 },
];

const videoSlide = { id: 's_v', type: 'video', videoId: 'v_1', videoName: 'promo.mp4', videoSize: 100, durationSec: 0 };

describe('ManualSlideshow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // jsdom implements neither media playback nor object URLs.
    window.HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
    URL.createObjectURL = vi.fn(() => 'blob:mock');
    URL.revokeObjectURL = vi.fn();
    getVideo.mockReset();
    getVideo.mockResolvedValue(new Blob(['x'], { type: 'video/webm' }));
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

  it('keeps its hold timer when re-rendered with an equal-but-new deck', () => {
    // App re-renders on every event and can hand down a fresh array of the
    // same slides; that must not restart the hold (the show used to stall on
    // one slide through a whole check-in rush).
    const { rerender } = render(<ManualSlideshow slides={deck} slideshowDelaySec={5} />);
    act(() => vi.advanceTimersByTime(3000));
    rerender(<ManualSlideshow slides={[...deck]} slideshowDelaySec={5} />);
    act(() => vi.advanceTimersByTime(1999));
    expect(screen.getByText('First slide')).toBeTruthy();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByText('Second slide')).toBeTruthy();
  });

  it('survives the deck shrinking below the current index', () => {
    const { rerender } = render(<ManualSlideshow slides={deck} slideshowDelaySec={5} />);
    act(() => vi.advanceTimersByTime(5000)); // → 2
    act(() => vi.advanceTimersByTime(4000)); // → 3 (index 2)
    rerender(<ManualSlideshow slides={deck.slice(0, 1)} slideshowDelaySec={5} />);
    expect(screen.getByText('First slide')).toBeTruthy();
  });

  it('honors an explicit per-slide text size over the auto bucket', () => {
    const forced = [{ ...deck[0], textSize: 'md' }];
    const { container } = render(<ManualSlideshow slides={forced} slideshowDelaySec={5} />);
    expect(container.querySelector('.manual-slide-text.slide-size-md')).toBeTruthy();
  });
});

describe('ManualSlideshow video slides', () => {
  const videoDeck = [deck[0], videoSlide, deck[2]];

  beforeEach(() => {
    vi.useFakeTimers();
    window.HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
    URL.createObjectURL = vi.fn(() => 'blob:mock');
    URL.revokeObjectURL = vi.fn();
    getVideo.mockReset();
    getVideo.mockResolvedValue(new Blob(['x'], { type: 'video/webm' }));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  async function advanceToVideo(container) {
    act(() => vi.advanceTimersByTime(5000)); // text slide 1 → video
    await act(async () => {}); // flush the getVideo microtask
    return container.querySelector('video.manual-slide-video');
  }

  it('plays a stored video muted with no loop and no parent timer (ended-driven)', async () => {
    const { container } = render(<ManualSlideshow slides={videoDeck} slideshowDelaySec={5} />);
    const video = await advanceToVideo(container);
    expect(video).toBeTruthy();
    expect(video.muted).toBe(true);
    expect(video.hasAttribute('loop')).toBe(false);
    // No timer in ended mode: far-future timers must not leave the video
    act(() => vi.advanceTimersByTime(120000));
    expect(container.querySelector('video.manual-slide-video')).toBeTruthy();
  });

  it('advances when the video ends', async () => {
    const { container } = render(<ManualSlideshow slides={videoDeck} slideshowDelaySec={5} />);
    const video = await advanceToVideo(container);
    act(() => { fireEvent(video, new Event('ended')); });
    expect(screen.getByText('Third slide')).toBeTruthy();
  });

  it('revokes the object URL when the video slide unmounts', async () => {
    const { container, unmount } = render(<ManualSlideshow slides={videoDeck} slideshowDelaySec={5} />);
    await advanceToVideo(container);
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock');
  });

  it('loops a video with an explicit duration and advances on the timer', async () => {
    const timed = [deck[0], { ...videoSlide, durationSec: 4 }, deck[2]];
    const { container } = render(<ManualSlideshow slides={timed} slideshowDelaySec={5} />);
    const video = await advanceToVideo(container);
    expect(video.hasAttribute('loop')).toBe(true);
    act(() => vi.advanceTimersByTime(4000));
    expect(screen.getByText('Third slide')).toBeTruthy();
  });

  it('skips ahead when the video is missing from this device', async () => {
    getVideo.mockResolvedValue(null);
    const { container } = render(<ManualSlideshow slides={videoDeck} slideshowDelaySec={5} />);
    await advanceToVideo(container);
    expect(container.querySelector('video')).toBeNull();
    expect(screen.getByText('Video not available on this device')).toBeTruthy();
    act(() => vi.advanceTimersByTime(MISSING_VIDEO_SKIP_MS));
    expect(screen.getByText('Third slide')).toBeTruthy();
  });

  it('skips ahead when the video errors mid-decode', async () => {
    const { container } = render(<ManualSlideshow slides={videoDeck} slideshowDelaySec={5} />);
    const video = await advanceToVideo(container);
    act(() => { fireEvent(video, new Event('error')); });
    act(() => vi.advanceTimersByTime(MISSING_VIDEO_SKIP_MS));
    expect(screen.getByText('Third slide')).toBeTruthy();
  });

  it('loops a lone video forever instead of freezing on the last frame', async () => {
    const { container } = render(<ManualSlideshow slides={[videoSlide]} slideshowDelaySec={5} />);
    await act(async () => {});
    const video = container.querySelector('video.manual-slide-video');
    expect(video.hasAttribute('loop')).toBe(true);
    act(() => vi.advanceTimersByTime(120000));
    expect(container.querySelector('video.manual-slide-video')).toBeTruthy();
  });

  // ── The season promo slot (#promos) ───────────────────────────────────
  // ONE slide in the deck, a different promo on each lap through it — see
  // src/lib/promos.js for why the four posters share a slot.
  describe('the promo slot', () => {
    const promoSlot = {
      id: 'season_promo',
      type: 'promo',
      durationSec: 12,
      promos: [
        { id: 'promo_contest', kind: 'contest', eventDate: '2026-10-14', tonight: false, countdown: '3 club nights left', afterContest: false },
        { id: 'promo_friend', kind: 'friend', eventDate: '2026-10-14', tonight: false, countdown: '3 club nights left', afterContest: false },
      ],
    };
    const withPromo = [deck[0], promoSlot];

    it('shows promo A on the first lap and promo B on the next', () => {
      const { container } = render(<ManualSlideshow slides={withPromo} slideshowDelaySec={5} />);
      act(() => vi.advanceTimersByTime(5000)); // text slide → the promo slot
      expect(container.querySelector('.promo-slide--contest')).not.toBeNull();

      act(() => vi.advanceTimersByTime(12000)); // the slot's own 12s → lap 2
      expect(screen.getByText('First slide')).toBeTruthy();
      act(() => vi.advanceTimersByTime(5000));
      expect(container.querySelector('.promo-slide--friend')).not.toBeNull();

      // …and round again to the first promo, not off the end of the list.
      act(() => vi.advanceTimersByTime(12000));
      act(() => vi.advanceTimersByTime(5000));
      expect(container.querySelector('.promo-slide--contest')).not.toBeNull();
    });

    it('honours the slot\'s own hold rather than the global delay', () => {
      const { container } = render(<ManualSlideshow slides={withPromo} slideshowDelaySec={5} />);
      act(() => vi.advanceTimersByTime(5000));
      expect(container.querySelector('.promo-slide')).not.toBeNull();
      act(() => vi.advanceTimersByTime(5000)); // the global delay is NOT the promo's
      expect(container.querySelector('.promo-slide')).not.toBeNull();
      act(() => vi.advanceTimersByTime(7000)); // 12s total
      expect(screen.getByText('First slide')).toBeTruthy();
    });

    it('a promo-only deck renders the first promo and never throws', () => {
      const { container } = render(<ManualSlideshow slides={[promoSlot]} slideshowDelaySec={5} />);
      expect(container.querySelector('.promo-slide--contest')).not.toBeNull();
      act(() => vi.advanceTimersByTime(600000));
      expect(container.querySelector('.promo-slide--contest')).not.toBeNull();
    });

    // The posters are not the same length of read: the slime cut of BARF
    // Night runs a 15 second beat sheet and the others say their piece in 8.
    // The slot holds for the ONE it is showing.
    describe('a per-promo hold', () => {
      const mixed = {
        ...promoSlot,
        promos: [
          { ...promoSlot.promos[0], durationSec: 8 },
          { ...promoSlot.promos[1], kind: 'barfEpic', id: 'promo_barf_epic', durationSec: 15 },
        ],
      };
      const deckWith = [deck[0], mixed];

      it('holds lap 0 for its promo\'s 8 seconds, not the slot\'s 12', () => {
        const { container } = render(<ManualSlideshow slides={deckWith} slideshowDelaySec={5} />);
        act(() => vi.advanceTimersByTime(5000)); // text slide → the slot
        expect(container.querySelector('.promo-slide--contest')).not.toBeNull();
        act(() => vi.advanceTimersByTime(7999));
        expect(container.querySelector('.promo-slide--contest')).not.toBeNull();
        act(() => vi.advanceTimersByTime(1));
        expect(screen.getByText('First slide')).toBeTruthy();
      });

      it('holds the slime cut\'s lap for its own 15 seconds', () => {
        const { container } = render(<ManualSlideshow slides={deckWith} slideshowDelaySec={5} />);
        act(() => vi.advanceTimersByTime(5000)); // → the slot, lap 0
        act(() => vi.advanceTimersByTime(8000)); // → text slide
        act(() => vi.advanceTimersByTime(5000)); // → the slot, lap 1
        expect(container.querySelector('.promo-slide--barf-epic')).not.toBeNull();
        act(() => vi.advanceTimersByTime(14999));
        expect(container.querySelector('.promo-slide--barf-epic')).not.toBeNull();
        act(() => vi.advanceTimersByTime(1));
        expect(screen.getByText('First slide')).toBeTruthy();
      });

      it('falls back to the slot\'s own hold for a promo that names none', () => {
        const noOwn = {
          ...promoSlot,
          promos: [{ ...promoSlot.promos[0] }],
        };
        const { container } = render(<ManualSlideshow slides={[deck[0], noOwn]} slideshowDelaySec={5} />);
        act(() => vi.advanceTimersByTime(5000));
        expect(container.querySelector('.promo-slide--contest')).not.toBeNull();
        act(() => vi.advanceTimersByTime(11999));
        expect(container.querySelector('.promo-slide--contest')).not.toBeNull();
        act(() => vi.advanceTimersByTime(1));
        expect(screen.getByText('First slide')).toBeTruthy();
      });
    });
  });
});
