import * as matchers from '@testing-library/jest-dom/matchers';
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';
import { expect } from 'vitest';

// jest-dom's `vitest` entry augments `Assertion<T>`, which conflicts with
// Vitest 5's `Assertion<R, T>`; register the matchers and augment `Matchers` instead.
expect.extend(matchers);

declare module 'vitest' {
  interface Matchers<R extends void | Promise<void> = void | Promise<void>, T = unknown>
    extends TestingLibraryMatchers<any, R> {}
  interface AsymmetricMatchersContaining extends TestingLibraryMatchers<any, any> {}
}
