import React from 'react';
import ReactDOM from 'react-dom/client';
// Bundled variable fonts (no CDN) so the display looks right even on a
// church network that blocks or throttles font hosts.
import '@fontsource-variable/baloo-2';
import '@fontsource-variable/nunito';
import '@fontsource-variable/oswald';
import App from './App.jsx';
import './styles/app.css';

// Jelly UI web components (<jelly-theme>, <jelly-button>, …), vendored
// locally in public/vendor/ so the always-on display never depends on
// jelly-ui.com being up (see public/vendor/README.md). It's an ES module
// served straight from public/ — resolved against the page URL (works
// under any deploy base) and deliberately NOT bundled (@vite-ignore).
// Custom elements upgrade in place whenever the module lands, so the
// render below never waits on it.
import(/* @vite-ignore */ new URL('vendor/jelly-ui.js', document.baseURI).href);

// Offline shell: cache-first for hashed assets and shared/ club art,
// network-first for HTML/JSON (see src/sw.js — emitted with a per-build
// cache version). Production only; failures are the pre-SW status quo.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

// <jelly-theme> scopes the Jelly UI design tokens to the app (mode="auto"
// follows the OS light/dark preference). It renders display:contents —
// layout-neutral, paints nothing — so the signage stage is unaffected.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <jelly-theme mode="auto">
      <App />
    </jelly-theme>
  </React.StrictMode>,
);
