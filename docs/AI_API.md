# AI Callable Page Functions (API)

Purpose
- Document the safe, whitelisted commands the in-page AI may return and the expected JSON schema for each command.
- This file is intended to be included (or distilled) into system prompts so the model can emit strictly-typed commands.

Summary
- Entry point: `aiExecuteCommand(commandJson)`
- Behavior: validate -> authorize -> audit -> execute -> return structured result
- Safety: only whitelisted commands are accepted; caller must check `aiSettings.masterEnabled`; high-impact commands may require explicit user confirmation.

Command format
- The AI MUST return a single JSON object with this envelope:

  {
    "cmd": "string",        // required — command name
    "args": { ... },         // required — command arguments (shape depends on cmd)
    "meta": { optional... }  // optional — provenance or request-id
  }

Allowed commands (initial set)

1) `addTask`
 - Purpose: create a new task (from parsed AI output)
 - Args schema:
   - `text` (string, required)
   - `catId` (string, optional)
   - `ts` (string, optional, HH:MM or '')
   - `taskScope` (string, optional, 'day'|'project')
   - `note` (string, optional)
 - Example:
   {"cmd":"addTask","args":{"text":"Email tax documents","catId":"finance","ts":"14:00","taskScope":"day","note":"attach PDFs"}}

2) `updateTask`
 - Purpose: update fields of an existing task
 - Args schema:
   - `id` (number | string, required)
   - any of: `text`, `catId`, `ts`, `status`, `note`, `pinned`, `estimatedMins`, `urgency`
 - Example:
   {"cmd":"updateTask","args":{"id":12345,"ts":"09:30","pinned":true}}

3) `scheduleTask`
 - Purpose: set or clear a scheduled time
 - Args schema:
   - `id` (number | string, required)
   - `ts` (string, required; HH:MM or empty string to clear)
 - Example:
   {"cmd":"scheduleTask","args":{"id":12345,"ts":"08:00"}}

4) `addSubtasks`
 - Purpose: append multiple subtasks to a parent task
 - Args schema:
   - `taskId` (number | string, required)
   - `subtasks` (array of objects `{text:string}` , required)
 - Example:
   {"cmd":"addSubtasks","args":{"taskId":12345,"subtasks":[{"text":"open doc"},{"text":"write intro"}]}}

5) `setFocus`
 - Purpose: set the focused task (and optional subtask)
 - Args schema:
   - `taskId` (number | string, required)
   - `subtaskId` (number | string, optional)
 - Example:
   {"cmd":"setFocus","args":{"taskId":12345}}

6) `createJournalEntry`
 - Purpose: create a journal entry (capture raw AI-parsed capture)
 - Args:
   - `text` (string, required)
   - `type` (string, optional — 'todo'|'note' etc.)
 - Example:
   {"cmd":"createJournalEntry","args":{"text":"Captured idea: simplify onboarding","type":"note"}}

Execution rules (proposed)
- Validation: `aiExecuteCommand` MUST validate `cmd` and `args` against the documented schema. Reject and return an error object if invalid.
- Authorization: only run when `aiSettings.masterEnabled === true`. Optionally require a separate `aiSettings.allowExecute` toggle for non-destructive commands.
- Auditing: append `{ts:Date.now(), cmd, args, result, userConfirmed:bool}` to an audit array (`aiAuditLog` in `state.js`) before or after execution.
- Confirmation: commands that create/delete or affect many items should be flagged `requiresConfirmation` in the doc; callers of `aiExecuteCommand` (UI) should surface a modal with a human-readable diff and require user approval.
- Deterministic mapping: each `cmd` maps to a single internal function (no eval or arbitrary function path). The mapping is hard-coded and minimal.

Return value
- Success: `{ok:true, cmd:'addTask', result:{...}}`
- Failure: `{ok:false, error:'validation failed: ts must match HH:MM'}`

Prompting guidance for prompts
- Include a short machine-readable subset of this doc in the system prompt (the JSON envelope and allowed `cmd` list) and instruct the model to ONLY return the JSON envelope, no extraneous text or markdown fences.

Next steps (implementation suggestions)
- Implement `aiExecuteCommand` as a small module (`src/ai_exec.js`) that does validation and maps to existing functions like `addTask()`, `saveTaskTime()`, `addSubtask()`.
- Add `aiAuditLog=[]` to `src/state.js` so audits persist in-memory and are saved if desired.
- Add minimal tests in `src/test_workflows.js` to verify validation and mapping for one or two commands.

---
File created by assistant on 2026-06-22.
