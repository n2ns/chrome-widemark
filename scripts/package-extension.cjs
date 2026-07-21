const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const version = packageJson.version;
const distDir = path.join(rootDir, 'dist');
const bundleDir = path.join(distDir, 'widemark');
const zipName = `widemark-v${version}.zip`;
const zipPath = path.join(distDir, zipName);

function copyRequired(relativePath) {
  const from = path.join(rootDir, relativePath);
  const to = path.join(bundleDir, relativePath);

  if (!fs.existsSync(from)) {
    throw new Error(`Required package input is missing: ${relativePath}`);
  }

  fs.cpSync(from, to, { recursive: true });
  console.log(`Packaged: ${relativePath}`);
}

function copyOptional(relativePath) {
  const from = path.join(rootDir, relativePath);
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
