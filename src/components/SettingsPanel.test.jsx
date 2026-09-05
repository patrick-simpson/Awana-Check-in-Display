import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import defaults from '../config.js';
import { applyPanicMode } from '../lib/panic.js';
import { getAllClubs } from '../lib/clubs.js';
import { saveDisplayKey } from '../lib/displayKey.js';

// The display-login store is exercised in its own suite; here it is a
// settable snapshot so every UI branch can be reached synchronously.
const loginState = vi.hoisted(() => ({
  frameStatus: 'waiting',
  loginStatus: 'logged-out',
  kid: null,
  pendingLogin: false,
  hasLoginKey: false,
  login: vi.fn(async () => 'no-frame'),
  logout: vi.fn(),
}));
vi.mock('../hooks/useDisplayLogin.js', () => ({
  useDisplayLogin: () => ({ ...loginState }),
}));

// IndexedDB is absent in jsdom; the upload fields only need a stored file.
const video = vi.hoisted(() => ({
  BACKGROUND_VIDEO_ID: 'background',
  getVideo: vi.fn(async () => new File(['x'], 'clip.mp4', { type: 'video/mp4' })),
  putVideo: vi.fn(async () => {}),
  deleteVideo: vi.fn(async () => {}),
}));
vi.mock('../lib/videoStore.js', () => video);

const SettingsPanel = (await import('./SettingsPanel.jsx')).default;

// A plausible-looking display key (44 chars, base64, ends in '=') for the
// "key pasted by hand" branches. Never a real one.
const FAKE_KEY = 'QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVowMTIzNDU=';

// No global test setup file in this repo, so RTL's automatic cleanup
// (which needs a global afterEach) doesn't run — do it explicitly.
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
beforeEach(() => {
  localStorage.clear();
  Object.assign(loginState, {
    frameStatus: 'waiting', loginStatus: 'logged-out', kid: null, pendingLogin: false, hasLoginKey: false,
  });
  loginState.login.mockReset().mockImplementation(async () => 'no-frame');
  loginState.logout.mockReset();
});

// The Save control is a <jelly-button> web component (vendored script,
// loaded via index.html — not in jsdom). Its accessible button role
// lives in its shadow DOM, so tests target the host element by tag;
// React's onClick is attached to the host and fires the same way.
const clickSave = () => fireEvent.click(screen.getByText('Save', { selector: 'jelly-button' }));
const tab = (name) => fireEvent.click(screen.getByRole('tab', { name }));

const baseProps = () => ({
  config: { ...defaults, audioMuted: true },
  status: 'off',
  nameStatus: 'ok',
  demoActive: false,
  lastEventAt: null,
  calendar: { events: [], source: 'none', generatedAt: null, refresh: vi.fn() },
  onChange: vi.fn(),
  onReset: vi.fn(),
  onClose: vi.fn(),
  onTest: vi.fn(),
  onResetTally: vi.fn(),
  onOpenSlideEditor: vi.fn(),
  onOpenDebug: vi.fn(),
});

describe('SettingsPanel (tabbed)', () => {
  it('renders all five tabs with Connection active first', () => {
    render(<SettingsPanel {...baseProps()} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual([
      'Connection', 'Background', 'Banners & celebrations', 'Display', 'Calendar & Weather',
    ]);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(screen.getByLabelText('Pusher App Key')).toBeTruthy();
  });

  it('switches tabs on click and shows that tab’s fields', () => {
    render(<SettingsPanel {...baseProps()} />);
    tab('Calendar & Weather');
    expect(screen.getByLabelText('Calendar page URL')).toBeTruthy();
    expect(screen.queryByLabelText('Pusher App Key')).toBeNull();
  });

  it('moves between tabs with arrow keys, Home, and End', () => {
    render(<SettingsPanel {...baseProps()} />);
    const [first] = screen.getAllByRole('tab');
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Background' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Background' }), { key: 'ArrowLeft' });
    expect(screen.getByRole('tab', { name: 'Connection' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Connection' }), { key: 'End' });
    expect(screen.getByRole('tab', { name: 'Calendar & Weather' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Calendar & Weather' }), { key: 'Home' });
    expect(screen.getByRole('tab', { name: 'Connection' }).getAttribute('aria-selected')).toBe('true');
  });

  it('opens on the requested tab and reports tab changes', () => {
    const props = { ...baseProps(), initialTab: 'background', onTabChange: vi.fn() };
    render(<SettingsPanel {...props} />);
    expect(screen.getByRole('tab', { name: 'Background' }).getAttribute('aria-selected')).toBe('true');
    tab('Display');
    expect(props.onTabChange).toHaveBeenCalledWith('display');
  });

  it('keeps edits from multiple tabs and saves ONLY the edited keys in one patch', () => {
    const props = baseProps();
    render(<SettingsPanel {...props} />);

    fireEvent.change(screen.getByLabelText('Pusher App Key'), { target: { value: 'key123' } });
    tab('Calendar & Weather');
    fireEvent.change(screen.getByLabelText('Welcome wording (regular nights)'), {
      target: { value: 'Welcome to KVB Awana!' },
    });
    // Edits on the first tab survive the round trip.
    tab('Connection');
    expect(screen.getByLabelText('Pusher App Key').value).toBe('key123');

    clickSave();
    expect(props.onChange).toHaveBeenCalledTimes(1);
    const patch = props.onChange.mock.calls[0][0];
    expect(Object.keys(patch).sort()).toEqual(['calendarWelcomeText', 'pusherAppKey']);
    expect(patch.pusherAppKey).toBe('key123');
    expect(patch.calendarWelcomeText).toBe('Welcome to KVB Awana!');
    expect(props.onClose).toHaveBeenCalled();
  });

  it('an untouched Save writes nothing — a baked key or fleet value is never pinned', () => {
    const props = baseProps();
    props.config = { ...defaults, pusherAppKey: 'baked-from-build', audioMuted: true };
    render(<SettingsPanel {...props} />);
    clickSave();
    expect(props.onChange).not.toHaveBeenCalled();
    expect(props.onClose).toHaveBeenCalled();
  });

  it('clamps out-of-range values on save', () => {
    const props = baseProps();
    render(<SettingsPanel {...props} />);
    tab('Banners & celebrations');
    fireEvent.change(screen.getByLabelText('Standard banner duration (ms)'), { target: { value: '999999' } });
    clickSave();
    const patch = props.onChange.mock.calls[0][0];
    expect(patch.standardDisplayMs).toBe(20000);
    expect(Object.keys(patch)).toEqual(['standardDisplayMs']);
  });

  it('round-trips the widget display mode and cycle interval', () => {
    const props = baseProps();
    render(<SettingsPanel {...props} />);
    tab('Display');

    // Default mode is the animated cycle, defaulting to 3s, with its
    // interval field shown.
    expect(screen.getByLabelText('Animated cycle (recommended)').checked).toBe(true);
    expect(screen.getByLabelText('Seconds per item').value).toBe('3');
    fireEvent.change(screen.getByLabelText('Seconds per item'), { target: { value: '1' } });

    fireEvent.click(screen.getByLabelText('Classic corner stickers'));
    // The interval only matters in cycle mode, so the field hides.
    expect(screen.queryByLabelText('Seconds per item')).toBeNull();

    clickSave();
    const patch = props.onChange.mock.calls[0][0];
    expect(Object.keys(patch).sort()).toEqual(['cycleIntervalSec', 'widgetDisplayMode']);
    expect(patch.widgetDisplayMode).toBe('stickers');
    // Out-of-range interval edits still get clamped on save.
    expect(patch.cycleIntervalSec).toBe(2);
  });

  it('seeds the form from savedConfig, never from the panic-masked config', () => {
    const props = baseProps();
    const saved = {
      ...defaults, audioMuted: true, panicMode: true, backgroundSource: 'powerpoint',
      powerpointEmbedUrl: 'https://onedrive.live.com/embed?x', calendarEnabled: true,
    };
    props.savedConfig = saved;
    props.config = applyPanicMode(saved);
    render(<SettingsPanel {...props} />);
    tab('Display');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Simplified mode (panic switch)' }));
    clickSave();
    // Only the toggle the operator touched — the mask's placeholder values
    // (background source, empty URL, calendar off) never reach storage.
    expect(props.onChange.mock.calls[0][0]).toEqual({ panicMode: false });
  });

  it('Cancel on a clean panel closes without asking or writing', () => {
    const props = baseProps();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<SettingsPanel {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(confirm).not.toHaveBeenCalled();
    expect(props.onChange).not.toHaveBeenCalled();
    expect(props.onClose).toHaveBeenCalled();
  });

  it('a dirty panel asks before discarding on Cancel, Escape and the backdrop', () => {
    const props = baseProps();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { container } = render(<SettingsPanel {...props} />);
    fireEvent.change(screen.getByLabelText('Pusher App Key'), { target: { value: 'discard-me' } });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(props.onClose).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    fireEvent.click(container.querySelector('.panel-backdrop'));
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(props.onChange).not.toHaveBeenCalled();
  });

  it('Escape closes a clean panel', () => {
    const props = baseProps();
    render(<SettingsPanel {...props} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(props.onClose).toHaveBeenCalled();
  });

  it('Preview a check-in, Debug panel and Edit slides… all commit pending edits first', () => {
    for (const [label, cb] of [['Preview a check-in', 'onTest'], ['Debug panel', 'onOpenDebug']]) {
      const props = baseProps();
      render(<SettingsPanel {...props} />);
      fireEvent.change(screen.getByLabelText('Pusher App Key'), { target: { value: 'key123' } });
      fireEvent.click(screen.getByRole('button', { name: label }));
      expect(props.onChange).toHaveBeenCalledWith({ pusherAppKey: 'key123' });
      expect(props[cb]).toHaveBeenCalled();
      expect(props.onChange.mock.invocationCallOrder[0]).toBeLessThan(props[cb].mock.invocationCallOrder[0]);
      cleanup();
    }
    const props = baseProps();
    render(<SettingsPanel {...props} />);
    tab('Background');
    // Default source is Typed slides now; picking PowerPoint and heading to the editor saves that first.
    fireEvent.click(screen.getByLabelText('Looping PowerPoint'));
    fireEvent.click(screen.getByRole('button', { name: /Edit slides/ }));
    expect(props.onChange).toHaveBeenCalledWith({ backgroundSource: 'powerpoint' });
    expect(props.onChange.mock.invocationCallOrder[0]).toBeLessThan(props.onOpenSlideEditor.mock.invocationCallOrder[0]);
  });

  it('shows the live calendar preview line when data is loaded', () => {
    const props = baseProps();
    props.calendar = {
      events: [
        { date: '2099-01-06', kind: 'club', title: 'Awana meeting', isCancelled: false, isSpecial: false },
        { date: '2099-01-13', kind: 'club', title: 'Water Night', isCancelled: false, isSpecial: true },
      ],
      source: 'feed',
      generatedAt: new Date().toISOString(),
      refresh: vi.fn(),
    };
    render(<SettingsPanel {...props} />);
    tab('Calendar & Weather');
    expect(screen.getByText(/2 events loaded/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh now' }));
    expect(props.calendar.refresh).toHaveBeenCalled();
  });
});

describe('Connection tab', () => {
  it('names the login state in the header and the summary (key pasted by hand)', () => {
    saveDisplayKey(FAKE_KEY);
    const props = { ...baseProps(), status: 'connected' };
    render(<SettingsPanel {...props} />);
    expect(screen.getByText('Connected — check-ins will appear instantly')).toBeTruthy();
    expect(screen.getByText(/display key pasted by hand/)).toBeTruthy();
    expect(screen.getByText(/this screen can read encrypted names/)).toBeTruthy();
  });

  it('a connected but unkeyed screen is told to log in', () => {
    const props = { ...baseProps(), status: 'connected', nameStatus: 'no-key' };
    render(<SettingsPanel {...props} />);
    expect(screen.getByText('Connected — not logged in yet (Connection → Display login)')).toBeTruthy();
    expect(screen.getByText(/encrypted names are arriving but this screen has no key/)).toBeTruthy();
  });

  it('with no Pusher key the login field points at Advanced and the fold is open', () => {
    const { container } = render(<SettingsPanel {...baseProps()} />);
    expect(screen.getByText(/not connected to Pusher yet/)).toBeTruthy();
    expect(container.querySelector('details.advanced-fields').open).toBe(true);
    expect(screen.getByText('Not set up yet — add the Pusher App Key under Connection → Advanced')).toBeTruthy();
  });

  it('the passphrase box is typeable before any frame arrives and Log in enables on text', async () => {
    const props = { ...baseProps(), status: 'connected' };
    const { container } = render(<SettingsPanel {...props} />);
    // Connected: the by-hand fold stays closed — login leads.
    expect(container.querySelector('details.advanced-fields').open).toBe(false);
    const input = screen.getByLabelText('Display login');
    expect(input.disabled).toBe(false);
    const button = screen.getByRole('button', { name: 'Log in' });
    expect(button.disabled).toBe(true);
    fireEvent.change(input, { target: { value: 'abcd-efgh-ijkm-npqr' } });
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    await waitFor(() => expect(loginState.login).toHaveBeenCalledWith('abcd-efgh-ijkm-npqr'));
  });

  it('Show reveals the passphrase', () => {
    render(<SettingsPanel {...{ ...baseProps(), status: 'connected' }} />);
    const input = screen.getByLabelText('Display login');
    expect(input.type).toBe('password');
    fireEvent.click(screen.getByRole('button', { name: 'Show passphrase' }));
    expect(input.type).toBe('text');
    fireEvent.click(screen.getByRole('button', { name: 'Hide passphrase' }));
    expect(input.type).toBe('password');
  });

  it('a parked passphrase says it will be tried automatically', () => {
    Object.assign(loginState, { pendingLogin: true });
    render(<SettingsPanel {...{ ...baseProps(), status: 'connected' }} />);
    expect(screen.getByText(/tried automatically the moment it arrives/)).toBeTruthy();
  });

  it('a wrong passphrase is called out and the box stays usable', () => {
    Object.assign(loginState, { frameStatus: 'received', loginStatus: 'wrong' });
    render(<SettingsPanel {...{ ...baseProps(), status: 'connected' }} />);
    expect(screen.getByText(/does not match the print server/)).toBeTruthy();
    expect(screen.getByLabelText('Display login').disabled).toBe(false);
  });

  it('a logged-in screen shows its kid and offers Log out behind a confirm', () => {
    Object.assign(loginState, { frameStatus: 'received', loginStatus: 'logged-in', kid: '2c366156' });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<SettingsPanel {...{ ...baseProps(), status: 'connected' }} />);
    expect(screen.getByText('logged in · key 2c366156')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(loginState.logout).toHaveBeenCalled();
  });

  it('without secure crypto nothing pretends a pasted key would help', () => {
    vi.stubGlobal('crypto', {});
    const { container } = render(<SettingsPanel {...{ ...baseProps(), status: 'connected' }} />);
    expect(screen.getAllByText(/not in a secure context/).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Paste key' })).toBeNull();
    expect(screen.getByLabelText('Display login').disabled).toBe(true);
    expect(container.querySelector('details.advanced-fields').open).toBe(true);
    vi.unstubAllGlobals();
  });
});

describe('Background tab', () => {
  it('lists Typed slides first and defaults to it', () => {
    render(<SettingsPanel {...baseProps()} />);
    tab('Background');
    const radios = screen.getAllByRole('radio', { name: /slides|PowerPoint|video/ });
    expect(radios[0]).toBe(screen.getByLabelText('Typed slides'));
    expect(screen.getByLabelText('Typed slides').checked).toBe(true);
  });

  it('a published deck on a non-Typed screen shows the notice; Use Typed slides fixes it on Save', () => {
    const props = baseProps();
    props.config = { ...defaults, audioMuted: true, backgroundSource: 'powerpoint' };
    props.syncedDeck = { deckRev: 3, publishedAt: Date.now(), slides: [{ id: 's1', text: 'Hi', eyebrow: '', theme: 'auto', durationSec: 0, textSize: 'auto' }] };
    render(<SettingsPanel {...props} />);
    tab('Background');
    expect(screen.getByText(/but this screen is set to Looping PowerPoint/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Use Typed slides' }));
    expect(screen.getByLabelText('Typed slides').checked).toBe(true);
    expect(screen.queryByText(/but this screen is set to/)).toBeNull();
    clickSave();
    expect(props.onChange.mock.calls[0][0]).toEqual({ backgroundSource: 'manual' });
  });

  it('the OneDrive URL and auto-advance fields follow the source; the dead start-time field is gone', () => {
    render(<SettingsPanel {...baseProps()} />);
    tab('Background');
    expect(screen.queryByLabelText(/Club start time/)).toBeNull();
    // Typed slides: no OneDrive URL.
    expect(screen.queryByLabelText(/OneDrive PowerPoint embed URL/)).toBeNull();
    expect(screen.getByLabelText('Slide auto-advance (seconds)')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Looping PowerPoint'));
    expect(screen.getByLabelText('OneDrive PowerPoint embed URL')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Uploaded PowerPoint'));
    expect(screen.getByLabelText('OneDrive PowerPoint embed URL (fallback if the uploaded deck cannot render)')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Looping video'));
    expect(screen.queryByLabelText(/OneDrive/)).toBeNull();
    expect(screen.queryByLabelText('Slide auto-advance (seconds)')).toBeNull();
  });

  it('Edit slides… is reachable from every source', () => {
    render(<SettingsPanel {...baseProps()} />);
    tab('Background');
    fireEvent.click(screen.getByLabelText('Looping video'));
    expect(screen.getByRole('button', { name: /Edit slides/ })).toBeTruthy();
    expect(screen.getByText('Follow published slides')).toBeTruthy();
  });

  it('Remove video asks first', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const props = baseProps();
    props.config = { ...defaults, audioMuted: true, backgroundSource: 'video' };
    render(<SettingsPanel {...props} />);
    tab('Background');
    const remove = await screen.findByRole('button', { name: 'Remove video' });
    fireEvent.click(remove);
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('clip.mp4'));
    expect(video.deleteVideo).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.click(remove);
    await waitFor(() => expect(video.deleteVideo).toHaveBeenCalled());
  });

  it('slide-sync hints lead with logging in', () => {
    render(<SettingsPanel {...baseProps()} />);
    tab('Background');
    expect(screen.getByText(/type the church’s display passphrase under Connection → Display login/)).toBeTruthy();
  });
});

describe('Banners & celebrations and Display tabs', () => {
  it('celebration controls live on Banners & celebrations, not Display', () => {
    render(<SettingsPanel {...baseProps()} />);
    tab('Banners & celebrations');
    expect(screen.getByLabelText('Confetti intensity')).toBeTruthy();
    expect(screen.getByLabelText('Milestone celebration (every N check-ins)')).toBeTruthy();
    expect(screen.getByLabelText('Rush-mode minimum banner time (ms)')).toBeTruthy();
    tab('Display');
    expect(screen.queryByLabelText('Confetti intensity')).toBeNull();
    expect(screen.getByLabelText("Who's still here board")).toBeTruthy();
  });

  it('the milestone hint stops advertising a toast when milestones are off', () => {
    render(<SettingsPanel {...baseProps()} />);
    tab('Banners & celebrations');
    expect(screen.getByText(/Every 25 check-ins/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Milestone celebration (every N check-ins)'), { target: { value: '0' } });
    expect(screen.getByText(/Milestone celebrations are off/)).toBeTruthy();
  });

  it('club phrases save through the same sanitizer as an import', () => {
    const props = baseProps();
    render(<SettingsPanel {...props} />);
    tab('Banners & celebrations');
    const club = getAllClubs()[0];
    fireEvent.change(screen.getByLabelText(`${club} phrase`), { target: { value: '  Bring it!  ' } });
    clickSave();
    const patch = props.onChange.mock.calls[0][0];
    expect(Object.keys(patch)).toEqual(['clubPhrases']);
    expect(patch.clubPhrases[club.toLowerCase()]).toBe('  Bring it!  '); // trimmed by sanitizeClubPhrases in useConfig
  });

  it('the reduce-motion toggle round-trips and never touches the default', () => {
    const props = baseProps();
    render(<SettingsPanel {...props} />);
    tab('Display');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Reduce motion on this screen' }));
    clickSave();
    expect(props.onChange.mock.calls[0][0]).toEqual({ reduceMotion: true });
    expect(defaults.reduceMotion).toBe(false);
    expect(defaults.confettiLevel).toBe('full');
  });

  it('toggle titles are clickable labels with an accessible name', () => {
    render(<SettingsPanel {...baseProps()} />);
    tab('Banners & celebrations');
    const box = screen.getByRole('checkbox', { name: 'Sound on' });
    expect(box.checked).toBe(false);
    fireEvent.click(screen.getByText('Sound on'));
    expect(box.checked).toBe(true);
  });
});

describe('footer actions', () => {
  it('Import is a real button that refuses a file with no display settings', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const props = baseProps();
    render(<SettingsPanel {...props} />);
    expect(screen.getByRole('button', { name: 'Import' })).toBeTruthy();
    const input = screen.getByTestId('import-settings-file');
    const file = new File(['[{"text":"a slide"}]'], 'awana-slides.json', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(alert).toHaveBeenCalledWith(expect.stringMatching(/no display settings/)));
    expect(props.onChange).not.toHaveBeenCalled();
  });

  it('Import merges the recognised keys and reports the real count', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const props = baseProps();
    render(<SettingsPanel {...props} />);
    const file = new File(['{"nightTheme":"christmas","bogus":1}'], 'settings.json', { type: 'application/json' });
    fireEvent.change(screen.getByTestId('import-settings-file'), { target: { files: [file] } });
    await waitFor(() => expect(props.onChange).toHaveBeenCalledWith({ nightTheme: 'christmas' }));
    expect(window.alert).toHaveBeenCalledWith(expect.stringMatching(/^Imported 1 setting\./));
    expect(props.onReset).not.toHaveBeenCalled();
  });

  it('Export writes what differs from the baked defaults, even on a centrally configured screen', async () => {
    saveDisplayKey(FAKE_KEY);
    let captured = null;
    URL.createObjectURL = vi.fn((blob) => { captured = blob; return 'blob:x'; });
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const props = baseProps();
    props.savedConfig = { ...defaults, audioMuted: true, nightTheme: 'christmas', weatherLat: 10 };
    props.config = { ...props.savedConfig, pusherAppKey: 'from-url-flag' };
    render(<SettingsPanel {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    const text = await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.readAsText(captured);
    });
    const json = JSON.parse(text);
    expect(json).toEqual({ nightTheme: 'christmas', weatherLat: 10 });
    expect(text).not.toContain(FAKE_KEY);
    expect(text).not.toContain('from-url-flag');
  });

  it('demo mode is disclosed with a reload exit', () => {
    render(<SettingsPanel {...{ ...baseProps(), demoActive: true }} />);
    expect(screen.getByText(/Demo mode — a sample or simulated check-in/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reload display' })).toBeTruthy();
  });
});
