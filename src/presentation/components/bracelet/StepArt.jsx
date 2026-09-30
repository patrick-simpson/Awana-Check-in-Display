import React, { useId } from 'react';
import {
  BEAD_SIZE, BEAD_TONES, GLOVE_OUTLINE, IDENTITY_CAMERA, STAGE_H, STAGE_W, gloveParts, lineWeight, sceneOf,
} from '../../lib/braceletArt.js';
import { HOUSE } from '../../lib/kit.js';

// Draws one Bracelet Time picture: a display list from lib/braceletArt.js
// (sceneFor / introScene / finaleScene) inside a root <g> moved by the
// camera. A pure render with no clock of its own; BraceletStage drives it.
//
// Everything sits on a pure black wall, so the cord is cased (a white stroke
// under a near-black core, a faint highlight on top) and every bead carries a
// white keyline. The hands are classic white cartoon gloves with a dark
// outline, three stitch lines on the back, and a rolled cuff.
//
// Cheap on purpose (modest projector laptops): flat fills, a handful of
// linear gradients, no filters, no masks, no clip paths.

const INK = '#17161C';
const GLOVE_FILL = '#FFFFFF';
const CORD_CORE = '#1c1b22';
const OUTLINE = GLOVE_OUTLINE;
const SHOUT = { fontFamily: 'var(--font-display, "Paytone One", "Arial Rounded MT Bold", sans-serif)' };

const n1 = (v) => Math.round(v * 10) / 10;

/** A smooth path through the points (Catmull-Rom, as cubic Beziers). */
export function smoothPath(pts) {
  if (!pts || pts.length === 0) return '';
  if (pts.length === 1) return `M${n1(pts[0][0])} ${n1(pts[0][1])}`;
  let d = `M${n1(pts[0][0])} ${n1(pts[0][1])}`;
  if (pts.length === 2) return `${d} L${n1(pts[1][0])} ${n1(pts[1][1])}`;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${n1(c1x)} ${n1(c1y)} ${n1(c2x)} ${n1(c2y)} ${n1(p2[0])} ${n1(p2[1])}`;
  }
  return d;
}

const ROUND = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };

// ── The cord ─────────────────────────────────────────────────

function CordPath({ d, tone = 'front', w = 1 }) {
  if (tone === 'gold') {
    return <path d={d} {...ROUND} stroke={HOUSE.sun} strokeWidth={36 * w} />;
  }
  if (tone === 'back') {
    return (
      <g>
        <path d={d} {...ROUND} stroke="rgba(255,255,255,0.5)" strokeWidth={19 * w} />
        <path d={d} {...ROUND} stroke="#0d0c11" strokeWidth={11 * w} />
      </g>
    );
  }
  return (
    <g>
      <path d={d} {...ROUND} stroke="#FFFFFF" strokeWidth={22 * w} />
      <path d={d} {...ROUND} stroke={CORD_CORE} strokeWidth={12.5 * w} />
      <path d={d} {...ROUND} stroke="rgba(255,255,255,0.3)" strokeWidth={3 * w} transform="translate(-1.2 -2.4)" />
    </g>
  );
}

function Cord({ item }) {
  return <CordPath d={smoothPath(item.pts)} tone={item.tone} w={item.w} />;
}

// ── A bead (pony bead: a barrel, its hole along the cord) ────

const BEAD_L = BEAD_SIZE.l;
const BEAD_D = BEAD_SIZE.d;

const ICE = '#BFE8FF';
const GLINT = 'M0 -1 C0.14 -0.14 0.14 -0.14 1 0 C0.14 0.14 0.14 0.14 0 1 C-0.14 0.14 -0.14 0.14 -1 0 C-0.14 -0.14 -0.14 -0.14 0 -1 Z';

function BeadShape({ color, uid }) {
  const clear = color === 'clear';
  if (clear) {
    // Clear plastic on a black wall: an icy body the cord shows through, an
    // icy keyline, a bright diagonal glint and a little sparkle, so it reads
    // as glass from the back of the room and never as another dark bead.
    return (
      <g>
        <rect x={-BEAD_L / 2} y={-BEAD_D / 2} width={BEAD_L} height={BEAD_D} rx={26} fill={`url(#${uid}-bead-clear)`} stroke={ICE} strokeWidth={5} />
        <rect x={-BEAD_L / 2 + 7} y={-BEAD_D / 2 + 7} width={BEAD_L - 14} height={BEAD_D - 14} rx={19} fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth={2.5} />
        <rect x={-20} y={-40} width={13} height={50} rx={6.5} transform="rotate(28 -13 -15)" fill="#FFFFFF" opacity={0.92} />
        <rect x={10} y={10} width={8} height={24} rx={4} transform="rotate(28 14 22)" fill="#FFFFFF" opacity={0.55} />
        <path d={GLINT} transform="translate(22 -30) scale(11)" fill="#FFFFFF" />
      </g>
    );
  }
  const key = BEAD_TONES[color] ? color : 'black';
  return (
    <g>
      <rect
        x={-BEAD_L / 2} y={-BEAD_D / 2} width={BEAD_L} height={BEAD_D} rx={26}
        fill={`url(#${uid}-bead-${key})`} stroke="#FFFFFF" strokeWidth={5}
      />
      {/* The hole's shadow where the cord goes in, the base's shade, the glint. */}
      <rect x={-BEAD_L / 2 + 2} y={-10} width={9} height={20} rx={4} fill="rgba(0,0,0,0.32)" />
      <rect x={BEAD_L / 2 - 11} y={-10} width={9} height={20} rx={4} fill="rgba(0,0,0,0.32)" />
      <rect x={-24} y={26} width={48} height={11} rx={5.5} fill="rgba(0,0,0,0.16)" />
      <rect x={-24} y={-37} width={32} height={11} rx={5.5} fill="#FFFFFF" opacity={0.82} />
      <circle cx={17} cy={-31} r={4.5} fill="#FFFFFF" opacity={0.7} />
    </g>
  );
}

function Bead({ item, uid }) {
  const { x, y, rot, s, sx = 1, sy = 1, color } = item;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${n1(s * sx * 1000) / 1000} ${n1(s * sy * 1000) / 1000})`}>
      <BeadShape color={color} uid={uid} />
    </g>
  );
}

// ── The glove rig ────────────────────────────────────────────
// The poses' parts are lib/braceletArt.js's gloveParts (so the tests measure
// exactly what is drawn); here each part is drawn outline then fill.

function linePath(pts) {
  return pts.map((p, i) => `${i ? 'L' : 'M'}${n1(p[0])} ${n1(p[1])}`).join(' ');
}

function GlovePart({ part, lw }) {
  // lw: the glove's line weight (lineWeight), so every hand's outline and
  // stitches draw at one width on the wall, whatever the glove's size.
  const o = OUTLINE * lw;
  switch (part.t) {
    case 'cap': {
      const d = linePath(part.pts);
      return (
        <g>
          <path d={d} {...ROUND} stroke={INK} strokeWidth={part.w + o * 2} />
          <path d={d} {...ROUND} stroke={GLOVE_FILL} strokeWidth={part.w} />
        </g>
      );
    }
    case 'blob': {
      const t = part.rot ? `rotate(${part.rot} ${part.x + part.w / 2} ${part.y + part.h / 2})` : undefined;
      return (
        <rect
          x={part.x} y={part.y} width={part.w} height={part.h} rx={part.rx} transform={t}
          fill={GLOVE_FILL} stroke={INK} strokeWidth={o * 2} paintOrder="stroke"
        />
      );
    }
    case 'bump':
      return <circle cx={part.cx} cy={part.cy} r={part.r} fill={GLOVE_FILL} stroke={INK} strokeWidth={o * 2} paintOrder="stroke" />;
    case 'line':
      return <path d={linePath(part.pts)} {...ROUND} stroke={INK} strokeWidth={4.5 * lw} />;
    case 'zip':
      return <path d={linePath(part.pts)} {...ROUND} stroke={HOUSE.sun} strokeWidth={7} />;
    default:
      return null;
  }
}

function Glove({ item }) {
  const { x, y, rot, s, pose, flip } = item;
  const parts = gloveParts(pose, item);
  const lw = lineWeight(s);
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${flip ? -s : s} ${s})`} opacity={item.o != null && item.o < 1 ? item.o : undefined}>
      {parts.map((part, i) => <GlovePart key={i} part={part} lw={lw} />)}
    </g>
  );
}

// ── A knot on the cord ───────────────────────────────────────

// A tied knot: a lump of cord with the wrap showing across it.
// A knot: a lump of cord (three turns bunched together, keylined like a
// cord) with the turns showing across it, bead-sized so it reads from the
// back of the room, and never a ring with a line through it (a "no" sign).
const KNOT_LUMPS = [[-6, -6, 11], [6, -5, 11], [0, 7, 11.5]];

function Knot({ item }) {
  return (
    <g transform={`translate(${item.x} ${item.y}) rotate(${item.rot}) scale(${item.s})`}>
      {KNOT_LUMPS.map(([cx, cy, r]) => <circle key={`o${cx}${cy}`} cx={cx} cy={cy} r={r + 2.6} fill="#FFFFFF" />)}
      {KNOT_LUMPS.map(([cx, cy, r]) => <circle key={`i${cx}${cy}`} cx={cx} cy={cy} r={r} fill={CORD_CORE} />)}
      <path d="M-11 -12 C-3 -8 1 2 -4 14" {...ROUND} stroke="#FFFFFF" strokeWidth={3.4} />
      <path d="M1 -14 C9 -9 11 3 6 13" {...ROUND} stroke="#FFFFFF" strokeWidth={3.4} />
      <path d="M-4 -15 C2 -13 5 -9 6 -4" {...ROUND} stroke="rgba(255,255,255,0.35)" strokeWidth={2} />
    </g>
  );
}

// ── A bead pot (the intro) ───────────────────────────────────

const POT_BEADS = [[-34, -6, -14], [0, -12, 6], [34, -6, 18], [-17, -28, 24], [17, -28, -10]];

function Pot({ item, uid }) {
  const clear = item.color === 'clear';
  const key = BEAD_TONES[item.color] ? item.color : 'black';
  return (
    <g transform={`translate(${item.x} ${item.y}) scale(${item.s})`}>
      <ellipse cx={0} cy={0} rx={62} ry={15} fill="#0c0b10" stroke="#FFFFFF" strokeWidth={4} />
      {POT_BEADS.map(([bx, by, br], i) => (
        <rect
          key={i} x={bx - 16} y={by - 19} width={32} height={38} rx={11}
          transform={`rotate(${br} ${bx} ${by})`}
          fill={`url(#${uid}-bead-${key})`}
          stroke={clear ? ICE : '#FFFFFF'} strokeWidth={3.5}
        />
      ))}
      <path d="M-62 0 A62 15 0 0 0 62 0 Q60 62 0 66 Q-60 62 -62 0 Z" fill="#26242d" stroke="#FFFFFF" strokeWidth={4.5} strokeLinejoin="round" />
      <path d="M-44 26 Q-30 48 -6 52" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={5} strokeLinecap="round" />
    </g>
  );
}

// ── Words ────────────────────────────────────────────────────

function Words({ item }) {
  return (
    <g transform={`translate(${item.x} ${item.y}) rotate(${item.rot}) scale(${item.s})`} opacity={item.o} style={SHOUT}>
      <text x={7} y={8} textAnchor="middle" dominantBaseline="central" fontSize={item.size} fill={HOUSE.orange}>{item.text}</text>
      <text x={0} y={0} textAnchor="middle" dominantBaseline="central" fontSize={item.size} fill="#FFFFFF">{item.text}</text>
    </g>
  );
}

function Badge({ item }) {
  return (
    <g transform={`translate(${item.x} ${item.y}) scale(${item.s})`} opacity={item.o} style={SHOUT}>
      <circle r={30} fill={HOUSE.sun} stroke="#FFFFFF" strokeWidth={5} />
      <text x={0} y={2} textAnchor="middle" dominantBaseline="central" fontSize={38} fill={INK}>{item.text}</text>
    </g>
  );
}

// ── Tier 2 effects: small shapes, moved and scaled by transform ──

const RAYS = Array.from({ length: 8 }, (_, i) => {
  const a = (i / 8) * Math.PI * 2;
  return `M${n1(Math.cos(a) * 55) / 100} ${n1(Math.sin(a) * 55) / 100} L${n1(Math.cos(a) * 100) / 100} ${n1(Math.sin(a) * 100) / 100}`;
}).join(' ');
const SPARKLE = 'M0 -1 C0.14 -0.14 0.14 -0.14 1 0 C0.14 0.14 0.14 0.14 0 1 C-0.14 0.14 -0.14 0.14 -1 0 C-0.14 -0.14 -0.14 -0.14 0 -1 Z';

function Fx({ item }) {
  const t = `translate(${item.x} ${item.y}) rotate(${item.rot}) scale(${Math.max(0.01, item.s)})`;
  if (item.kind === 'burst') {
    return <path d={RAYS} transform={t} opacity={item.o} stroke={item.color} strokeWidth={0.1} strokeLinecap="round" fill="none" />;
  }
  if (item.kind === 'ring') {
    return <circle r={1} transform={t} opacity={item.o} fill="none" stroke={item.color} strokeWidth={6} vectorEffect="non-scaling-stroke" />;
  }
  return <path d={SPARKLE} transform={t} opacity={item.o} fill={item.color} />;
}

function Arrow({ item }) {
  const pts = item.pts;
  if (!pts || pts.length < 2) return null;
  const [ax, ay] = pts[pts.length - 2];
  const [bx, by] = pts[pts.length - 1];
  const a = (Math.atan2(by - ay, bx - ax) * 180) / Math.PI;
  return (
    <g opacity={item.o}>
      <path d={smoothPath(pts)} {...ROUND} stroke={HOUSE.sun} strokeWidth={7} strokeDasharray="16 14" />
      <path d="M0 0 L-26 -15 L-26 15 Z" transform={`translate(${bx} ${by}) rotate(${n1(a)})`} fill={HOUSE.sun} stroke={HOUSE.sun} strokeWidth={4} strokeLinejoin="round" />
    </g>
  );
}

function renderItem(item, i, uid) {
  switch (item.kind) {
    case 'cord': return <Cord key={i} item={item} />;
    case 'bead': return <Bead key={i} item={item} uid={uid} />;
    case 'glove': return <Glove key={i} item={item} />;
    case 'knot': return <Knot key={i} item={item} />;
    case 'pot': return <Pot key={i} item={item} uid={uid} />;
    case 'text': return <Words key={i} item={item} />;
    case 'badge': return <Badge key={i} item={item} />;
    case 'arrow': return <Arrow key={i} item={item} />;
    case 'burst':
    case 'ring':
    case 'sparkle':
      return <Fx key={i} item={item} />;
    default: return null;
  }
}

function Defs({ uid }) {
  const ice = BEAD_TONES.clear;
  return (
    <defs>
      <linearGradient id={`${uid}-bead-clear`} x1="0" y1="0" x2="0.35" y2="1">
        <stop offset="0" stopColor={ice.light} />
        <stop offset="0.45" stopColor={ice.tone} />
        <stop offset="1" stopColor={ice.dark} />
      </linearGradient>
      {Object.entries(BEAD_TONES).filter(([k]) => k !== 'clear').map(([k, t]) => (
        <linearGradient key={k} id={`${uid}-bead-${k}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={t.light} />
          <stop offset="0.42" stopColor={t.tone} />
          <stop offset="1" stopColor={t.dark} />
        </linearGradient>
      ))}
    </defs>
  );
}

/**
 * One Bracelet Time picture.
 *
 * @param {{
 *   step: number | 'intro' | 'finale',
 *   p?: number,
 *   camera?: { x: number, y: number, scale: number },
 *   className?: string,
 * }} props
 */
export function StepArt({ step, p = 1, camera, className }) {
  const uid = `brc${useId().replace(/[^A-Za-z0-9_-]/g, '')}`;
  const items = sceneOf(step ?? 0, p);
  const cam = camera ?? IDENTITY_CAMERA;
  return (
    <svg viewBox={`0 0 ${STAGE_W} ${STAGE_H}`} role="img" aria-hidden="true" className={className}>
      <Defs uid={uid} />
      <g transform={`translate(${cam.x} ${cam.y}) scale(${cam.scale})`}>
        {items.map((item, i) => renderItem(item, i, uid))}
      </g>
    </svg>
  );
}

export default StepArt;
