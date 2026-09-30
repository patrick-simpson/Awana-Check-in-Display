// TEMP STUB (replaced by the art branch)
import React from 'react';
export function StepArt({ step, p = 1, className }) {
  return (<svg viewBox="0 0 1460 560" className={className} role="img" aria-hidden="true"><rect x="10" y="10" width="1440" height="540" rx="30" fill="none" stroke="#555" strokeWidth="6" /><line x1="80" y1="300" x2="1380" y2="300" stroke="#fff" strokeWidth="24" strokeLinecap="round" /><text x="730" y="200" fill="#fff" fontSize="120" textAnchor="middle">{`step ${step + 1} p=${p.toFixed(2)}`}</text></svg>);
}
