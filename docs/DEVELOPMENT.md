# Development

## Setup

```bash
npm install
```

## Commands

Type-check both TypeScript projects (the extension `src/` and the build
scripts `scripts/`):

```bash
npm run check
```

Run the test suite (Vitest — pure-logic, store, and component tests):

```bash
npm test
```

Start the Vite dev server (HMR):

```bash
npm run dev
```

Build the loadable extension into `build/`:

```bash
npm run build
```

Create the Chrome Web Store upload zip (runs check + tests + build, then zips
`build/`):

```bash
npm run package
```

## Loading the extension for development

Vite + `@crxjs/vite-plugin` compile `src/` into `build/`, which is a
self-contained loadable extension.

1. Run `npm run build` (or `npm run dev` for HMR).
2. In `chrome://extensions`, enable Developer mode and **Load unpacked** the
   `build/` directory.
3. After a change, rebuild (or rely on the dev server) and click the
   extension's reload button.

`build/` is generated output and is git-ignored.

### Local Windows/WSL sync

`npm run build:sync` builds and then copies `build/` to a Windows path for
testing in Windows Chrome. Set `WINDOWS_ARTIFACTS_PATH` in `.env`:

```bash
WINDOWS_ARTIFACTS_PATH="/mnt/c/path/to/chrome-widemark-dist"
```

## Release Package

`npm run package` produces `dist/widemark-v<version>.zip` from the `build/`
output. The zip contains only the runtime extension (compiled JS/CSS, HTML,
manifest, icons) — no source maps and no development files. Check it before
upload:

```bash
unzip -l dist/widemark-v<version>.zip
```

Upload the zip to the Chrome Web Store. `dist/` is generated output and is
git-ignored. Publishing is automated on `v*` tags (`.github/workflows/publish.yml`).

## Project Layout

```text
chrome-widemark/
├── manifest.json
├── vite.config.ts          # Vite + @crxjs build
├── vitest.config.ts        # test runner (happy-dom)
├── tsconfig.json           # extension type-check (noEmit)
├── tsconfig.scripts.json   # build-script + Vite/Vitest config type-check (Node)
├── tsconfig.test.json      # test/ type-check
├── src/
│   ├── background.ts        # MV3 service worker
│   ├── sidepanel.html       # React entry (#root + main.tsx)
│   ├── main.tsx
│   ├── App.tsx
│   ├── sidepanel.css        # imports styles/*
│   ├── components/          # React components (+ *.test.tsx)
│   ├── stores/              # Zustand stores (+ tests)
│   ├── hooks/               # useApplySettings / useKeyboardNav / useNodeDrag
│   ├── lib/                 # framework-agnostic logic (+ tests)
│   ├── types.d.ts           # shared types (emits no JS)
│   ├── chrome-shims.d.ts    # chrome-types augmentation
│   └── styles/
├── build/                   # Vite output (git-ignored; Load unpacked here)
├── icons/  ·  store-assets/  ·  design/
├── scripts/                 # .ts build tooling + sync-to-windows.sh
├── test/                    # repo/logic tests (*.test.ts)
└── docs/
```

## Testing

Vitest is the single test runner (happy-dom environment). Tests cover:

- bookmark helpers, duplicate grouping, folder-style matching, sorting,
  empty/same-name folder detection, drop-position math, search ranking
- Zustand store behavior (hydrate, persistence, event suppression) with a
  mocked `chrome`
- React components via Testing Library: tree render / expand / open, settings,
  modal dialogs, context menu, actions (duplicate/cleanup), drag-and-drop, and
  keyboard navigation
- manifest permission surface and the Vite/package pipeline shape

Real-browser smoke testing (actual bookmarks API + side panel) is still done
manually via Load unpacked.
