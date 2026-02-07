'use strict';

/*
  MOB BR - ui_shop.js v15（SSR最高レア版 / CDP統一 / G消費あり）

  役割：
  - ショップ画面の制御（カードガチャのみ）
  - 通常コレクションカードガチャ：1回 / 10連（G消費あり）
  - CDP（カードポイント）蓄積：通常ガチャ1回ごとに +1（10連なら +10）
  - SR以上確定ガチャ：CDP100消費（G消費なし）
  - 排出結果ログ表示（確率・％は表示しない）

  前提：
  - storage.js 読み込み済み（window.MOBBR.storage）
  - data_cards.js 読み込み済み（window.MOBBR.data.cards）
  - index.html に shopScreen / btnGacha1 / btnGacha10 / btnGachaSR / shopResult 等のDOMが存在

  注意：
  - 所持カード一覧UIは ui_card.js 側
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};

(function(){
  const $ = (id) => document.getElementById(id);

  const S  = window.MOBBR?.storage;
  const DC = window.MOBBR?.data?.cards;

  if (!S || !DC){
    console.warn('[ui_shop] storage.js / data_cards.js not found');
    return;
  }

  const K = S.KEYS;

  // =========================
  // 設定：ガチャのGコスト（いつでも数字だけ変えられる）
  // =========================
  const COST_G = {
    one: 1000,
    ten: 10000
    // SR以上確定はCDPのみ消費（Gは0）
  };

  // =========================
  // localStorage keys
  // =========================
  const K_CARDS = 'mobbr_cards';   // 所持カード { id: count }
  const K_CDP   = 'mobbr_cdp';     // CDP（統一）

  // 旧キー互換（過去にCPで保存していた場合の救済）
  const K_OLD_CP = 'mobbr_cp';

  // =========================
  // DOM
  // =========================
  const dom = {
    btnShop: $('btnShop'),

    shopScreen: $('shopScreen'),
    btnClose: $('btnCloseShop'),

    // 表示（任意。なければ無視）
    shopGold: $('shopGold'),
    shopCDP: $('shopCDP'),

    // ガチャボタン
    btnGacha1: $('btnGacha1'),
    btnGacha10: $('btnGacha10'),
    btnGachaSR: $('btnGachaSR'),

    // 結果表示
    resultArea: $('shopResult'),
    resultList: $('shopResultList'),
    btnOk: $('btnShopOk')
  };

  // =========================
  // utils: storage
  // =========================
  function getOwnedCards(){
    try{
      return JSON.parse(localStorage.getItem(K_CARDS)) || {};
    }catch{
      return {};
    }
  }

  function setOwnedCards(obj){
    localStorage.setItem(K_CARDS, JSON.stringify(obj || {}));
  }

  function migrateCPtoCDPIfNeeded(){
    const hasCDP = localStorage.getItem(K_CDP) != null;
    const hasOld = localStorage.getItem(K_OLD_CP) != null;
    if (!hasCDP && hasOld){
      const v = Number(localStorage.getItem(K_OLD_CP)) || 0;
      localStorage.setItem(K_CDP, String(v));
      // 旧キーは残しても良いが混乱回避で削除
      localStorage.removeItem(K_OLD_CP);
    }
  }

  function getCDP(){
    migrateCPtoCDPIfNeeded();
    return Number(localStorage.getItem(K_CDP)) || 0;
  }

  function setCDP(v){
    migrateCPtoCDPIfNeeded();
    localStorage.setItem(K_CDP, String(Math.max(0, Number(v)||0)));
  }

  function addCDP(n){
    const v = getCDP() + (Number(n)||0);
    setCDP(v);
  }

  function getGold(){
    return S.getNum(K.gold, 0);
  }

  function setGold(v){
    S.setNum(K.gold, Math.max(0, Number(v)||0));
  }

  // =========================
  // utils: UI refresh
  // =========================
  function refreshTopUI(){
    if (window.MOBBR.initMainUI) window.MOBBR.initMainUI();
  }

  function refreshShopHeader(){
    if (dom.shopGold) dom.shopGold.textContent = `${getGold()}`;
    if (dom.shopCDP) dom.shopCDP.textContent = `${getCDP()}`;
  }

  function setRecent(text){
    S.setStr(K.recent, String(text || ''));
    refreshTopUI();
  }

  // =========================
  // gacha helpers
  // =========================
  function pickByRate(rateTable){
    // rateTable: [{rarity:'R', p:0.85}, ...] 合計1.0想定
    const r = Math.random();
    let acc = 0;
    for (const row of rateTable){
      acc += row.p;
      if (r <= acc) return row.rarity;
    }
    return rateTable[rateTable.length - 1]?.rarity || 'R';
  }

  function pickCard(rarity){
    const list = DC.listByRarity(rarity);
    const i = Math.floor(Math.random() * list.length);
    return list[i];
  }

  function addCardToInventory(card){
    const owned = getOwnedCards();
    const cur = owned[card.id] || 0;

    const rule = DC.BONUS?.[card.rarity];
    const maxCount = rule?.maxCount ?? 10;

    if (cur >= maxCount){
      // 11枚目以降 → G変換
      const g = DC.CONVERT_G?.[card.rarity] ?? 0;
      setGold(getGold() + g);

      // 中央ログ表示は別実装想定だが、最低限 recent に残す
      setRecent(`余剰カードがGに変換された（+${g}G）`);
      return { convertedG: g, added: false };
    }else{
      owned[card.id] = cur + 1;
      setOwnedCards(owned);
      return { convertedG: 0, added: true };
    }
  }

  function gachaOnce(rateTable){
    const rarity = pickByRate(rateTable);
    const card = pickCard(rarity);
    const info = addCardToInventory(card);
    return { card, info };
  }

  // =========================
  // draws
  // =========================
  function ensureGold(cost){
    const g = getGold();
    if (g < cost){
      alert('所持Gが足りません');
      return false;
    }
    return true;
  }

  function spendGold(cost){
    setGold(getGold() - cost);
  }

  function drawNormal(times){
    const cost = (times === 10) ? COST_G.ten : COST_G.one;
    if (!ensureGold(cost)) return null;

    // 先に消費（途中事故で無料にならないように）
    spendGold(cost);

    const results = [];
    let convertedTotal = 0;

    for (let i=0; i<times; i++){
      const r = gachaOnce(DC.GACHA_RATE_NORMAL);
      results.push(r.card);
      convertedTotal += (r.info?.convertedG || 0);
    }

    // CDP加算
    addCDP(times);

    // 表示更新
    refreshShopHeader();

    return { cards: results, convertedTotal, gainedCDP: times };
  }

  function drawSRPlus(){
    const cdp = getCDP();
    const need = DC.CP?.exchangeCost ?? 100;

    if (cdp < need){
      alert('CDPが足りません');
      return null;
    }

    // CDP消費（Gは消費しない）
    setCDP(cdp - need);

    const results = [];
    let convertedTotal = 0;

    const r = gachaOnce(DC.GACHA_RATE_SR_PLUS);
    results.push(r.card);
    convertedTotal += (r.info?.convertedG || 0);

    refreshShopHeader();

    return { cards: results, convertedTotal, spentCDP: need };
  }

  // =========================
  // result UI
  // =========================
  function showResult(payload, title){
    if (!dom.resultArea || !dom.resultList) return;

    dom.resultArea.style.display = 'block';
    dom.resultList.innerHTML = '';

    // タイトルはrecentに残す（文章演出）
    setRecent(title);

    // 取得一覧
    payload.cards.forEach(c=>{
      const div = document.createElement('div');
      div.className = 'shopResultRow';
      div.textContent = `【${c.rarity}】${c.name} を獲得！`;
      dom.resultList.appendChild(div);
    });

    // 追加情報（数値や確率は表示しない方針だが、CDPは仕様上UI表示OK）
    // ここは控えめに文字だけ
    const info = document.createElement('div');
    info.className = 'shopResultRow';
    info.style.opacity = '0.9';
    info.style.fontSize = '13px';
    info.style.marginTop = '10px';

    const parts = [];
    if (payload.gainedCDP){
      parts.push(`CDP +${payload.gainedCDP}`);
    }
    if (payload.spentCDP){
      parts.push(`CDP -${payload.spentCDP}`);
    }
    if (payload.convertedTotal){
      parts.push(`余剰→G変換あり`);
    }
    info.textContent = parts.length ? `（${parts.join(' / ')}）` : '';
    if (info.textContent) dom.resultList.appendChild(info);

    if (dom.btnOk){
      dom.btnOk.onclick = closeResult;
    }

    refreshShopHeader();
    refreshTopUI();
  }

  function closeResult(){
    if (dom.resultArea) dom.resultArea.style.display = 'none';
  }

  // =========================
  // open / close
  // =========================
  function open(){
    migrateCPtoCDPIfNeeded();
    refreshShopHeader();
    closeResult();

    if (dom.shopScreen){
      dom.shopScreen.classList.add('show');
      dom.shopScreen.setAttribute('aria-hidden', 'false');
    }else{
      setRecent('ショップを開いた');
    }
  }

  function close(){
    closeResult();
    if (dom.shopScreen){
      dom.shopScreen.classList.remove('show');
      dom.shopScreen.setAttribute('aria-hidden', 'true');
    }
  }

  // =========================
  // bind
  // =========================
  function bind(){
    if (dom.btnShop) dom.btnShop.addEventListener('click', open);
    if (dom.btnClose) dom.btnClose.addEventListener('click', close);

    if (dom.btnGacha1){
      dom.btnGacha1.addEventListener('click', ()=>{
        const payload = drawNormal(1);
        if (!payload) return;
        showResult(payload, 'コレクションカードを1枚獲得！');
      });
    }

    if (dom.btnGacha10){
      dom.btnGacha10.addEventListener('click', ()=>{
        const payload = drawNormal(10);
        if (!payload) return;
        showResult(payload, 'コレクションカードを10枚獲得！');
      });
    }

    if (dom.btnGachaSR){
      dom.btnGachaSR.addEventListener('click', ()=>{
        const payload = drawSRPlus();
        if (!payload) return;
        showResult(payload, 'SR以上確定！コレクションカードを獲得！');
      });
    }
  }

  function initShopUI(){
    bind();
  }

  window.MOBBR.initShopUI = initShopUI;
  window.MOBBR.ui.shop = { open, close, refreshShopHeader };

  document.addEventListener('DOMContentLoaded', initShopUI);
})();
