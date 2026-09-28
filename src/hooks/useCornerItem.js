import { useCallback, useEffect, useRef, useState } from 'react';
import { cornerIds, nextCornerId, snapshotCorner } from '../lib/cornerInfo.js';

/**
 * The corner's one item and its frozen value (src/lib/cornerInfo.js).
 *
 * `advance()` is a slide load: it moves to the next item and snapshots it.
 * App calls it from the typed slideshow's onSlide. A background with no
 * slides we can see (a PowerPoint embed, a video, a lone slide) passes
 * `fallbackMs`, and a timer stands in for the slide loads it cannot report.
 *
 * @param {import('../lib/cornerInfo.js').CornerSource} source  read at each load
 * @param {{ fallbackMs?: number | null }} [opts]
 */
export function useCornerItem(source, { fallbackMs = null } = {}) {
  const latest = useRef(source);
  useEffect(() => {
    latest.current = source;
  });

  const [item, setItem] = useState(/** @type {import('../lib/cornerInfo.js').CornerSnapshot | null} */ (null));
  const [loads, setLoads] = useState(0);

  const advance = useCallback(() => {
    const src = latest.current;
    const now = Date.now();
    setItem((prev) => {
      const id = nextCornerId(cornerIds(src), prev?.id ?? null);
      return id ? snapshotCorner(id, src, now) : null;
    });
    setLoads((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!fallbackMs) return undefined;
    // First load straight away, then one per stand-in "slide".
    const first = setTimeout(advance, 0);
    const every = setInterval(advance, fallbackMs);
    return () => {
      clearTimeout(first);
      clearInterval(every);
    };
  }, [fallbackMs, advance]);

  return { item, advance, loads };
}
