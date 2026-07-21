import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';

// @crxjs reads manifest.json, builds the side panel HTML entry and the
// background service worker, and rewrites their paths in the emitted manifest.
export default defineConfig({
  plugins: [react(), crx({ manifest })],
  build: {
    outDir: 'build',
    // No source maps in the shipped bundle (keeps the zip lean); `vite dev`
    // still provides maps for local debugging.
    sourcemap: false,
  },
});
