'use strict';

/*
  MOB BR - ui_shop.gacha.js v17（フル）
  - confirm() を絶対に使わない（core.confirmPop に統一）
  - 「2.カードガチャ」無反応を解消：core.openGachaView を必ず呼ぶ
  - ガチャボタンに価格表示を追加
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
  const KEY_OWNED = 'mobbr_cardsOwned';

  // ===== 価格 =====
  const COST_1  = 100;   // 1回
  const COST_10 = 900;   // 10連
  const COST_SR = 0;     // SR確定はCDP100消費（Gは取らない仕様のまま）

  // ===== 11枚目以降のG変換 =====
  const CONVERT_G = { N:50, R:150, SR:500, SSR:1500 };

  // ===== 内部比率（表示しない仕様）=====
  const WEIGHT = { SSR:2, SR:8, R:30, N:60 };
  const WEIGHT_SRPLUS = { SSR:20, SR:80 };

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

  function getAllCards(){
    const dc = window.MOBBR?.data?.cards || null;
    if (!dc) return [];

    const cand = dc.CARDS || dc.cards || dc.list || dc.LIST || dc.DATA || null;
    if (Array.isArray(cand)) return cand;

    if (cand && typeof cand === 'object'){
      const arr = Object.values(cand);
      return Array.isArray(arr) ? arr : [];
    }
    return [];
  }

  function normRarity(r){
    const s = String(r || '').toUpperCase();
    if (s.includes('SSR')) return 'SSR';
    if (s.includes('SR'))  return 'SR';
    if (s.includes('R'))   return 'R';
    return 'N';
  }

  function normCard(c){
    const id = c?.id ?? c?.cardId ?? c?.key ?? c?.code ?? null;
    if (!id) return null;

    const name = c?.name ?? c?.title ?? c?.label ?? String(id);
    const rarity = normRarity(c?.rarity ?? c?.rank ?? c?.rare);
    const img = String(c?.img ?? c?.image ?? c?.src ?? c?.path ?? '');

    return { id:String(id), name:String(name), rarity, img };
  }

  function splitByRarity(cards){
    const by = { SSR:[], SR:[], R:[], N:[] };
    cards.forEach(c=>{
      const nc = normCard(c);
      if (!nc) return;
      by[nc.rarity].push(nc);
    });
    return by;
  }

  function pickByWeight(weightMap){
    const entries = Object.entries(weightMap);
    let sum = 0;
    entries.forEach(([,w])=> sum += (Number(w)||0));
    let r = Math.random() * sum;
    for (const [k,w] of entries){
      r -= (Number(w)||0);
      if (r <= 0) return k;
    }
    return entries[entries.length-1]?.[0] || 'N';
  }

  function pickRandomFrom(arr){
    if (!arr || arr.length === 0) return null;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function ensurePools(){
    const cards = getAllCards().map(normCard).filter(Boolean);
    if (!cards.length) return null;
    return splitByRarity(cards);
  }

  function addOwnedCard(owned, card){
    const id = card.id;
    const cur = Number(owned[id] || 0);

    if (cur >= 10){
      const g = CONVERT_G[card.rarity] ?? 100;
      core.addGold(g);
      return { kept:false, convertedG:g, newCount:10 };
    }
    const next = cur + 1;
    owned[id] = next;
    return { kept:true, convertedG:0, newCount:next };
  }

  function applyPriceLabels(){
    if (dom.btnGacha1)  dom.btnGacha1.textContent  = `1回引く（${COST_1}G）`;
    if (dom.btnGacha10) dom.btnGacha10.textContent = `10連（${COST_10}G）`;
    if (dom.btnGachaSR) dom.btnGachaSR.textContent = `SR以上確定（CDP100）${COST_SR ? `（${COST_SR}G）` : ''}`;
  }

  function doGacha(times, mode){
    const pools = ensurePools();
    if (!pools){
      core.resultPop('カードデータが見つかりません', 'data_cards.js を確認してください。', ()=>{});
      return;
    }

    const t = Number(times) || 1;
    const cost = (t === 10) ? COST_10 : COST_1;

    // 資源チェック（ここで止める）
    if (mode === 'srplus'){
      const cdp = core.getCDP();
      if (cdp < 100){
        core.resultPop('CDPが足りません', 'SR以上確定はCDP100が必要です。', ()=>{});
        return;
      }
      if (COST_SR > 0 && core.getGold() < COST_SR){
        core.resultPop('Gが足りません', '所持Gを確認してください。', ()=>{});
        return;
      }
    }else{
      if (core.getGold() < cost){
        core.resultPop('Gが足りません', '所持Gを確認してください。', ()=>{});
        return;
      }
    }

    const label =
      (mode === 'srplus')
        ? `SR以上確定を実行しますか？（CDP100${COST_SR ? ` / ${COST_SR}G` : ''}）`
        : `${cost}Gです。${t}回引きますか？`;

    core.confirmPop(label, ()=>{
      // 支払い
      if (mode === 'srplus'){
        core.setCDP(core.getCDP() - 100);
        if (COST_SR > 0) core.spendGold(COST_SR);
      }else{
        core.spendGold(cost);
        core.setCDP(core.getCDP() + t); // 通常：引くたびCDP+1
      }

      const owned = readOwned();
      const rows = [];
      let convertedTotal = 0;

      const pick = (rar)=>{
        if (pools[rar] && pools[rar].length) return pickRandomFrom(pools[rar]);
        if (rar === 'SSR') return pick('SR');
        if (rar === 'SR')  return pick('R');
        if (rar === 'R')   return pick('N');
        return pickRandomFrom(pools.N) || null;
      };

      for (let i=0; i<t; i++){
        const rar = (mode === 'srplus') ? pickByWeight(WEIGHT_SRPLUS) : pickByWeight(WEIGHT);
        const card = pick(rar);
        if (!card) continue;

        const res = addOwnedCard(owned, card);
        if (!res.kept) convertedTotal += res.convertedG;

        rows.push({
          text: `[${card.rarity}] ${card.name}`,
          sub: res.kept ? `所持：${res.newCount}/10` : `11枚目以降 → ${res.convertedG}G に変換`
        });
      }

      writeOwned(owned);

      core.showListResult(rows);
      core.renderMeta();

      core.setRecent(
        `ショップ：ガチャ${t}回${convertedTotal ? `（変換+${convertedTotal}G）` : ''}`
      );
    });
  }

  // 「2.カードガチャ」が押された時に呼ばれる
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

  document.addEventListener('DOMContentLoaded', init);
})();
