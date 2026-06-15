
function hexPad32(hex){
  const h = (hex || "").replace(/^0x/, "");
  return h.padStart(64, "0");
}
async function ethCall(to, data){
  return await window.ethereum.request({
    method: "eth_call",
    params: [{ to, data }, "latest"]
  });
}
async function getErc20Balance(token, owner){
  const data = "0x70a08231" + hexPad32(owner);
  const res = await ethCall(token, data);
  return BigInt(res);
}
function formatAmount(bi, decimals=18, precision=4){
  if(bi === null || bi === undefined) return "—";
  const neg = bi < 0n;
  const v = neg ? -bi : bi;
  const base = 10n ** BigInt(decimals);
  const whole = v / base;
  const frac = v % base;
  const fracStr = frac.toString().padStart(decimals, "0").slice(0, precision);
  const out = whole.toString() + (precision > 0 ? ("." + fracStr) : "");
  return (neg ? "-" : "") + out.replace(/\.0+$/,"");
}


function setInert(el, inert){
  if(!el) return;
  try{
    if(inert) el.setAttribute("inert","");
    else el.removeAttribute("inert");
  }catch(_){}
}

async function fetchDexScreener(tokenAddress){
  const url = `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`;
  const r = await fetch(url, {cache:"no-store"});
  if(!r.ok) throw new Error("DexScreener fetch failed");
  return r.json();
}
function formatUSD(n){
  if(n === null || n === undefined || Number.isNaN(n)) return "—";
  const num = Number(n);
  if(num >= 1e9) return "$" + (num/1e9).toFixed(2) + "B";
  if(num >= 1e6) return "$" + (num/1e6).toFixed(2) + "M";
  if(num >= 1e3) return "$" + (num/1e3).toFixed(2) + "K";
  return "$" + num.toFixed(num >= 1 ? 2 : 6);
}

function animateNumberText(el, toText, duration=450){
  if(!el) return;
  const fromText = el.getAttribute("data-prev") || el.textContent || "—";
  el.setAttribute("data-prev", toText);
  const toNum = Number(String(toText).replace(/[^0-9.\-]/g,""));
  const fromNum = Number(String(fromText).replace(/[^0-9.\-]/g,""));
  if(!Number.isFinite(toNum) || !Number.isFinite(fromNum)){
    el.textContent = toText;
    return;
  }
  const start = performance.now();
  const tick = (t)=>{
    const p = Math.min(1, (t-start)/duration);
    const v = fromNum + (toNum-fromNum)*(1 - Math.pow(1-p,3));
    const prefix = (String(toText).match(/^\D+/) || [""])[0];
    const suffix = (String(toText).match(/\D+$/) || [""])[0];
    const decimals = ((String(toText).split(".")[1]||"").match(/^\d+/) || [""])[0].length;
    el.textContent = prefix + v.toFixed(Math.min(6, decimals)) + suffix;
    if(p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function formatNum(n){
  if(n === null || n === undefined || Number.isNaN(n)) return "—";
  const num = Number(n);
  if(num >= 1e9) return (num/1e9).toFixed(2) + "B";
  if(num >= 1e6) return (num/1e6).toFixed(2) + "M";
  if(num >= 1e3) return (num/1e3).toFixed(2) + "K";
  return String(Math.round(num));
}
function setTheme(theme){
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("bv_theme", theme);
  const t = document.getElementById("themeToggleText");
  if(t) t.textContent = theme === "light" ? "Light" : "Dark";
}
function initTheme(){
  const saved = localStorage.getItem("bv_theme");
  setTheme(saved || "dark");
}
function initThemeToggle(){
  const btn = document.querySelector("[data-theme-toggle]");
  if(!btn) return;
  btn.addEventListener("click", ()=>{
    const cur = document.documentElement.getAttribute("data-theme") || "dark";
    setTheme(cur === "dark" ? "light" : "dark");
  });
}
function initPageTransitions(){
  document.querySelectorAll("a[href]").forEach(a=>{
    const href = a.getAttribute("href");
    if(!href) return;
    const isExternal = href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("#") || href.startsWith("assets/");
    if(isExternal) return;
    a.addEventListener("click", (e)=>{
      if(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      document.body.classList.add("page-leave");
      setTimeout(()=>{ window.location.href = href; }, 180);
    });
  });
  document.body.classList.add("page-enter");
}
function animateCounters(){
  const els = document.querySelectorAll("[data-count-to]");
  if(!els.length) return;
  const io = new IntersectionObserver((entries)=>{
    for(const en of entries){
      if(!en.isIntersecting) continue;
      const el = en.target;
      io.unobserve(el);
      const target = Number(el.getAttribute("data-count-to") || "0");
      const prefix = el.getAttribute("data-count-prefix") || "";
      const suffix = el.getAttribute("data-count-suffix") || "";
      const dur = 900;
      const start = performance.now();
      const tick = (t)=>{
        const p = Math.min(1, (t - start)/dur);
        const val = target*(1 - Math.pow(1-p, 3));
        el.textContent = prefix + formatNum(val) + suffix;
        if(p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  }, {threshold: 0.35});
  els.forEach(el=>io.observe(el));
}

function liquidityBadge(p){
  const liq = Number(p?.liquidity?.usd || 0);
  const tx = Number(p?.txns?.h24?.buys || 0) + Number(p?.txns?.h24?.sells || 0);
  if(liq > 50000 && tx > 100) return "High activity";
  if(liq > 5000) return "Growing";
  return "Low liquidity";
}

async function initLiveStats(){
  const box = document.querySelector("[data-live-stats]");
  if(!box) return;
  const addr = (window.CONFIG && window.CONFIG.contract) ? window.CONFIG.contract : null;
  if(!addr) return;

  const status = box.querySelector("[data-live-status]");
  const priceEl = box.querySelector("[data-live-price]");
  const liqEl = box.querySelector("[data-live-liquidity]");
  const volEl = box.querySelector("[data-live-volume]");
  const fdvEl = box.querySelector("[data-live-fdv]");
  const pairEl = box.querySelector("[data-live-pair]");
  const chgEl = box.querySelector("[data-live-change]");
  const buysEl = box.querySelector("[data-live-buys]");
  const sellsEl = box.querySelector("[data-live-sells]");
  const pairAddrEl = box.querySelector("[data-live-pairaddr]");
  const dexLinkEl = box.querySelector("[data-live-dexlink]");
  const poolsEl = box.querySelector("[data-live-pools]");

  const setStatus = (txt, type)=>{
    if(!status) return;
    status.textContent = txt;
    status.classList.remove("good","bad");
    if(type) status.classList.add(type);
  };

  try{
    setStatus("Loading live market data…");
    const data = await fetchDexScreener(addr);
    const pairs = (data && data.pairs) ? data.pairs : [];
    if(!pairs.length){
      setStatus("Liquidity not detected yet — live stats will appear after pool + first swap.", "bad");
      return;
    }
    pairs.sort((a,b)=> (Number(b.liquidity?.usd||0) - Number(a.liquidity?.usd||0)));
    const p = pairs[0];

    setStatus("Live market data • " + liquidityBadge(p), "good");

    const priceTxt = formatUSD(p.priceUsd);
    const liqTxt = formatUSD(p.liquidity?.usd);
    const volTxt = formatUSD(p.volume?.h24);
    const fdvTxt = formatUSD(p.fdv);

    if(priceEl) animateNumberText(priceEl, priceTxt);
    if(liqEl) animateNumberText(liqEl, liqTxt);
    if(volEl) animateNumberText(volEl, volTxt);
    if(fdvEl) animateNumberText(fdvEl, fdvTxt);

    if(pairEl) pairEl.textContent = `${(p.dexId||"DEX").toUpperCase()} • ${(p.chainId||"BSC").toUpperCase()} • ${p.baseToken?.symbol||""}/${p.quoteToken?.symbol||""}`;

    if(chgEl){
      const ch = p.priceChange?.h24;
      if(ch === undefined || ch === null) chgEl.textContent = "—";
      else{
        const num = Number(ch);
        chgEl.textContent = (num>0?"+":"") + num.toFixed(2) + "%";
      }
    }

    const buys = p.txns?.h24?.buys;
    const sells = p.txns?.h24?.sells;
    if(buysEl) buysEl.textContent = (buys==null) ? "Buys: —" : `Buys: ${buys}`;
    if(sellsEl) sellsEl.textContent = (sells==null) ? "Sells: —" : `Sells: ${sells}`;

    if(pairAddrEl) pairAddrEl.textContent = p.pairAddress ? ("Pair: " + p.pairAddress.slice(0,10) + "…" + p.pairAddress.slice(-6)) : "Pair: —";
    if(dexLinkEl){
      const url = p.url || "";
      dexLinkEl.href = url || "#";
      dexLinkEl.style.opacity = url ? "1" : ".6";
    }

    if(poolsEl){
      const top = pairs.slice(0,3).map(pp=>{
        const dex = (pp.dexId||"DEX").toUpperCase();
        const liq = formatUSD(pp.liquidity?.usd);
        const sym = (pp.baseToken?.symbol||"") + "/" + (pp.quoteToken?.symbol||"");
        return `<a class="poolItem" href="${pp.url||"#"}" target="_blank" rel="noreferrer"><b>${dex}</b><span>${sym}</span><span>${liq}</span></a>`;
      }).join("");
      poolsEl.innerHTML = top;
    }
  }catch(e){
    console.error(e);
    setStatus("Live market data unavailable.", "bad");
  }
}

function closeDrawerIfOpen(){
  const links = document.getElementById("navLinks");
  const overlay = document.getElementById("navOverlay");
  const btn = document.getElementById("navToggle");
  if(links && links.classList.contains("open")){
    links.classList.remove("open");
    overlay && overlay.classList.remove("show");
    btn && btn.setAttribute("aria-expanded","false");
    document.body.classList.remove("nav-locked");
  }
}


function initModal(){
  const back = document.getElementById("modalBack");
  if(!back) return;
  const close = ()=> back.classList.remove("show");
  back.addEventListener("click",(e)=>{ if(e.target === back) close(); });
  document.querySelectorAll("[data-modal-close]").forEach(b=>b.addEventListener("click", close));
  document.addEventListener("keydown",(e)=>{ if(e.key === "Escape") close(); });

  document.querySelectorAll("[data-open-modal]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      closeDrawerIfOpen();
      back.classList.add("show");
      const first = back.querySelector("input,textarea,select,button");
      if(first) setTimeout(()=>first.focus(), 50);
    });
  });

  const form = document.getElementById("applyForm");
  if(form){
    form.addEventListener("submit",(e)=>{
      e.preventDefault();
      const fd = new FormData(form);
      const obj = {};
      fd.forEach((v,k)=> obj[k]=String(v).trim());
      if(!obj.name || !obj.email || !obj.category || !obj.message){
        window.toast && window.toast("Please complete the required fields.");
        return;
      }
      const key = "bv_submissions";
      const cur = JSON.parse(localStorage.getItem(key) || "[]");
      cur.unshift({ ...obj, ts: new Date().toISOString() });
      localStorage.setItem(key, JSON.stringify(cur).slice(0, 200000));
      form.reset();
      close();
      window.toast && window.toast("Submitted. We’ll reach out if selected.");
    });
  }
}

function initNavDrawer(){
  const btn = document.getElementById("navToggle");
  const links = document.getElementById("navLinks");
  const overlay = document.getElementById("navOverlay");
  const closeBtn = document.getElementById("drawerClose");
  const main = document.querySelector("main");
  const header = document.querySelector("header");
  if(!btn || !links) return;

  btn.setAttribute("aria-expanded","false");
  btn.setAttribute("aria-controls","navLinks");
  links.setAttribute("role","dialog");
  links.setAttribute("aria-modal","true");

  const focusableSel = 'a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])';
  let lastFocused = null;

  let __scrollY = 0;
  const lockBody = () => {
    __scrollY = window.scrollY || 0;
    document.body.classList.add("nav-locked");
    document.body.style.position = "fixed";
    document.body.style.top = `-${__scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
  };
    const unlockBody = () => {
    document.body.classList.remove("nav-locked");
    const top = document.body.style.top;
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    document.body.style.width = "";
    const y = top ? Math.abs(parseInt(top, 10)) : __scrollY;
    window.scrollTo(0, y || 0);
  };

  const open = ()=> {
    // reset drawer scroll for consistent navigation
    links.scrollTop = 0;
    lastFocused = document.activeElement;
    links.classList.add("open");
    overlay && overlay.classList.add("show");
    btn.setAttribute("aria-expanded","true");
    lockBody();
    if(main) main.setAttribute("aria-hidden","true");
    setInert(main, true);

    // focus first actionable item inside drawer
    const first = links.querySelector(focusableSel);
    if(first) setTimeout(()=>first.focus(), 30);
  };

  const close = ()=> {
    links.classList.remove("open");
    overlay && overlay.classList.remove("show");
    btn.setAttribute("aria-expanded","false");
    unlockBody();
    if(main) main.removeAttribute("aria-hidden");
    setInert(main, false);

    if(lastFocused && lastFocused.focus) setTimeout(()=>lastFocused.focus(), 30);
  };

  const toggle = ()=> (links.classList.contains("open") ? close() : open());

  btn.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); toggle(); });
  closeBtn && closeBtn.addEventListener("click", (e)=>{ e.preventDefault(); close(); });
  overlay && overlay.addEventListener("click", close);

  // close on internal link click
  links.querySelectorAll("a").forEach(a=>a.addEventListener("click", ()=> close()));

  // Focus trap when drawer open
  document.addEventListener("keydown", (e)=>{
    if(!links.classList.contains("open")) return;
    if(e.key === "Escape"){ e.preventDefault(); close(); return; }
    if(e.key !== "Tab") return;
    const focusables = Array.from(links.querySelectorAll(focusableSel)).filter(el=>!el.hasAttribute("disabled"));
    if(!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
    else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
  });

  // Prevent wheel/scroll from affecting body when open (some mobile browsers)
  links.addEventListener("wheel", (e)=>{ if(links.classList.contains("open")) e.stopPropagation(); }, {passive:true});
}



function shortAddr(a){
  if(!a || a.length < 10) return a || "";
  return a.slice(0,6) + "…" + a.slice(-4);
}

async function ensureBSC(){
  if(!window.ethereum) return;
  const chainId = await window.ethereum.request({ method: "eth_chainId" });
  if(chainId === "0x38") return;
  try{
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x38" }]
    });
  }catch(e){
    if(e && (e.code === 4902 || String(e.message||"").includes("4902"))){
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: "0x38",
          chainName: "BNB Smart Chain",
          nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
          rpcUrls: ["https://bsc-dataseed.binance.org/"],
          blockExplorerUrls: ["https://bscscan.com/"]
        }]
      });
    }else{
      throw e;
    }
  }
}

async function connectWallet(){
  const btn = document.getElementById("connectWallet");
  if(!window.ethereum){
    window.toast && window.toast("Install MetaMask to connect.");
    return;
  }
  try{
    try{
      await window.ethereum.request({
        method: "wallet_requestPermissions",
        params: [{ eth_accounts: {} }]
      });
    }catch(_){}
    await ensureBSC();
    const accts = await window.ethereum.request({ method: "eth_requestAccounts" });
    const addr = (accts && accts[0]) ? accts[0] : null;
    if(addr){
      if(btn){
        btn.textContent = shortAddr(addr);
        btn.classList.add("wallet");
      }
      localStorage.setItem("bv_wallet", addr);
      window.toast && window.toast("Wallet connected");
      await updateWalletUI();
    }
  }catch(e){
    console.error(e);
    window.toast && window.toast("Wallet connection canceled.");
    await updateWalletUI();
  }
}

function initWalletButton(){
  const btn = document.getElementById("connectWallet");
  if(!btn) return;
  btn.addEventListener("click", connectWallet);
  const saved = localStorage.getItem("bv_wallet");
  if(saved) btn.textContent = shortAddr(saved);
  if(window.ethereum && window.ethereum.on){
    window.ethereum.on("accountsChanged", async (accs)=>{
      const a = (accs && accs[0]) ? accs[0] : "";
      if(a) localStorage.setItem("bv_wallet", a);
      else localStorage.removeItem("bv_wallet");
      await updateWalletUI();
    });
    window.ethereum.on("chainChanged", async ()=>{ await updateWalletUI(); });
  }
}



async function getBNBBalance(address){
  if(!window.ethereum || !address) return null;
  // use eth_getBalance on current chain
  const hex = await window.ethereum.request({
    method: "eth_getBalance",
    params: [address, "latest"]
  });
  // hex to decimal BNB
  const wei = BigInt(hex);
  const bnb = Number(wei) / 1e18; // safe enough for display
  return bnb;
}

function setStatusChip(el, text, tone){
  if(!el) return;
  el.textContent = text;
  el.classList.remove("good","bad");
  if(tone) el.classList.add(tone);
}

async function updateWalletUI(){
  const btn = document.getElementById("connectWallet");
  const chip = document.getElementById("walletStatusChip");
  const bnbEl = document.getElementById("walletBalance");
  const buvEl = document.getElementById("walletTokenBalance");
  if(!btn && !chip && !bnbEl && !buvEl) return;

  if(!window.ethereum){
    if(chip) setStatusChip(chip, "Wallet: Not installed", "bad");
    if(bnbEl) bnbEl.textContent = "BNB: —";
    if(buvEl) buvEl.textContent = "BUV: —";
    if(btn) btn.textContent = "Connect Wallet";
    return;
  }

  let chainId = null;
  try{ chainId = await window.ethereum.request({ method: "eth_chainId" }); }catch(_ ){}
  const isBSC = (chainId === "0x38");
  if(chip){
    if(!isBSC) setStatusChip(chip, "Network: Wrong (switch to BSC)", "bad");
    else setStatusChip(chip, "Network: BSC", "good");
  }

  let addr = "";
  try{
    const accts = await window.ethereum.request({ method: "eth_accounts" });
    if(accts && accts[0]) addr = accts[0];
  }catch(_ ){}
  if(!addr) addr = localStorage.getItem("bv_wallet") || "";

  if(!addr){
    if(btn) btn.textContent = "Connect Wallet";
    if(bnbEl) bnbEl.textContent = "BNB: —";
    if(buvEl) buvEl.textContent = "BUV: —";
    return;
  }

  if(btn){
    btn.textContent = shortAddr(addr);
    btn.classList.add("wallet");
  }

  try{
    const b = await getBNBBalance(addr);
    if(bnbEl){
      if(b === null || Number.isNaN(b)) bnbEl.textContent = "BNB: —";
      else bnbEl.textContent = "BNB: " + (b >= 1 ? b.toFixed(3) : b.toFixed(4));
    }
  }catch(_ ){ if(bnbEl) bnbEl.textContent = "BNB: —"; }

  try{
    const bal = await getErc20Balance("0xd14Ec02A022D2BD4117a0EEba966423253a48ad1", addr);
    if(buvEl) buvEl.textContent = "BUV: " + formatAmount(bal, 18, 4);
  }catch(_ ){ if(buvEl) buvEl.textContent = "BUV: —"; }
}



function initLiveStatsAuto(){
  const box = document.querySelector("[data-live-stats]");
  if(!box) return;

  const stamp = document.createElement("span");
  stamp.className = "chip";
  stamp.style.marginLeft = "auto";
  stamp.textContent = "Updated: —";
  const row = box.querySelector(".chipRow");
  if(row) row.appendChild(stamp);

  let timer = null;
  const run = async ()=>{
    try{
      await initLiveStats();
      const d = new Date();
      stamp.textContent = "Updated: " + d.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"});
    }catch(_){}
  };

  const io = new IntersectionObserver((entries)=>{
    const vis = entries.some(e=>e.isIntersecting);
    if(vis){
      run();
      timer = timer || setInterval(run, 45000);
    }else{
      if(timer){ clearInterval(timer); timer = null; }
    }
  }, {threshold: 0.2});

  io.observe(box);
}



function initDrawerAccordion(){
  const sections = Array.from(document.querySelectorAll(".sidebar [data-accordion]"));
  if(!sections.length) return;

  const openSection = (sec)=>{
    sections.forEach(s=>{ if(s!==sec) s.classList.remove("open"); });
    sec.classList.add("open");
  };

  sections.forEach(sec=>{
    const head = sec.querySelector("[data-accordion-head]");
    if(!head) return;
    head.addEventListener("click", ()=>{
      const isOpen = sec.classList.contains("open");
      if(isOpen) sec.classList.remove("open");
      else openSection(sec);
    });
  });

  const active = document.querySelector(".sidebar .sidebarLink.active");
  if(active){
    const parent = active.closest("[data-accordion]");
    if(parent) parent.classList.add("open");
  }
}




function initSidebar(){
  const body = document.body;
  const btn = document.getElementById("navToggle");
  const overlay = document.getElementById("sidebarOverlay");
  const closeBtn = document.getElementById("sidebarCloseMobile");

  const isMobile = ()=> window.innerWidth <= 980;

  const closeMobile = ()=> body.classList.remove("sidebar-open");
  const toggleMobile = ()=> body.classList.toggle("sidebar-open");

  const toggleDesktop = ()=> body.classList.toggle("sidebar-closed");

  const handleToggle = (e)=>{
    e.preventDefault();
    if(isMobile()) toggleMobile();
    else toggleDesktop();
  };

  btn && btn.addEventListener("click", handleToggle);

  overlay && overlay.addEventListener("click", closeMobile);
  closeBtn && closeBtn.addEventListener("click", closeMobile);

  document.addEventListener("keydown",(e)=>{
    if(e.key === "Escape"){
      closeMobile();
    }
  });

  document.querySelectorAll(".sidebar a[href]").forEach(a=>{
    a.addEventListener("click", ()=> closeMobile());
  });

  // Prevent stuck state on resize/rotate
  window.addEventListener("resize", ()=>{
    if(isMobile()){
      body.classList.remove("sidebar-closed");
    }else{
      body.classList.remove("sidebar-open");
    }
  });
}



document.addEventListener("DOMContentLoaded", ()=>{
  initTheme();
  initSidebar();
  initNavDrawer();
  initDrawerAccordion();
  initWalletButton();
    initThemeToggle();
  initPageTransitions();
  animateCounters();
  initLiveStats();
  initLiveStatsAuto();
  initModal();
});
