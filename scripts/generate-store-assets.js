const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, 'store-assets');

fs.mkdirSync(outDir, { recursive: true });

function esc(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function text(x, y, value, options = {}) {
  const {
    size = 18,
    weight = 500,
    fill = '#f5f0e8',
    anchor = 'start',
    opacity = 1
  } = options;
  return `<text x="${x}" y="${y}" font-family="Inter, Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" opacity="${opacity}">${esc(value)}</text>`;
}

function rect(x, y, width, height, options = {}) {
  const {
    fill = 'none',
    stroke = 'none',
    strokeWidth = 1,
    radius = 0,
    opacity = 1
  } = options;
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${opacity}"/>`;
}

function circle(cx, cy, r, options = {}) {
  const { fill = 'none', stroke = 'none', strokeWidth = 1, opacity = 1 } = options;
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${opacity}"/>`;
}

function bookmarkIcon(x, y, size, color = '#e8ded3') {
  const w = size * 0.72;
  const h = size;
  const left = x + (size - w) / 2;
  return [
    `<path d="M${left} ${y} h${w} a2 2 0 0 1 2 2 v${h - 2} l-${w / 2 + 1} -${size * 0.22} l-${w / 2 + 1} ${size * 0.22} v-${h - 2} a2 2 0 0 1 2 -2 z" fill="${color}"/>`,
    `<rect x="${left + size * 0.19}" y="${y + size * 0.25}" width="${size * 0.35}" height="${size * 0.06}" rx="1" fill="#3f342d"/>`,
    `<rect x="${left + size * 0.19}" y="${y + size * 0.42}" width="${size * 0.22}" height="${size * 0.06}" rx="1" fill="#3f342d"/>`
  ].join('');
}

function folderIcon(x, y, color = '#c69b5d') {
  return [
    rect(x, y + 4, 16, 11, { fill: color, radius: 2 }),
    rect(x, y + 2, 8, 5, { fill: color, radius: 2 })
  ].join('');
}

function smallFavicon(x, y, label, color) {
  return [
    circle(x + 8, y + 8, 8, { fill: color }),
    text(x + 8, y + 12, label.slice(0, 1), { size: 10, weight: 800, fill: '#ffffff', anchor: 'middle' })
  ].join('');
}

function browserBase({ width = 1280, height = 800, theme = 'dark' } = {}) {
  const bg = theme === 'light' ? '#f5f1ec' : '#22252b';
  const top = theme === 'light' ? '#efe8df' : '#2a2624';
  const page = theme === 'light' ? '#f7f3ee' : '#202329';
  return [
    rect(0, 0, width, height, { fill: bg }),
    rect(0, 0, width, 34, { fill: top }),
    circle(18, 17, 5, { fill: '#e06666' }),
    circle(35, 17, 5, { fill: '#e6b85c' }),
    circle(52, 17, 5, { fill: '#73c17a' }),
    rect(82, 9, 520, 16, { fill: theme === 'light' ? '#ffffff' : '#34383f', radius: 8, opacity: 0.9 }),
    text(104, 21, 'new-tab.example', { size: 10, fill: theme === 'light' ? '#74675d' : '#bcb6ae', weight: 500 }),
    rect(0, 34, width, height - 34, { fill: page })
  ].join('');
}

function newTabCenter(theme = 'dark') {
  const muted = theme === 'light' ? '#75685f' : '#bcb6ae';
  const strong = theme === 'light' ? '#4b3f37' : '#f4ece3';
  return [
    text(430, 245, 'New Tab', { size: 54, weight: 800, fill: strong }),
    text(430, 282, 'A quiet page for focused browsing', { size: 18, weight: 500, fill: muted }),
    rect(350, 320, 520, 44, { fill: theme === 'light' ? '#ffffff' : '#4f545b', radius: 22, opacity: 0.95 }),
    text(382, 348, 'Search or type a URL', { size: 16, weight: 500, fill: theme === 'light' ? '#9a8b80' : '#d7d0c9' }),
    rect(410, 400, 120, 36, { fill: theme === 'light' ? '#e8e0d6' : '#30343b', radius: 6 }),
    rect(552, 400, 120, 36, { fill: theme === 'light' ? '#e8e0d6' : '#30343b', radius: 6 }),
    text(470, 423, 'Search', { size: 13, fill: muted, anchor: 'middle' }),
    text(612, 423, 'Lucky', { size: 13, fill: muted, anchor: 'middle' })
  ].join('');
}

function sidePanel({ x = 1020, y = 34, width = 260, height = 766, theme = 'dark', view = 'tree' } = {}) {
  const dark = theme === 'dark';
  const bg = dark ? '#151113' : '#fbf7f3';
  const surface = dark ? '#211d1f' : '#f1ebe5';
  const surface2 = dark ? '#2e2925' : '#ffffff';
  const border = dark ? '#4b3b32' : '#d8cac0';
  const textMain = dark ? '#f4ece3' : '#2d2520';
  const textMuted = dark ? '#b8aaa0' : '#75685f';
  const accent = dark ? '#c69b5d' : '#3367d6';
  const blue = '#3f7ee8';
  const red = '#df2b2b';
  const orange = '#f59e0b';
  const parts = [
    rect(x, y, width, height, { fill: bg, stroke: border, strokeWidth: 1 }),
    rect(x, y, width, 34, { fill: surface, stroke: border, strokeWidth: 1 }),
    bookmarkIcon(x + 16, y + 9, 15, dark ? '#d8ccbf' : '#4f433a'),
    text(x + 42, y + 23, 'WideMark', { size: 12, weight: 800, fill: textMain }),
    text(x + width - 20, y + 23, 'x', { size: 14, fill: textMuted, anchor: 'middle' })
  ];

  if (view === 'tree') {
    parts.push(
      rect(x + 12, y + 52, width - 24, 28, { fill: dark ? '#201c22' : '#ffffff', stroke: blue, radius: 8 }),
      text(x + 24, y + 70, 'Search bookmarks...', { size: 10, fill: textMuted }),
      ...folderRows(x, y + 108, [
        ['Work', true],
        ['Research', true],
        ['Travel', true],
        ['Design', true],
        ['Reading List', true]
      ], textMain, textMuted, accent),
      ...bookmarkRows(x, y + 228, [
        ['Docs', 'D', '#3f7ee8'],
        ['Mail', 'M', '#d94848'],
        ['Calendar', 'C', '#29a36a'],
        ['Project Board', 'P', '#7c5cff'],
        ['Analytics', 'A', '#f59e0b'],
        ['Reference Notes', 'R', '#5c8df6'],
        ['Design System', 'D', '#de6ab5']
      ], textMain, textMuted)
    );
  }

  if (view === 'settings') {
    parts.push(
      settingsCard(x + 12, y + 54, width - 24, 246, 'Display', [
        ['Theme', 'Light'],
        ['Font Size', 'Medium (14px)'],
        ['Row Spacing', 'Standard'],
        ['UI Zoom', '100%']
      ], textMain, textMuted, border, surface2),
      settingsCard(x + 12, y + 314, width - 24, 138, 'Behavior', [
        ['Left-click Action', 'Open in Current Tab'],
        ['Tooltips', 'Enabled']
      ], textMain, textMuted, border, surface2),
      rect(x + 12, y + 468, width - 24, 96, { fill: surface2, stroke: border, radius: 8 }),
      text(x + 24, y + 492, 'System', { size: 12, weight: 800, fill: textMain }),
      rect(x + 24, y + 512, width - 48, 22, { fill: orange, radius: 5 }),
      text(x + width / 2, y + 527, 'Reset Folder Styles', { size: 9, weight: 700, fill: '#3a2700', anchor: 'middle' }),
      rect(x + 24, y + 540, width - 48, 22, { fill: red, radius: 5 }),
      text(x + width / 2, y + 555, 'Restore Defaults', { size: 9, weight: 700, fill: '#ffffff', anchor: 'middle' })
    );
  }

  if (view === 'duplicates') {
    parts.push(
      rect(x + 12, y + 54, width - 24, 280, { fill: surface2, stroke: border, radius: 8 }),
      text(x + 24, y + 82, 'Actions', { size: 12, weight: 800, fill: textMain }),
      rect(x + width - 106, y + 62, 82, 24, { fill: blue, radius: 7 }),
      text(x + width - 65, y + 78, 'Find Duplicates', { size: 8, weight: 800, fill: '#ffffff', anchor: 'middle' }),
      rect(x + 24, y + 100, width - 48, 1, { fill: border }),
      rect(x + 24, y + 128, width - 48, 5, { fill: blue, radius: 3 }),
      text(x + 24, y + 152, '2 duplicate groups found. Review before deleting.', { size: 9, fill: textMuted }),
      duplicateGroup(x + 24, y + 172, width - 48, 'https://example.com/docs', [
        ['Product Docs', 'Bookmarks Bar / Work'],
        ['Product Docs', 'Other Bookmarks / Research']
      ], textMain, textMuted, border, surface),
      duplicateGroup(x + 24, y + 258, width - 48, 'https://example.com/notes', [
        ['Team Notes', 'Bookmarks Bar / Reading List']
      ], textMain, textMuted, border, surface)
    );
  }

  if (view === 'search') {
    parts.push(
      rect(x + 12, y + 52, width - 24, 28, { fill: dark ? '#201c22' : '#ffffff', stroke: blue, radius: 8 }),
      text(x + 24, y + 70, 'design', { size: 10, fill: textMain }),
      text(x + 14, y + 104, 'Search Results', { size: 12, weight: 800, fill: textMain }),
      ...bookmarkRows(x, y + 126, [
        ['Design System', 'D', '#3f7ee8'],
        ['Design Assets', 'A', '#de6ab5'],
        ['Interface Patterns', 'I', '#7c5cff'],
        ['Product Guidelines', 'P', '#f59e0b']
      ], textMain, textMuted, true)
    );
  }

  parts.push(
    rect(x, y + height - 26, width, 26, { fill: surface, stroke: border }),
    text(x + 70, y + height - 9, 'Left-click open here', { size: 8, fill: textMuted, anchor: 'middle' }),
    text(x + 185, y + height - 9, 'Ctrl-click new tab', { size: 8, fill: textMuted, anchor: 'middle' })
  );

  return parts.join('');
}

function folderRows(x, y, rows, textMain, textMuted, accent) {
  const parts = [];
  rows.forEach(([label], index) => {
    const yy = y + index * 24;
    parts.push(folderIcon(x + 24, yy, accent));
    parts.push(text(x + 48, yy + 16, label, { size: 11, weight: 700, fill: textMain }));
  });
  return parts;
}

function bookmarkRows(x, y, rows, textMain, textMuted, card = false) {
  const parts = [];
  rows.forEach(([label, initial, color], index) => {
    const yy = y + index * 24;
    if (card === true) {
      parts.push(rect(x + 12, yy - 4, 236, 28, { fill: index === 0 ? '#e9efff' : '#ffffff', stroke: '#e0d6ce', radius: 6 }));
    }
    parts.push(smallFavicon(x + 24, yy, initial, color));
    parts.push(text(x + 48, yy + 13, label, { size: 11, weight: 600, fill: textMain }));
  });
  return parts;
}

function settingsCard(x, y, width, height, title, rows, textMain, textMuted, border, surface) {
  const parts = [
    rect(x, y, width, height, { fill: surface, stroke: border, radius: 8 }),
    text(x + 12, y + 24, title, { size: 12, weight: 800, fill: textMain })
  ];
  rows.forEach(([label, value], index) => {
    const yy = y + 52 + index * 44;
    parts.push(text(x + 12, yy, label, { size: 8, weight: 700, fill: textMuted }));
    parts.push(rect(x + 12, yy + 8, width - 24, 26, { fill: '#ffffff', stroke: border, radius: 5 }));
    parts.push(text(x + 24, yy + 25, value, { size: 9, fill: textMain }));
  });
  return parts.join('');
}

function duplicateGroup(x, y, width, url, rows, textMain, textMuted, border, surface) {
  const parts = [
    rect(x, y, width, 26 + rows.length * 25, { fill: '#ffffff', stroke: border, radius: 7 }),
    rect(x, y, 3, 26 + rows.length * 25, { fill: '#f59e0b', radius: 2 }),
    text(x + 10, y + 17, url, { size: 8, fill: textMuted })
  ];
  rows.forEach(([title, pathLabel], index) => {
    const yy = y + 32 + index * 25;
    parts.push(text(x + 10, yy, title, { size: 10, weight: 700, fill: textMain }));
    parts.push(text(x + 10, yy + 12, pathLabel, { size: 7, fill: textMuted }));
    parts.push(text(x + width - 14, yy + 4, 'x', { size: 11, fill: '#d43d3d', anchor: 'middle' }));
  });
  return parts.join('');
}

function callout(x, y, title, subtitle, width = 300) {
  return [
    rect(x, y, width, 84, { fill: '#fff7ed', stroke: '#d8b486', radius: 12 }),
    text(x + 20, y + 30, title, { size: 22, weight: 850, fill: '#34271f' }),
    text(x + 20, y + 58, subtitle, { size: 14, weight: 600, fill: '#7a6251' })
  ].join('');
}

function screenshotMain() {
  const w = 1280;
  const h = 800;
  return svg(w, h, [
    browserBase({ width: w, height: h, theme: 'dark' }),
    newTabCenter('dark'),
    sidePanel({ x: 1036, y: 34, width: 244, height: 766, theme: 'dark', view: 'tree' }),
    callout(54, 94, 'Bookmarks, always visible', 'Browse and organize without leaving the page', 390)
  ].join(''));
}

function screenshotSearch() {
  const w = 1280;
  const h = 800;
  return svg(w, h, [
    browserBase({ width: w, height: h, theme: 'dark' }),
    newTabCenter('dark'),
    sidePanel({ x: 1036, y: 34, width: 244, height: 766, theme: 'dark', view: 'search' }),
    callout(56, 96, 'Fast bookmark search', 'Title-first results with clean URL matching', 390)
  ].join(''));
}

function screenshotSettings() {
  const w = 1280;
  const h = 800;
  return svg(w, h, [
    browserBase({ width: w, height: h, theme: 'light' }),
    newTabCenter('light'),
    sidePanel({ x: 1036, y: 34, width: 244, height: 766, theme: 'light', view: 'settings' }),
    callout(54, 94, 'Make it fit your workflow', 'Themes, spacing, click behavior, and folder styles', 430)
  ].join(''));
}

function screenshotDuplicates() {
  const w = 1280;
  const h = 800;
  return svg(w, h, [
    browserBase({ width: w, height: h, theme: 'light' }),
    newTabCenter('light'),
    sidePanel({ x: 1036, y: 34, width: 244, height: 766, theme: 'light', view: 'duplicates' }),
    callout(54, 94, 'Review duplicates locally', 'Folder paths and confirmations help avoid mistakes', 430)
  ].join(''));
}

function smallTile() {
  const w = 440;
  const h = 280;
  return svg(w, h, [
    rect(0, 0, w, h, { fill: '#2f2924' }),
    rect(24, 24, 392, 232, { fill: '#f6efe8', radius: 22 }),
    bookmarkIcon(48, 50, 42, '#4b3f37'),
    text(104, 80, 'WideMark', { size: 32, weight: 900, fill: '#332821' }),
    text(50, 126, 'Bookmarks in a', { size: 30, weight: 850, fill: '#332821' }),
    text(50, 160, 'clean side panel', { size: 30, weight: 850, fill: '#332821' }),
    text(52, 198, 'Browse. Search. Organize.', { size: 16, weight: 650, fill: '#776557' }),
    rect(314, 58, 74, 150, { fill: '#181316', radius: 10 }),
    rect(324, 76, 54, 8, { fill: '#c69b5d', radius: 3 }),
    rect(324, 100, 42, 8, { fill: '#c69b5d', radius: 3 }),
    rect(324, 124, 50, 8, { fill: '#c69b5d', radius: 3 }),
    rect(324, 148, 38, 8, { fill: '#e8ded3', radius: 3 }),
    rect(324, 172, 46, 8, { fill: '#e8ded3', radius: 3 })
  ].join(''));
}

function marqueeTile() {
  const w = 1400;
  const h = 560;
  return svg(w, h, [
    rect(0, 0, w, h, { fill: '#2f2924' }),
    rect(50, 52, 1300, 456, { fill: '#f6efe8', radius: 34 }),
    bookmarkIcon(96, 96, 58, '#4b3f37'),
    text(174, 136, 'WideMark', { size: 48, weight: 900, fill: '#332821' }),
    text(96, 220, 'A compact Chrome side panel', { size: 54, weight: 900, fill: '#332821' }),
    text(98, 276, 'for bookmarks that stay organized.', { size: 44, weight: 850, fill: '#332821' }),
    text(100, 344, 'Browse, search, drag, style, and find duplicate bookmark URLs locally.', { size: 24, weight: 600, fill: '#756458' }),
    rect(930, 90, 318, 380, { fill: '#171316', radius: 22 }),
    rect(956, 120, 118, 12, { fill: '#e8ded3', radius: 4 }),
    rect(956, 158, 242, 34, { fill: '#201b20', stroke: '#4f7ee8', radius: 10 }),
    text(974, 180, 'Search bookmarks...', { size: 15, fill: '#9f958d' }),
    ...folderRows(946, 222, [['Work'], ['Research'], ['Travel'], ['Design']], '#f4ece3', '#b8aaa0', '#c69b5d'),
    ...bookmarkRows(946, 338, [['Docs', 'D', '#3f7ee8'], ['Mail', 'M', '#d94848'], ['Notes', 'N', '#7c5cff']], '#f4ece3', '#b8aaa0')
  ].join(''));
}

function svg(width, height, content) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  ${rect(0, 0, width, height, { fill: '#ffffff' })}
  ${content}
</svg>`;
}

const assets = [
  ['screenshot-01-main-side-panel', 1280, 800, screenshotMain()],
  ['screenshot-02-search', 1280, 800, screenshotSearch()],
  ['screenshot-03-settings', 1280, 800, screenshotSettings()],
  ['screenshot-04-duplicates', 1280, 800, screenshotDuplicates()],
  ['promo-small-440x280', 440, 280, smallTile()],
  ['promo-marquee-1400x560', 1400, 560, marqueeTile()]
];

assets.forEach(([name, width, height, content]) => {
  const svgPath = path.join(outDir, `${name}.svg`);
  const pngPath = path.join(outDir, `${name}.png`);
  fs.writeFileSync(svgPath, content, 'utf8');
  execFileSync('convert', [
    '-background', 'white',
    svgPath,
    '-alpha', 'remove',
    '-alpha', 'off',
    '-resize', `${width}x${height}!`,
    pngPath
  ], { stdio: 'inherit' });
  console.log(`Created ${path.relative(rootDir, pngPath)}`);
});
