import React from 'react';
import { BrandBar } from './BrandBar.jsx';

/**
 * The shared pure-black shell: brand bars top AND bottom (the old
 * Slide was missing its bottom bar) and the ambient layer stack,
 * applied identically on every view. Flat and crisp — no scanlines,
 * no edge-darkening vignette; this is a projector on a white wall.
 */
export const ScreenFrame = ({
  layers,
  brandBars = true,
  shake = false,
  className = '',
  children,
}) => (
  <div
    className={`w-full h-full flex flex-col relative overflow-hidden ${shake ? 'animate-screen-shake' : ''} ${className}`}
    style={{ background: '#000000' }}
  >
    {layers}

    {brandBars && (
      <div className="relative z-10 flex-shrink-0">
        <BrandBar height={6} />
      </div>
    )}
    <div className="relative z-10 flex-1 flex flex-col min-h-0">{children}</div>
    {brandBars && (
      <div className="relative z-10 flex-shrink-0">
        <BrandBar height={6} />
      </div>
    )}
  </div>
);
