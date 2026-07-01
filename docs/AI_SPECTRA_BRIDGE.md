# Focus AI Spectra Bridge

Last-Updated: 2026-07-01

## Purpose

`prism-focus` prefers the Spectra AI request gateway for ordinary AI helper features while preserving the previous direct Ollama/Anthropic path as a visible legacy fallback.

This supports the suite boundary recorded in Beam:

```text
Spectra is the suite AI engine.
Focus owns tasks, planner state, and review/confirmation UI.
```

## Runtime path

```text
Focus AI helper/chat
-> AiAdapter.aiRequest()
-> Spectra /api/v1/ai/request
-> Spectra provider routing
-> Focus review UI
-> user clicks Apply before local task/planner writes
```

The bridge is loaded after `src/ai.js`, so it wraps existing global helpers instead of replacing the large legacy AI service file. Follow-up hardening patches are loaded after the original Spectra settings/chat scripts.

## Active branches before PR

```text
Focus:   devknowsdev/prism-focus:spectra-focus-ai-init-20260627
Spectra: devknowsdev/prism-spectra:main
```

Do not open the Focus PR until local browser validation is clean in mock mode and light real Ollama mode.

## Current local model stack

Use the installed, validated local stack before asking the user to download larger models:

```text
general/planner/reasoner: qwen3.5:9b
classifier/fallback:      qwen3:1.7b
coder:                    qwen2.5-coder:7b
```

Stale references to `qwen3:8b`, `qwen3:9b`, or a Spectra feature branch should be treated as setup-copy bugs unless source is deliberately changed and revalidated.

## Files changed in the Focus bridge slice

- `src/ai_adapter_local.js`
- `src/ai_spectra_bridge.js`
- `src/ai_chat_spectra_bridge.js`
- `src/ai_chat_repaint_patch.js`
- `src/ai_spectra_settings.js`
- `src/ai_spectra_assistant_instruction.js`
- `src/ai_spectra_hardening_patch.js`
- `index.html`
- `docs/AI_SPECTRA_BRIDGE.md`

## Spectra-side companion hardening

The companion Spectra branch adds gateway support needed by the Focus hardening UI:

- preserves advisory `aiRole` values such as `classifier` and `planner` in `/api/v1/ai/request` validation,
- supports a small `maxOutputTokens` cap for lightweight smoke tests,
- lets Settings -> Test Spectra prefer the classifier route (`qwen3:1.7b`) instead of a full planner prompt,
- exposes `GET /api/v1/local/status` for local resource status.

The local status endpoint is read-only and is intended for local browser validation safety. It reports:

- gateway mode: mock or real,
- disk free,
- `.ollama` and `.ollama/models` storage size,
- Spectra `.demo` runtime size,
- macOS memory pressure where available,
- loaded Ollama models from `ollama ps`,
- top CPU process rows,
- thermal status from `pmset -g therm` where available.

## Product behaviour

The Settings -> AI panel starts with plain-language connection status:

```text
Connected / Not tested / Gateway offline / Provider failed
```

It now also shows a local resource/status block. The resource block is intentionally visible before heavier real-model validation because real local Ollama runs can use several GB of RAM/GPU and generate heat even when Spectra `.demo` files are tiny.

The setup wizard has five steps:

1. Understand what Focus AI does.
2. Connect Spectra.
3. Test the connection.
4. Use AI in Focus.
5. Troubleshoot common failures.

The wizard explicitly explains the local-browser limitation: a static browser page cannot silently start a local Node/Ollama process. The safe flow is therefore:

1. Save defaults in Focus.
2. Copy or download a Spectra launcher.
3. Start and keep open the Spectra terminal window.
4. Click `Test Spectra` in Focus.
5. Refresh resources before heavier real-mode prompts.
6. Enable AI features and try a safe helper.

## Safety boundary

The Spectra request is always read-only:

```json
{
  "sourceApp": "prism-focus",
  "riskClass": "read-only",
  "preferredMode": "local-first"
}
```

Focus may include advisory routing hints such as:

```json
{
  "aiRole": "planner",
  "maxOutputTokens": 900
}
```

These hints do not give Focus provider ownership. Spectra still owns model routing, provider availability checks, budget checks, and final execution.

The bridge does not directly create tasks, change planner state, publish, write files, or execute graph nodes. Chat/day-dump suggestions become local Focus state only after the user clicks `Apply proposed tasks`.

## Chat attachments

Chat attachments are intentionally text-only / blocked for now. If files are selected, Focus warns that full local daemon file API support is still needed and sends text only.

Do not expand direct Focus-to-file-daemon or Focus-to-Ollama attachment handling in this branch.

## Real-mode response handling

Spectra PR #30 fixed the executor-side cause of empty/unstructured Focus chat
responses by surfacing Focus instructions and using schema-constrained Ollama
JSON. Final browser validation against merged Spectra `main` rendered:

- a real `ollama / qwen3.5:9b` reply,
- a structured 10-minute task proposal,
- visible `Apply proposed tasks` and `Dismiss` controls,
- no browser console errors.

Apply was not clicked, so validation did not import or mutate Focus tasks. The
hardening patch retains a targeted diagnostic if a provider ever returns an
empty body:

```text
Spectra routed this through <provider> / <model>, but returned an empty response body. I did not create or change any Focus tasks. For debugging, open DevTools and inspect window.lastSpectraEmptyResponse.
```

Focus also stores the latest raw gateway response for debugging:

```js
window.lastSpectraChatResponse
window.lastSpectraEmptyResponse
window.lastSpectraResourceStatus
```

## Legacy fallback

The old direct provider code in `src/ai.js` is still present. It acts as a visible fallback when:

- Spectra is unreachable,
- Spectra returns no usable response,
- JSON parsing fails and a legacy provider is available.

The fallback is visible in Settings -> AI as `Allow legacy provider fallback if Spectra is unavailable`. Do not expand this fallback into primary architecture. Future work can remove the direct provider path after the Spectra gateway feels comfortable.

## Settings and local storage assumptions

The bridge respects `aiSettings.masterEnabled`.

Spectra-first mode is enabled by default unless `aiSettings.spectraEnabled === false`. Legacy fallback is enabled by default unless `aiSettings.legacyProviderFallback === false`.

The local gateway URL/token are stored in browser localStorage:

```text
adhd4_local_ai_url
adhd4_local_ai_token
```

Validated local defaults:

```js
localStorage.setItem('adhd4_local_ai_url', 'http://127.0.0.1:3000');
localStorage.setItem('adhd4_local_ai_token', 'dev-local-token');
location.reload();
```

## Local test path

1. Start Focus on this branch.

```bash
cd ~/Desktop/prism-focus
git fetch origin
git checkout spectra-focus-ai-init-20260627
python3 -m http.server 4173
```

2. Start Ollama if needed.

```bash
ollama serve
```

3. Start Spectra mock mode.

```bash
cd ~/Desktop/prism-spectra
lsof -tiTCP:3000 -sTCP:LISTEN | xargs -r kill
git fetch origin
git checkout main
git pull --ff-only origin main
npm install

AI_FORGE_AI_GATEWAY_TOKEN="dev-local-token" \
AI_FORGE_MOCK_EXECUTORS=1 \
npm run ai:gateway
```

4. Start Spectra real mode with a fresh DB/workdir.

```bash
cd ~/Desktop/prism-spectra
lsof -tiTCP:3000 -sTCP:LISTEN | xargs -r kill
git fetch origin
git checkout main
git pull --ff-only origin main
npm install

RUN_ID="$(date +%Y%m%d%H%M%S)"

AI_FORGE_AI_GATEWAY_TOKEN="dev-local-token" \
AI_FORGE_MOCK_EXECUTORS=0 \
AI_FORGE_AI_GATEWAY_DB=".demo/ai-gateway-real-${RUN_ID}.db" \
AI_FORGE_AI_GATEWAY_WORKDIR=".demo/ai-gateway-real-work-${RUN_ID}" \
OLLAMA_MODEL_PLANNER="qwen3.5:9b" \
OLLAMA_MODEL_REASONER="qwen3.5:9b" \
OLLAMA_MODEL_CLASSIFIER="qwen3:1.7b" \
OLLAMA_MODEL_FALLBACK="qwen3:1.7b" \
OLLAMA_MODEL_CODER="qwen2.5-coder:7b" \
npm run ai:gateway
```

5. In Focus:

- Open `http://localhost:4173/`.
- Open Settings -> AI.
- Click `Use dev defaults`.
- Click `Test Spectra`.
- Check the local resource/status block.
- Try a tiny Focus Assistant prompt first.
- Then try `What can you do in this app?`.
- Then try a small day-dump scheduling prompt.
- Verify `Apply proposed tasks` creates local Focus tasks only after confirmation.

## Direct status checks

```bash
curl -i -H "x-local-token: dev-local-token" http://127.0.0.1:3000/api/v1/health
curl -s -H "x-local-token: dev-local-token" http://127.0.0.1:3000/api/v1/local/status
```

Manual resource fallback:

```bash
df -h /
du -sh ~/.ollama ~/.ollama/models 2>/dev/null
cd ~/Desktop/prism-spectra && du -sh .demo .demo/* 2>/dev/null | sort -h | tail -30
memory_pressure
ollama ps
pmset -g therm
ps -Ao pid,comm,%cpu,%mem,rss | sort -k3 -nr | head -20
```

Unload model after real testing:

```bash
ollama stop qwen3.5:9b
ollama ps
```

## Known validation status

Validated:

- Focus static app runs.
- Focus reaches Spectra `/api/v1/health`.
- Token and CORS work.
- Mock gateway request works.
- Mock Focus chat path works.
- Real Spectra gateway starts with `AI_FORGE_MOCK_EXECUTORS=0`.
- Ollama models are installed.
- `qwen3.5:9b` can load.
- Real Focus chat renders a structured reply/proposal through Ollama /
  `qwen3.5:9b` with a clean browser console.
- Proposal application remains review-first; the final real-mode check did not
  click Apply or mutate task state.

This repository has no npm build/test scripts. Use the architecture validator,
JavaScript syntax checks, and focused browser validation instead.

## Future work

Recommended follow-up:

```text
Focus-AI-Bridge-003 — add browser smoke test for Settings -> AI Spectra panel and first AI helper action
```

Possible scope:

- verify the setup wizard and resource/status block in a browser test,
- remove duplicate legacy local-daemon controls from the Ollama card,
- add a small visible status badge in the header Assistant menu,
- add a stale local gateway DB repair/reset path,
- create a packaged local launcher/app so setup can eventually become true one-click,
- remove direct provider fallback after Spectra is comfortable.
