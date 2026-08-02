import React from 'react';

/**
 * Typography helper: size and font come from the token scale. Flat
 * solid color, no glow — kept for the shared size/font API so call
 * sites don't need to hand-roll font-family + clamp() sizing.
 */
export const GlowText = ({
  as: Tag = 'div',
  size,
  font = 'display',
  color = '#FFFFFF',
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
      ...style,
    }}
  >
    {children}
  </Tag>
);
