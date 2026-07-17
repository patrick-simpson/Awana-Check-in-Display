// ─────────────────────────────────────────────────────────────
// Local .pptx storage (cloned from videoStore.js). The deck bytes
// live in IndexedDB on THIS device only — never uploaded anywhere.
// Upload is the PRIMARY input path for the local slideshow because
// OneDrive download URLs usually lack CORS headers in a browser.
//
// Every read path degrades gracefully: getDeck() never rejects — a
// missing blob, cleared site data, or blocked IndexedDB all come
// back as null and the caller falls back to the iframe embed.
// ─────────────────────────────────────────────────────────────

const DB_NAME = 'awanaPptx';
const DB_VERSION = 1;
const STORE = 'decks';
const KEY = 'current';

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    let req;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (err) {
      // Firefox private mode throws synchronously.
      reject(err);
      return;
    }
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
  });
  // Let a later call retry instead of caching the failure forever.
  dbPromise.catch(() => { dbPromise = null; });
  return dbPromise;
}

function withStore(mode, fn) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  }));
}

/** Save the uploaded deck. Resolves true on success, false on failure. */
export function putDeck(blob, name = '') {
  return withStore('readwrite', (store) => store.put({ blob, name, savedAt: Date.now() }, KEY))
    .then(() => true)
    .catch(() => false);
}

/** The stored deck ({ blob, name, savedAt }) or null — never rejects. */
export function getDeck() {
  return withStore('readonly', (store) => store.get(KEY))
    .then((v) => (v && v.blob instanceof Blob ? v : null))
    .catch(() => null);
}

/** Remove the stored deck. Never rejects. */
export function deleteDeck() {
  return withStore('readwrite', (store) => store.delete(KEY))
    .then(() => true)
    .catch(() => false);
}
