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

`src/ai_spectra_settings.js` adds a visible Spectra panel and a guided setup
wizard to Settings -> AI. It does not mutate Focus tasks or planner state. It
helps the user:

- understand what Focus AI can and cannot do,
- enable or disable Spectra-first AI,
- keep legacy direct-provider fallback explicit,
- save the local Spectra gateway URL/token,
- copy a gateway startup command,
- download a Mac `.command` launcher file,
- run a health + read-only AI request smoke test from Focus,
- see provider/model/data-boundary status after a successful test,
- troubleshoot token, branch, mock-mode, and real-Ollama setup issues.

## Product behaviour

The app should not require an AI assistant to explain basic setup. The Settings
panel now starts with plain-language status:

```text
Connected / Not tested / Needs setup
```

The setup wizard has five steps:

1. Understand what Focus AI does.
2. Connect Spectra.
3. Test the connection.
4. Use AI in Focus.
5. Troubleshoot common failures.

The wizard explicitly explains the local-browser limitation: a static browser
page cannot silently start a local Node/Ollama process. The closest safe
button-driven flow is therefore:

1. Save defaults in Focus.
2. Copy or download a Spectra launcher.
3. Start/keep open the Spectra terminal window.
4. Click `Test Spectra` in Focus.
5. Enable AI features and try a safe helper.

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

1. Start Focus on this branch.

```bash
cd ~/Desktop/prism-focus
git fetch origin
git checkout spectra-focus-ai-init-20260627
python3 -m http.server 8080
```

2. In Focus:

- Open Settings -> AI.
- Click `Open AI setup wizard`.
- Click `Use dev defaults`.
- Use `Copy mock command` or `Download launcher`.
- Start Spectra and keep the terminal open.
- Click `Test Spectra`.
- Enable AI features.
- Use a low-risk AI helper such as daily plan suggestion or journal interpretation.

3. Mock Spectra command used by the app:

```bash
cd ~/Desktop
if [ ! -d prism-spectra ]; then git clone https://github.com/devknowsdev/prism-spectra.git; fi
cd prism-spectra
git fetch origin
git checkout spectra-focus-ai-init-20260627
npm install
AI_FORGE_AI_GATEWAY_TOKEN="dev-local-token" npm run ai:gateway
```

4. Real local Ollama command used by the app:

```bash
cd ~/Desktop
if [ ! -d prism-spectra ]; then git clone https://github.com/devknowsdev/prism-spectra.git; fi
cd prism-spectra
git fetch origin
git checkout spectra-focus-ai-init-20260627
npm install
AI_FORGE_AI_GATEWAY_TOKEN="dev-local-token" AI_FORGE_MOCK_EXECUTORS=0 npm run ai:gateway
```

## Future work

Recommended follow-up:

```text
Focus-AI-Bridge-003 — add browser smoke test for Settings -> AI Spectra panel and first AI helper action
```

Possible scope:

- verify the setup wizard in a browser test,
- remove duplicate legacy local-daemon controls from the Ollama card,
- add a small visible status badge in the header Assistant menu,
- create a packaged local launcher/app so setup can eventually become true one-click,
- remove direct provider fallback after Spectra is comfortable.
