/*
Phase 1 quick fixes loaded before init.js.
Keeps the fixes isolated while preserving the classic-script global runtime.
*/
(function(){
  const root = (typeof window !== 'undefined') ? window : globalThis;

  // FOCUS-QF5: ensure in-memory defaults exist before load()/saveAiSettings().
  try {
    if (typeof aiSettings !== 'undefined' && aiSettings) {
      if (aiSettings.spectraEnabled === undefined) aiSettings.spectraEnabled = true;
      if (aiSettings.legacyProviderFallback === undefined) aiSettings.legacyProviderFallback = true;
      if (aiSettings.executeRequiresConfirmation === undefined) aiSettings.executeRequiresConfirmation = false;
    }
  } catch (e) {
    console.warn('phase1 quick fixes: failed to seed aiSettings defaults', e);
  }

  // FOCUS-QF5: preserve Spectra/fallback/confirmation fields during load reconstruction.
  try {
    root.loadAiSettings = function() {
      try {
        const raw = JSON.parse(localStorage.getItem('adhd4_ai_settings') || 'null');
        const key = localStorage.getItem('adhd4_ai_key') || '';
        aiSettings = {
          masterEnabled: raw?.masterEnabled ?? false,
          providerOrder: raw?.providerOrder ?? ['ollama', 'anthropic'],
          ollamaEnabled: raw?.ollamaEnabled ?? false,
          ollamaUrl: raw?.ollamaUrl ?? 'http://localhost:11434',
          ollamaModel: raw?.ollamaModel ?? 'llama3.2',
          anthropicEnabled: raw?.anthropicEnabled ?? false,
          anthropicKey: key,
          spectraEnabled: raw?.spectraEnabled ?? true,
          legacyProviderFallback: raw?.legacyProviderFallback ?? true,
          executeRequiresConfirmation: raw?.executeRequiresConfirmation ?? false,
        };
      } catch (e) {
        aiSettings = {
          masterEnabled: false,
          providerOrder: ['ollama', 'anthropic'],
          ollamaEnabled: false,
          ollamaUrl: 'http://localhost:11434',
          ollamaModel: 'llama3.2',
          anthropicEnabled: false,
          anthropicKey: '',
          spectraEnabled: true,
          legacyProviderFallback: true,
          executeRequiresConfirmation: false,
        };
      }
    };
  } catch (e) {
    console.warn('phase1 quick fixes: failed to patch AI settings loader', e);
  }

  // FOCUS-QF3: default AI-created tasks to project scope when omitted.
  try {
    const originalAiExecuteCommand = root.aiExecuteCommand;
    if (typeof originalAiExecuteCommand === 'function') {
      root.aiExecuteCommand = function(commandJson) {
        let envelope = commandJson;
        try {
          envelope = typeof commandJson === 'string' ? JSON.parse(commandJson) : commandJson;
          if (envelope && envelope.cmd === 'addTask') {
            envelope = {
              ...envelope,
              args: {
                ...(envelope.args || {}),
                taskScope: envelope.args?.taskScope || 'project',
              },
            };
          }
        } catch (e) {
          return originalAiExecuteCommand(commandJson);
        }
        return originalAiExecuteCommand(envelope);
      };
    }
  } catch (e) {
    console.warn('phase1 quick fixes: failed to patch AI executor defaults', e);
  }

  // FOCUS-QF1 + FOCUS-QF4: fix timer quick-log elapsed var and refresh window.tasks after delete.
  try {
    root.deleteTask = function(taskId) {
      try {
        if (typeof tasks === 'undefined') return;
        tasks = tasks.filter(t => t.id !== taskId);
        if (typeof window !== 'undefined') window.tasks = tasks;
        if (typeof timeSessions !== 'undefined') timeSessions = timeSessions.filter(s => s.taskId !== taskId);
        if (typeof save === 'function') save();
        if (typeof render === 'function') render();
      } catch (e) {
        console.warn('deleteTask error', e);
      }
    };

    root.stopAndSaveTimer = function(saveDirect) {
      try {
        timerRunning = false;
        if (!activeSession) { render && render(); return; }
        const wallElapsed = Math.floor((Date.now() - activeSession.startedAt) / 1000);
        let timerDerived = null;
        try {
          if (activeSession && activeSession.mode === 'countdown') {
            const planned = (typeof timerPlannedSecs !== 'undefined' && timerPlannedSecs) ? timerPlannedSecs : ((timerCountdownMins || 25) * 60);
            const remaining = (typeof timerSecs === 'number') ? timerSecs : planned;
            timerDerived = Math.max(0, planned - remaining);
          } else {
            timerDerived = (typeof timerSecs === 'number') ? timerSecs : Math.round((Date.now() - activeSession.startedAt) / 1000);
          }
        } catch (e) {
          timerDerived = Math.round((Date.now() - activeSession.startedAt) / 1000);
        }
        const secs = Math.max(wallElapsed, Math.floor(timerDerived));
        const s = { id: Date.now(), taskId: activeSession.taskId, startedAt: activeSession.startedAt, endedAt: activeSession.startedAt + secs * 1000, seconds: secs, mode: activeSession.mode || 'auto', type: 'work' };
        if (saveDirect) {
          timeSessions = timeSessions || [];
          timeSessions.push(s);
          activeSession = null;
          save && save();
          showQuickLog = false;
          quickLogTaskId = null;
        } else {
          showQuickLog = true;
          quickLogTaskId = activeSession.taskId;
          quickLogSecs = secs;
        }
        render && render();
      } catch (e) {
        console.warn('stopAndSaveTimer error', e);
      }
    };
  } catch (e) {
    console.warn('phase1 quick fixes: failed to patch shim functions', e);
  }
})();
