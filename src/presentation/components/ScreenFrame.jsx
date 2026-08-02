import React from 'react';
import { BrandBar } from './BrandBar.jsx';
import { Vignette, Scanlines } from './Vignette.jsx';

/**
 * The shared pure-black shell: brand bars top AND bottom (the old
 * Slide was missing its bottom bar), ambient layer stack, scanlines
 * and vignette applied identically on every view.
 */
export const ScreenFrame = ({
  layers,
  vignette = 'soft',
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
    <Scanlines />
    <Vignette strength={vignette} />

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
