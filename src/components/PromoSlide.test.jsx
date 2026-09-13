import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import PromoSlide from './PromoSlide.jsx';

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
    it('renders the theme, the verse reference and the deadline', () => {
      const { container } = render(<PromoSlide promo={promo('contest')} />);
      expect(container.querySelector('.promo-slide--contest')).not.toBeNull();
      expect(screen.getByText('Poster Contest')).toBeTruthy();
      // DEFEND is one span per letter so they can stagger in.
      expect([...container.querySelectorAll('.promo-sign-letter')].map((el) => el.textContent).join(''))
        .toBe('DEFEND');
      expect(screen.getByText('1 Peter 3:15 NKJV')).toBeTruthy();
      expect(screen.getByText('Posters due')).toBeTruthy();
      expect(screen.getByText('WEDNESDAY, OCTOBER 14')).toBeTruthy();
      expect(screen.getByText('Open to all clubbers')).toBeTruthy();
    });

    it('names the verse reference ONLY, never the verse text', () => {
      const { container } = render(<PromoSlide promo={promo('contest')} />);
      expect(container.textContent).not.toMatch(/sanctify|ready to give/i);
    });

    it('chains to Parents\' Night, with no em dash', () => {
      const { container } = render(<PromoSlide promo={promo('contest')} />);
      const chain = container.querySelector('.promo-contest-chain');
      expect(chain.textContent).toContain('Voting happens at Parents');
      expect(chain.textContent).toContain('Wednesday, November 4');
      expect(container.textContent).not.toContain('—');
    });

    it('swaps the band copy on the night itself and drops the chain line', () => {
      const { container } = render(
        <PromoSlide promo={promo('contest', { tonight: true, countdown: 'Tonight!' })} />
      );
      expect(screen.getByText('Posters due tonight')).toBeTruthy();
      expect(screen.getByText('Hand yours in at the check-in desk')).toBeTruthy();
      expect(screen.getByText('Voting at Parents’ Night, Nov 4')).toBeTruthy();
      expect(container.querySelector('.promo-contest-chain')).toBeNull();
      expect(screen.queryByText('WEDNESDAY, OCTOBER 14')).toBeNull();
    });
  });

  describe('BARF Night', () => {
    it('renders the headline, the splat words and the reward', () => {
      const { container } = render(<PromoSlide promo={promo('friend')} />);
      expect(container.querySelector('.promo-slide--friend')).not.toBeNull();
      expect(screen.getByText('BARF Night!')).toBeTruthy();
      expect([...container.querySelectorAll('.promo-friend-word')].map((el) => el.textContent))
        .toEqual(['BRING', 'A REAL', 'FRIEND']);
      expect(screen.getByText('WEDNESDAY, OCTOBER 14')).toBeTruthy();
      expect(screen.getByText('Earn 10 Awana Shares per friend')).toBeTruthy();
      expect(screen.getByText('+ a BARF bag!')).toBeTruthy();
    });

    it('swaps the headline and the footer on the night itself', () => {
      render(<PromoSlide promo={promo('friend', { tonight: true, countdown: 'Tonight!' })} />);
      expect(screen.getByText('BARF Night is tonight!')).toBeTruthy();
      expect(screen.getByText('Bring your friend to the check-in desk')).toBeTruthy();
      expect(screen.getByText('10 Awana Shares per friend')).toBeTruthy();
      expect(screen.queryByText('WEDNESDAY, OCTOBER 14')).toBeNull();
    });
  });

  describe('Parents\' Night', () => {
    it('renders the headline, subline and date', () => {
      const { container } = render(<PromoSlide promo={promo('parents')} />);
      expect(container.querySelector('.promo-slide--parents')).not.toBeNull();
      expect(screen.getByText('Parents’ Night')).toBeTruthy();
      expect(screen.getByText('Spend the evening with your clubber.')).toBeTruthy();
      expect(screen.getByText('WEDNESDAY, NOVEMBER 4')).toBeTruthy();
    });

    it('points FORWARD to the poster deadline before October 15', () => {
      render(<PromoSlide promo={promo('parents')} />);
      expect(screen.getByText('DEFEND poster voting happens that night · posters due Oct 14')).toBeTruthy();
    });

    it('asks for a vote once the posters are in', () => {
      render(<PromoSlide promo={promo('parents', { afterContest: true })} />);
      expect(screen.getByText('While you’re here, vote for your favorite DEFEND poster!')).toBeTruthy();
      expect(screen.queryByText(/posters due Oct 14/)).toBeNull();
    });

    it('welcomes parents on the night itself', () => {
      render(<PromoSlide promo={promo('parents', { tonight: true, afterContest: true, countdown: 'Tonight!' })} />);
      expect(screen.getByText('Parents’ Night is tonight!')).toBeTruthy();
      expect(screen.getByText('Welcome, parents. Spend the evening with your clubber.')).toBeTruthy();
      expect(screen.getByText('Vote for your favorite DEFEND poster tonight!')).toBeTruthy();
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
      expect(screen.getByText('1 Peter 3:15 NKJV')).toBeTruthy();
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
