/*
MODULE: planner_functions.js
LAYER: actions
PURPOSE: Small planner action helpers for scheduling, unscheduling, copying, and creating planner tasks.
OWNS: planner function extension points that can be called by render code, review UI, or future Spectra-reviewed suggestions.
USES: state.js, helpers.js, storage.js, ui.js, actions_planner.js
STATE_READS: tasks, plannerSelectedDate
STATE_WRITES: tasks, plannerDayDumps, plannerSelectedDate, plannerView
PUBLIC_API: plannerScheduleTaskAt, plannerScheduleTaskAtDefault, plannerUnscheduleTask, plannerSetTaskDuration, plannerCopyTaskAt, plannerCreateTaskAt, plannerAddDumpItem, plannerGoToToday, plannerSetPlannerView
INVARIANTS: planner functions only mutate local Focus state after an explicit caller action; they do not call AI providers or external services.
LAST_STABILIZED: 2026-06-26
*/

// Planner function extensions.
// These helpers keep planner mutations in actions rather than inline render strings.
// They are intentionally local-only: no Spectra, provider, cloud, calendar, or file writes.

function _plannerFindTask(taskId){
  return tasks.find(t=>String(t.id)===String(taskId))||null;
}

function _plannerCoerceMins(timeOrMins,fallbackMins){
  if(typeof timeOrMins==='number'&&Number.isFinite(timeOrMins)) return timeOrMins;
  if(typeof timeOrMins==='string'){
    const normalized=normalizeTaskTime(timeOrMins)||timeOrMins;
    const m=normalized.match(/^(\d{1,2}):(\d{2})$/);
    if(m){
      const h=Math.max(0,Math.min(23,Number(m[1])||0));
      const mm=Math.max(0,Math.min(59,Number(m[2])||0));
      return h*60+mm;
    }
  }
  return fallbackMins;
}

function _plannerNormalizeDuration(durationMins,fallbackMins){
  const raw=Number(durationMins);
  const fallback=Number(fallbackMins)||30;
  const dur=Number.isFinite(raw)&&raw>0?raw:fallback;
  return Math.max(TL_MIN_DUR,Math.round(dur));
}

function _plannerDefaultTaskFields(now){
  return {
    id:now,
    text:'',
    catId:'',
    done:false,
    status:'todo',
    taskScope:'day',
    doneDate:'',
    ts:'',
    durationMins:null,
    order:nextTaskOrder(),
    createdAt:now,
    repeat:null,
    templateId:null,
    generatedForDate:null,
    pinned:false,
    energyRequired:null,
    anxiety:0,
    urgency:0,
    subtasks:[],
    estimatedMins:null,
    note:'',
  };
}

function plannerScheduleTaskAt(taskId,timeOrMins,durationMins,options){
  const opts=options||{};
  const t=_plannerFindTask(taskId);
  if(!t){
    if(opts.showToast!==false) showToast('Task not found','warn');
    return false;
  }
  const mins=_tlClamp(_tlSnap(_plannerCoerceMins(timeOrMins,9*60)));
  const ts=_tlMinsToHHMM(mins);
  t.ts=normalizeTaskTime(ts)||ts;
  t.durationMins=_plannerNormalizeDuration(durationMins,t.durationMins||30);
  save();
  if(opts.showToast!==false) showToast('Scheduled "'+t.text+'" at '+t.ts,'ok');
  if(opts.openTimeline&&opts.ymd){plannerOpenTimeline(opts.ymd);return true;}
  render();
  return true;
}

function plannerScheduleTaskAtDefault(taskId,ymd,options){
  const opts=Object.assign({},options||{},ymd?{ymd,openTimeline:!!(options&&options.openTimeline)}:{});
  return plannerScheduleTaskAt(taskId,'09:00',30,opts);
}

function plannerUnscheduleTask(taskId,options){
  const opts=options||{};
  const t=_plannerFindTask(taskId);
  if(!t){
    if(opts.showToast!==false) showToast('Task not found','warn');
    return false;
  }
  t.ts='';
  t.durationMins=null;
  save();
  if(opts.showToast!==false) showToast('Removed "'+t.text+'" from timeline','ok');
  render();
  return true;
}

function plannerSetTaskDuration(taskId,durationMins,options){
  const opts=options||{};
  const t=_plannerFindTask(taskId);
  if(!t){
    if(opts.showToast!==false) showToast('Task not found','warn');
    return false;
  }
  t.durationMins=_plannerNormalizeDuration(durationMins,t.durationMins||30);
  save();
  if(opts.showToast!==false) showToast('Duration set to '+t.durationMins+'m','ok');
  render();
  return true;
}

function plannerCopyTaskAt(taskId,timeOrMins,durationMins,options){
  const opts=options||{};
  const source=_plannerFindTask(taskId);
  if(!source){
    if(opts.showToast!==false) showToast('Task not found','warn');
    return null;
  }
  const now=Date.now();
  const mins=_tlClamp(_tlSnap(_plannerCoerceMins(timeOrMins,9*60)));
  const ts=_tlMinsToHHMM(mins);
  const copy={
    ...source,
    id:now,
    ts:normalizeTaskTime(ts)||ts,
    durationMins:_plannerNormalizeDuration(durationMins,source.durationMins||30),
    createdAt:now,
    order:nextTaskOrder(),
    done:false,
    status:'todo',
    doneDate:'',
    templateId:null,
    generatedForDate:null,
    subtasks:[],
  };
  tasks.push(copy);
  save();
  if(opts.showToast!==false) showToast('Copied "'+copy.text+'" to '+copy.ts,'ok');
  if(opts.openTimeline&&opts.ymd){plannerOpenTimeline(opts.ymd);return copy;}
  render();
  return copy;
}

function plannerCreateTaskAt(text,timeOrMins,durationMins,catId,options){
  const opts=options||{};
  const clean=(text||'').trim();
  if(!clean){
    if(opts.showToast!==false) showToast('Enter a task name','warn');
    return null;
  }
  const now=Date.now();
  const mins=_tlClamp(_tlSnap(_plannerCoerceMins(timeOrMins,9*60)));
  const ts=_tlMinsToHHMM(mins);
  const task=Object.assign(_plannerDefaultTaskFields(now),{
    text:clean,
    catId:catId||opts.catId||'',
    ts:normalizeTaskTime(ts)||ts,
    durationMins:_plannerNormalizeDuration(durationMins,30),
    taskScope:opts.taskScope||'day',
    note:opts.note||'',
  });
  tasks.push(task);
  save();
  if(opts.showToast!==false) showToast('Added "'+task.text+'" at '+task.ts,'ok');
  if(opts.openTimeline&&opts.ymd){plannerOpenTimeline(opts.ymd);return task;}
  render();
  return task;
}

function plannerAddDumpItem(ymd,text,options){
  const opts=options||{};
  const clean=(text||'').trim();
  if(!ymd||!clean) return null;
  if(!plannerDayDumps[ymd]) plannerDayDumps[ymd]=[];
  const item={id:Date.now(),text:clean,catId:opts.catId||'',done:false,createdAt:Date.now()};
  plannerDayDumps[ymd].unshift(item);
  save();
  if(opts.showToast!==false) showToast('Captured for '+ymd,'ok');
  render();
  return item;
}

function plannerSetPlannerView(view,ymd){
  const allowed=['month','week','dump','day'];
  if(!allowed.includes(view)) view='month';
  if(ymd) plannerSelectedDate=ymd;
  if(view==='day'){
    plannerOpenTimeline(plannerSelectedDate||todayYMD());
    return;
  }
  if(view==='dump'){
    plannerOpenDump(plannerSelectedDate||todayYMD());
    return;
  }
  plannerView=view;
  if(view==='month') plannerSelectedDate=null;
  render();
}

function plannerGoToToday(view){
  const ymd=todayYMD();
  if(view==='day'||view==='timeline'){
    plannerOpenTimeline(ymd);
    return;
  }
  if(view==='week'){
    plannerSelectedDate=ymd;
    plannerView='week';
    render();
    return;
  }
  plannerOpenDump(ymd);
}
