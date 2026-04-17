import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

/**
 * Semi-transparent corner timer counting down to the configured HH:MM.
 * If that time has already passed today, it targets the same time tomorrow.
 * When it reaches zero it elegantly fades out and stays hidden until
 * the target rolls over to a future time.
 */
export default function CountdownTimer({ targetTime }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const targetMs = resolveTarget(targetTime, now);
  const remaining = targetMs ? targetMs - now : 0;
  const visible = targetMs !== null && remaining > 0;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="countdown"
          className="countdown"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.6 } }}
          exit={{ opacity: 0, y: 20, transition: { duration: 0.8 } }}
        >
          <span className="label">Club starts in</span>
          <span className="time">{formatRemaining(remaining)}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function resolveTarget(hhmm, now) {
  if (!hhmm || typeof hhmm !== 'string') return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const min = Number(match[2]);
  if (hour < 0 || hour > 23 || min < 0 || min > 59) return null;

  const d = new Date(now);
  d.setHours(hour, min, 0, 0);
  // If we're already past today's target, count down to tomorrow's.
  if (d.getTime() <= now) d.setDate(d.getDate() + 1);
  return d.getTime();
}

function formatRemaining(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
