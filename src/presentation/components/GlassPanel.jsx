import React from 'react';

/** The one glass surface for floating operator controls (nav, toasts). */
export const GlassPanel = ({ className = '', children }) => (
  <div
    className={`bg-black/50 backdrop-blur-xl border border-white/10 rounded-2xl ${className}`}
    style={{ boxShadow: '0 0 30px rgba(255,255,255,0.04), 0 8px 32px rgba(0,0,0,0.8)' }}
  >
    {children}
  </div>
);
