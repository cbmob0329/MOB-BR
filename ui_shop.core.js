/* =========================
   ui_shop.core.js v17（フル）
   - 分割：ui_shop.core / ui_shop.gacha / ui_shop.catalog 前提
   - 見切れ対策：パネル内スクロール + safe-area + 下余白
   - 結果が分かる：ガチャ結果を「結果画面」で一覧表示（スクロール可）
   - confirm()禁止：confirmPop/resultPop を提供
   - modalBack 制御をここに統一（押せなくなる事故を防止）
========================= */
'use strict';

window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};

(function(){
  const APP_VER = 17;

  // ===== Storage Keys（他UIと合わせる）=====
  const K = {
    gold: 'mobbr_gold',
    cdp: 'mobbr_cdp',
    recent: 'mobbr_recent',

    playerTeam: 'mobbr_playerTeam',
    m1: 'mobbr_m1',
    m2: 'mobbr_m2',
    m3: 'mobbr_m3',
  };

  // ===== Data provider fallback（catalogが参照する）=====
  const DP = window.MOBBR?.DP || window.MOBBR?.dataPlayer || window.MOBBR?.data?.player || null;

  const $ = (id) => document.getElementById(id);

  function getNum(key, def){
    const v = Number(localStorage.getItem(key));
    return Number.isFinite(v) ? v : def;
  }
  function setNum(key, val){ localStorage.setItem(key, String(Number(val))); }
  function getStr(key, def){
    const v = localStorage.getItem(key);
    return (v === null || v === undefined || v === '') ? def : v;
  }
  function setStr(key, val){ localStorage.setItem(key, String(val)); }

  function fmtG(n){
    const x = Number(n) || 0;
    return x.toLocaleString('ja-JP');
  }

  // ===== DOM =====
  const dom = {
    shopScreen: null,
    btnCloseShop: null,

    // meta
    shopGold: null,
    shopCDP: null,

    // gacha buttons (HTML固定)
    btnGacha1: null,
    btnGacha10: null,
    btnGachaSR: null,

    // sections
    secGacha: null,
    secResult: null,
    resultList: null,
    btnResultOk: null,

    // shared
    modalBack: null
  };

  // ===== runtime UI elements (generated) =====
  let injected = false;
  let popWrap = null;      // confirm/result/member pick overlay
  let popTitle = null;
  let popSub = null;
  let popBody = null;
  let popBtnA = null;
  let popBtnB = null;

  // catalog dynamic list area
  let dynWrap = null;
  let dynTitle = null;
  let dynBody = null;

  function collectDom(){
    dom.shopScreen = $('shopScreen');
    dom.btnCloseShop = $('btnCloseShop');

    dom.shopGold = $('shopGold');
    dom.shopCDP = $('shopCDP');

    dom.btnGacha1 = $('btnGacha1');
    dom.btnGacha10 = $('btnGacha10');
    dom.btnGachaSR = $('btnGachaSR');

    dom.secResult = $('shopResult');
    dom.resultList = $('shopResultList');
    dom.btnResultOk = $('btnShopOk');

    dom.modalBack = $('modalBack');

    // 1個目の teamSection を gacha とみなす（HTMLのまま）
    if (dom.shopScreen){
      const secs = dom.shopScreen.querySelectorAll('.teamSection');
      dom.secGacha = secs && secs[0] ? secs[0] : null;
    }
  }

  // ===== CSS injection（追加ファイル不要）=====
  function injectCSS(){
    if (injected) return;
    injected = true;

    const css = document.createElement('style');
    css.type = 'text/css';
    css.textContent = `
/* shop core injected */
#shopScreen .teamPanel{
  max-height: calc(100vh - 28px - env(safe-area-inset-top) - env(safe-area-inset-bottom));
  overflow: auto;
  -webkit-overflow-scrolling: touch;
  padding-bottom: calc(18px + env(safe-area-inset-bottom));
}
#shopScreen .teamPanel::-webkit-scrollbar{ width: 0; height: 0; }

#shopScreen .shopMetaChips{
  display:grid;
  gap:10px;
  margin-top:10px;
}
#shopScreen .shopChip{
  display:flex;
  align-items:center;
  justify-content:flex-start;
  gap:12px;
  padding:12px 14px;
  border-radius:16px;
  background: rgba(0,0,0,.22);
  border: 1px solid rgba(255,255,255,.12);
}
#shopScreen .shopChipIcon{
  min-width:44px;
  height:28px;
  border-radius:999px;
  display:flex;
  align-items:center;
  justify-content:center;
  font-weight:900;
  letter-spacing:.02em;
  font-size:13px;
  opacity:.95;
}
#shopScreen .shopChipIcon.g{ background: rgba(255,190,60,.18); border:1px solid rgba(255,190,60,.25); }
#shopScreen .shopChipIcon.c{ background: rgba(80,180,255,.16); border:1px solid rgba(80,180,255,.25); }
#shopScreen .shopChipVal{
  font-weight:900;
  font-size:18px;
}
#shopScreen .shopChipSub{
  opacity:.8;
  font-size:12px;
  margin-left:auto;
}

#shopScreen .shopBtns{
  display:grid;
  gap:12px;
  margin-top:10px;
}
#shopScreen .shopBtnBig{
  width:100%;
  border-radius:18px;
  padding:16px 14px;
  font-weight:900;
  letter-spacing:.03em;
}

#shopScreen .shopResultListX{
  display:grid;
  gap:10px;
}
#shopScreen .shopResultRow{
  padding:12px 12px;
  border-radius:14px;
  background: rgba(0,0,0,.22);
  border:1px solid rgba(255,255,255,.12);
}
#shopScreen .shopResultTop{
  display:flex;
  align-items:center;
  gap:10px;
}
#shopScreen .shopBadge{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  min-width:48px;
  height:26px;
  border-radius:999px;
  font-weight:900;
  font-size:12px;
  letter-spacing:.02em;
  border:1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.06);
}
#shopScreen .shopBadge.r{ border-color: rgba(255,210,80,.25); background: rgba(255,210,80,.10); }
#shopScreen .shopBadge.sr{ border-color: rgba(120,210,255,.25); background: rgba(120,210,255,.10); }
#shopScreen .shopBadge.ssr{ border-color: rgba(255,120,200,.25); background: rgba(255,120,200,.10); }

#shopScreen .shopResultName{
  font-weight:900;
  line-height:1.2;
}
#shopScreen .shopResultSub{
  opacity:.82;
  font-size:12px;
  margin-top:6px;
  line-height:1.35;
}

/* popup */
.mobbrShopPopBack{
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.55);
  z-index: 9998;
  display:none;
}
.mobbrShopPop{
  position: fixed;
  left: 50%;
  top: 50%;
  transform: translate(-50%,-50%);
  width: min(92vw, 520px);
  border-radius: 18px;
  background: rgba(20,22,28,.92);
  border: 1px solid rgba(255,255,255,.12);
  box-shadow: 0 18px 60px rgba(0,0,0,.55);
  z-index: 9999;
  display:none;
  overflow:hidden;
}
.mobbrShopPopInner{
  padding: 14px 14px 12px;
}
.mobbrShopPopTitle{
  font-weight: 900;
  font-size: 16px;
  line-height: 1.25;
}
.mobbrShopPopSub{
  margin-top: 8px;
  opacity: .85;
  font-size: 13px;
  line-height: 1.35;
}
.mobbrShopPopBody{
  margin-top: 10px;
  display:grid;
  gap:10px;
}
.mobbrShopPopBtns{
  display:flex;
  gap:10px;
  padding: 12px 14px 14px;
  border-top: 1px solid rgba(255,255,255,.10);
  background: rgba(0,0,0,.12);
}
.mobbrShopPopBtns button{
  flex:1;
  border-radius: 14px;
  padding: 12px 10px;
  font-weight: 900;
}
.mobbrShopPopBtns .danger{
  background: rgba(255,80,120,.14);
  border:1px solid rgba(255,80,120,.22);
}
.mobbrShopPopBtns .primary{
  background: rgba(120,210,255,.14);
  border:1px solid rgba(120,210,255,.22);
}
.mobbrShopPickBtn{
  width:100%;
  border-radius:14px;
  padding:12px 12px;
  font-weight:900;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
}
.mobbrShopPickBtn span{ opacity:.9; font-weight:700; font-size:12px; }
`;
    document.head.appendChild(css);
  }

  // ===== modalBack control =====
  function showBack(){
    if (!dom.modalBack) return;
    dom.modalBack.style.display = 'block';
    dom.modalBack.style.pointerEvents = 'auto';
    dom.modalBack.setAttribute('aria-hidden', 'false');
  }
  function hideBack(){
    if (!dom.modalBack) return;
    dom.modalBack.style.display = 'none';
    dom.modalBack.style.pointerEvents = 'none';
    dom.modalBack.setAttribute('aria-hidden', 'true');
  }

  // ===== Popups (confirm / result / pick) =====
  function ensurePop(){
    if (popWrap) return;

    injectCSS();

    const back = document.createElement('div');
    back.className = 'mobbrShopPopBack';
    back.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); }, { passive:false });

    const pop = document.createElement('div');
    pop.className = 'mobbrShopPop';

    const inner = document.createElement('div');
    inner.className = 'mobbrShopPopInner';

    popTitle = document.createElement('div');
    popTitle.className = 'mobbrShopPopTitle';
    popSub = document.createElement('div');
    popSub.className = 'mobbrShopPopSub';
    popBody = document.createElement('div');
    popBody.className = 'mobbrShopPopBody';

    inner.appendChild(popTitle);
    inner.appendChild(popSub);
    inner.appendChild(popBody);

    const btns = document.createElement('div');
    btns.className = 'mobbrShopPopBtns';

    popBtnA = document.createElement('button');
    popBtnA.type = 'button';
    popBtnA.className = 'danger';
    popBtnA.textContent = 'キャンセル';

    popBtnB = document.createElement('button');
    popBtnB.type = 'button';
    popBtnB.className = 'primary';
    popBtnB.textContent = 'OK';

    btns.appendChild(popBtnA);
    btns.appendChild(popBtnB);

    pop.appendChild(inner);
    pop.appendChild(btns);

    document.body.appendChild(back);
    document.body.appendChild(pop);

    popWrap = { back, pop };
  }

  function closePop(){
    if (!popWrap) return;
    popWrap.back.style.display = 'none';
    popWrap.pop.style.display = 'none';
    popTitle.textContent = '';
    popSub.textContent = '';
    popBody.innerHTML = '';
    popBtnA.onclick = null;
    popBtnB.onclick = null;
    hideBack();
  }

  function openPop(title, sub){
    ensurePop();
    popTitle.textContent = title || '';
    popSub.textContent = sub || '';
    popBody.innerHTML = '';
    popWrap.back.style.display = 'block';
    popWrap.pop.style.display = 'block';
    showBack();
  }

  function confirmPop(text, onYes){
    openPop('確認', String(text || ''));
    popBtnA.textContent = 'やめる';
    popBtnB.textContent = 'OK';

    popBtnA.onclick = () => closePop();
    popBtnB.onclick = () => {
      closePop();
      try{ onYes && onYes(); }catch(e){ console.error(e); }
    };
  }

  function resultPop(title, sub, onOk){
    openPop(String(title || '結果'), String(sub || ''));
    popBtnA.style.display = 'none';
    popBtnB.textContent = 'OK';

    popBtnB.onclick = () => {
      closePop();
      try{ onOk && onOk(); }catch(e){ console.error(e); }
    };

    // Aボタンを隠した分、Bを全幅に
    popBtnB.style.flex = '1';
  }

  function openMemberPick(onPick){
    openPop('メンバー選択', '対象のメンバーを選んでください');
    popBtnA.style.display = 'inline-flex';
    popBtnA.textContent = '戻る';
    popBtnB.textContent = '閉じる';

    popBody.innerHTML = '';

    const team = readPlayerTeam();
    const members = (team?.members || []).slice().sort((a,b)=>(a.slot||0)-(b.slot||0));

    members.forEach((m)=>{
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mobbrShopPickBtn';
      const name = String(m.name || m.id || '');
      btn.innerHTML = `<div>${name}</div><span>選択</span>`;
      btn.addEventListener('click', (e)=>{
        e.preventDefault();
        e.stopPropagation();
        const id = String(m.id || '');
        closePop();
        try{ onPick && onPick(id, name); }catch(err){ console.error(err); }
      });
      popBody.appendChild(btn);
    });

    popBtnA.onclick = () => closePop();
    popBtnB.onclick = () => closePop();
  }

  // ===== Screen open/close =====
  function openScreen(){
    if (!dom.shopScreen) return;
    dom.shopScreen.classList.add('show');
    dom.shopScreen.setAttribute('aria-hidden', 'false');
    showBack(); // 画面外クリック事故防止（背面UIを押せなくする）
  }
  function closeScreen(){
    if (!dom.shopScreen) return;
    dom.shopScreen.classList.remove('show');
    dom.shopScreen.setAttribute('aria-hidden', 'true');
    closePop();
    hideBack();
  }

  // ===== PlayerTeam =====
  function readPlayerTeam(){
    try{
      const raw = localStorage.getItem(K.playerTeam);
      const team = raw ? JSON.parse(raw) : null;
      if (team && Array.isArray(team.members)) return team;
    }catch(e){}

    // fallback
    return {
      members:[
        { id:'A', slot:1, name:getStr(K.m1,'A') },
        { id:'B', slot:2, name:getStr(K.m2,'B') },
        { id:'C', slot:3, name:getStr(K.m3,'C') }
      ]
    };
  }

  // ===== Gold / CDP =====
  function getGold(){ return getNum(K.gold, 0); }
  function setGold(v){ setNum(K.gold, Math.max(0, Number(v)||0)); renderMeta(); }
  function addGold(n){ setGold(getGold() + (Number(n)||0)); }
  function spendGold(n){
    const cost = Number(n)||0;
    const cur = getGold();
    if (cur < cost) return false;
    setGold(cur - cost);
    return true;
  }

  function getCDP(){ return getNum(K.cdp, 0); }
  function setCDP(v){ setNum(K.cdp, Math.max(0, Number(v)||0)); renderMeta(); }

  function setRecent(text){
    setStr(K.recent, String(text||''));
    // mainのログ表示は ui_main が render で拾う（安全にイベントも投げる）
    try{
      window.dispatchEvent(new CustomEvent('mobbr:recent', { detail:{ text:String(text||'') } }));
    }catch(e){}
    try{
      if (window.MOBBR?.initMainUI) window.MOBBR.initMainUI();
    }catch(e){}
  }

  // ===== layout / view helpers =====
  function renderMeta(){
    if (dom.shopGold) dom.shopGold.textContent = String(getGold());
    if (dom.shopCDP) dom.shopCDP.textContent = String(getCDP());

    // metaの見栄え（HTMLは変えず、動的にチップを追加）
    const meta = dom.shopScreen ? dom.shopScreen.querySelector('.teamMeta') : null;
    if (!meta) return;

    // 既に差し込んでいたら更新だけ
    let chips = meta.querySelector('.shopMetaChips');
    if (!chips){
      chips = document.createElement('div');
      chips.className = 'shopMetaChips';

      const chipG = document.createElement('div');
      chipG.className = 'shopChip';
      chipG.innerHTML = `
        <div class="shopChipIcon g">G</div>
        <div class="shopChipVal" id="shopGoldChip">0</div>
        <div class="shopChipSub">所持G</div>
      `;

      const chipC = document.createElement('div');
      chipC.className = 'shopChip';
      chipC.innerHTML = `
        <div class="shopChipIcon c">CDP</div>
        <div class="shopChipVal" id="shopCDPChip">0</div>
        <div class="shopChipSub">ポイント</div>
      `;

      chips.appendChild(chipG);
      chips.appendChild(chipC);

      // 元のテキストの下に入れる
      meta.appendChild(chips);
    }

    const gEl = meta.querySelector('#shopGoldChip');
    const cEl = meta.querySelector('#shopCDPChip');
    if (gEl) gEl.textContent = fmtG(getGold());
    if (cEl) cEl.textContent = fmtG(getCDP());
  }

  function hideResult(){
    if (dom.secResult) dom.secResult.style.display = 'none';
  }
  function showResult(){
    if (dom.secResult) dom.secResult.style.display = 'block';
  }

  // ===== Result list (gacha) =====
  function showListResult(rows){
    // rows: [{text, sub}]
    if (!dom.resultList) return;

    // 見切れ対策：結果は必ず独立画面でスクロール
    hideDynamic();
    showResult();

    dom.resultList.innerHTML = '';
    dom.resultList.classList.add('shopResultListX');

    (rows || []).forEach(r=>{
      const text = String(r?.text || '');
      const sub  = String(r?.sub || '');

      // 【SSR】 などを抽出
      let rar = '';
      const m = text.match(/^【(SSR|SR|R)】\s*(.*)$/i);
      if (m){
        rar = String(m[1]||'').toUpperCase();
      }
      const name = m ? String(m[2]||'') : text;

      const row = document.createElement('div');
      row.className = 'shopResultRow';

      const top = document.createElement('div');
      top.className = 'shopResultTop';

      const badge = document.createElement('div');
      badge.className = 'shopBadge ' + (rar ? rar.toLowerCase() : 'r');
      badge.textContent = rar || 'R';

      const nm = document.createElement('div');
      nm.className = 'shopResultName';
      nm.textContent = name;

      top.appendChild(badge);
      top.appendChild(nm);

      const subEl = document.createElement('div');
      subEl.className = 'shopResultSub';
      subEl.textContent = sub;

      row.appendChild(top);
      if (sub) row.appendChild(subEl);

      dom.resultList.appendChild(row);
    });

    // OK
    if (dom.btnResultOk){
      dom.btnResultOk.onclick = (e)=>{
        e.preventDefault();
        e.stopPropagation();
        showHome();
      };
    }
  }

  // ===== Dynamic catalog view =====
  function ensureDynamicArea(){
    if (dynWrap) return;
    if (!dom.shopScreen) return;

    const panel = dom.shopScreen.querySelector('.teamPanel');
    if (!panel) return;

    dynWrap = document.createElement('div');
    dynWrap.style.display = 'none';
    dynWrap.style.marginTop = '10px';

    dynTitle = document.createElement('div');
    dynTitle.className = 'teamSectionTitle';
    dynTitle.textContent = 'ショップ';

    dynBody = document.createElement('div');
    dynBody.id = 'shopDynamicBody';

    dynWrap.appendChild(dynTitle);
    dynWrap.appendChild(dynBody);

    // gachaセクションの直後に差し込む
    if (dom.secGacha && dom.secGacha.parentNode){
      dom.secGacha.parentNode.insertBefore(dynWrap, dom.secGacha.nextSibling);
    }else{
      panel.appendChild(dynWrap);
    }
  }

  function showDynamic(title){
    ensureDynamicArea();
    hideResult();
    if (dom.secGacha) dom.secGacha.style.display = 'none';
    if (dynWrap){
      dynWrap.style.display = 'block';
      dynTitle.textContent = String(title || 'ショップ');
      dynBody.innerHTML = '';
    }
  }

  function hideDynamic(){
    if (dynWrap) dynWrap.style.display = 'none';
  }

  function openGachaView(){
    hideResult();
    hideDynamic();
    if (dom.secGacha) dom.secGacha.style.display = 'block';

    // gachaボタンの見栄え（CSSだけ）
    if (dom.secGacha){
      const row = dom.secGacha.querySelector('.saveRow');
      if (row) row.classList.add('shopBtns');
      if (dom.btnGacha1)  dom.btnGacha1.classList.add('shopBtnBig');
      if (dom.btnGacha10) dom.btnGacha10.classList.add('shopBtnBig');
      if (dom.btnGachaSR) dom.btnGachaSR.classList.add('shopBtnBig');
    }
  }

  // ===== Home menu =====
  let gachaApi = null;
  let catalogApi = null;

  function registerGacha(api){ gachaApi = api || null; }
  function registerCatalog(api){ catalogApi = api || null; }

  function showHome(){
    // 結果・動的ページを閉じて、ガチャ画面を標準表示
    hideResult();
    hideDynamic();
    openGachaView();
    renderMeta();
  }

  // ===== Public Shop API for ui_main =====
  function open(){
    if (!dom.shopScreen) collectDom();
    injectCSS();
    openScreen();
    renderMeta();
    showHome();
    setRecent('ショップ：カードガチャを開いた');
  }

  // ===== Bind =====
  let bound = false;
  function bind(){
    if (bound) return;
    bound = true;

    // close btn
    if (dom.btnCloseShop){
      dom.btnCloseShop.addEventListener('click', (e)=>{
        e.preventDefault();
        e.stopPropagation();
        closeScreen();
      });
    }

    // result OK
    if (dom.btnResultOk){
      dom.btnResultOk.addEventListener('click', (e)=>{
        e.preventDefault();
        e.stopPropagation();
        showHome();
      });
    }

    // iOSでの誤タップ伝播を止める
    if (dom.shopScreen){
      dom.shopScreen.addEventListener('click', (e)=>{
        // 何もしない：背面クリックの事故を避ける
      }, { passive:true });
    }
  }

  function initShopUI(){
    collectDom();
    injectCSS();
    bind();
    ensureDynamicArea();

    // shop open hook（ui_main が open() を優先して呼べる）
    window.MOBBR.ui.shop = window.MOBBR.ui.shop || {};
    window.MOBBR.ui.shop.open = open;

    // core API export
    window.MOBBR.ui.shopCore = {
      K, DP, dom,
      fmtG,

      // money/cdp
      getGold, setGold, addGold, spendGold,
      getCDP, setCDP,

      // ui
      open, close: closeScreen,
      renderMeta,
      setRecent,

      // popups
      confirmPop,
      resultPop,
      openMemberPick,

      // views
      showHome,
      openGachaView,
      showDynamic,
      showListResult,

      // register
      registerGacha,
      registerCatalog
    };

    // 起動直後にmeta更新だけ（画面は閉じたまま）
    renderMeta();
  }

  // expose for app.js v17
  window.MOBBR.initShopUI = initShopUI;

  // dynamic loadでも確実に初期化
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', initShopUI);
  }else{
    initShopUI();
  }
})();
