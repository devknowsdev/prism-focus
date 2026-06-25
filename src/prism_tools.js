/*
MODULE: prism_tools.js
LAYER: integration/ui
PURPOSE: Lightweight Prism-suite launcher for Focus.
OWNS: Prism Tools modal/launcher only.
USES: existing classic-script globals: render, btnStyle, T, esc.
INVARIANTS: Does not merge app data models; links to bounded Prism apps/repos.
*/

(function(root){
  let prismToolsOpen=false;

  const DEFAULT_EPK_PUBLISHER_URL='http://localhost:8094/publisher/index.html';
  const STORAGE_EPK_URL='prism-tools-epk-publisher-url';

  function prismEsc(value){
    if(typeof esc==='function') return esc(value);
    return String(value??'').replace(/[&<>"']/g,char=>({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#39;'
    }[char]));
  }

  function prismBtn(kind='default',extra=''){
    if(typeof btnStyle==='function') return btnStyle(kind,extra);
    return `border:1px solid #d0e8de;background:#fff;color:#1f2937;border-radius:8px;cursor:pointer;${extra}`;
  }

  function prismTheme(key,fallback){
    return (typeof T!=='undefined'&&T&&T[key])?T[key]:fallback;
  }

  function getEpkPublisherUrl(){
    return localStorage.getItem(STORAGE_EPK_URL)||DEFAULT_EPK_PUBLISHER_URL;
  }

  function setEpkPublisherUrl(value){
    const next=String(value||'').trim();
    if(next) localStorage.setItem(STORAGE_EPK_URL,next);
    else localStorage.removeItem(STORAGE_EPK_URL);
  }

  function openExternal(url){
    if(!url) return;
    window.open(url,'_blank','noopener');
  }

  function toolCard({icon,title,status,description,primaryLabel,primaryUrl,secondaryLabel,secondaryUrl,comingSoon}){
    const surface=prismTheme('surface','#ffffff');
    const border=prismTheme('border','#d0e8de');
    const text=prismTheme('text','#1f2937');
    const muted=prismTheme('muted','#6b7280');
    const accent=prismTheme('accent','#3b82f6');
    const accent2=prismTheme('accent2','#14b8a6');
    return `
      <article style="border:1.5px solid ${border};background:${surface};border-radius:14px;padding:14px;display:grid;gap:9px;box-shadow:0 8px 24px rgba(0,0,0,0.08);">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;">
          <div style="display:flex;align-items:center;gap:9px;min-width:0;">
            <span style="width:34px;height:34px;border-radius:11px;background:${accent}22;color:${accent};display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;"><i class="ti ${icon}"></i></span>
            <div style="min-width:0;">
              <h3 style="margin:0;color:${text};font-size:15px;line-height:1.15;">${prismEsc(title)}</h3>
              <div style="margin-top:3px;font-size:11px;color:${muted};font-weight:700;letter-spacing:.05em;text-transform:uppercase;">${prismEsc(status)}</div>
            </div>
          </div>
          ${comingSoon?`<span style="font-size:10px;color:${accent2};font-weight:800;letter-spacing:.06em;text-transform:uppercase;">soon</span>`:''}
        </div>
        <p style="margin:0;color:${muted};font-size:13px;line-height:1.45;">${prismEsc(description)}</p>
        <div style="display:flex;flex-wrap:wrap;gap:7px;margin-top:2px;">
          ${primaryUrl?`<button type="button" onclick="prismToolsOpenUrl('${prismEsc(primaryUrl)}')" style="${prismBtn('accent2','font-size:12px;padding:7px 10px;border-radius:9px;')}">${prismEsc(primaryLabel||'Open')}</button>`:''}
          ${secondaryUrl?`<button type="button" onclick="prismToolsOpenUrl('${prismEsc(secondaryUrl)}')" style="${prismBtn('default','font-size:12px;padding:7px 10px;border-radius:9px;')}">${prismEsc(secondaryLabel||'Repo')}</button>`:''}
        </div>
      </article>`;
  }

  function renderPrismToolsModalHtml(){
    const bg=prismTheme('bg','#f8fafc');
    const surface=prismTheme('surface','#fff');
    const border=prismTheme('border','#d0e8de');
    const text=prismTheme('text','#1f2937');
    const muted=prismTheme('muted','#6b7280');
    const accent=prismTheme('accent','#3b82f6');
    const epkUrl=getEpkPublisherUrl();
    const cards=[
      {
        icon:'ti-id-badge-2',
        title:'EPK Publisher',
        status:'Music / public profile',
        description:'Manage public EPK content, media, promo kit, audience pages, and safe publishing from the dedicated EPK repo.',
        primaryLabel:'Open publisher',
        primaryUrl:epkUrl,
        secondaryLabel:'Open EPK repo',
        secondaryUrl:'https://github.com/devknowsdev/EPK'
      },
      {
        icon:'ti-brain',
        title:'Spectra',
        status:'AI cockpit',
        description:'Future local-first AI orchestration workbench for routing, approvals, execution, project memory, and calm capability control.',
        primaryLabel:'Open repo',
        primaryUrl:'https://github.com/devknowsdev/prism-spectra',
        comingSoon:true
      },
      {
        icon:'ti-books',
        title:'Beam',
        status:'AI reference layer',
        description:'Canonical AI-facing memory, handovers, context packs, research logs, contracts, and anti-drift reference material.',
        primaryLabel:'Open repo',
        primaryUrl:'https://github.com/devknowsdev/prism-beam',
        comingSoon:true
      },
      {
        icon:'ti-target-arrow',
        title:'Focus',
        status:'Current workspace',
        description:'Planning, tasks, timers, routines, AI task support, journaling, and local-first personal operating system surface.',
        primaryLabel:'Open repo',
        primaryUrl:'https://github.com/devknowsdev/prism-focus'
      }
    ];

    return `
      <div data-no-clobber="true" style="position:fixed;inset:0;z-index:9100;background:rgba(0,0,0,0.42);display:flex;align-items:flex-start;justify-content:center;padding:5vh 14px;overflow:auto;">
        <section role="dialog" aria-modal="true" aria-label="Prism Tools" style="width:min(980px,100%);background:${bg};color:${text};border:1.5px solid ${border};border-radius:18px;box-shadow:0 24px 80px rgba(0,0,0,.32);overflow:hidden;">
          <header style="display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:18px 20px;border-bottom:1px solid ${border};background:${surface};">
            <div>
              <p style="margin:0 0 5px;color:${accent};font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;">Prism Tools</p>
              <h2 style="margin:0;color:${text};font-size:24px;line-height:1.05;">One workspace, bounded apps.</h2>
              <p style="margin:8px 0 0;color:${muted};font-size:13px;max-width:680px;">This launcher centralises access without merging repos too early. Focus stays focused; EPK, Spectra, and Beam keep their own responsibilities.</p>
            </div>
            <button type="button" onclick="closePrismTools()" title="Close Prism Tools" style="${prismBtn('default','padding:7px 10px;border-radius:9px;font-size:13px;')}"><i class="ti ti-x"></i></button>
          </header>

          <div style="padding:16px 20px;border-bottom:1px solid ${border};background:${surface};">
            <label style="display:block;color:${muted};font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;">EPK publisher local URL
              <input id="prism-tools-epk-url" value="${prismEsc(epkUrl)}" oninput="prismToolsSetEpkUrl(this.value)" placeholder="http://localhost:8094/publisher/index.html" style="width:100%;margin-top:7px;padding:8px 10px;border-radius:9px;border:1.5px solid ${border};background:${bg};color:${text};font:inherit;font-size:13px;">
            </label>
            <p style="margin:7px 0 0;color:${muted};font-size:12px;">Change this if your EPK local server is running on another port.</p>
          </div>

          <div style="padding:18px 20px;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;">
            ${cards.map(toolCard).join('')}
          </div>

          <footer style="padding:13px 20px;border-top:1px solid ${border};background:${surface};color:${muted};font-size:12px;display:flex;flex-wrap:wrap;gap:10px;justify-content:space-between;">
            <span>Recommended architecture: centralised UX, bounded repos.</span>
            <span>Later: replace this launcher with Prism Hub / Spectra cockpit routing.</span>
          </footer>
        </section>
      </div>`;
  }

  function injectPrismTools(){
    const rootEl=document.getElementById('root');
    if(!rootEl) return;

    const headerActions=rootEl.querySelector('div[style*="align-items:center"][style*="gap:10px"]');
    if(headerActions&&!document.getElementById('prism-tools-header-btn')){
      headerActions.insertAdjacentHTML('afterbegin',`<button id="prism-tools-header-btn" onclick="openPrismTools()" title="Prism Tools" style="${prismBtn('accent2','padding:5px 9px;font-size:14px;border-radius:8px;')}"><i class="ti ti-apps"></i></button>`);
    }

    if(prismToolsOpen&&!document.getElementById('prism-tools-modal-anchor')){
      const wrapper=document.createElement('div');
      wrapper.id='prism-tools-modal-anchor';
      wrapper.innerHTML=renderPrismToolsModalHtml();
      rootEl.appendChild(wrapper);
      const input=document.getElementById('prism-tools-epk-url');
      if(input) input.focus();
    }
  }

  function patchRender(){
    if(root.__prismToolsRenderPatched) return;
    if(typeof root._doRender!=='function') return;
    const originalDoRender=root._doRender;
    root._doRender=function(){
      const result=originalDoRender.apply(this,arguments);
      injectPrismTools();
      return result;
    };
    root.__prismToolsRenderPatched=true;
  }

  root.openPrismTools=function(){
    prismToolsOpen=true;
    if(typeof render==='function') render();
    else injectPrismTools();
  };

  root.closePrismTools=function(){
    prismToolsOpen=false;
    const anchor=document.getElementById('prism-tools-modal-anchor');
    if(anchor) anchor.remove();
    if(typeof render==='function') render();
  };

  root.prismToolsOpenUrl=function(url){ openExternal(url); };
  root.prismToolsSetEpkUrl=function(value){ setEpkPublisherUrl(value); };

  patchRender();
  document.addEventListener('DOMContentLoaded',()=>setTimeout(injectPrismTools,0));
})(window);
