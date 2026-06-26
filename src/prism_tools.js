/*
MODULE: prism_tools.js
LAYER: integration/ui
PURPOSE: Lightweight Prism-suite launcher for Focus with online/local links.
OWNS: Prism Tools modal/launcher only.
INVARIANTS: Centralised navigation only; does not merge app data models.
*/

(function(root){
  let prismToolsOpen=false;
  let prismLinksConfigLoaded=false;

  const STORAGE_PREFIX='prism-tools-url:';
  const STORAGE_MODE='prism-tools-preferred-mode';
  const CONFIG_PATHS=['./prism-links.json','/prism-links.json'];

  const DEFAULTS={
    epkPublisherLocal:'http://localhost:8095/publisher/index.html',
    epkPublisherOnline:'',
    epkPublicLocal:'http://localhost:8095/',
    epkPublicOnline:'',
    focusLocal:'http://localhost:8080/',
    focusOnline:'',
    spectraLocal:'',
    spectraOnline:'',
    beamOnline:'https://github.com/devknowsdev/prism-beam'
  };

  const REPOS={
    epk:'https://github.com/devknowsdev/EPK',
    focus:'https://github.com/devknowsdev/prism-focus',
    spectra:'https://github.com/devknowsdev/prism-spectra',
    beam:'https://github.com/devknowsdev/prism-beam'
  };

  function prismEsc(value){
    if(typeof esc==='function') return esc(value);
    return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }
  function prismBtn(kind='default',extra=''){
    if(typeof btnStyle==='function') return btnStyle(kind,extra);
    return `border:1px solid #d0e8de;background:${kind==='accent2'?'#4f8f73':'#fff'};color:${kind==='accent2'?'#fff':'#1f2937'};border-radius:8px;cursor:pointer;${extra}`;
  }
  function prismTheme(key,fallback){ return (typeof T!=='undefined'&&T&&T[key])?T[key]:fallback; }
  function urlKey(key){ return `${STORAGE_PREFIX}${key}`; }
  function getUrl(key){ return localStorage.getItem(urlKey(key)) ?? DEFAULTS[key] ?? ''; }
  function setUrl(key,value){
    const next=String(value||'').trim();
    if(next) localStorage.setItem(urlKey(key),next);
    else localStorage.removeItem(urlKey(key));
  }
  function getPreferredMode(){ return localStorage.getItem(STORAGE_MODE)||'online'; }
  function setPreferredMode(value){ localStorage.setItem(STORAGE_MODE,value==='local'?'local':'online'); }
  function openExternal(url){ if(url) window.open(url,'_blank','noopener'); }

  async function loadPrismLinksConfig(){
    if(prismLinksConfigLoaded) return;
    prismLinksConfigLoaded=true;
    for(const path of CONFIG_PATHS){
      try{
        const response=await fetch(path,{cache:'no-store'});
        if(!response.ok) continue;
        const config=await response.json();
        const links=config.links||{};
        Object.keys(links).forEach(key=>{
          const value=String(links[key]||'').trim();
          if(value&&!localStorage.getItem(urlKey(key))) localStorage.setItem(urlKey(key),value);
        });
        if(config.preferredMode&&!localStorage.getItem(STORAGE_MODE)) setPreferredMode(config.preferredMode);
        root.__prismLinksConfig=config;
        if(prismToolsOpen) root.openPrismTools();
        return;
      }catch(_err){
        // Optional config; built-in defaults remain safe.
      }
    }
  }

  function button(label,url,kind='default'){
    if(!url) return `<span style="color:${prismTheme('dim','#7A8070')};font-size:12px;padding:7px 0;">${prismEsc(label)} not set</span>`;
    return `<button type="button" data-prism-tools-open="${prismEsc(url)}" style="${prismBtn(kind,'font-size:12px;padding:7px 10px;border-radius:9px;')}">${prismEsc(label)}</button>`;
  }

  function toolCard({icon,title,status,description,onlineUrl,localUrl,repoUrl,comingSoon}){
    const surface=prismTheme('surface','#ffffff');
    const border=prismTheme('border','#d0e8de');
    const text=prismTheme('text','#1f2937');
    const muted=prismTheme('muted','#6b7280');
    const dim=prismTheme('dim','#7A8070');
    const accent=prismTheme('accent','#3b82f6');
    const accent2=prismTheme('accent2','#14b8a6');
    const preferred=getPreferredMode();
    const preferredUrl=preferred==='local'?(localUrl||onlineUrl):(onlineUrl||localUrl);
    return `
      <article style="border:1.5px solid ${border};background:${surface};border-radius:14px;padding:14px;display:grid;gap:9px;box-shadow:0 8px 24px rgba(0,0,0,0.08);">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;">
          <div style="display:flex;align-items:center;gap:9px;min-width:0;">
            <span style="width:34px;height:34px;border-radius:11px;background:${accent}22;color:${accent};display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;"><i class="ti ${prismEsc(icon)}"></i></span>
            <div style="min-width:0;"><h3 style="margin:0;color:${text};font-size:15px;line-height:1.15;">${prismEsc(title)}</h3><div style="margin-top:3px;font-size:11px;color:${muted};font-weight:700;letter-spacing:.05em;text-transform:uppercase;">${prismEsc(status)}</div></div>
          </div>
          ${comingSoon?`<span style="font-size:10px;color:${accent2};font-weight:800;letter-spacing:.06em;text-transform:uppercase;">soon</span>`:''}
        </div>
        <p style="margin:0;color:${muted};font-size:13px;line-height:1.45;">${prismEsc(description)}</p>
        <div style="display:flex;flex-wrap:wrap;gap:7px;margin-top:2px;">
          ${button(`Open ${preferred}`,preferredUrl,'accent2')}
          ${button('Online',onlineUrl,'default')}
          ${button('Local',localUrl,'default')}
          ${repoUrl?button('Repo',repoUrl,'default'):''}
        </div>
        <p style="margin:0;color:${dim};font-size:11px;">Preferred mode: ${prismEsc(preferred)}. Online URLs can come from prism-links.json or browser overrides.</p>
      </article>`;
  }

  function settingsField(key,label,placeholder){
    const border=prismTheme('border','#d0e8de');
    const bg=prismTheme('bg','#f8fafc');
    const text=prismTheme('text','#1f2937');
    return `<label style="display:block;color:${prismTheme('muted','#6b7280')};font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;">${prismEsc(label)}<input data-prism-tools-url-key="${prismEsc(key)}" value="${prismEsc(getUrl(key))}" placeholder="${prismEsc(placeholder||'')}" style="width:100%;margin-top:7px;padding:8px 10px;border-radius:9px;border:1.5px solid ${border};background:${bg};color:${text};font:inherit;font-size:13px;"></label>`;
  }

  function renderSettings(){
    const border=prismTheme('border','#d0e8de');
    const surface=prismTheme('surface','#fff');
    const muted=prismTheme('muted','#6b7280');
    const preferred=getPreferredMode();
    return `<div style="padding:16px 20px;border-bottom:1px solid ${border};background:${surface};display:grid;gap:14px;"><div style="display:flex;flex-wrap:wrap;align-items:end;gap:12px;"><label style="display:block;color:${muted};font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;">Preferred opening mode<select id="prism-tools-preferred-mode" style="display:block;margin-top:7px;padding:8px 10px;border-radius:9px;border:1.5px solid ${border};background:${prismTheme('bg','#f8fafc')};color:${prismTheme('text','#1f2937')};font:inherit;font-size:13px;"><option value="online"${preferred==='online'?' selected':''}>Online first</option><option value="local"${preferred==='local'?' selected':''}>Local first</option></select></label><p style="margin:0;color:${muted};font-size:12px;max-width:620px;">Edit <code>prism-links.json</code> once for deployed defaults. Browser edits override those values on this device.</p></div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px;">${settingsField('epkPublisherOnline','EPK Publisher online URL','https://<protected-publisher-url>/publisher/index.html')}${settingsField('epkPublisherLocal','EPK Publisher local URL','http://localhost:8095/publisher/index.html')}${settingsField('epkPublicOnline','EPK public online URL','https://<your-epk-domain>/')}${settingsField('epkPublicLocal','EPK public local URL','http://localhost:8095/')}${settingsField('focusOnline','Focus online URL','https://<protected-focus-url>/')}${settingsField('focusLocal','Focus local URL','http://localhost:8080/')}${settingsField('spectraOnline','Spectra online/local UI URL','')}${settingsField('beamOnline','Beam docs/reference URL','')}</div></div>`;
  }

  function renderPrismToolsModalHtml(){
    const bg=prismTheme('bg','#f8fafc');
    const surface=prismTheme('surface','#fff');
    const border=prismTheme('border','#d0e8de');
    const text=prismTheme('text','#1f2937');
    const muted=prismTheme('muted','#6b7280');
    const accent=prismTheme('accent','#3b82f6');
    const currentFocusUrl=window.location.href.split('#')[0];
    const cards=[
      {icon:'ti-id-badge-2',title:'EPK Publisher',status:'Music / public profile',description:'Manage public EPK content, media, promo kit, audience pages, and safe publishing from the dedicated EPK repo.',onlineUrl:getUrl('epkPublisherOnline'),localUrl:getUrl('epkPublisherLocal'),repoUrl:REPOS.epk},
      {icon:'ti-world-www',title:'Public EPK',status:'Audience-facing site',description:'Open the public music/press site separately from the private publisher tools.',onlineUrl:getUrl('epkPublicOnline'),localUrl:getUrl('epkPublicLocal'),repoUrl:REPOS.epk},
      {icon:'ti-target-arrow',title:'Focus',status:'Current workspace',description:'Planning, tasks, timers, routines, AI task support, journaling, and local-first personal operating system surface.',onlineUrl:getUrl('focusOnline')||currentFocusUrl,localUrl:getUrl('focusLocal'),repoUrl:REPOS.focus},
      {icon:'ti-brain',title:'Spectra',status:'AI cockpit',description:'Future local-first AI orchestration workbench for routing, approvals, execution, project memory, and calm capability control.',onlineUrl:getUrl('spectraOnline'),localUrl:getUrl('spectraLocal'),repoUrl:REPOS.spectra,comingSoon:true},
      {icon:'ti-books',title:'Beam',status:'AI reference layer',description:'Canonical AI-facing memory, handovers, context packs, research logs, contracts, and anti-drift reference material.',onlineUrl:getUrl('beamOnline'),localUrl:'',repoUrl:REPOS.beam,comingSoon:true}
    ];
    return `<div data-no-clobber="true" style="position:fixed;inset:0;z-index:9100;background:rgba(0,0,0,0.42);display:flex;align-items:flex-start;justify-content:center;padding:5vh 14px;overflow:auto;"><section role="dialog" aria-modal="true" aria-label="Prism Tools" style="width:min(1080px,100%);background:${bg};color:${text};border:1.5px solid ${border};border-radius:18px;box-shadow:0 24px 80px rgba(0,0,0,.32);overflow:hidden;"><header style="display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:18px 20px;border-bottom:1px solid ${border};background:${surface};"><div><p style="margin:0 0 5px;color:${accent};font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;">Prism Tools</p><h2 style="margin:0;color:${text};font-size:24px;line-height:1.05;">One workspace, online/local aware.</h2><p style="margin:8px 0 0;color:${muted};font-size:13px;max-width:760px;">Use Cloudflare URLs for normal work and local URLs only for testing branches or offline development.</p></div><button type="button" data-prism-tools-close="true" title="Close Prism Tools" style="${prismBtn('default','padding:7px 10px;border-radius:9px;font-size:13px;')}"><i class="ti ti-x"></i></button></header>${renderSettings()}<div style="padding:18px 20px;display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;">${cards.map(toolCard).join('')}</div><footer style="padding:13px 20px;border-top:1px solid ${border};background:${surface};color:${muted};font-size:12px;display:flex;flex-wrap:wrap;gap:10px;justify-content:space-between;"><span>Recommended architecture: centralised UX, bounded repos.</span><span>Later: replace this launcher with Prism Hub / Spectra cockpit routing.</span></footer></section></div>`;
  }

  function bindModalEvents(){
    document.querySelectorAll('[data-prism-tools-open]').forEach(btn=>btn.addEventListener('click',()=>openExternal(btn.dataset.prismToolsOpen)));
    document.querySelectorAll('[data-prism-tools-close]').forEach(btn=>btn.addEventListener('click',root.closePrismTools));
    document.querySelectorAll('[data-prism-tools-url-key]').forEach(input=>{
      input.addEventListener('change',()=>setUrl(input.dataset.prismToolsUrlKey,input.value));
      input.addEventListener('blur',()=>setUrl(input.dataset.prismToolsUrlKey,input.value));
    });
    const mode=document.getElementById('prism-tools-preferred-mode');
    if(mode) mode.addEventListener('change',()=>{setPreferredMode(mode.value);root.openPrismTools();});
  }

  function injectPrismTools(){
    const rootEl=document.getElementById('root');
    if(!rootEl) return;
    const headerActions=rootEl.querySelector('div[style*="align-items:center"][style*="gap:10px"]');
    if(headerActions&&!document.getElementById('prism-tools-header-btn')) headerActions.insertAdjacentHTML('afterbegin',`<button id="prism-tools-header-btn" onclick="openPrismTools()" title="Prism Tools" style="${prismBtn('accent2','padding:5px 9px;font-size:14px;border-radius:8px;')}"><i class="ti ti-apps"></i></button>`);
    if(prismToolsOpen&&!document.getElementById('prism-tools-modal-anchor')){
      const wrapper=document.createElement('div');
      wrapper.id='prism-tools-modal-anchor';
      wrapper.innerHTML=renderPrismToolsModalHtml();
      rootEl.appendChild(wrapper);
      bindModalEvents();
    }
  }

  function patchRender(){
    if(root.__prismToolsRenderPatched||typeof root._doRender!=='function') return;
    const originalDoRender=root._doRender;
    root._doRender=function(){const result=originalDoRender.apply(this,arguments);injectPrismTools();return result;};
    root.__prismToolsRenderPatched=true;
  }

  root.openPrismTools=function(){
    prismToolsOpen=true;
    loadPrismLinksConfig();
    const anchor=document.getElementById('prism-tools-modal-anchor');
    if(anchor) anchor.remove();
    if(typeof render==='function') render(); else injectPrismTools();
  };
  root.closePrismTools=function(){
    prismToolsOpen=false;
    const anchor=document.getElementById('prism-tools-modal-anchor');
    if(anchor) anchor.remove();
    if(typeof render==='function') render();
  };

  loadPrismLinksConfig();
  patchRender();
  document.addEventListener('DOMContentLoaded',()=>setTimeout(injectPrismTools,0));
})(window);
