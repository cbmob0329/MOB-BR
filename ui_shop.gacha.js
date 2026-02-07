'use strict';

/*
  MOB BR - ui_shop.gacha.js v17（フル）
  修正点（今回）：
  - 「カードデータが見つかりません」対策：
    data_cards.js は配列を直接公開しておらず window.MOBBR.data.cards.getAll() が正。
    → getAllCards() を getAll() 優先に修正。
  - レアリティは R / SR / SSR のみで運用（あなたのデータ仕様に合わせる）
    ※Nは使わない（データに存在しないため）
  - 排出率は data_cards.js の定義を優先（GACHA_RATE_NORMAL / GACHA_RATE_SR_PLUS）
    無い場合のみフォールバックの比率で動作。
  - confirm() は絶対に使わない（core.confirmPop に統一）
  - NEXT後の動的ロードでも必ず動くように init を「即実行」方式
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

  // ===== 11枚目以降のG変換（R/SR/SSRのみ）=====
  const CONVERT_G = { R:150, SR:500, SSR:1500 };

  // ===== フォールバック排出率（data_cards側が無い場合のみ）=====
  // 通常：R 85% / SR 12% / SSR 3%
  const FALLBACK_RATE_NORMAL = [
    { rarity:'R',   p:0.85 },
    { rarity:'SR',  p:0.12 },
    { rarity:'SSR', p:0.03 }
  ];
  // SR以上確定：SR 80% / SSR 20%
  const FALLBACK_RATE_SRPLUS = [
    { rarity:'SR',  p:0.80 },
    { rarity:'SSR', p:0.20 }
  ];

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

  // ===== data_cards.js 読み込み（getAll() 優先）=====
  function getCardsData(){
    return window.MOBBR?.data?.cards || null;
  }

  function getAllCards(){
    const dc = getCardsData();
    if (!dc) return [];

    // ★最優先：あなたの data_cards.js は getAll() が正
    if (typeof dc.getAll === 'function'){
      try{
        const arr = dc.getAll();
        return Array.isArray(arr) ? arr : [];
      }catch(e){
        console.warn('[ui_shop.gacha] dc.getAll() failed', e);
      }
    }

    // 互換（古い/別形式の保険）
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
    return 'R'; // Rのみ残す（Nは使わない）
  }

  function normCard(c){
    const id = c?.id ?? c?.cardId ?? c?.key ?? c?.code ?? null;
    if (!id) return null;

    const name = c?.name ?? c?.title ?? c?.label ?? String(id);
    const rarity = normRarity(c?.rarity ?? c?.rank ?? c?.rare);

    // data_cards.js は imagePath を持つ（cards/配下）
    const img =
      String(
        c?.imagePath ??
        c?.img ??
        c?.image ??
        c?.src ??
        c?.path ??
        ''
      );

    return { id:String(id), name:String(name), rarity, img };
  }

  function splitByRarity(cards){
    const by = { SSR:[], SR:[], R:[] };
    cards.forEach(c=>{
      const nc = normCard(c);
      if (!nc) return;
      if (nc.rarity === 'SSR') by.SSR.push(nc);
      else if (nc.rarity === 'SR') by.SR.push(nc);
      else by.R.push(nc);
    });
    return by;
  }

  function pickByRate(rateList){
    // rateList: [{rarity:'R'|'SR'|'SSR', p:0..1}, ...]
    let sum = 0;
    (rateList || []).forEach(o => sum += (Number(o?.p) || 0));
    if (sum <= 0) return 'R';

    let r = Math.random() * sum;
    for (const o of rateList){
      r -= (Number(o?.p) || 0);
      if (r <= 0) return String(o?.rarity || 'R');
    }
    return String(rateList[rateList.length-1]?.rarity || 'R');
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

  function getRates(mode){
    const dc = getCardsData();

    // data_cards.js 定義を優先
    if (dc){
      if (mode === 'srplus' && Array.isArray(dc.GACHA_RATE_SR_PLUS) && dc.GACHA_RATE_SR_PLUS.length){
        return dc.GACHA_RATE_SR_PLUS.map(o => ({ rarity: normRarity(o?.rarity), p: Number(o?.p)||0 }));
      }
      if (mode !== 'srplus' && Array.isArray(dc.GACHA_RATE_NORMAL) && dc.GACHA_RATE_NORMAL.length){
        return dc.GACHA_RATE_NORMAL.map(o => ({ rarity: normRarity(o?.rarity), p: Number(o?.p)||0 }));
      }
    }

    // フォールバック
    return (mode === 'srplus') ? FALLBACK_RATE_SRPLUS : FALLBACK_RATE_NORMAL;
  }

  function doGacha(times, mode){
    const pools = ensurePools();
    if (!pools){
      core.resultPop('カードデータが見つかりません', 'data_cards.js を確認してください（getAllの公開が必要）。', ()=>{});
      return;
    }

    // プールの健全性チェック（R/SR/SSRのみ）
    const hasAny = (pools.R.length + pools.SR.length + pools.SSR.length) > 0;
    if (!hasAny){
      core.resultPop('カードデータが空です', 'data_cards.js の CARDS 定義を確認してください。', ()=>{});
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

      const rates = getRates(mode);
      const owned = readOwned();
      const rows = [];
      let convertedTotal = 0;

      // rarity -> card pick（不足時は下位へ落とす）
      const pick = (rar)=>{
        if (rar === 'SSR'){
          if (pools.SSR.length) return pickRandomFrom(pools.SSR);
          rar = 'SR';
        }
        if (rar === 'SR'){
          if (pools.SR.length) return pickRandomFrom(pools.SR);
          rar = 'R';
        }
        if (pools.R.length) return pickRandomFrom(pools.R);

        // 最後の保険：どれか1枚
        const any = pools.SSR[0] || pools.SR[0] || pools.R[0] || null;
        return any;
      };

      for (let i=0; i<t; i++){
        const rar = pickByRate(rates);
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

  // ★NEXT後に動的ロードされても必ず init が動く
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  }else{
    init();
  }
})();
