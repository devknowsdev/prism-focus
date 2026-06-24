# prism-focus Install and Backup Checklist

Last-Updated: 2026-06-24

## Purpose

This checklist verifies how to open `prism-focus`, how to back up data, and what not to claim about installability yet.

## Current install status

`prism-focus` is a static browser app. It can be opened by:

- the hosted GitHub Pages URL from the README
- opening `index.html` directly
- running a local static server

No service-worker or app-manifest install path is currently verified.

Do not describe the app as installable or offline-ready until a future PR adds and verifies that behavior.

## Safe open paths

### Hosted copy

```text
https://devknowsdev.github.io/prism-focus/
```

### Local file

Open:

```text
index.html
```

### Local server

```bash
python3 -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

Use the local server path when testing browser APIs such as audio or voice notes.

## Backup checklist

Before changing browser, device, or storage settings:

1. Open `prism-focus`.
2. Open **Day Log**.
3. Open the export/backup section.
4. Download **Backup (JSON)**.
5. Store the file somewhere safe outside browser storage.
6. Remember that audio blobs and voice notes are not included in the JSON backup.

## Restore checklist

Before restoring:

1. Export a fresh backup first, if possible.
2. Confirm the restore file is the expected JSON backup.
3. Restore from **Day Log**.
4. Reload the app.
5. Check tasks, planner state, habits, and logs.

Restore replaces app data from the backup file. Treat it as a deliberate local write.

## Audio caveat

Audio recordings live in browser IndexedDB on the same device.

They are not included in JSON backup/export.

Do not promise that audio will survive browser reset, site-data clearing, or device changes.

## Optional AI caveat

AI is optional. Keep it off unless deliberately configured.

Claude keys and local AI settings are not normal task/planner backup data.

## Future PWA requirements

Before adding install-to-home-screen or offline support, verify:

- manifest file exists and has correct app identity
- service worker registration is explicit and reversible
- cached files do not hide stale app versions
- backup/export warnings remain visible offline
- audio and IndexedDB caveats remain visible offline
- there is a clear way to refresh or unregister stale cache during development

## Manual verification record

Use this section during a future browser test pass:

```text
Date:
Browser:
Device:
Hosted URL opened:
Local file opened:
Local server opened:
Backup JSON downloaded:
Restore tested:
Audio caveat visible:
PWA manifest present:
Service worker present:
Install prompt observed:
Notes:
```

## Future prompts can omit

Future prompts can reference this checklist instead of restating the current install status, backup path, audio caveat, and PWA verification requirements.
