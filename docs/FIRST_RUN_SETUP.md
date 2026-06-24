# prism-focus First-Run Setup

Last-Updated: 2026-06-24

This guide explains the safe first-run path for `prism-focus`. It matches the in-app setup guide added in `src/setup.js`.

For install, backup, restore, audio, and PWA verification details, see [INSTALL_AND_BACKUP_CHECKLIST.md](INSTALL_AND_BACKUP_CHECKLIST.md).

## What prism-focus is

`prism-focus` is a local-first planning and task dashboard. It is designed to open quickly without accounts, servers, or build steps.

## Fastest ways to open it

### Hosted copy

Use the hosted GitHub Pages copy:

```text
https://devknowsdev.github.io/prism-focus/
```

### Local file

Open `index.html` directly in a browser.

This is enough for most task, timer, planner, and dashboard workflows.

### Local static server

Recommended when testing voice notes or browser APIs that behave poorly on `file://` URLs:

```bash
python3 -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

## First-run checklist

1. Open the app.
2. Read the setup guide modal.
3. Confirm you understand where data lives.
4. Make an early backup from **Day Log → Export → Backup (JSON)**.
5. Keep AI off unless you deliberately want to configure it.
6. Use a local static server if voice notes do not work from `file://`.

## Data storage

| Data | Where it lives | Backup status |
| --- | --- | --- |
| Tasks, settings, planner state, routines, logs | Browser `localStorage` keys prefixed `adhd4_` | Included in JSON backup/export. |
| Audio blobs / voice notes | Browser IndexedDB on the same device | Not included in JSON backups. |
| Optional Claude key | Browser local storage key separate from normal JSON backup | Not included in JSON backups. |
| Optional Ollama/local AI settings | Browser local storage | Local-only settings. |

## Backup path

Use:

```text
Day Log → Export → Backup (JSON)
```

Restore is also in the Day Log export/backup section.

Important: audio recordings are device-only and are not included in JSON backups.

## Optional AI setup

AI is optional and should stay off until needed.

Open:

```text
Settings → AI
```

Options:

- **Ollama** for local/private model calls.
- **Claude API** for cloud model calls.

Local installer helper:

```bash
chmod +x tools/install_local_ai.sh
./tools/install_local_ai.sh
```

Then run Ollama and test the connection from Settings.

## PWA / install-to-home-screen status

No PWA/service-worker install path is currently verified.

Do not claim installability or offline-readiness until a dedicated PWA check confirms:

- manifest exists
- service worker behavior is safe and reversible
- offline cache does not preserve stale risky files
- backup/export warnings are still visible
- audio/localStorage/IndexedDB caveats are still visible

Current verification details are tracked in [INSTALL_AND_BACKUP_CHECKLIST.md](INSTALL_AND_BACKUP_CHECKLIST.md).

Recommended future PR:

```text
Focus-Setup-003 — add and verify optional PWA/install behavior
```

## Cross-app safety

`prism-focus` should not silently import from EPK or Spectra.

Future cross-app packets should appear as a review/import screen before they change:

- tasks
- planner state
- localStorage
- backups
- routines

No hidden imports, no background mutation, and no app-to-app writes without review.

## Validation

Safe checks:

```bash
node src/test_workflows.js
python3 tools/validate_architecture.py
```

Manual checks:

1. Open the app in a browser.
2. Confirm the setup guide appears once.
3. Click **Done for now**.
4. Reload and confirm it does not auto-open again.
5. Click the compass header button and confirm the guide reopens.
6. Confirm the local-server command copy button works where clipboard access is available.
7. Confirm Settings → AI still opens.
8. Confirm **Day Log → Export → Backup (JSON)** is still discoverable.
9. Confirm no PWA/install claim appears unless future install behavior is implemented.

## What future prompts can omit

Future prompts can reference this file instead of restating the basic Focus launch modes, storage caveats, backup path, optional-AI caution, no-hidden-import boundary, and current PWA status.
