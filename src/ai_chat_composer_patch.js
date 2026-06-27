/*
MODULE: ai_chat_composer_patch.js
LAYER: ui patch
PURPOSE: Upgrade Focus chat composer to textarea: Enter sends, Shift+Enter inserts a line break.
USES: ai_chat_spectra_bridge.js, ai_chat_repaint_patch.js
INVARIANTS: Does not change AI routing or task/planner write safety.
LAST_STABILIZED: 2026-06-27
*/
(function(){
  function composerStyle(){
    if (typeof inputStyle === 'function') {
      return inputStyle('flex:1;min-width:0;font-size:13px;line-height:1.35;resize:vertical;min-height:40px;max-height:140px;padding-top:9px;padding-bottom:9px;');
    }
    return 'flex:1;min-width:0;font-size:13px;line-height:1.35;resize:vertical;min-height:40px;max-height:140px;padding:9px;border-radius:8px;';
  }

  function autoSize(el){
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(140, Math.max(40, el.scrollHeight)) + 'px';
  }

  function upgradeComposer(){
    const current = document.getElementById('chat-composer');
    if (!current || current.tagName === 'TEXTAREA') {
      if (current) autoSize(current);
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
      autoSize(textarea);
    });

    textarea.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      if (event.shiftKey) {
        setTimeout(() => {
          chatComposerText = textarea.value;
          autoSize(textarea);
        }, 0);
        return;
      }

      event.preventDefault();
      chatComposerText = textarea.value;
      if (String(chatComposerText || '').trim()) {
        if (typeof sendChatPrompt === 'function') sendChatPrompt();
        if (typeof syncChatPane === 'function') setTimeout(() => syncChatPane(true), 0);
      }
    });

    current.replaceWith(textarea);
    autoSize(textarea);
  }

  window.upgradeChatComposer = upgradeComposer;
  setInterval(upgradeComposer, 250);
  setTimeout(upgradeComposer, 0);
  setTimeout(upgradeComposer, 100);
})();
