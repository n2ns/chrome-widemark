import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(import.meta.dirname, '..');
const buildDir = path.join(rootDir, 'build');

// Static inputs that tsc does not emit. Copied verbatim so that `build/` is a
// self-contained, loadable unpacked extension mirroring the repo layout.
const staticInputs = [
  'manifest.json',
  'icons',
  'icon.png',
  'src/sidepanel.html',
  'src/sidepanel.css',
  'src/styles'
];

const optionalInputs = ['_locales'];

function copyInto(relativePath: string): void {
  const from = path.join(rootDir, relativePath);
  const to = path.join(buildDir, relativePath);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, { recursive: true });
  console.log(`Copied: ${relativePath}`);
}

fs.rmSync(buildDir, { recursive: true, force: true });
fs.mkdirSync(buildDir, { recursive: true });

for (const rel of staticInputs) {
  if (!fs.existsSync(path.join(rootDir, rel))) {
    throw new Error(`Required build input is missing: ${rel}`);
  }
  copyInto(rel);
}

for (const rel of optionalInputs) {
  if (fs.existsSync(path.join(rootDir, rel))) copyInto(rel);
}

// Compile src/*.ts -> build/src/*.js (import specifiers rewritten to .js).
execFileSync('npx', ['tsc', '-p', 'tsconfig.json'], { cwd: rootDir, stdio: 'inherit' });

console.log('Built extension into build/');
