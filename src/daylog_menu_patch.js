/*
MODULE: daylog_menu_patch.js
LAYER: ui patch
PURPOSE: Move Day Log out of the dashboard widget surface and expose it as a top-level Log modal.
USES: render_daylog.js, storage.js widget layout, focus_header_controls.js
INVARIANTS: Day Log remains local metadata/history; main dashboard stays focused on doing/planning.
LAST_STABILIZED: 2026-06-27
*/
(function(){
  let showDayLogModal=false;

  function _todayStr(){ return new Date().toDateString(); }

  function _trackedTodaySecs(todayStr){
    const work=(timeSessions||[])
      .filter(s=>new Date(s.startedAt).toDateString()===todayStr&&(s.type||'work')==='work')
      .reduce((sum,s)=>sum+(s.seconds||0),0);
    const live=(timerRunning&&activeSession&&activeSession.type!=='break'&&new Date(activeSession.startedAt).toDateString()===todayStr)
      ? Math.max(0,Math.round((Date.now()-activeSession.startedAt)/1000))
      : 0;
    return work+live;
  }

  function _manualLogCount(todayStr){
    return (offTaskLog||[]).filter(e=>e.date===todayStr).length;
  }

  function _workSessionCount(todayStr){
    return (timeSessions||[]).filter(s=>new Date(s.startedAt).toDateString()===todayStr&&(s.type||'work')==='work').length;
  }

  window.getDayLogHeaderSummary = function getDayLogHeaderSummary(){
    const todayStr=_todayStr();
    const secs=_trackedTodaySecs(todayStr);
    const logs=_workSessionCount(todayStr)+_manualLogCount(todayStr);
    const mins=Math.round(secs/60);
    if(mins>0) return `${Math.floor(mins/60)}h ${mins%60}m`;
    return logs?`${logs} log${logs===1?'':'s'}`:'Log';
  };

  window.openDayLogModal = function openDayLogModal(){
    showDayLogModal=true;
    if(typeof render==='function') render();
  };

  window.closeDayLogModal = function closeDayLogModal(){
    showDayLogModal=false;
    if(typeof render==='function') render();
  };

  function _renderDayLogModalHtml(){
    if(!showDayLogModal) return '';
    const now=new Date();
    const todayStr=now.toDateString();
    const body=typeof renderDayLogWidget==='function'
      ? renderDayLogWidget(todayStr,now)
      : `<div style="font-size:12px;color:${T.muted2};">Day Log renderer unavailable.</div>`;

    return `<div onclick="if(event.target===this)closeDayLogModal()" style="position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:1350;display:flex;align-items:center;justify-content:center;padding:16px;">
      <div onclick="event.stopPropagation()" style="background:${T.surface};border:1.5px solid ${T.border2};border-radius:14px;padding:14px;width:100%;max-width:980px;box-sizing:border-box;max-height:88vh;overflow:auto;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;border-bottom:1px solid ${T.border};padding-bottom:10px;">
          <div>
            <div style="font-size:15px;font-weight:900;color:${T.text};display:flex;align-items:center;gap:7px;"><i class="ti ti-calendar-stats" style="color:${T.accent2};"></i>Day Log</div>
            <div style="font-size:11px;color:${T.muted2};margin-top:2px;">Metadata and history for today: tracked time, downtime, manual entries, summaries, and exports.</div>
          </div>
          <button onclick="closeDayLogModal()" style="${btnStyle('default','font-size:12px;padding:6px 10px;')}"><i class="ti ti-x"></i>Close</button>
        </div>
        ${body}
      </div>
    </div>`;
  }

  function _patchRenderForDayLogModal(){
    if(typeof render!=='function'||render.__dayLogModalPatched) return false;
    const originalRender=render;
    render=function(){
      const result=originalRender.apply(this,arguments);
      setTimeout(()=>{
        const root=document.getElementById('root');
        if(root&&!document.getElementById('daylog-modal-host')){
          const host=document.createElement('div');
          host.id='daylog-modal-host';
          root.appendChild(host);
        }
        const host=document.getElementById('daylog-modal-host');
        if(host) host.innerHTML=_renderDayLogModalHtml();
      },0);
      return result;
    };
    render.__dayLogModalPatched=true;
    return true;
  }

  function _patchRenderNowForDayLogModal(){
    if(typeof renderNow!=='function'||renderNow.__dayLogModalPatched) return false;
    const originalRenderNow=renderNow;
    renderNow=function(){
      const result=originalRenderNow.apply(this,arguments);
      setTimeout(()=>{
        const host=document.getElementById('daylog-modal-host');
        if(host) host.innerHTML=_renderDayLogModalHtml();
      },0);
      return result;
    };
    renderNow.__dayLogModalPatched=true;
    return true;
  }

  function _hideDayLogWidget(){
    try{
      const daylogDef=typeof getWidgetDef==='function'?getWidgetDef('daylog'):null;
      if(daylogDef){
        daylogDef.defaultVisible=false;
        daylogDef.pinnable=false;
        daylogDef.label='Day Log';
      }
    }catch(e){console.warn('Day Log def patch failed',e);}
  }

  function _patchLayoutLoader(){
    if(typeof loadWidgetLayout!=='function'||loadWidgetLayout.__dayLogMenuPatched) return false;
    const originalLoadWidgetLayout=loadWidgetLayout;
    loadWidgetLayout=function patchedDayLogLayout(){
      originalLoadWidgetLayout();
      try{
        const daylogItem=widgetLayout.find(w=>w.id==='daylog');
        if(daylogItem){
          daylogItem.visible=false;
          daylogItem.collapsed=true;
        }
      }catch(e){console.warn('Day Log layout patch failed',e);}
    };
    loadWidgetLayout.__dayLogMenuPatched=true;
    return true;
  }

  function install(){
    _hideDayLogWidget();
    _patchLayoutLoader();
    _patchRenderForDayLogModal();
    _patchRenderNowForDayLogModal();
  }

  install();
  setTimeout(install,0);
  setTimeout(install,100);
})();
