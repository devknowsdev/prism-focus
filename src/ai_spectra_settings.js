/*
MODULE: ai_spectra_settings.js
LAYER: services/ui patch
PURPOSE: Make Spectra-first AI visible and easy to initialise from Focus settings.
USES: ai.js settings globals, ai_adapter_local.js, render_modals.js
INVARIANTS: Spectra requests stay read-only; no task/planner mutation happens here.
LAST_STABILIZED: 2026-06-27
*/
(function(){
  const DEFAULT_SPECTRA_URL = 'http://127.0.0.1:3000';
  const DEFAULT_SPECTRA_TOKEN = 'dev-local-token';
  const SPECTRA_BRANCH = 'spectra-focus-ai-init-20260627';
  const GATEWAY_COMMAND = 'cd ~/Desktop\nif [ ! -d prism-spectra ]; then git clone https://github.com/devknowsdev/prism-spectra.git; fi\ncd prism-spectra\ngit fetch origin\ngit checkout ' + SPECTRA_BRANCH + '\nnpm install\nAI_FORGE_AI_GATEWAY_TOKEN="dev-local-token" npm run ai:gateway';
  const REAL_OLLAMA_GATEWAY_COMMAND = 'cd ~/Desktop\nif [ ! -d prism-spectra ]; then git clone https://github.com/devknowsdev/prism-spectra.git; fi\ncd prism-spectra\ngit fetch origin\ngit checkout ' + SPECTRA_BRANCH + '\nnpm install\nAI_FORGE_AI_GATEWAY_TOKEN="dev-local-token" AI_FORGE_MOCK_EXECUTORS=0 npm run ai:gateway';

  function _esc(value) {
    if (typeof esc === 'function') return esc(String(value ?? ''));
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function _ensureSpectraSettings() {
    if (typeof aiSettings === 'undefined' || !aiSettings) return;
    if (aiSettings.spectraEnabled == null) aiSettings.spectraEnabled = true;
    if (aiSettings.legacyProviderFallback == null) aiSettings.legacyProviderFallback = true;
    if (typeof aiStatus !== 'undefined' && aiStatus && aiStatus.spectra == null) {
      aiStatus.spectra = 'unknown';
    }
  }

  function _loadSavedSpectraSettings() {
    if (typeof localStorage === 'undefined' || typeof aiSettings === 'undefined') return;
    try {
      const raw = JSON.parse(localStorage.getItem('adhd4_ai_settings') || 'null') || {};
      aiSettings.spectraEnabled = raw.spectraEnabled ?? true;
      aiSettings.legacyProviderFallback = raw.legacyProviderFallback ?? true;
    } catch (e) {
      aiSettings.spectraEnabled = true;
      aiSettings.legacyProviderFallback = true;
    }
  }

  const _baseLoadAiSettings = window.loadAiSettings;
  if (typeof _baseLoadAiSettings === 'function' && !_baseLoadAiSettings.__spectraSettingsWrapped) {
    window.loadAiSettings = function loadAiSettingsWithSpectraDefaults() {
      const result = _baseLoadAiSettings.apply(this, arguments);
      _ensureSpectraSettings();
      _loadSavedSpectraSettings();
      return result;
    };
    window.loadAiSettings.__spectraSettingsWrapped = true;
  }

  _ensureSpectraSettings();
  _loadSavedSpectraSettings();

  function _saveAndRender(message) {
    _ensureSpectraSettings();
    if (typeof saveAiSettings === 'function') saveAiSettings();
    if (message && typeof showToast === 'function') showToast(message, 'ok');
    if (typeof render === 'function') render();
  }

  function _localUrlValue() {
    if (typeof localStorage === 'undefined') return DEFAULT_SPECTRA_URL;
    return localStorage.getItem('adhd4_local_ai_url') || DEFAULT_SPECTRA_URL;
  }

  function _hasSavedToken() {
    return typeof localStorage !== 'undefined' && !!localStorage.getItem('adhd4_local_ai_token');
  }

  function _tokenForDisplay() {
    if (!_hasSavedToken()) return DEFAULT_SPECTRA_TOKEN;
    return 'saved locally';
  }

  function _setGatewayStatus(status, detail) {
    if (typeof aiStatus === 'undefined' || !aiStatus) return;
    aiStatus.spectra = status;
    if (detail) aiStatus.spectraError = String(detail).slice(0, 240);
    else delete aiStatus.spectraError;
  }

  window.settingsSetSpectraEnabled = function settingsSetSpectraEnabled(value) {
    _ensureSpectraSettings();
    aiSettings.spectraEnabled = !!value;
    _saveAndRender(aiSettings.spectraEnabled ? 'Spectra-first AI enabled' : 'Spectra-first AI disabled');
  };

  window.settingsSetLegacyProviderFallback = function settingsSetLegacyProviderFallback(value) {
    _ensureSpectraSettings();
    aiSettings.legacyProviderFallback = !!value;
    _saveAndRender(aiSettings.legacyProviderFallback ? 'Legacy fallback enabled' : 'Legacy fallback disabled');
  };

  window.settingsUseSpectraDevDefaults = function settingsUseSpectraDevDefaults() {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('adhd4_local_ai_url', DEFAULT_SPECTRA_URL);
      localStorage.setItem('adhd4_local_ai_token', DEFAULT_SPECTRA_TOKEN);
    }
    _ensureSpectraSettings();
    aiSettings.spectraEnabled = true;
    aiSettings.legacyProviderFallback = true;
    _saveAndRender('Spectra local defaults saved');
  };

  window.settingsOpenSpectraWizard = function settingsOpenSpectraWizard(step) {
    window.showSpectraSetupWizard = true;
    window.spectraSetupStep = Number.isFinite(Number(step)) ? Number(step) : 0;
    if (typeof render === 'function') render();
  };

  window.settingsCloseSpectraWizard = function settingsCloseSpectraWizard() {
    window.showSpectraSetupWizard = false;
    if (typeof render === 'function') render();
  };

  window.settingsSpectraWizardStep = function settingsSpectraWizardStep(step) {
    window.spectraSetupStep = Math.max(0, Math.min(4, Number(step) || 0));
    if (typeof render === 'function') render();
  };

  window.settingsCopySpectraGatewayCommand = async function settingsCopySpectraGatewayCommand(realOllama) {
    const command = realOllama ? REAL_OLLAMA_GATEWAY_COMMAND : GATEWAY_COMMAND;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(command);
        if (typeof showToast === 'function') showToast('Spectra gateway command copied', 'ok');
        return;
      }
    } catch (e) {}
    console.log(command);
    if (typeof showToast === 'function') showToast('Command printed to console', 'ok');
  };

  window.settingsDownloadSpectraLauncher = function settingsDownloadSpectraLauncher(realOllama) {
    const command = realOllama ? REAL_OLLAMA_GATEWAY_COMMAND : GATEWAY_COMMAND;
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
  };

  window.settingsTestSpectra = async function settingsTestSpectra() {
    _ensureSpectraSettings();
    if (!window.AiAdapter || typeof window.AiAdapter.health !== 'function') {
      _setGatewayStatus('error', 'Focus adapter unavailable');
      if (typeof showToast === 'function') showToast('Spectra adapter unavailable', 'warn');
      return;
    }

    try {
      if (typeof showToast === 'function') showToast('Testing Spectra gateway…', 'ok');
      const health = await window.AiAdapter.health();
      if (!health || !health.ok || !health.available) {
        throw new Error('gateway did not report available');
      }

      let requestResult = null;
      if (typeof window.AiAdapter.testAiRequest === 'function') {
        requestResult = await window.AiAdapter.testAiRequest();
        if (!requestResult || !requestResult.ok) {
          throw new Error((requestResult && requestResult.error) || 'AI request failed');
        }
      }

      aiStatus.spectra = 'ok';
      aiStatus.spectraService = health.service || 'prism-spectra';
      aiStatus.spectraMock = health.mockExecutors === true;
      if (requestResult) {
        aiStatus.spectraProvider = requestResult.provider || 'unknown';
        aiStatus.spectraModel = requestResult.model || '';
        aiStatus.spectraBoundary = requestResult.dataBoundary || '';
      }
      delete aiStatus.spectraError;

      const provider = requestResult && requestResult.provider ? ` via ${requestResult.provider}` : '';
      if (typeof showToast === 'function') {
        showToast(`Spectra connected${provider}${health.mockExecutors ? ' (mock mode)' : ''}`, 'ok');
      }
    } catch (e) {
      aiStatus.spectra = 'error';
      aiStatus.spectraError = e && e.message ? e.message : String(e);
      if (typeof showToast === 'function') showToast('Spectra gateway test failed', 'warn');
    }

    if (typeof render === 'function') render();
  };

  function _spectraStatusLabel() {
    const status = typeof aiStatus !== 'undefined' && aiStatus ? aiStatus.spectra : 'unknown';
    if (status === 'ok') return 'Connected';
    if (status === 'error') return 'Needs setup';
    return 'Not tested';
  }

  function _spectraStatusColor() {
    const status = typeof aiStatus !== 'undefined' && aiStatus ? aiStatus.spectra : 'unknown';
    if (status === 'ok') return T.green;
    if (status === 'error') return T.pomo;
    return T.muted2;
  }

  function _spectraConnectionSummary() {
    if (typeof aiStatus === 'undefined' || !aiStatus || aiStatus.spectra !== 'ok') {
      return 'AI is not connected yet. Use the setup wizard, then run Test Spectra.';
    }
    const parts = [];
    if (aiStatus.spectraMock === true) parts.push('mock mode: setup is working, but answers are test responses');
    else parts.push('real provider mode');
    if (aiStatus.spectraProvider) parts.push(`provider: ${aiStatus.spectraProvider}`);
    if (aiStatus.spectraModel) parts.push(`model: ${aiStatus.spectraModel}`);
    if (aiStatus.spectraBoundary) parts.push(`data: ${aiStatus.spectraBoundary}`);
    return parts.join(' · ');
  }

  function _renderStepTabs(active) {
    const labels = ['Understand', 'Connect', 'Test', 'Use AI', 'Troubleshoot'];
    return `<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:12px;">${labels.map((label, index) => {
      const isActive = index === active;
      return `<button onclick="settingsSpectraWizardStep(${index})" style="${btnStyle(isActive ? 'accent' : 'default','font-size:11px;padding:5px 9px;')}">${index + 1}. ${_esc(label)}</button>`;
    }).join('')}</div>`;
  }

  function _renderCodeBlock(text) {
    return `<pre style="white-space:pre-wrap;word-break:break-word;background:${T.surface3};border:1px solid ${T.border};border-radius:9px;padding:9px;font-size:10px;color:${T.text};font-family:'DM Mono',monospace;line-height:1.45;margin:8px 0;">${_esc(text)}</pre>`;
  }

  function _renderSpectraWizardHtml() {
    if (!window.showSpectraSetupWizard) return '';
    const step = Math.max(0, Math.min(4, Number(window.spectraSetupStep || 0)));
    const footer = `<div style="display:flex;justify-content:space-between;gap:8px;margin-top:14px;border-top:1px solid ${T.border};padding-top:12px;">
      <button onclick="settingsCloseSpectraWizard()" style="${btnStyle('default','font-size:12px;padding:6px 10px;')}">Close</button>
      <div style="display:flex;gap:6px;">
        ${step > 0 ? `<button onclick="settingsSpectraWizardStep(${step - 1})" style="${btnStyle('default','font-size:12px;padding:6px 10px;')}">Back</button>` : ''}
        ${step < 4 ? `<button onclick="settingsSpectraWizardStep(${step + 1})" style="${btnStyle('accent','font-size:12px;padding:6px 10px;')}">Next</button>` : ''}
      </div>
    </div>`;

    const stepHtml = [
      `<div>
        <h3 style="margin:0 0 8px;color:${T.text};font-size:16px;">What Focus AI does</h3>
        <p style="margin:0 0 8px;color:${T.muted};font-size:12px;line-height:1.5;">Focus does not own the AI engine. Focus sends read-only helper requests to Spectra, then keeps you in review before anything becomes task/planner state.</p>
        <div style="display:grid;gap:8px;">
          <div style="padding:9px;border:1px solid ${T.border};border-radius:9px;background:${T.surface2};"><b>Can help with:</b><br><span style="font-size:12px;color:${T.muted};">task parsing, daily plan suggestions, journal interpretation, small task breakdowns, gentle prompts.</span></div>
          <div style="padding:9px;border:1px solid ${T.border};border-radius:9px;background:${T.surface2};"><b>Will not silently do:</b><br><span style="font-size:12px;color:${T.muted};">create tasks, change your planner, publish, delete, write files, or run terminal commands without review.</span></div>
          <div style="padding:9px;border:1px solid ${T.border};border-radius:9px;background:${T.surface2};"><b>Current status:</b><br><span style="font-size:12px;color:${T.muted};">${_esc(_spectraConnectionSummary())}</span></div>
        </div>
      </div>`,
      `<div>
        <h3 style="margin:0 0 8px;color:${T.text};font-size:16px;">Connect Spectra</h3>
        <p style="margin:0 0 8px;color:${T.muted};font-size:12px;line-height:1.5;">A browser page cannot start a local Node/Ollama process by itself. The button path below gets you as close as possible: save defaults, copy or download the launcher, then keep the Spectra terminal window open.</p>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">
          <button onclick="settingsUseSpectraDevDefaults()" style="${btnStyle('accent','font-size:12px;padding:6px 10px;')}">1. Save dev defaults</button>
          <button onclick="settingsCopySpectraGatewayCommand(false)" style="${btnStyle('default','font-size:12px;padding:6px 10px;')}">Copy mock command</button>
          <button onclick="settingsDownloadSpectraLauncher(false)" style="${btnStyle('default','font-size:12px;padding:6px 10px;')}">Download mock launcher</button>
        </div>
        <div style="font-size:11px;color:${T.muted};line-height:1.5;">Mock mode proves the app wiring works. It does not require Ollama and will return test-style responses.</div>
        ${_renderCodeBlock(GATEWAY_COMMAND)}
        <details style="font-size:11px;color:${T.muted};line-height:1.5;"><summary style="cursor:pointer;color:${T.text};font-weight:700;">Use real local Ollama instead</summary>
          <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">
            <button onclick="settingsCopySpectraGatewayCommand(true)" style="${btnStyle('default','font-size:11px;padding:5px 8px;')}">Copy real Ollama command</button>
            <button onclick="settingsDownloadSpectraLauncher(true)" style="${btnStyle('default','font-size:11px;padding:5px 8px;')}">Download real Ollama launcher</button>
          </div>
          ${_renderCodeBlock(REAL_OLLAMA_GATEWAY_COMMAND)}
        </details>
      </div>`,
      `<div>
        <h3 style="margin:0 0 8px;color:${T.text};font-size:16px;">Test the connection</h3>
        <p style="margin:0 0 8px;color:${T.muted};font-size:12px;line-height:1.5;">This runs two checks: can Focus reach Spectra, and can Spectra answer a read-only AI request?</p>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;">
          <button onclick="settingsTestSpectra()" style="${btnStyle('accent','font-size:12px;padding:6px 10px;')}">Run Test Spectra</button>
          <button onclick="settingsUseSpectraDevDefaults();settingsTestSpectra();" style="${btnStyle('default','font-size:12px;padding:6px 10px;')}">Use defaults + test</button>
        </div>
        <div style="padding:10px;background:${T.surface2};border:1px solid ${T.border};border-radius:9px;font-size:12px;color:${T.muted};line-height:1.5;">
          <b style="color:${T.text};">Expected good result:</b> status says Connected, and detail shows provider/model/data boundary.<br>
          <b style="color:${T.text};">If it says Needs setup:</b> Spectra is probably not running, token does not match, or the wrong branch is checked out.
        </div>
      </div>`,
      `<div>
        <h3 style="margin:0 0 8px;color:${T.text};font-size:16px;">Use AI in Focus</h3>
        <p style="margin:0 0 8px;color:${T.muted};font-size:12px;line-height:1.5;">After Test Spectra passes, enable AI features and try one safe helper. Suggestions stay review-first.</p>
        <div style="display:grid;gap:8px;">
          <div style="padding:9px;background:${T.surface2};border:1px solid ${T.border};border-radius:9px;"><b>Daily plan suggestion</b><br><span style="font-size:12px;color:${T.muted};">Creates a suggestion card; you choose whether to add tasks.</span></div>
          <div style="padding:9px;background:${T.surface2};border:1px solid ${T.border};border-radius:9px;"><b>Journal interpretation</b><br><span style="font-size:12px;color:${T.muted};">Summarises a journal entry and can suggest tasks for review.</span></div>
          <div style="padding:9px;background:${T.surface2};border:1px solid ${T.border};border-radius:9px;"><b>Task parsing / breakdown</b><br><span style="font-size:12px;color:${T.muted};">Turns rough text into structured suggestions before saving.</span></div>
        </div>
        <label style="display:flex;align-items:center;gap:8px;margin-top:12px;cursor:pointer;"><input type="checkbox" ${typeof aiSettings !== 'undefined' && aiSettings.masterEnabled ? 'checked' : ''} onchange="settingsSetAiMaster(this.checked)"/><span style="font-size:12px;color:${T.text};">Enable AI features</span></label>
      </div>`,
      `<div>
        <h3 style="margin:0 0 8px;color:${T.text};font-size:16px;">Troubleshooting</h3>
        <div style="display:grid;gap:8px;font-size:12px;line-height:1.5;">
          <div style="padding:9px;background:${T.surface2};border:1px solid ${T.border};border-radius:9px;"><b>Spectra unreachable</b><br><span style="color:${T.muted};">Start the gateway and keep that terminal open. The URL should be ${DEFAULT_SPECTRA_URL}.</span></div>
          <div style="padding:9px;background:${T.surface2};border:1px solid ${T.border};border-radius:9px;"><b>Invalid token</b><br><span style="color:${T.muted};">Use dev defaults, or copy the token printed by Spectra into the Token field.</span></div>
          <div style="padding:9px;background:${T.surface2};border:1px solid ${T.border};border-radius:9px;"><b>Mock mode works but real AI does not</b><br><span style="color:${T.muted};">Start Ollama first, then run the real Ollama gateway command with AI_FORGE_MOCK_EXECUTORS=0.</span></div>
          <div style="padding:9px;background:${T.surface2};border:1px solid ${T.border};border-radius:9px;"><b>Mac downloaded launcher will not open</b><br><span style="color:${T.muted};">macOS may block downloaded scripts. Use the copy-command button and paste into Terminal instead.</span></div>
        </div>
      </div>`
    ][step];

    return `
      <div onclick="if(event.target===this)settingsCloseSpectraWizard()" style="position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:1300;display:flex;align-items:center;justify-content:center;padding:16px;">
        <div style="background:${T.surface};border:1.5px solid ${T.border2};border-radius:16px;padding:16px;width:100%;max-width:760px;box-sizing:border-box;max-height:90vh;overflow:auto;box-shadow:0 18px 48px rgba(0,0,0,.28);">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:10px;">
            <div>
              <div style="font-size:17px;font-weight:900;color:${T.text};">Focus AI setup wizard</div>
              <div style="font-size:11px;color:${T.muted};margin-top:3px;">Connect Focus to Spectra, understand the status, and learn what AI can safely do.</div>
            </div>
            <button onclick="settingsCloseSpectraWizard()" style="${btnStyle('default','padding:5px 9px;font-size:14px;')}"><i class="ti ti-x"></i></button>
          </div>
          ${_renderStepTabs(step)}
          ${stepHtml}
          ${footer}
        </div>
      </div>`;
  }

  function _renderSpectraSettingsPanel() {
    _ensureSpectraSettings();
    const statusColor = _spectraStatusColor();
    const statusLabel = _spectraStatusLabel();
    const detailParts = [];
    if (typeof aiStatus !== 'undefined' && aiStatus) {
      if (aiStatus.spectraProvider) detailParts.push(`provider: ${aiStatus.spectraProvider}`);
      if (aiStatus.spectraModel) detailParts.push(`model: ${aiStatus.spectraModel}`);
      if (aiStatus.spectraBoundary) detailParts.push(`boundary: ${aiStatus.spectraBoundary}`);
      if (aiStatus.spectraMock === true) detailParts.push('mock mode');
      if (aiStatus.spectraError) detailParts.push(`error: ${aiStatus.spectraError}`);
    }
    const detail = detailParts.length
      ? `<div style="font-size:10px;color:${T.muted2};margin-top:6px;line-height:1.45;">${_esc(detailParts.join(' · '))}</div>`
      : '';

    return `
      <div style="padding:10px;background:${T.surface2};border:1.5px solid ${T.borderBlue || T.border};border-radius:10px;margin-bottom:12px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;">
          <div>
            <div style="font-size:11px;font-weight:800;color:${T.text};">Spectra AI gateway</div>
            <div style="font-size:10px;color:${T.muted2};margin-top:2px;">Focus asks Spectra for read-only suggestions; Spectra owns provider routing.</div>
          </div>
          <span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;color:${statusColor};white-space:nowrap;">
            <span style="width:7px;height:7px;border-radius:50%;background:${statusColor};display:inline-block;"></span>
            ${_esc(statusLabel)}
          </span>
        </div>

        <div style="padding:8px;background:${T.surface3};border:1px solid ${T.border};border-radius:8px;margin-bottom:8px;font-size:11px;color:${T.muted};line-height:1.45;">
          ${_esc(_spectraConnectionSummary())}
        </div>

        <label style="display:flex;align-items:center;gap:8px;margin-bottom:8px;cursor:pointer;">
          <input type="checkbox" ${aiSettings.spectraEnabled !== false ? 'checked' : ''} onchange="settingsSetSpectraEnabled(this.checked)"/>
          <span style="font-size:12px;color:${T.text};">Use Spectra first for AI helpers</span>
        </label>

        <label style="display:flex;align-items:center;gap:8px;margin-bottom:8px;cursor:pointer;">
          <input type="checkbox" ${aiSettings.legacyProviderFallback !== false ? 'checked' : ''} onchange="settingsSetLegacyProviderFallback(this.checked)"/>
          <span style="font-size:12px;color:${T.text};">Allow legacy provider fallback if Spectra is unavailable</span>
        </label>

        <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;flex-wrap:wrap;">
          <span style="font-size:11px;color:${T.muted};width:42px;">URL:</span>
          <input type="text" value="${_esc(_localUrlValue())}"
            onchange="settingsSaveLocalAiUrl(this.value)"
            style="${inputStyle('flex:1;min-width:160px;font-size:11px;')}"/>
        </div>

        <div style="display:flex;gap:6px;align-items:center;margin-bottom:8px;flex-wrap:wrap;">
          <span style="font-size:11px;color:${T.muted};width:42px;">Token:</span>
          <input type="password"
            value=""
            placeholder="${_esc(_tokenForDisplay())}"
            onchange="settingsSaveLocalAiToken(this.value)"
            style="${inputStyle('flex:1;min-width:160px;font-size:11px;')}"/>
          <button onclick="settingsUseSpectraDevDefaults()" style="${btnStyle('default','font-size:11px;padding:4px 8px;')}">Use dev defaults</button>
          <button onclick="settingsTestSpectra()" style="${btnStyle('accent','font-size:11px;padding:4px 8px;')}">Test Spectra</button>
        </div>

        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:6px;">
          <button onclick="settingsOpenSpectraWizard(0)" style="${btnStyle('accent','font-size:11px;padding:5px 9px;')}">Open AI setup wizard</button>
          <button onclick="settingsCopySpectraGatewayCommand(false)" style="${btnStyle('default','font-size:11px;padding:5px 9px;')}">Copy mock command</button>
          <button onclick="settingsDownloadSpectraLauncher(false)" style="${btnStyle('default','font-size:11px;padding:5px 9px;')}">Download launcher</button>
        </div>

        <div style="font-size:10px;color:${T.muted2};line-height:1.45;">Mock mode proves the bridge works. Real Ollama mode requires Ollama running and Spectra started with <code>AI_FORGE_MOCK_EXECUTORS=0</code>.</div>
        ${detail}
      </div>`;
  }

  const _baseRenderSettingsModalHtml = window.renderSettingsModalHtml;
  if (typeof _baseRenderSettingsModalHtml === 'function' && !_baseRenderSettingsModalHtml.__spectraSettingsWrapped) {
    window.renderSettingsModalHtml = function renderSettingsModalHtmlWithSpectraPanel() {
      const html = _baseRenderSettingsModalHtml.apply(this, arguments);
      const marker = 'Providers</div>';
      const idx = html.indexOf(marker);
      if (idx === -1) return html + _renderSpectraWizardHtml();
      const start = html.lastIndexOf('<div', idx);
      if (start === -1) return html + _renderSpectraWizardHtml();
      return html.slice(0, start) + _renderSpectraSettingsPanel() + html.slice(start) + _renderSpectraWizardHtml();
    };
    window.renderSettingsModalHtml.__spectraSettingsWrapped = true;
  }

  window.renderSpectraSettingsPanel = _renderSpectraSettingsPanel;
  window.renderSpectraSetupWizard = _renderSpectraWizardHtml;
})();
