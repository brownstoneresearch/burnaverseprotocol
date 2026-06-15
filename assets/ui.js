
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

  const cfg = window.CONFIG || {};
  const modalUrl = cfg.supportModalUrl || "https://burnaverseprotocol.pages.dev/#apply-support";
  const close = (syncHash=true)=>{
    back.classList.remove("show");
    back.setAttribute("aria-hidden","true");
    document.body.classList.remove("modal-open");
    if(syncHash && location.hash === "#apply-support"){
      history.replaceState(null, "", location.pathname + location.search);
    }
  };
  const open = (pushHash=false)=>{
    closeDrawerIfOpen();
    back.classList.add("show");
    back.setAttribute("aria-hidden","false");
    document.body.classList.add("modal-open");
    if(pushHash && location.hash !== "#apply-support") history.pushState(null, "", "#apply-support");
    const first = back.querySelector("input,textarea,select,button");
    if(first) setTimeout(()=>first.focus(), 50);
  };

  // Upgrade the popup into a shareable Web3 container without requiring manual HTML edits on every page.
  const modal = back.querySelector(".modal");
  if(modal && !modal.dataset.web3Upgraded){
    modal.dataset.web3Upgraded = "1";
    modal.classList.add("supportPopupWeb3");
    const head = modal.querySelector(".modalHead");
    if(head && !head.querySelector("[data-copy-support-modal-link]")){
      const actions = document.createElement("div");
      actions.className = "modalShareActions";
      actions.innerHTML = '<button class="mini good" type="button" data-copy-support-modal-link>Copy popup link</button><button class="mini" type="button" data-share-support-modal-link>Share</button>';
      head.appendChild(actions);
    }
    const form = modal.querySelector("#applyForm");
    if(form && !form.querySelector("#walletAddress")){
      const walletBlock = document.createElement("div");
      walletBlock.className = "field walletFieldBlock";
      walletBlock.innerHTML = '<label for="walletAddress">Wallet address (optional)</label><div class="inlineField"><input class="input" id="walletAddress" name="walletAddress" placeholder="0x… public wallet only" /><button class="mini" type="button" data-fill-connected-wallet>Use connected</button></div><div class="walletMiniGrid"><button class="mini good" type="button" data-modal-connect-wallet>Connect Wallet</button><a class="mini" data-wallet-open="metamask" target="_blank" rel="noreferrer">MetaMask</a><a class="mini" data-wallet-open="trust" target="_blank" rel="noreferrer">Trust</a><a class="mini" data-wallet-open="safepal" target="_blank" rel="noreferrer">SafePal</a><a class="mini" data-wallet-open="okx" target="_blank" rel="noreferrer">OKX</a></div><div class="helper">For mobile users, open the link inside a wallet dApp browser to connect externally. Never share seed phrases/private keys.</div>';
      const msg = form.querySelector("#message")?.closest(".field");
      if(msg) msg.insertAdjacentElement("beforebegin", walletBlock);
      else form.insertBefore(walletBlock, form.firstChild);
    }
  }

  const copyText = async (text, msg)=>{
    try{ await navigator.clipboard.writeText(text); }
    catch(_){ const t=document.createElement("textarea"); t.value=text; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove(); }
    window.toast && window.toast(msg || "Copied");
  };
  const sharePopup = async ()=>{
    const data = {title:"Apply for Burnaverse Support", text:"Open the Burnaverse Support application popup.", url: modalUrl};
    if(navigator.share){ try{ await navigator.share(data); return; }catch(_){} }
    await copyText(modalUrl, "Popup link copied");
  };

  back.addEventListener("click",(e)=>{ if(e.target === back) close(); });
  document.querySelectorAll("[data-modal-close]").forEach(b=>b.addEventListener("click", ()=>close()));
  document.addEventListener("keydown",(e)=>{ if(e.key === "Escape") close(); });
  document.querySelectorAll("[data-open-modal]").forEach(btn=>btn.addEventListener("click", ()=>open(true)));
  document.querySelectorAll("[data-copy-support-modal-link]").forEach(btn=>btn.addEventListener("click", ()=>copyText(modalUrl, "Popup link copied")));
  document.querySelectorAll("[data-share-support-modal-link]").forEach(btn=>btn.addEventListener("click", sharePopup));
  document.querySelectorAll("[data-modal-connect-wallet]").forEach(btn=>btn.addEventListener("click", connectWallet));
  document.querySelectorAll("[data-fill-connected-wallet]").forEach(btn=>btn.addEventListener("click", ()=>{
    const field = modal?.querySelector("#walletAddress") || document.getElementById("walletAddress");
    const saved = localStorage.getItem("bv_wallet") || "";
    if(field && saved){ field.value = saved; window.toast && window.toast("Connected wallet added"); }
    else { window.toast && window.toast("Connect wallet first"); }
  }));
  if(window.BurnaverseWallets && window.BurnaverseWallets.applyLinks) window.BurnaverseWallets.applyLinks(back);

  const openFromUrl = ()=>{
    const params = new URLSearchParams(location.search);
    if(location.hash === "#apply-support" || params.get("apply") === "support") open(false);
  };
  openFromUrl();
  window.addEventListener("hashchange", openFromUrl);

  const form = modal ? modal.querySelector("#applyForm") : document.getElementById("applyForm");
  if(form && !form.dataset.modalReady){
    form.dataset.modalReady = "1";
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
      let cur = [];
      try{ cur = JSON.parse(localStorage.getItem(key) || "[]") || []; }catch(_){ cur=[]; }
      cur.unshift({ ...obj, source: "support-popup", popupLink: modalUrl, ts: new Date().toISOString() });
      localStorage.setItem(key, JSON.stringify(cur).slice(0, 200000));
      form.reset();
      close();
      window.toast && window.toast("Submitted locally. Connect backend/email for live delivery.");
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
    if(window.BurnaverseWallets && window.BurnaverseWallets.open){
      window.BurnaverseWallets.open("connect");
    }else{
      window.toast && window.toast("Open in a mobile wallet browser to connect.");
    }
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




/* === Burnaverse Web3 mobile wallet launcher + support utilities === */
(function(){
  const APP_URL = "https://burnaverseprotocol.pages.dev/";
  const SUPPORT_URL = (window.CONFIG && window.CONFIG.supportUrl) || "https://burnaverseprotocol.pages.dev/support.html";
  const SUPPORT_MODAL_URL = (window.CONFIG && window.CONFIG.supportModalUrl) || "https://burnaverseprotocol.pages.dev/#apply-support";
  const currentUrl = () => {
    try{
      const href = window.location.href || APP_URL;
      return href.startsWith("file:") ? APP_URL : href;
    }catch(_){ return APP_URL; }
  };
  const enc = (v) => encodeURIComponent(v);
  const walletLinks = (url=currentUrl()) => ({
    metamask: "https://metamask.app.link/dapp/" + url.replace(/^https?:\/\//,""),
    trust: "https://link.trustwallet.com/open_url?coin_id=20000714&url=" + enc(url),
    safepal: "https://link.safepal.io/open?url=" + enc(url),
    okx: "https://www.okx.com/download?deeplink=" + enc("okx://wallet/dapp/url?dappUrl=" + enc(url))
  });

  function ensureSheet(){
    let sheet = document.getElementById("walletSheet");
    if(sheet) return sheet;
    sheet = document.createElement("div");
    sheet.id = "walletSheet";
    sheet.className = "walletSheet";
    sheet.setAttribute("aria-hidden","true");
    sheet.innerHTML = `
      <div class="walletSheetBackdrop" data-wallet-close></div>
      <div class="walletSheetPanel" role="dialog" aria-modal="true" aria-label="Connect mobile wallet">
        <div class="walletSheetHandle" aria-hidden="true"></div>
        <div class="walletSheetHead">
          <div><b>Connect a Web3 wallet</b><span>Open Burnaverse inside a mobile wallet dApp browser.</span></div>
          <button class="mini" type="button" data-wallet-close>Close</button>
        </div>
        <div class="walletSheetBody">
          <a class="walletChoice" data-wallet-choice="metamask" target="_blank" rel="noreferrer"><b>MetaMask</b><span>Open site in MetaMask mobile</span></a>
          <a class="walletChoice" data-wallet-choice="trust" target="_blank" rel="noreferrer"><b>Trust Wallet</b><span>Open site in Trust Wallet</span></a>
          <a class="walletChoice" data-wallet-choice="safepal" target="_blank" rel="noreferrer"><b>SafePal</b><span>Open site in SafePal wallet</span></a>
          <a class="walletChoice" data-wallet-choice="okx" target="_blank" rel="noreferrer"><b>OKX Wallet</b><span>Open site in OKX wallet</span></a>
        </div>
        <div class="walletSheetFoot">
          <button class="mini good" type="button" data-copy-dapp-url>Copy dApp URL</button>
          <button class="mini" type="button" data-share-support-link>Share Support Link</button>
        </div>
        <p class="walletSafety">Never enter seed phrases or private keys. Only connect through wallet apps you personally installed.</p>
      </div>`;
    document.body.appendChild(sheet);
    sheet.addEventListener("click", (e)=>{ if(e.target.matches("[data-wallet-close], .walletSheetBackdrop")) closeWalletSheet(); });
    return sheet;
  }
  function applyLinks(scope=document){
    const links = walletLinks(currentUrl());
    scope.querySelectorAll("[data-wallet-choice='metamask'], [data-wallet-open='metamask']").forEach(a=>a.href=links.metamask);
    scope.querySelectorAll("[data-wallet-choice='trust'], [data-wallet-open='trust']").forEach(a=>a.href=links.trust);
    scope.querySelectorAll("[data-wallet-choice='safepal'], [data-wallet-open='safepal']").forEach(a=>a.href=links.safepal);
    scope.querySelectorAll("[data-wallet-choice='okx'], [data-wallet-open='okx']").forEach(a=>a.href=links.okx);
  }
  function openWalletSheet(reason){
    const sheet = ensureSheet();
    applyLinks(sheet);
    sheet.classList.add("open");
    sheet.setAttribute("aria-hidden","false");
    document.body.style.overflow = "hidden";
    window.toast && window.toast(reason === "add-token" ? "Open in a wallet app to add BUV." : "Choose a wallet app to continue.");
  }
  function closeWalletSheet(){
    const sheet = document.getElementById("walletSheet");
    if(!sheet) return;
    sheet.classList.remove("open");
    sheet.setAttribute("aria-hidden","true");
    document.body.style.overflow = "";
  }
  async function copyText(text, msg){
    try{ await navigator.clipboard.writeText(text); }
    catch(_){ const t=document.createElement('textarea'); t.value=text; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); }
    window.toast && window.toast(msg || "Copied");
  }
  async function shareSupport(){
    const url = SUPPORT_URL;
    const data = { title:"Apply for Burnaverse Support", text:"Submit a Burnaverse Protocol support or partnership application.", url };
    if(navigator.share){ try{ await navigator.share(data); return; }catch(_){} }
    await copyText(url, "Support link copied");
  }
  function initSupportUtilities(){
    applyLinks(document);
    const linkText = document.getElementById("supportLinkText");
    if(linkText) linkText.textContent = SUPPORT_URL;
    const modalLinkText = document.getElementById("supportModalLinkText");
    if(modalLinkText) modalLinkText.textContent = SUPPORT_MODAL_URL;
    document.querySelectorAll("[data-copy-support-link]").forEach(btn=>btn.addEventListener("click", ()=>copyText(SUPPORT_URL, "Support link copied")));
    document.querySelectorAll("[data-copy-support-modal-link]").forEach(btn=>btn.addEventListener("click", ()=>copyText(SUPPORT_MODAL_URL, "Popup link copied")));
    document.querySelectorAll("[data-share-support-link]").forEach(btn=>btn.addEventListener("click", shareSupport));
    document.querySelectorAll("[data-copy-dapp-url]").forEach(btn=>btn.addEventListener("click", ()=>copyText(currentUrl(), "dApp URL copied")));
    const inline = document.getElementById("connectWalletInline");
    if(inline) inline.addEventListener("click", connectWallet);
    document.querySelectorAll("[data-fill-connected-wallet]").forEach(btn=>btn.addEventListener("click", ()=>{
      const field = document.getElementById("walletAddress");
      const saved = localStorage.getItem("bv_wallet") || "";
      if(field && saved){ field.value = saved; window.toast && window.toast("Connected wallet added"); }
      else { window.toast && window.toast("Connect wallet first"); }
    }));
    const form = document.getElementById("applyForm");
    if(form && !form.dataset.supportReady){
      form.dataset.supportReady = "1";
      form.addEventListener("submit", (e)=>{
        if(form.closest("#modalBack")) return; // modal handler will handle old embedded forms
        e.preventDefault();
        const data = Object.fromEntries(new FormData(form).entries());
        const key = "burnaverse_support_applications";
        let cur=[]; try{ cur=JSON.parse(localStorage.getItem(key)||"[]")||[]; }catch(_){ cur=[]; }
        cur.unshift({...data, url: currentUrl(), ts:new Date().toISOString()});
        localStorage.setItem(key, JSON.stringify(cur).slice(0,200000));
        form.reset();
        window.toast && window.toast("Application saved locally. Connect backend/email for live delivery.");
      }, {capture:true});
    }
  }
  window.BurnaverseWallets = { open: openWalletSheet, close: closeWalletSheet, links: walletLinks, applyLinks: applyLinks };
  document.addEventListener("DOMContentLoaded", initSupportUtilities);
})();


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
