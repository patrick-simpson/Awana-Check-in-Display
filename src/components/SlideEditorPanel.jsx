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

const THEME_OPTIONS = [
  { value: 'auto', label: 'Auto (rotate)' },
  { value: 'sky', label: 'Sky & orange wave' },
  { value: 'sunset', label: 'Sunset cream' },
  { value: 'night', label: 'Night blue' },
  { value: 'meadow', label: 'Meadow green' },
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
export default function SlideEditorPanel({ config, onChange, onClose }) {
  const [slides, setSlides] = useState(() => sanitizeSlides(config.manualSlides));
  const [importError, setImportError] = useState('');
  const [videoError, setVideoError] = useState('');
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
    onChange({ manualSlides: next });
    gcAgainst(next);
    onClose();
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
                  <CatalogScene theme={resolveTheme(slide, i)}>
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
                      placeholder={'Welcome to\nClub Night!'}
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
        </div>
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
