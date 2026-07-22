import { test } from 'vitest';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(import.meta.dirname, '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

test('manifest keeps the extension permission surface narrow', () => {
  const manifest = JSON.parse(readProjectFile('manifest.json'));

  assert.deepStrictEqual(manifest.permissions, [
    'sidePanel',
    'bookmarks',
    'storage',
    'favicon'
  ]);
  assert.strictEqual(Object.hasOwn(manifest, 'host_permissions'), false);
  assert.strictEqual(Object.hasOwn(manifest, 'optional_host_permissions'), false);
  assert.strictEqual(manifest.background.service_worker, 'src/background.ts');
  assert.strictEqual(manifest.side_panel.default_path, 'src/sidepanel.html');
  assert.strictEqual(manifest.default_locale, 'en');
  assert.strictEqual(manifest.name, '__MSG_manifest_name__');
  assert.strictEqual(manifest.description, '__MSG_manifest_description__');
});

test('Chrome locale catalogs are validated as part of the standard check', () => {
  const packageJson = JSON.parse(readProjectFile('package.json'));

  assert.match(packageJson.scripts.check, /check:i18n/);
  for (const locale of ['en', 'es', 'de', 'fr', 'zh_CN', 'zh_TW', 'ja', 'ko', 'tr', 'vi']) {
    assert.ok(fs.existsSync(path.join(rootDir, 'public', '_locales', locale, 'messages.json')));
  }
});

test('side panel html is the React module entry', () => {
  const html = readProjectFile('src/sidepanel.html');

  // The panel is now a React app: a single root element plus the module entry.
  // (View markup lives in components; covered by their own tests.)
  assert.match(html, /<div id="root"><\/div>/);
  assert.match(html, /<script type="module" src="\.\/main\.tsx"><\/script>/);
});

test('the build is driven by Vite + @crxjs, emitting into build/', () => {
  const viteConfig = readProjectFile('vite.config.ts');
  const packageJson = JSON.parse(readProjectFile('package.json'));

  assert.match(viteConfig, /crx\(\{\s*manifest\s*\}\)/);
  assert.match(viteConfig, /outDir:\s*'build'/);
  assert.match(packageJson.scripts.build, /vite build/);
});

test('release package zips the build/ output for the Web Store', () => {
  const packageJson = JSON.parse(readProjectFile('package.json'));
  const script = readProjectFile('scripts/package-extension.ts');
  const gitignore = readProjectFile('.gitignore');

  // package runs the checks + tests + build, then zips build/.
  assert.match(packageJson.scripts.package, /npm run build/);
  assert.match(packageJson.scripts.package, /scripts\/package-extension\.ts/);
  assert.match(script, /zip/);
  assert.match(script, /widemark-v\$\{version\}\.zip/);
  assert.match(script, /buildDir/);
  assert.match(gitignore, /^dist\/$/m);
  assert.match(gitignore, /^build\/$/m);
});

test('side panel css is split into focused local style modules', () => {
  const css = readProjectFile('src/sidepanel.css');
  const modules = [
    'src/styles/theme.css',
    'src/styles/layout.css',
    'src/styles/bookmarks.css',
    'src/styles/menus-modals.css',
    'src/styles/settings-help.css',
    'src/styles/actions.css'
  ];

  modules.forEach(modulePath => {
    assert.match(css, new RegExp(modulePath.replace(/^src\//, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.ok(fs.existsSync(path.join(rootDir, modulePath)), `${modulePath} should exist`);
  });
});
