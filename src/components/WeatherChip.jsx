import { motion } from 'framer-motion';
import { WeatherGlyph } from './WeatherGlyphs.jsx';
import { Mark } from './Doodles.jsx';
import { weatherPresentation } from '../lib/weather.js';

/**
 * Corner weather chip — lives in the top-right stack under the wall
 * clock. Glanceable like the clock: parents heading out the door see
 * the temperature and a living little doodle of the sky (spinning sun,
 * drifting cloud, falling rain…) without waiting for a slide rotation.
 *
 * Renders nothing until a reading exists, so an API outage means no
 * chip rather than an empty box. All animation is transform/opacity
 * and honors <MotionConfig reducedMotion="user">.
 */
export default function WeatherChip({ weather }) {
  if (!weather) return null;
  const { label, icon } = weatherPresentation(weather.code, weather.isDay);
  const unit = weather.units === 'celsius' ? 'C' : 'F';

  return (
    <div className="weather-chip" role="status" aria-label={`${weather.temp} degrees, ${label}`}>
      {/* The glyph bobs and sways like it's happy to be here. */}
      <motion.span
        className="weather-chip-glyph"
        animate={{ y: [0, -3, 0], rotate: [-3, 3, -3] }}
        transition={{
          y: { duration: 3.2, repeat: Infinity, ease: 'easeInOut' },
          rotate: { duration: 5.4, repeat: Infinity, ease: 'easeInOut' },
        }}
      >
        <WeatherGlyph icon={icon} stroke="#ffffff" fill="#ffe6a3" />
      </motion.span>
      <motion.span
        className="weather-chip-temp"
        animate={{ scale: [1, 1.06, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      >
        {weather.temp}°<span className="weather-chip-unit">{unit}</span>
      </motion.span>
      {/* Every little while a sparkle winks at the corner of the chip. */}
      <motion.span
        className="weather-chip-spark"
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0, 1, 0], scale: [0.5, 0.5, 1.2, 0.5], rotate: [0, 0, 24, 0] }}
        transition={{ duration: 8, times: [0, 0.82, 0.91, 1], repeat: Infinity, ease: 'easeInOut' }}
      >
        <Mark kind="sparkle" size={18} />
      </motion.span>
    </div>
  );
}
