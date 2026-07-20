const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');

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
  assert.strictEqual(manifest.background.service_worker, 'src/background.js');
  assert.strictEqual(manifest.side_panel.default_path, 'src/sidepanel.html');
});

test('side panel wires the actions page and split modules', () => {
  const html = readProjectFile('src/sidepanel.html');

  [
    'id="actions-toggle-btn"',
    'id="actions-view"',
    'id="help-toggle-btn"',
    'id="help-view"',
    'id="find-duplicates-btn"',
    'id="find-domain-duplicates-btn"',
    'id="duplicate-results"',
    'id="clean-empty-folders-btn"',
    'id="merge-folders-btn"',
    'id="cleanup-results"',
    'id="menu-sort"',
    'id="setting-show-other"',
    'id="setting-show-recent"',
    'cleanup-controller.js',
    'ui-icons.js',
    'bookmark-tree-controller.js',
    'duplicate-renderer.js',
    'duplicate-finder-controller.js',
    'modal-dialog.js',
    'context-menu-controller.js',
    'settings-controller.js',
    'sidepanel.js'
  ].forEach(fragment => {
    assert.match(html, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });

  [
    'scanner-toggle-btn',
    'scanner-view',
    'start-audit-btn',
    'audit-results',
    'audit-renderer.js'
  ].forEach(fragment => {
    assert.doesNotMatch(html, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });

  assert.ok(
    html.indexOf('ui-icons.js') < html.indexOf('sidepanel.js'),
    'icon module should load before the main side panel script'
  );
  assert.ok(
    html.indexOf('bookmark-utils.js') < html.indexOf('bookmark-tree-controller.js'),
    'bookmark utilities should load before the bookmark tree controller'
  );
  assert.ok(
    html.indexOf('ui-icons.js') < html.indexOf('bookmark-tree-controller.js'),
    'icon module should load before the bookmark tree controller'
  );
  assert.ok(
    html.indexOf('bookmark-tree-controller.js') < html.indexOf('sidepanel.js'),
    'bookmark tree controller should load before the main side panel script'
  );
  assert.ok(
    html.indexOf('duplicate-renderer.js') < html.indexOf('sidepanel.js'),
    'duplicate renderer should load before the main side panel script'
  );
  assert.ok(
    html.indexOf('duplicate-renderer.js') < html.indexOf('duplicate-finder-controller.js'),
    'duplicate renderer should load before the duplicate finder controller'
  );
  assert.ok(
    html.indexOf('duplicate-finder-controller.js') < html.indexOf('sidepanel.js'),
    'duplicate finder controller should load before the main side panel script'
  );
  assert.ok(
    html.indexOf('modal-dialog.js') < html.indexOf('sidepanel.js'),
    'modal dialog module should load before the main side panel script'
  );
  assert.ok(
    html.indexOf('context-menu-controller.js') < html.indexOf('sidepanel.js'),
    'context menu controller should load before the main side panel script'
  );
  assert.ok(
    html.indexOf('settings-controller.js') < html.indexOf('sidepanel.js'),
    'settings controller should load before the main side panel script'
  );
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

test('duplicate finder shows paths and confirms deletion', () => {
  const controller = readProjectFile('src/duplicate-finder-controller.js');
  const renderer = readProjectFile('src/duplicate-renderer.js');
  const sidepanel = readProjectFile('src/sidepanel.js');

  assert.match(controller, /folderPath/);
  assert.match(renderer, /duplicate-item-path/);
  assert.match(renderer, /showConfirmDialog/);
  assert.match(renderer, /showInfoDialog/);
  assert.match(renderer, /lastError/);
  assert.match(sidepanel, /modalDialog/);
});

test('help page has separate about card and branded footer links', () => {
  const html = readProjectFile('src/sidepanel.html');
  const settingsController = readProjectFile('src/settings-controller.js');

  assert.match(html, /help-about-card/);
  assert.match(html, /https:\/\/n2ns\.com/);
  assert.match(html, /https:\/\/datafrog\.io\/widemark/);
  assert.match(html, /Built by/);
  assert.match(html, />Docs</);
  assert.doesNotMatch(html, /class="footer-built"/);
  assert.match(html, /<h4>Basics<\/h4>/);
  assert.doesNotMatch(html, /footer-left-click-text/);
  assert.doesNotMatch(html, /footer-ctrl-click-text/);
  assert.doesNotMatch(html, /<h4>Open links<\/h4>/);
  assert.doesNotMatch(html, /<h4>Folder style<\/h4>/);
  assert.doesNotMatch(settingsController, /updateFooterInfo/);
});

test('release package command creates a minimal Web Store bundle', () => {
  const packageJson = JSON.parse(readProjectFile('package.json'));
  const script = readProjectFile('scripts/package-extension.js');
  const gitignore = readProjectFile('.gitignore');

  assert.match(packageJson.scripts.package, /scripts\/package-extension\.js/);
  assert.match(script, /copyRequired\('manifest\.json'\)/);
  assert.match(script, /copyRequired\('src'\)/);
  assert.match(script, /copyRequired\('icons'\)/);
  assert.match(script, /copyOptional\('_locales'\)/);
  assert.match(script, /widemark-v\$\{version\}\.zip/);
  assert.match(gitignore, /^dist\/$/m);
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
