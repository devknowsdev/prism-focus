/*
MODULE: actions_tasktimer.js
LAYER: actions
PURPOSE: AI-enhanced task orchestration + scheduler intelligence layer
OWNS: actions_tasktimer.js responsibilities
USES: local modules
STATE_READS: T, darkMode, state, tasks
STATE_WRITES: T, activeSession, ctx, darkMode, done, doneDate, doneText, editingSessionId, editingSessionMmSs, editingSessionSecs
PUBLIC_API: addTask, cancelEditTaskTime, cancelSessionEdit, clearFocus, clearTaskTime, closeFocusPicker, closeSessions, deleteTask, doneFocus, filterTasks
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

  tasks.push({
    id:now,text,catId:sel.value,done:false,status:'todo',taskScope,
    doneDate:'',ts,order:nextTaskOrder(),createdAt:now,
    repeat:repeatVal==='none'?null:repeatVal,
    templateId:null,generatedForDate:null,pinned:false,
    energyRequired:null,anxiety:0,urgency:0,
    subtasks:[],estimatedMins:null,note:''
  });

  inp.value='';
  if(timeIn) timeIn.value='';
  save();
  document.activeElement?.blur();
  renderNow();
}

// -----------------------------
// SCHEDULER INTELLIGENCE LAYER
// -----------------------------

const MAX_DAILY_LOAD_MINS = 360;
const WEEK_DAYS=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

function estimateTaskLoad(t){
  return t?.estimatedMins || (t?.urgency ? 30 : 15);
}

function computeDailyLoad(list){
  return list.reduce((s,t)=>s+estimateTaskLoad(t),0);
}

function detectTimeConflicts(list){
  const map={},conflicts=[];
  list.forEach(t=>{
    if(!t.ts) return;
    if(map[t.ts]) conflicts.push([map[t.ts],t]);
    else map[t.ts]=t;
  });
  return conflicts;
}

function balanceEnergy(list){
  let load=computeDailyLoad(list);
  if(load<=MAX_DAILY_LOAD_MINS) return list;

  const sorted=[...list].sort((a,b)=>(a.urgency||0)-(b.urgency||0));
  while(load>MAX_DAILY_LOAD_MINS && sorted.length){
    const t=sorted.shift();
    const idx=list.findIndex(x=>x.id===t.id);
    if(idx>-1) list.splice(idx,1);
    load=computeDailyLoad(list);
  }
  return list;
}

function optimizeSchedule(){
  const conflicts=detectTimeConflicts(tasks);
  conflicts.forEach(([a,b])=>{
    if(b?.ts){
      const [h,m]=b.ts.split(':').map(Number);
      b.ts=String((h+1)%24).padStart(2,'0')+':'+String(m).padStart(2,'0');
    }
  });
  balanceEnergy(tasks);
}

function groupByDay(list){
  const map={Mon:[],Tue:[],Wed:[],Thu:[],Fri:[],Sat:[],Sun:[]};
  list.forEach((t,i)=>map[WEEK_DAYS[i%7]].push(t));
  return map;
}

function generateWeeklyPlanFromBacklog(){
  const backlog=tasks.filter(t=>t.taskScope==='day'&&!t.ts);
  const grouped=groupByDay(backlog);
  Object.entries(grouped).forEach(([day,list])=>{
    list.forEach((t,i)=>{
      t.taskScope='week';
      t.ts=`${day} ${9+i}:00`;
    });
  });
}

function detectWeekOverload(){
  const map=groupByDay(tasks);
  return WEEK_DAYS
    .map(d=>({day:d,load:computeDailyLoad(map[d])}))
    .filter(x=>x.load>MAX_DAILY_LOAD_MINS);
}

function proactiveRebalanceWeek(){
  const overloads=detectWeekOverload();
  overloads.forEach(o=>{
    tasks.filter(t=>t.ts?.startsWith(o.day)).forEach((t,i)=>{
      t.ts=`${o.day} ${9+(i%8)}:00`;
    });
  });
}

// -----------------------------
// PROFILE LAYER
// -----------------------------

const DEFAULT_PROFILE={version:"0.1",cognitiveProfile:{},workflowPreferences:{},healthSelfRegulation:{},aiBehaviorRules:{},imports:[]};

function loadUserProfile(){
  try{return {...DEFAULT_PROFILE,...JSON.parse(localStorage.getItem('ai_profile')||'{}')};}
  catch{return DEFAULT_PROFILE;}
}

function saveUserProfile(p){localStorage.setItem('ai_profile',JSON.stringify(p));}

function buildProfileContext(){
  const p=loadUserProfile();
  return [
    '[USER PROFILE LAYER]',
    JSON.stringify(p.cognitiveProfile||{},null,2),
    JSON.stringify(p.workflowPreferences||{},null,2),
    JSON.stringify(p.healthSelfRegulation||{},null,2),
    JSON.stringify(p.aiBehaviorRules||{},null,2)
  ].join('\n');
}

// -----------------------------
// AI CONTEXT
// -----------------------------

function buildAIContext(input=''){
  return [
    '=== SYSTEM CONTEXT ===',
    'You are a cognitive scheduling and task orchestration engine.',
    '',
    '=== AVAILABLE ACTIONS ===',
    'create_task | delete_task | update_task | breakdown_task | schedule_task',
    'schedule_week_plan | schedule_month_plan | set_task_duration | bulk_reschedule',
    'optimize_schedule | detect_conflicts | balance_energy',
    'generate_week_plan_from_backlog | proactive_rebalance_week | predict_week_overload',
    '',
    buildProfileContext(),
    '',
    '=== STATE ===',
    JSON.stringify({focusTaskId,tasks,timerMode,timerSecs,crisisMode},null,2),
    '',
    '=== INPUT ===',
    input
  ].join('\n');
}

// -----------------------------
// AI EXECUTION
// -----------------------------

function executeAIResponse(res){
  if(!res) return;
  let parsed;
  try{parsed=typeof res==='string'?JSON.parse(res):res;}catch{return;}

  (parsed.actions||[]).forEach(a=>{
    switch(a.type){

      case 'create_task':tasks.push({id:Date.now()+Math.random(),text:a.task?.text||'Untitled',status:'todo',taskScope:'day',done:false,ts:'',urgency:0,estimatedMins:a.task?.estimatedMins||null});break;

      case 'delete_task':tasks=tasks.filter(x=>x.id!==a.id);break;

      case 'update_task':{
        const t=tasks.find(x=>x.id===a.id);
        if(t)Object.assign(t,a.updates||{});
        break;
      }

      case 'schedule_task':{
        const t=tasks.find(x=>x.id===a.id);
        if(t){if(a.allDay)t.taskScope='allDay'; else if(a.ts)t.ts=a.ts;}
        break;
      }

      case 'generate_week_plan_from_backlog':generateWeeklyPlanFromBacklog();break;
      case 'proactive_rebalance_week':proactiveRebalanceWeek();break;
      case 'predict_week_overload':detectWeekOverload();break;
      case 'optimize_schedule':optimizeSchedule();break;
      case 'balance_energy':balanceEnergy(tasks);break;
    }
  });

  save();renderNow();
}

// -----------------------------
// AI PIPELINE
// -----------------------------

async function runAI(input){
  const prompt=buildAIContext(input);
  try{
    const res=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt})});
    const data=await res.json();
    executeAIResponse(data.response||data);
  }catch(e){showToast('AI error','warn');}
}

window.runAI=runAI;
