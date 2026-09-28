import React from 'react';
import { Words } from './Words.jsx';
import { measureEm } from '../lib/chip.js';
import { useFontsReady } from '../hooks/useFontsReady.js';

/**
 * The font size (in projector units) that sets `text` on ONE line across
 * `widthU`, never above `maxU`; below `minU` it stops shrinking and wraps
 * (between words) instead, so a long closing title stays readable.
 * @param {string} text
 * @param {{ maxU: number, widthU: number, minU?: number }} fit
 */
export function fittedSize(text, { maxU, widthU, minU = maxU * 0.7 }) {
  const em = measureEm(String(text).toUpperCase());
  const one = em > 0 ? widthU / em : maxU;
  return `calc(${Math.max(minU, Math.min(maxU, one)).toFixed(3)} * var(--u))`;
}

/**
 * The projector's one headline. Every view shouts the same way: Galindo
 * (the kit's shout voice) in caps, flat colour, broken only between words.
 * It replaces the three treatments that came before it (the per-letter
 * "crayon" tilt, the flat gold title, and the tilted GAME TIME!).
 *
 * `size` is a CSS length (projector units, e.g. `calc(7.6 * var(--u))`);
 * `fit` sizes it by measurement instead, so a title sits on one line when it
 * can (see fittedSize). `parts` makes each word an animated part of its
 * slide (see Words.jsx); without it nothing here touches framer-motion.
 *
 * @param {{
 *   text: string,
 *   as?: React.ElementType,
 *   color?: string,
 *   size?: string,
 *   fit?: { maxU: number, widthU: number, minU?: number },
 *   parts?: { start: number, hold?: number },
 *   className?: string,
 *   style?: React.CSSProperties,
 * }} props
 */
export const Headline = ({ text, as: Tag = 'h1', color = '#FFFFFF', size, fit, parts, className = '', style }) => {
  useFontsReady();
  const fontSize = fit ? fittedSize(text, fit) : size;
  return (
    <Tag className={`pj-headline ${className}`.trim()} style={{ color, fontSize, ...style }}>
      <Words text={text} parts={parts} />
    </Tag>
  );
};
