/*
MODULE: focus_header_controls.js
LAYER: render patch
PURPOSE: Replace the crowded icon-only Focus header with labelled Plan day, Focus mode, Log, Assistant, and Manage controls.
USES: render.js header output plus existing global actions from wizard, AI, files, settings, import, widgets, export, logger, and theme controls.
INVARIANTS: Does not remove underlying actions; groups existing controls by user intention; keeps Focus mode visible as a major state switch.
LAST_STABILIZED: 2026-06-27
*/
(function(){
  if(typeof window==='undefined') return;

  const originalRender = typeof render==='function' ? render : null;
  const originalRenderNow = typeof renderNow==='function' ? renderNow : null;

  function safeText(value){
    return String(value==null?'':value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function installFocusHeaderStyles(){
    if(document.getElementById('focus-header-controls-styles')) return;
    const style=document.createElement('style');
    style.id='focus-header-controls-styles';
    style.textContent=`
      .focus-header-controls{flex-wrap:wrap;justify-content:flex-end;row-gap:7px;}
      .focus-header-menu{position:relative;display:inline-flex;}
      .focus-header-menu>summary{list-style:none;}
      .focus-header-menu>summary::-webkit-details-marker{display:none;}
      .focus-header-menu[open]>summary{filter:brightness(1.04);}
      .focus-header-menu-panel{position:absolute;right:0;top:calc(100% + 8px);z-index:8600;min-width:236px;display:grid;gap:6px;padding:9px;border-radius:12px;box-shadow:0 14px 48px rgba(0,0,0,.24);}
      .focus-header-menu-panel .focus-header-menu-note{margin:2px 4px 0;font-size:10px;line-height:1.35;}
      .focus-header-menu-panel button{justify-content:flex-start;width:100%;text-align:left;}
      .focus-header-menu-panel .focus-header-danger{margin-top:4px;}
      @media(max-width:680px){
        .focus-header-controls{justify-content:flex-start;width:100%;gap:6px!important;margin-top:8px;}
        .focus-header-menu-panel{left:0;right:auto;min-width:min(260px,calc(100vw - 28px));}
      }
    `;
    document.head.appendChild(style);
  }

  function closeFocusHeaderMenus(){
    document.querySelectorAll('.focus-header-menu[open]').forEach(menu=>{menu.open=false;});
  }
  window.closeFocusHeaderMenus=closeFocusHeaderMenus;

  function buttonHtml(onclick,label,icon,variant='default',extraClass=''){
    return `<button class="${extraClass}" type="button" onclick="${onclick};closeFocusHeaderMenus()" style="${btnStyle(variant,'font-size:12px;padding:7px 10px;border-radius:9px;')}"><i class="ti ${icon}"></i>${safeText(label)}</button>`;
  }

  function topButtonStyle(variant='default'){
    return btnStyle(variant,'font-size:12px;padding:7px 11px;border-radius:999px;min-height:31px;font-weight:700;');
  }

  function menuHtml(label,icon,items,note){
    if(!items.filter(Boolean).length) return '';
    return `<details class="focus-header-menu">
      <summary style="${topButtonStyle('default')}"><i class="ti ${icon}"></i>${safeText(label)}</summary>
      <div class="focus-header-menu-panel" style="background:${T.surface};border:1.5px solid ${T.border2};">
        ${items.filter(Boolean).join('')}
        ${note?`<p class="focus-header-menu-note" style="color:${T.muted2};">${safeText(note)}</p>`:''}
      </div>
    </details>`;
  }

  function optionalButton(fnName,onclick,label,icon,variant='default',extraClass=''){
    return typeof window[fnName]==='function' ? buttonHtml(onclick,label,icon,variant,extraClass) : '';
  }

  function hiddenWidgetButton(){
    const count=typeof widgetLayout!=='undefined'&&Array.isArray(widgetLayout)?widgetLayout.filter(w=>!w.visible).length:0;
    if(!count||typeof openWidgetDrawer!=='function') return '';
    return buttonHtml('openWidgetDrawer()','Hidden widgets ('+count+')','ti-layout-grid-add');
  }

  function logTopButton(){
    if(typeof openDayLogModal!=='function') return '';
    const summary=typeof getDayLogHeaderSummary==='function'?getDayLogHeaderSummary():'Log';
    const label=summary&&summary!=='Log'?`Log · ${summary}`:'Log';
    return `<button type="button" onclick="openDayLogModal();closeFocusHeaderMenus()" title="Open Day Log" style="${btnStyle('default','font-size:12px;padding:7px 11px;border-radius:999px;min-height:31px;font-weight:700;')}"><i class="ti ti-calendar-stats"></i>${safeText(label)}</button>`;
  }

  function patchFocusHeaderControls(){
    if(typeof crisisMode!=='undefined'&&crisisMode) return;
    const root=document.getElementById('root');
    if(!root) return;
    const dateEl=root.querySelector('.header-date');
    if(!dateEl) return;
    const controls=dateEl.parentElement;
    if(!controls||controls.dataset.focusHeaderGrouped==='1') return;

    installFocusHeaderStyles();
    const dateLabel=dateEl.textContent||'';
    controls.dataset.focusHeaderGrouped='1';
    controls.classList.add('focus-header-controls');
    controls.style.display='flex';
    controls.style.alignItems='center';
    controls.style.gap='8px';

    const planItems=[
      typeof wizOpenFromHeader==='function'?buttonHtml('wizOpenFromHeader()','Open day wizard','ti-sun-high','accent'): '',
      typeof dumpAiDailyPlan==='function'?buttonHtml('dumpAiDailyPlan()','AI daily plan','ti-list-check'): '',
      typeof openEpkImport==='function'?buttonHtml('openEpkImport()','Review EPK import','ti-inbox'): ''
    ];

    const assistantItems=[
      optionalButton('openChatModal','openChatModal()','Chat','ti-message-circle'),
      optionalButton('toggleListenMode','toggleListenMode()',typeof listenModeActive!=='undefined'&&listenModeActive?'Stop listening':'Voice listen',typeof listenModeActive!=='undefined'&&listenModeActive?'ti-microphone-off':'ti-microphone',typeof listenModeActive!=='undefined'&&listenModeActive?'accent2':'default'),
      optionalButton('openAiSettings','openAiSettings()','AI settings','ti-sparkles',typeof aiSettings!=='undefined'&&aiSettings.masterEnabled?'accent2':'default')
    ];

    const manageItems=[
      optionalButton('openFileManager','openFileManager()','Files','ti-folder'),
      hiddenWidgetButton(),
      optionalButton('openSettings','openSettings()','Settings','ti-settings'),
      optionalButton('openFocusSetup','openFocusSetup()','Setup guide','ti-compass'),
      typeof toggleDark==='function'?buttonHtml('toggleDark()',typeof darkMode!=='undefined'&&darkMode?'Light theme':'Dark theme',typeof darkMode!=='undefined'&&darkMode?'ti-sun':'ti-moon'): '',
      optionalButton('exportFullBackup','exportFullBackup()','Backup data','ti-download'),
      optionalButton('factoryResetWithBackupPrompt','factoryResetWithBackupPrompt()','Factory reset…','ti-alert-triangle','danger','focus-header-danger')
    ];

    const focusButton=typeof enterCrisisMode==='function'
      ? `<button type="button" onclick="enterCrisisMode()" style="${btnStyle('accent2','font-size:12px;padding:7px 12px;border-radius:999px;min-height:31px;font-weight:800;')}"><i class="ti ti-focus-2"></i>Focus mode</button>`
      : '';

    controls.innerHTML=`
      <span class="header-date" style="font-size:11px;color:${T.muted};">${safeText(dateLabel)}</span>
      ${menuHtml('Plan day','ti-calendar-check',planItems,'Shape today: wizard, AI plan, or reviewed imports.')}
      ${focusButton}
      ${logTopButton()}
      ${menuHtml('Assistant','ti-sparkles',assistantItems,'Chat, voice, and AI setup live together here.')}
      ${menuHtml('Manage','ti-adjustments-horizontal',manageItems,'App setup, layout, files, backup, and safe reset controls.')}
    `;
  }

  function scheduleFocusHeaderPatch(){
    requestAnimationFrame(()=>requestAnimationFrame(patchFocusHeaderControls));
  }

  if(originalRender){
    render=function(){
      const result=originalRender.apply(this,arguments);
      scheduleFocusHeaderPatch();
      return result;
    };
  }
  if(originalRenderNow){
    renderNow=function(){
      const result=originalRenderNow.apply(this,arguments);
      scheduleFocusHeaderPatch();
      return result;
    };
  }

  document.addEventListener('DOMContentLoaded',()=>{
    scheduleFocusHeaderPatch();
    setTimeout(scheduleFocusHeaderPatch,250);
  });

  document.addEventListener('click',event=>{
    if(!event.target.closest?.('.focus-header-menu')) closeFocusHeaderMenus();
  },true);
})();
