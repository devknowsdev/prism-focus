/*
MODULE: journal_checkin_patch.js
LAYER: ui patch
PURPOSE: Rename Dump to Journal and hide the old standalone check-in widget from the active surface.
USES: render_journal.js, storage.js widget layout
INVARIANTS: Keeps journal widget id stable; does not render energy/check-in UI in Journal.
LAST_STABILIZED: 2026-06-27
*/
(function(){
  function _setJournalLabel(){
    try {
      const journalDef = typeof getWidgetDef === 'function' ? getWidgetDef('journal') : null;
      if (journalDef) {
        journalDef.label = 'Journal';
        journalDef.icon = 'ti-notebook';
      }
      const checkinDef = typeof getWidgetDef === 'function' ? getWidgetDef('checkin') : null;
      if (checkinDef) {
        checkinDef.label = 'Energy / check-in';
        checkinDef.defaultVisible = false;
        checkinDef.pinnable = false;
      }
    } catch (e) {
      console.warn('Journal label patch failed', e);
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
    if (!journalDef || typeof journalDef.render !== 'function' || journalDef.__journalRenamePatched) return false;

    const originalRender = journalDef.render;
    journalDef.render = function patchedJournalRender(todayStr, now){
      const actualNow = now || new Date();
      const actualToday = todayStr || actualNow.toDateString();
      return _renameJournalUi(originalRender(actualToday, actualNow));
    };
    journalDef.__journalRenamePatched = true;

    try { renderJournalWidget = journalDef.render; } catch (e) {}
    return true;
  }

  function _patchLayoutLoader(){
    if (typeof loadWidgetLayout !== 'function' || loadWidgetLayout.__journalRenamePatched) return false;
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
    loadWidgetLayout.__journalRenamePatched = true;
    return true;
  }

  function install(){
    _setJournalLabel();
    _patchJournalRender();
    _patchLayoutLoader();
  }

  install();
  setTimeout(install, 0);
  setTimeout(install, 100);
})();
