import { useEffect, useState } from 'react';

/**
 * Corner wall clock. The countdown answers "how long until club starts";
 * this answers "what time is it" for parents and volunteers all night.
 */
export default function WallClock() {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const { time, meridiem } = formatClock(now);

  return (
    <div className="wall-clock" role="timer" aria-label={`Current time ${time} ${meridiem}`}>
      <span className="time">{time}</span>
      <span className="meridiem">{meridiem}</span>
    </div>
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
