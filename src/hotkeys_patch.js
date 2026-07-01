/*
MODULE: hotkeys_patch.js
LAYER: ui/action patch
PURPOSE: Add a safe baseline hotkey registry and Settings UI for assigning app-function shortcuts.
USES: render_modals.js settings modal, existing global app actions
INVARIANTS: Hotkeys call only whitelisted app functions; plain typing in inputs is ignored.
LAST_STABILIZED: 2026-06-27
*/
(function(){
  const STORAGE_KEY='adhd4_hotkeys_v1';
  let hotkeyCaptureActionId=null;

  const HOTKEY_ACTIONS=[
    {id:'assistant.chat',label:'Open chat',category:'Assistant',fn:'openChatModal',suggested:'ctrl+alt+c'},
    {id:'assistant.planDay',label:'Plan day wizard',category:'Assistant',fn:'wizOpenFromHeader',suggested:'ctrl+alt+p'},
    {id:'assistant.aiPlan',label:'AI daily plan',category:'Assistant',fn:'dumpAiDailyPlan',suggested:'ctrl+alt+a'},
    {id:'assistant.voice',label:'Toggle voice listen',category:'Assistant',fn:'toggleListenMode',suggested:''},
    {id:'focus.mode',label:'Focus mode',category:'Focus',fn:'enterCrisisMode',suggested:'ctrl+alt+f'},
    {id:'log.open',label:'Open Day Log',category:'Log',fn:'openDayLogModal',suggested:'ctrl+alt+l'},
    {id:'log.quick',label:'Quick-log focused task',category:'Log',fn:'openQuickLogForFocus',suggested:'ctrl+alt+q'},
    {id:'manage.settings',label:'Open Settings',category:'Manage',fn:'openSettings',suggested:'ctrl+alt+,'},
    {id:'manage.files',label:'Open Files',category:'Manage',fn:'openFileManager',suggested:''},
    {id:'manage.widgets',label:'Open Widgets drawer',category:'Manage',fn:'openWidgetDrawer',suggested:'ctrl+alt+w'},
  ];

  function _escape(value){
    if(typeof esc==='function') return esc(String(value ?? ''));
    return String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function _loadHotkeys(){
    try{
      const raw=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');
      return raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
    }catch(e){return {};}
  }

  function _saveHotkeys(map){
    localStorage.setItem(STORAGE_KEY,JSON.stringify(map||{}));
  }

  function _comboFromEvent(event){
    const parts=[];
    if(event.ctrlKey) parts.push('ctrl');
    if(event.altKey) parts.push('alt');
    if(event.shiftKey) parts.push('shift');
    if(event.metaKey) parts.push('meta');
    let key=String(event.key||'').toLowerCase();
    const aliases={' ':'space','escape':'esc','arrowup':'up','arrowdown':'down','arrowleft':'left','arrowright':'right'};
    key=aliases[key]||key;
    if(['control','shift','alt','meta'].includes(key)) return '';
    parts.push(key);
    return parts.join('+');
  }

  function _labelCombo(combo){
    return String(combo||'').split('+').filter(Boolean).map(p=>{
      if(p==='ctrl') return 'Ctrl';
      if(p==='alt') return 'Alt';
      if(p==='shift') return 'Shift';
      if(p==='meta') return 'Cmd';
      if(p==='esc') return 'Esc';
      return p.length===1?p.toUpperCase():p.charAt(0).toUpperCase()+p.slice(1);
    }).join(' + ');
  }

  function _actionById(id){ return HOTKEY_ACTIONS.find(a=>a.id===id); }

  function _actionAvailable(action){
    if(action.id==='log.quick') return typeof openQuickLog==='function';
    return typeof window[action.fn]==='function';
  }

  function _runAction(action){
    if(!action) return false;
    if(action.id==='log.quick'){
      if(typeof openQuickLog==='function'){
        openQuickLog(typeof focusTaskId!=='undefined'?focusTaskId:null,0,Date.now());
        return true;
      }
      return false;
    }
    const fn=window[action.fn];
    if(typeof fn==='function'){
      fn();
      return true;
    }
    return false;
  }

  function _assignedComboFor(actionId){
    const map=_loadHotkeys();
    return map[actionId]||'';
  }

  window.hotkeyStartCapture=function hotkeyStartCapture(actionId){
    hotkeyCaptureActionId=actionId;
    if(typeof showToast==='function') showToast('Press the shortcut keys now…','ok');
    if(typeof render==='function') render();
  };

  window.hotkeyClear=function hotkeyClear(actionId){
    const map=_loadHotkeys();
    delete map[actionId];
    _saveHotkeys(map);
    if(typeof render==='function') render();
  };

  window.hotkeyApplySuggestedTemplate=function hotkeyApplySuggestedTemplate(){
    const next={};
    HOTKEY_ACTIONS.forEach(action=>{ if(action.suggested) next[action.id]=action.suggested; });
    _saveHotkeys(next);
    if(typeof showToast==='function') showToast('Suggested hotkeys applied','ok');
    if(typeof render==='function') render();
  };

  window.hotkeyClearAll=function hotkeyClearAll(){
    _saveHotkeys({});
    if(typeof showToast==='function') showToast('Hotkeys cleared','ok');
    if(typeof render==='function') render();
  };

  function _renderHotkeySettingsHtml(){
    const map=_loadHotkeys();
    const groups={};
    HOTKEY_ACTIONS.forEach(action=>{
      if(!groups[action.category]) groups[action.category]=[];
      groups[action.category].push(action);
    });
    const rows=Object.keys(groups).map(category=>`
      <div style="margin-top:10px;">
        <div style="font-size:10px;font-weight:900;color:${T.muted};letter-spacing:.08em;text-transform:uppercase;margin-bottom:5px;">${_escape(category)}</div>
        ${groups[category].map(action=>{
          const combo=map[action.id]||'';
          const capturing=hotkeyCaptureActionId===action.id;
          const available=_actionAvailable(action);
          return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid ${T.border};">
            <div style="flex:1;min-width:0;">
              <div style="font-size:12px;font-weight:800;color:${available?T.text:T.muted2};">${_escape(action.label)}</div>
              <div style="font-size:10px;color:${T.muted2};">${available?'ready':'function not currently available'}${action.suggested?` · suggested ${_escape(_labelCombo(action.suggested))}`:''}</div>
            </div>
            <button onclick="hotkeyStartCapture('${_escape(action.id)}')" style="${btnStyle(capturing?'accent2':'default','font-size:11px;padding:5px 9px;min-width:96px;justify-content:center;')}">
              ${capturing?'Press keys…':(combo?_escape(_labelCombo(combo)):'Set')}
            </button>
            ${combo?`<button onclick="hotkeyClear('${_escape(action.id)}')" title="Clear hotkey" style="${btnStyle('default','font-size:11px;padding:5px 8px;')}"><i class="ti ti-x"></i></button>`:''}
          </div>`;
        }).join('')}
      </div>`).join('');

    return `<div id="hotkey-settings-section" style="margin-top:14px;padding-top:12px;border-top:1.5px solid ${T.border};">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;">
        <div>
          <div style="font-size:14px;font-weight:900;color:${T.text};"><i class="ti ti-keyboard"></i> Hotkeys</div>
          <div style="font-size:10px;color:${T.muted2};margin-top:2px;line-height:1.4;">Assign shortcuts to whitelisted app functions. Typing in inputs is ignored.</div>
        </div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">
        <button onclick="hotkeyApplySuggestedTemplate()" style="${btnStyle('default','font-size:11px;padding:5px 10px;')}"><i class="ti ti-template"></i> Apply suggested template</button>
        <button onclick="hotkeyClearAll()" style="${btnStyle('default','font-size:11px;padding:5px 10px;')}"><i class="ti ti-eraser"></i> Clear all</button>
      </div>
      ${rows}
    </div>`;
  }

  function patchSettings(){
    if(typeof renderSettingsModalHtml!=='function'||renderSettingsModalHtml.__hotkeysPatched) return false;
    const original=renderSettingsModalHtml;
    renderSettingsModalHtml=function renderSettingsWithHotkeys(){
      const html=original.apply(this,arguments);
      const insert=_renderHotkeySettingsHtml();
      return String(html).replace(/\s*<\/div>\s*<\/div>\s*$/s, `${insert}\n    </div>\n  </div>`);
    };
    renderSettingsModalHtml.__hotkeysPatched=true;
    return true;
  }

  document.addEventListener('keydown',event=>{
    const combo=_comboFromEvent(event);
    if(!combo) return;

    if(hotkeyCaptureActionId){
      event.preventDefault();
      event.stopPropagation();
      const map=_loadHotkeys();
      Object.keys(map).forEach(id=>{ if(map[id]===combo) delete map[id]; });
      map[hotkeyCaptureActionId]=combo;
      _saveHotkeys(map);
      hotkeyCaptureActionId=null;
      if(typeof showToast==='function') showToast('Hotkey saved: '+_labelCombo(combo),'ok');
      if(typeof render==='function') render();
      return;
    }

    const target=event.target;
    if(target&&target.closest?.('input,textarea,select,[contenteditable="true"],[data-no-clobber="true"]')) return;
    const map=_loadHotkeys();
    const actionId=Object.keys(map).find(id=>map[id]===combo);
    if(!actionId) return;
    const action=_actionById(actionId);
    if(!action||!_actionAvailable(action)) return;
    event.preventDefault();
    event.stopPropagation();
    _runAction(action);
  },true);

  function install(){ patchSettings(); }
  install();
  setTimeout(install,0);
  setTimeout(install,100);
})();
