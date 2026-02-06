'use strict';

/*
  MOB BR - ui_shop.js v14（SSR最高レア版）

  役割：
  - ショップ画面の制御
  - 通常コレクションカードガチャ
    ・1回 / 10連
  - CP（カードポイント）蓄積
  - SR以上確定ガチャ（CP100消費）
  - 排出結果ログのみ（％や数値は表示しない）

  注意：
  - 所持カード一覧UIは別ファイル（ui_card.js）で実装
  - ここでは「引く」「保存」「ログ表示」まで
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
  const K_CARDS = 'mobbr_cards'; // 所持カード {id: count}
  const K_CP    = DC.CP.key;

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

  // ===== utils =====
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

  function getCP(){
    return Number(localStorage.getItem(K_CP)) || 0;
  }

  function addCP(n){
    const v = getCP() + n;
    localStorage.setItem(K_CP, String(v));
  }

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

  function addCard(card){
    const cards = getCards();
    const cur = cards[card.id] || 0;

    if (cur >= DC.BONUS[card.rarity].maxCount){
      // 11枚目以降 → G変換
      const g = DC.CONVERT_G[card.rarity];
      const gold = S.getNum(K.gold, 0);
      S.setNum(K.gold, gold + g);
      S.setStr(K.recent, `余剰カードがGに変換された（+${g}G）`);
    }else{
      cards[card.id] = cur + 1;
      setCards(cards);
    }
  }

  // ===== ガチャ処理 =====
  function gachaOnce(rateTable){
    const rarity = pickByRate(rateTable);
    const card = pickCard(rarity);
    addCard(card);
    return card;
  }

  function drawNormal(times){
    const result = [];
    for (let i=0;i<times;i++){
      result.push(gachaOnce(DC.GACHA_RATE_NORMAL));
    }
    addCP(times);
    return result;
  }

  function drawSRPlus(){
    const cp = getCP();
    if (cp < DC.CP.exchangeCost){
      alert('CPが足りません');
      return null;
    }
    localStorage.setItem(K_CP, String(cp - DC.CP.exchangeCost));
    return [ gachaOnce(DC.GACHA_RATE_SR_PLUS) ];
  }

  // ===== 表示 =====
  function showResult(cards, title){
    if (!dom.resultArea) return;

    dom.resultArea.style.display = 'block';
    dom.resultList.innerHTML = '';

    cards.forEach(c=>{
      const div = document.createElement('div');
      div.className = 'shopResultRow';
      div.textContent = `【${c.rarity}】${c.name} を獲得！`;
      dom.resultList.appendChild(div);
    });

    if (dom.btnOk){
      dom.btnOk.onclick = closeResult;
    }

    S.setStr(K.recent, title);
    if (window.MOBBR.initMainUI) window.MOBBR.initMainUI();
  }

  function closeResult(){
    if (dom.resultArea) dom.resultArea.style.display = 'none';
  }

  // ===== open / close =====
  function open(){
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

  // ===== bind =====
  function bind(){
    if (dom.btnShop) dom.btnShop.addEventListener('click', open);
    if (dom.btnClose) dom.btnClose.addEventListener('click', close);

    if (dom.btnGacha1){
      dom.btnGacha1.addEventListener('click', ()=>{
        const r = drawNormal(1);
        showResult(r, 'コレクションカードを1枚獲得！');
      });
    }

    if (dom.btnGacha10){
      dom.btnGacha10.addEventListener('click', ()=>{
        const r = drawNormal(10);
        showResult(r, 'コレクションカードを10枚獲得！');
      });
    }

    if (dom.btnGachaSR){
      dom.btnGachaSR.addEventListener('click', ()=>{
        const r = drawSRPlus();
        if (r){
          showResult(r, 'SR以上確定！コレクションカードを獲得！');
        }
      });
    }
  }

  function initShopUI(){
    bind();
  }

  window.MOBBR.initShopUI = initShopUI;
  window.MOBBR.ui.shop = { open, close };

  document.addEventListener('DOMContentLoaded', initShopUI);
})();
