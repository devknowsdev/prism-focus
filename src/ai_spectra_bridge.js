/*
MODULE: ai_spectra_bridge.js
LAYER: services
PURPOSE: Spectra-first bridge for Focus AI helpers, preserving legacy direct providers as fallback.
USES: ai_adapter_local.js, ai.js globals, state.js
INVARIANTS: read-only Spectra requests only; no task/planner mutation without existing Focus review/confirm flows.
LAST_STABILIZED: 2026-06-25
*/
(function(){
  const SPECTRA_SOURCE_APP = 'prism-focus';

  const legacyAiCall = window.aiCall;
  const legacyAiCallJson = window.aiCallJson;
  const legacyDumpAiDailyPlan = window.dumpAiDailyPlan;
  const legacyDumpAiInterpret = window.dumpAiInterpret;

  function _hasSpectraAi() {
    return typeof window !== 'undefined'
      && window.AiAdapter
      && typeof window.AiAdapter.aiRequest === 'function';
  }

  function _spectraEnabled() {
    return typeof aiSettings !== 'undefined'
      && aiSettings.masterEnabled
      && aiSettings.spectraEnabled !== false;
  }

  function _legacyFallbackEnabled() {
    return typeof aiSettings !== 'undefined'
      && aiSettings.legacyProviderFallback !== false;
  }

  function _legacyProviderAvailable() {
    return typeof aiSettings !== 'undefined'
      && ((aiSettings.ollamaEnabled) || (aiSettings.anthropicEnabled && aiSettings.anthropicKey));
  }

  function _anyAiPathAvailable() {
    return _spectraEnabled() || (_legacyFallbackEnabled() && _legacyProviderAvailable());
  }

  function _setSpectraStatus(status, error) {
    if (typeof aiStatus === 'undefined') return;
    aiStatus.spectra = status;
    if (error) aiStatus.spectraError = String(error).slice(0, 240);
    else delete aiStatus.spectraError;
  }

  function _buildSpectraIntent(systemPrompt, userPrompt, opts) {
    return opts.intent || opts.feature || 'focus-ai-call';
  }

  async function _spectraAiCall(systemPrompt, userPrompt, opts = {}) {
    if (!_spectraEnabled() || !_hasSpectraAi()) return null;

    try {
      const response = await window.AiAdapter.aiRequest({
        sourceApp: SPECTRA_SOURCE_APP,
        intent: _buildSpectraIntent(systemPrompt, userPrompt, opts),
        riskClass: 'read-only',
        preferredMode: 'local-first',
        nodeType: opts.nodeType || 'docs',
        input: {
          systemPrompt: systemPrompt || '',
          userPrompt: userPrompt || '',
          maxTokens: opts.maxTokens || null,
          temperature: opts.temperature ?? null,
        },
        context: {
          feature: opts.feature || opts.intent || 'focus-ai-call',
          responseFormat: opts.responseFormat || 'text',
        },
      });

      if (response && response.ok && typeof response.response === 'string' && response.response.trim()) {
        _setSpectraStatus('ok');
        return response.response.trim();
      }

      _setSpectraStatus('error', response && response.error ? response.error : 'empty Spectra response');
      return null;
    } catch (e) {
      console.warn('Spectra AI request failed:', e);
      _setSpectraStatus('error', e && e.message ? e.message : String(e));
      return null;
    }
  }

  function _parseJsonFromText(raw) {
    if (!raw) return null;
    try {
      const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      return JSON.parse(clean);
    } catch (e) {
      const match = raw.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
      if (match) {
        try { return JSON.parse(match[1]); } catch (e2) { return null; }
      }
      return null;
    }
  }

  window.aiCall = async function aiCallSpectraFirst(systemPrompt, userPrompt, opts = {}) {
    if (typeof aiSettings !== 'undefined' && !aiSettings.masterEnabled) return null;

    const spectraResult = await _spectraAiCall(systemPrompt, userPrompt, opts);
    if (spectraResult !== null) return spectraResult;

    if (!_legacyFallbackEnabled()) return null;
    if (typeof legacyAiCall === 'function') return await legacyAiCall(systemPrompt, userPrompt, opts);
    return null;
  };

  window.aiCallJson = async function aiCallJsonSpectraFirst(systemPrompt, userPrompt, opts = {}) {
    const raw = await window.aiCall(systemPrompt, userPrompt, {
      ...opts,
      temperature: opts.temperature ?? 0.1,
      responseFormat: 'json',
    });
    const parsed = _parseJsonFromText(raw);
    if (parsed !== null) return parsed;
    if (!_legacyFallbackEnabled() || typeof legacyAiCallJson !== 'function') return null;
    return null;
  };

  window.dumpAiDailyPlan = async function dumpAiDailyPlanSpectraFirst() {
    if (!aiSettings.masterEnabled || !_anyAiPathAvailable()) {
      showToast('AI suggestions unavailable; enable Spectra or a legacy AI provider first', 'warn');
      return;
    }

    const todayStr = new Date().toDateString();
    const energyEntry = getEnergyToday ? getEnergyToday(todayStr) : null;
    const energy = energyEntry ? energyEntry.energy : 3;
    const scheduledCount = tasks.filter(t => t.ts && t.status !== 'done').length;
    const unscheduledCount = tasks.filter(t => !t.ts && t.status !== 'done').length;
    const topAvoidance = tasks
      .filter(t => t.status !== 'done')
      .sort((a, b) => avoidanceScore(b) - avoidanceScore(a))[0];
    const doneHabitCount = (typeof getAllHitsForHabit === 'function')
      ? habits.filter(h => getAllHitsForHabit(h, todayStr).length).length
      : 0;
    const habitSummary = habits.length
      ? `${habits.length} habits, ${doneHabitCount} logged today`
      : 'no habits yet';

    showToast('Asking Spectra for a daily plan suggestion…', 'ok');
    const suggestion = await aiDailyPlanSuggestion(energy, scheduledCount, unscheduledCount, topAvoidance ? topAvoidance.text : '', habitSummary);
    if (!suggestion) {
      showToast('Could not get AI suggestion', 'warn');
      aiAuditLog.push({
        ts: Date.now(),
        cmd: 'dailyPlanSuggestion',
        args: { energy, scheduledCount, unscheduledCount, topAvoidance: topAvoidance ? topAvoidance.text : '', habitSummary },
        result: { ok: false, error: 'could not generate suggestion' },
        userConfirmed: false,
      });
      return;
    }
    aiPendingSuggestion = suggestion;
    aiAuditLog.push({
      ts: Date.now(),
      cmd: 'dailyPlanSuggestion',
      args: { energy, scheduledCount, unscheduledCount, topAvoidance: topAvoidance ? topAvoidance.text : '', habitSummary },
      result: { ok: true, suggestions: suggestion.taskSuggestions.length, route: aiStatus.spectra === 'ok' ? 'spectra' : 'legacy' },
      userConfirmed: false,
    });
    render();
  };

  window.dumpAiInterpret = async function dumpAiInterpretSpectraFirst(journalId) {
    const entry = journalEntries.find(e => e.id === journalId);
    if (!entry) return;
    const raw = String(entry.text || '').trim();
    if (!raw) return;

    if (!aiSettings.masterEnabled || !_anyAiPathAvailable()) {
      showToast('AI interpretation unavailable; enable Spectra or a legacy AI provider first', 'warn');
      return;
    }

    showToast('Interpreting journal entry…', 'ok');
    const interpreted = await aiInterpretJournalEntry(raw);
    if (!interpreted) {
      showToast('Could not interpret entry', 'warn');
      aiAuditLog.push({
        ts: Date.now(),
        cmd: 'interpretJournalEntry',
        args: { journalId },
        result: { ok: false, error: 'could not interpret' },
        userConfirmed: false,
      });
      return;
    }

    aiPendingInterpret = {
      journalId,
      rawText: raw,
      summary: interpreted.summary || '',
      insight: interpreted.insight || '',
      taskSuggestions: Array.isArray(interpreted.taskSuggestions) ? interpreted.taskSuggestions : [],
    };
    entry.aiInterpretedSummary = aiPendingInterpret.summary;
    entry.aiInterpretedInsight = aiPendingInterpret.insight;
    if (typeof save === 'function') save();
    aiAuditLog.push({
      ts: Date.now(),
      cmd: 'interpretJournalEntry',
      args: { journalId, rawText: raw },
      result: { ok: true, summary: aiPendingInterpret.summary, taskSuggestions: aiPendingInterpret.taskSuggestions.length, route: aiStatus.spectra === 'ok' ? 'spectra' : 'legacy' },
      userConfirmed: false,
    });
    render();
  };

  window.aiSpectraBridgeStatus = function aiSpectraBridgeStatus() {
    return {
      spectraEnabled: _spectraEnabled(),
      adapterAvailable: _hasSpectraAi(),
      legacyFallbackEnabled: _legacyFallbackEnabled(),
      legacyProviderAvailable: _legacyProviderAvailable(),
      status: typeof aiStatus !== 'undefined' ? aiStatus.spectra : 'unknown',
    };
  };
})();
