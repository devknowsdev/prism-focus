/*
MODULE: planner_calendar_click_fixes.js
LAYER: render patch
PURPOSE: Use click-to-reveal planner month details and progressive date shading.
USES: render_planner.js globals, helpers.js date utilities, state.js theme/task state.
INVARIANTS: render-only override; no persistence writes; no planner data mutation.
*/
(function(){
  const root=(typeof window!=='undefined')?window:globalThis;

  function shadeForPlannerDate(ymd, monthLength){
    const d=ymdToDate(ymd);
    const weekday=(d.getDay()+6)%7; // Monday=0, Sunday=6
    const weekProgress=weekday/6;
    const monthProgress=(d.getDate()-1)/Math.max(1,monthLength-1);
    return Math.min(0.24,0.03+(weekProgress*0.07)+(monthProgress*0.14));
  }

  function gradedBackground(base, shade){
    return `linear-gradient(rgba(0,0,0,${shade.toFixed(3)}),rgba(0,0,0,${shade.toFixed(3)})), ${base}`;
  }

  function plannerMonthCellClick(ymd){
    if(plannerSelectedDate===ymd){
      plannerOpenTimeline(ymd);
      return;
    }
    plannerSelectedDate=ymd;
    plannerView='month';
    render();
  }

  function plannerCloseMonthDetail(){
    if(plannerView!=='month'||!plannerSelectedDate) return false;
    plannerSelectedDate=null;
    render();
    return true;
  }

  function isTextEditingTarget(target){
    if(!target||!target.closest) return false;
    return !!target.closest('input, textarea, select, [contenteditable="true"]');
  }

  function renderPlannerCalendarMonthClick(){
    const today=new Date();
    const todayYmd2=dateToYMD(today);
    if(!plannerMonth) plannerMonth={year:today.getFullYear(),month:today.getMonth()};
    const {year,month}=plannerMonth;
    const MONTH_NAMES=['January','February','March','April','May','June','July','August','September','October','November','December'];
    const DAY_LABELS=['Mo','Tu','We','Th','Fr','Sa','Su'];
    const firstDay=new Date(year,month,1);
    const lastDay=new Date(year,month+1,0);
    const monthLength=lastDay.getDate();
    const startPad=(firstDay.getDay()+6)%7;
    const cells=[];
    for(let i=0;i<startPad;i++) cells.push(null);
    for(let d=1;d<=monthLength;d++){
      cells.push(year+'-'+String(month+1).padStart(2,'0')+'-'+String(d).padStart(2,'0'));
    }
    while(cells.length%7!==0) cells.push(null);

    const scheduledTasks=tasks.filter(t=>t.ts&&t.status!=='done');
    const rows=[];

    for(let r=0;r<cells.length/7;r++){
      const tds=cells.slice(r*7,r*7+7).map((ymd,weekdayIdx)=>{
        if(!ymd) return `<td style="border:1px solid ${T.border};background:${T.surface2};min-height:56px;"></td>`;
        const isToday=ymd===todayYmd2;
        const isSelected=ymd===plannerSelectedDate;
        const isPast=ymd<todayYmd2;
        const dObj=ymdToDate(ymd);
        const dayNum=dObj.getDate();
        const shade=shadeForPlannerDate(ymd,monthLength);
        const baseBg=isSelected?T.accent2+'22':isToday?T.surface3:isPast?T.surface2:T.surface;
        const bg=gradedBackground(baseBg,shade);
        const chipBase=isSelected?T.accent2+'30':isToday?T.accent+'24':T.surface2;
        const chipBg=gradedBackground(chipBase,shade);
        const dumpCount=(plannerDayDumps[ymd]||[]).filter(x=>!x.done).length;
        const MAX_SHOW=3;
        const dayDots=scheduledTasks.slice(0,MAX_SHOW).map(t=>{
          const cat=getCat(t.catId);
          return `<span style="width:5px;height:5px;border-radius:50%;background:${cat?cat.color.dot:T.accent2};display:inline-block;flex-shrink:0;"></span>`;
        }).join('');
        const overflow=scheduledTasks.length>MAX_SHOW?`<span style="font-size:7px;color:${T.muted2};">+${scheduledTasks.length-MAX_SHOW}</span>`:'';
        const detailTasks=scheduledTasks.slice(0,5).map(t=>{
          return `<div style="font-size:10px;color:${T.text};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            <span style="font-family:'DM Mono',monospace;color:${T.muted2};">${esc(t.ts||'--:--')}</span> ${esc(t.text)}
          </div>`;
        }).join('');
        const detailMore=scheduledTasks.length>5?`<div style="font-size:9px;color:${T.muted2};margin-top:2px;">+${scheduledTasks.length-5} more scheduled</div>`:'';
        const detailEmpty=(!scheduledTasks.length&&!dumpCount)?`<div style="font-size:10px;color:${T.muted2};">No scheduled items or captures.</div>`:'';
        const detail=isSelected?`<div class="planner-day-detail" style="background:${bg};color:${T.text};">
          <div style="font-size:11px;font-weight:800;color:${isToday?T.accent:T.text};margin-bottom:4px;">${esc(_plannerDateLabel(ymd))}</div>
          ${detailTasks}${detailMore}
          ${dumpCount?`<div style="font-size:10px;color:${T.accent2};margin-top:4px;font-weight:700;">${dumpCount} open capture${dumpCount===1?'':'s'}</div>`:''}
          ${detailEmpty}
          <div style="font-size:9px;color:${T.muted2};margin-top:5px;">Click again = day view · Backspace = close</div>
        </div>`:'';
        return `<td class="planner-day-cell" tabindex="0" onclick="plannerMonthCellClick('${ymd}')" ondblclick="event.stopPropagation();plannerOpenTimeline('${ymd}')"
          aria-label="${esc(_plannerDateLabel(ymd))}"
          style="border:${isSelected||isToday?'2px':'1px'} solid ${isSelected?T.accent2:isToday?T.border2:T.border};
                 vertical-align:top;cursor:pointer;padding:3px 4px;min-height:56px;background:${bg};user-select:none;overflow:visible;">
          <div style="display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:20px;padding:0 5px;border-radius:999px;font-size:11px;font-weight:${isToday?800:600};color:${isToday?T.accent:isPast?T.muted2:T.text};background:${chipBg};border:1px solid ${isToday?T.accent+'55':T.border};">${dayNum}</div>
          ${aiPendingSuggestion && isToday?`<div style="width:8px;height:8px;border-radius:50%;background:${T.accent};margin:4px 0 2px;"></div>`:''}
          <div style="display:flex;flex-wrap:wrap;gap:2px;margin-top:2px;align-items:center;">${dayDots}${overflow}${dumpCount?`<span style="font-size:8px;font-weight:700;color:${T.accent2};">${dumpCount}</span>`:''}</div>
          ${detail}
        </td>`;
      }).join('');
      rows.push(`<tr>${tds}</tr>`);
    }

    const headerCells=DAY_LABELS.map((label,idx)=>{
      const shade=0.03+(idx/6)*0.09;
      return `<th style="font-size:9px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:${T.muted};padding:3px 0;text-align:center;border:1px solid ${T.border};background:${gradedBackground(T.surface2,shade)};">${label}</th>`;
    }).join('');

    return `
      <div style="display:flex;align-items:center;gap:6px;padding:6px 10px;border-bottom:1px solid ${T.border};background:${T.surface};">
        <button onclick="plannerNavMonth(-1)" style="${btnStyle('default','font-size:11px;padding:3px 8px;')}"><i class="ti ti-chevron-left"></i></button>
        <div style="flex:1;text-align:center;font-size:13px;font-weight:700;color:${T.text};">${MONTH_NAMES[month]} ${year}</div>
        <button onclick="plannerNavMonth(1)" style="${btnStyle('default','font-size:11px;padding:3px 8px;')}"><i class="ti ti-chevron-right"></i></button>
      </div>
      <div style="padding:2px 8px 2px;background:${T.surface};border-bottom:1px solid ${T.border};font-size:9px;color:${T.muted2};">Click once = details · click same day again = day view · Backspace = close details</div>
      <div style="overflow-x:auto;background:${T.surface};padding-bottom:80px;">
        <table style="width:100%;border-collapse:collapse;min-width:280px;table-layout:fixed;">
          <thead><tr>${headerCells}</tr></thead>
          <tbody>${rows.join('')}</tbody>
        </table>
      </div>`;
  }

  root.plannerMonthCellClick=plannerMonthCellClick;
  root.plannerCloseMonthDetail=plannerCloseMonthDetail;
  root._renderPlannerMonth=renderPlannerCalendarMonthClick;

  if(root.addEventListener){
    root.addEventListener('keydown',function(event){
      if(event.key!=='Backspace') return;
      if(isTextEditingTarget(event.target)) return;
      if(plannerCloseMonthDetail()){
        event.preventDefault();
        event.stopPropagation();
      }
    },true);
  }

  if(typeof globalThis!=='undefined'){
    globalThis.plannerMonthCellClick=plannerMonthCellClick;
    globalThis.plannerCloseMonthDetail=plannerCloseMonthDetail;
    globalThis._renderPlannerMonth=renderPlannerCalendarMonthClick;
  }
})();
