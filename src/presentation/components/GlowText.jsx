import React from 'react';
import { rgbTriple } from '../lib/color.js';

/**
 * Typography + glow in one place: size and font come from the token
 * scale, the glow color is derived from the text color. Replaces the
 * per-view one-off text-shadow literals.
 */
export const GlowText = ({
  as: Tag = 'div',
  size,
  font = 'display',
  color = '#FFFFFF',
  glow,
  className = '',
  style,
  children,
}) => (
  <Tag
    className={className}
    style={{
      fontSize: `var(--text-${size})`,
      fontFamily: `var(--font-${font})`,
      color,
      ...(glow
        ? {
            ['--glow-color']: rgbTriple(color),
            textShadow: `var(--glow-${glow})`,
          }
        : {}),
      ...style,
    }}
  >
    {children}
  </Tag>
);
