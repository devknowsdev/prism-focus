// Minimal AI command executor (safe whitelist, validation, audit)

function aiExecuteCommand(commandJson) {
  // commandJson may be an object or JSON string
  try {
    if (!aiSettings || !aiAuditLog) {
      return { ok: false, error: 'ai subsystem not initialized' };
    }
    if (!aiSettings.masterEnabled) {
      return { ok: false, error: 'AI execution disabled (masterEnabled=false)' };
    }

    const envelope = typeof commandJson === 'string' ? JSON.parse(commandJson) : commandJson;
    if (!envelope || typeof envelope !== 'object') return { ok: false, error: 'invalid command envelope' };
    const { cmd, args } = envelope;
    if (!cmd || typeof cmd !== 'string') return { ok: false, error: 'missing cmd' };
    if (!args || typeof args !== 'object') return { ok: false, error: 'missing args' };

    const audit = { ts: Date.now(), cmd, args, result: null, userConfirmed: false };

    // require confirmation for flagged commands
    const requiresConfirmation = ['scheduleTask','updateTask','addSubtasks','setFocus'];
    if (aiSettings.executeRequiresConfirmation && requiresConfirmation.includes(cmd)) {
      const ok = (typeof confirm === 'function')
        ? confirm('AI requests to run: ' + cmd + '\n' + JSON.stringify(args))
        : true;
      audit.userConfirmed = !!ok;
      if (!ok) {
        audit.result = { ok: false, error: 'user declined' };
        aiAuditLog.push(audit);
        return audit.result;
      }
    }

    // Whitelisted command handlers
    if (cmd === 'addTask') {
      if (!args.text || typeof args.text !== 'string' || !args.text.trim()) {
        audit.result = { ok: false, error: 'text required' };
        aiAuditLog.push(audit);
        return audit.result;
      }
      const now = Date.now();
      const task = {
        id: now,
        text: args.text.trim(),
        catId: args.catId || '',
        done: false,
        status: 'todo',
        taskScope: args.taskScope || 'day',
        doneDate: '',
        ts: args.ts || '',
        durationMins: null,
        order: nextTaskOrder ? nextTaskOrder() : (tasks.length ? tasks.length : 0),
        createdAt: now,
        repeat: null,
        templateId: null,
        generatedForDate: null,
        pinned: false,
        energyRequired: null,
        anxiety: 0,
        urgency: 0,
        subtasks: [],
        estimatedMins: null,
        note: args.note || '',
      };
      tasks.push(task);
      if (typeof save === 'function') save();
      if (typeof render === 'function') render();
      audit.result = { ok: true, cmd: 'addTask', result: { id: task.id } };
      aiAuditLog.push(audit);
      if (typeof showToast === 'function') showToast('AI: added "' + task.text + '"', 'ok');
      return audit.result;
    }

    if (cmd === 'createJournalEntry') {
      if (!args.text || typeof args.text !== 'string') {
        audit.result = { ok: false, error: 'text required' };
        aiAuditLog.push(audit);
        return audit.result;
      }
      const now = Date.now();
      const entry = { id: now, type: args.type || 'note', text: args.text, catId: args.catId || '', createdAt: now };
      journalEntries.unshift(entry);
      if (typeof save === 'function') save();
      if (typeof render === 'function') render();
      audit.result = { ok: true, cmd: 'createJournalEntry', result: { id: entry.id } };
      aiAuditLog.push(audit);
      if (typeof showToast === 'function') showToast('AI: captured note', 'ok');
      return audit.result;
    }

    if (cmd === 'updateTask') {
      const taskId = _normalizeId(args.id);
      if (taskId == null) {
        audit.result = { ok: false, error: 'id required' };
        aiAuditLog.push(audit);
        return audit.result;
      }
      const task = typeof getTask === 'function' ? getTask(taskId) : (tasks || []).find(t => t.id === taskId);
      if (!task) {
        audit.result = { ok: false, error: 'task not found' };
        aiAuditLog.push(audit);
        return audit.result;
      }
      if ('text' in args) {
        if (!args.text || typeof args.text !== 'string' || !args.text.trim()) {
          audit.result = { ok: false, error: 'text must be a non-empty string' };
          aiAuditLog.push(audit);
          return audit.result;
        }
        task.text = args.text.trim();
      }
      if ('catId' in args) {
        task.catId = args.catId == null ? '' : String(args.catId);
      }
      if ('ts' in args) {
        const ts = _normalizeTime(args.ts);
        if (args.ts !== '' && ts === '') {
          audit.result = { ok: false, error: 'ts must be HH:MM or empty' };
          aiAuditLog.push(audit);
          return audit.result;
        }
        task.ts = ts;
      }
      if ('status' in args) {
        const status = String(args.status);
        if (!['todo', 'inprogress', 'done'].includes(status)) {
          audit.result = { ok: false, error: 'invalid status' };
          aiAuditLog.push(audit);
          return audit.result;
        }
        task.status = status;
        task.done = status === 'done';
        if (task.done && !task.doneDate) task.doneDate = new Date().toISOString().slice(0, 10);
        if (!task.done) task.doneDate = '';
      }
      if ('note' in args) {
        task.note = args.note == null ? '' : String(args.note);
      }
      if ('pinned' in args) {
        task.pinned = !!args.pinned;
      }
      if ('estimatedMins' in args) {
        task.estimatedMins = args.estimatedMins == null ? null : Number(args.estimatedMins) || null;
      }
      if ('urgency' in args) {
        task.urgency = Number(args.urgency) || 0;
      }
      if (typeof save === 'function') save();
      if (typeof render === 'function') render();
      audit.result = { ok: true, cmd: 'updateTask', result: { id: task.id } };
      aiAuditLog.push(audit);
      if (typeof showToast === 'function') showToast('AI: task updated', 'ok');
      return audit.result;
    }

    if (cmd === 'scheduleTask') {
      const taskId = _normalizeId(args.id);
      if (taskId == null) {
        audit.result = { ok: false, error: 'id required' };
        aiAuditLog.push(audit);
        return audit.result;
      }
      const task = typeof getTask === 'function' ? getTask(taskId) : (tasks || []).find(t => t.id === taskId);
      if (!task) {
        audit.result = { ok: false, error: 'task not found' };
        aiAuditLog.push(audit);
        return audit.result;
      }
      const ts = _normalizeTime(args.ts);
      if (args.ts !== '' && ts === '') {
        audit.result = { ok: false, error: 'ts must be HH:MM or empty' };
        aiAuditLog.push(audit);
        return audit.result;
      }
      task.ts = ts;
      if (typeof save === 'function') save();
      if (typeof render === 'function') render();
      audit.result = { ok: true, cmd: 'scheduleTask', result: { id: task.id, ts: task.ts } };
      aiAuditLog.push(audit);
      if (typeof showToast === 'function') showToast('AI: task schedule updated', 'ok');
      return audit.result;
    }

    if (cmd === 'addSubtasks') {
      const taskId = _normalizeId(args.taskId);
      if (taskId == null) {
        audit.result = { ok: false, error: 'taskId required' };
        aiAuditLog.push(audit);
        return audit.result;
      }
      const task = typeof getTask === 'function' ? getTask(taskId) : (tasks || []).find(t => t.id === taskId);
      if (!task) {
        audit.result = { ok: false, error: 'task not found' };
        aiAuditLog.push(audit);
        return audit.result;
      }
      if (!Array.isArray(args.subtasks) || !args.subtasks.length) {
        audit.result = { ok: false, error: 'subtasks array required' };
        aiAuditLog.push(audit);
        return audit.result;
      }
      task.subtasks = task.subtasks || [];
      const newSubs = [];
      args.subtasks.forEach((subtask, index) => {
        const text = subtask && typeof subtask.text === 'string' ? subtask.text.trim() : '';
        if (text) {
          newSubs.push({
            id: Date.now() + index,
            text,
            done: false,
            order: task.subtasks.length + newSubs.length,
            practiceCount: 0,
          });
        }
      });
      if (!newSubs.length) {
        audit.result = { ok: false, error: 'no valid subtasks' };
        aiAuditLog.push(audit);
        return audit.result;
      }
      task.subtasks.push(...newSubs);
      if (typeof save === 'function') save();
      if (typeof render === 'function') render();
      audit.result = { ok: true, cmd: 'addSubtasks', result: { taskId: task.id, added: newSubs.length } };
      aiAuditLog.push(audit);
      if (typeof showToast === 'function') showToast('AI: added subtasks', 'ok');
      return audit.result;
    }

    if (cmd === 'setFocus') {
      const taskId = _normalizeId(args.taskId);
      if (taskId == null) {
        audit.result = { ok: false, error: 'taskId required' };
        aiAuditLog.push(audit);
        return audit.result;
      }
      const task = typeof getTask === 'function' ? getTask(taskId) : (tasks || []).find(t => t.id === taskId);
      if (!task || task.done) {
        audit.result = { ok: false, error: 'task not found or already done' };
        aiAuditLog.push(audit);
        return audit.result;
      }
      let subtaskId = null;
      if (args.subtaskId != null) {
        subtaskId = _normalizeId(args.subtaskId);
        const subtask = typeof getSubtask === 'function' ? getSubtask(taskId, subtaskId) : (task.subtasks || []).find(s => s.id === subtaskId);
        if (!subtask || subtask.done) {
          audit.result = { ok: false, error: 'subtask not found or already done' };
          aiAuditLog.push(audit);
          return audit.result;
        }
      }
      if (typeof setFocus === 'function') {
        setFocus(taskId, subtaskId);
      } else {
        focusTaskId = taskId;
        focusSubtaskId = subtaskId;
        if (typeof save === 'function') save();
        if (typeof render === 'function') render();
      }
      audit.result = { ok: true, cmd: 'setFocus', result: { taskId, subtaskId } };
      aiAuditLog.push(audit);
      if (typeof showToast === 'function') showToast('AI: focus updated', 'ok');
      return audit.result;
    }

    // Other commands: validated envelope but not implemented yet
    audit.result = { ok: false, error: 'unknown-or-unimplemented-cmd' };
    aiAuditLog.push(audit);
    return audit.result;

  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : String(e) };
  }
}

function _normalizeId(value) {
  if (value == null) return null;
  if (typeof value === 'string' && value.trim() !== '' && /^[0-9]+$/.test(value.trim())) {
    return Number(value.trim());
  }
  return value;
}

function _normalizeTime(raw) {
  if (typeof normalizeTaskTime === 'function') {
    return normalizeTaskTime(String(raw || '')).trim();
  }
  const str = String(raw || '').trim();
  if (!str) return '';
  return /^\d{1,2}:\d{2}$/.test(str) ? str : '';
}

function aiGetAuditLog() {
  return aiAuditLog || [];
}

function aiClearAuditLog() {
  if (aiAuditLog) aiAuditLog.length = 0;
}

function openAiAuditModal() {
  showAiAuditModal = true;
  if (typeof render === 'function') render();
}

function closeAiAuditModal() {
  showAiAuditModal = false;
  if (typeof render === 'function') render();
}

// Short machine-readable command schema for injecting into system prompts
function aiCommandSystemPrompt() {
  return `The assistant may respond ONLY with a single JSON object: {"cmd":"<name>","args":{...}}. Allowed cmds: addTask, updateTask, scheduleTask, addSubtasks, setFocus, createJournalEntry. Each arg object must follow documented shapes in docs/AI_API.md. Do not include any explanatory text or markdown fences.`;
}
