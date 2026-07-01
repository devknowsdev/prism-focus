/*
MODULE: widget_catalog_patch.js
LAYER: ui patch
PURPOSE: Categorise widgets and make hidden/restorable widgets easier to find as the app grows.
USES: widget_registry.js, core.js widget drawer, storage.js widget layout
INVARIANTS: System/non-pinnable hidden surfaces stay out of the drawer and hidden-count UI; Music Tools are hidden on first upgraded load.
LAST_STABILIZED: 2026-06-27
*/
(function(){
  const CATEGORY_ORDER=['Core focus','Planning','Capture','Routines','Creative tools','System'];
  const CATEGORY_META={
    'Core focus':{icon:'ti-focus-2',note:'Do and track current work.'},
    'Planning':{icon:'ti-calendar-check',note:'Shape today and upcoming work.'},
    'Capture':{icon:'ti-notebook',note:'Write, capture, and process thoughts.'},
    'Routines':{icon:'ti-repeat',note:'Habits and repeated support.'},
    'Creative tools':{icon:'ti-music',note:'Optional creative/practice tools.'},
    'System':{icon:'ti-settings',note:'Advanced or metadata surfaces.'},
  };

  function _escape(value){
    if(typeof esc==='function') return esc(String(value ?? ''));
    return String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function _setDef(id, patch){
    const def=typeof getWidgetDef==='function'?getWidgetDef(id):null;
    if(def) Object.assign(def,patch);
  }

  function categoriseWidgets(){
    _setDef('tasks',{category:'Core focus',description:'Main task list and task controls.'});
    _setDef('focusboard',{category:'Core focus',description:'Focus board, timer, and current work context.'});
    _setDef('planner',{category:'Planning',description:'Day planner and scheduling surface.'});
    _setDef('journal',{category:'Capture',description:'Journal capture and reviewed task promotion.'});
    _setDef('habits',{category:'Routines',description:'Habits, daily tasks, and repeated support.'});
    _setDef('tools',{category:'Creative tools',description:'Optional metronome, tuner, and keyboard tools.',defaultVisible:false,pinnable:true});
    _setDef('checkin',{category:'System',description:'Legacy/optional check-in surface.',defaultVisible:false,pinnable:false});
    _setDef('daylog',{category:'System',description:'Day Log metadata/history, opened from the top-level Log button.',defaultVisible:false,pinnable:false});
  }

  function _dropHiddenSystemWidgets(){
    if(!Array.isArray(widgetLayout)) return;
    widgetLayout=widgetLayout.filter(w=>{
      const def=typeof getWidgetDef==='function'?getWidgetDef(w.id):null;
      return w.visible || (def&&def.pinnable);
    });
  }

  function patchWidgetLayoutLoader(){
    if(typeof loadWidgetLayout!=='function'||loadWidgetLayout.__widgetCatalogPatched) return false;
    const originalLoadWidgetLayout=loadWidgetLayout;
    loadWidgetLayout=function patchedWidgetCatalogLayout(){
      originalLoadWidgetLayout();
      categoriseWidgets();
      try{
        if(localStorage.getItem('adhd4_music_tools_hidden_default_v1')!=='1'){
          const toolsItem=widgetLayout.find(w=>w.id==='tools');
          if(toolsItem){
            toolsItem.visible=false;
            toolsItem.collapsed=true;
          }
          localStorage.setItem('adhd4_music_tools_hidden_default_v1','1');
        }
        _dropHiddenSystemWidgets();
      }catch(e){console.warn('Widget catalogue layout migration failed',e);}
    };
    loadWidgetLayout.__widgetCatalogPatched=true;
    return true;
  }

  function patchWidgetDrawer(){
    if(typeof renderWidgetDrawerHtml!=='function'||renderWidgetDrawerHtml.__widgetCatalogPatched) return false;
    renderWidgetDrawerHtml=function renderCategorisedWidgetDrawerHtml(){
      const hidden=(widgetLayout||[])
        .filter(w=>!w.visible&&getWidgetDef(w.id)?.pinnable)
        .map(w=>({state:w,def:getWidgetDef(w.id)}))
        .filter(x=>x.def);
      if(!hidden.length) return '';

      const groups={};
      hidden.forEach(item=>{
        const cat=item.def.category||'Other';
        if(!groups[cat]) groups[cat]=[];
        groups[cat].push(item);
      });
      const groupNames=[...CATEGORY_ORDER,...Object.keys(groups).filter(c=>!CATEGORY_ORDER.includes(c))].filter(c=>groups[c]&&groups[c].length);

      const groupHtml=groupNames.map(cat=>{
        const meta=CATEGORY_META[cat]||{icon:'ti-layout-grid-add',note:''};
        const rows=groups[cat].map(({state,def})=>`
          <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid ${T.border};">
            <i class="ti ${def.icon}" style="color:${T.muted};font-size:16px;flex-shrink:0;"></i>
            <div style="flex:1;min-width:0;">
              <div style="font-size:13px;font-weight:800;color:${T.text};">${_escape(def.label||state.id)}</div>
              ${def.description?`<div style="font-size:10px;color:${T.muted2};line-height:1.35;margin-top:1px;">${_escape(def.description)}</div>`:''}
            </div>
            <button onclick="restoreWidget('${_escape(state.id)}')" style="${btnStyle('accent','font-size:11px;padding:5px 10px;')}"><i class="ti ti-eye"></i> Show</button>
          </div>`).join('');
        return `<div style="margin-bottom:12px;">
          <div style="display:flex;align-items:center;gap:6px;font-size:11px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:${T.muted};margin-bottom:3px;">
            <i class="ti ${meta.icon}"></i>${_escape(cat)}
          </div>
          ${meta.note?`<div style="font-size:10px;color:${T.muted2};margin-bottom:5px;">${_escape(meta.note)}</div>`:''}
          ${rows}
        </div>`;
      }).join('');

      return `<div onclick="if(event.target===this)closeWidgetDrawer()" style="position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;">
        <div style="background:${T.surface};border:1.5px solid ${T.border2};border-radius:16px;padding:20px;width:100%;max-width:460px;box-sizing:border-box;max-height:86vh;overflow:auto;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <div>
              <div style="font-size:15px;font-weight:900;color:${T.text};">Widgets</div>
              <div style="font-size:11px;color:${T.muted2};margin-top:1px;">Choose optional surfaces by category.</div>
            </div>
            <button onclick="closeWidgetDrawer()" style="${btnStyle('default','padding:5px 9px;font-size:14px;')}"><i class="ti ti-x"></i></button>
          </div>
          ${groupHtml}
        </div>
      </div>`;
    };
    renderWidgetDrawerHtml.__widgetCatalogPatched=true;
    return true;
  }

  function install(){
    categoriseWidgets();
    _dropHiddenSystemWidgets();
    patchWidgetLayoutLoader();
    patchWidgetDrawer();
  }

  install();
  setTimeout(install,0);
  setTimeout(install,100);
})();
