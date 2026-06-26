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
  const GATEWAY_COMMAND = 'cd ../prism-spectra\nAI_FORGE_AI_GATEWAY_TOKEN="dev-local-token" npm run ai:gateway';
  const REAL_OLLAMA_GATEWAY_COMMAND = 'cd ../prism-spectra\nAI_FORGE_AI_GATEWAY_TOKEN="dev-local-token" AI_FORGE_MOCK_EXECUTORS=0 npm run ai:gateway';

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

  window.settingsTestSpectra = async function settingsTestSpectra() {
    _ensureSpectraSettings();
    if (!window.AiAdapter || typeof window.AiAdapter.health !== 'function') {
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
    if (status === 'error') return 'Error';
    return 'Not tested';
  }

  function _spectraStatusColor() {
    const status = typeof aiStatus !== 'undefined' && aiStatus ? aiStatus.spectra : 'unknown';
    if (status === 'ok') return T.green;
    if (status === 'error') return T.pomo;
    return T.muted2;
  }

  function _localUrlValue() {
    if (typeof localStorage === 'undefined') return DEFAULT_SPECTRA_URL;
    return localStorage.getItem('adhd4_local_ai_url') || DEFAULT_SPECTRA_URL;
  }

  function _hasSavedToken() {
    return typeof localStorage !== 'undefined' && !!localStorage.getItem('adhd4_local_ai_token');
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
            placeholder="${_hasSavedToken() ? 'saved locally — type to replace' : 'dev-local-token'}"
            onchange="settingsSaveLocalAiToken(this.value)"
            style="${inputStyle('flex:1;min-width:160px;font-size:11px;')}"/>
          <button onclick="settingsUseSpectraDevDefaults()" style="${btnStyle('default','font-size:11px;padding:4px 8px;')}">Use dev defaults</button>
          <button onclick="settingsTestSpectra()" style="${btnStyle('accent','font-size:11px;padding:4px 8px;')}">Test Spectra</button>
        </div>

        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:6px;">
          <button onclick="settingsCopySpectraGatewayCommand(false)" style="${btnStyle('default','font-size:11px;padding:4px 8px;')}">Copy mock gateway command</button>
          <button onclick="settingsCopySpectraGatewayCommand(true)" style="${btnStyle('default','font-size:11px;padding:4px 8px;')}">Copy real Ollama command</button>
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
      if (idx === -1) return html;
      const start = html.lastIndexOf('<div', idx);
      if (start === -1) return html;
      return html.slice(0, start) + _renderSpectraSettingsPanel() + html.slice(start);
    };
    window.renderSettingsModalHtml.__spectraSettingsWrapped = true;
  }

  window.renderSpectraSettingsPanel = _renderSpectraSettingsPanel;
})();
