import { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { M } from '../lib/motion.jsx';
import { getMascotClubs } from '../lib/clubs.js';

// Mascot moments (#17): between check-ins, a club mascot occasionally peeks
// up from the bottom edge or scoots across it — the lobby's version of the
// scene's SceneWinks, but with the official club characters. Rules:
//   • idle-only: suppressed the moment a banner or celebration is on screen,
//     and any in-flight moment is cut immediately;
//   • rare on purpose: one moment every ~2–3.5 minutes, 6–9s long — ambience,
//     not a show;
//   • motion goes through M (zero-animation mode kills it wholesale) and the
//     whole layer is skipped under reduceMotion/lowPower;
//   • only clubs with official mascot art participate (Trek/Journey have
//     none, by design — see clubs.js).
const MOMENT_MIN_GAP_MS = 120000;
const MOMENT_GAP_JITTER_MS = 90000;
const PEEK_MS = 6500;
const SCOOT_MS = 9000;

export default function MascotMoments({ suppressed }) {
  const [moment, setMoment] = useState(null);
  const suppressedRef = useRef(suppressed);

  useEffect(() => {
    suppressedRef.current = suppressed;
  }, [suppressed]);

  // A banner appearing mid-moment sends the mascot away instantly — the
  // child's name owns the screen. Derived at render (no state write): the
  // moment's own clear timer still runs, so it won't linger past its slot.
  const shown = suppressed ? null : moment;

  useEffect(() => {
    const clubs = getMascotClubs();
    if (!clubs.length) return undefined;
    let showTimer;
    let clearTimer;
    let cancelled = false;
    const schedule = () => {
      showTimer = setTimeout(() => {
        if (cancelled) return;
        if (!suppressedRef.current) {
          const club = clubs[Math.floor(Math.random() * clubs.length)];
          const kind = Math.random() < 0.6 ? 'peek' : 'scoot';
          const next = {
            id: Date.now(),
            kind,
            mascot: club.mascot,
            name: club.name,
            // peek: somewhere along the bottom, clear of the corner widgets.
            x: 18 + Math.random() * 56,
            flip: Math.random() < 0.5,
          };
          setMoment(next);
          clearTimer = setTimeout(() => {
            if (!cancelled) setMoment(null);
          }, kind === 'peek' ? PEEK_MS : SCOOT_MS);
        }
        schedule();
      }, MOMENT_MIN_GAP_MS + Math.random() * MOMENT_GAP_JITTER_MS);
    };
    schedule();
    return () => {
      cancelled = true;
      clearTimeout(showTimer);
      clearTimeout(clearTimer);
    };
  }, []);

  return (
    <div className="mascot-moments" aria-hidden>
      <AnimatePresence>
        {shown && shown.kind === 'peek' && (
          <M.div
            key={shown.id}
            className="mascot-moment mascot-peek"
            style={{ left: `${shown.x}%`, scaleX: shown.flip ? -1 : 1 }}
            initial={{ y: '105%' }}
            animate={{ y: ['105%', '18%', '12%', '18%', '105%'] }}
            exit={{ y: '105%', transition: { duration: 0.4, ease: 'easeIn' } }}
            transition={{ duration: PEEK_MS / 1000, times: [0, 0.18, 0.5, 0.82, 1], ease: 'easeInOut' }}
          >
            <img src={shown.mascot} alt="" draggable={false} />
          </M.div>
        )}
        {shown && shown.kind === 'scoot' && (
          <M.div
            key={shown.id}
            className="mascot-moment mascot-scoot"
            style={{ scaleX: shown.flip ? -1 : 1 }}
            initial={{ x: shown.flip ? '110vw' : '-15vw' }}
            animate={{ x: shown.flip ? '-15vw' : '110vw', y: [0, -8, 0, -8, 0, -8, 0] }}
            exit={{ opacity: 0, transition: { duration: 0.3 } }}
            transition={{
              x: { duration: SCOOT_MS / 1000, ease: 'linear' },
              y: { duration: 1.4, repeat: Math.ceil(SCOOT_MS / 1400), ease: 'easeInOut' },
            }}
          >
            <img src={shown.mascot} alt="" draggable={false} />
          </M.div>
        )}
      </AnimatePresence>
    </div>
  );
}
