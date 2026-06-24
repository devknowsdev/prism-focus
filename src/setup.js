/*
MODULE: setup.js
LAYER: ui/runtime
PURPOSE: First-run setup readiness guide for prism-focus.
OWNS: first-run setup modal, setup checklist reminders
USES: localStorage, render.js, ui.js
STATE_READS: showFocusSetupModal
STATE_WRITES: showFocusSetupModal
PUBLIC_API: maybeOpenFocusSetup, openFocusSetup, closeFocusSetup, completeFocusSetup, renderFocusSetupModalHtml
INVARIANTS: setup guide is informational; no imports, no hidden writes, no storage migration
LAST_STABILIZED: 2026-06-24
*/

const FOCUS_SETUP_SEEN_KEY = 'adhd4_focus_setup_seen_v1';

function maybeOpenFocusSetup(){
  try{
    if(!localStorage.getItem(FOCUS_SETUP_SEEN_KEY)){
      showFocusSetupModal = true;
    }
  }catch(e){
    showFocusSetupModal = false;
  }
}

function openFocusSetup(){
  showFocusSetupModal = true;
  if(typeof render === 'function') render();
}

function closeFocusSetup(){
  showFocusSetupModal = false;
  if(typeof render === 'function') render();
}

function completeFocusSetup(){
  try{ localStorage.setItem(FOCUS_SETUP_SEEN_KEY, new Date().toISOString()); }catch(e){}
  showFocusSetupModal = false;
  if(typeof showToast === 'function') showToast('Setup guide saved. You can reopen it from the compass button.', 'ok');
  if(typeof render === 'function') render();
}

function focusSetupRemindLater(){
  showFocusSetupModal = false;
  if(typeof showToast === 'function') showToast('Setup guide dismissed for now.', 'ok');
  if(typeof render === 'function') render();
}

function focusSetupCopyLocalServer(){
  const cmd = 'python3 -m http.server 8080';
  try{
    navigator.clipboard?.writeText(cmd);
    if(typeof showToast === 'function') showToast('Copied local launch command.', 'ok');
  }catch(e){
    if(typeof showToast === 'function') showToast(cmd, 'ok');
  }
}

function focusSetupBackupHint(){
  if(typeof showToast === 'function') showToast('Open Day Log → Export → Backup (JSON). Audio is device-only.', 'ok');
}

function renderFocusSetupModalHtml(){
  const cards = [
    {
      icon: 'ti-world',
      title: 'Open safely',
      body: 'Use the hosted demo, open index.html, or run a local server. A local server is best for voice notes.',
      action: '<button onclick="focusSetupCopyLocalServer()" style="'+btnStyle('default','font-size:11px;padding:6px 10px;')+'"><i class="ti ti-copy"></i> copy local command</button>'
    },
    {
      icon: 'ti-database',
      title: 'Know where data lives',
      body: 'Tasks and settings stay in this browser localStorage. Audio recordings stay on this device in IndexedDB.',
      action: ''
    },
    {
      icon: 'ti-device-floppy',
      title: 'Make a backup early',
      body: 'Use Day Log → Export → Backup (JSON). The backup includes app data, but not audio blobs.',
      action: '<button onclick="focusSetupBackupHint()" style="'+btnStyle('default','font-size:11px;padding:6px 10px;')+'"><i class="ti ti-info-circle"></i> where to back up</button>'
    },
    {
      icon: 'ti-sparkles',
      title: 'Keep AI optional',
      body: 'AI is off by default. Enable Ollama or Claude later from Settings → AI only when you want it.',
      action: '<button onclick="closeFocusSetup();openSettings();" style="'+btnStyle('default','font-size:11px;padding:6px 10px;')+'"><i class="ti ti-settings"></i> AI settings</button>'
    }
  ];

  return `<div onclick="if(event.target===this)focusSetupRemindLater()" style="position:fixed;inset:0;background:rgba(0,0,0,.42);z-index:1200;display:flex;align-items:center;justify-content:center;padding:18px;">
    <div onclick="event.stopPropagation()" style="background:${T.surface};border:1.5px solid ${T.border2};border-radius:18px;padding:18px;width:100%;max-width:720px;box-sizing:border-box;max-height:92vh;overflow:auto;box-shadow:0 16px 48px rgba(0,0,0,.22);">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:14px;">
        <div>
          <div style="font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:${T.muted};margin-bottom:4px;">first-run guide</div>
          <div style="font-size:19px;font-weight:900;color:${T.text};line-height:1.2;">Set up Focus without losing your place</div>
          <div style="font-size:12px;color:${T.muted2};line-height:1.5;margin-top:6px;max-width:560px;">This guide does not import, publish, sync, or change your tasks. It only points to the safest launch, backup, and optional AI setup paths.</div>
        </div>
        <button onclick="focusSetupRemindLater()" style="${btnStyle('default','padding:5px 9px;font-size:14px;flex-shrink:0;')}"><i class="ti ti-x"></i></button>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px;margin:14px 0;">
        ${cards.map(card=>`<section style="background:${T.surface2};border:1.5px solid ${T.border};border-radius:14px;padding:13px;display:flex;flex-direction:column;gap:8px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <i class="ti ${card.icon}" style="color:${T.accent};font-size:17px;"></i>
            <div style="font-size:13px;font-weight:850;color:${T.text};">${esc(card.title)}</div>
          </div>
          <div style="font-size:12px;color:${T.muted};line-height:1.55;flex:1;">${esc(card.body)}</div>
          ${card.action?`<div>${card.action}</div>`:''}
        </section>`).join('')}
      </div>

      <div style="padding:11px 12px;background:${T.surface3};border:1px solid ${T.borderBlue||T.border};border-radius:12px;font-size:11px;color:${T.muted};line-height:1.55;margin-bottom:14px;">
        <strong style="color:${T.text};">Safety boundary:</strong> Focus does not secretly import from EPK or Spectra. Any future cross-app packet should appear as a review screen before it changes tasks, planner state, or backups.
      </div>

      <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center;">
        <button onclick="focusSetupRemindLater()" style="${btnStyle('default','font-size:12px;padding:8px 12px;')}">Remind me later</button>
        <button onclick="completeFocusSetup()" style="${btnStyle('accent','font-size:13px;padding:9px 16px;')}"><i class="ti ti-check"></i> Done for now</button>
      </div>
    </div>
  </div>`;
}
