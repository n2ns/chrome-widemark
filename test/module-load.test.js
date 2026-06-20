const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const rootDir = path.resolve(__dirname, '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

test('browser modules load in sidepanel order without missing globals', () => {
  const html = readProjectFile('src/sidepanel.html');
  const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(match => match[1]);
  const moduleScripts = scripts.filter(script => script !== 'sidepanel.js');
  const context = {
    console,
    URL,
    globalThis: {}
  };
  context.globalThis = context;
  vm.createContext(context);

  moduleScripts.forEach(script => {
    const scriptPath = path.join('src', script);
    vm.runInContext(readProjectFile(scriptPath), context, { filename: scriptPath });
  });

  [
    'BookmarkSidebarUtils',
    'WideMarkIcons',
    'WideMarkBookmarkTree',
    'BookmarkDuplicateRenderer',
    'WideMarkDuplicateFinder',
    'WideMarkModalDialog',
    'WideMarkContextMenu',
    'WideMarkSettings'
  ].forEach(globalName => {
    assert.ok(context[globalName], `${globalName} should be attached`);
  });

  assert.strictEqual(
    typeof context.WideMarkDuplicateFinder.createDuplicateFinderController,
    'function'
  );
});
