import { useEffect, useState } from 'react';
import { M } from '../lib/motion.jsx';
import StickerChip from './StickerChip.jsx';

/**
 * Corner wall clock. The countdown answers "how long until club starts";
 * this answers "what time is it" for parents and volunteers all night.
 * The colon breathes once per couple of seconds so the sticker feels
 * alive even when the minutes aren't moving.
 */
export default function WallClock() {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const { time, meridiem } = formatClock(now);
  const [hours, minutes] = time.split(':');

  return (
    <StickerChip
      className="wall-clock"
      label="Right now"
      tilt={-1.4}
      role="timer"
      aria-label={`Current time ${time} ${meridiem}`}
    >
      <span className="time">
        {hours}
        <M.span
          className="time-colon"
          aria-hidden
          animate={{ opacity: [1, 0.25, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          :
        </M.span>
        {minutes}
      </span>
      <span className="meridiem">{meridiem}</span>
    </StickerChip>
  );
}

export function formatClock(ms) {
  const d = new Date(ms);
  const hours24 = d.getHours();
  const meridiem = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return { time: `${hours12}:${minutes}`, meridiem };
}
