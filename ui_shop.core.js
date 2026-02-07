'use strict';

/*
  MOB BR - ui_shop.core.js v17（フル / shop.pngホーム+4ボタン版）

  目的：
  - shop.png を背景にした「ホームポップアップ」を表示
  - ホームに 4ボタン（育成アイテム/カードガチャ/コーチスキル/閉じる）
  - 選択後、各サブUI（catalog/gacha）へルーティング
  - confirm/result/memberPick を共通提供
  - modalBack の取り残し事故を防ぐ

  前提：
  - index.html に #shopScreen がある（現在の teamScreen構造でもOK）
  - 既存ガチャDOM（btnGacha1/10/SR, shopResult 等）は shopScreen 内に存在（今の仕様のまま）
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

  // ===== DOM =====
  const dom = {
    screen: $('shopScreen'),
    close: $('btnCloseShop'),

    // meta
    shopGold: $('shopGold'),
    shopCDP: $('shopCDP'),

    // gacha
    btnGacha1: $('btnGacha1'),
    btnGacha10: $('btnGacha10'),
    btnGachaSR: $('btnGachaSR'),

    // result area (existing)
    shopResult: $('shopResult'),
    shopResultList: $('shopResultList'),
    btnShopOk: $('btnShopOk'),

    // shared back
    modalBack: $('modalBack')
  };

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

  // ===== layout containers =====
  let built = false;
  let panel = null;
  let homeWrap = null;
  let homeButtons = null;

  let dynamicWrap = null;   // catalog etc
  let dynamicTitle = null;
  let dynamicBody = null;

  let gachaSection = null;  // existing section that contains btnGacha1
  let gachaHeadTitle = null;

  function ensureLayout(){
    if (!dom.screen) return;
    if (built) return;

    panel = dom.screen.querySelector('.teamPanel') || dom.screen;

    // existing gacha section
    const sections = Array.from(panel.querySelectorAll('.teamSection'));
    gachaSection = sections.find(s => s.querySelector('#btnGacha1')) || null;

    // ===== Home (shop.png + 4 buttons) =====
    homeWrap = document.createElement('div');
    homeWrap.id = 'shopHomeWrap';
    homeWrap.style.marginTop = '10px';
    homeWrap.style.borderRadius = '14px';
    homeWrap.style.overflow = 'hidden';
    homeWrap.style.position = 'relative';
    homeWrap.style.border = '1px solid rgba(255,255,255,.14)';
    homeWrap.style.background = 'rgba(255,255,255,.06)';

    const bg = document.createElement('img');
    bg.src = 'shop.png';
    bg.alt = 'SHOP';
    bg.draggable = false;
    bg.style.width = '100%';
    bg.style.height = 'auto';
    bg.style.display = 'block';
    bg.style.opacity = '0.98';

    const overlay = document.createElement('div');
    overlay.id = 'shopHomeOverlay';
    overlay.style.position = 'absolute';
    overlay.style.left = '0';
    overlay.style.top = '0';
    overlay.style.right = '0';
    overlay.style.bottom = '0';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.gap = '10px';
    overlay.style.padding = '14px';
    overlay.style.background = 'linear-gradient(to bottom, rgba(0,0,0,.35), rgba(0,0,0,.55))';

    const title = document.createElement('div');
    title.textContent = 'ショップ';
    title.style.fontWeight = '1000';
    title.style.fontSize = '18px';
    title.style.letterSpacing = '0.06em';
    title.style.marginBottom = '4px';

    homeButtons = document.createElement('div');
    homeButtons.id = 'shopHomeButtons';
    homeButtons.style.width = 'min(420px, 92%)';
    homeButtons.style.display = 'grid';
    homeButtons.style.gridTemplateColumns = '1fr 1fr';
    homeButtons.style.gap = '10px';

    overlay.appendChild(title);
    overlay.appendChild(homeButtons);

    homeWrap.appendChild(bg);
    homeWrap.appendChild(overlay);

    // ===== Dynamic section (catalog/coach lists etc) =====
    dynamicWrap = document.createElement('div');
    dynamicWrap.id = 'shopDynamicWrap';
    dynamicWrap.className = 'teamSection';
    dynamicWrap.style.display = 'none';

    dynamicTitle = document.createElement('div');
    dynamicTitle.className = 'teamSectionTitle';
    dynamicTitle.id = 'shopDynamicTitle';
    dynamicTitle.textContent = '';

    dynamicBody = document.createElement('div');
    dynamicBody.id = 'shopDynamicBody';

    dynamicWrap.appendChild(dynamicTitle);
    dynamicWrap.appendChild(dynamicBody);

    // Insert order: after .teamMeta (if exists) => homeWrap => dynamicWrap => (keep existing gacha section where it is)
    const meta = panel.querySelector('.teamMeta');
    if (meta && meta.parentElement === panel){
      if (meta.nextSibling) panel.insertBefore(homeWrap, meta.nextSibling);
      else panel.appendChild(homeWrap);

      panel.insertBefore(dynamicWrap, homeWrap.nextSibling);
    }else{
      panel.insertBefore(homeWrap, panel.firstChild);
      panel.insertBefore(dynamicWrap, homeWrap.nextSibling);
    }

    // rename shop head title if exists (optional)
    gachaHeadTitle = panel.querySelector('#shopScreen .teamTitle');

    // build home buttons
    buildHomeButtons();

    built = true;
  }

  function makeHomeBtn(text, onClick){
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'saveBtn';
    btn.style.width = '100%';
    btn.style.padding = '12px 10px';
    btn.style.fontWeight = '1000';
    btn.textContent = text;
    btn.addEventListener('click', onClick);
    return btn;
  }

  // Hooks registered by other modules
  const hooks = {
    openItemShop: null,
    openCoachShop: null,
    openGacha: null
  };

  function buildHomeButtons(){
    if (!homeButtons) return;
    homeButtons.innerHTML = '';

    homeButtons.appendChild(makeHomeBtn('1. 育成アイテム', ()=>{
      hideBack(); // 念のため
      if (hooks.openItemShop) hooks.openItemShop();
      else setRecent('育成アイテム：ui_shop.catalog.js が未読み込み');
    }));

    homeButtons.appendChild(makeHomeBtn('2. カードガチャ', ()=>{
      hideBack();
      if (hooks.openGacha) hooks.openGacha();
      else openGachaView();
    }));

    homeButtons.appendChild(makeHomeBtn('3. コーチスキル', ()=>{
      hideBack();
      if (hooks.openCoachShop) hooks.openCoachShop();
      else setRecent('コーチスキル：ui_shop.catalog.js が未読み込み');
    }));

    homeButtons.appendChild(makeHomeBtn('4. 閉じる', ()=>{
      close();
    }));
  }

  // ===== view switching =====
  function showHome(){
    ensureLayout();
    renderMeta();

    if (homeWrap) homeWrap.style.display = '';
    hideDynamic();
    hideGacha();

    if (gachaHeadTitle) gachaHeadTitle.textContent = 'ショップ';
  }

  function showDynamic(titleText){
    ensureLayout();
    if (homeWrap) homeWrap.style.display = 'none';

    if (dynamicWrap) dynamicWrap.style.display = '';
    if (dynamicTitle) dynamicTitle.textContent = titleText || '';
    if (dynamicBody) dynamicBody.innerHTML = '';

    hideGacha();

    if (gachaHeadTitle) gachaHeadTitle.textContent = titleText || 'ショップ';
  }

  function hideDynamic(){
    if (dynamicWrap) dynamicWrap.style.display = 'none';
    if (dynamicBody) dynamicBody.innerHTML = '';
    if (dynamicTitle) dynamicTitle.textContent = '';
  }

  function openGachaView(){
    ensureLayout();
    renderMeta();

    if (homeWrap) homeWrap.style.display = 'none';
    hideDynamic();
    showGacha();

    if (gachaHeadTitle) gachaHeadTitle.textContent = 'ショップ（カードガチャ）';
    setRecent('ショップ：カードガチャを開いた');
  }

  function showGacha(){
    if (gachaSection) gachaSection.style.display = '';
  }
  function hideGacha(){
    if (gachaSection) gachaSection.style.display = 'none';
    if (dom.shopResult) dom.shopResult.style.display = 'none';
  }

  // ===== popups =====
  let popConfirm = null;
  let popPick = null;
  let popResult = null;

  function ensurePopups(){
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
      yes.textContent = 'はい';

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
      ok.style.marginTop = '14px';
      ok.id = 'shopResultOk';
      ok.textContent = 'OK';

      popResult.appendChild(t);
      popResult.appendChild(big);
      popResult.appendChild(tiny);
      popResult.appendChild(ok);
      document.body.appendChild(popResult);
    }
  }

  function openPop(pop){
    if (!pop) return;
    showBack();
    pop.classList.add('show');
    pop.setAttribute('aria-hidden','false');
  }
  function closePop(pop){
    if (!pop) return;
    pop.classList.remove('show');
    pop.setAttribute('aria-hidden','true');
    hideBack();
  }

  function confirmPop(text, onYes){
    ensurePopups();
    const tx = $('shopConfirmText');
    if (tx) tx.textContent = text;

    const yes = $('shopConfirmYes');
    const no  = $('shopConfirmNo');

    if (yes){
      yes.onclick = () => {
        closePop(popConfirm);
        if (typeof onYes === 'function') onYes();
      };
    }
    if (no){
      no.onclick = () => closePop(popConfirm);
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
        closePop(popResult);
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
        closePop(popPick);
        if (typeof onPick === 'function') onPick(id, names[id] || id);
      });
      list.appendChild(btn);
    });

    openPop(popPick);
  }

  // ===== existing gacha result list =====
  function showListResult(rows){
    if (!dom.shopResult || !dom.shopResultList) return;
    dom.shopResultList.innerHTML = '';

    rows.forEach(r=>{
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

  // ===== registration =====
  function registerCatalog(api){
    if (!api) return;
    hooks.openItemShop  = api.openItemShop  || hooks.openItemShop;
    hooks.openCoachShop = api.openCoachShop || hooks.openCoachShop;
  }
  function registerGacha(api){
    if (!api) return;
    hooks.openGacha = api.openGacha || hooks.openGacha;
  }

  // ===== open/close =====
  function open(){
    ensureLayout();
    renderMeta();

    // 保険：透明フタ事故
    hideBack();

    if (dom.shopResult) dom.shopResult.style.display = 'none';

    // homeを最初に出す
    showHome();

    if (dom.screen){
      dom.screen.classList.add('show');
      dom.screen.setAttribute('aria-hidden', 'false');
    }

    setRecent('ショップを開いた');
  }

  function close(){
    // popups close
    if (popConfirm) closePop(popConfirm);
    if (popPick) closePop(popPick);
    if (popResult) closePop(popResult);

    hideBack();

    // view reset
    hideDynamic();
    if (homeWrap) homeWrap.style.display = '';
    hideGacha();

    if (dom.shopResult) dom.shopResult.style.display = 'none';

    if (dom.screen){
      dom.screen.classList.remove('show');
      dom.screen.setAttribute('aria-hidden', 'true');
    }

    setRecent('ショップを閉じた');
  }

  // ===== binding =====
  let bound = false;
  function bind(){
    if (bound) return;
    bound = true;

    if (dom.close) dom.close.addEventListener('click', close);

    // modalBack は押して閉じない
    if (dom.modalBack){
      dom.modalBack.addEventListener('click', (e)=> e.preventDefault(), { passive:false });
    }

    // gacha result close
    if (dom.btnShopOk){
      dom.btnShopOk.addEventListener('click', ()=>{
        if (dom.shopResult) dom.shopResult.style.display = 'none';
      });
    }
  }

  function initShopUI(){
    bind();
    renderMeta();
    // layoutは open 時に作る
  }

  // expose
  window.MOBBR.initShopUI = initShopUI;
  window.MOBBR.ui.shop = { open, close, render: renderMeta };

  // core API
  window.MOBBR.ui.shopCore = {
    VERSION: 'v17',
    dom,
    K,
    DP,
    // meta
    fmtG,
    getGold, setGold, addGold, spendGold,
    getCDP, setCDP,
    renderMeta,
    // view
    showHome,
    showDynamic,
    openGachaView,
    // popups
    confirmPop,
    resultPop,
    openMemberPick,
    // gacha result list
    showListResult,
    // recent
    setRecent,
    // registration
    registerCatalog,
    registerGacha,
    // close
    close
  };

  document.addEventListener('DOMContentLoaded', initShopUI);
})();
