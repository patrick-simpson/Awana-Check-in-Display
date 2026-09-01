import { useEffect, useRef, useState } from 'react';
import CatalogScene from './CatalogScene.jsx';
import {
  MAX_EYEBROW,
  MAX_SLIDES,
  MAX_TEXT,
  VIDEO_SIZE_WARN_BYTES,
  isVideoSlide,
  makeSlide,
  makeSlideId,
  makeVideoSlide,
  resolveSizeClass,
  resolveTheme,
  sanitizeSlides,
} from '../lib/slides.js';
import { collectGarbage, getVideo, makeVideoId, putVideo } from '../lib/videoStore.js';
import { publishDeck } from '../lib/publishDeck.js';
import { loadPublishToken } from '../lib/publishToken.js';

const THEME_OPTIONS = [
  { value: 'auto', label: 'Auto (rotate)' },
  { value: 'sky', label: 'Sky & orange wave' },
  { value: 'sunset', label: 'Sunset cream' },
  { value: 'night', label: 'Night blue' },
  { value: 'meadow', label: 'Meadow green' },
  { value: 'lavender', label: 'Lavender (catalog cover)' },
];

const SIZE_OPTIONS = [
  { value: 'auto', label: 'Auto (fit to length)' },
  { value: 'xl', label: 'Extra large' },
  { value: 'lg', label: 'Large' },
  { value: 'md', label: 'Medium' },
];

/**
 * The typed-slides editor: free-type the text for each background
 * slide, no PowerPoint needed. Slides live in the same saved settings
 * as everything else, so Save here persists them on this device.
 *
 * Video slides: the file is stored in this browser's local storage
 * (IndexedDB) and NEVER uploaded — a deck exported as JSON carries
 * only the video's name, so other devices need the file re-added.
 */
export default function SlideEditorPanel({ config, syncedDeck, onChange, onClose }) {
  // When this screen follows a published deck, THAT deck is what's on the
  // wall, so it is what the editor opens — otherwise editing would silently
  // start from a stale local copy. Snapshotted at open: if a new publish
  // lands while this panel is up, the banner must keep describing the deck
  // the editor actually opened, not drift to a rev it doesn't contain.
  const [seededDeck] = useState(() => syncedDeck);
  const [slides, setSlides] = useState(() => sanitizeSlides(seededDeck ? seededDeck.slides : config.manualSlides));
  const [importError, setImportError] = useState('');
  const [videoError, setVideoError] = useState('');
  const [publishState, setPublishState] = useState({ phase: 'idle', message: '' });
  const fileRef = useRef(null);
  const videoFileRef = useRef(null);

  const patch = (id, changes) => {
    setSlides((prev) => prev.map((s) => (s.id === id ? { ...s, ...changes } : s)));
  };

  const move = (from, to) => {
    setSlides((prev) => {
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [slide] = next.splice(from, 1);
      next.splice(to, 0, slide);
      return next;
    });
  };

  const duplicate = (index) => {
    setSlides((prev) => {
      if (prev.length >= MAX_SLIDES) return prev;
      const next = [...prev];
      // A duplicated video slide shares the same stored file on
      // purpose — garbage collection counts references per deck.
      next.splice(index + 1, 0, { ...prev[index], id: makeSlideId() });
      return next;
    });
  };

  const remove = (id) => setSlides((prev) => prev.filter((s) => s.id !== id));

  const addSlide = () => {
    setSlides((prev) => (prev.length >= MAX_SLIDES ? prev : [...prev, makeSlide()]));
  };

  const onVideoPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file || slides.length >= MAX_SLIDES) return;
    if (
      file.size > VIDEO_SIZE_WARN_BYTES &&
      !window.confirm(`${Math.round(file.size / 1e6)} MB is a large file — it may be slow to store and play on the signage machine. Add it anyway?`)
    ) return;
    const videoId = makeVideoId();
    try {
      await putVideo(videoId, file);
      setSlides((prev) => [...prev, makeVideoSlide({ videoId, videoName: file.name, videoSize: file.size })]);
      setVideoError('');
    } catch {
      setVideoError("Couldn't store that video on this device — browser storage may be blocked (private window) or full.");
    }
  };

  // Blobs are only garbage-collected when the editor closes, against
  // whichever deck is actually persisted at that moment: Save reaps
  // videos removed this session; Cancel reaps this session's abandoned
  // additions while keeping everything the saved deck still uses.
  const gcAgainst = (deck) => {
    collectGarbage(sanitizeSlides(deck).filter(isVideoSlide).map((s) => s.videoId));
  };

  const save = () => {
    const next = sanitizeSlides(slides);
    // In follow mode the editor opened the PUBLISHED deck, so Save would
    // replace whatever deck this device saved locally — including video
    // slides whose bytes exist only here and are garbage-collected the
    // moment no saved deck references them. That must never be a silent
    // side effect of tweaking a synced slide's wording.
    if (seededDeck) {
      const local = sanitizeSlides(config.manualSlides);
      const localVideos = local.filter(isVideoSlide).length;
      if (local.length > 0 && JSON.stringify(local) !== JSON.stringify(next) && !window.confirm(
        `Replace the deck saved on THIS device (${local.length} slide${local.length === 1 ? '' : 's'}`
        + (localVideos ? `, including ${localVideos} video slide${localVideos === 1 ? '' : 's'} whose file${localVideos === 1 ? '' : 's'} will be DELETED from this device` : '')
        + ') with what is in the editor?\n\nThe editor opened the published deck, not this device\u2019s saved one.')) {
        return;
      }
    }
    onChange({ manualSlides: next });
    gcAgainst(next);
    onClose();
  };

  // Publish to every display, via the print server. Local save happens FIRST,
  // so a failed publish never loses an edit; the deck that goes out is
  // text-only (video bytes exist only in this browser's storage).
  const publishAll = async () => {
    const next = sanitizeSlides(slides);
    const videoCount = next.filter(isVideoSlide).length;
    const textCount = next.length - videoCount;
    if (textCount === 0 && !window.confirm(
      'Publish an EMPTY deck?\n\nEvery display drops its typed slides and shows the welcome placeholder until something new is published.')) return;
    if (videoCount > 0 && !window.confirm(
      `${videoCount} video slide${videoCount === 1 ? ' stays' : 's stay'} on THIS device — the published deck carries text slides only.\n\nPublish the ${textCount} text slide${textCount === 1 ? '' : 's'} to every display?`)) return;
    // Save-local-first applies only when the editor OPENED the local deck.
    // In follow mode it opened the published deck, and overwriting this
    // device's saved deck with it would destroy the local deck (and GC its
    // video files) as a side effect — the published deck needs no local
    // backup anyway, because this screen receives and caches its own
    // broadcast, and a failed publish keeps the editor open with the edits.
    if (!seededDeck) {
      onChange({ manualSlides: next });
      gcAgainst(next);
    }
    setPublishState({ phase: 'busy', message: 'Publishing…' });
    const result = await publishDeck(next, loadPublishToken());
    if (result.ok) {
      setPublishState({
        phase: 'ok',
        message: `Published rev ${result.deckRev} (${result.slideCount} slide${result.slideCount === 1 ? '' : 's'}). When this screen shows the new deck, the whole pipe is confirmed — every online display receives the same broadcast, and screens that are off catch up within ~5 minutes of coming back.`,
      });
    } else {
      const fallback = result.reason === 'auth' || result.reason === 'rejected'
        ? ' Fallback that always works: press Export, then paste the file into the print-server dashboard → Lobby Slides → Publish.'
        : '';
      setPublishState({ phase: 'err', message: `${result.message}${fallback}` });
    }
  };

  const cancel = () => {
    gcAgainst(config.manualSlides);
    onClose();
  };

  // Slides are saved per-device (browser storage), so export/import is
  // how a deck typed at home gets onto the signage machine.
  const exportSlides = () => {
    const blob = new Blob([JSON.stringify(sanitizeSlides(slides), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'awana-slides.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const importSlides = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-importing the same file
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = sanitizeSlides(JSON.parse(reader.result));
        if (imported.length === 0) {
          setImportError('That file has no usable slides in it.');
          return;
        }
        if (slides.length > 0 && !window.confirm(`Replace the ${slides.length} slide(s) here with the ${imported.length} from the file?`)) {
          return;
        }
        setSlides(imported);
        setImportError('');
      } catch {
        setImportError("Couldn't read that file — it isn't a slides JSON export.");
      }
    };
    reader.onerror = () => setImportError("Couldn't read that file.");
    reader.readAsText(file);
  };

  const blankCount = slides.filter((s) => !isVideoSlide(s) && s.text.trim() === '').length;

  return (
    <div className="panel-backdrop" onClick={cancel}>
      <div className="panel panel--slides" onClick={(e) => e.stopPropagation()}>
        <h2>Typed Slides</h2>
        <div className="hint" style={{ marginBottom: '1rem' }}>
          Free-type the background slides — no PowerPoint needed — and mix in local video
          files. Videos are stored on <strong>this device only</strong> and never uploaded.
          Pick <strong>Typed slides</strong> as the background source in Settings to put
          them on screen.
        </div>

        {seededDeck && (
          <div className="hint" style={{ marginBottom: '1rem' }}>
            <strong>This editor opened the published deck (rev {seededDeck.deckRev})</strong> — the one
            every display is following. <strong>Publish to all displays</strong> sends your changes
            everywhere; <strong>Save slides</strong> replaces the deck saved on this device only
            (hidden while this screen follows the published deck).
          </div>
        )}

        {slides.length === 0 && (
          <div className="slide-empty">
            No slides yet — press <strong>Add slide</strong> below and just start typing,
            or <strong>Add video</strong> to drop in a local video file.
          </div>
        )}

        {slides.map((slide, i) => (
          <div className="slide-card" key={slide.id}>
            <div className="slide-card-preview" aria-hidden>
              <div className="slide-card-frame">
                {isVideoSlide(slide) ? (
                  <VideoThumb videoId={slide.videoId} />
                ) : (
                  <CatalogScene theme={resolveTheme(slide, i)} still>
                    <div className="manual-slide-copy">
                      {slide.eyebrow ? <span className="manual-slide-eyebrow">{slide.eyebrow}</span> : null}
                      <p className={`manual-slide-text ${resolveSizeClass(slide)}`}>
                        {slide.text || 'Your text here…'}
                      </p>
                    </div>
                  </CatalogScene>
                )}
              </div>
            </div>

            <div className="slide-card-fields">
              {isVideoSlide(slide) ? (
                <>
                  <div className="slide-card-video-meta">
                    <strong>{slide.videoName || 'Video'}</strong>
                    {slide.videoSize > 0 && <span> · {(slide.videoSize / 1e6).toFixed(1)} MB</span>}
                  </div>
                  <div className="field">
                    <label htmlFor={`dur-${slide.id}`}>Seconds on screen</label>
                    <input
                      id={`dur-${slide.id}`}
                      type="number"
                      min="0"
                      max="600"
                      step="1"
                      value={slide.durationSec}
                      onChange={(e) => patch(slide.id, { durationSec: Number(e.target.value) })}
                    />
                    <span className="hint">0 = play the video to the end, then advance.</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="field">
                    <label htmlFor={`eyebrow-${slide.id}`}>Small top line (optional)</label>
                    <input
                      id={`eyebrow-${slide.id}`}
                      type="text"
                      maxLength={MAX_EYEBROW}
                      value={slide.eyebrow}
                      onChange={(e) => patch(slide.id, { eyebrow: e.target.value })}
                      placeholder="Awana Clubs"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`text-${slide.id}`}>Slide text</label>
                    <textarea
                      id={`text-${slide.id}`}
                      rows={3}
                      maxLength={MAX_TEXT}
                      value={slide.text}
                      onChange={(e) => patch(slide.id, { text: e.target.value })}
                      placeholder={'Welcome to\nAwana!'}
                    />
                  </div>
                  <div className="slide-card-row">
                    <div className="field">
                      <label htmlFor={`theme-${slide.id}`}>Look</label>
                      <select
                        id={`theme-${slide.id}`}
                        value={slide.theme}
                        onChange={(e) => patch(slide.id, { theme: e.target.value })}
                      >
                        {THEME_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor={`size-${slide.id}`}>Text size</label>
                      <select
                        id={`size-${slide.id}`}
                        value={slide.textSize || 'auto'}
                        onChange={(e) => patch(slide.id, { textSize: e.target.value })}
                      >
                        {SIZE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor={`dur-${slide.id}`}>Seconds on screen</label>
                      <input
                        id={`dur-${slide.id}`}
                        type="number"
                        min="0"
                        max="600"
                        step="1"
                        value={slide.durationSec}
                        onChange={(e) => patch(slide.id, { durationSec: Number(e.target.value) })}
                      />
                      <span className="hint">0 = use the global slide delay from Settings.</span>
                    </div>
                  </div>
                </>
              )}
              <div className="slide-card-controls">
                <button className="ghost" onClick={() => move(i, i - 1)} disabled={i === 0} title="Move up">↑</button>
                <button className="ghost" onClick={() => move(i, i + 1)} disabled={i === slides.length - 1} title="Move down">↓</button>
                <button className="ghost" onClick={() => duplicate(i)} disabled={slides.length >= MAX_SLIDES}>Duplicate</button>
                <button className="danger" onClick={() => remove(slide.id)}>Delete</button>
              </div>
            </div>
          </div>
        ))}

        {importError && <div className="slide-editor-error">{importError}</div>}
        {videoError && <div className="slide-editor-error">{videoError}</div>}
        {blankCount > 0 && (
          <div className="hint" style={{ marginBottom: '0.75rem' }}>
            {blankCount} empty slide{blankCount > 1 ? 's' : ''} will be skipped when you save — type something in first.
          </div>
        )}
        {slides.length === 0 && config.backgroundSource === 'manual' && (
          <div className="hint" style={{ marginBottom: '0.75rem' }}>
            With no slides saved, the screen shows the welcome placeholder instead.
          </div>
        )}
        {slides.some(isVideoSlide) && (
          <div className="hint" style={{ marginBottom: '0.75rem' }}>
            Export carries a video slide's <em>name</em> only — the file stays on this device.
            After importing a deck on another machine, delete its "missing" video slides and
            re-add the files there.
          </div>
        )}

        <div className="actions">
          <button className="primary" onClick={addSlide} disabled={slides.length >= MAX_SLIDES}>
            + Add slide
          </button>
          <button className="primary" onClick={() => videoFileRef.current?.click()} disabled={slides.length >= MAX_SLIDES}>
            + Add video
          </button>
          <input
            ref={videoFileRef}
            type="file"
            accept="video/mp4,video/webm,video/*"
            style={{ display: 'none' }}
            onChange={onVideoPick}
          />
          <button className="ghost" onClick={exportSlides} disabled={slides.length === 0}>Export</button>
          <button className="ghost" onClick={() => fileRef.current?.click()}>Import</button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={importSlides}
          />
          <button onClick={cancel}>Cancel</button>
          <button className="primary" onClick={save}>Save slides</button>
          <button
            className="primary"
            onClick={publishAll}
            disabled={publishState.phase === 'busy'}
            title="Send this deck to every display, via the print server"
          >
            {publishState.phase === 'busy' ? 'Publishing…' : 'Publish to all displays'}
          </button>
        </div>
        {publishState.phase !== 'idle' && publishState.phase !== 'busy' && (
          <div
            className={publishState.phase === 'err' ? 'slide-editor-error' : 'hint'}
            style={{ marginTop: '0.75rem' }}
            role="status"
          >
            {publishState.message}
          </div>
        )}
      </div>
    </div>
  );
}

// Small paused preview of a stored video; a film glyph with an amber
// badge when the file isn't in this browser's storage (e.g. the deck
// was imported from another device).
function VideoThumb({ videoId }) {
  const [src, setSrc] = useState(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let url = null;
    getVideo(videoId).then((blob) => {
      if (cancelled) return;
      if (!blob) {
        setMissing(true);
        return;
      }
      url = URL.createObjectURL(blob);
      setSrc(url);
    });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [videoId]);

  return (
    <div className="slide-card-video-thumb">
      {src ? (
        <video src={src} preload="metadata" muted />
      ) : (
        <span className="slide-card-video-glyph" aria-hidden>▶</span>
      )}
      {missing && <span className="slide-badge-missing">Video not on this device</span>}
    </div>
  );
}
