/*
MODULE: keyboard_commands.js
LAYER: runtime
PURPOSE: Keyboard navigation, selected-task actions, delete confirmation, and undo/redo.
OWNS: global key command handling and command overlay UI
USES: task state, storage save/saveNow, render, task/timer actions
STATE_READS: tasks, focusTaskId, expandedSubtaskTaskIds, taskOverflowOpenId
STATE_WRITES: tasks, focusTaskId, focusSubtaskId, taskOverflowOpenId, timeSessions, undo/redo snapshots
PUBLIC_API: focusKeyboardSelectTask, focusKeyboardUndo, focusKeyboardRedo
INVARIANTS: does not run inside text inputs; destructive delete requires explicit confirmation
LAST_STABILIZED: 2026-06-24
*/

(function(){
  if(typeof window==='undefined'||typeof document==='undefined') return;

  let selectedTaskId=null;
  let pendingDeleteTaskId=null;
  let undoStack=[];
  let redoStack=[];
  let lastSnapshot=null;
  let isRestoring=false;
  const MAX_HISTORY=40;

  function getTasks(){
    try{return Array.isArray(tasks)?tasks:[];}catch(_){return Array.isArray(window.tasks)?window.tasks:[];}
  }

  function getSelectedTask(){
    return getTasks().find(t=>t.id===selectedTaskId)||null;
  }

  function visibleTaskIds(){
    return Array.from(document.querySelectorAll('[data-task-id]'))
      .map(el=>Number(el.getAttribute('data-task-id')))
      .filter(id=>Number.isFinite(id));
  }

  function ensureSelection(){
    const ids=visibleTaskIds();
    if(!ids.length){selectedTaskId=null;return null;}
    if(selectedTaskId==null||!ids.includes(selectedTaskId)) selectedTaskId=ids[0];
    return selectedTaskId;
  }

  function selectRelative(delta){
    const ids=visibleTaskIds();
    if(!ids.length)return;
    const current=ensureSelection();
    const idx=Math.max(0,ids.indexOf(current));
    const nextIdx=Math.max(0,Math.min(ids.length-1,idx+delta));
    focusKeyboardSelectTask(ids[nextIdx],true);
  }

  function focusKeyboardSelectTask(taskId,scroll){
    selectedTaskId=Number(taskId);
    applySelectionStyles();
    if(scroll){
      const el=document.querySelector(`[data-task-id="${selectedTaskId}"]`);
      if(el) el.scrollIntoView({behavior:'smooth',block:'nearest'});
    }
  }

  function applySelectionStyles(){
    document.querySelectorAll('[data-task-id]').forEach(el=>{
      const active=Number(el.getAttribute('data-task-id'))===selectedTaskId;
      el.setAttribute('aria-selected',active?'true':'false');
      el.style.outline=active?'2px solid #1d5fa8':'';
      el.style.outlineOffset=active?'2px':'';
      el.style.borderRadius=active?'12px':'';
      el.style.boxShadow=active?'0 0 0 4px rgba(29,95,168,.12)':'';
    });
  }

  function activateSelected(){
    const task=getSelectedTask();
    if(!task)return;
    try{
      if(typeof setFocus==='function') setFocus(task.id);
      if(typeof taskOverflowOpenId!=='undefined') taskOverflowOpenId=task.id;
      if(typeof render==='function') render();
      setTimeout(()=>focusKeyboardSelectTask(task.id,true),0);
    }catch(error){console.warn('keyboard activate failed',error);}
  }

  function startTimerForSelected(){
    const task=getSelectedTask();
    if(!task)return;
    try{
      if(typeof startTaskStopwatch==='function') startTaskStopwatch(task.id);
      else if(typeof setFocus==='function'){setFocus(task.id); if(typeof toggleTimer==='function') toggleTimer();}
      setTimeout(()=>focusKeyboardSelectTask(task.id,true),0);
    }catch(error){console.warn('keyboard timer failed',error);}
  }

  function levelDown(){
    const task=getSelectedTask();
    if(!task)return;
    try{
      if(typeof expandedSubtaskTaskIds!=='undefined'&&expandedSubtaskTaskIds&&typeof expandedSubtaskTaskIds.add==='function') expandedSubtaskTaskIds.add(task.id);
      if(typeof taskOverflowOpenId!=='undefined') taskOverflowOpenId=task.id;
      if(typeof setFocus==='function') setFocus(task.id);
      if(typeof render==='function') render();
      setTimeout(()=>focusKeyboardSelectTask(task.id,true),0);
    }catch(error){console.warn('keyboard level down failed',error);}
  }

  function levelUp(){
    const task=getSelectedTask();
    try{
      if(task&&typeof expandedSubtaskTaskIds!=='undefined'&&expandedSubtaskTaskIds&&typeof expandedSubtaskTaskIds.delete==='function') expandedSubtaskTaskIds.delete(task.id);
      if(typeof taskOverflowOpenId!=='undefined') taskOverflowOpenId=null;
      if(typeof focusSubtaskId!=='undefined') focusSubtaskId=null;
      if(typeof render==='function') render();
      if(task) setTimeout(()=>focusKeyboardSelectTask(task.id,true),0);
    }catch(error){console.warn('keyboard level up failed',error);}
  }

  function requestDeleteSelected(){
    const task=getSelectedTask();
    if(!task)return;
    pendingDeleteTaskId=task.id;
    renderDeleteConfirm(task);
  }

  function renderDeleteConfirm(task){
    closeDeleteConfirm();
    const overlay=document.createElement('div');
    overlay.id='keyboard-delete-confirm';
    overlay.style.cssText='position:fixed;inset:0;z-index:9500;background:rgba(0,0,0,.38);display:flex;align-items:center;justify-content:center;padding:18px;font-family:Syne,sans-serif;';
    overlay.innerHTML=`
      <div style="width:100%;max-width:420px;border-radius:18px;background:#fff;color:#111;border:1.5px solid #d7e3df;box-shadow:0 20px 60px rgba(0,0,0,.28);padding:18px;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.12em;font-weight:900;color:#8a6b00;margin-bottom:5px;">Sure?</div>
        <div style="font-size:18px;font-weight:900;margin-bottom:8px;">Delete selected task?</div>
        <div style="font-size:13px;line-height:1.4;margin-bottom:14px;color:#475569;">${escapeHTML(task.text||'Untitled task')}</div>
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;">
          <button id="keyboard-delete-cancel" type="button" style="border:1.5px solid #cbd5e1;background:#fff;color:#111;border-radius:10px;padding:8px 12px;font-weight:800;cursor:pointer;">↩ Cancel <span style="font-size:11px;color:#64748b;">Backspace</span></button>
          <button id="keyboard-delete-confirm-btn" type="button" style="border:1.5px solid #ef4444;background:#ef4444;color:#fff;border-radius:10px;padding:8px 12px;font-weight:900;cursor:pointer;">⌫ Delete <span style="font-size:11px;opacity:.9;">Enter</span></button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    document.getElementById('keyboard-delete-cancel')?.addEventListener('click',cancelDeleteConfirm);
    document.getElementById('keyboard-delete-confirm-btn')?.addEventListener('click',confirmDeleteSelected);
  }

  function closeDeleteConfirm(){
    const existing=document.getElementById('keyboard-delete-confirm');
    if(existing) existing.remove();
  }

  function cancelDeleteConfirm(){
    pendingDeleteTaskId=null;
    closeDeleteConfirm();
  }

  function confirmDeleteSelected(){
    const taskId=pendingDeleteTaskId;
    if(taskId==null)return;
    recordUndoPoint();
    pendingDeleteTaskId=null;
    closeDeleteConfirm();
    if(typeof deleteTask==='function') deleteTask(taskId);
    selectedTaskId=null;
    setTimeout(()=>{ensureSelection();applySelectionStyles();},0);
  }

  function isTypingTarget(target){
    if(!target)return false;
    const tag=(target.tagName||'').toLowerCase();
    return tag==='input'||tag==='textarea'||tag==='select'||target.isContentEditable;
  }

  function snapshotState(){
    const data={};
    const copy=name=>{try{data[name]=JSON.parse(JSON.stringify(eval(name)));}catch(_){data[name]=undefined;}};
    ['tasks','categories','timeSessions','plannerDayDumps','offTaskLog','journalEntries','habits','templates','focusTaskId','focusSubtaskId','taskFilter','taskSortMode','focusBoardManualIds'].forEach(copy);
    return JSON.stringify(data);
  }

  function restoreSnapshot(serialized){
    if(!serialized)return;
    isRestoring=true;
    try{
      const data=JSON.parse(serialized);
      Object.keys(data).forEach(name=>{
        try{eval(`${name}=data[name]`);}catch(_){/* ignored */}
      });
      if(typeof saveNow==='function') saveNow();
      else if(typeof save==='function') save();
      if(typeof render==='function') render();
      setTimeout(()=>{ensureSelection();applySelectionStyles();},0);
      lastSnapshot=serialized;
    }catch(error){console.warn('snapshot restore failed',error);}
    finally{isRestoring=false;}
  }

  function recordUndoPoint(){
    const snap=snapshotState();
    if(!lastSnapshot) lastSnapshot=snap;
    if(snap!==lastSnapshot){
      undoStack.push(lastSnapshot);
      if(undoStack.length>MAX_HISTORY) undoStack.shift();
      lastSnapshot=snap;
      redoStack=[];
    }
  }

  function wrapSaveForHistory(){
    if(typeof window.save!=='function'||window.save.__keyboardHistoryWrapped)return;
    const original=window.save;
    const wrapped=function(){
      if(!isRestoring) recordUndoPoint();
      return original.apply(this,arguments);
    };
    wrapped.__keyboardHistoryWrapped=true;
    window.save=wrapped;
    if(typeof globalThis!=='undefined') globalThis.save=wrapped;
  }

  function focusKeyboardUndo(){
    if(!undoStack.length)return;
    const current=snapshotState();
    const previous=undoStack.pop();
    redoStack.push(current);
    restoreSnapshot(previous);
  }

  function focusKeyboardRedo(){
    if(!redoStack.length)return;
    const current=snapshotState();
    const next=redoStack.pop();
    undoStack.push(current);
    restoreSnapshot(next);
  }

  function handleKeydown(event){
    if(isTypingTarget(event.target))return;
    if(pendingDeleteTaskId!=null){
      if(event.key==='Enter'){event.preventDefault();confirmDeleteSelected();return;}
      if(event.key==='Backspace'||event.key==='Escape'){event.preventDefault();cancelDeleteConfirm();return;}
    }
    const isMod=event.metaKey||event.ctrlKey;
    if(isMod&&event.key.toLowerCase()==='z'){
      event.preventDefault();
      if(event.shiftKey) focusKeyboardRedo();
      else focusKeyboardUndo();
      return;
    }
    if(isMod&&event.key.toLowerCase()==='y'){
      event.preventDefault();
      focusKeyboardRedo();
      return;
    }
    if(event.altKey||event.metaKey||event.ctrlKey)return;
    switch(event.key){
      case 'ArrowDown': event.preventDefault();selectRelative(1);break;
      case 'ArrowUp': event.preventDefault();selectRelative(-1);break;
      case 'ArrowRight': event.preventDefault();ensureSelection();levelDown();break;
      case 'ArrowLeft': event.preventDefault();ensureSelection();levelUp();break;
      case 'Enter': event.preventDefault();ensureSelection();activateSelected();break;
      case ' ': event.preventDefault();ensureSelection();startTimerForSelected();break;
      case 'Backspace': event.preventDefault();ensureSelection();requestDeleteSelected();break;
    }
  }

  function escapeHTML(value){
    return String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function bootKeyboardCommands(){
    wrapSaveForHistory();
    setTimeout(()=>{lastSnapshot=snapshotState();ensureSelection();applySelectionStyles();},0);
  }

  document.addEventListener('keydown',handleKeydown,true);
  document.addEventListener('DOMContentLoaded',bootKeyboardCommands);
  window.focusKeyboardSelectTask=focusKeyboardSelectTask;
  window.focusKeyboardUndo=focusKeyboardUndo;
  window.focusKeyboardRedo=focusKeyboardRedo;
})();
