/*
MODULE: journal_checkin_patch.js
LAYER: ui patch
PURPOSE: Absorb Daily Check-in into the Journal widget and keep it optional/collapsible.
USES: render_journal.js, render_checkin.js, storage.js widget layout
INVARIANTS: Keeps journal widget id stable; hides standalone check-in from default and migrated layouts.
LAST_STABILIZED: 2026-06-27
*/
(function(){
  let journalCheckinOpen=false;

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

  function _checkinSummary(todayStr){
    const existing = typeof getEnergyToday === 'function' ? getEnergyToday(todayStr) : null;
    const energy = existing && existing.energy ? `energy ${existing.energy}/5` : 'energy not logged';
    const done = dailyIntentions && dailyIntentions.step === 'done';
    const plan = done ? 'daily plan done' : 'daily plan optional';
    return `${energy} · ${plan}`;
  }

  function _embeddedCheckinHtml(todayStr, now){
    const summary = _checkinSummary(todayStr);
    const open = !!journalCheckinOpen;
    const body = open && typeof renderCheckinWidget === 'function'
      ? `<div style="margin-top:8px;padding-top:8px;border-top:1px solid ${T.border};">${renderCheckinWidget(todayStr, now)}</div>`
      : '';

    return `<div style="margin-bottom:10px;background:${T.surface2};border:1.5px solid ${T.border};border-radius:12px;overflow:hidden;">
      <button onclick="toggleJournalCheckin()" title="Optional daily check-in" style="width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;border:none;background:transparent;color:${T.text};cursor:pointer;padding:9px 10px;text-align:left;">
        <span style="display:flex;align-items:center;gap:7px;min-width:0;">
          <i class="ti ti-heart-rate-monitor" style="color:${T.accent2};font-size:15px;"></i>
          <span style="font-size:12px;font-weight:900;color:${T.text};">Optional check-in</span>
          <span style="font-size:10px;color:${T.muted2};font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_escape(summary)}</span>
        </span>
        <span style="font-size:12px;color:${T.muted};"><i class="ti ti-chevron-${open?'up':'down'}"></i></span>
      </button>
      ${body}
    </div>`;
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
      const insert = _embeddedCheckinHtml(actualToday, actualNow);
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

  window.toggleJournalCheckin = function toggleJournalCheckin(){
    journalCheckinOpen = !journalCheckinOpen;
    if (typeof render === 'function') render();
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
