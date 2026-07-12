import { useRef, useState } from 'react';
import CatalogScene from './CatalogScene.jsx';
import {
  MAX_EYEBROW,
  MAX_SLIDES,
  MAX_TEXT,
  makeSlide,
  makeSlideId,
  resolveTheme,
  sanitizeSlides,
  slideSizeClass,
} from '../lib/slides.js';

const THEME_OPTIONS = [
  { value: 'auto', label: 'Auto (rotate)' },
  { value: 'sky', label: 'Sky & orange wave' },
  { value: 'sunset', label: 'Sunset cream' },
  { value: 'night', label: 'Night blue' },
  { value: 'meadow', label: 'Meadow green' },
];

/**
 * The typed-slides editor: free-type the text for each background
 * slide, no PowerPoint needed. Slides live in the same saved settings
 * as everything else, so Save here persists them on this device.
 */
export default function SlideEditorPanel({ config, onChange, onClose }) {
  const [slides, setSlides] = useState(() => sanitizeSlides(config.manualSlides));
  const [importError, setImportError] = useState('');
  const fileRef = useRef(null);

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
      next.splice(index + 1, 0, { ...prev[index], id: makeSlideId() });
      return next;
    });
  };

  const remove = (id) => setSlides((prev) => prev.filter((s) => s.id !== id));

  const addSlide = () => {
    setSlides((prev) => (prev.length >= MAX_SLIDES ? prev : [...prev, makeSlide()]));
  };

  const save = () => {
    onChange({ manualSlides: sanitizeSlides(slides) });
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

  const blankCount = slides.filter((s) => s.text.trim() === '').length;

  return (
    <div className="panel-backdrop" onClick={onClose}>
      <div className="panel panel--slides" onClick={(e) => e.stopPropagation()}>
        <h2>Typed Slides</h2>
        <div className="hint" style={{ marginBottom: '1rem' }}>
          Free-type the background slides — no PowerPoint needed. Each slide gets the joyful
          catalog look automatically. Pick <strong>Typed slides</strong> as the background source
          in Settings to put them on screen.
        </div>

        {slides.length === 0 && (
          <div className="slide-empty">
            No slides yet — press <strong>Add slide</strong> below and just start typing.
          </div>
        )}

        {slides.map((slide, i) => (
          <div className="slide-card" key={slide.id}>
            <div className="slide-card-preview" aria-hidden>
              <div className="slide-card-frame">
                <CatalogScene theme={resolveTheme(slide, i)}>
                  <div className="manual-slide-copy">
                    {slide.eyebrow ? <span className="manual-slide-eyebrow">{slide.eyebrow}</span> : null}
                    <p className={`manual-slide-text ${slideSizeClass(slide.text)}`}>
                      {slide.text || 'Your text here…'}
                    </p>
                  </div>
                </CatalogScene>
              </div>
            </div>

            <div className="slide-card-fields">
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

        <div className="actions">
          <button className="primary" onClick={addSlide} disabled={slides.length >= MAX_SLIDES}>
            + Add slide
          </button>
          <button className="ghost" onClick={exportSlides} disabled={slides.length === 0}>Export</button>
          <button className="ghost" onClick={() => fileRef.current?.click()}>Import</button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={importSlides}
          />
          <button onClick={onClose}>Cancel</button>
          <button className="primary" onClick={save}>Save slides</button>
        </div>
      </div>
    </div>
  );
}
