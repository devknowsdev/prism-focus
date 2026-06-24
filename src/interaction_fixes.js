/*
MODULE: interaction_fixes.js
LAYER: runtime
PURPOSE: Browser-only interaction repairs for task rows and planner month hover previews.
OWNS: post-render DOM interaction repair hooks
USES: render.js output, planner state, task state
STATE_READS: tasks, plannerDayDumps, T
STATE_WRITES: tasks, focusTaskId, focusSubtaskId, taskOverflowOpenId, timeSessions
PUBLIC_API: repairFocusInteractions, hidePlannerDayPreview
INVARIANTS: does not create tasks; does not sync external data; repairs event targets after render
LAST_STABILIZED: 2026-06-24
*/

(function(){
  if(typeof window==='undefined'||typeof document==='undefined') return;

  function afterRender(){
    setTimeout(repairFocusInteractions,0);
  }

  function blurActiveNoClobber(){
    const active=document.activeElement;
    if(active&&active.closest?.('[data-no-clobber="true"]')&&typeof active.blur==='function') active.blur();
  }

  function wrapRenderFunction(name){
    const original=window[name];
    if(typeof original!=='function'||original.__interactionFixWrapped) return;
    const wrapped=function(){
      const result=original.apply(this,arguments);
      afterRender();
      return result;
    };
    wrapped.__interactionFixWrapped=true;
    window[name]=wrapped;
    if(typeof globalThis!=='undefined') globalThis[name]=wrapped;
  }

  function wrapPlannerNavigation(name){
    const original=window[name];
    if(typeof original!=='function'||original.__plannerNoClobberWrapped) return;
    const wrapped=function(){
      blurActiveNoClobber();
      const result=original.apply(this,arguments);
      afterRender();
      return result;
    };
    wrapped.__plannerNoClobberWrapped=true;
    window[name]=wrapped;
    if(typeof globalThis!=='undefined') globalThis[name]=wrapped;
  }

  function getTasksList(){
    try{return typeof tasks!=='undefined'?tasks:(window.tasks||[]);}catch(_){return window.tasks||[];}
  }

  function getPlannerDumps(){
    try{return typeof plannerDayDumps!=='undefined'?plannerDayDumps:(window.plannerDayDumps||{});}catch(_){return window.plannerDayDumps||{};}
  }

  function getTheme(){
    try{return typeof T!=='undefined'?T:(window.T||{});}catch(_){return window.T||{};}
  }

  function repairFocusInteractions(){
    moveTaskRowDragToGrip();
    decoratePlannerMonthCells();
  }

  function moveTaskRowDragToGrip(){
    document.querySelectorAll('[data-task-id] > div[draggable="true"]').forEach(row=>{
      const gripIcon=row.querySelector('.ti-grip-vertical');
      const grip=gripIcon?gripIcon.closest('span'):null;
      if(!grip){
        row.setAttribute('draggable','false');
        return;
      }
      ['ondragstart','ondragover','ondrop','ondragend'].forEach(attr=>{
        const value=row.getAttribute(attr);
        if(value&&!grip.getAttribute(attr)) grip.setAttribute(attr,value);
        row.removeAttribute(attr);
      });
      grip.setAttribute('draggable','true');
      grip.setAttribute('title',grip.getAttribute('title')||'drag to reorder');
      grip.style.cursor='grab';
      row.setAttribute('draggable','false');
    });
  }

  function decoratePlannerMonthCells(){
    document.querySelectorAll('td[onclick^="plannerSelectDate"]').forEach(cell=>{
      const onclick=cell.getAttribute('onclick')||'';
      const match=onclick.match(/plannerSelectDate\('([^']+)'\)/);
      if(!match) return;
      const ymd=match[1];
      cell.dataset.plannerDay=ymd;
      cell.setAttribute('title',plannerDayPreviewText(ymd));
      if(cell.dataset.plannerHoverReady==='1') return;
      cell.dataset.plannerHoverReady='1';
      cell.addEventListener('mouseenter',event=>showPlannerDayPreview(ymd,event));
      cell.addEventListener('mousemove',movePlannerDayPreview);
      cell.addEventListener('mouseleave',hidePlannerDayPreview);
    });
  }

  function plannerDayPreviewText(ymd){
    const dumps=((getPlannerDumps()[ymd])||[]).filter(x=>!x.done).map(x=>x.text);
    const scheduled=getTasksList().filter(t=>t.ts&&(t.status||'todo')!=='done').map(t=>`${t.ts} ${t.text}`);
    const lines=[...scheduled,...dumps];
    return lines.length?lines.join('\n'):'No tasks captured for this day yet.';
  }

  function showPlannerDayPreview(ymd,event){
    const lines=plannerDayPreviewText(ymd).split('\n').filter(Boolean);
    let preview=document.getElementById('planner-day-preview');
    if(!preview){
      preview=document.createElement('div');
      preview.id='planner-day-preview';
      preview.style.cssText='position:fixed;z-index:9000;max-width:280px;padding:10px 12px;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.25);pointer-events:none;font-family:Syne,sans-serif;font-size:12px;line-height:1.35;';
      document.body.appendChild(preview);
    }
    const theme=getTheme();
    preview.style.background=theme.surface||'#fff';
    preview.style.color=theme.text||'#111';
    preview.style.border=`1.5px solid ${theme.border2||'#ccd'}`;
    preview.innerHTML=`<div style="font-weight:800;margin-bottom:5px;">${escapeHTML(ymd)}</div>${lines.length?`<ul style="margin:0;padding-left:16px;">${lines.slice(0,8).map(line=>`<li>${escapeHTML(line)}</li>`).join('')}</ul>${lines.length>8?`<div style="margin-top:4px;color:${theme.muted||'#666'};">+${lines.length-8} more</div>`:''}`:`<div style="color:${theme.muted||'#666'};">No tasks captured for this day yet.</div>`}`;
    movePlannerDayPreview(event);
  }

  function movePlannerDayPreview(event){
    const preview=document.getElementById('planner-day-preview');
    if(!preview) return;
    preview.style.left=Math.min(window.innerWidth-300,event.clientX+12)+'px';
    preview.style.top=Math.min(window.innerHeight-140,event.clientY+12)+'px';
  }

  function hidePlannerDayPreview(){
    const preview=document.getElementById('planner-day-preview');
    if(preview) preview.remove();
  }

  function escapeHTML(value){
    return String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function robustDeleteTask(taskId){
    try{
      const list=getTasksList();
      if(!Array.isArray(list)) return;
      const before=list.length;
      const next=list.filter(t=>t.id!==taskId);
      if(typeof tasks!=='undefined') tasks=next;
      window.tasks=next;
      if(typeof timeSessions!=='undefined') timeSessions=timeSessions.filter(s=>s.taskId!==taskId);
      if(typeof focusTaskId!=='undefined'&&focusTaskId===taskId){focusTaskId=null;focusSubtaskId=null;}
      if(typeof taskOverflowOpenId!=='undefined'&&taskOverflowOpenId===taskId) taskOverflowOpenId=null;
      if(typeof plannerHighlightTaskId!=='undefined'&&plannerHighlightTaskId===taskId) plannerHighlightTaskId=null;
      if(typeof save==='function') save();
      if(typeof showToast==='function') showToast(before===next.length?'Task already removed.':'Task deleted.','ok');
      if(typeof render==='function') render();
    }catch(error){console.warn('deleteTask error',error);}
  }

  window.deleteTask=robustDeleteTask;
  if(typeof globalThis!=='undefined') globalThis.deleteTask=robustDeleteTask;
  window.repairFocusInteractions=repairFocusInteractions;
  window.hidePlannerDayPreview=hidePlannerDayPreview;

  wrapRenderFunction('render');
  wrapRenderFunction('renderNow');
  wrapPlannerNavigation('plannerOpenTimeline');
  wrapPlannerNavigation('plannerOpenDump');
  wrapPlannerNavigation('plannerGoToMonth');
  wrapPlannerNavigation('plannerSelectDate');
  document.addEventListener('DOMContentLoaded',afterRender);
})();
