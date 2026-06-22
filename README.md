# ---
Last-Updated: 2026-06-22

# ADHDashboard

Local-first productivity dashboard designed for ADHD and autism-friendly workflows. No build step, no account, no server required for day-to-day use — your data stays in the browser.

**Live demo:** [devknowsdev.github.io/prism-focus](https://devknowsdev.github.io/prism-focus/) (formerly ADHDashboard)

## Features

- **Focus Board** — timer (countdown/stopwatch), focus task, board cards, crisis/focus mode
- **Tasks** — categories, subtasks, urgency, repeat templates, day/project/fixed scope
- **Planner** — month grid and drag-to-schedule timeline
- **Day Wizard** — guided Day Start / Day End ritual
- **Dump (journal)** — quick capture with optional promote-to-task
- **Daily Check-in** — energy and intentions
- **Day Log** — time summaries, off-task log, backup/restore
- **Habits** — daily task tracking with hit grid
- **Music Tools** — metronome, tuner, task music metadata
- **AI (optional)** — Ollama (local) or Claude for NL task parse, wizard prompts, breakdowns, and weekly nudges; degrades gracefully when off

## Quick start

1. Clone or download this repo, **or** use the [live demo](https://devknowsdev.github.io/prism-focus/).
2. Open `index.html` in a modern browser, **or** run a local server (recommended for voice notes):

   ```bash
   python3 -m http.server 8080
   # → http://localhost:8080
   ```

3. Use the app. Data persists automatically in `localStorage`.

See [web/README.md](web/README.md) for browser vs. local-server notes.

### Optional AI

1. Open **Settings** (gear icon in the header) → **AI** tab
2. Enable AI features
3. **Local/private:** run `tools/install_local_ai.sh` to install Ollama and pull the default local model, then enable Ollama, test connection
4. **Cloud:** paste a Claude API key (stored separately; never included in JSON backups)

#### Local AI installer

The repository includes a helper script to install Ollama and the default `llama3.2` model for macOS/Linux:

```bash
chmod +x tools/install_local_ai.sh
./tools/install_local_ai.sh
```

After installation, run:

```bash
ollama serve --model llama3.2
```

Then open the app settings, enable Ollama, and test the connection.

> Note: the AI settings UI includes a host integration hook for `window.__AI_BOOTSTRAP__`.
> In a native wrapper or Electron build, that hook can invoke the local installer directly,
> but in a plain browser the button falls back to manual shell execution.

## Tests

Requires Node.js (no npm install):

```bash
node src/test_workflows.js
```

Expect **331 passed, 0 failed**.

Architecture lint (optional):

```bash
python3 tools/validate_architecture.py
```

## Backup

In the **Day Log** widget → **Export** section:

- **Backup (JSON)** — downloads tasks, settings, wizard state, planner dumps, etc. (version 17 format)
- **Restore backup** — replaces all data from a JSON file

Audio recordings are device-only and are not included in JSON backups.

## Project structure

```
index.html          Entry point; loads scripts in fixed order
vendor/             Vendored Tabler icons + fonts (offline / Pages)
src/
  state.js          All mutable global state
  ai.js             Optional AI layer (Ollama / Claude)
  storage.js        localStorage load/save
  render*.js        Widget HTML renderers
  actions*.js       State mutations
  render.js         Main render orchestrator
  runtime.js        Global listeners and intervals
  init.js           Boot: load → migrate → render
  test_workflows.js Node test harness (331 tests)
  state/            Draft ES-module split (not loaded; see state_migration_findings.md)
  ARCHITECTURE.md   Developer map — read before changing code
tools/
  validate_architecture.py
generated/          Auto-generated dependency graphs
.github/workflows/  CI tests + GitHub Pages deploy
```

## Tech stack

- Vanilla HTML/CSS/JavaScript (classic `<script>` tags, shared global scope)
- `localStorage` for persistence; IndexedDB for audio blobs
- [Tabler Icons](https://tabler.io/icons) and [Google Fonts](https://fonts.google.com) vendored under `vendor/` (no CDN at runtime)

## License

MIT — see [LICENSE](LICENSE).
