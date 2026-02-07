'use strict';

/*
  MOB BR - ui_shop.core.js v17（フル）
  目的：
  - ui_shop を分割して1000行超えを回避
  - core：open/close、DOM、メニュー、popup、ストレージ/所持G/CDPなど共通を提供
  - gacha/catalog 側は core に登録して動く

  依存：
  - storage.js, data_player.js, data_cards.js（あれば）
  - index.html に #shopScreen と既存ガチャDOM
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

  // ===== shared back =====
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

  // ===== menu containers =====
  let menuBuilt = false;
  let elMenuWrap = null;
  let elSectionWrap = null;
  let gachaSection = null;

  function ensureShopUIContainers(){
    if (!dom.screen) return;

    const panel = dom.screen.querySelector('.teamPanel');
    if (!panel) return;
    if (menuBuilt) return;

    // ガチャセクション探す（btnGacha1 を含む teamSection）
    const sections = Array.from(panel.querySelectorAll('.teamSection'));
    gachaSection = sections.find(s => s.querySelector('#btnGacha1')) || sections[0] || null;

    elMenuWrap = document.createElement('div');
    elMenuWrap.className = 'teamSection';
    elMenuWrap.style.marginTop = '0px';

    const menuTitle = document.createElement('div');
    menuTitle.className = 'teamSectionTitle';
    menuTitle.textContent = 'メニュー';

    const menu = document.createElement('div');
    menu.id = 'shopMenu';

    elMenuWrap.appendChild(menuTitle);
    elMenuWrap.appendChild(menu);

    elSectionWrap = document.createElement('div');
    elSectionWrap.className = 'teamSection';
    elSectionWrap.id = 'shopDynamicSection';
    elSectionWrap.style.display = 'none';

    const dynTitle = document.createElement('div');
    dynTitle.className = 'teamSectionTitle';
    dynTitle.id = 'shopDynamicTitle';
    dynTitle.textContent = 'ショップ';

    const dynBody = document.createElement('div');
    dynBody.id = 'shopDynamicBody';

    elSectionWrap.appendChild(dynTitle);
    elSectionWrap.appendChild(dynBody);

    const head = panel.querySelector('.teamHead');
    const meta = panel.querySelector('.teamMeta');

    if (meta && meta.parentElement === panel){
      if (meta.nextSibling) panel.insertBefore(elMenuWrap, meta.nextSibling);
      else panel.appendChild(elMenuWrap);
      panel.insertBefore(elSectionWrap, elMenuWrap.nextSibling);
    }else if (head && head.parentElement === panel){
      panel.insertBefore(elMenuWrap, head.nextSibling);
      panel.insertBefore(elSectionWrap, elMenuWrap.nextSibling);
    }else{
      panel.insertBefore(elMenuWrap, panel.firstChild);
      panel.insertBefore(elSectionWrap, elMenuWrap.nextSibling);
    }

    buildMenuButtons(menu);

    menuBuilt = true;
  }

  function hideDynamicSection(){
    if (elSectionWrap) elSectionWrap.style.display = 'none';
    const body = $('shopDynamicBody');
    if (body) body.innerHTML = '';
    const title = $('shopDynamicTitle');
    if (title) title.textContent = '';
  }

  function showDynamicSection(titleText){
    if (elSectionWrap) elSectionWrap.style.display = '';
    const title = $('shopDynamicTitle');
    if (title) title.textContent = titleText || 'ショップ';
  }

  function showGachaSection(){
    hideDynamicSection();
    if (gachaSection) gachaSection.style.display = '';
    if (dom.shopResult) dom.shopResult.style.display = 'none';
  }

  function hideGachaSection(){
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
      t.id = 'shopConfirmTitle';
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
    const no = $('shopConfirmNo');

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

  // ===== result list (existing gacha result area) =====
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

  // ===== render meta =====
  function renderMeta(){
    if (dom.shopGold) dom.shopGold.textContent = fmtG(getGold());
    if (dom.shopCDP) dom.shopCDP.textContent = fmtG(getCDP());
  }

  // ===== menu buttons =====
  const hooks = {
    openItemShop: null,
    openCoachShop: null,
    openGacha: null
  };

  function buildMenuButtons(menuEl){
    menuEl.innerHTML = '';

    const makeBtn = (title, sub, onClick, extraClass='') => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `shopMenuBtn ${extraClass}`.trim();

      const t = document.createElement('div');
      t.className = 'shopMenuTitle';
      t.textContent = title;

      btn.appendChild(t);

      if (sub){
        const s = document.createElement('div');
        s.className = 'shopMenuSub';
        s.textContent = sub;
        btn.appendChild(s);
      }

      btn.addEventListener('click', onClick);
      menuEl.appendChild(btn);
    };

    makeBtn(
      '育成アイテム購入',
      '購入 → メンバー選択 → 能力EXP +5 → 結果 → 自動で閉じる',
      ()=> hooks.openItemShop ? hooks.openItemShop() : setRecent('育成アイテム：未実装（ui_shop.catalog.js）')
    );

    makeBtn(
      'カードガチャ',
      '既存ガチャUI（1回/10連/SR確定）',
      ()=> (hooks.openGacha ? hooks.openGacha() : showGachaSection())
    );

    makeBtn(
      'コーチスキル購入',
      '購入のみ（装備はチーム画面で後日）',
      ()=> hooks.openCoachShop ? hooks.openCoachShop() : setRecent('コーチスキル：未実装（ui_shop.catalog.js）')
    );

    makeBtn(
      '閉じる',
      '',
      ()=> close(),
      'isClose'
    );

    showGachaSection();
  }

  // ===== open/close =====
  function open(){
    ensureShopUIContainers();
    renderMeta();

    if (dom.shopResult) dom.shopResult.style.display = 'none';
    showGachaSection();

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
    hideDynamicSection();

    if (dom.shopResult) dom.shopResult.style.display = 'none';
    if (gachaSection) gachaSection.style.display = '';

    if (dom.screen){
      dom.screen.classList.remove('show');
      dom.screen.setAttribute('aria-hidden', 'true');
    }

    setRecent('ショップを閉じた');
  }

  // ===== bindings =====
  let bound = false;
  function bind(){
    if (bound) return;
    bound = true;

    if (dom.close) dom.close.addEventListener('click', close);

    // modalBack は押して閉じない
    if (dom.modalBack){
      dom.modalBack.addEventListener('click', (e)=> e.preventDefault(), { passive:false });
    }

    if (dom.btnShopOk){
      dom.btnShopOk.addEventListener('click', ()=>{
        if (dom.shopResult) dom.shopResult.style.display = 'none';
      });
    }
  }

  // ===== public registration API =====
  function registerCatalog(api){
    if (!api) return;
    hooks.openItemShop = api.openItemShop || hooks.openItemShop;
    hooks.openCoachShop = api.openCoachShop || hooks.openCoachShop;
  }
  function registerGacha(api){
    if (!api) return;
    hooks.openGacha = api.openGacha || hooks.openGacha;
  }

  function initShopUI(){
    bind();
    renderMeta();
    // containerは open 時に作る（shopScreenが無い環境でも落とさない）
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
    // sections
    showDynamicSection,
    hideDynamicSection,
    showGachaSection,
    hideGachaSection,
    // popups
    confirmPop,
    resultPop,
    openMemberPick,
    // result list (gacha)
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
