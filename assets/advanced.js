
/* Burnaverse Advanced Upgrade Layer */
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
      box.dataset.lastCalc=JSON.stringify(payload);
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

  function initPWA(){
    if('serviceWorker' in navigator && location.protocol !== 'file:'){
      window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
    }
    let deferred=null;
    const hint=$('.installHint'), install=$('[data-install-app]'), close=$('[data-install-close]');
    window.addEventListener('beforeinstallprompt', (e)=>{ e.preventDefault(); deferred=e; if(hint) hint.classList.add('show'); });
    install&&install.addEventListener('click', async()=>{ if(!deferred){ toast('Use your browser menu to install this app.'); return; } deferred.prompt(); await deferred.userChoice.catch(()=>{}); deferred=null; hint&&hint.classList.remove('show'); });
    close&&close.addEventListener('click',()=>hint&&hint.classList.remove('show'));
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

  document.addEventListener('DOMContentLoaded',()=>{
    initScrollProgress(); initReveal(); initLiquidityPlanner(); initSmartShare(); initPWA(); initContractQuality();
  });
})();
