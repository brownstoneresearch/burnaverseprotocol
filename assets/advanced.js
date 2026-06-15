/* Burnaverse Intelligence Layer v3.0
   - Advanced UI motion
   - Liquidity calculator
   - Smart PWA installer with platform-aware guidance
   - Offline/cache readiness checks
*/
(function(){
  const $ = (s, r=document)=>r.querySelector(s);
  const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));
  const cfg = ()=>window.CONFIG || {};
  const fmt = new Intl.NumberFormat(undefined,{maximumFractionDigits:8});
  const fmt0 = new Intl.NumberFormat(undefined,{maximumFractionDigits:0});
  const money = n => {
    const x = Number(n);
    if(!Number.isFinite(x)) return "—";
    if(x === 0) return "$0";
    if(Math.abs(x) < 0.000001) return "$" + x.toExponential(3);
    return "$" + x.toLocaleString(undefined,{maximumFractionDigits:x>=1?2:10});
  };
  const store = {
    get(k,f=null){ try{return JSON.parse(localStorage.getItem(k)) ?? f;}catch(_){return f;} },
    set(k,v){ try{localStorage.setItem(k,JSON.stringify(v));}catch(_){} }
  };
  function toast(msg){ (window.toast||console.log)(msg); }

  function initScrollProgress(){
    const bar = $('.progressBar'); if(!bar) return;
    const run=()=>{
      const h=document.documentElement;
      const max=(h.scrollHeight-h.clientHeight)||1;
      bar.style.width=Math.max(0,Math.min(100,(h.scrollTop/max)*100))+"%";
    };
    run(); window.addEventListener('scroll', run, {passive:true}); window.addEventListener('resize', run);
  }

  function initReveal(){
    const nodes=$$('.card,.sectionTitle,.note,.metric,.stat,.advancedPanel').filter(el=>!el.classList.contains('reveal'));
    nodes.forEach(el=>el.classList.add('reveal'));
    if(!('IntersectionObserver' in window)){ nodes.forEach(el=>el.classList.add('in')); return; }
    const io=new IntersectionObserver(entries=>entries.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } }),{threshold:.12,rootMargin:'0px 0px -40px 0px'});
    nodes.forEach(el=>io.observe(el));
  }

  function initLiquidityPlanner(){
    const box=$('[data-liquidity-planner]'); if(!box) return;
    const total=Number(cfg().totalSupply || 10000000000);
    const bnb=$('[data-calc-bnb]', box), bnbUsd=$('[data-calc-bnb-usd]', box), fdv=$('[data-calc-fdv]', box), ratio=$('[data-calc-ratio]', box);
    const outTokens=$('[data-out-buv]', box), outPrice=$('[data-out-price]', box), outPool=$('[data-out-pool]', box), outRatio=$('[data-out-ratio]', box);
    const warn=$('[data-calc-warning]', box);
    const copyBtn=$('[data-copy-calc]', box), resetBtn=$('[data-reset-calc]', box);
    function compute(changed){
      const b=Number(bnb.value||0), u=Number(bnbUsd.value||0), f=Number(fdv.value||0), r=Number(ratio.value||0);
      const bUsd=b*u;
      let tokens=0, priceUsd=0, implied=0, buvPerBnb=0;
      if(changed==='ratio' && r>0){
        buvPerBnb=r; tokens=b*r; priceUsd=(u/r); implied=priceUsd*total;
        if(fdv) fdv.value = Number.isFinite(implied) ? Math.round(implied) : '';
      }else if(f>0){
        priceUsd=f/total; tokens=bUsd/priceUsd; implied=f; buvPerBnb = u/priceUsd;
        if(ratio) ratio.value = Number.isFinite(buvPerBnb) ? Math.round(buvPerBnb) : '';
      }
      outTokens.textContent = tokens ? fmt0.format(tokens) + ' BUV' : '—';
      outPrice.textContent = priceUsd ? money(priceUsd) + ' / BUV' : '—';
      outPool.textContent = bUsd ? money(bUsd*2) + ' total pool value' : '—';
      outRatio.textContent = buvPerBnb ? '1 BNB ≈ ' + fmt0.format(buvPerBnb) + ' BUV' : '—';
      const low = bUsd>0 && bUsd<50;
      warn.textContent = low ? 'Starter liquidity is low; small buys/sells may move price sharply.' : 'Planner ready. Add liquidity only from the official owner wallet.';
      warn.classList.toggle('ok', !low);
      const payload={bnbAmount:b, bnbUsd:u, targetFDV:implied, buvToPair:tokens, startingPriceUsd:priceUsd, ratio:`1 BNB = ${buvPerBnb} BUV`};
      box.dataset.lastCalc=JSON.stringify(payload,null,2);
    }
    [bnb,bnbUsd,fdv].forEach(el=>el&&el.addEventListener('input',()=>compute(el===fdv?'fdv':'value')));
    ratio&&ratio.addEventListener('input',()=>compute('ratio'));
    copyBtn&&copyBtn.addEventListener('click',async()=>{
      const data=box.dataset.lastCalc || '';
      try{ await navigator.clipboard.writeText(data); copyBtn.classList.add('copyFlash'); setTimeout(()=>copyBtn.classList.remove('copyFlash'),600); toast('Liquidity plan copied'); }catch(_){ toast('Copy unavailable'); }
    });
    resetBtn&&resetBtn.addEventListener('click',()=>{ bnb.value='0.026'; bnbUsd.value='600'; fdv.value='25000'; ratio.value=''; compute('fdv'); });
    compute('fdv');
  }

  function initSmartShare(){
    $$('[data-share-project]').forEach(btn=>btn.addEventListener('click', async()=>{
      const text=`Burnaverse Protocol (BUV) on BNB Chain\nContract: ${cfg().contract}\n${location.href}`;
      if(navigator.share){ try{ await navigator.share({title:'Burnaverse Protocol (BUV)',text,url:location.href}); return; }catch(_){} }
      try{ await navigator.clipboard.writeText(text); toast('Project details copied'); }catch(_){ toast('Share unavailable'); }
    }));
  }

  function platform(){
    const ua=navigator.userAgent||'';
    return {
      ios:/iphone|ipad|ipod/i.test(ua) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1),
      android:/android/i.test(ua),
      mobile:/iphone|ipad|ipod|android/i.test(ua),
      chrome:/chrome|crios|chromium|edg\//i.test(ua),
      safari:/safari/i.test(ua) && !/chrome|crios|chromium|edg\//i.test(ua),
      standalone: window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
    };
  }

  function buildInstallModal(state){
    let modal=$('#installSmartModal');
    if(modal) modal.remove();
    const p=platform();
    const steps = p.ios
      ? ['Tap the Share icon in Safari.', 'Choose “Add to Home Screen”.', 'Tap Add to install Burnaverse.']
      : state.canPrompt
        ? ['Tap Install below.', 'Approve the browser prompt.', 'Open Burnaverse from your home screen or app launcher.']
        : ['Open your browser menu.', 'Choose Install app or Add to Home screen.', 'Save Burnaverse for faster access.'];
    modal=document.createElement('div');
    modal.id='installSmartModal';
    modal.className='installModalBack';
    modal.innerHTML=`
      <div class="installModal" role="dialog" aria-modal="true" aria-label="Install Burnaverse Protocol">
        <button class="installModalClose" type="button" aria-label="Close">×</button>
        <div class="installHeroIcon"><img src="assets/logo.png" alt="" /></div>
        <h3>Install Burnaverse Protocol</h3>
        <p>Use BUV like a lightweight app: quicker launch, cached pages, direct swap access, and official contract shortcuts.</p>
        <div class="installBenefitGrid">
          <div><b>Fast access</b><span>Launch directly from your home screen.</span></div>
          <div><b>Offline-ready</b><span>Core pages stay available after first visit.</span></div>
          <div><b>Safer routing</b><span>Keep official BscScan and PancakeSwap links close.</span></div>
        </div>
        <ol class="installSteps">${steps.map(x=>`<li>${x}</li>`).join('')}</ol>
        <div class="installModalActions">
          <button class="btn" type="button" data-install-now-modal>${state.canPrompt?'Install now':'Got it'}</button>
          <button class="btn ghost" type="button" data-install-cache-modal>Refresh offline cache</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector('.installModalClose').addEventListener('click',()=>modal.remove());
    modal.addEventListener('click',e=>{if(e.target===modal)modal.remove();});
    modal.querySelector('[data-install-now-modal]').addEventListener('click',()=>{
      if(state.canPrompt && state.prompt) state.prompt(); else modal.remove();
    });
    modal.querySelector('[data-install-cache-modal]').addEventListener('click',()=>refreshOfflineCache());
  }

  function initPWA(){
    const p=platform();
    const state={deferred:null, canPrompt:false, prompt:null, installed:p.standalone, ready:false};
    const hint=$('[data-install-card]') || $('.installHint');
    const install=$('[data-install-app]'), close=$('[data-install-close]'), guide=$('[data-install-guide]');
    const title=$('[data-install-title]', hint||document), msg=$('[data-install-message]', hint||document), meta=$('[data-install-meta]', hint||document);
    const dismissedUntil=store.get('buv.install.dismissedUntil',0);
    const seen=store.get('buv.install.seen',0)+1; store.set('buv.install.seen',seen);

    function setCopy(mode){
      if(!hint) return;
      if(mode==='installed'){
        title.textContent='Burnaverse is installed';
        msg.textContent='You can open it from your app screen. Offline core pages are enabled.';
        meta.textContent=navigator.onLine?'Online • App mode active':'Offline • Cached mode active';
        install.textContent='Open';
      }else if(mode==='ready'){
        title.textContent='Install Burnaverse Protocol';
        msg.textContent='Install for faster access, offline viewing, and direct BUV shortcuts.';
        meta.textContent='Recommended • Works like an app on this device';
        install.textContent='Install';
      }else if(mode==='ios'){
        title.textContent='Add Burnaverse to Home Screen';
        msg.textContent='Safari on iPhone/iPad installs through the Share menu.';
        meta.textContent='iOS tip • Share → Add to Home Screen';
        install.textContent='Show steps';
      }else if(mode==='unsupported'){
        title.textContent='Save Burnaverse for quick access';
        msg.textContent='Your browser may not show a one-tap install prompt. Use the menu to add/bookmark it.';
        meta.textContent='Browser menu install/bookmark available';
        install.textContent='Guide';
      }else{
        title.textContent='Preparing Burnaverse app mode';
        msg.textContent='Checking install support and refreshing offline readiness.';
        meta.textContent='Checking…';
      }
    }

    function show(force=false){
      if(!hint || state.installed) { setCopy('installed'); if(force){hint.hidden=false; hint.classList.add('show');} return; }
      if(!force && Date.now()<dismissedUntil) return;
      if(!force && seen < 2) return; // less intrusive: show after repeat visit or install event
      hint.hidden=false;
      setTimeout(()=>hint.classList.add('show'),30);
    }
    function hide(days=7){
      hint&&hint.classList.remove('show');
      setTimeout(()=>{ if(hint) hint.hidden=true; },260);
      store.set('buv.install.dismissedUntil', Date.now()+days*864e5);
    }

    async function registerSW(){
      if(!('serviceWorker' in navigator) || location.protocol==='file:') return null;
      try{
        const reg=await navigator.serviceWorker.register('/sw.js', {scope:'/'}).catch(()=>navigator.serviceWorker.register('sw.js'));
        state.ready=true;
        return reg;
      }catch(_){ return null; }
    }
    registerSW().then(()=>{ if(meta && !state.installed) meta.textContent = meta.textContent.replace('Checking…','Offline cache ready'); });

    window.addEventListener('beforeinstallprompt', (e)=>{
      e.preventDefault();
      state.deferred=e; state.canPrompt=true;
      state.prompt=async()=>{
        if(!state.deferred){ buildInstallModal(state); return; }
        state.deferred.prompt();
        const choice=await state.deferred.userChoice.catch(()=>({outcome:'dismissed'}));
        state.deferred=null; state.canPrompt=false;
        if(choice.outcome==='accepted'){ toast('Burnaverse installed successfully'); hide(365); }
        else { toast('Install dismissed'); hide(3); }
      };
      setCopy('ready'); show(true);
    });

    window.addEventListener('appinstalled',()=>{ state.installed=true; setCopy('installed'); toast('Burnaverse installed'); hide(365); });
    window.matchMedia('(display-mode: standalone)').addEventListener?.('change', e=>{ if(e.matches){state.installed=true; setCopy('installed');} });

    const initialMode = state.installed ? 'installed' : p.ios ? 'ios' : 'unsupported';
    setCopy(initialMode);
    setTimeout(()=>show(false), 2200);
    install&&install.addEventListener('click', async()=>{
      if(state.installed){ location.href='index.html'; return; }
      if(state.canPrompt && state.prompt) return state.prompt();
      buildInstallModal(state);
    });
    guide&&guide.addEventListener('click',()=>buildInstallModal(state));
    close&&close.addEventListener('click',()=>hide(7));
    window.addEventListener('online',()=>{ if(meta) meta.textContent='Online • Offline cache stays ready'; toast('Back online'); });
    window.addEventListener('offline',()=>{ if(meta) meta.textContent='Offline • Showing cached Burnaverse pages'; toast('Offline mode active'); });
  }

  async function refreshOfflineCache(){
    if(!('serviceWorker' in navigator) || !navigator.serviceWorker.controller){ toast('Offline cache will prepare after reload'); return; }
    const channel=new MessageChannel();
    const done=new Promise(resolve=>{ channel.port1.onmessage=e=>resolve(e.data); setTimeout(()=>resolve({ok:false}),5000); });
    navigator.serviceWorker.controller.postMessage({type:'CACHE_NOW'}, [channel.port2]);
    const result=await done;
    toast(result && result.ok ? 'Offline cache refreshed' : 'Cache refresh queued');
  }

  function initContractQuality(){
    const holder=$('[data-security-checks]'); if(!holder) return;
    const items=[
      ['Verified address','Always compare the contract address before buying or adding liquidity.'],
      ['Liquidity visibility','Market data appears after a pool exists and public DEX APIs index it.'],
      ['Risk notice','Crypto assets can be volatile. Use official links and avoid impersonator contracts.']
    ];
    holder.innerHTML=items.map(([a,b])=>`<div class="auditItem"><b>${a}</b><span>${b}</span></div>`).join('');
  }

  function initMicroInteractions(){
    // Smart external link confirmation for sensitive token routes.
    $$('a[data-link="pancakeswap"],a[data-link="bscscan-contract"],a[data-link="bscscan-token"]').forEach(a=>{
      a.addEventListener('click',()=>{ store.set('buv.lastExternalClick',{href:a.href,at:Date.now()}); });
    });
    // Add copy-to-clipboard for any address row double-click.
    $$('[data-contract]').forEach(el=>el.addEventListener('dblclick',async()=>{try{await navigator.clipboard.writeText(cfg().contract);toast('Contract copied');}catch(_){}}));
  }

  document.addEventListener('DOMContentLoaded',()=>{
    initScrollProgress(); initReveal(); initLiquidityPlanner(); initSmartShare(); initPWA(); initContractQuality(); initMicroInteractions();
  });
})();
