import { describe, expect, it } from 'vitest';
import {
  autoSkin, resolveSkin, sceneForSkin, skinForCalendarTitle,
  skinOptions, NIGHT_THEME_VALUES, SKINS, SKIN_TABLE,
} from './skins.js';
import { THEMES } from '../components/CatalogScene.jsx';

describe('autoSkin', () => {
  it('maps each month to a seasonal skin', () => {
    expect(autoSkin(new Date(2026, 0, 14))).toBe('snowday');
    expect(autoSkin(new Date(2026, 3, 14))).toBe('spring');
    expect(autoSkin(new Date(2026, 6, 14))).toBe('summer');
    expect(autoSkin(new Date(2026, 7, 14))).toBe('backtoschool');
    expect(autoSkin(new Date(2026, 8, 14))).toBe('autumn');
    expect(autoSkin(new Date(2026, 10, 14))).toBe('thanksgiving');
    expect(autoSkin(new Date(2026, 11, 14))).toBe('christmas');
  });

  it('only ever returns a known skin', () => {
    for (let m = 0; m < 12; m++) {
      expect(SKINS).toContain(autoSkin(new Date(2026, m, 15)));
    }
  });
});

describe('skinForCalendarTitle', () => {
  it('matches the seasons a month table cannot express', () => {
    // These are precisely why 'auto' needed calendar input: Easter is lunar,
    // Thanksgiving floats to the 4th Thursday, and VBS / back-to-school are
    // whenever the church schedules them.
    expect(skinForCalendarTitle('Easter Party')).toBe('easter');
    expect(skinForCalendarTitle('Thanksgiving Feast')).toBe('thanksgiving');
    expect(skinForCalendarTitle('VBS Kickoff Night')).toBe('vbs');
    expect(skinForCalendarTitle('Back to School Bash')).toBe('backtoschool');
    expect(skinForCalendarTitle('Christmas Program')).toBe('christmas');
  });

  it('is case and position insensitive', () => {
    expect(skinForCalendarTitle('tonight: EASTER egg hunt')).toBe('easter');
  });

  it('prefers the longest keyword match', () => {
    expect(skinForCalendarTitle('Vacation Bible School week')).toBe('vbs');
  });

  it('does not let a generic word hijack a specific season', () => {
    // Regression: 'kickoff' was a back-to-school keyword, and being longer than
    // 'vbs' it won — so "VBS Kickoff Night" dressed the room for back-to-school.
    // Generic keywords were removed; this pins that.
    expect(skinForCalendarTitle('VBS Kickoff Night')).toBe('vbs');
    expect(skinForCalendarTitle('Christmas Kickoff')).toBe('christmas');
  });

  it('returns null when nothing matches', () => {
    expect(skinForCalendarTitle('Regular Club Night')).toBeNull();
    expect(skinForCalendarTitle('')).toBeNull();
    expect(skinForCalendarTitle(null)).toBeNull();
    expect(skinForCalendarTitle(undefined)).toBeNull();
    expect(skinForCalendarTitle(42)).toBeNull();
  });
});

describe('resolveSkin', () => {
  it('passes explicit skins through', () => {
    expect(resolveSkin('christmas')).toBe('christmas');
    expect(resolveSkin('thanksgiving')).toBe('thanksgiving');
    expect(resolveSkin('none')).toBe('none');
  });

  it('resolves auto by date when no calendar title is given', () => {
    expect(resolveSkin('auto', new Date(2026, 11, 25))).toBe('christmas');
    expect(resolveSkin('auto', new Date(2026, 4, 1))).toBe('spring');
  });

  it('lets the calendar title beat the month under auto', () => {
    // An Easter party in April: the month says 'spring', the calendar says
    // Easter, and the calendar wins.
    expect(resolveSkin('auto', new Date(2026, 3, 5), 'Easter Sunday Party')).toBe('easter');
  });

  it('falls back to the month when the title matches nothing', () => {
    expect(resolveSkin('auto', new Date(2026, 3, 5), 'Regular Club Night')).toBe('spring');
  });

  it('ignores the calendar title when a skin is explicitly chosen', () => {
    // An operator who picked a skin by hand should keep it, whatever tonight is
    // called.
    expect(resolveSkin('snowday', new Date(2026, 3, 5), 'Easter Party')).toBe('snowday');
  });

  it('falls back to none on garbage', () => {
    expect(resolveSkin('neon')).toBe('none');
    expect(resolveSkin(undefined)).toBe('none');
  });
});

describe('sceneForSkin', () => {
  it('gives every skin a scene that actually exists', () => {
    // A typo here would silently fall back to the default scene, so the season
    // would appear to do nothing.
    for (const [id, skin] of Object.entries(SKIN_TABLE)) {
      expect(Object.keys(THEMES), `${id} → ${skin.scene}`).toContain(skin.scene);
      expect(sceneForSkin(id)).toBe(skin.scene);
    }
  });

  it('returns null for none and for unknown skins', () => {
    // null, not a default — the caller keeps its own default rather than having
    // one imposed here.
    expect(sceneForSkin('none')).toBeNull();
    expect(sceneForSkin('nope')).toBeNull();
  });
});

describe('the skin table is the single source of truth', () => {
  it('NIGHT_THEME_VALUES covers none, auto and every skin', () => {
    expect(NIGHT_THEME_VALUES).toContain('none');
    expect(NIGHT_THEME_VALUES).toContain('auto');
    for (const id of Object.keys(SKIN_TABLE)) expect(NIGHT_THEME_VALUES).toContain(id);
    expect(NIGHT_THEME_VALUES).toHaveLength(Object.keys(SKIN_TABLE).length + 2);
  });

  it('every skin resolves through resolveSkin (no orphan ids)', () => {
    for (const id of Object.keys(SKIN_TABLE)) expect(resolveSkin(id)).toBe(id);
  });

  it('skinOptions offers every value the validator accepts', () => {
    const values = skinOptions().map((o) => o.value);
    expect([...values].sort()).toEqual([...NIGHT_THEME_VALUES].sort());
  });

  it('every skin has both accent colours and a label', () => {
    for (const [id, skin] of Object.entries(SKIN_TABLE)) {
      expect(skin.a, `${id}.a`).toMatch(/^#[0-9a-f]{6}$/i);
      expect(skin.b, `${id}.b`).toMatch(/^#[0-9a-f]{6}$/i);
      expect(skin.label, `${id}.label`).toBeTruthy();
    }
  });
});
