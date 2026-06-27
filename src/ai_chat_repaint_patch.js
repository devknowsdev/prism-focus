/*
MODULE: ai_chat_repaint_patch.js
LAYER: ui patch
PURPOSE: Force the Focus chat modal to repaint after async Spectra chat responses arrive.
USES: ai_chat_spectra_bridge.js, render.js
INVARIANTS: Does not weaken global data-no-clobber render protection; only blurs/repaints around chat actions.
LAST_STABILIZED: 2026-06-27
*/
(function(){
  function forceChatRepaint(options = {}){
    const refocus = options.refocus !== false;
    let hadComposerFocus = false;
    try {
      const composer = document.getElementById('chat-composer');
      hadComposerFocus = document.activeElement === composer;
      if (composer) {
        chatComposerText = composer.value || chatComposerText || '';
        composer.blur();
      }
    } catch (e) {}

    try {
      if (typeof renderNow === 'function') renderNow();
      else if (typeof render === 'function') render();
    } catch (e) {
      console.warn('forceChatRepaint failed', e);
    }

    if (refocus && hadComposerFocus) {
      setTimeout(() => {
        const nextComposer = document.getElementById('chat-composer');
        if (nextComposer) nextComposer.focus();
      }, 0);
    }
  }

  function wrapChatAction(name, options = {}){
    const original = window[name];
    if (typeof original !== 'function' || original.__chatRepaintWrapped) return false;
    const wrapped = function(...args){
      const result = original.apply(this, args);
      if (result && typeof result.then === 'function') {
        return result.finally(() => forceChatRepaint(options));
      }
      forceChatRepaint(options);
      return result;
    };
    wrapped.__chatRepaintWrapped = true;
    window[name] = wrapped;
    try { globalThis[name] = wrapped; } catch (e) {}
    return true;
  }

  function install(){
    wrapChatAction('sendChatPrompt', { refocus: true });
    wrapChatAction('applyChatProposal', { refocus: false });
    wrapChatAction('dismissChatProposal', { refocus: true });
    wrapChatAction('startNewChat', { refocus: true });
    wrapChatAction('deleteActiveChat', { refocus: false });
    wrapChatAction('clearAllChats', { refocus: false });
  }

  window.forceChatRepaint = forceChatRepaint;
  setTimeout(install, 0);
  setTimeout(install, 100);
})();
