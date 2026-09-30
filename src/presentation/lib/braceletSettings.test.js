import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_BRACELET_SETTINGS, braceletForced, braceletSettingsChanged, getBraceletSettings, resetBraceletSettings,
  sanitizeBraceletSettings, setBraceletForced, setBraceletSettings, subscribeBraceletSettings,
} from './braceletSettings.js';

beforeEach(() => resetBraceletSettings());

describe('the Bracelet Time controls', () => {
  it('default to the full show', () => {
    expect(DEFAULT_BRACELET_SETTINGS).toEqual({ display: 'auto', hold: null, epic: true, chime: true, still: false, force: null });
    expect(getBraceletSettings()).toEqual(DEFAULT_BRACELET_SETTINGS);
  });

  it('sanitize anything stored', () => {
    expect(sanitizeBraceletSettings({ display: 'poster', hold: 13, epic: 0, chime: 'no', still: 1, force: 'yes' }))
      .toEqual({ display: 'auto', hold: null, epic: true, chime: true, still: false, force: null });
    expect(sanitizeBraceletSettings({ display: 'handout2', hold: 0, epic: false, chime: false, still: true, force: 1_790_000_000_000 }))
      .toEqual({ display: 'handout2', hold: 0, epic: false, chime: false, still: true, force: 1_790_000_000_000 });
    for (const force of [0, -5, NaN, Infinity, null, true]) expect(sanitizeBraceletSettings({ force }).force).toBeNull();
    expect(sanitizeBraceletSettings(null)).toEqual(DEFAULT_BRACELET_SETTINGS);
  });

  it('are saved until Reset, and tell their listeners', () => {
    let calls = 0;
    const off = subscribeBraceletSettings(() => { calls += 1; });
    setBraceletSettings({ hold: 8, chime: false });
    expect(getBraceletSettings()).toMatchObject({ hold: 8, chime: false });
    expect(JSON.parse(localStorage.getItem('awanaBraceletSettings.v1'))).toMatchObject({ hold: 8, chime: false });
    expect(braceletSettingsChanged()).toBe(true);
    resetBraceletSettings();
    expect(getBraceletSettings()).toEqual(DEFAULT_BRACELET_SETTINGS);
    expect(localStorage.getItem('awanaBraceletSettings.v1')).toBeNull();
    expect(braceletSettingsChanged()).toBe(false);
    expect(calls).toBe(2);
    off();
  });

  it('"Show Bracelet Time now" lasts the rest of the day it went on, through a reload, and is off from midnight', () => {
    const on = new Date(2026, 8, 23, 17, 45); // a Wednesday that is not a bracelet night
    setBraceletForced(true, on);
    const s = getBraceletSettings();
    expect(s.force).toBe(on.getTime());
    expect(JSON.parse(localStorage.getItem('awanaBraceletSettings.v1')).force).toBe(on.getTime());
    expect(braceletForced(s, on)).toBe(true);
    expect(braceletForced(s, new Date(2026, 8, 23, 23, 59, 59))).toBe(true);
    expect(braceletForced(s, new Date(2026, 8, 24, 0, 0, 0))).toBe(false);
    expect(braceletForced(s, new Date(2026, 8, 30, 18, 0))).toBe(false); // a week later: never next week's opening
    expect(braceletForced(sanitizeBraceletSettings(JSON.parse(localStorage.getItem('awanaBraceletSettings.v1'))), on)).toBe(true);
    expect(braceletSettingsChanged()).toBe(true);
    setBraceletForced(false, on);
    expect(braceletForced(getBraceletSettings(), on)).toBe(false);
  });

  it('Reset switches "Show Bracelet Time now" off too', () => {
    const on = new Date(2026, 8, 23, 17, 45);
    setBraceletForced(true, on);
    resetBraceletSettings();
    expect(braceletForced(getBraceletSettings(), on)).toBe(false);
  });
});
