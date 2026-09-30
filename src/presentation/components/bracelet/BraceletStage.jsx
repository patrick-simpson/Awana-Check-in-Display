// TEMP STUB (replaced by the art branch)
import React from 'react';
import { StepArt } from './StepArt.jsx';
export function BraceletStage({ step, still }) { return <StepArt step={step} p={still ? 1 : 0.5} />; }
export function EpicStage({ still }) { return <StepArt step={0} p={still ? 1 : 0.5} />; }
export function currentEpicStep(sec) { if (sec < 4 || sec >= 84) return null; return Math.min(12, Math.floor((sec - 4) / 6.15)); }
