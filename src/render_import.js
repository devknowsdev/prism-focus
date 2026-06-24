/*
MODULE: render_import.js
LAYER: render
PURPOSE: Review-first UI for EPK event packet import.
OWNS: EPK import modal HTML
USES: state.js, helpers.js, core.js, actions_import.js
STATE_READS: epkImportError, epkImportPacket, epkImportRaw, epkImportSelectedTaskIds, T
STATE_WRITES: none
PUBLIC_API: renderEpkImportModalHtml
INVARIANTS: render only; importing requires explicit approve action
LAST_STABILIZED: 2026-06-24
*/

function renderEpkImportModalHtml(){
  const packet=epkImportPacket;
  const taskRows=packet?renderEpkImportTaskRows(packet):'';
  const eventLine=packet?`${packet.event.title} · ${packet.event.date} · ${packet.event.timezone}`:'Paste an EPK event packet JSON exported from Beam/EPK.';
  const selectedCount=packet?epkImportSelectedTaskIds.size:0;
  const totalCount=packet?(packet.tasks||[]).length:0;
  return `
  <div onclick="if(event.target===this)closeEpkImport()" style="position:fixed;inset:0;background:rgba(0,0,0,.42);z-index:2300;display:flex;align-items:center;justify-content:center;padding:18px;">
    <div style="background:${T.surface};border:1.5px solid ${T.border2};border-radius:18px;padding:18px;width:100%;max-width:760px;max-height:92vh;overflow:auto;box-sizing:border-box;box-shadow:0 16px 48px rgba(0,0,0,.22);">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:12px;">
        <div>
          <div style="font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:${T.muted};margin-bottom:3px;">Review import</div>
          <div style="font-size:18px;font-weight:900;color:${T.text};">EPK → Focus event packet</div>
          <div style="font-size:12px;color:${T.muted};margin-top:3px;">${esc(eventLine)}</div>
        </div>
        <button onclick="closeEpkImport()" style="${btnStyle('default','padding:6px 10px;font-size:14px;border-radius:9px;')}"><i class="ti ti-x"></i></button>
      </div>

      <div style="padding:10px 12px;border:1.5px solid ${T.border};background:${T.surface2};border-radius:12px;margin-bottom:12px;font-size:12px;color:${T.muted};line-height:1.45;">
        This screen never imports silently. Paste JSON, review the proposed tasks, select what you want, then click <strong>Import selected</strong>.
      </div>

      <div data-no-clobber="true" style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px;">
        <label style="font-size:11px;font-weight:800;color:${T.muted};letter-spacing:.06em;text-transform:uppercase;">Packet JSON</label>
        <textarea id="epk-import-json" rows="8" spellcheck="false" oninput="epkImportSetRaw(this.value)" placeholder="Paste epk-to-focus.event-packet JSON here…" style="${inputStyle('font-family:DM Mono,monospace;font-size:12px;min-height:150px;')}" >${esc(epkImportRaw||'')}</textarea>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
          <button onclick="epkImportLoadFromText()" style="${btnStyle('accent','font-size:12px;padding:7px 12px;border-radius:9px;')}"><i class="ti ti-file-check"></i> Review packet</button>
          <button onclick="epkImportReset()" style="${btnStyle('default','font-size:12px;padding:7px 12px;border-radius:9px;')}"><i class="ti ti-refresh"></i> Reset</button>
          ${epkImportError?`<span style="font-size:12px;color:${T.pomo};font-weight:700;">${esc(epkImportError)}</span>`:''}
        </div>
      </div>

      ${packet?`
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin:12px 0 8px;">
          <div style="font-size:13px;font-weight:900;color:${T.text};">Proposed tasks <span style="color:${T.muted};font-weight:700;">${selectedCount}/${totalCount} selected</span></div>
          <div style="display:flex;gap:6px;">
            <button onclick="epkImportSelectAll()" style="${btnStyle('default','font-size:11px;padding:5px 9px;')}">all</button>
            <button onclick="epkImportSelectNone()" style="${btnStyle('default','font-size:11px;padding:5px 9px;')}">none</button>
          </div>
        </div>
        <div style="border:1.5px solid ${T.border};border-radius:12px;overflow:hidden;margin-bottom:12px;">
          ${taskRows}
        </div>
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;">
          <div style="font-size:11px;color:${T.muted};max-width:430px;line-height:1.4;">Import creates normal Focus tasks with source IDs so repeat imports can skip duplicates.</div>
          <button onclick="epkImportApproveSelected()" style="${btnStyle('accent2','font-size:13px;padding:8px 14px;border-radius:10px;')}"><i class="ti ti-check"></i> Import selected</button>
        </div>
      `:''}
    </div>
  </div>`;
}

function renderEpkImportTaskRows(packet){
  return (packet.tasks||[]).map((task,idx)=>{
    const selected=epkImportSelectedTaskIds.has(String(idx));
    const due=task.dueDate?` · due ${esc(task.dueDate)}`:'';
    const estimate=task.estimatedMinutes?` · ${esc(String(task.estimatedMinutes))}m`:'';
    const kind=task.kind||'task';
    return `<div style="display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border-bottom:1px solid ${T.border};background:${selected?T.surface2:T.surface};">
      <input type="checkbox" ${selected?'checked':''} onchange="epkImportToggleTask(${idx})" style="margin-top:3px;">
      <div style="flex:1;min-width:0;">
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
          <span style="font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${T.accent2};">${esc(kind)}</span>
          <span style="font-size:11px;color:${T.muted};">${esc(task.scope||'project')}${due}${estimate}</span>
        </div>
        <div style="font-size:13px;font-weight:800;color:${T.text};margin-top:2px;">${esc(task.title||'Untitled task')}</div>
        ${task.notes?`<div style="font-size:11px;color:${T.muted};margin-top:3px;line-height:1.35;">${esc(task.notes)}</div>`:''}
      </div>
    </div>`;
  }).join('');
}

if(typeof window!=='undefined') window.renderEpkImportModalHtml=renderEpkImportModalHtml;
if(typeof globalThis!=='undefined') globalThis.renderEpkImportModalHtml=renderEpkImportModalHtml;
