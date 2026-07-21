import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(import.meta.dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const version: string = packageJson.version;
// Package inputs come from the compiled build/ tree (see build-extension.ts),
// not the repo source, so the zip ships transpiled JS plus static assets.
const buildDir = path.join(rootDir, 'build');
const distDir = path.join(rootDir, 'dist');
const bundleDir = path.join(distDir, 'widemark');
const zipName = `widemark-v${version}.zip`;
const zipPath = path.join(distDir, zipName);

function copyRequired(relativePath: string): void {
  const from = path.join(buildDir, relativePath);
  const to = path.join(bundleDir, relativePath);

  if (!fs.existsSync(from)) {
    throw new Error(`Required package input is missing from build/: ${relativePath}. Run \`npm run compile\` first.`);
  }

  fs.cpSync(from, to, { recursive: true });
  console.log(`Packaged: ${relativePath}`);
}

function copyOptional(relativePath: string): void {
  const from = path.join(buildDir, relativePath);
  if (!fs.existsSync(from)) return;

  const to = path.join(bundleDir, relativePath);
  fs.cpSync(from, to, { recursive: true });
  console.log(`Packaged: ${relativePath}`);
}

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(bundleDir, { recursive: true });

copyRequired('manifest.json');
copyRequired('src');
copyRequired('icons');
copyRequired('icon.png');
copyOptional('_locales');

execFileSync('zip', ['-rq', zipPath, '.'], {
  cwd: bundleDir,
  stdio: 'inherit'
});

console.log(`Created: ${path.relative(rootDir, zipPath)}`);
