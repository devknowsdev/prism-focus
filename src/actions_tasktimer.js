/*
MODULE: actions_tasktimer.js
LAYER: actions
PURPOSE: Existing module stabilized with ownership metadata.
OWNS: actions_tasktimer.js responsibilities
USES: local modules
STATE_READS: T, darkMode, state, tasks
STATE_WRITES: T, activeSession, ctx, darkMode, done, doneDate, doneText, editingSessionId, editingSessionMmSs, editingSessionSecs
PUBLIC_API: addTask, cancelEditTaskTime, cancelSessionEdit, clearFocus, clearTaskTime, closeFocusPicker, closeSessions, deleteAllSessionsForFocus, deleteSession, deleteTask, doneFocus, filterTasks
DEPENDENCIES: see dependency graph
INVARIANTS: render pure; actions mutate; helpers transform
LAST_STABILIZED: 2026-06-21
*/

function toggleDark(){darkMode=!darkMode;T=darkMode?DARK:LIGHT;save();render();}
function filterTasks(tag){taskFilter=tag;render();}
function addTask(){
  const inp=document.getElementById('task-in'),sel=document.getElementById('task-cat');
  const timeIn=document.getElementById('task-time-in');
  const repeatSel=document.getElementById('task-repeat');
  const scopeEl=document.getElementById('task-scope');
  const text=inp.value.trim();if(!text)return;
  let ts='';
  if(timeIn && timeIn.value.trim()){
    const norm=normalizeTaskTime(timeIn.value.trim());
    if(!norm){showToast('Use HH:MM for time','warn');return;}
    ts=norm;
  }
  const repeatVal=repeatSel?repeatSel.value:'none';
  const taskScope=scopeEl?(scopeEl.value||'day'):'day';
  const now=Date.now();
  tasks.push({id:now,text,catId:sel.value,done:false,status:'todo',taskScope,doneDate:'',ts,order:nextTaskOrder(),createdAt:now,repeat:repeatVal==='none'?null:repeatVal,templateId:null,generatedForDate:null,pinned:false,energyRequired:null,anxiety:0,urgency:0,subtasks:[],estimatedMins:null,note:''});
  inp.value='';
  if(timeIn) timeIn.value='';
  save();
  document.activeElement?.blur();
  renderNow();
}
function setTaskSortMode(mode){taskSortMode=mode;save();render();}
function setTaskUrgency(id,level){const t=getTask(id);if(!t)return;t.urgency=(t.urgency===level?0:level);urgencyPickerTaskId=null;save();render();}
function startEditTaskTime(id){editingTimeId=id;render();setTimeout(()=>{const el=document.getElementById('task-time-edit-'+id);if(el){el.focus();el.select();}},0);}
function cancelEditTaskTime(){editingTimeId=null;render();}
function saveTaskTime(id,raw){const t=getTask(id);if(!t){editingTimeId=null;return;}const trimmed=String(raw||'').trim();if(!trimmed){t.ts='';editingTimeId=null;save();render();return;}const norm=normalizeTaskTime(trimmed);if(!norm){showToast('Use HH:MM (e.g. 14:30)','warn');startEditTaskTime(id);return;}t.ts=norm;editingTimeId=null;save();render();}
function clearTaskTime(id){const t=getTask(id);if(!t)return;t.ts='';editingTimeId=null;save();render();}
function toggleTask(id){const t=tasks.find(x=>x.id===id);if(!t)return;if(!t.status||t.status==='todo')t.status='inprogress';else if(t.status==='inprogress')t.status='done';else t.status='todo';t.done=(t.status==='done');t.doneDate=t.done?dateToYMD(new Date()):'';if(t.done&&focusTaskId===id){focusSubtaskId=null;clearFocus();}if(t.done){const el=document.querySelector('[data-task-id="'+id+'"]');const origin=el?{x:el.getBoundingClientRect().left+9,y:el.getBoundingClientRect().top+9}:null;confetti(origin);}save();if(t.done)showToast('✓ Done! '+t.text,'ok');renderNow();}
function deleteTask(id){if(focusTaskId===id){focusTaskId=null;focusSubtaskId=null;}tasks=tasks.filter(x=>x.id!==id);save();renderNow();}
function openFocusPicker(){showFocusModal=true;focusSearch='';render();setTimeout(()=>{const el=document.getElementById('focus-search');if(el)el.focus();},0);}
function closeFocusPicker(){showFocusModal=false;render();}
function setFocusSearch(v){focusSearch=v;render();const el=document.getElementById('focus-search');if(el){el.focus();el.setSelectionRange(el.value.length,el.value.length);}}
function setFocus(id, subtaskId){const t=getTask(id);if(!t||t.done){showToast('Pick an active task','warn');return;}if(subtaskId!=null){const st=getSubtask(id,subtaskId);if(!st||st.done){showToast('Pick an active sub-task','warn');return;}}focusTaskId=id;focusSubtaskId=subtaskId||null;showFocusModal=false;resetTimer(true);save();renderNow();}
function startTaskStopwatch(id){const t=getTask(id);if(!t||t.done){showToast('Pick an active task','warn');return;}if(timerRunning && focusTaskId===id){stopAndSaveTimer(false);return;}if(!timerRunning && focusTaskId===id){timerMode='stopwatch';timerSessionType='work';timerSecs=0;save();startTimerInternal();render();return;}if(timerRunning)stopTimerInternal();focusTaskId=id;focusSubtaskId=null;showFocusModal=false;save();render();}
function clearFocus(){focusTaskId=null;focusSubtaskId=null;stopTimerInternal();showFocusModal=false;save();render();}
function doneFocus(){if(focusTaskId==null)return;const t=getTask(focusTaskId);if(!t)return;const doneText=t.text;t.status='done';t.done=true;focusSubtaskId=null;clearFocus();showToast('✓ Done! '+doneText,'ok');}

// -----------------------------
// USER PROFILE LAYER (UPL)
// -----------------------------

const DEFAULT_PROFILE = {
  version: "0.1",
  cognitiveProfile: {},
  workflowPreferences: {},
  healthSelfRegulation: {},
  aiBehaviorRules: {},
  imports: []
};

function loadUserProfile(){
  try {
    const raw = localStorage.getItem('ai_profile');
    if(!raw) return DEFAULT_PROFILE;
    return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
  } catch(e){
    return DEFAULT_PROFILE;
  }
}

function saveUserProfile(profile){
  try {
    localStorage.setItem('ai_profile', JSON.stringify(profile));
  } catch(e){}
}

function buildProfileContext(){
  const p = loadUserProfile();

  return [
    '[USER PROFILE LAYER]',
    JSON.stringify(p.cognitiveProfile || {}, null, 2),
    JSON.stringify(p.workflowPreferences || {}, null, 2),
    JSON.stringify(p.healthSelfRegulation || {}, null, 2),
    JSON.stringify(p.aiBehaviorRules || {}, null, 2)
  ].join('\n');
}
