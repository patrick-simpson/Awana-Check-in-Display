import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import PromoSlide, { PROMO_DETAILS, RotatingDetail, detailsFor } from './PromoSlide.jsx';

// No global test setup file in this repo, so RTL's automatic cleanup
// (which needs a global afterEach) doesn't run — do it explicitly.
afterEach(cleanup);

// M.* from src/lib/motion.jsx reads ZeroAnimationContext through
// useContext, which falls back to the createContext default (false) with
// no provider — so these render exactly as they do on a normal screen,
// no wrapper needed.
const promo = (kind, extra = {}) => ({
  id: `promo_${kind}`,
  kind,
  eventDate: kind === 'parents' ? '2026-11-04' : '2026-10-14',
  tonight: false,
  countdown: '3 club nights left',
  afterContest: false,
  ...extra,
});

describe('PromoSlide', () => {
  it('renders nothing at all for a missing or unknown promo', () => {
    const { container } = render(<PromoSlide promo={null} />);
    expect(container.querySelector('.promo-slide')).toBeNull();
    cleanup();
    const { container: c2 } = render(<PromoSlide promo={promo('bake-sale')} />);
    expect(c2.querySelector('.promo-slide')).toBeNull();
  });

  describe('poster contest', () => {
    it('renders the headline, the hero word, the deadline and the first detail', () => {
      const { container } = render(<PromoSlide promo={promo('contest')} />);
      expect(container.querySelector('.promo-slide--contest')).not.toBeNull();
      expect(screen.getByText('Poster Contest')).toBeTruthy();
      // DEFEND is one span per letter so they can stagger in and bounce.
      expect([...container.querySelectorAll('.promo-sign-letter')].map((el) => el.textContent).join(''))
        .toBe('DEFEND');
      expect(screen.getByText('Posters due')).toBeTruthy();
      expect(screen.getByText('WEDNESDAY, OCTOBER 14')).toBeTruthy();
      expect(container.querySelector('.promo-detail').textContent).toBe('1 Peter 3:15 NKJV');
    });

    it('names the verse reference ONLY, never the verse text', () => {
      const { container } = render(<PromoSlide promo={promo('contest')} />);
      expect(container.textContent).not.toMatch(/sanctify|ready to give/i);
    });

    it('swaps the band copy on the night itself', () => {
      const { container } = render(
        <PromoSlide promo={promo('contest', { tonight: true, countdown: 'Tonight!' })} />
      );
      expect(screen.getByText('Posters due tonight')).toBeTruthy();
      expect(screen.getByText('Hand yours in at the check-in desk')).toBeTruthy();
      expect(container.querySelector('.promo-detail').textContent)
        .toBe('Voting at Parents’ Night · Nov 4');
      expect(screen.queryByText('WEDNESDAY, OCTOBER 14')).toBeNull();
    });
  });

  describe('BARF Night', () => {
    it('renders the headline, the splat words, the date and the first detail', () => {
      const { container } = render(<PromoSlide promo={promo('friend')} />);
      expect(container.querySelector('.promo-slide--friend')).not.toBeNull();
      expect(screen.getByText('BARF Night!')).toBeTruthy();
      expect([...container.querySelectorAll('.promo-friend-word')].map((el) => el.textContent))
        .toEqual(['BRING', 'A REAL', 'FRIEND']);
      expect(screen.getByText('WEDNESDAY, OCTOBER 14')).toBeTruthy();
      expect(container.querySelector('.promo-detail').textContent)
        .toBe('Earn 10 Awana Shares per friend');
    });

    it('swaps the headline and the date line on the night itself', () => {
      const { container } = render(<PromoSlide promo={promo('friend', { tonight: true, countdown: 'Tonight!' })} />);
      expect(screen.getByText('BARF Night is tonight!')).toBeTruthy();
      expect(screen.getByText('Bring your friend to the check-in desk')).toBeTruthy();
      expect(container.querySelector('.promo-detail').textContent)
        .toBe('10 Awana Shares per friend');
      expect(screen.queryByText('WEDNESDAY, OCTOBER 14')).toBeNull();
    });
  });

  describe('Parents\' Night', () => {
    it('renders the hero words, the date and the first detail', () => {
      const { container } = render(<PromoSlide promo={promo('parents')} />);
      expect(container.querySelector('.promo-slide--parents')).not.toBeNull();
      expect(screen.getByText('Parents’ Night')).toBeTruthy();
      expect(screen.getByText('WEDNESDAY, NOVEMBER 4')).toBeTruthy();
      expect(container.querySelector('.promo-detail').textContent)
        .toBe('Spend the evening with your clubber');
    });

    it('welcomes parents on the night itself', () => {
      const { container } = render(
        <PromoSlide promo={promo('parents', { tonight: true, afterContest: true, countdown: 'Tonight!' })} />
      );
      expect(screen.getByText('Parents’ Night is tonight!')).toBeTruthy();
      expect(screen.getByText('Welcome, parents!')).toBeTruthy();
      expect(container.querySelector('.promo-detail').textContent)
        .toBe('Spend the evening with your clubber');
      expect(screen.queryByText('WEDNESDAY, NOVEMBER 4')).toBeNull();
    });
  });

  // The one rotating line is where every small line from the first pass
  // went. Which strings it carries is a pure decision (detailsFor), and
  // the cadence is RotatingDetail's own job, so they are pinned apart:
  // fake timers cannot drive framer-motion's crossfade, because its
  // frame loop captured the real requestAnimationFrame at import.
  describe('the detail copy (detailsFor)', () => {
    it('gives the contest its verse reference first', () => {
      expect(detailsFor(promo('contest'))).toEqual([
        '1 Peter 3:15 NKJV',
        'Open to all clubbers',
        'Voting at Parents’ Night · Nov 4',
      ]);
    });

    it('leads with the voting chain on the contest deadline itself', () => {
      expect(detailsFor(promo('contest', { tonight: true }))[0])
        .toBe('Voting at Parents’ Night · Nov 4');
    });

    it('gives BARF Night the shares, the bag and the ask', () => {
      expect(detailsFor(promo('friend'))).toEqual([
        'Earn 10 Awana Shares per friend',
        '+ a BARF bag!',
        'Bring A Real Friend',
      ]);
      expect(detailsFor(promo('friend', { tonight: true }))).toEqual([
        '10 Awana Shares per friend',
        '+ a BARF bag!',
      ]);
    });

    it('points Parents\' Night FORWARD to the poster deadline before October 15', () => {
      expect(detailsFor(promo('parents'))).toEqual([
        'Spend the evening with your clubber',
        'DEFEND poster voting that night',
        'Posters due Oct 14',
      ]);
    });

    it('asks for a vote once the posters are in', () => {
      const lines = detailsFor(promo('parents', { afterContest: true }));
      expect(lines).toEqual([
        'Spend the evening with your clubber',
        'Vote for your favorite DEFEND poster',
      ]);
      expect(lines.join(' ')).not.toContain('Posters due Oct 14');
    });

    it('says the voting is tonight on Parents\' Night itself, over afterContest', () => {
      expect(detailsFor(promo('parents', { tonight: true, afterContest: true }))[1])
        .toBe('Vote for your favorite DEFEND poster tonight');
    });

    it('has nothing to say about a promo it does not know', () => {
      expect(detailsFor(promo('bake-sale'))).toEqual([]);
      expect(detailsFor(null)).toEqual([]);
    });

    it('never uses an em dash', () => {
      for (const table of Object.values(PROMO_DETAILS)) {
        for (const lines of Object.values(table)) {
          expect(lines.join(' ')).not.toContain('—');
        }
      }
    });
  });

  describe('the rotating detail line (RotatingDetail)', () => {
    const LINES = Object.freeze(['First line', 'Second line', 'Third line']);
    const detail = (c) => c.querySelector('.promo-detail')?.textContent;

    // Steps well clear of the 0.35 s crossfade, so each line is actually
    // on screen long enough to be caught; the real slide gives them 2.2 s.
    it('shows each line in turn and then stops on the last', async () => {
      const { container } = render(<RotatingDetail lines={LINES} startMs={300} stepMs={1000} />);
      expect(detail(container)).toBe('First line');
      await waitFor(() => expect(detail(container)).toBe('Second line'), { timeout: 3000 });
      await waitFor(() => expect(detail(container)).toBe('Third line'), { timeout: 3000 });
      // No wrap back round: the slide is remounted on its next visit.
      await new Promise((r) => setTimeout(r, 300));
      expect(detail(container)).toBe('Third line');
    });

    it('holds still for a single line rather than blinking it', async () => {
      const { container } = render(<RotatingDetail lines={['Only line']} startMs={30} stepMs={30} />);
      await new Promise((r) => setTimeout(r, 200));
      expect(detail(container)).toBe('Only line');
    });

    it('renders nothing at all when there is nothing to say', () => {
      const { container } = render(<RotatingDetail lines={[]} />);
      expect(container.querySelector('.promo-detail-slot')).toBeNull();
    });

    it('clears its timer chain on unmount', async () => {
      const { unmount } = render(<RotatingDetail lines={LINES} startMs={30} stepMs={30} />);
      unmount();
      // A surviving timer would setState on an unmounted component here.
      await new Promise((r) => setTimeout(r, 200));
    });
  });

  // v2 dropped every small supporting line. If one of these comes back
  // as its own element, the poster is crowded again.
  describe('the v2 three-statement layout', () => {
    const RETIRED = [
      '.promo-eyebrow',
      '.promo-contest-theme',
      '.promo-contest-verse',
      '.promo-contest-chain',
      '.promo-band-foot',
      '.promo-friend-reward',
      '.promo-friend-bag',
      '.promo-parents-sub',
      '.promo-parents-pill',
    ];

    it('carries none of the retired small-print elements', () => {
      for (const kind of ['contest', 'friend', 'parents']) {
        for (const tonight of [false, true]) {
          const { container } = render(<PromoSlide promo={promo(kind, { tonight })} />);
          for (const selector of RETIRED) {
            expect(container.querySelector(selector), `${kind} still renders ${selector}`).toBeNull();
          }
          cleanup();
        }
      }
    });

    it('gives every poster exactly one detail slot and one countdown chip', () => {
      for (const kind of ['contest', 'friend', 'parents']) {
        const { container } = render(<PromoSlide promo={promo(kind)} />);
        expect(container.querySelectorAll('.promo-detail-slot')).toHaveLength(1);
        expect(container.querySelectorAll('.promo-chip')).toHaveLength(1);
        cleanup();
      }
    });

    it('sets every poster on the same depth layers', () => {
      for (const kind of ['contest', 'friend', 'parents']) {
        const { container } = render(<PromoSlide promo={promo(kind)} />);
        expect(container.querySelector('.promo-texture')).not.toBeNull();
        expect(container.querySelector('.promo-vignette')).not.toBeNull();
        cleanup();
      }
    });
  });

  describe('the countdown chip', () => {
    it('shows the line it was given', () => {
      render(<PromoSlide promo={promo('friend', { countdown: 'Next club night' })} />);
      expect(screen.getByText('Next club night')).toBeTruthy();
    });

    it('says Tonight! on the night', () => {
      render(<PromoSlide promo={promo('parents', { tonight: true, countdown: 'Tonight!' })} />);
      expect(screen.getByText('Tonight!')).toBeTruthy();
    });

    it('is absent entirely when there is nothing to count', () => {
      const { container } = render(<PromoSlide promo={promo('contest', { countdown: null })} />);
      expect(container.querySelector('.promo-chip')).toBeNull();
    });
  });

  describe('the Awana Clubs wordmark', () => {
    it('is on every promo', () => {
      for (const kind of ['contest', 'friend', 'parents']) {
        const { container } = render(<PromoSlide promo={promo(kind)} />);
        expect(container.querySelector('.promo-wordmark')).not.toBeNull();
        cleanup();
      }
    });

    it('takes itself off the screen if the art cannot load', () => {
      const { container } = render(<PromoSlide promo={promo('contest')} />);
      const img = container.querySelector('.promo-wordmark');
      fireEvent.error(img);
      expect(container.querySelector('.promo-wordmark')).toBeNull();
      // The rest of the poster is untouched.
      expect(screen.getByText('Poster Contest')).toBeTruthy();
    });
  });

  it('uses no em dashes anywhere in its on-screen copy', () => {
    for (const kind of ['contest', 'friend', 'parents']) {
      for (const tonight of [false, true]) {
        const { container } = render(<PromoSlide promo={promo(kind, { tonight, afterContest: tonight })} />);
        expect(container.textContent).not.toContain('—');
        cleanup();
      }
    }
  });
});
