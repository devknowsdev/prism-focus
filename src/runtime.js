/*
AI INTEGRATION LAYER (ADDED)
*/

(function initAIIntegration(){

  const AI_CONTROL = window.__AI_CONTROL__;
  const AI_ADAPTER = window.__AI_ADAPTER__;

  if(!AI_ADAPTER) return;

  window.__AI_MODE__ = window.__AI_MODE__ || {
    value: "full"
  };

  window.__AI_UI_MODE__ = window.__AI_UI_MODE__ || {
    value: "power" // power | focus
  };

  window.__AI_GOVERNOR__ = window.__AI_GOVERNOR__ || {
    maxMemoryEntries: 300,
    maxEmbeddings: 200,
    maxExplainTraces: 200,
    embeddingThrottleMs: 5000,
    lastEmbeddingAt: 0
  };

  function isAIEnabled(scope){
    const mode = window.__AI_MODE__?.value;
    if(mode === "off") return false;
    if(mode === "assist") return scope === "scheduler" || scope === "checkins";
    return true;
  }

  window.aiQuery = async function({scope="general", input={}, mode="auto"}){

    if(!isAIEnabled(scope)){
      AI_CONTROL?.registerAIAction?.(scope,{type:"blocked_by_mode",input});
      return {output:null,blocked:true};
    }

    if(AI_CONTROL && !AI_CONTROL.aiEnabled(scope)){
      AI_CONTROL.registerAIAction?.(scope,{type:"blocked",input});
      return {output:null,blocked:true};
    }

    const result = await AI_ADAPTER.queryAI({scope,input,mode,AI_CONTROL});

    AI_CONTROL?.registerAIAction?.(scope,{type:"executed",provider:result.provider});

    window.__AI_MEMORY__?.add?.({ts:Date.now(),type:"ai_action",scope,data:result});

    window.__AI_EXPLAIN__?.add?.({taskId:input?.id || input?.taskId || null,scope,provider:result.provider,breakdown:result});

    const text = typeof input === "string" ? input : JSON.stringify(input);
    window.__AI_EMBEDDINGS__?.add?.(text,{scope});

    return result;
  };

  // =============================
  // UX COHERENCE LAYER (NEW)
  // =============================

  window.attachAIControlCenter = function(){

    if(document.getElementById("ai-control-center")) return;

    const el = document.createElement("div");
    el.id = "ai-control-center";
    el.style.position = "fixed";
    el.style.top = "10px";
    el.style.left = "10px";
    el.style.zIndex = "99999";
    el.style.background = "rgba(0,0,0,0.75)";
    el.style.color = "#fff";
    el.style.padding = "8px";
    el.style.borderRadius = "10px";
    el.style.fontSize = "11px";

    function render(){
      el.innerHTML = `
        <div><b>AI CONTROL</b></div>

        <div>
          Mode:
          <select id="ai-mode">
            <option value="off">Off</option>
            <option value="assist">Assist</option>
            <option value="full">Full</option>
            <option value="experimental">Experimental</option>
          </select>
        </div>

        <div>
          UI:
          <select id="ai-ui">
            <option value="power">Power</option>
            <option value="focus">Focus</option>
          </select>
        </div>

        <div style="margin-top:6px;opacity:0.8;">
          mem:${window.__AI_MEMORY__?.entries?.length||0} |
          emb:${window.__AI_EMBEDDINGS__?.items?.length||0}
        </div>
      `;

      const modeSel = el.querySelector("#ai-mode");
      const uiSel = el.querySelector("#ai-ui");

      modeSel.value = window.__AI_MODE__.value;
      uiSel.value = window.__AI_UI_MODE__.value;

      modeSel.onchange = (e)=>{
        window.__AI_MODE__.value = e.target.value;
      };

      uiSel.onchange = (e)=>{
        window.__AI_UI_MODE__.value = e.target.value;
        applyUIMode();
      };
    }

    function applyUIMode(){

      const mode = window.__AI_UI_MODE__.value;

      const perf = document.getElementById("ai-perf-dashboard");
      const explain = document.getElementById("ai-explain-panel");

      if(mode === "focus"){
        perf && (perf.style.display = "none");
        explain && (explain.style.opacity = "0.3");
      } else {
        perf && (perf.style.display = "block");
        explain && (explain.style.opacity = "1");
      }
    }

    render();
    setInterval(()=>{
      render();
      if(window.__AI_UI_MODE__.value === "focus") applyUIMode();
    },3000);

    document.body.appendChild(el);
  };

  // override old dashboards safely
  window.attachAIPerfDashboard = function(){
    if(window.__AI_UI_MODE__?.value === "focus") return;

    if(document.getElementById("ai-perf-dashboard")) return;

    const el = document.createElement("div");
    el.id = "ai-perf-dashboard";
    el.style.position = "fixed";
    el.style.bottom = "10px";
    el.style.right = "10px";
    el.style.width = "220px";
    el.style.fontSize = "11px";
    el.style.background = "rgba(0,0,0,0.75)";
    el.style.color = "#fff";
    el.style.padding = "8px";
    el.style.borderRadius = "8px";
    el.style.zIndex = "99999";

    function render(){
      const s = window.__AI_PERF.get();
      el.innerHTML = `
        <div><b>AI PERF</b></div>
        <div>mode: ${s.mode}</div>
        <div>memory: ${s.memory}</div>
        <div>embeddings: ${s.embeddings}</div>
        <div>explain: ${s.explain}</div>
        <div>embed ts: ${s.lastEmbeddingAt}</div>
      `;
    }

    render();
    setInterval(render, 2500);

    document.body.appendChild(el);
  };

  setTimeout(()=>window.attachAIControlCenter?.(),500);

  window.aiSchedule = async function(task){
    const context = {
      task,
      memory: window.__AI_MEMORY__?.recent?.(20) || [],
      prefs: window.__AI_PREFERENCES__?.weights || {}
    };
    return window.aiQuery({scope:"scheduler",input:context,mode:"auto"});
  };

  window.aiOverride = function(taskId,change){
    window.__AI_MEMORY__?.add?.({ts:Date.now(),type:"override",scope:"scheduler",data:{taskId,change}});
    window.__AI_PREFERENCES__?.registerOverride?.(change);
  };

  window.aiCheckin = async function(data){
    return window.aiQuery({scope:"checkins",input:data,mode:"auto"});
  };

  window.runAIInstall = async function(){
    return window.__AI_BOOTSTRAP__?.runBootstrap?.() || {error:"no_installer"};
  };

  window.aiEvolvePreferences = function(){
    window.__AI_PREFERENCES__?.evolve?.();
  };

  window.getAIExplanation = function(taskId){
    return window.__AI_EXPLAIN__?.get?.(taskId);
  };

  window.bindCalendarTask = function(el,task){
    if(!el) return;
    el.addEventListener("click",()=>window.renderAIExplainPanel?.(task.id));
  };

})();

// =============================
// SUBSYSTEMS (UNCHANGED BELOW)
// =============================

const AI_MEMORY = window.__AI_MEMORY__;
const AI_EMBEDDINGS = window.__AI_EMBEDDINGS__;
const AI_PREFERENCES = window.__AI_PREFERENCES__;
const AI_EXPLAIN = window.__AI_EXPLAIN__;

// Track last date seen by the runtime (used by rollover checks in tests)
var _lastDateStr = new Date().toDateString();

// Compatibility mapper: expose functions assigned to `window` as global bindings
// in environments (like the Node VM test harness) where `window.foo` is not
// automatically available as the identifier `foo`.
try{
  if(typeof globalThis !== 'undefined' && typeof window !== 'undefined'){
    Object.getOwnPropertyNames(window).forEach(k=>{
      try{
        if(typeof window[k]==='function' && typeof globalThis[k]==='undefined'){
          globalThis[k]=window[k];
        }
      }catch(e){}
    });
    // Also mirror commonly used shared arrays
    if(typeof window.tasks!=='undefined' && typeof globalThis.tasks==='undefined') globalThis.tasks = window.tasks;
    if(typeof window.habits!=='undefined' && typeof globalThis.habits==='undefined') globalThis.habits = window.habits;
  }
}catch(e){}
