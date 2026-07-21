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
});

test('side panel html is the React module entry', () => {
  const html = readProjectFile('src/sidepanel.html');

  // The panel is now a React app: a single root element plus the module entry.
  // (View markup lives in components; covered by their own tests.)
  assert.match(html, /<div id="root"><\/div>/);
  assert.match(html, /<script type="module" src="\.\/main\.tsx"><\/script>/);
});

test('build sync includes current files and removes stale output', () => {
  const packageJson = JSON.parse(readProjectFile('package.json'));
  const movedScript = readProjectFile('scripts/sync-to-windows.sh');

  assert.match(packageJson.scripts.build, /npm run package/);
  assert.match(packageJson.scripts.build, /scripts\/sync-to-windows\.sh/);
  assert.strictEqual(fs.existsSync(path.join(rootDir, 'sync-to-windows.sh')), false);
  assert.match(movedScript, /PACKAGE_DIR="\$ROOT_DIR\/dist\/widemark"/);
  assert.match(movedScript, /widemark-v\*\.zip/);
  assert.match(movedScript, /find "\$TARGET_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf/);
  assert.match(movedScript, /cp -r "\$PACKAGE_DIR"\/\./);
  assert.match(movedScript, /cp "\$PACKAGE_ZIP" "\$TARGET_PARENT\/"/);
  assert.doesNotMatch(movedScript, /audit-renderer\.js/);
});


test('release package command creates a minimal Web Store bundle', () => {
  const packageJson = JSON.parse(readProjectFile('package.json'));
  const script = readProjectFile('scripts/package-extension.ts');
  const gitignore = readProjectFile('.gitignore');

  assert.match(packageJson.scripts.package, /scripts\/package-extension\.ts/);
  assert.match(script, /copyRequired\('manifest\.json'\)/);
  assert.match(script, /copyRequired\('src'\)/);
  assert.match(script, /copyRequired\('icons'\)/);
  assert.match(script, /copyOptional\('_locales'\)/);
  assert.match(script, /widemark-v\$\{version\}\.zip/);
  assert.match(gitignore, /^dist\/$/m);
});

test('build assembles the manifest-referenced files into build/', () => {
  const manifest = JSON.parse(readProjectFile('manifest.json'));
  const buildScript = readProjectFile('scripts/build-extension.ts');
  const tsconfig = JSON.parse(readProjectFile('tsconfig.json'));

  // tsc compiles src/*.ts into build/src/*.js, covering the service worker and
  // the panel scripts referenced by the manifest / html.
  assert.strictEqual(tsconfig.compilerOptions.rootDir, 'src');
  assert.strictEqual(tsconfig.compilerOptions.outDir, 'build/src');
  assert.match(manifest.background.service_worker, /^src\//);
  assert.match(manifest.side_panel.default_path, /^src\//);

  // Static assets tsc does not emit must be copied verbatim, or the packaged
  // extension fails to load. Guards against the copy list silently shrinking.
  [
    'manifest.json',
    'icons',
    'icon.png',
    'src/sidepanel.html',
    'src/sidepanel.css',
    'src/styles'
  ].forEach(input => {
    assert.match(buildScript, new RegExp(`'${input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`));
  });
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
