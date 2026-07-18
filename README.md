# NAVI

A prototype that brings AI-powered accessibility to Google Sheets for blind and visually impaired (BVI) users. NAVI reads the sheet, summarizes it aloud, answers questions by voice or text, and can edit cells on command.

## Setup

Requires Node 22+ and [pnpm](https://pnpm.io).

```bash
# 1. Install dependencies
pnpm install

# 2. Create your local secrets file and paste your keys into it
cp .env.example .env

# 3. Build the extension
pnpm build
```

Then load it in Chrome: `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select the `.output/chrome-mv3` folder.

### One-time OAuth setup (needed for cell edits)

The extension ID is pinned to `fojpekkjeokfmckeohalgnmdjcdeejme` (via the `key` field in the manifest), so it is the same on every machine. In **Google Cloud Console → APIs & Services → Credentials → the NAVI OAuth client (Chrome extension)**, set the **Item ID** to that value once. Reading and chat work without this; cell edits need it to authenticate.

## Speech controls

| Action | Keyboard (Mac: Alt = Option ⌥) | Button |
|---|---|---|
| Open NAVI (works on Windows/Mac/Linux, even while the sheet has focus; remap at `chrome://extensions/shortcuts`) | **Alt + N** | click the eye icon |
| Pause / resume (resumes at the current sentence) | tap **Shift** once | ⏯️ |
| Replay the last message (when nothing is playing) | tap **Shift** once | ⏯️ |
| Stop completely | tap **Shift** twice quickly | ⏹️ |
| Speak faster / slower (5 steps, remembered) | **Alt + .** / **Alt + ,** | — |
| Open the NAVI menu (text size, output mode, greeting, speed) | **Alt + M** | — |
| Quit NAVI (asks for confirmation, press again to confirm) | **Alt + Q** | ✕ |
| Screen-reader mode + announce the active cell | **Ctrl + Alt + Z** | via menu |

A clean Shift tap only — Shift held with any other key (normal typing) never triggers playback controls.

Opening NAVI greets you and immediately scans + summarizes the sheet — there is no setup screen. Text size is changed from the menu and remembered.

**Using a screen reader (NVDA / JAWS / VoiceOver)?** Switch NAVI to screen-reader mode (menu → "Read out loud: My screen reader", or Ctrl+Alt+Z). NAVI then stays silent and your screen reader reads its responses — no two voices talking over each other. The manual screen-reader test script lives in [docs/a11y-testing.md](docs/a11y-testing.md).

## Development

| Command | What it does |
|---|---|
| `pnpm dev` | Dev mode with hot reload (opens a Chrome window with the extension loaded) |
| `pnpm test` | Run the unit tests (Vitest) |
| `pnpm test:watch` | Tests in watch mode |
| `pnpm compile` | TypeScript typecheck |
| `pnpm build` | Production build into `.output/chrome-mv3` |

Tests live next to the code as `*.test.ts` and run in CI on every push and pull request.

## Project structure

```
src/
  entrypoints/       WXT entrypoints — content script (UI shell) + background worker (OAuth writes)
  core/              Platform-independent logic: LLM client, speech (TTS/voice input), command parsing
  platform/sheets/   Google Sheets specifics: reading values, editing cells, URL/tab detection
  ui/                The floating icon + chat panel
public/icons/        Extension icons
```

The `core/` vs `platform/` split is deliberate: core logic stays reusable for the planned Microsoft Excel add-in.
