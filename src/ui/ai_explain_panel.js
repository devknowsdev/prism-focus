/*
MODULE: ui/ai_explain_panel.js
LAYER: render
PURPOSE: Render a local AI decision trace, memory context, and preference weights.
USES: window AI explainability globals, document
INVARIANTS: Missing traces render an empty state; this panel does not mutate app data.
LAST_STABILIZED: 2026-07-01
*/
/*
AI EXPLAINABILITY PANEL (UI LAYER)
Displays reasoning, memory context, and scheduling justification
*/

function renderAIExplainPanel(taskId){

  const panel = document.getElementById("ai-explain-panel");
  if(!panel) return;

  const trace = window.__AI_EXPLAIN__?.get?.(taskId);
  const memory = window.__AI_MEMORY__?.recent?.(10) || [];
  const prefs = window.__AI_PREFERENCES__?.weights || {};

  if(!trace){
    panel.innerHTML = `
      <div class="ai-panel empty">
        <h3>AI Explanation</h3>
        <p>No trace available for this task.</p>
      </div>
    `;
    return;
  }

  panel.innerHTML = `
    <div class="ai-panel">
      <h3>AI Decision Trace</h3>

      <section>
        <h4>Reasoning</h4>
        <pre>${JSON.stringify(trace.breakdown || {}, null, 2)}</pre>
      </section>

      <section>
        <h4>Recent Memory Context</h4>
        <pre>${JSON.stringify(memory, null, 2)}</pre>
      </section>

      <section>
        <h4>Preference Weights</h4>
        <pre>${JSON.stringify(prefs, null, 2)}</pre>
      </section>
    </div>
  `;
}

window.renderAIExplainPanel = renderAIExplainPanel;
