/*
MODULE: ai_chat_spectra_bridge.js
LAYER: services/ui bridge
PURPOSE: Route the Focus chat modal through Spectra /api/v1/ai/request as an app-aware Focus assistant.
USES: ai_adapter_local.js, state.js chat globals, render_modals.js chat UI, actions_tasks.js-compatible task state
INVARIANTS: Chat requests are read-only; Focus task/planner writes only happen after visible Apply action.
LAST_STABILIZED: 2026-06-27
*/
(function(){
  const CHAT_STORAGE_KEY = 'adhd4_spectra_chat_state_v1';
  const FOCUS_ASSISTANT_INSTRUCTION = `You are the Prism Focus assistant inside a local-first ADHD/autism-friendly planning app.

Identity and scope:
- You are not a terminal assistant.
- You cannot run shell commands from inside Focus.
- Ignore accidental pasted terminal/git commands unless the user explicitly asks for development help.
- Help the user with Focus app workflows: tasks, prioritising, day planning, planner scheduling, task breakdowns, journal reflection, focus support, voice-captured thoughts, and stream-of-consciousness day dumps.

Safety and state boundary:
- Do not claim you already changed the app.
- You may propose tasks or schedule blocks.
- Focus will only apply proposed tasks after the user clicks an Apply button.
- Keep responses calm, concrete, and low-overwhelm.

For normal chat, answer naturally.
For day dumps, scheduling requests, or task setup requests, return useful proposals.

Return ONLY valid JSON with this shape:
{
  "reply": "short helpful response shown to the user",
  "proposedTasks": [
    {
      "text": "task title",
      "ts": "HH:MM or empty",
      "estimatedMins": 25,
      "note": "optional short note",
      "taskScope": "day or project"
    }
  ],
  "proposedSchedule": [
    {
      "start": "HH:MM",
      "end": "HH:MM or empty",
      "text": "planner block or task title",
      "estimatedMins": 25,
      "note": "optional short note"
    }
  ],
  "followUpQuestion": "optional single question if needed"
}

If there are no tasks or schedule blocks to propose, use empty arrays.`;

  function _nowIso(){
    try { return new Date().toISOString(); } catch (e) { return ''; }
  }

  function _escape(value) {
    if (typeof esc === 'function') return esc(String(value ?? ''));
    return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function _newId(prefix){
    return `${prefix || 'chat'}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function _loadChatState(){
    try {
      if (typeof localStorage === 'undefined') return;
      const raw = localStorage.getItem(CHAT_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return;
      chatConversations = Array.isArray(parsed.conversations) ? parsed.conversations : [];
      chatMessages = parsed.messages && typeof parsed.messages === 'object' ? parsed.messages : {};
      activeConversationId = parsed.activeConversationId || (chatConversations[0] && chatConversations[0].id) || null;
    } catch (e) {
      console.warn('Failed to load Spectra chat state', e);
    }
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

  function _makeLocalConversation(title){
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
    return conv;
  }

  function _extractSpectraText(result){
    if (!result) return '';
    if (typeof result === 'string') return result;
    if (typeof result.output === 'string') return result.output;
    if (typeof result.text === 'string') return result.text;
    if (typeof result.content === 'string') return result.content;
    if (typeof result.response === 'string') return result.response;
    if (result.response && typeof result.response.output === 'string') return result.response.output;
    if (result.response && typeof result.response.text === 'string') return result.response.text;
    if (result.response && typeof result.response.content === 'string') return result.response.content;
    if (result.structuredResponse && typeof result.structuredResponse.reply === 'string') return JSON.stringify(result.structuredResponse);
    if (result.structuredResponse && typeof result.structuredResponse.response === 'string') return result.structuredResponse.response;
    try { return JSON.stringify(result.response || result.structuredResponse || result, null, 2); }
    catch (e) { return ''; }
  }

  function _parseAssistantPayload(raw){
    if (!raw) return { reply: '', proposedTasks: [], proposedSchedule: [] };
    if (typeof raw === 'object') return _normalizeAssistantPayload(raw);
    const text = String(raw || '').trim();
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    try { return _normalizeAssistantPayload(JSON.parse(cleaned)); } catch (e) {}
    const match = cleaned.match(/(\{[\s\S]*\})/);
    if (match) {
      try { return _normalizeAssistantPayload(JSON.parse(match[1])); } catch (e) {}
    }
    return { reply: cleaned, proposedTasks: [], proposedSchedule: [] };
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

  function _appendChatMessage(convId, message){
    if (!convId) return null;
    chatMessages[convId] = chatMessages[convId] || [];
    const msg = {
      id: _newId('msg'),
      created_at: _nowIso(),
      ...message,
    };
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

  function _getProposalFromMessage(messageId){
    for (const key of Object.keys(chatMessages || {})) {
      const msg = (chatMessages[key] || []).find(m => m.id === messageId);
      if (msg) return msg.proposal || null;
    }
    return null;
  }

  function _createTaskFromProposal(item, offset){
    const now = Date.now() + (offset || 0);
    return {
      id: now,
      text: item.text,
      catId: item.catId || '',
      done: false,
      status: 'todo',
      ts: _normalizeTime(item.ts),
      order: typeof nextTaskOrder === 'function' ? nextTaskOrder() + (offset || 0) : (tasks || []).length + (offset || 0),
      createdAt: now,
      repeat: null,
      templateId: null,
      generatedForDate: null,
      pinned: false,
      urgency: 0,
      subtasks: [],
      estimatedMins: _normalizeMins(item.estimatedMins),
      durationMins: _normalizeMins(item.estimatedMins),
      note: String(item.note || '').trim(),
      anxiety: 0,
      taskScope: item.taskScope === 'project' ? 'project' : 'day',
      doneDate: '',
    };
  }

  window.applyChatProposal = function applyChatProposal(messageId){
    const proposal = _getProposalFromMessage(messageId);
    if (!proposal) return showToast('No proposal found', 'warn');
    const items = [...(proposal.proposedSchedule || []), ...(proposal.proposedTasks || [])]
      .map(_normalizeTaskLike)
      .filter(Boolean);
    if (!items.length) return showToast('No proposed tasks to apply', 'warn');
    const ok = confirm(`Add ${items.length} proposed task${items.length === 1 ? '' : 's'} to Focus?`);
    if (!ok) return;
    tasks.push(...items.map((item, index) => _createTaskFromProposal(item, index)));
    _replaceChatMessage(activeConversationId, messageId, { applied: true });
    if (typeof save === 'function') save();
    if (typeof render === 'function') render();
    showToast(`Added ${items.length} proposed task${items.length === 1 ? '' : 's'}`, 'ok');
  };

  window.dismissChatProposal = function dismissChatProposal(messageId){
    _replaceChatMessage(activeConversationId, messageId, { dismissed: true });
    if (typeof render === 'function') render();
  };

  window.startNewChat = function startNewChat(){
    chatComposerText = '';
    chatComposerAttachments = [];
    _makeLocalConversation('New Focus chat');
    if (typeof render === 'function') render();
  };

  window.deleteActiveChat = function deleteActiveChat(){
    if (!activeConversationId) return;
    if (!confirm('Delete this local chat?')) return;
    const id = activeConversationId;
    chatConversations = (chatConversations || []).filter(c => c.id !== id);
    delete chatMessages[id];
    activeConversationId = (chatConversations[0] && chatConversations[0].id) || null;
    _saveChatState();
    if (typeof render === 'function') render();
  };

  window.clearAllChats = function clearAllChats(){
    if (!confirm('Clear all local Focus chats?')) return;
    chatConversations = [];
    chatMessages = {};
    activeConversationId = null;
    chatComposerText = '';
    chatComposerAttachments = [];
    _saveChatState();
    if (typeof render === 'function') render();
  };

  window.loadConversations = async function loadSpectraLocalConversations(){
    _loadChatState();
    chatConversations = Array.isArray(chatConversations) ? chatConversations : [];
    if (typeof render === 'function') render();
  };

  window.openConversation = async function openSpectraLocalConversation(convId){
    activeConversationId = convId;
    chatMessages[activeConversationId] = chatMessages[activeConversationId] || [];
    _saveChatState();
    if (typeof render === 'function') render();
  };

  window.loadConversationMessages = async function loadSpectraLocalConversationMessages(convId){
    if (convId) chatMessages[convId] = chatMessages[convId] || [];
    if (typeof render === 'function') render();
  };

  window.sendChatPrompt = async function sendSpectraChatPrompt(){
    const text = String(chatComposerText || '').trim();
    if (!text) return;
    if (!window.AiAdapter || typeof window.AiAdapter.aiRequest !== 'function') {
      return showToast('Spectra AI adapter unavailable', 'warn');
    }

    if (Array.isArray(chatComposerAttachments) && chatComposerAttachments.length) {
      showToast('Chat attachments still need the full local daemon; sending text only.', 'warn');
    }

    if (!activeConversationId) _makeLocalConversation(text);
    const convId = activeConversationId;
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
        nodeType: 'ui',
        input: {
          prompt: text,
          history,
          instruction: FOCUS_ASSISTANT_INSTRUCTION,
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
          allowedCapabilities: [
            'explain-focus-app-capabilities',
            'parse-day-dump',
            'propose-tasks',
            'propose-schedule',
            'break-down-task',
            'prioritise-day',
          ],
          disallowedCapabilities: ['run-terminal-command', 'silent-task-write', 'silent-planner-write'],
        },
      });

      if (!result || result.ok === false) {
        throw new Error((result && result.error) || 'Spectra request failed');
      }

      const raw = result.structuredResponse || _extractSpectraText(result);
      const payload = _parseAssistantPayload(raw);
      const replyParts = [];
      if (payload.reply) replyParts.push(payload.reply);
      if (payload.followUpQuestion) replyParts.push(payload.followUpQuestion);
      const reply = replyParts.join('\n\n').trim() || _extractSpectraText(result).trim() || 'I received that, but no response text was returned.';
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

  window.handleChatFileInput = function handleSpectraChatFileInput(){
    showToast('Chat file uploads need the full local daemon; Spectra chat currently supports text.', 'warn');
  };

  function _proposalHtml(message){
    if (!message || !message.proposal || message.dismissed) return '';
    const proposal = message.proposal;
    const items = [...(proposal.proposedSchedule || []), ...(proposal.proposedTasks || [])]
      .map(_normalizeTaskLike)
      .filter(Boolean);
    if (!items.length) return '';
    const rows = items.map(item => `
      <div style="display:flex;gap:8px;align-items:flex-start;padding:7px 0;border-bottom:1px solid ${T.border};">
        <div style="font-family:'DM Mono',monospace;font-size:11px;color:${T.accent};min-width:42px;">${_escape(item.ts || '—')}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:12px;font-weight:800;color:${T.text};">${_escape(item.text)}</div>
          <div style="font-size:11px;color:${T.muted2};margin-top:2px;">${item.estimatedMins ? `${item.estimatedMins}m · ` : ''}${_escape(item.note || 'Review before adding')}</div>
        </div>
      </div>`).join('');
    return `<div style="margin-top:8px;background:${T.surface2};border:1px solid ${T.borderBlue || T.border};border-radius:10px;padding:9px;">
      <div style="font-size:11px;font-weight:900;color:${T.text};margin-bottom:5px;">Proposed Focus changes</div>
      ${rows}
      <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;">
        <button onclick="applyChatProposal('${_escape(message.id)}')" ${message.applied ? 'disabled' : ''} style="${btnStyle('accent','font-size:11px;padding:5px 9px;')}">${message.applied ? 'Applied' : 'Apply proposed tasks'}</button>
        <button onclick="dismissChatProposal('${_escape(message.id)}')" style="${btnStyle('default','font-size:11px;padding:5px 9px;')}">Dismiss</button>
      </div>
    </div>`;
  }

  function _patchChatRenderer(){
    if (typeof window.renderChatModalHtml !== 'function') return false;
    if (window.renderChatModalHtml.__spectraChatWrapped) return true;
    window.renderChatModalHtml = function renderSpectraChatModalHtml(){
      if(!showChatModal) return '';
      _loadChatState();
      const convs = Array.isArray(chatConversations) ? chatConversations : [];
      const convsHtml = convs.map(c => `<div style="padding:8px;border-bottom:1px solid ${T.border};cursor:pointer;${c.id===activeConversationId?('background:'+T.surface2+';'):''}" onclick="openConversation('${_escape(c.id)}');render()"><div style="font-weight:700;color:${T.text};">${_escape(c.title||('Conversation '+c.id))}</div><div style="font-size:11px;color:${T.muted};">${_escape(c.created_at||'')}</div></div>`).join('') || `<div style="color:${T.muted2};padding:12px;">No conversations yet. Start with a day dump, a planning question, or “what can you do?”.</div>`;
      const msgs = activeConversationId ? (chatMessages[activeConversationId] || []) : [];
      const msgsHtml = msgs.map(m => {
        const role = _escape(m.role||'');
        const body = _escape(m.response || m.prompt || '');
        const pendingStyle = m.pending ? `opacity:.72;font-style:italic;` : '';
        if(role==='assistant'){
          const prov = _escape((m.provider||'') + (m.model?(' / '+m.model):''));
          return `<div style="margin-bottom:10px;"><div style="font-size:12px;color:${T.muted};font-weight:700;">Assistant <span style='font-size:11px;color:${T.muted2};font-weight:400;margin-left:8px;'>${prov}</span></div><div style="background:${T.surface3};padding:10px;border-radius:8px;margin-top:6px;font-family:DM Mono,monospace;font-size:13px;color:${T.text};white-space:pre-wrap;${pendingStyle}">${body}</div>${_proposalHtml(m)}</div>`;
        }
        return `<div style="margin-bottom:10px;"><div style="font-size:12px;color:${T.muted};font-weight:700;">User</div><div style="padding:8px;border-radius:6px;margin-top:6px;background:${T.surface};font-size:13px;color:${T.text};white-space:pre-wrap;">${body}</div></div>`;
      }).join('') || `<div style="color:${T.muted2};padding:12px;line-height:1.45;">Ask me to plan your day, break down a task, sort a messy brain dump, or explain what Focus can do. I will propose changes for review before anything is added.</div>`;

      return `
      <div onclick="if(event.target===this){showChatModal=false;render()}" style="position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:1250;display:flex;align-items:center;justify-content:center;padding:16px;">
        <div onclick="event.stopPropagation()" style="background:${T.surface};border:1.5px solid ${T.border2};border-radius:12px;padding:12px;width:100%;max-width:980px;box-sizing:border-box;max-height:86vh;overflow:auto;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:8px;">
            <div>
              <div style="font-size:15px;font-weight:800;color:${T.text};">Focus Assistant</div>
              <div style="font-size:11px;color:${T.muted2};margin-top:2px;">App-aware chat through Spectra. Suggestions are review-first.</div>
            </div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end;">
              <button onclick="startNewChat()" style="${btnStyle('accent','font-size:12px;padding:6px 10px;')}">New chat</button>
              <button onclick="deleteActiveChat()" style="${btnStyle('danger','font-size:12px;padding:6px 10px;')}">Delete chat</button>
              <button onclick="clearAllChats()" style="${btnStyle('default','font-size:12px;padding:6px 10px;')}">Clear all</button>
              <button onclick="showChatModal=false;render()" style="${btnStyle('default','font-size:12px;padding:6px 10px;')}">Close</button>
            </div>
          </div>
          <div style="display:flex;gap:12px;">
            <div style="width:260px;max-height:60vh;overflow:auto;border-right:1px solid ${T.border};padding-right:8px;">${convsHtml}</div>
            <div style="flex:1;display:flex;flex-direction:column;max-height:60vh;">
              <div id="chat-messages" style="flex:1;overflow:auto;padding:8px;">${msgsHtml}</div>
              <div style="margin-top:10px;display:flex;flex-direction:column;gap:8px;">
                <div style="display:flex;gap:8px;align-items:center;">
                  <input id="chat-composer" data-no-clobber="true" placeholder="Paste a messy day dump, ask for a schedule, or ask what Focus can do…" value="${_escape(chatComposerText||'')}" oninput="chatComposerText=this.value" onkeydown="if(event.key==='Enter'){sendChatPrompt();event.preventDefault();}" style="${inputStyle('flex:1;min-width:0;font-size:13px;')};" />
                  <button onclick="sendChatPrompt();render();" style="${btnStyle('accent','font-size:13px;padding:8px 12px;')}">Send</button>
                </div>
                <div style="font-size:11px;color:${T.muted2};line-height:1.45;">Try: “Here is my day dump…” or “schedule my day gently”. I can propose tasks and schedule blocks, then you choose Apply.</div>
              </div>
            </div>
          </div>
        </div>
      </div>`;
    };
    window.renderChatModalHtml.__spectraChatWrapped = true;
    return true;
  }

  _loadChatState();
  setTimeout(() => {
    if (!_patchChatRenderer()) setTimeout(_patchChatRenderer, 100);
  }, 0);
})();
