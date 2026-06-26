/*
MODULE: storage.js
LAYER: storage
PURPOSE: Existing module stabilized with ownership metadata.
OWNS: storage.js responsibilities
USES: local modules
STATE_READS: T, darkMode, habits, tasks
STATE_WRITES: ID_MIGRATE, T, _saveTimer, alarms, allDefs, answers, audioRecordings, c, categories, clockColWidth
PUBLIC_API: _flushSave, clearFocusLocalStorage, load, loadAudioMeta, loadWidgetLayout, save, saveAudioMeta, saveNow, saveWidgetLayout
DEPENDENCIES: see dependency graph
INVARIANTS: render pure; actions mutate; helpers transform
LAST_STABILIZED: 2026-06-26
*/

// Persistence and startup reads live here so the rest of the app can treat
// them as a single, well-defined boundary.

let _saveTimer=null;
const STORAGE_PREFIX='adhd4_';
const STORAGE_SCHEMA_VERSION=18;

function _loadJson(key,fallback){
  try{
    const raw=localStorage.getItem(key);
    if(raw==null||raw==='') return fallback;
    return JSON.parse(raw);
  }catch(e){
    console.warn('Invalid saved data for '+key+'; using fallback.',e);
    return fallback;
  }
}

function _loadInt(key,fallback,min,max){
  const n=parseInt(localStorage.getItem(key)||String(fallback),10);
  const safe=Number.isFinite(n)?n:fallback;
  if(min!=null&&safe<min) return min;
  if(max!=null&&safe>max) return max;
  return safe;
}

function load(){
  const todayStr2=new Date().toDateString();
  const todayYmd2=dateToYMD(new Date());

  categories=_loadJson('adhd4_cats',null);
  if(!Array.isArray(categories)||!categories.length) categories=defaultCats.map(c=>({...c}));

  tasks=_loadJson('adhd4_tasks',[]);
  if(!Array.isArray(tasks)) tasks=[];
  alarms=_loadJson('adhd4_alarms',[]);
  if(!Array.isArray(alarms)) alarms=[];
  habits=_loadJson('adhd4_habits',[]);
  if(!Array.isArray(habits)) habits=[];
  templates=_loadJson('adhd4_templates',[]);
  if(!Array.isArray(templates)) templates=[];

  const fn=_loadJson('adhd4_focus',null);
  if(fn){
    focusTaskId=(fn && typeof fn==='object') ? (fn.id ?? null) : fn;
    focusSubtaskId=(fn && typeof fn==='object') ? (fn.subtaskId ?? null) : null;
  }else{
    focusTaskId=null;
    focusSubtaskId=null;
  }

  timeSessions=_loadJson('adhd4_time_sessions',[]);
  if(!Array.isArray(timeSessions)) timeSessions=[];
  offTaskLog=_loadJson('adhd4_offtask',[]);
  if(!Array.isArray(offTaskLog)) offTaskLog=[];
  journalEntries=_loadJson('adhd4_journal',[]);
  if(!Array.isArray(journalEntries)) journalEntries=[];

  dayStartHour=_loadInt('adhd4_day_start_hour',8,0,23);
  dayEndHour=_loadInt('adhd4_day_end_hour',17,14,22);
  taskSortMode=localStorage.getItem('adhd4_task_sort')||'manual';
  darkMode=localStorage.getItem('adhd4_dark')==='1';
  T=darkMode?DARK:LIGHT;
  crisisMode=localStorage.getItem('adhd4_crisis_mode')==='1';
  focusBoardMode=localStorage.getItem('adhd4_focus_board_mode')||'all';
  timerLayout=localStorage.getItem('adhd4_timer_layout')||'rings';
  clockColWidth=_loadInt('adhd4_clock_col_width',220,120,520);
  focusBoardManualIds=_loadJson('adhd4_focus_board_manual',[]);
  if(!Array.isArray(focusBoardManualIds)) focusBoardManualIds=[];

  // plannedTasks removed — tasks with ts+durationMins is the source of truth
  plannerDayDumps=_loadJson('adhd4_day_dumps',{});
  if(!plannerDayDumps||typeof plannerDayDumps!=='object'||Array.isArray(plannerDayDumps)) plannerDayDumps={};

  loadWidgetLayout();

  energyLog=_loadJson('adhd4_energy',[]);
  if(!Array.isArray(energyLog)) energyLog=[];

  const rawIntentions=_loadJson('adhd4_intentions',null);
  if(rawIntentions&&rawIntentions.date===todayStr2){
    if(rawIntentions.slots&&!rawIntentions.answers){
      dailyIntentions={date:todayStr2,answers:{arriving:'',oneWin:'',derail:'',goodEnough:''},step:0,winOutcome:null};
    } else {
      dailyIntentions=rawIntentions;
      if(!dailyIntentions.answers) dailyIntentions.answers={arriving:'',oneWin:'',derail:'',goodEnough:''};
      INTENTION_QUESTIONS.forEach(q=>{if(dailyIntentions.answers[q.key]===undefined)dailyIntentions.answers[q.key]='';});
      if(dailyIntentions.step===undefined) dailyIntentions.step=0;
      if(dailyIntentions.winOutcome===undefined) dailyIntentions.winOutcome=null;
    }
  } else {
    dailyIntentions={date:todayStr2,answers:{arriving:'',oneWin:'',derail:'',goodEnough:''},step:0,winOutcome:null};
  }

  const rawWiz=_loadJson('adhd4_day_wizard',null);
  if(rawWiz&&rawWiz.date===todayYmd2){
    dayWizardState=rawWiz;
    if(dayWizardState.wizBannerDismissedAt===undefined)dayWizardState.wizBannerDismissedAt=0;
  }else{
    dayWizardState={date:todayYmd2,phase:null,step:0,startDone:false,endDone:false,wizBannerDismissedAt:0};
  }

  try{loadAudioMeta();}catch(e){audioRecordings=[];}

  const cutoff=Date.now()-90*24*60*60*1000;
  const tsBefore=timeSessions.length;
  timeSessions=timeSessions.filter(s=>(s.startedAt||0)>=cutoff);
  if(timeSessions.length!==tsBefore) localStorage.setItem('adhd4_time_sessions',JSON.stringify(timeSessions));

  const otBefore=offTaskLog.length;
  const todayStr=new Date().toDateString();
  offTaskLog=offTaskLog.filter(e=>{
    const ts=e.startedAt||(e.startTime?new Date(e.date+' '+e.startTime).getTime():0);
    return ts>=cutoff||e.date===todayStr;
  });
  if(offTaskLog.length!==otBefore) localStorage.setItem('adhd4_offtask',JSON.stringify(offTaskLog));

  try{loadAiSettings();}catch(e){console.warn('AI settings load failed; keeping defaults.',e);}
  localStorage.setItem('adhd4_storage_schema_version',String(STORAGE_SCHEMA_VERSION));
}

function save(){
  if(_saveTimer) clearTimeout(_saveTimer);
  _saveTimer=setTimeout(_flushSave, 300);
}

function saveNow(){
  if(_saveTimer){clearTimeout(_saveTimer);_saveTimer=null;}
  _flushSave();
}

function _flushSave(){
  _saveTimer=null;
  localStorage.setItem('adhd4_cats',JSON.stringify(categories));
  localStorage.setItem('adhd4_tasks',JSON.stringify(tasks));
  localStorage.setItem('adhd4_alarms',JSON.stringify(alarms));
  localStorage.setItem('adhd4_habits',JSON.stringify(habits));
  localStorage.setItem('adhd4_templates',JSON.stringify(templates));
  localStorage.setItem('adhd4_time_sessions',JSON.stringify(timeSessions));
  localStorage.setItem('adhd4_offtask',JSON.stringify(offTaskLog));
  localStorage.setItem('adhd4_journal',JSON.stringify(journalEntries));
  localStorage.setItem('adhd4_day_start_hour',String(dayStartHour));
  localStorage.setItem('adhd4_day_end_hour',String(dayEndHour));
  localStorage.setItem('adhd4_day_wizard',JSON.stringify(dayWizardState));
  localStorage.setItem('adhd4_task_sort',taskSortMode);
  localStorage.setItem('adhd4_dark',darkMode?'1':'0');
  localStorage.setItem('adhd4_crisis_mode',crisisMode?'1':'0');
  localStorage.setItem('adhd4_focus_board_mode',focusBoardMode);
  localStorage.setItem('adhd4_timer_layout',timerLayout);
  localStorage.setItem('adhd4_clock_col_width',String(clockColWidth));
  localStorage.setItem('adhd4_focus_board_manual',JSON.stringify(focusBoardManualIds));
  localStorage.setItem('adhd4_day_dumps',JSON.stringify(plannerDayDumps));
  saveWidgetLayout();
  localStorage.setItem('adhd4_energy',JSON.stringify(energyLog));
  localStorage.setItem('adhd4_intentions',JSON.stringify(dailyIntentions));
  localStorage.setItem('adhd4_storage_schema_version',String(STORAGE_SCHEMA_VERSION));
  if(focusTaskId!=null)localStorage.setItem('adhd4_focus',JSON.stringify({id:focusTaskId,subtaskId:focusSubtaskId??null}));
  else localStorage.removeItem('adhd4_focus');
  invalidateAvoidanceCache();
  invalidateTaskHitsCache();
}

window.addEventListener('beforeunload',saveNow);

function loadAudioMeta(){
  try{
    audioRecordings=JSON.parse(localStorage.getItem('adhd4_audio_meta')||'[]');
  }catch(e){audioRecordings=[];}
}

function saveAudioMeta(){
  localStorage.setItem('adhd4_audio_meta',JSON.stringify(audioRecordings));
}

function loadWidgetLayout(){
  // ID migration map: old IDs → new merged widget IDs
  // NOTE: 'habits' intentionally removed — it is now a standalone widget again.
  const ID_MIGRATE={'timer':'focusboard','alarms':'focusboard','focustimer':'focusboard','intentions':'checkin','energy':'checkin','braindump':'journal','voicenotes':'journal'};
  // All widgets now live in the registry — WIDGETS array removed from constants.js
  const allDefs=getRegisteredWidgets();
  try{
    let raw=JSON.parse(localStorage.getItem('adhd4_widget_layout')||'null');
    // Migrate old IDs; force tools + habits visible for existing users who never had them
    if(raw) raw=raw.map(w=>({...w, id: ID_MIGRATE[w.id]||w.id, visible: (w.id==='tools'||w.id==='habits')?true:w.visible}))
                    .filter((w,i,arr)=>arr.findIndex(x=>x.id===w.id)===i); // dedupe merged
    widgetLayout=allDefs.map((def,i)=>{
      const saved=raw?raw.find(x=>x.id===def.id):null;
      return {
        id:def.id,
        visible: saved ? saved.visible : def.defaultVisible!==false,
        collapsed: saved ? (saved.collapsed||false) : false,
        order: saved!=null && saved.order!=null ? saved.order : i,
      };
    });
  }catch(e){
    widgetLayout=allDefs.map((def,i)=>({id:def.id,visible:def.defaultVisible!==false,collapsed:false,order:i}));
  }
}

function saveWidgetLayout(){
  localStorage.setItem('adhd4_widget_layout',JSON.stringify(widgetLayout));
}

function clearFocusLocalStorage(){
  if(_saveTimer){clearTimeout(_saveTimer);_saveTimer=null;}
  Object.keys(localStorage).forEach(key=>{
    if(key.startsWith(STORAGE_PREFIX)) localStorage.removeItem(key);
  });
}
