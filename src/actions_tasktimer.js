/*
MODULE: actions_tasktimer.js
LAYER: actions
PURPOSE: AI cognitive scheduling engine (v2 global optimizer)
*/

// -----------------------------
// UTIL: TIME BLOCK CORE
// -----------------------------

function toMinutes(hhmm){
  if(!hhmm || typeof hhmm !== 'string') return null;
  const [h,m]=hhmm.split(':').map(Number);
  if(Number.isNaN(h)||Number.isNaN(m)) return null;
  return h*60+m;
}

function toHHMM(mins){
  const h=Math.floor(mins/60)%24;
  const m=mins%60;
  return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0');
}

function createBlock(t){
  const start=toMinutes(t.ts);
  const duration=t.estimatedMins||30;
  if(start==null) return null;
  return {
    id:t.id,
    start,
    end:start+duration,
    duration,
    urgency:t.urgency||0,
    energy:t.energyRequired||0,
    deadline:t.deadline||null
  };
}

function blocks(list){
  return list.map(createBlock).filter(Boolean);
}

// -----------------------------
// FIT FUNCTION (CORE OF GLOBAL OPTIMIZER)
// -----------------------------

function fitScore(task, context={}){
  const urgency=task.urgency||0;
  const energy=task.energyRequired||0;
  const duration=task.estimatedMins||30;
  const deadlinePressure=task.deadline?1:0;

  // weighted scoring model
  return (
    urgency*2 +
    deadlinePressure*3 -
    energy*1 -
    duration*0.01
  );
}

// -----------------------------
// CONSTRAINT ENGINE V2
// -----------------------------

function overlap(a,b){return a.start<b.end && b.start<a.end;}

function detectConflicts(list){
  const b=blocks(list);
  const out=[];
  for(let i=0;i<b.length;i++){
    for(let j=i+1;j<b.length;j++){
      if(overlap(b[i],b[j])) out.push([b[i],b[j]]);
    }
  }
  return out;
}

function resolveConflicts(tasks){
  const conflicts=detectConflicts(tasks);

  conflicts.forEach(([a,b])=>{
    const ta=tasks.find(t=>t.id===a.id);
    const tb=tasks.find(t=>t.id===b.id);
    if(!ta||!tb) return;

    const lower=fitScore(ta)<fitScore(tb)?ta:tb;

    if(lower.ts){
      const newStart=(toMinutes(lower.ts)||0)+ (lower.estimatedMins||30);
      lower.ts=toHHMM(newStart);
    }
  });

  return tasks;
}

// -----------------------------
// GLOBAL OPTIMIZER (SECOND-ORDER SCHEDULER)
// -----------------------------

function globalOptimizeDay(tasks){
  const unscheduled=tasks.filter(t=>t.ts);
  const sorted=[...unscheduled].sort((a,b)=>fitScore(b)-fitScore(a));

  let cursor=9*60; // start 09:00

  sorted.forEach(t=>{
    const dur=t.estimatedMins||30;

    t.ts=toHHMM(cursor);
    cursor+=dur;

    // skip lunch / recovery window
    if(cursor>13*60 && cursor<14*60) cursor=14*60;
  });

  return tasks;
}

function globalOptimizeWeek(tasks){
  const days=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

  days.forEach((d,i)=>{
    const dayTasks=tasks.filter((t,idx)=>idx%7===i);
    globalOptimizeDay(dayTasks);
  });

  return tasks;
}

// -----------------------------
// CONTINUOUS REBALANCER (EVENT LOOP)
// -----------------------------

let REBALANCE_INTERVAL=null;

function startRebalancer(){
  if(REBALANCE_INTERVAL) return;

  REBALANCE_INTERVAL=setInterval(()=>{
    try{
      resolveConflicts(tasks);
      globalOptimizeDay(tasks);
      save?.();
      renderNow?.();
    }catch(e){}
  }, 5000);
}

function stopRebalancer(){
  clearInterval(REBALANCE_INTERVAL);
  REBALANCE_INTERVAL=null;
}

// -----------------------------
// CONSTRAINT SOLVER ENTRY
// -----------------------------

function solveAllConstraints(tasks){
  resolveConflicts(tasks);
  globalOptimizeDay(tasks);
  return tasks;
}

// -----------------------------
// AI HOOKS
// -----------------------------

function executeAIResponse(res){
  if(!res) return;

  let parsed;
  try{parsed=typeof res==='string'?JSON.parse(res):res;}catch{return;}

  (parsed.actions||[]).forEach(a=>{
    switch(a.type){

      case 'optimize_global_day':
        globalOptimizeDay(tasks);
        break;

      case 'optimize_global_week':
        globalOptimizeWeek(tasks);
        break;

      case 'solve_constraints_v2':
        solveAllConstraints(tasks);
        break;

      case 'start_rebalancer':
        startRebalancer();
        break;

      case 'stop_rebalancer':
        stopRebalancer();
        break;

    }
  });

  save?.();
  renderNow?.();
}

// -----------------------------
// EXPORT
// -----------------------------

window.__scheduler_v2={
  fitScore,
  detectConflicts,
  resolveConflicts,
  globalOptimizeDay,
  globalOptimizeWeek,
  solveAllConstraints,
  startRebalancer,
  stopRebalancer
};
