import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The GitHub Actions workflow sets VITE_BASE_PATH to "/<repo-name>/"
// so assets load from the correct path on GitHub Pages.
// For local dev this is undefined and Vite falls back to "/".
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || '/',
  server: {
    host: true,
    port: 5173,
  },
});
