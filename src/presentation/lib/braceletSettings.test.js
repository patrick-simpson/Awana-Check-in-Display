import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_BRACELET_SETTINGS, braceletSettingsChanged, getBraceletSettings, resetBraceletSettings,
  sanitizeBraceletSettings, setBraceletSettings, subscribeBraceletSettings,
} from './braceletSettings.js';

beforeEach(() => resetBraceletSettings());

describe('the Bracelet Time controls', () => {
  it('default to the full show', () => {
    expect(DEFAULT_BRACELET_SETTINGS).toEqual({ display: 'auto', hold: null, epic: true, chime: true, still: false });
    expect(getBraceletSettings()).toEqual(DEFAULT_BRACELET_SETTINGS);
  });

  it('sanitize anything stored', () => {
    expect(sanitizeBraceletSettings({ display: 'poster', hold: 13, epic: 0, chime: 'no', still: 1 }))
      .toEqual({ display: 'auto', hold: null, epic: true, chime: true, still: false });
    expect(sanitizeBraceletSettings({ display: 'handout2', hold: 0, epic: false, chime: false, still: true }))
      .toEqual({ display: 'handout2', hold: 0, epic: false, chime: false, still: true });
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
});
