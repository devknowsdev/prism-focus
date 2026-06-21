/*
AI INTEGRATION LAYER (ADDED)
Wires runtime into AI_CONTROL + AI_ADAPTER system
*/

(function initAIIntegration(){

  const AI_CONTROL = window.__AI_CONTROL__;
  const AI_ADAPTER = window.__AI_ADAPTER__;

  if(!AI_ADAPTER) return;

  // -----------------------------
  // SAFE AI QUERY WRAPPER
  // -----------------------------

  window.aiQuery = async function({scope="general", input={}, mode="auto"}){

    if(AI_CONTROL && !AI_CONTROL.aiEnabled(scope)){
      AI_CONTROL.registerAIAction?.(scope, {type:"blocked", input});
      return { output: null, blocked: true };
    }

    const result = await AI_ADAPTER.queryAI({
      scope,
      input,
      mode,
      AI_CONTROL
    });

    AI_CONTROL?.registerAIAction?.(scope, {type:"executed", provider: result.provider});

    // memory hook
    window.__AI_MEMORY__?.add?.({
      ts: Date.now(),
      type: "ai_action",
      scope,
      data: result
    });

    return result;
  };

  window.aiSchedule = async function(task){
    return window.aiQuery({ scope:"scheduler", input: task, mode:"auto" });
  };

  window.aiCheckin = async function(data){
    return window.aiQuery({ scope:"checkins", input: data, mode:"auto" });
  };

  // -----------------------------
  // BOOTSTRAP INSTALLER HOOK
  // -----------------------------

  window.runAIInstall = async function(){
    if(!window.__AI_BOOTSTRAP__) return { error:"no_installer" };
    return await window.__AI_BOOTSTRAP__.runBootstrap();
  };

  // -----------------------------
  // PREFERENCE EVOLUTION HOOK
  // -----------------------------

  window.aiEvolvePreferences = function(){
    window.__AI_PREFERENCES__?.evolve?.();
  };

  // -----------------------------
  // EXPLANATION LAYER
  // -----------------------------

  window.getAIExplanation = function(taskId){
    return window.__AI_EXPLAIN__?.get(taskId);
  };

  window.showAIExplanation = function(taskId){
    const data = window.__AI_EXPLAIN__?.get(taskId);
    if(!data) return null;

    console.log("AI EXPLANATION:", data);
    return data;
  };

})();