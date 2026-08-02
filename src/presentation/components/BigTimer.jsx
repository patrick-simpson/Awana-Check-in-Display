import React from 'react';
import { DigitReel } from './DigitReel.jsx';
import { rgbTriple } from '../lib/color.js';

const URGENT_COLOR = '#E8192C';

/**
 * The huge projector timer. Owns d/h/m/s decomposition, per-digit
 * reels in fixed-width cells, colon pulse, urgency treatment, and the
 * click-to-skip affordance.
 */
export const BigTimer = ({
  seconds,
  color = '#FFFFFF',
  urgencyEnabled = false,
  glow = true,
  onClick,
}) => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const isUrgent = urgencyEnabled && seconds > 0 && seconds < 60;
  const activeColor = isUrgent ? URGENT_COLOR : color;
  const sizeVar = days > 0 ? 'var(--text-timer-days)' : 'var(--text-timer)';

  const digitStyle = {
    fontSize: sizeVar,
    fontFamily: 'var(--font-display)',
    color: activeColor,
    ['--glow-color']: rgbTriple(activeColor),
    ...(glow ? { textShadow: isUrgent ? 'var(--glow-lg)' : 'var(--glow-md)' } : {}),
  };

  const unit = (label) => (
    <span
      className="opacity-50"
      style={{ fontSize: `calc(${sizeVar} * 0.42)`, marginLeft: '0.08em', marginRight: '0.3em' }}
    >
      {label}
    </span>
  );

  const colon = (
    <span style={{ animation: 'colonPulse 1s ease-in-out infinite', marginInline: '0.04em' }}>:</span>
  );

  const reels = (text, prefix) =>
    text.split('').map((d, i) => <DigitReel key={`${prefix}${i}`} value={d} />);

  return (
    <div
      className="cursor-pointer group/timer relative flex items-center justify-center select-none"
      onClick={onClick}
      title={onClick ? 'Click to skip' : undefined}
    >
      {isUrgent && (
        <>
          <div
            className="absolute inset-[-8%] rounded-full animate-pulse-ring border-2"
            style={{ borderColor: URGENT_COLOR }}
          />
          <div
            className="absolute inset-[-8%] rounded-full animate-pulse-ring border-2"
            style={{ borderColor: URGENT_COLOR, animationDelay: '0.7s' }}
          />
        </>
      )}

      {days > 0 ? (
        <div className="leading-none flex items-end" style={digitStyle}>
          {reels(String(days), 'd')}
          {unit('d')}
          {reels(String(hours).padStart(2, '0'), 'h')}
          {unit('h')}
          {reels(String(minutes).padStart(2, '0'), 'm')}
          {unit('m')}
        </div>
      ) : (
        <div className="leading-none flex items-center" style={digitStyle}>
          {hours > 0 && (
            <>
              {reels(String(hours), 'h')}
              {colon}
            </>
          )}
          {reels(String(minutes).padStart(hours > 0 ? 2 : 1, '0'), 'm')}
          {colon}
          {reels(String(secs).padStart(2, '0'), 's')}
        </div>
      )}

      {onClick && (
        <span
          className="absolute -bottom-8 right-0 text-white/0 group-hover/timer:text-white/40 transition-colors uppercase"
          style={{
            fontFamily: 'var(--font-condensed)',
            fontWeight: 700,
            fontSize: 'clamp(0.7rem, 0.9vw, 1.1rem)',
            letterSpacing: '0.2em',
          }}
        >
          Click to skip →
        </span>
      )}
    </div>
  );
};
