/*
MODULE: ai_spectra_hardening_patch.js
LAYER: services/ui patch
PURPOSE: Add low-risk Focus/Spectra hardening without expanding Focus provider ownership.
USES: ai_adapter_local.js, ai_chat_spectra_bridge.js, ai_spectra_settings.js
INVARIANTS: Requests stay read-only; Focus only applies proposed tasks after visible user action.
LAST_STABILIZED: 2026-06-29
*/
(function(){
  const CHAT_STORAGE_KEY = 'adhd4_spectra_chat_state_v1';
  const CURRENT_SPECTRA_BRANCH = 'focus-resource-status-20260629';
  const DEFAULT_SPECTRA_URL = 'http://127.0.0.1:3000';
  const DEFAULT_SPECTRA_TOKEN = 'dev-local-token';
  const CURRENT_MODELS = {
    planner: 'qwen3.5:9b',
    reasoner: 'qwen3.5:9b',
    classifier: 'qwen3:1.7b',
    fallback: 'qwen3:1.7b',
    coder: 'qwen2.5-coder:7b',
  };

  const MOCK_GATEWAY_COMMAND = `cd ~/Desktop
if [ ! -d prism-spectra ]; then git clone https://github.com/devknowsdev/prism-spectra.git; fi
cd prism-spectra
git fetch origin
git checkout ${CURRENT_SPECTRA_BRANCH}
npm install
AI_FORGE_AI_GATEWAY_TOKEN="${DEFAULT_SPECTRA_TOKEN}" \
AI_FORGE_MOCK_EXECUTORS=1 \
npm run ai:gateway`;

  const REAL_OLLAMA_GATEWAY_COMMAND = `cd ~/Desktop
if [ ! -d prism-spectra ]; then git clone https://github.com/devknowsdev/prism-spectra.git; fi
cd prism-spectra
git fetch origin
git checkout ${CURRENT_SPECTRA_BRANCH}
npm install
RUN_ID="$(date +%Y%m%d%H%M%S)"
AI_FORGE_AI_GATEWAY_TOKEN="${DEFAULT_SPECTRA_TOKEN}" \
AI_FORGE_MOCK_EXECUTORS=0 \
AI_FORGE_AI_GATEWAY_DB=".demo/ai-gateway-real-\${RUN_ID}.db" \
AI_FORGE_AI_GATEWAY_WORKDIR=".demo/ai-gateway-real-work-\${RUN_ID}" \
OLLAMA_MODEL_PLANNER="${CURRENT_MODELS.planner}" \
OLLAMA_MODEL_REASONER="${CURRENT_MODELS.reasoner}" \
OLLAMA_MODEL_CLASSIFIER="${CURRENT_MODELS.classifier}" \
OLLAMA_MODEL_FALLBACK="${CURRENT_MODELS.fallback}" \
OLLAMA_MODEL_CODER="${CURRENT_MODELS.coder}" \
npm run ai:gateway`;

  const OLLAMA_CHECK_COMMAND = `ollama list
ollama pull ${CURRENT_MODELS.planner}
ollama pull ${CURRENT_MODELS.classifier}
ollama pull ${CURRENT_MODELS.coder}
ollama serve`;

  function _escape(value) {
    if (typeof esc === 'function') return esc(String(value ?? ''));
    return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function _theme(name, fallback) {
    return (typeof T !== 'undefined' && T && T[name]) || fallback;
  }

  function _buttonStyle(kind, extra) {
    if (typeof btnStyle === 'function') return btnStyle(kind, extra || '');
    return `font-size:11px;padding:5px 9px;${extra || ''}`;
  }

  function _inputStyle(extra) {
    if (typeof inputStyle === 'function') return inputStyle(extra || '');
    return extra || '';
  }

  function _ensureAiStatus() {
    if (typeof aiStatus === 'undefined' || !aiStatus) return null;
    return aiStatus;
  }

  function _friendlyError(raw, phase) {
    const text = String(raw || '').slice(0, 600);
    if (/401|403|token|unauthor/i.test(text)) return 'Token mismatch. Use dev defaults, or copy the token printed by Spectra into Focus.';
    if (/rpm budget exhausted|0\/0/i.test(text)) return 'Spectra reached a stale local RPM budget of 0/0. Restart real mode with a fresh gateway DB/workdir.';
    if (/Ollama call failed|fetch failed|ECONNREFUSED|11434/i.test(text)) return 'Spectra is running, but Ollama did not answer. Start Ollama, confirm the model is installed, or switch back to mock mode.';
    if (/Failed to fetch|NetworkError|gateway/i.test(text) && phase === 'health') return 'Focus cannot reach Spectra. Start the Spectra gateway and keep that terminal window open.';
    if (/HTTP 500/i.test(text)) return 'Spectra is running, but the selected AI provider failed. Check Ollama/provider setup or use mock mode to test the bridge.';
    return text || 'Unknown AI setup error.';
  }

  function _copyText(text, okMessage) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text).then(() => {
          if (typeof showToast === 'function') showToast(okMessage, 'ok');
        });
      }
    } catch (e) {}
    console.log(text);
    if (typeof showToast === 'function') showToast('Command printed to console', 'ok');
    return Promise.resolve();
  }

  function _downloadLauncher(command, realOllama) {
    const modeName = realOllama ? 'real-ollama' : 'mock';
    const script = `#!/bin/zsh
set -e
clear
echo "Starting Prism Spectra AI gateway (${modeName})"
echo "This window must stay open while Focus uses AI."
echo ""
${command}
`;
    const blob = new Blob([script], { type: 'text/x-shellscript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = realOllama ? 'start-prism-spectra-real-ollama.command' : 'start-prism-spectra-mock.command';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    if (typeof showToast === 'function') showToast('Launcher downloaded. See setup wizard for Mac notes.', 'ok');
  }

  function _patchAiAdapter() {
    if (!window.AiAdapter || window.AiAdapter.__spectraHardeningPatched) return;
    const baseRequest = typeof window.AiAdapter.aiRequest === 'function' ? window.AiAdapter.aiRequest.bind(window.AiAdapter) : null;
    if (baseRequest) {
      window.AiAdapter.aiRequest = async function aiRequestWithRoleMirroring(opts) {
        const input = { ...(opts || {}) };
        if (input.aiRole) input.context = { ...(input.context || {}), aiRole: input.aiRole };
        if (input.maxOutputTokens) input.context = { ...(input.context || {}), maxOutputTokens: input.maxOutputTokens };
        return await baseRequest(input);
      };
    }

    window.AiAdapter.testAiRequest = async function testAiRequestLightClassifier() {
      return await this.aiRequest({
        sourceApp: 'prism-focus',
        intent: 'focus-ai-bridge-smoke-test',
        riskClass: 'read-only',
        preferredMode: 'local-first',
        aiRole: 'classifier',
        maxOutputTokens: 80,
        record: false,
        input: {
          prompt: 'Reply with one short sentence confirming the Prism Focus AI bridge is connected.',
        },
        context: {
          appSurface: 'settings',
          purpose: 'manual connection test',
          aiRole: 'classifier',
          maxOutputTokens: 80,
        },
      });
    };

    window.AiAdapter.resourceStatus = async function resourceStatus() {
      const token = typeof this.localToken === 'function' ? this.localToken() : DEFAULT_SPECTRA_TOKEN;
      const base = typeof this.apiBaseUrl === 'function'
        ? this.apiBaseUrl()
        : `${(typeof this.localBaseUrl === 'function' ? this.localBaseUrl() : DEFAULT_SPECTRA_URL).replace(/\/$/, '')}/api/v1`;
      const res = await fetch(base + '/local/status', { method: 'GET', headers: token ? { 'x-local-token': token } : {} });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ${text}`);
      }
      return await res.json();
    };

    window.AiAdapter.__spectraHardeningPatched = true;
  }

  function _summarizeResourceStatus(status) {
    if (!status || !status.ok) return 'Resource monitor did not return a usable status.';
    const parts = [];
    if (status.gateway && status.gateway.mode) parts.push(`gateway: ${status.gateway.mode}`);
    if (status.disk && status.disk.availableHuman) parts.push(`disk free: ${status.disk.availableHuman}`);
    if (status.storage && status.storage.ollamaModels && status.storage.ollamaModels.human) parts.push(`Ollama models: ${status.storage.ollamaModels.human}`);
    if (status.storage && status.storage.spectraDemo && status.storage.spectraDemo.human) parts.push(`Spectra .demo: ${status.storage.spectraDemo.human}`);
    if (status.memory && status.memory.freePercent != null) parts.push(`memory free: ${status.memory.freePercent}%`);
    if (status.ollama && Array.isArray(status.ollama.loadedModels)) parts.push(`loaded Ollama: ${status.ollama.loadedModels.length ? status.ollama.loadedModels.join(', ') : 'none'}`);
    if (status.process && status.process.topCpu && Array.isArray(status.process.topCpu.rows) && status.process.topCpu.rows[0]) {
      const top = status.process.topCpu.rows[0];
      parts.push(`top CPU: ${top.command} ${top.cpuPercent}%`);
    }
    if (status.thermal && status.thermal.available) parts.push(status.thermal.warning ? 'thermal: warning' : 'thermal: no warning');
    return parts.join(' · ') || 'Resource monitor returned, but no summary fields were available.';
  }

  window.settingsRefreshSpectraResourceStatus = async function settingsRefreshSpectraResourceStatus() {
    _patchAiAdapter();
    const status = _ensureAiStatus();
    if (!window.AiAdapter || typeof window.AiAdapter.resourceStatus !== 'function') {
      if (status) status.spectraResourceSummary = 'Spectra resource endpoint is not available in this gateway build yet.';
      if (typeof showToast === 'function') showToast('Spectra resource endpoint unavailable', 'warn');
      if (typeof render === 'function') render();
      return;
    }
    try {
      if (typeof showToast === 'function') showToast('Checking local resources…', 'ok');
      const resource = await window.AiAdapter.resourceStatus();
      window.lastSpectraResourceStatus = resource;
      if (status) {
        status.spectraResourceCheckedAt = new Date().toISOString();
        status.spectraResourceSummary = _summarizeResourceStatus(resource);
      }
      if (typeof showToast === 'function') showToast('Resource status updated', 'ok');
    } catch (e) {
      if (status) status.spectraResourceSummary = _friendlyError(e && e.message ? e.message : String(e), 'health');
      if (typeof showToast === 'function') showToast('Resource status failed', 'warn');
    }
    if (typeof render === 'function') render();
  };

  window.settingsCopySpectraGatewayCommand = async function settingsCopySpectraGatewayCommand(realOllama) {
    return await _copyText(realOllama ? REAL_OLLAMA_GATEWAY_COMMAND : MOCK_GATEWAY_COMMAND, 'Spectra gateway command copied');
  };

  window.settingsDownloadSpectraLauncher = function settingsDownloadSpectraLauncher(realOllama) {
    _downloadLauncher(realOllama ? REAL_OLLAMA_GATEWAY_COMMAND : MOCK_GATEWAY_COMMAND, !!realOllama);
  };

  window.settingsTestSpectra = async function settingsTestSpectraHardened() {
    _patchAiAdapter();
    const status = _ensureAiStatus();
    if (!window.AiAdapter || typeof window.AiAdapter.health !== 'function') {
      if (status) {
        status.spectra = 'gateway-error';
        status.spectraError = 'Focus adapter unavailable';
      }
      if (typeof showToast === 'function') showToast('Spectra adapter unavailable', 'warn');
      return;
    }

    let health = null;
    try {
      if (typeof showToast === 'function') showToast('Testing Spectra gateway…', 'ok');
      health = await window.AiAdapter.health();
      if (!health || !health.ok || !health.available) throw new Error('gateway did not report available');
    } catch (e) {
      if (status) {
        status.spectraService = '';
        status.spectraMock = false;
        status.spectra = 'gateway-error';
        status.spectraError = _friendlyError(e && e.message ? e.message : String(e), 'health');
      }
      if (typeof showToast === 'function') showToast('Spectra gateway is not reachable', 'warn');
      if (typeof render === 'function') render();
      return;
    }

    let resource = null;
    try {
      if (typeof window.AiAdapter.resourceStatus === 'function') {
        resource = await window.AiAdapter.resourceStatus();
        window.lastSpectraResourceStatus = resource;
      }
    } catch (e) {
      resource = { ok: false, error: e && e.message ? e.message : String(e) };
    }

    try {
      const requestResult = typeof window.AiAdapter.testAiRequest === 'function'
        ? await window.AiAdapter.testAiRequest()
        : null;
      if (!requestResult || !requestResult.ok) throw new Error((requestResult && requestResult.error) || 'AI request failed');

      if (status) {
        status.spectra = 'ok';
        status.spectraService = health.service || 'prism-spectra';
        status.spectraMock = health.mockExecutors === true;
        status.spectraProvider = requestResult.provider || 'unknown';
        status.spectraModel = requestResult.model || '';
        status.spectraBoundary = requestResult.dataBoundary || '';
        status.spectraResourceCheckedAt = new Date().toISOString();
        status.spectraResourceSummary = resource && resource.ok ? _summarizeResourceStatus(resource) : 'Resource endpoint unavailable; use the manual resource commands before heavy real-mode testing.';
        delete status.spectraError;
      }

      const provider = requestResult.provider ? ` via ${requestResult.provider}` : '';
      if (typeof showToast === 'function') showToast(`Spectra connected${provider}${health.mockExecutors ? ' (mock mode)' : ''}`, 'ok');
    } catch (e) {
      if (status) {
        status.spectraService = health.service || 'prism-spectra';
        status.spectraMock = health.mockExecutors === true;
        status.spectraProvider = 'ollama';
        status.spectraModel = status.spectraModel || CURRENT_MODELS.classifier;
        status.spectraBoundary = 'local';
        status.spectra = 'provider-error';
        status.spectraError = _friendlyError(e && e.message ? e.message : String(e), 'request');
        status.spectraResourceSummary = resource && resource.ok ? _summarizeResourceStatus(resource) : status.spectraResourceSummary;
      }
      if (typeof showToast === 'function') showToast('Spectra is running, but the AI provider failed', 'warn');
    }

    if (typeof render === 'function') render();
  };

  function _renderResourceBlock() {
    const status = _ensureAiStatus();
    const summary = status && status.spectraResourceSummary
      ? status.spectraResourceSummary
      : 'Not checked yet. Run Test Spectra or Refresh resources before heavier real Ollama prompts.';
    const checked = status && status.spectraResourceCheckedAt ? `Checked: ${status.spectraResourceCheckedAt}` : '';
    return `<div style="margin-top:8px;padding:9px;background:${_theme('surface3', '#f6f7f8')};border:1px solid ${_theme('border', '#ddd')};border-radius:9px;font-size:11px;color:${_theme('muted', '#666')};line-height:1.45;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;">
        <b style="color:${_theme('text', '#111')};">Local resource/status monitor</b>
        <button onclick="settingsRefreshSpectraResourceStatus()" style="${_buttonStyle('default','font-size:11px;padding:4px 8px;')}">Refresh resources</button>
      </div>
      <div>${_escape(summary)}</div>
      ${checked ? `<div style="font-size:10px;color:${_theme('muted2', '#777')};margin-top:4px;">${_escape(checked)}</div>` : ''}
      <details style="margin-top:6px;"><summary style="cursor:pointer;color:${_theme('text', '#111')};font-weight:700;">Manual resource commands</summary><pre style="white-space:pre-wrap;word-break:break-word;background:${_theme('surface2', '#fff')};border:1px solid ${_theme('border', '#ddd')};border-radius:8px;padding:7px;font-size:10px;line-height:1.4;">df -h /
du -sh ~/.ollama ~/.ollama/models 2&gt;/dev/null
cd ~/Desktop/prism-spectra &amp;&amp; du -sh .demo .demo/* 2&gt;/dev/null | sort -h | tail -30
memory_pressure
ollama ps
pmset -g therm
ps -Ao pid,comm,%cpu,%mem,rss | sort -k3 -nr | head -20</pre></details>
    </div>`;
  }

  function _patchSettingsHtml() {
    if (typeof window.renderSettingsModalHtml !== 'function' || window.renderSettingsModalHtml.__spectraResourceWrapped) return;
    const base = window.renderSettingsModalHtml;
    window.renderSettingsModalHtml = function renderSettingsModalHtmlWithSpectraResources() {
      let html = base.apply(this, arguments);
      html = String(html)
        .replaceAll('qwen3:9b', CURRENT_MODELS.planner)
        .replaceAll('qwen3:8b', CURRENT_MODELS.planner)
        .replaceAll('spectra-focus-ai-init-20260627', CURRENT_SPECTRA_BRANCH)
        .replaceAll('ollama pull qwen3.5:9b\nollama serve', OLLAMA_CHECK_COMMAND)
        .replaceAll('ollama pull qwen3:9b\nollama serve', OLLAMA_CHECK_COMMAND);

      const marker = 'Mock mode proves the bridge works. Real Ollama mode requires Ollama running and Spectra started with <code>AI_FORGE_MOCK_EXECUTORS=0</code>.</div>';
      if (html.includes(marker) && !html.includes('Local resource/status monitor')) {
        html = html.replace(marker, marker + _renderResourceBlock());
      }
      return html;
    };
    window.renderSettingsModalHtml.__spectraResourceWrapped = true;
  }

  function _nowIso(){
    try { return new Date().toISOString(); } catch (e) { return ''; }
  }

  function _newId(prefix){
    return `${prefix || 'chat'}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function _saveChatState(){
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify({
        conversations: Array.isArray(chatConversations) ? chatConversations : [],
        messages: chatMessages || {},
        activeConversationId: activeConversationId || null,
      }));
    } catch (e) {
      console.warn('Failed to save Spectra chat state', e);
    }
  }

  function _ensureConversation(title){
    if (activeConversationId) {
      chatMessages[activeConversationId] = chatMessages[activeConversationId] || [];
      return activeConversationId;
    }
    const id = _newId('conv');
    const conv = {
      id,
      title: String(title || 'New Focus chat').slice(0, 80),
      created_at: _nowIso(),
      local_only: true,
    };
    chatConversations = [conv, ...(Array.isArray(chatConversations) ? chatConversations : [])];
    chatMessages[id] = chatMessages[id] || [];
    activeConversationId = id;
    _saveChatState();
    return id;
  }

  function _appendChatMessage(convId, message){
    if (!convId) return null;
    chatMessages[convId] = chatMessages[convId] || [];
    const msg = { id: _newId('msg'), created_at: _nowIso(), ...message };
    chatMessages[convId].push(msg);
    _saveChatState();
    return msg;
  }

  function _replaceChatMessage(convId, messageId, patch){
    const list = chatMessages[convId] || [];
    const index = list.findIndex(m => m.id === messageId);
    if (index >= 0) list[index] = { ...list[index], ...patch };
    _saveChatState();
  }

  function _extractSpectraText(result){
    if (!result) return '';
    if (typeof result === 'string') return result;
    const direct = [result.output, result.text, result.content, result.response, result.message];
    for (const item of direct) {
      if (typeof item === 'string' && item.trim()) return item;
      if (item && typeof item === 'object') {
        if (typeof item.content === 'string' && item.content.trim()) return item.content;
        if (typeof item.text === 'string' && item.text.trim()) return item.text;
        if (typeof item.output === 'string' && item.output.trim()) return item.output;
        if (item.message && typeof item.message.content === 'string' && item.message.content.trim()) return item.message.content;
      }
    }
    if (result.data && typeof result.data === 'object') {
      if (typeof result.data.response === 'string' && result.data.response.trim()) return result.data.response;
      if (typeof result.data.text === 'string' && result.data.text.trim()) return result.data.text;
    }
    if (result.structuredResponse && typeof result.structuredResponse === 'object') {
      if (typeof result.structuredResponse.reply === 'string' && result.structuredResponse.reply.trim()) return JSON.stringify(result.structuredResponse);
      if (typeof result.structuredResponse.response === 'string' && result.structuredResponse.response.trim()) return result.structuredResponse.response;
    }
    return '';
  }

  function _parseAssistantPayload(raw){
    if (!raw) return { reply: '', proposedTasks: [], proposedSchedule: [], followUpQuestion: '' };
    if (typeof raw === 'object') return _normalizeAssistantPayload(raw);
    const text = String(raw || '').trim();
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    try { return _normalizeAssistantPayload(JSON.parse(cleaned)); } catch (e) {}
    const match = cleaned.match(/(\{[\s\S]*\})/);
    if (match) {
      try { return _normalizeAssistantPayload(JSON.parse(match[1])); } catch (e) {}
    }
    return { reply: cleaned, proposedTasks: [], proposedSchedule: [], followUpQuestion: '' };
  }

  function _normalizeTime(raw){
    const str = String(raw || '').trim();
    if (!str) return '';
    if (typeof normalizeTaskTime === 'function') return normalizeTaskTime(str) || '';
    return /^\d{1,2}:\d{2}$/.test(str) ? str.padStart(5, '0') : '';
  }

  function _normalizeMins(raw){
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.max(5, Math.min(480, Math.round(n)));
  }

  function _normalizeTaskLike(item){
    if (!item || typeof item !== 'object') return null;
    const text = String(item.text || item.title || item.task || '').trim();
    if (!text) return null;
    return {
      text,
      ts: _normalizeTime(item.ts || item.start || item.time),
      estimatedMins: _normalizeMins(item.estimatedMins || item.durationMins || item.minutes),
      note: String(item.note || item.reason || '').trim(),
      taskScope: String(item.taskScope || item.scope || 'day').toLowerCase() === 'project' ? 'project' : 'day',
    };
  }

  function _normalizeAssistantPayload(payload){
    const obj = payload && typeof payload === 'object' ? payload : {};
    const tasks = Array.isArray(obj.proposedTasks) ? obj.proposedTasks : [];
    const schedule = Array.isArray(obj.proposedSchedule) ? obj.proposedSchedule : [];
    const scheduleTasks = schedule.map(block => _normalizeTaskLike({
      text: block.text || block.title || block.task,
      ts: block.start || block.ts,
      estimatedMins: block.estimatedMins || block.durationMins || block.minutes,
      note: block.note || (block.end ? `Scheduled until ${block.end}` : ''),
      taskScope: 'day',
    })).filter(Boolean);
    return {
      reply: String(obj.reply || obj.response || obj.message || '').trim(),
      proposedTasks: tasks.map(_normalizeTaskLike).filter(Boolean),
      proposedSchedule: scheduleTasks,
      followUpQuestion: String(obj.followUpQuestion || '').trim(),
    };
  }

  function _emptyResponseMessage(result) {
    const provider = result && result.provider ? result.provider : 'provider';
    const model = result && result.model ? ` / ${result.model}` : '';
    return `Spectra routed this through ${provider}${model}, but returned an empty response body. I did not create or change any Focus tasks. For debugging, open DevTools and inspect window.lastSpectraEmptyResponse.`;
  }

  function _patchChatSender() {
    if (typeof window.sendChatPrompt !== 'function' || window.sendChatPrompt.__spectraEmptyResponsePatched) return;
    window.sendChatPrompt = async function sendSpectraChatPromptHardened(){
      const text = String(chatComposerText || '').trim();
      if (!text) return;
      _patchAiAdapter();
      if (!window.AiAdapter || typeof window.AiAdapter.aiRequest !== 'function') {
        return showToast('Spectra AI adapter unavailable', 'warn');
      }

      if (Array.isArray(chatComposerAttachments) && chatComposerAttachments.length) {
        showToast('Chat attachments still need the full local daemon; sending text only.', 'warn');
      }

      const convId = _ensureConversation(text);
      const history = (chatMessages[convId] || [])
        .filter(m => !m.pending)
        .slice(-8)
        .map(m => ({ role: m.role, text: m.response || m.prompt || '' }));

      chatComposerText = '';
      chatComposerAttachments = [];
      _appendChatMessage(convId, { role: 'user', prompt: text, attachments: '[]' });
      const pending = _appendChatMessage(convId, { role: 'assistant', response: 'Thinking…', pending: true, provider: 'spectra', model: '', attachments: '[]' });
      if (typeof render === 'function') render();

      try {
        showToast('Sending to Spectra…', 'ok');
        const result = await window.AiAdapter.aiRequest({
          sourceApp: 'prism-focus',
          intent: 'focus-chat-message',
          riskClass: 'read-only',
          preferredMode: 'local-first',
          aiRole: 'planner',
          maxOutputTokens: 900,
          input: {
            prompt: text,
            history,
            instruction: typeof FOCUS_ASSISTANT_INSTRUCTION !== 'undefined' ? FOCUS_ASSISTANT_INSTRUCTION : undefined,
            currentFocusState: {
              taskCount: Array.isArray(tasks) ? tasks.length : 0,
              openTaskCount: Array.isArray(tasks) ? tasks.filter(t => !t.done).length : 0,
              currentFocusTask: typeof getTask === 'function' && focusTaskId ? (getTask(focusTaskId)?.text || '') : '',
            },
          },
          context: {
            feature: 'focus-chat',
            conversationId: convId,
            appSurface: 'chat-modal',
            aiRole: 'planner',
            maxOutputTokens: 900,
            allowedCapabilities: ['explain-focus-app-capabilities','parse-day-dump','propose-tasks','propose-schedule','break-down-task','prioritise-day'],
            disallowedCapabilities: ['run-terminal-command', 'silent-task-write', 'silent-planner-write'],
          },
        });

        window.lastSpectraChatResponse = result;
        if (!result || result.ok === false) throw new Error((result && result.error) || 'Spectra request failed');

        const rawText = result.structuredResponse || _extractSpectraText(result);
        const payload = _parseAssistantPayload(rawText);
        const replyParts = [];
        if (payload.reply) replyParts.push(payload.reply);
        if (payload.followUpQuestion) replyParts.push(payload.followUpQuestion);
        let reply = replyParts.join('\n\n').trim() || _extractSpectraText(result).trim();
        if (!reply) {
          window.lastSpectraEmptyResponse = result;
          console.warn('Spectra returned an empty assistant response body', result);
          reply = _emptyResponseMessage(result);
        }

        const proposal = {
          proposedTasks: payload.proposedTasks || [],
          proposedSchedule: payload.proposedSchedule || [],
        };
        const hasProposal = proposal.proposedTasks.length || proposal.proposedSchedule.length;
        _replaceChatMessage(convId, pending.id, {
          response: reply,
          pending: false,
          proposal: hasProposal ? proposal : null,
          provider: result.provider || 'spectra',
          model: result.model || '',
          attachments: '[]',
        });
        showToast('AI responded', 'ok');
      } catch (e) {
        console.error('sendSpectraChatPrompt error', e);
        _replaceChatMessage(convId, pending.id, {
          response: 'Chat failed through Spectra: ' + (e && e.message ? e.message : String(e)),
          pending: false,
          provider: 'error',
          model: '',
          attachments: '[]',
        });
        showToast('Chat failed through Spectra', 'warn');
      }

      if (typeof render === 'function') render();
    };
    window.sendChatPrompt.__spectraEmptyResponsePatched = true;
  }

  _patchAiAdapter();
  _patchSettingsHtml();
  _patchChatSender();
  setTimeout(() => {
    _patchAiAdapter();
    _patchSettingsHtml();
    _patchChatSender();
  }, 0);
})();
