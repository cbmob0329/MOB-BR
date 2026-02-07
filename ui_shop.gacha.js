'use strict';

/*
  MOB BR - ui_shop.gacha.js v17（フル）
  - カードガチャ部分のみ
  - 既存DOM（btnGacha1/10/SR, shopResultList）を使用
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};

(function(){
  const core = window.MOBBR?.ui?.shopCore;
  if (!core){
    console.warn('[ui_shop.gacha] shopCore not found');
    return;
  }

  const DC = window.MOBBR?.data?.cards || null;

  // ===== constants =====
  const GACHA_COST_1  = 1000;
  const GACHA_COST_10 = 9000;

  const KEY_OWNED_CARDS = 'mobbr_cards'; // { "c001": 2, ... }

  function readJSON(key, def){
    try{
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : def;
    }catch{
      return def;
    }
  }
  function writeJSON(key, obj){
    localStorage.setItem(key, JSON.stringify(obj));
  }

  function readOwnedCards(){ return readJSON(KEY_OWNED_CARDS, {}); }
  function writeOwnedCards(obj){ writeJSON(KEY_OWNED_CARDS, obj || {}); }

  function pickRandomCard(){
    let list = null;

    if (Array.isArray(DC?.ALL)) list = DC.ALL;
    else if (Array.isArray(DC?.all)) list = DC.all;
    else if (Array.isArray(DC?.LIST)) list = DC.LIST;
    else if (Array.isArray(DC?.list)) list = DC.list;
    else if (typeof DC?.getAll === 'function') list = DC.getAll();
    else if (typeof DC?.getList === 'function') list = DC.getList();

    if (!Array.isArray(list) || list.length === 0){
      return { id:'dummy', name:'カード', rarity:'R', img:null };
    }

    const weightByRarity = { N:70, R:22, SR:7, SSR:1 };
    const rarities = Object.keys(weightByRarity);
    const totalW = rarities.reduce((a,k)=>a+(weightByRarity[k]||0),0);

    let r = Math.random() * totalW;
    let pickR = 'R';
    for (const k of rarities){
      r -= (weightByRarity[k] || 0);
      if (r <= 0){ pickR = k; break; }
    }

    const pool = list.filter(c => (c.rarity || c.R || c.rare || c.rank) === pickR);
    const from = (pool.length ? pool : list);
    const c = from[Math.floor(Math.random() * from.length)];

    return {
      id: c.id || c.cardId || c.key || 'unknown',
      name: c.name || c.title || 'カード',
      rarity: c.rarity || c.R || c.rare || c.rank || 'R',
      img: c.img || c.image || c.src || null
    };
  }

  function convertDupToGold(rarity){
    const table = { N:50, R:100, SR:300, SSR:800 };
    return table[String(rarity || 'R')] ?? 100;
  }

  function addCardToOwned(card){
    const owned = readOwnedCards();
    const id = String(card.id);
    const cur = Number(owned[id]) || 0;
    const next = cur + 1;

    if (next <= 10){
      owned[id] = next;
      writeOwnedCards(owned);
      return { kept:true, count: next, convertedGold:0 };
    }

    owned[id] = 10;
    writeOwnedCards(owned);

    const g = convertDupToGold(card.rarity);
    core.addGold(g);
    return { kept:false, count: 10, convertedGold: g };
  }

  function doGacha(times, mode){
    const t = Number(times) || 1;

    if (mode === 'normal'){
      const cost = (t === 10) ? GACHA_COST_10 : GACHA_COST_1;
      if (!core.spendGold(cost)){
        core.resultPop('Gが足りません。', `必要：${cost}G`, ()=>{});
        return;
      }
      core.setCDP(core.getCDP() + t);
    }else if (mode === 'sr'){
      const cdp = core.getCDP();
      if (cdp < 100){
        core.resultPop('CDPが足りません。', 'SR以上確定にはCDP100が必要です。', ()=>{});
        return;
      }
      core.setCDP(cdp - 100);
    }

    const rows = [];
    let convertedSum = 0;

    for (let i=0; i<t; i++){
      let card = pickRandomCard();

      if (mode === 'sr'){
        let guard = 0;
        while (guard++ < 50){
          const rr = String(card.rarity || 'R');
          if (rr === 'SR' || rr === 'SSR') break;
          card = pickRandomCard();
        }
      }

      const add = addCardToOwned(card);
      convertedSum += add.convertedGold;

      const rarity = String(card.rarity || 'R');
      const name = String(card.name || 'カード');

      if (add.kept){
        rows.push({ text: `[${rarity}] ${name}（所持 ${add.count}/10）`, sub: '' });
      }else{
        rows.push({ text: `[${rarity}] ${name}（11枚目→G変換）`, sub: `+${add.convertedGold}G` });
      }
    }

    if (convertedSum > 0) core.setRecent(`ガチャ：重複をG変換（+${convertedSum}G）`);
    else core.setRecent(`ガチャ：${t}回引いた`);

    core.showListResult(rows);
    core.renderMeta();
  }

  function bindGachaButtons(){
    const dom = core.dom;

    if (dom.btnGacha1){
      dom.btnGacha1.addEventListener('click', ()=> doGacha(1, 'normal'));
    }
    if (dom.btnGacha10){
      dom.btnGacha10.addEventListener('click', ()=> doGacha(10, 'normal'));
    }
    if (dom.btnGachaSR){
      dom.btnGachaSR.addEventListener('click', ()=> doGacha(1, 'sr'));
    }
  }

  function openGacha(){
    core.showGachaSection();
    core.setRecent('ショップ：カードガチャを開いた');
  }

  // register
  core.registerGacha({ openGacha });

  document.addEventListener('DOMContentLoaded', ()=>{
    bindGachaButtons();
  });
})();
