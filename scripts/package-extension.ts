import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(import.meta.dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const sourceManifest = JSON.parse(fs.readFileSync(path.join(rootDir, 'manifest.json'), 'utf8'));
const version: string = packageJson.version;
const buildDir = path.join(rootDir, 'build');
const distDir = path.join(rootDir, 'dist');
const zipPath = path.join(distDir, `widemark-v${version}.zip`);

// build/ is the Vite + @crxjs output — a loadable, self-contained unpacked
// extension. Zip it verbatim for the Chrome Web Store.
if (!fs.existsSync(path.join(buildDir, 'manifest.json'))) {
  throw new Error('build/ is missing; run `npm run build` first.');
}

const builtManifest = JSON.parse(fs.readFileSync(path.join(buildDir, 'manifest.json'), 'utf8'));
if (sourceManifest.version !== version || builtManifest.version !== version) {
  throw new Error(`Version mismatch: package=${version}, source manifest=${sourceManifest.version}, built manifest=${builtManifest.version}`);
}

const releaseTag = process.env.GITHUB_REF_TYPE === 'tag' ? process.env.GITHUB_REF_NAME : undefined;
if (releaseTag && releaseTag !== `v${version}`) {
  throw new Error(`Release tag ${releaseTag} does not match package version v${version}.`);
}

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

execFileSync('zip', ['-rq', zipPath, '.'], { cwd: buildDir, stdio: 'inherit' });

console.log(`Created: ${path.relative(rootDir, zipPath)}`);
