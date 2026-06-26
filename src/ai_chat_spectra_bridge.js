/*
MODULE: ai_chat_spectra_bridge.js
LAYER: services/ui bridge
PURPOSE: Route the Focus chat modal through Spectra /api/v1/ai/request instead of the older local-daemon conversation API.
USES: ai_adapter_local.js, state.js chat globals, render_modals.js chat UI
INVARIANTS: Chat requests are read-only; no Focus tasks/planner state are mutated here.
LAST_STABILIZED: 2026-06-27
*/
(function(){
  function _nowIso(){
    try { return new Date().toISOString(); } catch (e) { return ''; }
  }

  function _makeLocalConversation(title){
    const id = Date.now();
    const conv = {
      id,
      title: String(title || 'Chat').slice(0, 80),
      created_at: _nowIso(),
      local_only: true,
    };
    chatConversations = [conv, ...(Array.isArray(chatConversations) ? chatConversations : [])];
    chatMessages[id] = chatMessages[id] || [];
    activeConversationId = id;
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
    if (result.structuredResponse && typeof result.structuredResponse.response === 'string') return result.structuredResponse.response;
    try { return JSON.stringify(result.response || result.structuredResponse || result, null, 2); }
    catch (e) { return ''; }
  }

  function _appendChatMessage(convId, message){
    if (!convId) return;
    chatMessages[convId] = chatMessages[convId] || [];
    chatMessages[convId].push({
      id: `${convId}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      created_at: _nowIso(),
      ...message,
    });
  }

  window.loadConversations = async function loadSpectraLocalConversations(){
    chatConversations = Array.isArray(chatConversations) ? chatConversations : [];
    if (typeof render === 'function') render();
  };

  window.openConversation = async function openSpectraLocalConversation(convId){
    activeConversationId = Number(convId);
    chatMessages[activeConversationId] = chatMessages[activeConversationId] || [];
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
    const history = (chatMessages[convId] || []).slice(-8).map(m => ({
      role: m.role,
      text: m.response || m.prompt || '',
    }));

    chatComposerText = '';
    chatComposerAttachments = [];
    _appendChatMessage(convId, { role: 'user', prompt: text, attachments: '[]' });
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
          instruction: 'Reply conversationally and practically. Do not mutate app state. If you suggest tasks, present them as suggestions only.',
        },
        context: {
          feature: 'focus-chat',
          conversationId: convId,
          appSurface: 'chat-modal',
        },
      });

      if (!result || result.ok === false) {
        throw new Error((result && result.error) || 'Spectra request failed');
      }

      const reply = _extractSpectraText(result).trim() || 'I received that, but no response text was returned.';
      _appendChatMessage(convId, {
        role: 'assistant',
        response: reply,
        provider: result.provider || 'spectra',
        model: result.model || '',
        attachments: '[]',
      });
      showToast('AI responded', 'ok');
    } catch (e) {
      console.error('sendSpectraChatPrompt error', e);
      _appendChatMessage(convId, {
        role: 'assistant',
        response: 'Chat failed through Spectra: ' + (e && e.message ? e.message : String(e)),
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
})();
