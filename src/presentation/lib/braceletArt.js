// TEMP STUB (replaced by the art branch)
export const STAGE_W = 1460; export const STAGE_H = 560; export const EPIC_SEC = 90;
export const BEAD_TONES = { black: { tone: '#1c1b22', light: '#4a4852', dark: '#050507' }, red: { tone: '#d7263d', light: '#ff6b78', dark: '#8e0e20' }, white: { tone: '#f4f3f0', light: '#ffffff', dark: '#c9c6d4' }, blue: { tone: '#1f5fd6', light: '#6aa0ff', dark: '#0e3690' }, green: { tone: '#22a447', light: '#6ee08a', dark: '#0f6a2a' }, yellow: { tone: '#ffc928', light: '#fff0a8', dark: '#d18f00' }, clear: { tone: 'rgba(214,236,255,0.18)', light: '#fff', dark: 'rgba(255,255,255,0.9)' } };
export function stepProgress(i, s) { return Math.min(1, Math.max(0, s / 6)); }
