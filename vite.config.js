import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative asset paths so the build works at any URL — local preview,
// GitHub Pages under /<repo>/, a custom domain, anywhere — with zero
// env-var configuration. Crucial for novice deploys.
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    host: true,
    port: 3000,
  },
  // Serve powerpoint-addon files as static assets
  publicDir: 'powerpoint-addon',
});
