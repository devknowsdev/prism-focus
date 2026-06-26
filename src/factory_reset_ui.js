/*
MODULE: factory_reset_ui.js
LAYER: render patch
PURPOSE: Add an explicit backup-gated factory reset control without changing normal persistence/reload behaviour.
USES: render_daylog.js, actions_export.js, widget_registry.js
INVARIANTS: factory reset is visible, user-initiated, backup-prompted, and typed-confirmed; no silent reset on reload.
LAST_STABILIZED: 2026-06-26
*/
(function(){
  const root=(typeof window!=='undefined')?window:globalThis;
  if(typeof renderDayLogWidget!=='function') return;
  const original=renderDayLogWidget;

  function renderDayLogWidgetWithFactoryReset(todayStr,now){
    let html=original(todayStr,now);
    if(html.includes('factoryResetWithBackupPrompt')) return html;
    const marker='<input id="restore-file-input"';
    const resetButton=`<button onclick="factoryResetWithBackupPrompt()" title="Download a backup, then erase local Focus data and restore defaults" style="${btnStyle('danger','font-size:11px;padding:5px 11px;')}"><i class="ti ti-alert-triangle"></i> Factory reset</button>`;
    if(html.includes(marker)){
      html=html.replace(marker,resetButton+'\n          '+marker);
    }
    return html;
  }

  root.renderDayLogWidget=renderDayLogWidgetWithFactoryReset;
  if(typeof globalThis!=='undefined') globalThis.renderDayLogWidget=renderDayLogWidgetWithFactoryReset;

  const def=(typeof getWidgetDef==='function')?getWidgetDef('daylog'):null;
  if(def) def.render=renderDayLogWidgetWithFactoryReset;
})();
