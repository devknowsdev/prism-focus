# ---
Last-Updated: 2026-06-22

# ADHDashboard — Orientation

Purpose: short developer map to locate key files and runtime flows.

Entry
- `index.html`: fixed script load order; no build step. App boots via `init.js`.

Load order (important)
- `constants.js` → `state.js` → `widget_registry.js` → `helpers.js` → `core.js` → `storage.js` → `audio.js` → `ui.js` → `render_*.js` → `actions_*.js` → `runtime.js` → `init.js`

Core concepts
- Global mutable state in `src/state.js` (project is mid-migration into `src/state/*`).
- Persistence in `src/storage.js` using `localStorage` keys prefixed `adhd4_`.
- Widgets register with `registerWidget()` in `src/widget_registry.js` and are rendered by `src/render.js`.
- `render()` is debounced (rAF) → `_doRender()` rebuilds `#root`. Inputs inside containers marked `data-no-clobber="true"` prevent full rebuilds and require targeted DOM patches or blur tricks to ensure new content appears.

Key files
- UI orchestration: `src/render.js`, `src/core.js`.
- State + persistence: `src/state.js`, `src/storage.js`.
- Widget registry: `src/widget_registry.js`.
- Tasks: `src/render_tasks.js`, `src/actions_tasks.js`.
- Planner/timeline: `src/render_planner.js`, `src/actions_planner.js`.
- Timer / focus: `src/render_focus*.js`, `src/actions_tasktimer.js`.
- AI layer: `src/ai.js` (optional; Ollama/Anthropic integration).

Testing
- Node harness: `node src/test_workflows.js` (expected 346 passing).
- Architecture lint: `python3 tools/validate_architecture.py`.

Developer notes
- When editing inputs inside `data-no-clobber` containers, call `_blurForRender(id)` or use `renderNow()` after blurring to force a full rebuild.
- Add new widgets by creating `render_*.js` + optional `actions_*.js`, calling `registerWidget()` and adding the file to `index.html` and `src/test_workflows.js` FILES array if tests are used.
- Check `generated/registry.json` and `generated/state_graph.json` for ownership and quick lookup.

Where to start for common tasks
- Change task UI: `src/render_tasks.js` + `src/actions_tasks.js`.
- Change persistence: `src/storage.js`.
- Add widget: follow `WIDGET_GUIDE.md` + `widget_registry.js`.

Contact: refer to repository README for live demo and backup/restore notes.
