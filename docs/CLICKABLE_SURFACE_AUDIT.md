# prism-focus Clickable Surface Audit

Last-Updated: 2026-06-24

## Purpose

This document records the browser clickable-surface audit for `prism-focus`.

The goal is to prevent a repeat of controls that look clickable but do nothing in the real browser while still passing the Node workflow harness.

## Scope

Audited surfaces:

- app boot script order
- header buttons
- task rows and task overflow controls
- task checkboxes, category chips, urgency, notes, subtasks, estimates, time chips, delete
- focus board and timer controls
- planner month, dump, week, day/timeline controls
- day wizard controls
- modals and setup/import entry points
- global action shim coverage
- `data-no-clobber` render guards that can block full redraws after button clicks

## Main findings

### 1. Browser app was missing the global action shim

`src/global_api_shim.js` existed but was not loaded by the real browser `index.html` until the interaction-fix pass.

Impact:

- Some inline `onclick` handlers could exist in templates but not have a browser runtime function.
- Node tests could still pass because the test harness could load the shim separately.
- Delete/task/timer/navigation behavior could diverge between tests and browser.

Status: fixed in PR `#14` by loading `src/global_api_shim.js` in `index.html`.

### 2. Task row dragging could steal normal clicks

The task row itself was draggable. This can interfere with selecting/focusing a task or clicking small controls inside the row.

Status: fixed in `src/interaction_fixes.js` by moving drag handlers from the whole task row to the grip icon only.

Expected behavior:

- click task name = focus/select task
- drag grip = reorder/drag task
- delete/overflow/subtask/checkbox buttons remain clickable

### 3. Planner month hover had no rendered preview layer

The month calendar cells rendered dots/counts, but no browser hover preview existed on the actual planner month cells.

Status: fixed in `src/interaction_fixes.js` by decorating rendered month cells after each render.

Expected behavior:

- hover month cell = small day preview
- preview includes captured items for that date and visible scheduled task labels
- leaving the cell removes the preview

### 4. Planner timeline buttons were blocked by the no-clobber guard

The planner dump view body is inside a `data-no-clobber="true"` area. When a Schedule/timeline button inside that area receives focus, the next `render()` call can downgrade to a partial timer-only update.

Impact:

- `plannerOpenTimeline(ymd)` could update state but fail to repaint the day timeline.
- This looked like the timeline button did nothing.

Status: fixed in `src/interaction_fixes.js` by wrapping planner navigation calls and blurring active no-clobber controls before the original action runs.

Covered functions:

- `plannerOpenTimeline`
- `plannerOpenDump`
- `plannerGoToMonth`
- `plannerSelectDate`

### 5. Timer save shim had an undefined variable path

The shim implementation of `stopAndSaveTimer()` attempted to assign `quickLogSecs = elapsed`, but `elapsed` was not defined in that scope.

Impact:

- Timer save/quick-log controls could fail silently.

Status: fixed in `src/interaction_fixes.js` by overriding the shim with a robust browser implementation that uses the computed seconds value.

## Clickable surface inventory

### App header

| Surface | Expected action | Status |
| --- | --- | --- |
| Setup/compass | Open first-run setup modal | Covered by setup actions |
| EPK import/inbox | Open packet review modal | Covered by import actions |
| Day wizard | Open start/end wizard | Covered by wizard actions |
| AI/settings sparkle | Open AI settings | Covered by modal/shim path |
| Chat | Open chat modal | Covered by shim/modal path |
| Files | Open file manager modal | Covered by shim/modal path |
| Listen/microphone | Toggle voice/listen mode | Covered by shim/audio path |
| Daily plan | Ask AI for plan suggestion | Covered by AI path/no-op fallback when unavailable |
| Settings | Open settings modal | Covered by modal path |
| Focus mode | Enter focus-only layout | Covered by shim/runtime path |
| Theme toggle | Toggle dark/light | Covered by shim |

### Tasks widget

| Surface | Expected action | Status |
| --- | --- | --- |
| Add task | Create task, blur input, full render | Covered by `addTask()` |
| Category tabs | Filter tasks | Covered by shim |
| Sort select | Change task order mode | Covered by shim |
| Energy filter | Toggle energy filter | Covered by shim |
| Task checkbox | todo → in-progress → done → todo | Covered by shim |
| Task name | Set focus task | Covered by shim |
| Grip icon | Drag/reorder task | Repaired to grip-only |
| Urgency flame | Open/set urgency | Covered by shim |
| Subtask chip | Expand/add subtasks | Covered by task actions |
| Time chip | Edit/clear task time | Covered by shim/actions |
| Timer icon | Start/pause task stopwatch | Covered by shim |
| Overflow dots | Show task options | Covered by render state |
| Estimate | Edit estimate | Covered by task actions |
| Note | Open/edit note | Covered by task actions |
| Pin | Pin/unpin as habit | Covered by task actions |
| Delete | Delete task and related sessions | Repaired by robust delete override |

### Planner widget

| Surface | Expected action | Status |
| --- | --- | --- |
| Month nav arrows | Previous/next month | Covered by planner actions |
| Month cell click | Open day capture/dump view | Covered and no-clobber-wrapped |
| Month cell double-click | Open day timeline | Covered and no-clobber-wrapped |
| Month cell hover | Show day preview | Repaired by post-render decorator |
| Day/sidebar button | Open selected day timeline | Covered by planner render path |
| Schedule button | Open day timeline | Repaired by no-clobber wrapper |
| `timeline →` button | Open day timeline | Repaired by no-clobber wrapper |
| Quick capture add | Add capture to date | Covered by `plannerAddDump()` with blur fix |
| Captured item checkbox | Toggle capture done | Covered by planner actions |
| Captured item promote | Create task from capture | Covered by planner actions |
| Captured item delete | Remove capture | Covered by planner actions |
| Unscheduled calendar-plus | Place task at 09:00 and open timeline | Covered by planner actions; should be manually retested |
| Timeline empty drag | Create timeline task draft | Covered by planner pointer actions |
| Timeline pill drag | Move scheduled task | Covered by planner pointer actions |
| Timeline pill resize | Resize duration | Covered by planner pointer actions |
| Timeline pill remove | Clear scheduled time | Covered by planner actions |
| Timeline draft commit/cancel | Create/cancel new timeline task | Covered by planner actions/shim fallback |

### Focus board / timer

| Surface | Expected action | Status |
| --- | --- | --- |
| Timer play/pause | Toggle timer | Covered by shim |
| Timer save | Open quick-log or save directly | Repaired by robust timer-save override |
| Countdown presets | Start countdown | Covered by shim |
| Stopwatch | Start stopwatch for focused task | Covered by shim |
| Break timer | Start break session | Covered by shim |
| Focus picker | Open/close focus picker | Covered by shim |
| Sessions modal | Open/edit/delete sessions | Covered by shim |

### Day wizard

| Surface | Expected action | Status |
| --- | --- | --- |
| Start/end/reopen | Open correct wizard phase | Covered by wizard actions |
| Next/back/close | Wizard navigation | Covered by wizard actions |
| Capture add | Add planner dump item | Covered with no-clobber blur fix |
| Add existing task | Add existing task to wizard capture list | Covered by wizard actions |
| Commit day start/end | Save and close wizard | Covered by wizard actions |

### Import/review modal

| Surface | Expected action | Status |
| --- | --- | --- |
| Open inbox | Open EPK packet modal | Covered by import actions |
| Review packet | Parse/validate JSON | Covered by import actions with blur fix |
| Select all/none | Change selected proposed tasks | Covered by import actions |
| Task checkboxes | Toggle proposed task selection | Covered by import actions |
| Import selected | Create selected Focus tasks only | Covered by import actions |
| Reset/close | Clear/close modal | Covered by import actions |

### Day log / export / restore

| Surface | Expected action | Status |
| --- | --- | --- |
| Backup JSON | Download local JSON backup | Covered by export actions |
| Restore backup | Restore from chosen JSON | Covered by export actions |
| Export summaries | Download/copy text/JSON summaries | Covered by export actions |
| Delete/edit off-task rows | Update off-task log | Covered by task/off-task actions |

### Music / audio surfaces

| Surface | Expected action | Status |
| --- | --- | --- |
| Metronome/tuner/keyboard controls | Music utility actions | Covered by music actions or safe shim fallback |
| Audio recording/playback | Browser audio/IndexedDB path | Covered by audio actions or safe fallback |
| Lyrics/music meta fields | Edit task/subtask metadata | Covered by task/music actions |

## Known limitations after this pass

1. The month calendar does not yet store per-date scheduled tasks separately from task time. Scheduled task dots/previews are therefore best-effort until the planner owns a real date field per scheduled task.
2. Some AI/music/browser-media controls intentionally degrade when the relevant optional subsystem is unavailable.
3. This audit is not a full Playwright click suite. The focused Spectra AI
   smoke lives in `tests/browser/focus-ai.spec.js`.

## Manual smoke checklist

Run after any clickable-surface PR:

```text
Date:
Browser:
App URL:

Header:
- Setup opens:
- EPK import opens:
- Settings opens:
- Theme toggles:

Tasks:
- Add task:
- Click task name focuses:
- Checkbox cycles status:
- Overflow opens:
- Delete removes task:
- Grip drag still works:

Timer:
- Start timer:
- Save timer opens quick-log:
- Commit quick-log saves session:

Planner:
- Month arrows work:
- Hover month cell shows preview:
- Click month cell opens capture/day view:
- Schedule button opens timeline:
- timeline arrow opens timeline:
- Unscheduled + calendar places task:
- Timeline drag/create works:

Wizard/import:
- Day wizard opens:
- Import modal opens:
- Invalid packet shows error:
- Valid packet shows proposed tasks:

Issues found:
Follow-up PRs:
```

## Rule for future changes

Any new rendered `onclick`, `onchange`, `onkeydown`, drag handler, or link-like control must have one of:

- a real function loaded by `index.html` before use
- an explicit shim fallback in `global_api_shim.js`
- a documented optional-subsystem fallback
- a manual smoke-test note in this file or a newer clickable-surface audit

Avoid adding buttons that only work in the Node harness or only after hidden state happens to be focused/unfocused.
