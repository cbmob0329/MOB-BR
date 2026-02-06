'use strict';

/*
  MOB BR - ui_shop.js v14（SSR最高レア版 / CDP統一）

  役割：
  - ショップ画面の制御
  - 通常コレクションカードガチャ
    ・1回 / 10連
  - CDP（カードポイント）蓄積
  - SR以上確定ガチャ（CDP100消費）
  - 排出結果ログ（％や内部補正値は表示しない）
  - 11枚目以降は即G変換（結果内にも表示）

  重要：
  - 表記は CP ではなく CDP に統一
  - 旧キー mobbr_cp が残っていても初回のみ mobbr_cdp へ移行
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

  // ===== keys =====
  const K = S.KEYS;

  // 所持カード {id: count}
  const K_CARDS = 'mobbr_cards';

  // CDP 統一キー（新）
  const K_CDP = 'mobbr_cdp';
  // 旧キー（移行用）
  const K_CP_OLD = 'mobbr_cp';

  // ===== DOM（既存HTML前提）=====
  const dom = {
    btnShop: $('btnShop'),

    shopScreen: $('shopScreen'),          // あれば表示
    btnClose: $('btnCloseShop'),

    btnGacha1: $('btnGacha1'),
    btnGacha10: $('btnGacha10'),
    btnGachaSR: $('btnGachaSR'),

    resultArea: $('shopResult'),
    resultList: $('shopResultList'),
    btnOk: $('btnShopOk')
  };

  // =========================
  // storage helpers
  // =========================
  function getCards(){
    try{
      return JSON.parse(localStorage.getItem(K_CARDS)) || {};
    }catch{
      return {};
    }
  }

  function setCards(cards){
    localStorage.setItem(K_CARDS, JSON.stringify(cards));
  }

  function migrateCPtoCDPIfNeeded(){
    // 旧 mobbr_cp があり、新 mobbr_cdp が無い場合だけ移行
    const hasNew = localStorage.getItem(K_CDP);
    const oldRaw = localStorage.getItem(K_CP_OLD);
    if ((hasNew === null || hasNew === undefined) && oldRaw !== null && oldRaw !== undefined){
      const v = Number(oldRaw) || 0;
      localStorage.setItem(K_CDP, String(v));
      // 旧キーは残してもいいが、混乱防止で削除する
      localStorage.removeItem(K_CP_OLD);
    }
  }

  function getCDP(){
    migrateCPtoCDPIfNeeded();
    const v = Number(localStorage.getItem(K_CDP));
    return Number.isFinite(v) ? v : 0;
  }

  function setCDP(v){
    migrateCPtoCDPIfNeeded();
    localStorage.setItem(K_CDP, String(Math.max(0, Number(v)||0)));
  }

  function addCDP(n){
    const v = getCDP() + (Number(n)||0);
    setCDP(v);
  }

  // =========================
  // gacha helpers
  // =========================
  function pickByRate(rateTable){
    const r = Math.random();
    let acc = 0;
    for (const row of rateTable){
      acc += row.p;
      if (r <= acc) return row.rarity;
    }
    return rateTable[rateTable.length - 1].rarity;
  }

  function pickCard(rarity){
    const list = DC.listByRarity(rarity);
    const i = Math.floor(Math.random() * list.length);
    return list[i];
  }

  // 1枚加算（11枚目以降の変換含む）
  // 戻り値：{ card, converted:boolean, convertedG:number }
  function addCard(card){
    const cards = getCards();
    const cur = cards[card.id] || 0;

    const maxCount = DC.BONUS?.[card.rarity]?.maxCount ?? 10;

    if (cur >= maxCount){
      // 11枚目以降 → G変換
      const g = DC.CONVERT_G?.[card.rarity] ?? 0;
      const gold = S.getNum(K.gold, 0);
      S.setNum(K.gold, gold + g);

      return { card, converted:true, convertedG:g };
    }else{
      cards[card.id] = cur + 1;
      setCards(cards);
      return { card, converted:false, convertedG:0 };
    }
  }

  // =========================
  // draw
  // =========================
  function gachaOnce(rateTable){
    const rarity = pickByRate(rateTable);
    const card = pickCard(rarity);
    const added = addCard(card);
    return added;
  }

  function drawNormal(times){
    const addedList = [];
    let totalConvertedG = 0;
    let convertedCount = 0;

    for (let i=0;i<times;i++){
      const added = gachaOnce(DC.GACHA_RATE_NORMAL);
      addedList.push(added.card);

      if (added.converted){
        convertedCount++;
        totalConvertedG += added.convertedG;
      }
    }

    addCDP(times);

    return {
      cards: addedList,
      cdpGain: times,
      convertedCount,
      convertedG: totalConvertedG
    };
  }

  function drawSRPlus(){
    const cost = DC.CP?.exchangeCost ?? 100; // data_cards 側の値はそのまま利用
    const cdp = getCDP();
    if (cdp < cost){
      alert('CDPが足りません');
      return null;
    }

    setCDP(cdp - cost);

    const added = gachaOnce(DC.GACHA_RATE_SR_PLUS);

    return {
      cards: [added.card],
      cdpGain: 0,
      cdpSpend: cost,
      convertedCount: added.converted ? 1 : 0,
      convertedG: added.converted ? added.convertedG : 0
    };
  }

  // =========================
  // UI: result
  // =========================
  function showResult(payload, title){
    if (!dom.resultArea || !dom.resultList) return;

    dom.resultArea.style.display = 'block';
    dom.resultList.innerHTML = '';

    // タイトル行
    const top = document.createElement('div');
    top.className = 'shopResultTop';
    top.textContent = title;
    dom.resultList.appendChild(top);

    // カード行
    payload.cards.forEach(c=>{
      const div = document.createElement('div');
      div.className = 'shopResultRow';
      div.textContent = `【${c.rarity}】${c.name} を獲得！`;
      dom.resultList.appendChild(div);
    });

    // CDP増加/消費
    if (payload.cdpGain && payload.cdpGain > 0){
      const div = document.createElement('div');
      div.className = 'shopResultSub';
      div.textContent = `CDP +${payload.cdpGain}`;
      dom.resultList.appendChild(div);
    }
    if (payload.cdpSpend && payload.cdpSpend > 0){
      const div = document.createElement('div');
      div.className = 'shopResultSub';
      div.textContent = `CDP -${payload.cdpSpend}`;
      dom.resultList.appendChild(div);
    }

    // 変換ログ（あれば）
    if (payload.convertedCount > 0 && payload.convertedG > 0){
      const div1 = document.createElement('div');
      div1.className = 'shopResultSub';
      div1.textContent = '余剰カードがGに変換された！';
      dom.resultList.appendChild(div1);

      const div2 = document.createElement('div');
      div2.className = 'shopResultSub';
      div2.textContent = `+${payload.convertedG}G`;
      dom.resultList.appendChild(div2);

      // 中央ログにも残す（G変換だけ中央表示ルールに合わせる）
      S.setStr(K.recent, `余剰カードがGに変換された（+${payload.convertedG}G）`);
    }else{
      // 通常の最近ログ
      S.setStr(K.recent, title);
    }

    // OK
    if (dom.btnOk){
      dom.btnOk.onclick = closeResult;
    }

    // メイン画面更新
    if (window.MOBBR.initMainUI) window.MOBBR.initMainUI();
  }

  function closeResult(){
    if (dom.resultArea) dom.resultArea.style.display = 'none';
  }

  // =========================
  // open / close
  // =========================
  function open(){
    migrateCPtoCDPIfNeeded();
    if (dom.shopScreen){
      dom.shopScreen.classList.add('show');
    }else{
      S.setStr(K.recent, 'ショップを開いた');
      if (window.MOBBR.initMainUI) window.MOBBR.initMainUI();
    }
  }

  function close(){
    if (dom.shopScreen){
      dom.shopScreen.classList.remove('show');
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
        showResult(payload, 'コレクションカードを1枚獲得！');
      });
    }

    if (dom.btnGacha10){
      dom.btnGacha10.addEventListener('click', ()=>{
        const payload = drawNormal(10);
        showResult(payload, 'コレクションカードを10枚獲得！');
      });
    }

    if (dom.btnGachaSR){
      dom.btnGachaSR.addEventListener('click', ()=>{
        const payload = drawSRPlus();
        if (payload){
          showResult(payload, 'SR以上確定！コレクションカードを獲得！');
        }
      });
    }

    if (dom.btnOk){
      dom.btnOk.addEventListener('click', closeResult);
    }
  }

  function initShopUI(){
    bind();
  }

  window.MOBBR.initShopUI = initShopUI;
  window.MOBBR.ui.shop = { open, close };

  document.addEventListener('DOMContentLoaded', initShopUI);
})();
