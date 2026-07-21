import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Vitest runs the React/store tests (happy-dom). The framework-agnostic
// pure-logic tests keep running under `node --test` (test/*.test.mjs); this
// config deliberately only picks up co-located src/**/*.test.ts(x).
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['./src/test-setup.ts'],
  },
});
