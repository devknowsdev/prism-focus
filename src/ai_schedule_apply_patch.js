/*
MODULE: ai_schedule_apply_patch.js
LAYER: ui/action patch
PURPOSE: Prevent Focus Assistant schedule dumps from creating an extra task for the whole raw prompt.
USES: ai_chat_spectra_bridge.js local chat state, actions_tasks.js-compatible task state
INVARIANTS: Applies only extracted schedule/task items after visible user confirmation; never applies the raw prompt as a task.
LAST_STABILIZED: 2026-06-27
*/
(function(){
  function _normalizeTime(raw){
    const str=String(raw||'').trim();
    if(!str) return '';
    if(typeof normalizeTaskTime==='function') return normalizeTaskTime(str)||'';
    return /^\d{1,2}:\d{2}$/.test(str)?str.padStart(5,'0'):'';
  }

  function _normalizeMins(raw){
    const n=Number(raw);
    if(!Number.isFinite(n)||n<=0) return null;
    return Math.max(5,Math.min(480,Math.round(n)));
  }

  function _normalizeTaskLike(item){
    if(!item||typeof item!=='object') return null;
    const text=String(item.text||item.title||item.task||'').trim();
    if(!text) return null;
    return {
      text,
      ts:_normalizeTime(item.ts||item.start||item.time),
      estimatedMins:_normalizeMins(item.estimatedMins||item.durationMins||item.minutes),
      note:String(item.note||item.reason||'').trim(),
      taskScope:String(item.taskScope||item.scope||'day').toLowerCase()==='project'?'project':'day',
    };
  }

  function _tokens(value){
    return String(value||'')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g,' ')
      .split(/\s+/)
      .filter(w=>w.length>3&&!['need','have','today','tomorrow','schedule','gentle','realistic','please','make','with','that','this'].includes(w));
  }

  function _canonical(value){
    return _tokens(value).join(' ');
  }

  function _looksLikeRawPrompt(item,prompt){
    const text=String(item&&item.text||'').trim();
    const raw=String(prompt||'').trim();
    if(!text||!raw) return false;
    const itemCanon=_canonical(text);
    const promptCanon=_canonical(raw);
    if(!itemCanon||!promptCanon) return false;
    if(itemCanon===promptCanon) return true;
    if(itemCanon.length>60&&promptCanon.includes(itemCanon)) return true;
    if(promptCanon.length>60&&itemCanon.includes(promptCanon)) return true;

    const itemTokens=new Set(_tokens(text));
    const promptTokens=new Set(_tokens(raw));
    if(itemTokens.size<6||promptTokens.size<8) return false;
    let overlap=0;
    itemTokens.forEach(t=>{if(promptTokens.has(t)) overlap++;});
    const ratio=overlap/Math.min(itemTokens.size,promptTokens.size);
    const delimiterHeavy=/[,;\n]|\band\b/i.test(text);
    const longPromptLike=text.length>80||itemTokens.size>=10;
    return longPromptLike&&delimiterHeavy&&ratio>=0.6;
  }

  function _findMessageRecord(messageId){
    for(const convId of Object.keys(chatMessages||{})){
      const list=chatMessages[convId]||[];
      const index=list.findIndex(m=>m.id===messageId);
      if(index>=0) return {convId,list,index,message:list[index]};
    }
    return null;
  }

  function _sourcePromptFor(record){
    if(!record) return '';
    if(record.message&&record.message.sourcePrompt) return String(record.message.sourcePrompt||'');
    for(let i=record.index-1;i>=0;i--){
      const prev=record.list[i];
      if(prev&&prev.role==='user') return String(prev.prompt||prev.response||'');
    }
    return '';
  }

  function _dedupeItems(items){
    const seen=new Set();
    return items.filter(item=>{
      const key=[String(item.text||'').trim().toLowerCase(),item.ts||'',item.estimatedMins||''].join('|');
      if(seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function _itemsForApply(proposal,sourcePrompt){
    const schedule=(proposal&&proposal.proposedSchedule||[]).map(_normalizeTaskLike).filter(Boolean);
    const tasks=(proposal&&proposal.proposedTasks||[]).map(_normalizeTaskLike).filter(Boolean);
    const preferred=schedule.length?schedule:tasks;
    return _dedupeItems(preferred.filter(item=>!_looksLikeRawPrompt(item,sourcePrompt)));
  }

  function _createTaskFromProposal(item,offset){
    const now=Date.now()+(offset||0);
    return {
      id:now,
      text:item.text,
      catId:item.catId||'',
      done:false,
      status:'todo',
      ts:_normalizeTime(item.ts),
      order:typeof nextTaskOrder==='function'?nextTaskOrder()+(offset||0):(tasks||[]).length+(offset||0),
      createdAt:now,
      repeat:null,
      templateId:null,
      generatedForDate:null,
      pinned:false,
      urgency:0,
      subtasks:[],
      estimatedMins:_normalizeMins(item.estimatedMins),
      durationMins:_normalizeMins(item.estimatedMins),
      note:String(item.note||'').trim(),
      anxiety:0,
      taskScope:item.taskScope==='project'?'project':'day',
      doneDate:'',
    };
  }

  window.applyChatProposal=function applyChatProposalWithoutPromptTask(messageId){
    const record=_findMessageRecord(messageId);
    const proposal=record&&record.message?record.message.proposal:null;
    if(!proposal) return showToast('No proposal found','warn');
    const sourcePrompt=_sourcePromptFor(record);
    const items=_itemsForApply(proposal,sourcePrompt);
    if(!items.length) return showToast('No extracted schedule items to apply','warn');
    const label=(proposal.proposedSchedule||[]).length?'scheduled item':'proposed task';
    const ok=confirm(`Add ${items.length} extracted ${label}${items.length===1?'':'s'} to Focus?`);
    if(!ok) return;
    tasks.push(...items.map((item,index)=>_createTaskFromProposal(item,index)));
    if(record&&record.message) record.message.applied=true;
    if(typeof save==='function') save();
    if(typeof render==='function') render();
    if(typeof syncChatPane==='function') setTimeout(()=>syncChatPane(true),0);
    showToast(`Added ${items.length} extracted ${label}${items.length===1?'':'s'}`,'ok');
  };
})();
