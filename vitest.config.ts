import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Vitest is the single test runner: co-located component/store tests under
// src/ (happy-dom) plus the pure-logic and repo tests under test/.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'test/**/*.test.ts'],
    setupFiles: ['./src/test-setup.ts'],
  },
});
