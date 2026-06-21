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

    return result;
  };

  // -----------------------------
  // SCHEDULER AI HOOK (OPTIONAL ENTRY POINT)
  // -----------------------------

  window.aiSchedule = async function(task){
    return window.aiQuery({
      scope:"scheduler",
      input: task,
      mode:"auto"
    });
  };

  // -----------------------------
  // MEMORY / CHECK-IN HOOK
  // -----------------------------

  window.aiCheckin = async function(data){
    return window.aiQuery({
      scope:"checkins",
      input: data,
      mode:"auto"
    });
  };

})();