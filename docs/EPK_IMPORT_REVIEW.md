# EPK Import Review

Last-Updated: 2026-06-24

## Purpose

`prism-focus` can review an `epk-to-focus.event-packet` JSON payload and turn selected proposed tasks into normal Focus tasks.

This is review-first. It is not automatic sync.

## How to open

Use the inbox button in the header.

The modal is called:

```text
EPK → Focus event packet
```

## Safe workflow

1. Paste an `epk-to-focus.event-packet` JSON payload.
2. Click **Review packet**.
3. Check the event title, date, timezone, and proposed tasks.
4. Select only the tasks you want.
5. Click **Import selected**.

Nothing is imported until the final explicit click.

## What is validated

The importer checks that:

- the packet is JSON
- `packetType` is `epk-to-focus.event-packet`
- `schemaVersion` exists
- `source.system` is `EPK`
- `review.status` exists
- `event.title`, `event.date`, and `event.timezone` exist
- at least one proposed task exists
- every proposed task has a title

## What gets created

Each approved proposed task becomes a normal Focus task with:

- task title from `task.title`
- category from `task.category`, creating it locally if needed
- optional `ts`, `durationMins`, and `estimatedMins`
- `taskScope` from the packet, defaulting to `project`
- a note linking back to the EPK event context
- a `sourceId` so repeat imports can skip duplicates

## What does not happen

The importer does not:

- read from EPK automatically
- fetch remote URLs
- watch files
- publish anything
- create tasks in the background
- overwrite existing tasks
- import audio/media
- mutate planner state outside the created task fields

## Future work

Possible next improvements:

- show an inline diff before import
- support a file picker for local packet JSON
- preserve source event metadata in a dedicated field
- add tests once the legacy Node harness is updated to load new import files
