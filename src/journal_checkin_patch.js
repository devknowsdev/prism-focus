/*
MODULE: journal_checkin_patch.js
LAYER: ui patch
PURPOSE: Put a simple Energy check-in button inside Journal and hide the old standalone check-in widget.
USES: render_journal.js, render_checkin.js energy helpers, storage.js widget layout
INVARIANTS: Keeps journal widget id stable; hides standalone check-in from default and migrated layouts.
LAST_STABILIZED: 2026-06-27
*/
(function(){
  let journalEnergyOpen=false;
  let lastTodayStr='';
  let lastNow=null;

  function _escape(value){
    if (typeof esc === 'function') return esc(String(value ?? ''));
    return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function _setJournalLabel(){
    try {
      const journalDef = typeof getWidgetDef === 'function' ? getWidgetDef('journal') : null;
      if (journalDef) {
        journalDef.label = 'Journal';
        journalDef.icon = 'ti-notebook';
      }
      const checkinDef = typeof getWidgetDef === 'function' ? getWidgetDef('checkin') : null;
      if (checkinDef) {
        checkinDef.label = 'Check-in';
        checkinDef.defaultVisible = false;
        checkinDef.pinnable = false;
      }
    } catch (e) {
      console.warn('Journal/check-in label patch failed', e);
    }
  }

  function _energySummary(todayStr){
    const existing = typeof getEnergyToday === 'function' ? getEnergyToday(todayStr) : null;
    if (!existing || !existing.energy) return 'not logged yet';
    const suffix = [existing.sensory, existing.tag].filter(Boolean).join(' · ');
    return `energy ${existing.energy}/5${suffix ? ' · ' + suffix : ''}`;
  }

  function _energyBodyHtml(todayStr, now){
    const existing = typeof getEnergyToday === 'function' ? getEnergyToday(todayStr) : null;
    const levels=[{v:1,icon:'💤',label:'Low'},{v:2,icon:'🌙',label:'Lo-mid'},{v:3,icon:'☀️',label:'Mid'},{v:4,icon:'🔥',label:'High'},{v:5,icon:'⚡',label:'Peak'}];
    const sensoryOpts=[{v:'calm',label:'Calm'},{v:'moderate',label:'Moderate'},{v:'overwhelmed',label:'Overwhelmed'}];
    const cur=energyPending && energyPending.energy!=null ? energyPending : (existing?{...existing}:{energy:null,sensory:null,tag:''});

    const energyBtns=levels.map(l=>`
      <button onclick="journalEnergySet('energy',${l.v})" title="${l.label}"
        style="${btnStyle(cur.energy===l.v?'accent':'default','flex:1;flex-direction:column;align-items:center;gap:1px;font-size:16px;padding:5px 2px;border-radius:8px;line-height:1;')}">
        ${l.icon}<div style="font-size:8px;margin-top:2px;white-space:nowrap;">${l.label}</div>
      </button>`).join('');

    const sensoryRow=cur.energy!=null?`
      <div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;margin-top:6px;" data-no-clobber="true">
        ${sensoryOpts.map(s=>`<button onclick="journalEnergySet('sensory','${s.v}')"
          style="${btnStyle(cur.sensory===s.v?'accent2':'default','font-size:10px;padding:3px 9px;border-radius:999px;')}">${s.label}</button>`).join('')}
        <input type="text" placeholder="tag…" maxlength="40" value="${_escape(cur.tag||'')}"
          oninput="journalEnergyTag(this.value)"
          style="${inputStyle('flex:1;min-width:80px;font-size:11px;padding:4px 8px;')}"/>
        <button onclick="journalEnergySave()"
          style="${btnStyle('accent','font-size:11px;padding:4px 10px;')}">
          ${existing?'Update':'Log'}
        </button>
      </div>`:
      `<div style="font-size:10px;color:${T.muted2};margin-top:5px;text-align:center;">Pick your energy level to log today's check-in</div>`;

    const sparkDots=(()=>{
      const dots=[];
      for(let i=6;i>=0;i--){
        const d=new Date(now || new Date());d.setDate(d.getDate()-i);
        const ds=d.toDateString();
        const entry=(energyLog||[]).find(e=>e.date===ds);
        const energyColors=['','#64748b','#7c3aed','#0284c7','#16a34a','#ca8a04',T.urg3];
        const col=entry?energyColors[entry.energy]||T.border:T.border;
        const isToday=i===0;
        dots.push(`<span title="${d.toLocaleDateString()}: ${entry?'Energy '+entry.energy+'/5':'No entry'}"
          style="width:${isToday?14:10}px;height:${isToday?14:10}px;border-radius:50%;background:${col};display:inline-block;
                 border:${isToday?'2px':'1.5px'} solid ${isToday?T.border2:T.border};flex-shrink:0;"></span>`);
      }
      return dots.join('');
    })();

    return `<div style="padding:8px 10px;border-top:1px solid ${T.border};background:${T.surface};">
      <div style="display:flex;gap:3px;">${energyBtns}</div>
      ${sensoryRow}
      <div style="display:flex;align-items:center;gap:4px;margin-top:6px;padding-top:5px;border-top:1px solid ${T.border};">
        ${sparkDots}
        ${existing?`<span style="font-size:10px;color:${T.muted2};margin-left:auto;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px;">
          ${levels.find(l=>l.v===existing.energy)?.icon||''} ${existing.sensory||''}${existing.tag?' · '+_escape(existing.tag):''}
        </span>`:''}
      </div>
    </div>`;
  }

  function _energyButtonHtml(todayStr, now){
    lastTodayStr=todayStr;
    lastNow=now || new Date();
    const open = !!journalEnergyOpen;
    return `<div id="journal-energy-checkin" style="margin-bottom:10px;background:${T.surface2};border:1.5px solid ${T.border};border-radius:12px;overflow:hidden;">
      <button onclick="toggleJournalEnergyCheckin()" title="Energy check-in" style="width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;border:none;background:transparent;color:${T.text};cursor:pointer;padding:9px 10px;text-align:left;">
        <span style="display:flex;align-items:center;gap:7px;min-width:0;">
          <i class="ti ti-heart-rate-monitor" style="color:${T.accent2};font-size:15px;"></i>
          <span style="font-size:12px;font-weight:900;color:${T.text};">Energy check-in</span>
          <span id="journal-energy-summary" style="font-size:10px;color:${T.muted2};font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_escape(_energySummary(todayStr))}</span>
        </span>
        <span style="font-size:12px;color:${T.muted};"><i class="ti ti-chevron-${open?'up':'down'}"></i></span>
      </button>
      <div id="journal-energy-checkin-body">${open ? _energyBodyHtml(todayStr, now) : ''}</div>
    </div>`;
  }

  function _refreshEnergyCheckinDom(){
    const todayStr = lastTodayStr || new Date().toDateString();
    const now = lastNow || new Date();
    const body = document.getElementById('journal-energy-checkin-body');
    if (body) body.innerHTML = journalEnergyOpen ? _energyBodyHtml(todayStr, now) : '';
    const summary = document.getElementById('journal-energy-summary');
    if (summary) summary.textContent = _energySummary(todayStr);
    const root = document.getElementById('journal-energy-checkin');
    if (root) {
      const icon = root.querySelector('button > span:last-child i');
      if (icon) icon.className = `ti ti-chevron-${journalEnergyOpen?'up':'down'}`;
    }
  }

  function _renameJournalUi(html){
    return String(html || '')
      .replace(/<i class="ti ti-inbox"><\/i>dump — capture now, sort later/g, '<i class="ti ti-notebook"><\/i>journal — capture now, sort later')
      .replace(/Nothing here is a commitment\. Promote to task when ready\./g, 'Nothing here is a commitment. Promote a journal note to a task when ready.')
      .replace(/title="Add to Tasks"/g, 'title="Add journal note to Tasks"');
  }

  function _patchJournalRender(){
    const journalDef = typeof getWidgetDef === 'function' ? getWidgetDef('journal') : null;
    if (!journalDef || typeof journalDef.render !== 'function' || journalDef.__journalCheckinPatched) return false;

    const originalRender = journalDef.render;
    journalDef.render = function patchedJournalRender(todayStr, now){
      const actualNow = now || new Date();
      const actualToday = todayStr || actualNow.toDateString();
      const originalHtml = _renameJournalUi(originalRender(actualToday, actualNow));
      const insert = _energyButtonHtml(actualToday, actualNow);
      return String(originalHtml).replace('<div id="journal-card" data-no-clobber="true">', `<div id="journal-card" data-no-clobber="true">${insert}`);
    };
    journalDef.__journalCheckinPatched = true;

    try { renderJournalWidget = journalDef.render; } catch (e) {}
    return true;
  }

  function _patchLayoutLoader(){
    if (typeof loadWidgetLayout !== 'function' || loadWidgetLayout.__journalCheckinPatched) return false;
    const originalLoadWidgetLayout = loadWidgetLayout;
    loadWidgetLayout = function patchedLoadWidgetLayout(){
      originalLoadWidgetLayout();
      try {
        const journalItem = widgetLayout.find(w => w.id === 'journal');
        const checkinItem = widgetLayout.find(w => w.id === 'checkin');
        if (journalItem) journalItem.visible = true;
        if (checkinItem) {
          checkinItem.visible = false;
          checkinItem.collapsed = true;
          if (journalItem && checkinItem.order < journalItem.order) journalItem.order = checkinItem.order;
        }
      } catch (e) {
        console.warn('Journal/check-in layout migration failed', e);
      }
    };
    loadWidgetLayout.__journalCheckinPatched = true;
    return true;
  }

  window.toggleJournalEnergyCheckin = function toggleJournalEnergyCheckin(){
    journalEnergyOpen = !journalEnergyOpen;
    _refreshEnergyCheckinDom();
  };

  window.journalEnergySet = function journalEnergySet(field, value){
    if (!energyPending || typeof energyPending !== 'object') energyPending={energy:null,sensory:null,tag:''};
    energyPending[field]=value;
    _refreshEnergyCheckinDom();
  };

  window.journalEnergyTag = function journalEnergyTag(value){
    if (!energyPending || typeof energyPending !== 'object') energyPending={energy:null,sensory:null,tag:''};
    energyPending.tag=value;
  };

  window.journalEnergySave = function journalEnergySave(){
    const todayStr = lastTodayStr || new Date().toDateString();
    if (typeof saveEnergyCheckin === 'function') saveEnergyCheckin(todayStr);
    journalEnergyOpen = false;
    setTimeout(_refreshEnergyCheckinDom, 0);
    setTimeout(_refreshEnergyCheckinDom, 80);
  };

  function install(){
    _setJournalLabel();
    _patchJournalRender();
    _patchLayoutLoader();
  }

  install();
  setTimeout(install, 0);
  setTimeout(install, 100);
})();
