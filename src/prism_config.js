/*
MODULE: prism_config.js
LAYER: integration/config
PURPOSE: Load deploy-time Prism navigation defaults from prism-links.json.
INVARIANT: Browser overrides in localStorage win over deployed defaults.
*/
(function(){
  const STORAGE_PREFIX='prism-tools-url:';
  const STORAGE_MODE='prism-tools-preferred-mode';
  const CONFIG_PATHS=['./prism-links.json','/prism-links.json'];

  function shouldSeed(key){
    return !localStorage.getItem(`${STORAGE_PREFIX}${key}`);
  }

  function seedLinks(config){
    if(!config||typeof config!=='object') return;
    const links=config.links||{};
    Object.keys(links).forEach(key=>{
      const value=String(links[key]||'').trim();
      if(value&&shouldSeed(key)) localStorage.setItem(`${STORAGE_PREFIX}${key}`,value);
    });
    const preferred=String(config.preferredMode||'').trim();
    if(preferred&&!localStorage.getItem(STORAGE_MODE)){
      localStorage.setItem(STORAGE_MODE,preferred==='local'?'local':'online');
    }
    window.__prismLinksConfig=config;
  }

  async function loadConfig(){
    for(const path of CONFIG_PATHS){
      try{
        const response=await fetch(path,{cache:'no-store'});
        if(!response.ok) continue;
        const config=await response.json();
        seedLinks(config);
        document.dispatchEvent(new CustomEvent('prism-links-config-loaded',{detail:config}));
        return;
      }catch(_err){
        // Missing config is fine: Prism Tools falls back to its built-in defaults.
      }
    }
  }

  loadConfig();
})();
