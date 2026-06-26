# Focus AI Spectra Bridge

Last-Updated: 2026-06-27

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
- `src/ai_spectra_settings.js`
- `index.html`

## What changed

`src/ai_adapter_local.js` exposes:

```js
window.AiAdapter.aiRequest(opts)
window.AiAdapter.health()
window.AiAdapter.testAiRequest()
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

`src/ai_spectra_settings.js` adds a visible Spectra panel to Settings -> AI. It
does not mutate Focus tasks or planner state. It only helps the user:

- enable or disable Spectra-first AI,
- keep legacy direct-provider fallback explicit,
- save the local Spectra gateway URL/token,
- copy a gateway startup command,
- run a health + read-only AI request smoke test from Focus.

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

The fallback is now visible in Settings -> AI as `Allow legacy provider fallback
if Spectra is unavailable`. Future work can remove the direct provider path
after the Spectra gateway feels comfortable.

## Settings assumptions

The bridge respects `aiSettings.masterEnabled`.

Spectra-first mode is enabled by default unless `aiSettings.spectraEnabled ===
false`. Legacy fallback is enabled by default unless
`aiSettings.legacyProviderFallback === false`.

The local gateway URL/token are stored in browser localStorage:

```text
adhd4_local_ai_url
adhd4_local_ai_token
```

## Local test path

1. Start Spectra's mock gateway to prove the bridge:

```bash
cd ../prism-spectra
AI_FORGE_AI_GATEWAY_TOKEN="dev-local-token" npm run ai:gateway
```

2. Or start Spectra with real local Ollama executors:

```bash
cd ../prism-spectra
AI_FORGE_AI_GATEWAY_TOKEN="dev-local-token" AI_FORGE_MOCK_EXECUTORS=0 npm run ai:gateway
```

3. Start Focus:

```bash
cd ../prism-focus
python3 -m http.server 8080
```

4. In Focus:

- Open Settings -> AI.
- Click `Use dev defaults`.
- Click `Test Spectra`.
- Enable AI master.
- Use a low-risk AI helper such as daily plan suggestion or journal interpretation.

## Future work

Recommended follow-up:

```text
Focus-AI-Bridge-003 — add browser smoke test for Settings -> AI Spectra panel and first AI helper action
```

Possible scope:

- verify the settings panel in a browser test,
- remove duplicate legacy local-daemon controls from the Ollama card,
- add a small visible status badge in the header Assistant menu,
- remove direct provider fallback after Spectra is comfortable.
