import React from 'react';
import ReactDOM from 'react-dom/client';
// Bundled variable fonts (no CDN) so the display looks right even on a
// church network that blocks or throttles font hosts.
import '@fontsource-variable/baloo-2';
import '@fontsource-variable/nunito';
import App from './App.jsx';
import './styles/app.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
