import { motion } from 'framer-motion';
import { THEMES } from './CatalogScene.jsx';
import { weatherPresentation } from '../lib/weather.js';

// The weather moment — fills the "next week" slot when there's nothing
// special to tease. Drawn in the catalog's hand-doodle language: a big
// line-art glyph (rotating sun rays, drifting clouds, falling rain
// dashes…) over the same CatalogScene sky the text slides use. All
// animation is transform/opacity so cheap signage sticks keep 60fps.

const loop = (duration, extra = {}) => ({
  repeat: Infinity, ease: 'easeInOut', duration, ...extra,
});

function Sun({ stroke }) {
  return (
    <g stroke={stroke} fill="none" strokeWidth="7" strokeLinecap="round">
      {/* Rays spin as one slow wheel; the core breathes. */}
      <motion.g
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        animate={{ rotate: 360 }}
        transition={{ duration: 46, repeat: Infinity, ease: 'linear' }}
      >
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return (
            <line
              key={i}
              x1={100 + Math.cos(a) * 62} y1={100 + Math.sin(a) * 62}
              x2={100 + Math.cos(a) * 82} y2={100 + Math.sin(a) * 82}
            />
          );
        })}
      </motion.g>
      <motion.circle
        cx="100" cy="100" r="40"
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        animate={{ scale: [1, 1.06, 1] }}
        transition={loop(4)}
      />
    </g>
  );
}

function Moon({ stroke, fill }) {
  return (
    <g>
      <motion.path
        d="M138 62 A58 58 0 1 0 138 138 A46 46 0 0 1 138 62 Z"
        stroke={stroke} fill="none" strokeWidth="7" strokeLinejoin="round"
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        animate={{ rotate: [-4, 4, -4] }}
        transition={loop(7)}
      />
      {[[158, 60, 0], [172, 96, 1.4], [152, 128, 2.6]].map(([x, y, delay], i) => (
        <motion.path
          key={i}
          d={`M${x} ${y - 8} c1.2 5.5 4.3 8.6 9.8 9.8 c-5.5 1.2 -8.6 4.3 -9.8 9.8 c-1.2 -5.5 -4.3 -8.6 -9.8 -9.8 c5.5 -1.2 8.6 -4.3 9.8 -9.8z`}
          fill={fill}
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.15, 0.8] }}
          transition={loop(3.2, { delay })}
        />
      ))}
    </g>
  );
}

function CloudShape({ stroke, x = 0, y = 0, scale = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path
        d="M40 110 a24 24 0 0 1 6 -47 a32 32 0 0 1 62 -8 a26 26 0 0 1 12 55 z"
        stroke={stroke} fill="none" strokeWidth="7" strokeLinejoin="round" strokeLinecap="round"
      />
    </g>
  );
}

function DriftingCloud({ stroke, x, y, scale, duration, delay = 0 }) {
  return (
    <motion.g animate={{ x: [0, 14, 0] }} transition={loop(duration, { delay })}>
      <CloudShape stroke={stroke} x={x} y={y} scale={scale} />
    </motion.g>
  );
}

function Partly({ stroke }) {
  return (
    <g>
      <motion.g
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        animate={{ rotate: 360 }}
        transition={{ duration: 46, repeat: Infinity, ease: 'linear' }}
      >
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return (
            <line
              key={i}
              x1={120 + Math.cos(a) * 40} y1={72 + Math.sin(a) * 40}
              x2={120 + Math.cos(a) * 54} y2={72 + Math.sin(a) * 54}
              stroke={stroke} strokeWidth="6" strokeLinecap="round"
            />
          );
        })}
      </motion.g>
      <circle cx="120" cy="72" r="26" stroke={stroke} fill="none" strokeWidth="6" />
      <DriftingCloud stroke={stroke} x={28} y={52} scale={1.05} duration={9} />
    </g>
  );
}

function Clouds({ stroke }) {
  return (
    <g>
      <DriftingCloud stroke={stroke} x={54} y={26} scale={0.72} duration={11} delay={1.5} />
      <DriftingCloud stroke={stroke} x={22} y={72} scale={1.12} duration={8} />
    </g>
  );
}

function Fog({ stroke }) {
  return (
    <g>
      <CloudShape stroke={stroke} x={34} y={18} scale={0.95} />
      {[132, 152, 172].map((y, i) => (
        <motion.line
          key={y}
          x1="46" y1={y} x2="154" y2={y}
          stroke={stroke} strokeWidth="7" strokeLinecap="round"
          animate={{ x: [0, i % 2 ? -14 : 14, 0], opacity: [0.4, 0.9, 0.4] }}
          transition={loop(5 + i)}
        />
      ))}
    </g>
  );
}

function Drops({ stroke, kind }) {
  // Rain dashes or snow dots falling under the cloud, staggered so the
  // shower reads as continuous.
  const xs = [58, 86, 114, 142];
  return (
    <g>
      {xs.map((x, i) => (
        <motion.g
          key={x}
          initial={{ y: 0, opacity: 0 }}
          animate={{ y: [0, 44], opacity: [0, 1, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeIn', delay: i * 0.35 }}
        >
          {kind === 'snow' ? (
            <circle cx={x} cy={128} r="6" fill={stroke} />
          ) : (
            <line x1={x} y1={122} x2={x - 6} y2={140} stroke={stroke} strokeWidth="7" strokeLinecap="round" />
          )}
        </motion.g>
      ))}
    </g>
  );
}

function Rain({ stroke }) {
  return (
    <g>
      <CloudShape stroke={stroke} x={34} y={10} scale={1} />
      <Drops stroke={stroke} kind="rain" />
    </g>
  );
}

function Snow({ stroke }) {
  return (
    <g>
      <CloudShape stroke={stroke} x={34} y={10} scale={1} />
      <Drops stroke={stroke} kind="snow" />
    </g>
  );
}

function Storm({ stroke, fill }) {
  return (
    <g>
      <CloudShape stroke={stroke} x={34} y={6} scale={1} />
      <motion.path
        d="M104 116 L84 152 L102 152 L92 184 L124 142 L104 142 L118 116 Z"
        fill={fill} stroke={stroke} strokeWidth="4" strokeLinejoin="round"
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        animate={{ opacity: [0.35, 1, 1, 0.35], scale: [0.92, 1.05, 1.05, 0.92] }}
        transition={{ duration: 2.2, times: [0, 0.15, 0.6, 1], repeat: Infinity, ease: 'easeOut' }}
      />
    </g>
  );
}

const GLYPHS = { sun: Sun, moon: Moon, partly: Partly, cloud: Clouds, fog: Fog, rain: Rain, snow: Snow, storm: Storm };

export function WeatherGlyph({ icon, stroke, fill }) {
  const Glyph = GLYPHS[icon] || Partly;
  return (
    <svg className="weather-glyph" viewBox="0 0 200 200" aria-hidden>
      <Glyph stroke={stroke} fill={fill} />
    </svg>
  );
}

export default function WeatherSlide({ weather, locationName }) {
  if (!weather) return null;
  const { label, icon, theme } = weatherPresentation(weather.code, weather.isDay);
  const t = THEMES[theme] || THEMES.sky;
  const unit = weather.units === 'celsius' ? 'C' : 'F';
  const showFeels = weather.apparent != null && weather.apparent !== weather.temp;

  return (
    <div className="manual-slide-copy weather-slide">
      {locationName ? (
        <span className="manual-slide-eyebrow">
          {weather.isDay ? 'Today' : 'Tonight'} in {locationName}
        </span>
      ) : null}
      <div className="weather-row">
        <motion.div
          className="weather-glyph-wrap"
          animate={{ y: [0, -10, 0] }}
          transition={loop(6)}
        >
          <WeatherGlyph icon={icon} stroke={t.doodleStroke} fill={t.doodleFill} />
        </motion.div>
        <div className="weather-temp">
          {weather.temp}°<span className="weather-unit">{unit}</span>
        </div>
      </div>
      <div className="weather-label">{label}</div>
      {showFeels ? <div className="weather-feels">feels like {weather.apparent}°</div> : null}
    </div>
  );
}
