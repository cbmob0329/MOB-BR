/* =========================
   ui_shop.gacha.js v17（フル）
   ※あなたが貼ってくれた内容を保持（ロジック削除なし）
   ※表示は core.showListResult が改善済み
========================= */
'use strict';

/*
  MOB BR - ui_shop.gacha.js v17（フル）

  修正（今回）：
  - data_cards.js の正しい読み方に統一（window.MOBBR.data.cards.getAll()）
  - 所持カードの保存キーを ui_card.js と統一：mobbr_cards
  - R/SR/SSR のみ前提（Nは使わない）
  - ガチャ後にカードコレクションを再描画（開いていなくても内部更新）
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};

(function(){
  const core = window.MOBBR?.ui?.shopCore || null;
  if (!core){
    console.warn('[ui_shop.gacha] ui_shop.core.js not found');
    return;
  }

  const dom = core.dom || {};

  // ===== 所持カード（コレクションと同じキー）=====
  const KEY_OWNED = 'mobbr_cards';

  // ===== 価格 =====
  const COST_1  = 100;   // 1回
  const COST_10 = 900;   // 10連
  const COST_SR_G = 0;   // SR以上確定：Gは取らない（CDP100のみ）

  // ===== CDP =====
  const SRPLUS_CDP_COST = 100;

  function readOwned(){
    try{
      const raw = localStorage.getItem(KEY_OWNED);
      return raw ? JSON.parse(raw) : {};
    }catch{
      return {};
    }
  }
  function writeOwned(obj){
    localStorage.setItem(KEY_OWNED, JSON.stringify(obj || {}));
  }

  function getCardsMaster(){
    const DC = window.MOBBR?.data?.cards || null;
    if (!DC || typeof DC.getAll !== 'function') return null;
    return DC;
  }

  function applyPriceLabels(){
    if (dom.btnGacha1)  dom.btnGacha1.textContent  = `1回引く（${COST_1}G）`;
    if (dom.btnGacha10) dom.btnGacha10.textContent = `10連（${COST_10}G）`;
    if (dom.btnGachaSR) dom.btnGachaSR.textContent = `SR以上確定（CDP${SRPLUS_CDP_COST}）`;
  }

  function buildPools(cards){
    const pools = { R:[], SR:[], SSR:[] };
    (cards || []).forEach(c=>{
      const r = String(c?.rarity || '').toUpperCase();
      if (r === 'SSR') pools.SSR.push(c);
      else if (r === 'SR') pools.SR.push(c);
      else if (r === 'R') pools.R.push(c);
    });
    return pools;
  }

  function pickFrom(arr){
    if (!arr || arr.length === 0) return null;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function pickRarityByRate(rateList){
    // rateList: [{rarity:'R', p:0.85}, ...]
    let sum = 0;
    (rateList || []).forEach(r => sum += (Number(r.p) || 0));
    if (sum <= 0) return 'R';

    let x = Math.random() * sum;
    for (const r of rateList){
      x -= (Number(r.p) || 0);
      if (x <= 0) return String(r.rarity || 'R').toUpperCase();
    }
    return String(rateList[rateList.length-1]?.rarity || 'R').toUpperCase();
  }

  function addOwnedCard(owned, card, convertTable){
    const id = String(card.id);
    const cur = Number(owned[id] || 0);

    if (cur >= 10){
      const rar = String(card.rarity || 'R').toUpperCase();
      const g = Number(convertTable?.[rar]) || 0;
      const converted = g > 0 ? g : 0;
      if (converted > 0) core.addGold(converted);
      return { kept:false, convertedG:converted, newCount:10 };
    }

    const next = cur + 1;
    owned[id] = next;
    return { kept:true, convertedG:0, newCount:next };
  }

  function refreshCardCollectionUI(){
    try{
      if (window.MOBBR?.ui?.card?.render) window.MOBBR.ui.card.render();
    }catch(e){}
  }

  function doGacha(times, mode){
    const DC = getCardsMaster();
    if (!DC){
      core.resultPop('カードデータが見つかりません', 'data_cards.js が読み込まれていません。', ()=>{});
      return;
    }

    const all = DC.getAll();
    if (!Array.isArray(all) || all.length === 0){
      core.resultPop('カードデータが見つかりません', 'data_cards.js の getAll() が空です。', ()=>{});
      return;
    }

    const pools = buildPools(all);
    if (pools.R.length === 0 && pools.SR.length === 0 && pools.SSR.length === 0){
      core.resultPop('カードデータが見つかりません', 'カード一覧の rarity を確認してください。', ()=>{});
      return;
    }

    const t = Number(times) || 1;
    const costG = (t === 10) ? COST_10 : COST_1;

    // 資源チェック
    if (mode === 'srplus'){
      const cdp = core.getCDP();
      if (cdp < SRPLUS_CDP_COST){
        core.resultPop('CDPが足りません', `SR以上確定はCDP${SRPLUS_CDP_COST}が必要です。`, ()=>{});
        return;
      }
      if (COST_SR_G > 0 && core.getGold() < COST_SR_G){
        core.resultPop('Gが足りません', '所持Gを確認してください。', ()=>{});
        return;
      }
    }else{
      if (core.getGold() < costG){
        core.resultPop('Gが足りません', '所持Gを確認してください。', ()=>{});
        return;
      }
    }

    const label =
      (mode === 'srplus')
        ? `SR以上確定を実行しますか？（CDP${SRPLUS_CDP_COST}${COST_SR_G ? ` / ${COST_SR_G}G` : ''}）`
        : `${costG}Gです。${t}回引きますか？`;

    core.confirmPop(label, ()=>{
      // 支払い
      if (mode === 'srplus'){
        core.setCDP(core.getCDP() - SRPLUS_CDP_COST);
        if (COST_SR_G > 0) core.spendGold(COST_SR_G);
      }else{
        core.spendGold(costG);
        core.setCDP(core.getCDP() + t); // 通常：引くたびCDP+1
      }

      const owned = readOwned();
      const rows = [];
      let convertedTotal = 0;

      const rateList =
        (mode === 'srplus')
          ? (DC.GACHA_RATE_SR_PLUS || [{rarity:'SR',p:0.8},{rarity:'SSR',p:0.2}])
          : (DC.GACHA_RATE_NORMAL || [{rarity:'R',p:0.85},{rarity:'SR',p:0.12},{rarity:'SSR',p:0.03}]);

      const convertTable = DC.CONVERT_G || {};

      const pickCardByRarity = (rar)=>{
        const r = String(rar || 'R').toUpperCase();
        if (r === 'SSR' && pools.SSR.length) return pickFrom(pools.SSR);
        if (r === 'SR'  && pools.SR.length)  return pickFrom(pools.SR);
        if (r === 'R'   && pools.R.length)   return pickFrom(pools.R);

        // フォールバック（そのレアが空だった場合）
        if (pools.SR.length) return pickFrom(pools.SR);
        if (pools.R.length)  return pickFrom(pools.R);
        if (pools.SSR.length) return pickFrom(pools.SSR);
        return null;
      };

      for (let i=0; i<t; i++){
        const rar = pickRarityByRate(rateList);
        const card = pickCardByRarity(rar);
        if (!card) continue;

        const res = addOwnedCard(owned, card, convertTable);
        if (!res.kept) convertedTotal += res.convertedG;

        rows.push({
          text: `【${String(card.rarity)}】 ${String(card.name)}`,
          sub: res.kept ? `所持：${res.newCount}/10` : `11枚目以降 → ${res.convertedG}G に変換`
        });
      }

      writeOwned(owned);

      core.showListResult(rows);
      core.renderMeta();
      refreshCardCollectionUI();

      core.setRecent(
        `ショップ：ガチャ${t}回${convertedTotal ? `（変換+${convertedTotal}G）` : ''}`
      );
    });
  }

  function openGacha(){
    core.openGachaView();
  }

  let bound = false;
  function bind(){
    if (bound) return;
    bound = true;

    applyPriceLabels();

    if (dom.btnGacha1){
      dom.btnGacha1.addEventListener('click', (e)=>{
        e.preventDefault();
        e.stopPropagation();
        doGacha(1, 'normal');
      });
    }
    if (dom.btnGacha10){
      dom.btnGacha10.addEventListener('click', (e)=>{
        e.preventDefault();
        e.stopPropagation();
        doGacha(10, 'normal');
      });
    }
    if (dom.btnGachaSR){
      dom.btnGachaSR.addEventListener('click', (e)=>{
        e.preventDefault();
        e.stopPropagation();
        doGacha(1, 'srplus');
      });
    }
  }

  function init(){
    bind();
    core.registerGacha({ openGacha });
    applyPriceLabels();
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  }else{
    init();
  }
})();
