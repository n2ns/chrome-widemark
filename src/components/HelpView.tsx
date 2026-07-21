const HELP_SECTIONS: [string, string[]][] = [
  [
    'Basics',
    [
      'Click a folder to expand or collapse it.',
      'Use the search button (or press "/") to filter bookmarks by title or URL.',
      'Ctrl-click or middle-click opens a bookmark in a background tab.',
      'Arrow keys move through the tree; Enter opens the selected item.',
      'Press Alt+B to open WideMark from any page (configurable at chrome://extensions/shortcuts).',
    ],
  ],
  [
    'Organize',
    [
      'Right-click a folder or bookmark to add, rename, edit, or delete items.',
      'Right-click a folder and choose "Sort by Name" to order its contents.',
      'Drag items to reorder them or move them into another folder.',
      'Folder styles are stored separately from Chrome bookmarks.',
    ],
  ],
  [
    'Actions',
    [
      'Find duplicate bookmark URLs or same-domain bookmarks locally.',
      'Delete empty folders and merge same-named sibling folders.',
      'Review folder paths before deleting.',
      'Deletion and merging require confirmation.',
    ],
  ],
  [
    'Settings',
    ['Adjust theme, font size, spacing, zoom, and click behavior.', 'Restore Defaults resets WideMark settings only.'],
  ],
  [
    'Privacy',
    [
      'No sensitive website host permissions.',
      'No user data collection or tracking.',
      'No data upload.',
      'Bookmarks and duplicate checks are processed locally.',
    ],
  ],
];

export function HelpView() {
  return (
    <div id="help-view">
      <div className="settings-card">
        <h3>Help</h3>
        <div className="help-list">
          {HELP_SECTIONS.map(([heading, items]) => (
            <section className="help-item" key={heading}>
              <h4>{heading}</h4>
              <ul>
                {items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
      <div className="settings-card help-about-card">
        <h3>About</h3>
        <p>
          Built by{' '}
          <a href="https://n2ns.com" target="_blank" rel="noopener noreferrer">
            N2NS Lab
          </a>{' '}
          ·{' '}
          <a href="https://datafrog.io/widemark" target="_blank" rel="noopener noreferrer">
            datafrog.io
          </a>
        </p>
      </div>
    </div>
  );
}
