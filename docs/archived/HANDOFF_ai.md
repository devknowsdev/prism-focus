# ADHDashboard — Handoff: AI Integration Layer

**For the implementing Claude. Implement HANDOFF_task_scope_and_dump.md
and HANDOFF_day_wizard.md before this. This is Phase 4.**

**Target: all prior tests still passing + new WF31 block green.
AI features degrade gracefully to zero — no AI = app works exactly
as before.**

---

## Guiding principle

Every AI-enhanced feature must have a non-AI fallback that works
without any configuration. AI is a layer on top, never a dependency.
The app is local-first; the AI layer is cloud-optional.

---

## What AI does in this app

Six specific integration points. Nothing else. No chat window,
no AI dashboard, no general-purpose assistant interface.

| Point | Trigger | Input | Output |
|-------|---------|-------|--------|
| NL task capture | User types natural language in Dump or wizard | Raw text | Parsed task fields |
| Wizard personalisation | Day start wizard, after energy check | Energy, schedule, avoidance | One personalised sentence |
| Task breakdown | "Break it down" button on any task | Task title + category | Suggested subtask list |
| Day-end reflection prompt | Debrief wizard, how-did-it-go step | Today's activity summary | One focused question |
| Carry-over insight | Debrief wizard, carry-over step | Incomplete tasks + patterns | One nudge sentence |
| Weekly pattern nudge | Once per week, if enough data | 2+ weeks of task/energy data | One pattern observation |

All six return `null` on any failure. Callers show a non-AI fallback UI
when they receive null.

---

## Provider architecture

Two providers, one interface. A third-party provider can be added later
by implementing the same interface.

```
aiCall(systemPrompt, userPrompt, opts)
    │
    ├── if Ollama enabled and reachable → OllamaProvider
    │       └── POST http://localhost:11434/api/generate
    │
    ├── elif Anthropic key configured → AnthropicProvider
    │       └── POST https://api.anthropic.com/v1/messages
    │
    └── else → null (degrade gracefully)
```

Provider priority is user-configurable (default: Ollama first, then
Anthropic). This respects the local-first principle — if Ollama is
running, data stays on device.

---

<content preserved in archived copy>
