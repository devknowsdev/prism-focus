/*
MODULE: planner_timeline_cursor.js
LAYER: actions
PURPOSE: Cursor-tracking day scheduler line plus click-start / click-end task creation.
OWNS: timeline cursor preview and empty-space click creation behaviour.
USES: actions_planner.js, planner_functions.js, state.js, storage.js, ui.js
STATE_READS: plannerDayLayout, plannerZoom, timelineDragState, tasks
STATE_WRITES: local planner click-create state, tasks through plannerCreateTaskAt()
PUBLIC_API: plannerCancelClickCreate, plannerTimelineEmptyClick, plannerTimelinePointerTrack
INVARIANTS: local-only scheduler interaction; no AI/provider/external calls; task creation follows an explicit user click and visible title prompt.
LAST_STABILIZED: 2026-06-26
*/

// This file intentionally patches the existing classic-script timeline handlers.
// It leaves pill move/resize behaviour intact and only changes empty-space timeline clicks.

let plannerClickCreateState=null; // {startMins,curMins}
let plannerCursorMins=null;

const _plannerOriginalTlCreateStart=typeof tlCreateStart==='function'?tlCreateStart:null;
const _plannerOriginalTlPointerMove=typeof tlPointerMove==='function'?tlPointerMove:null;
const _plannerOriginalTlPointerUp=typeof tlPointerUp==='function'?tlPointerUp:null;

function _plannerTimelineTargetIsEmpty(e,scrollEl){
  const target=e&&e.target;
  if(!target||!scrollEl||!scrollEl.contains(target)) return false;
  if(target.closest('button,input,select,textarea,a')) return false;
  if(target.closest('[data-task-id],[id^="tl-pill-"],#tl-draft-pill,#tl-click-draft-pill,.tl-click-create-ui')) return false;
  return true;
}

function _plannerPointerMins(e,scrollEl){
  return _tlClamp(_tlSnap(_tlEventToMins(e,scrollEl)));
}

function _plannerEnsureTimelineEl(scrollEl,id,className){
  let el=scrollEl.querySelector('#'+id);
  if(!el){
    el=document.createElement('div');
    el.id=id;
    el.className=className||'';
    el.style.position='absolute';
    el.style.pointerEvents='none';
    el.style.boxSizing='border-box';
    scrollEl.appendChild(el);
  }
  return el;
}

function _plannerSetHidden(el,hidden){
  if(el) el.style.display=hidden?'none':'block';
}

function _plannerPatchCursor(scrollEl,mins){
  if(!scrollEl||mins==null) return;
  plannerCursorMins=mins;
  const isH=plannerDayLayout==='horizontal';
  const marker=_plannerEnsureTimelineEl(scrollEl,'tl-cursor-track','tl-click-create-ui');
  const labelId='tl-cursor-track-label';
  let label=marker.querySelector('#'+labelId);
  if(!label){
    label=document.createElement('div');
    label.id=labelId;
    marker.appendChild(label);
  }

  marker.style.zIndex='18';
  marker.style.background=T.accent2;
  marker.style.opacity='0.85';
  marker.style.borderRadius='2px';
  marker.style.boxShadow='0 0 0 1px '+T.surface;

  label.textContent=_tlMinsToHHMM(mins);
  label.style.position='absolute';
  label.style.fontFamily="'DM Mono',monospace";
  label.style.fontSize='9px';
  label.style.fontWeight='700';
  label.style.color=T.surface;
  label.style.background=T.accent2;
  label.style.borderRadius='8px';
  label.style.padding='1px 5px';
  label.style.whiteSpace='nowrap';

  if(isH){
    marker.style.left=_tlMinsToX(mins,plannerZoom)+'px';
    marker.style.top=TL_LABEL_W+'px';
    marker.style.bottom='0';
    marker.style.width='2px';
    marker.style.height='auto';
    marker.style.right='auto';
    label.style.left='4px';
    label.style.top='2px';
    label.style.transform='none';
  } else {
    marker.style.top=_tlMinsToY(mins,plannerZoom)+'px';
    marker.style.left=TL_LABEL_W+'px';
    marker.style.right='0';
    marker.style.height='2px';
    marker.style.width='auto';
    marker.style.bottom='auto';
    label.style.left='4px';
    label.style.top='-10px';
    label.style.transform='none';
  }
  _plannerSetHidden(marker,false);
}

function _plannerPatchClickDraft(scrollEl){
  const draft=_plannerEnsureTimelineEl(scrollEl,'tl-click-draft-pill','tl-click-create-ui');
  if(!plannerClickCreateState){
    _plannerSetHidden(draft,true);
    return;
  }

  const isH=plannerDayLayout==='horizontal';
  const startMins=Math.min(plannerClickCreateState.startMins,plannerClickCreateState.curMins);
  const endMins=Math.max(plannerClickCreateState.startMins,plannerClickCreateState.curMins);
  const safeEnd=Math.max(startMins+TL_MIN_DUR,endMins);
  const pxPerMin=TL_PX_PER_MIN*(plannerZoom||1);
  const size=Math.max(TL_SNAP*pxPerMin,(safeEnd-startMins)*pxPerMin);

  draft.style.zIndex='19';
  draft.style.background=T.surface3;
  draft.style.border='2px dashed '+T.accent2;
  draft.style.borderRadius='8px';
  draft.style.boxShadow='0 4px 14px rgba(0,0,0,.12)';
  draft.innerHTML='<div style="font-size:9px;font-family:\'DM Mono\',monospace;color:'+T.accent2+';padding:3px 5px;font-weight:700;">'+_tlMinsToHHMM(startMins)+' – '+_tlMinsToHHMM(safeEnd)+' · click end</div>';

  if(isH){
    draft.style.left=_tlMinsToX(startMins,plannerZoom)+'px';
    draft.style.top=(TL_LABEL_W+4)+'px';
    draft.style.bottom='4px';
    draft.style.width=size+'px';
    draft.style.height='auto';
    draft.style.right='auto';
  } else {
    draft.style.top=_tlMinsToY(startMins,plannerZoom)+'px';
    draft.style.left=(TL_LABEL_W+4)+'px';
    draft.style.right='4px';
    draft.style.height=size+'px';
    draft.style.width='auto';
    draft.style.bottom='auto';
  }
  _plannerSetHidden(draft,false);
}

function plannerCancelClickCreate(){
  plannerClickCreateState=null;
  plannerCursorMins=null;
  document.querySelectorAll('#tl-click-draft-pill,#tl-cursor-track').forEach(el=>el.remove());
}

function _plannerStartClickCreate(e,scrollEl){
  const mins=_plannerPointerMins(e,scrollEl);
  plannerClickCreateState={startMins:mins,curMins:Math.min(TL_END_HOUR*60,mins+TL_MIN_DUR)};
  timelineNewTaskDraft=null;
  _plannerPatchCursor(scrollEl,mins);
  _plannerPatchClickDraft(scrollEl);
  showToast('Start set at '+_tlMinsToHHMM(mins)+'. Move to end time and click again.','ok');
}

function _plannerFinishClickCreate(e,scrollEl){
  const endClick=_plannerPointerMins(e,scrollEl);
  const rawStart=plannerClickCreateState.startMins;
  let startMins=Math.min(rawStart,endClick);
  let endMins=Math.max(rawStart,endClick);
  if(endMins-startMins<TL_MIN_DUR){
    endMins=Math.min(TL_END_HOUR*60,startMins+TL_MIN_DUR);
    if(endMins-startMins<TL_MIN_DUR) startMins=Math.max(TL_START_HOUR*60,endMins-TL_MIN_DUR);
  }
  const duration=endMins-startMins;
  const title=window.prompt('Task name for '+_tlMinsToHHMM(startMins)+'–'+_tlMinsToHHMM(endMins)+'?','');
  plannerCancelClickCreate();
  if(!(title||'').trim()){
    showToast('Timeline task cancelled','warn');
    return;
  }
  plannerCreateTaskAt(title,startMins,duration,'',{showToast:true});
}

function plannerTimelineEmptyClick(e,scrollEl){
  if(!_plannerTimelineTargetIsEmpty(e,scrollEl)){
    if(_plannerOriginalTlCreateStart) return _plannerOriginalTlCreateStart(e,scrollEl);
    return;
  }
  if(e.button!==0) return;
  e.preventDefault();
  e.stopPropagation();
  if(plannerClickCreateState){
    _plannerFinishClickCreate(e,scrollEl);
  } else {
    _plannerStartClickCreate(e,scrollEl);
  }
}

function plannerTimelinePointerTrack(e,scrollEl){
  if(timelineDragState){
    if(_plannerOriginalTlPointerMove) return _plannerOriginalTlPointerMove(e,scrollEl);
    return;
  }
  if(!_plannerTimelineTargetIsEmpty(e,scrollEl)) return;
  const mins=_plannerPointerMins(e,scrollEl);
  _plannerPatchCursor(scrollEl,mins);
  if(plannerClickCreateState){
    plannerClickCreateState.curMins=mins;
    _plannerPatchClickDraft(scrollEl);
  }
}

// Patch the names already used by render_planner.js inline handlers.
tlCreateStart=plannerTimelineEmptyClick;
tlPointerMove=plannerTimelinePointerTrack;
tlPointerUp=function(e,scrollEl){
  if(_plannerOriginalTlPointerUp) return _plannerOriginalTlPointerUp(e,scrollEl);
};

document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&plannerClickCreateState){
    plannerCancelClickCreate();
    showToast('Timeline task cancelled','warn');
  }
});
