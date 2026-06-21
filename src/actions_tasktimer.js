// -----------------------------
// MONTH CALENDAR VIEW (GRID)
// -----------------------------

function getMonthMatrix(referenceDate=new Date()){
  const year=referenceDate.getFullYear();
  const month=referenceDate.getMonth();

  const first=new Date(year,month,1);
  const startDay=(first.getDay()+6)%7; // Mon=0

  const daysInMonth=new Date(year,month+1,0).getDate();

  const cells=[];

  for(let i=0;i<startDay;i++) cells.push(null);
  for(let d=1;d<=daysInMonth;d++) cells.push(d);

  return {year,month,cells};
}

function formatDayKey(year,month,day){
  const m=String(month+1).padStart(2,'0');
  const d=String(day).padStart(2,'0');
  return `${year}-${m}-${d}`;
}

function renderMonthCalendar(containerId,referenceDate=new Date()){
  const el=document.getElementById(containerId);
  if(!el) return;

  const {year,month,cells}=getMonthMatrix(referenceDate);

  let html='<div class="month-grid">';

  cells.forEach(cell=>{
    if(!cell){
      html+='<div class="month-cell empty"></div>';
      return;
    }

    const key=formatDayKey(year,month,cell);

    html+=`
      <div class="month-cell" data-day="${key}">
        <div class="day-num">${cell}</div>
      </div>
    `;
  });

  html+='</div>';
  el.innerHTML=html;

  attachMonthHover(el);
}

function attachMonthHover(root){
  const cells=root.querySelectorAll('.month-cell[data-day]');

  cells.forEach(c=>{
    const day=c.getAttribute('data-day');

    c.addEventListener('mouseenter',(e)=>{
      renderDayPreview(day,e.clientX,e.clientY);
    });

    c.addEventListener('mousemove',(e)=>{
      const preview=document.getElementById('day-preview');
      if(preview){
        preview.style.left=(e.clientX+10)+'px';
        preview.style.top=(e.clientY+10)+'px';
      }
    });

    c.addEventListener('mouseleave',hideDayPreview);
  });
}

// extend export
window.__calendarUI = {
  ...window.__calendarUI,
  renderMonthCalendar,
  attachMonthHover
};