import React from 'react';

/** The one solid surface for floating operator controls (nav, toasts). */
export const GlassPanel = ({ className = '', children }) => (
  <div className={`bg-[#111111] border-2 border-white/20 rounded-2xl ${className}`}>
    {children}
  </div>
);
