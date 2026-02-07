'use strict';

/*
  MOB BR - ui_shop.core.js v17（フル / 統一仕様）

  修正（今回）：
  - 他UI（メンバー名ポップ等）と modalBack の z-index が干渉して
    「暗くなって押せない」を起こしていたため、
    shop用の z-index 強制を "ショップが開いている時だけ" に限定する（bodyクラスでスコープ）
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};

(function(){
  const $ = (id) => document.getElementById(id);

  const S  = window.MOBBR?.storage || null;
  const DP = window.MOBBR?.data?.player || null;

  const FALLBACK_KEYS = {
    gold: 'mobbr_gold',
    rank: 'mobbr_rank',
    recent: 'mobbr_recent',
    playerTeam: 'mobbr_playerTeam',
    m1: 'mobbr_m1',
    m2: 'mobbr_m2',
    m3: 'mobbr_m3'
  };
  const K = (S && S.KEYS) ? S.KEYS : FALLBACK_KEYS;

  function getNum(key, def){
    if (S?.getNum) return S.getNum(key, def);
    const v = Number(localStorage.getItem(key));
    return Number.isFinite(v) ? v : def;
  }
  function getStr(key, def){
    if (S?.getStr) return S.getStr(key, def);
    const v = localStorage.getItem(key);
    return (v === null || v === undefined || v === '') ? def : v;
  }
  function setNum(key, val){
    if (S?.setNum) return S.setNum(key, val);
    localStorage.setItem(key, String(Number(val)));
  }
  function setStr(key, val){
    if (S?.setStr) return S.setStr(key, val);
    localStorage.setItem(key, String(val));
  }

  // ===== constants =====
  const KEY_CDP = 'mobbr_cdp';
  const BODY_SHOP_CLASS = 'mobbrShopActive';

  // ===== DOM cache =====
  const dom = {
    screen: $('shopScreen'),
    close: $('btnCloseShop'),

    // meta
    shopGold: $('shopGold'),
    shopCDP: $('shopCDP'),

    // existing gacha DOM (index.html のまま)
    btnGacha1: $('btnGacha1'),
    btnGacha10: $('btnGacha10'),
    btnGachaSR: $('btnGachaSR'),
    shopResult: $('shopResult'),
    shopResultList: $('shopResultList'),
    btnShopOk: $('btnShopOk'),

    // shared back
    modalBack: $('modalBack')
  };

  // ===== style inject（CSS未追加でも最低限成立させる）=====
  let styleInjected = false;
  function injectStyle(){
    if (styleInjected) return;
    styleInjected = true;

    const st = document.createElement('style');
    st.id = 'shopCoreStyleV17';
    st.textContent = `
      /* =========================================================
         Z LAYER（事故防止）
         ★重要：modalBackのz-index強制は「ショップが開いている時だけ」
         他UIのポップと干渉しないように bodyクラスでスコープ化
      ========================================================= */
      body.${BODY_SHOP_CLASS} #modalBack { z-index: 9000 !important; }
      body.${BODY_SHOP_CLASS} #shopConfirmPop,
      body.${BODY_SHOP_CLASS} #shopMemberPickPop,
      body.${BODY_SHOP_CLASS} #shopResultPop { z-index: 10000 !important; }

      /* 上部の閉じるボタンが大きすぎる問題 */
      #shopScreen .teamCloseBtn,
      #shopScreen #btnCloseShop{
        padding: 10px 14px !important;
        border-radius: 14px !important;
        font-size: 16px !important;
        min-height: 44px !important;
        height: auto !important;
      }

      /* shop home */
      .shopHomeWrap{
        position: relative;
        width: 100%;
        max-width: 520px;
        margin: 10px auto 0;
        border-radius: 18px;
        overflow: hidden;
        background: rgba(0,0,0,.15);
        box-shadow: 0 12px 30px rgba(0,0,0,.35);
      }
      .shopHomeImg{
        display:block;
        width:100%;
        height:auto;
        user-select:none;
        -webkit-user-drag:none;
      }
      .shopHomeBtnGrid{
        position:absolute;
        left: 50%;
        top: 62%;
        transform: translate(-50%, -50%);
        width: 86%;
        display:grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        z-index: 5;
        pointer-events: auto;
      }
      .shopHomeBtn{
        border: 0;
        border-radius: 9999px;
        padding: 12px 10px;
        font-weight: 1000;
        font-size: 15px;
        line-height: 1;
        background: rgba(255,255,255,.92);
        box-shadow: 0 10px 18px rgba(0,0,0,.25);
      }
      .shopHomeBtn:active{ transform: translateY(1px); }
      .shopHomeBtn.isClose{
        background: rgba(255,255,255,.88);
        opacity: .95;
      }

      /* dynamic section */
      #shopDynamicSection .shopList{ display:flex; flex-direction:column; gap:10px; }
      #shopDynamicSection .shopRow{
        display:flex; justify-content:space-between; align-items:center;
        padding:12px 12px;
        border-radius:16px;
        background: rgba(255,255,255,.08);
        box-shadow: inset 0 0 0 1px rgba(255,255,255,.08);
      }
      #shopDynamicSection .shopRowLeft{ display:flex; flex-direction:column; gap:6px; }
      #shopDynamicSection .shopRowName{ font-weight:1000; }
      #shopDynamicSection .shopRowSub{ font-size:12px; opacity:.9; }
      #shopDynamicSection .shopRowRight{ display:flex; align-items:center; gap:10px; }
      #shopDynamicSection .shopPrice{ font-weight:1000; }
      #shopDynamicSection .shopBuyBtn{
        border:0; border-radius:9999px;
        padding:10px 14px; font-weight:1000;
        background: rgba(255,255,255,.92);
      }
      #shopDynamicSection .shopBuyBtn:disabled{ opacity:.45; }

      /* popups */
      .shopPop{
        position:fixed;
        left:50%; top:50%;
        transform:translate(-50%,-50%);
        width:min(92vw, 360px);
        background: rgba(25,25,25,.96);
        color:#fff;
        border-radius:18px;
        padding:14px 14px 16px;
        box-shadow: 0 20px 60px rgba(0,0,0,.6);
        display:none;
      }
      .shopPop.show{ display:block; }
      .shopPopTitle{ font-weight:1000; font-size:16px; margin-bottom:10px; }
      .shopPopText{ font-size:14px; opacity:.96; line-height:1.35; white-space:pre-wrap; }
      .shopPopActions{ margin-top:12px; display:flex; gap:10px; }
      .shopPopBtn{
        flex:1;
        border:0;
        border-radius:9999px;
        padding:12px 10px;
        font-weight:1000;
      }
      .shopPopBtnYes{ background: rgba(255,255,255,.92); }
      .shopPopBtnNo{ background: rgba(255,255,255,.22); color:#fff; }
      .memberPickList{ display:flex; gap:10px; margin-top:10px; }
      .memberPickBtn{
        flex:1; border:0; border-radius:9999px;
        padding:12px 10px; font-weight:1000;
        background: rgba(255,255,255,.92);
      }
      .shopResultBig{ margin-top:6px; font-weight:1000; font-size:15px; line-height:1.3; }
      .shopTiny{ margin-top:8px; font-size:12px; opacity:.9; white-space:pre-wrap; }
    `;
    document.head.appendChild(st);
  }

  // ===== modal back =====
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

  function setShopBodyActive(on){
    if (!document.body) return;
    if (on) document.body.classList.add(BODY_SHOP_CLASS);
    else document.body.classList.remove(BODY_SHOP_CLASS);
  }

  // ===== recent =====
  function setRecent(text){
    setStr(K.recent, text);
    if (window.MOBBR?.initMainUI) window.MOBBR.initMainUI();
  }

  // ===== money / cdp =====
  function fmtG(n){ return String(Number(n) || 0); }

  function getGold(){ return getNum(K.gold, 0); }
  function setGold(v){
    setNum(K.gold, v);
    renderMeta();
    if (window.MOBBR?.initMainUI) window.MOBBR.initMainUI();
  }
  function addGold(delta){ setGold(getGold() + (Number(delta) || 0)); }
  function spendGold(cost){
    const c = Number(cost) || 0;
    const g = getGold();
    if (g < c) return false;
    setGold(g - c);
    return true;
  }

  function getCDP(){ return getNum(KEY_CDP, 0); }
  function setCDP(v){
    setNum(KEY_CDP, v);
    renderMeta();
  }

  function renderMeta(){
    if (dom.shopGold) dom.shopGold.textContent = fmtG(getGold());
    if (dom.shopCDP) dom.shopCDP.textContent = fmtG(getCDP());
  }

  // ===== sections / containers =====
  let built = false;
  let gachaSection = null;
  let homeWrap = null;
  let dynWrap = null;

  function ensureContainers(){
    injectStyle();
    if (!dom.screen) return;

    const panel = dom.screen.querySelector('.teamPanel');
    if (!panel) return;

    if (built) return;

    const sections = Array.from(panel.querySelectorAll('.teamSection'));
    gachaSection = sections.find(s => s.querySelector('#btnGacha1')) || sections[0] || null;

    // ===== HOME（shop.png + 4 buttons） =====
    homeWrap = document.createElement('div');
    homeWrap.id = 'shopHomeWrap';
    homeWrap.className = 'shopHomeWrap';

    const img = document.createElement('img');
    img.className = 'shopHomeImg';
    img.src = 'shop.png';
    img.alt = 'SHOP';
    img.draggable = false;

    const grid = document.createElement('div');
    grid.className = 'shopHomeBtnGrid';

    const mkBtn = (text, cls, onClick) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `shopHomeBtn ${cls||''}`.trim();
      b.textContent = text;
      b.addEventListener('click', (e)=>{
        e.preventDefault();
        e.stopPropagation();
        onClick && onClick();
      });
      return b;
    };

    const b1 = mkBtn('1. 育成アイテム', '', ()=> hooks.openItemShop ? hooks.openItemShop() : setRecent('育成アイテム：未実装'));
    const b2 = mkBtn('2. カードガチャ', '', ()=> hooks.openGacha ? hooks.openGacha() : openGachaView());
    const b3 = mkBtn('3. コーチスキル', '', ()=> hooks.openCoachShop ? hooks.openCoachShop() : setRecent('コーチスキル：未実装'));
    const b4 = mkBtn('4. 閉じる', 'isClose', ()=> close());

    grid.appendChild(b1);
    grid.appendChild(b2);
    grid.appendChild(b3);
    grid.appendChild(b4);

    homeWrap.appendChild(img);
    homeWrap.appendChild(grid);

    // ===== DYNAMIC（育成/コーチ） =====
    dynWrap = document.createElement('div');
    dynWrap.id = 'shopDynamicSection';
    dynWrap.className = 'teamSection';
    dynWrap.style.display = 'none';

    const dynTitle = document.createElement('div');
    dynTitle.className = 'teamSectionTitle';
    dynTitle.id = 'shopDynamicTitle';
    dynTitle.textContent = '';

    const dynBody = document.createElement('div');
    dynBody.id = 'shopDynamicBody';

    dynWrap.appendChild(dynTitle);
    dynWrap.appendChild(dynBody);

    const meta = panel.querySelector('.teamMeta');
    if (meta && meta.parentElement === panel){
      if (meta.nextSibling) panel.insertBefore(homeWrap, meta.nextSibling);
      else panel.appendChild(homeWrap);
      panel.insertBefore(dynWrap, homeWrap.nextSibling);
    }else{
      panel.appendChild(homeWrap);
      panel.appendChild(dynWrap);
    }

    built = true;
  }

  function showHome(){
    ensureContainers();
    hideBack();

    if (homeWrap) homeWrap.style.display = '';
    if (dynWrap) dynWrap.style.display = 'none';
    if (gachaSection) gachaSection.style.display = 'none';
    if (dom.shopResult) dom.shopResult.style.display = 'none';

    const title = dom.screen?.querySelector('.teamTitle');
    if (title) title.textContent = 'ショップ';

    setRecent('ショップ：メニューを開いた');
  }

  function showDynamic(titleText){
    ensureContainers();
    hideBack();

    if (homeWrap) homeWrap.style.display = 'none';
    if (gachaSection) gachaSection.style.display = 'none';
    if (dom.shopResult) dom.shopResult.style.display = 'none';

    if (dynWrap) dynWrap.style.display = '';
    const t = $('shopDynamicTitle');
    const body = $('shopDynamicBody');
    if (t) t.textContent = titleText || '';
    if (body) body.innerHTML = '';

    const title = dom.screen?.querySelector('.teamTitle');
    if (title) title.textContent = titleText || 'ショップ';
  }

  function openGachaView(){
    ensureContainers();
    hideBack();

    if (homeWrap) homeWrap.style.display = 'none';
    if (dynWrap) dynWrap.style.display = 'none';

    if (gachaSection) gachaSection.style.display = '';
    if (dom.shopResult) dom.shopResult.style.display = 'none';

    const title = dom.screen?.querySelector('.teamTitle');
    if (title) title.textContent = 'ショップ（カードガチャ）';

    setRecent('ショップ：カードガチャを開いた');
  }

  // ===== popups =====
  let popConfirm = null;
  let popPick = null;
  let popResult = null;

  function ensurePopups(){
    injectStyle();

    if (!popConfirm){
      popConfirm = document.createElement('div');
      popConfirm.className = 'shopPop';
      popConfirm.id = 'shopConfirmPop';
      popConfirm.setAttribute('aria-hidden','true');

      const t = document.createElement('div');
      t.className = 'shopPopTitle';
      t.textContent = '確認';

      const tx = document.createElement('div');
      tx.className = 'shopPopText';
      tx.id = 'shopConfirmText';

      const act = document.createElement('div');
      act.className = 'shopPopActions';

      const yes = document.createElement('button');
      yes.type = 'button';
      yes.className = 'shopPopBtn shopPopBtnYes';
      yes.id = 'shopConfirmYes';
      yes.textContent = 'OK';

      const no = document.createElement('button');
      no.type = 'button';
      no.className = 'shopPopBtn shopPopBtnNo';
      no.id = 'shopConfirmNo';
      no.textContent = 'いいえ';

      act.appendChild(yes);
      act.appendChild(no);

      popConfirm.appendChild(t);
      popConfirm.appendChild(tx);
      popConfirm.appendChild(act);
      document.body.appendChild(popConfirm);
    }

    if (!popPick){
      popPick = document.createElement('div');
      popPick.className = 'shopPop';
      popPick.id = 'shopMemberPickPop';
      popPick.setAttribute('aria-hidden','true');

      const t = document.createElement('div');
      t.className = 'shopPopTitle';
      t.textContent = '使用するメンバーを選んでください';

      const list = document.createElement('div');
      list.className = 'memberPickList';
      list.id = 'shopMemberPickList';

      popPick.appendChild(t);
      popPick.appendChild(list);
      document.body.appendChild(popPick);
    }

    if (!popResult){
      popResult = document.createElement('div');
      popResult.className = 'shopPop';
      popResult.id = 'shopResultPop';
      popResult.setAttribute('aria-hidden','true');

      const t = document.createElement('div');
      t.className = 'shopPopTitle';
      t.textContent = '結果';

      const big = document.createElement('div');
      big.className = 'shopResultBig';
      big.id = 'shopResultBig';

      const tiny = document.createElement('div');
      tiny.className = 'shopTiny';
      tiny.id = 'shopResultTiny';

      const ok = document.createElement('button');
      ok.type = 'button';
      ok.className = 'shopPopBtn shopPopBtnYes';
      ok.id = 'shopResultOk';
      ok.textContent = 'OK';
      ok.style.marginTop = '12px';

      popResult.appendChild(t);
      popResult.appendChild(big);
      popResult.appendChild(tiny);
      popResult.appendChild(ok);
      document.body.appendChild(popResult);
    }
  }

  function closePop(pop){
    if (!pop) return;
    pop.classList.remove('show');
    pop.setAttribute('aria-hidden','true');
  }

  function closeAllPops(){
    if (popConfirm) closePop(popConfirm);
    if (popPick) closePop(popPick);
    if (popResult) closePop(popResult);
  }

  function openPop(pop){
    if (!pop) return;
    closeAllPops();
    showBack();
    pop.classList.add('show');
    pop.setAttribute('aria-hidden','false');
  }

  function closePopAndBack(pop){
    if (!pop) return;
    closePop(pop);
    const anyOpen =
      (popConfirm && popConfirm.classList.contains('show')) ||
      (popPick && popPick.classList.contains('show')) ||
      (popResult && popResult.classList.contains('show'));
    if (!anyOpen) hideBack();
  }

  function confirmPop(text, onYes){
    ensurePopups();
    const tx = $('shopConfirmText');
    if (tx) tx.textContent = text || '';

    const yes = $('shopConfirmYes');
    const no  = $('shopConfirmNo');

    if (yes){
      yes.onclick = () => {
        closePopAndBack(popConfirm);
        if (typeof onYes === 'function') onYes();
      };
    }
    if (no){
      no.onclick = () => closePopAndBack(popConfirm);
    }

    openPop(popConfirm);
  }

  function resultPop(bigText, tinyText, onOk){
    ensurePopups();
    const b = $('shopResultBig');
    const t = $('shopResultTiny');
    if (b) b.textContent = bigText || '';
    if (t) t.textContent = tinyText || '';

    const ok = $('shopResultOk');
    if (ok){
      ok.onclick = () => {
        closePopAndBack(popResult);
        if (typeof onOk === 'function') onOk();
      };
    }

    openPop(popResult);
  }

  function openMemberPick(onPick){
    ensurePopups();
    const list = $('shopMemberPickList');
    if (!list) return;

    const names = {
      A: getStr(K.m1,'A'),
      B: getStr(K.m2,'B'),
      C: getStr(K.m3,'C')
    };

    list.innerHTML = '';
    (['A','B','C']).forEach(id=>{
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'memberPickBtn';
      btn.textContent = names[id] || id;
      btn.addEventListener('click', ()=>{
        closePopAndBack(popPick);
        if (typeof onPick === 'function') onPick(id, names[id] || id);
      });
      list.appendChild(btn);
    });

    openPop(popPick);
  }

  // ===== gacha result list area (既存DOM) =====
  function showListResult(rows){
    if (!dom.shopResult || !dom.shopResultList) return;
    dom.shopResultList.innerHTML = '';

    (rows || []).forEach(r=>{
      const row = document.createElement('div');
      row.className = 'recordRow';
      row.style.display = 'flex';
      row.style.flexDirection = 'column';
      row.style.gap = '4px';

      const t = document.createElement('div');
      t.style.fontWeight = '1000';
      t.textContent = r.text;

      const s = document.createElement('div');
      s.style.fontSize = '12px';
      s.style.opacity = '0.92';
      s.textContent = r.sub || '';

      row.appendChild(t);
      if (r.sub) row.appendChild(s);

      dom.shopResultList.appendChild(row);
    });

    dom.shopResult.style.display = '';
  }

  // ===== registration hooks =====
  const hooks = {
    openItemShop: null,
    openCoachShop: null,
    openGacha: null
  };
  function registerCatalog(api){
    hooks.openItemShop  = api?.openItemShop  || hooks.openItemShop;
    hooks.openCoachShop = api?.openCoachShop || hooks.openCoachShop;
  }
  function registerGacha(api){
    hooks.openGacha = api?.openGacha || hooks.openGacha;
  }

  // ===== open/close =====
  function open(){
    ensureContainers();
    renderMeta();

    // shop専用z-index強制を有効化
    setShopBodyActive(true);

    hideBack();
    closeAllPops();
    if (dom.shopResult) dom.shopResult.style.display = 'none';

    if (dom.screen){
      dom.screen.classList.add('show');
      dom.screen.setAttribute('aria-hidden', 'false');
    }

    showHome();
  }

  function close(){
    closeAllPops();
    hideBack();

    if (dom.shopResult) dom.shopResult.style.display = 'none';
    if (gachaSection) gachaSection.style.display = 'none';
    if (dynWrap) dynWrap.style.display = 'none';
    if (homeWrap) homeWrap.style.display = 'none';

    if (dom.screen){
      dom.screen.classList.remove('show');
      dom.screen.setAttribute('aria-hidden', 'true');
    }

    // shop専用z-index強制を解除（他UIに干渉しない）
    setShopBodyActive(false);

    setRecent('ショップを閉じた');
  }

  // ===== bind =====
  let bound = false;
  function bind(){
    if (bound) return;
    bound = true;

    if (dom.close) dom.close.addEventListener('click', (e)=>{
      e.preventDefault();
      e.stopPropagation();
      close();
    });

    if (dom.modalBack){
      dom.modalBack.addEventListener('click', (e)=> e.preventDefault(), { passive:false });
    }

    if (dom.btnShopOk){
      dom.btnShopOk.addEventListener('click', (e)=>{
        e.preventDefault();
        e.stopPropagation();
        if (dom.shopResult) dom.shopResult.style.display = 'none';
      });
    }
  }

  function initShopUI(){
    bind();
    renderMeta();
  }

  window.MOBBR.initShopUI = initShopUI;
  window.MOBBR.ui.shop = { open, close, render: renderMeta };

  window.MOBBR.ui.shopCore = {
    VERSION: 'v17',
    dom, K, DP,

    fmtG,
    getGold, setGold, addGold, spendGold,
    getCDP, setCDP,
    renderMeta,

    showHome,
    showDynamic,
    openGachaView,

    confirmPop,
    resultPop,
    openMemberPick,

    showListResult,

    setRecent,

    registerCatalog,
    registerGacha,

    close
  };

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', initShopUI);
  }else{
    initShopUI();
  }
})();
