import { defineConfig } from 'vitest/config';
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
  // The default public/ dir holds the favicon plus the PowerPoint add-in
  // under public/powerpoint-addon/, matching the /powerpoint-addon/…
  // URLs in the add-in manifest.
  test: {
    environment: 'jsdom',
  },
});
