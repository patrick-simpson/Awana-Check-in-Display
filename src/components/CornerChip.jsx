import { AnimatePresence } from 'framer-motion';
import { M } from '../lib/motion.jsx';
import { DUR, EASE } from '../lib/brand.js';
import StepChip from './brand/StepChip.jsx';

/**
 * The corner's one item as a catalog stepped chip ("RIGHT NOW / 7:56",
 * "TONIGHT / 23", "CLOUDY / 58°"), for one corner. App renders one of these
 * per corner and hands both the same `item`; each shows it only when the
 * item belongs to its corner, so exactly one chip is ever up.
 *
 * Keyed on the load count, so every slide load lands the chip afresh (a pop
 * on the brand's curve, a beat after the slide), and the previous one lifts
 * away. Hidden (a slide that holds check-ins) it simply leaves.
 *
 * @param {{
 *   item: import('../lib/cornerInfo.js').CornerSnapshot | null,
 *   corner: 'top' | 'bottom',
 *   loads: number,
 *   hidden?: boolean,
 *   note?: string | null,
 *   size?: string,
 * }} props
 */
export default function CornerChip({ item, corner, loads, hidden = false, note = null, size }) {
  const show = !hidden && item && item.corner === corner;
  return (
    <AnimatePresence>
      {show && (
        <M.div
          key={`${item.id}-${loads}`}
          className={`corner-chip corner-chip--${corner} corner-chip--${item.id}`}
          role="status"
          aria-label={item.spoken}
          initial={{ opacity: 0, scale: 0.6, rotate: -6 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          exit={{ opacity: 0, scale: 0.9, transition: { duration: DUR.exit, ease: EASE.exit } }}
          transition={{ duration: DUR.pop, delay: 0.3, ease: EASE.pop }}
        >
          <StepChip label={item.label.toUpperCase()} value={item.value} size={size} />
          {note && item.id === 'tally' && <span className="corner-chip__note">{note}</span>}
        </M.div>
      )}
    </AnimatePresence>
  );
}
