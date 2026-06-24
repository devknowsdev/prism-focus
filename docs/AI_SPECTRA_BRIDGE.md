# Focus AI Spectra Bridge

Last-Updated: 2026-06-25

## Purpose

`prism-focus` now prefers the Spectra AI request gateway for ordinary AI helper
features while preserving the previous direct Ollama/Anthropic path as a legacy
fallback.

This supports the suite boundary recorded in Beam:

```text
Spectra is the suite AI engine.
Focus owns tasks, planner state, and review/confirmation UI.
```

## Runtime path

```text
Focus AI helper -> ai_spectra_bridge.js -> AiAdapter.aiRequest() -> Spectra /api/v1/ai/request
```

The bridge is loaded after `src/ai.js`, so it wraps the existing global helpers
instead of replacing the large legacy AI service file.

## Files changed

- `src/ai_adapter_local.js`
- `src/ai_spectra_bridge.js`
- `index.html`

## What changed

`src/ai_adapter_local.js` now exposes:

```js
window.AiAdapter.aiRequest(opts)
```

It posts read-only requests to:

```http
POST /api/v1/ai/request
```

`src/ai_spectra_bridge.js` wraps:

- `aiCall()`
- `aiCallJson()`
- `dumpAiDailyPlan()`
- `dumpAiInterpret()`

## Safety boundary

The Spectra request is always sent with:

```json
{
  "sourceApp": "prism-focus",
  "riskClass": "read-only",
  "preferredMode": "local-first"
}
```

The bridge does not directly create tasks, change planner state, publish,
write files, or execute graph nodes. Existing Focus UI flows still decide when
suggestions become local state.

## Legacy fallback

The old direct provider code in `src/ai.js` is still present. It acts as a
legacy fallback when:

- Spectra is unreachable,
- Spectra returns no usable response, or
- JSON parsing fails and a legacy provider is available.

Future work can remove the direct provider path after the Spectra gateway feels
comfortable.

## Settings assumptions

The bridge respects `aiSettings.masterEnabled`.

Because existing settings UI already has a local AI daemon URL/token section,
this first bridge does not add new settings controls. It treats Spectra as enabled
unless `aiSettings.spectraEnabled === false` is set by future UI work.

Legacy fallback is enabled unless `aiSettings.legacyProviderFallback === false`
is set by future UI work.

## Local test path

1. Start Spectra's gateway:

```bash
cd ../prism-spectra
AI_FORGE_AI_GATEWAY_TOKEN="dev-local-token" npm run ai:gateway
```

2. Start Focus:

```bash
cd ../prism-focus
python3 -m http.server 8080
```

3. In Focus:

- Open Settings -> AI.
- Confirm local AI URL is `http://127.0.0.1:3000`.
- Confirm token is `dev-local-token` or the token printed by Spectra.
- Enable AI master.
- Use a low-risk AI helper such as daily plan suggestion or task parsing.

## Future work

Recommended follow-up:

```text
Focus-AI-Bridge-002 — add explicit settings controls and visible status for Spectra-first AI
```

Possible scope:

- show Spectra status alongside legacy provider status
- add explicit toggle for legacy fallback
- make local gateway setup copyable from Settings
- add a browser smoke test for `AiAdapter.aiRequest`
