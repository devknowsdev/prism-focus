// Low-risk accessibility fixes applied at DOMContentLoaded.
// Sets aria-label on inputs/selects/textareas that lack an accessible name,
// using placeholder, name, id or type as a fallback. This is a pragmatic
// patch to address automated a11y findings (missing labels) without touching
// many render files.

(function(){
  function ensureAriaLabel(el){
    if (!el || el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby')) return;
    // prefer explicit attributes
    const placeholder = el.getAttribute('placeholder');
    const title = el.getAttribute('title');
    const name = el.getAttribute('name') || el.id || el.getAttribute('data-name');
    if (placeholder) { el.setAttribute('aria-label', placeholder); return; }
    if (title) { el.setAttribute('aria-label', title); return; }
    if (name) { el.setAttribute('aria-label', name); return; }
    // final fallback: type or tag
    const t = el.getAttribute('type') || el.tagName.toLowerCase();
    el.setAttribute('aria-label', t);
  }

  function run(){
    try{
      const sel = 'input:not([aria-label]):not([aria-labelledby]), textarea:not([aria-label]):not([aria-labelledby]), select:not([aria-label]):not([aria-labelledby])';
      document.querySelectorAll(sel).forEach(ensureAriaLabel);
      // specialist controls often created dynamically; observe for additions
      const mo = new MutationObserver((records)=>{
        for(const r of records){
          r.addedNodes && r.addedNodes.forEach(node=>{
            if(!(node instanceof Element)) return;
            if(node.matches && node.matches(sel)) ensureAriaLabel(node);
            node.querySelectorAll && node.querySelectorAll(sel).forEach(ensureAriaLabel);
          });
        }
      });
      mo.observe(document.documentElement || document.body, {childList:true, subtree:true});
    }catch(e){
      // keep silent — this helper must not break app
      console.warn('a11y-fixes failed', e);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
