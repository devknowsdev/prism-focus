/*
MODULE: ai_chat_repaint_patch.js
LAYER: ui patch
PURPOSE: Keep the visible Focus chat message pane in sync when async Spectra responses arrive, and upgrade the composer shortcuts.
USES: ai_chat_spectra_bridge.js state globals, render.js optional fallback
INVARIANTS: Does not weaken global data-no-clobber render protection; directly updates only #chat-messages and #chat-composer.
LAST_STABILIZED: 2026-06-27
*/
(function(){
  let lastPaneSignature = '';

  function _escape(value) {
    if (typeof esc === 'function') return esc(String(value ?? ''));
    return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
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
    };
  }

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

  function _messagesHtml(messages){
    if (!messages || !messages.length) {
      return `<div style="color:${T.muted2};padding:12px;line-height:1.45;">Ask me to plan your day, break down a task, sort a messy brain dump, or explain what Focus can do. I will propose changes for review before anything is added.</div>`;
    }

    return messages.map(m => {
      const role = _escape(m.role || '');
      const body = _escape(m.response || m.prompt || '');
      const pendingStyle = m.pending ? 'opacity:.72;font-style:italic;' : '';
      if (role === 'assistant') {
        const prov = _escape((m.provider || '') + (m.model ? (' / ' + m.model) : ''));
        return `<div style="margin-bottom:10px;" data-chat-message-id="${_escape(m.id || '')}"><div style="font-size:12px;color:${T.muted};font-weight:700;">Assistant <span style="font-size:11px;color:${T.muted2};font-weight:400;margin-left:8px;">${prov}</span></div><div style="background:${T.surface3};padding:10px;border-radius:8px;margin-top:6px;font-family:DM Mono,monospace;font-size:13px;color:${T.text};white-space:pre-wrap;${pendingStyle}">${body}</div>${_proposalHtml(m)}</div>`;
      }
      return `<div style="margin-bottom:10px;" data-chat-message-id="${_escape(m.id || '')}"><div style="font-size:12px;color:${T.muted};font-weight:700;">User</div><div style="padding:8px;border-radius:6px;margin-top:6px;background:${T.surface};font-size:13px;color:${T.text};white-space:pre-wrap;">${body}</div></div>`;
    }).join('');
  }

  function composerStyle(){
    if (typeof inputStyle === 'function') {
      return inputStyle('flex:1;min-width:0;font-size:13px;line-height:1.35;resize:vertical;min-height:40px;max-height:140px;padding-top:9px;padding-bottom:9px;');
    }
    return 'flex:1;min-width:0;font-size:13px;line-height:1.35;resize:vertical;min-height:40px;max-height:140px;padding:9px;border-radius:8px;';
  }

  function autoSizeComposer(el){
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(140, Math.max(40, el.scrollHeight)) + 'px';
  }

  function upgradeChatComposer(){
    try {
      const current = document.getElementById('chat-composer');
      if (!current) return;
      if (current.tagName === 'TEXTAREA') {
        autoSizeComposer(current);
        return;
      }

      const textarea = document.createElement('textarea');
      textarea.id = 'chat-composer';
      textarea.setAttribute('data-no-clobber', 'true');
      textarea.rows = 1;
      textarea.placeholder = current.getAttribute('placeholder') || 'Paste a messy day dump, ask for a schedule, or ask what Focus can do…';
      textarea.value = current.value || chatComposerText || '';
      textarea.style.cssText = composerStyle();
      textarea.title = 'Enter sends. Shift+Enter adds a line break.';

      textarea.addEventListener('input', () => {
        chatComposerText = textarea.value;
        autoSizeComposer(textarea);
      });

      textarea.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        if (event.shiftKey) {
          setTimeout(() => {
            chatComposerText = textarea.value;
            autoSizeComposer(textarea);
          }, 0);
          return;
        }

        event.preventDefault();
        chatComposerText = textarea.value;
        if (String(chatComposerText || '').trim()) {
          if (typeof sendChatPrompt === 'function') sendChatPrompt();
          setTimeout(() => syncChatPane(true), 0);
        }
      });

      current.replaceWith(textarea);
      autoSizeComposer(textarea);
    } catch (e) {
      console.warn('upgradeChatComposer failed', e);
    }
  }

  function syncChatPane(force = false){
    try {
      if (!showChatModal || !activeConversationId || !chatMessages) return;
      const pane = document.getElementById('chat-messages');
      if (!pane) return;
      const messages = chatMessages[activeConversationId] || [];
      const signature = activeConversationId + '|' + JSON.stringify(messages.map(m => ({
        id: m.id,
        role: m.role,
        prompt: m.prompt,
        response: m.response,
        pending: !!m.pending,
        provider: m.provider,
        model: m.model,
        proposal: m.proposal,
        applied: !!m.applied,
        dismissed: !!m.dismissed,
      })));

      if (!force && signature === lastPaneSignature) {
        upgradeChatComposer();
        return;
      }
      lastPaneSignature = signature;
      const wasNearBottom = pane.scrollTop + pane.clientHeight >= pane.scrollHeight - 48;
      pane.innerHTML = _messagesHtml(messages);
      if (wasNearBottom || force) pane.scrollTop = pane.scrollHeight;
      upgradeChatComposer();
    } catch (e) {
      console.warn('syncChatPane failed', e);
    }
  }

  function wrapChatAction(name){
    const original = window[name];
    if (typeof original !== 'function' || original.__chatPaneSyncWrapped) return false;
    const wrapped = function(...args){
      syncChatPane(true);
      const result = original.apply(this, args);
      syncChatPane(true);
      if (result && typeof result.then === 'function') {
        return result.finally(() => {
          syncChatPane(true);
          setTimeout(() => syncChatPane(true), 0);
          setTimeout(() => syncChatPane(true), 150);
        });
      }
      setTimeout(() => syncChatPane(true), 0);
      return result;
    };
    wrapped.__chatPaneSyncWrapped = true;
    window[name] = wrapped;
    try { globalThis[name] = wrapped; } catch (e) {}
    return true;
  }

  function install(){
    wrapChatAction('sendChatPrompt');
    wrapChatAction('applyChatProposal');
    wrapChatAction('dismissChatProposal');
    wrapChatAction('startNewChat');
    wrapChatAction('deleteActiveChat');
    wrapChatAction('clearAllChats');
    upgradeChatComposer();
  }

  window.syncChatPane = syncChatPane;
  window.upgradeChatComposer = upgradeChatComposer;
  setInterval(() => syncChatPane(false), 250);
  setInterval(upgradeChatComposer, 250);
  setTimeout(install, 0);
  setTimeout(install, 100);
})();
