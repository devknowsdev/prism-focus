/*
MODULE: actions_import.js
LAYER: actions
PURPOSE: Review-first EPK event packet import actions.
OWNS: parsing, validating, selecting, and importing reviewed EPK packet tasks
USES: state.js, helpers.js, storage.js, ui.js, render.js
STATE_READS: categories, epkImportPacket, epkImportSelectedTaskIds, tasks
STATE_WRITES: epkImportError, epkImportPacket, epkImportRaw, epkImportSelectedTaskIds, showEpkImportModal, tasks
PUBLIC_API: openEpkImport, closeEpkImport, epkImportLoadFromText, epkImportToggleTask, epkImportApproveSelected
INVARIANTS: never imports without explicit review click; never reads remote sources; never mutates Focus from EPK silently
LAST_STABILIZED: 2026-06-24
*/

function openEpkImport(){
  showEpkImportModal=true;
  epkImportError='';
  render();
}

function closeEpkImport(){
  showEpkImportModal=false;
  epkImportError='';
  render();
}

function epkImportReset(){
  epkImportRaw='';
  epkImportPacket=null;
  epkImportSelectedTaskIds=new Set();
  epkImportError='';
  render();
}

function epkImportSetRaw(value){
  epkImportRaw=String(value||'');
}

function epkImportLoadFromText(){
  epkImportError='';
  let packet=null;
  try{
    packet=JSON.parse(epkImportRaw||'');
  }catch(e){
    epkImportPacket=null;
    epkImportSelectedTaskIds=new Set();
    epkImportError='That JSON could not be parsed.';
    render();
    return;
  }
  const validation=validateEpkEventPacket(packet);
  if(!validation.ok){
    epkImportPacket=null;
    epkImportSelectedTaskIds=new Set();
    epkImportError=validation.error;
    render();
    return;
  }
  epkImportPacket=packet;
  epkImportSelectedTaskIds=new Set((packet.tasks||[]).map((_,idx)=>String(idx)));
  render();
}

function validateEpkEventPacket(packet){
  if(!packet||typeof packet!=='object') return {ok:false,error:'Packet must be a JSON object.'};
  if(packet.packetType!=='epk-to-focus.event-packet') return {ok:false,error:'Packet type must be epk-to-focus.event-packet.'};
  if(!packet.schemaVersion) return {ok:false,error:'Packet is missing schemaVersion.'};
  if(!packet.source||packet.source.system!=='EPK') return {ok:false,error:'Packet source.system must be EPK.'};
  if(!packet.review||!packet.review.status) return {ok:false,error:'Packet is missing review.status.'};
  if(!packet.event||!packet.event.title||!packet.event.date||!packet.event.timezone) return {ok:false,error:'Packet event must include title, date, and timezone.'};
  if(!Array.isArray(packet.tasks)||packet.tasks.length===0) return {ok:false,error:'Packet must include at least one proposed task.'};
  const bad=packet.tasks.findIndex(t=>!t||typeof t!=='object'||!String(t.title||'').trim());
  if(bad>=0) return {ok:false,error:`Task ${bad+1} is missing a title.`};
  return {ok:true};
}

function epkImportToggleTask(idx){
  const key=String(idx);
  if(epkImportSelectedTaskIds.has(key)) epkImportSelectedTaskIds.delete(key);
  else epkImportSelectedTaskIds.add(key);
  render();
}

function epkImportSelectAll(){
  if(!epkImportPacket){render();return;}
  epkImportSelectedTaskIds=new Set((epkImportPacket.tasks||[]).map((_,idx)=>String(idx)));
  render();
}

function epkImportSelectNone(){
  epkImportSelectedTaskIds=new Set();
  render();
}

function epkImportApproveSelected(){
  if(!epkImportPacket){epkImportError='Load a valid packet first.';render();return;}
  const selected=(epkImportPacket.tasks||[])
    .map((task,idx)=>({task,idx}))
    .filter(row=>epkImportSelectedTaskIds.has(String(row.idx)));
  if(!selected.length){epkImportError='Select at least one task to import.';render();return;}

  const importedAt=Date.now();
  const existingSources=new Set(tasks.map(t=>t.sourceId).filter(Boolean));
  let added=0;
  selected.forEach(({task,idx})=>{
    const sourceId=String(task.sourceId||`${epkImportPacket.source.recordId||'epk'}:${idx}`);
    if(existingSources.has(sourceId)) return;
    const dueDate=String(task.dueDate||'').trim();
    const focusTask={
      id:importedAt+idx,
      text:String(task.title||'').trim(),
      catId:epkImportResolveCategory(task.category||'Music admin'),
      done:false,
      status:'todo',
      ts:normalizeTaskTime(String(task.ts||''))||'',
      durationMins:Number.isFinite(Number(task.durationMins))?Number(task.durationMins):null,
      order:nextTaskOrder()+added,
      createdAt:importedAt+idx,
      repeat:null,
      templateId:null,
      generatedForDate:null,
      pinned:false,
      urgency:0,
      subtasks:[],
      estimatedMins:Number.isFinite(Number(task.estimatedMinutes))?Number(task.estimatedMinutes):null,
      note:epkImportBuildNote(task,epkImportPacket),
      anxiety:0,
      taskScope:['day','project','fixed'].includes(task.scope)?task.scope:'project',
      doneDate:'',
      sourceId
    };
    tasks.push(focusTask);
    existingSources.add(sourceId);
    added++;
  });

  save();
  showToast(added?`Imported ${added} reviewed task${added===1?'':'s'} from EPK.`:'No new tasks imported; selected tasks already existed.','ok');
  showEpkImportModal=false;
  epkImportPacket=null;
  epkImportRaw='';
  epkImportSelectedTaskIds=new Set();
  epkImportError='';
  render();
}

function epkImportResolveCategory(label){
  const name=String(label||'Music admin').trim()||'Music admin';
  let cat=categories.find(c=>(c.name||'').toLowerCase()===name.toLowerCase());
  if(!cat){
    const now=Date.now();
    cat={id:'epk-'+now,name,color:COLOR_OPTS[(categories.length||0)%COLOR_OPTS.length]};
    categories.push(cat);
  }
  return cat.id;
}

function epkImportBuildNote(task,packet){
  const bits=[];
  bits.push(`Imported from EPK event: ${packet.event.title} (${packet.event.date})`);
  if(packet.event.venue||packet.event.city) bits.push(`Location: ${[packet.event.venue,packet.event.city].filter(Boolean).join(', ')}`);
  if(task.notes) bits.push(String(task.notes));
  if(packet.event.ctaUrl) bits.push(`CTA: ${packet.event.ctaUrl}`);
  return bits.join('\n');
}

if(typeof window!=='undefined'){
  Object.assign(window,{openEpkImport,closeEpkImport,epkImportReset,epkImportSetRaw,epkImportLoadFromText,epkImportToggleTask,epkImportSelectAll,epkImportSelectNone,epkImportApproveSelected,validateEpkEventPacket});
}
if(typeof globalThis!=='undefined'){
  Object.assign(globalThis,{openEpkImport,closeEpkImport,epkImportReset,epkImportSetRaw,epkImportLoadFromText,epkImportToggleTask,epkImportSelectAll,epkImportSelectNone,epkImportApproveSelected,validateEpkEventPacket});
}
