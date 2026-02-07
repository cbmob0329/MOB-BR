'use strict';

/*
  MOB BR - ui_shop.gacha.js v17（フル / 修正版）

  修正内容：
  - ブラウザ標準 confirm() を一切使わない（バグ原因）
  - shopCore.confirmPop/resultPop に統一（暗くなるだけ問題も回避）
  - クリック無反応/二重反応対策：stopPropagation + preventDefault
  - ガチャボタンの横に「値段表示」を追加（ボタン文言に追記）
  - 既存仕様：CDP加算 / 同名10枚まで / 11枚目以降はG変換 / 結果表示

  依存：
  - ui_shop.core.js（window.MOBBR.ui.shopCore）
  - data_cards.js（カード定義があればそれを使う）
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

  // ===== ガチャ価格（ここを変えればOK）=====
  const COST_1  = 100;   // 1回
  const COST_10 = 900;   // 10連
  // SR確定は「CDP100消費」でGは取らない仕様のまま（必要ならここで加算）
  const COST_SR = 0;

  // ===== 11枚目以降のG変換（ここを変えればOK）=====
  const CONVERT_G = {
    N:   50,
    R:  150,
    SR: 500,
    SSR:1500
  };

  // ===== 通常ガチャの出現比（％表示はしない：内部のみ）=====
  // ※確率を表示しない仕様なので、ここは“内部処理”として固定
  const WEIGHT = {
    SSR: 2,
    SR:  8,
    R:  30,
    N:  60
  };

  // SR以上確定時の比率（内部のみ）
  const WEIGHT_SRPLUS = {
    SSR: 20,
    SR:  80
  };

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

  // ===== data_cards からカード配列を取得（複数形に対応）=====
  function getAllCards(){
    const dc = window.MOBBR?.data?.cards || null;
    if (!dc) return [];

    // よくある候補を全部見る
    const cand =
      dc.CARDS ||
      dc.cards ||
      dc.list ||
      dc.LIST ||
      dc.DATA ||
      null;

    if (Array.isArray(cand)) return cand;

    // object map の場合
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
    // id/name/img/rarity を揃える（元データの形式が多少違っても動くように）
    const id =
      c?.id ??
      c?.cardId ??
      c?.key ??
      c?.code ??
      null;

    const name =
      c?.name ??
      c?.title ??
      c?.label ??
      (id ? String(id) : 'CARD');

    const rarity =
      normRarity(c?.rarity ?? c?.rank ?? c?.rare);

    const img =
      c?.img ??
      c?.image ??
      c?.src ??
      c?.path ??
      '';

    if (!id) return null;
    return { id:String(id), name:String(name), rarity, img:String(img||'') };
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

  function ensureCards(){
    const cards = getAllCards().map(normCard).filter(Boolean);
    if (cards.length === 0) return null;
    return splitByRarity(cards);
  }

  function addOwnedCard(owned, card){
    const id = card.id;
    const cur = Number(owned[id] || 0);

    // 10枚まで有効、11枚目以降はG変換（10に固定）
    if (cur >= 10){
      const g = CONVERT_G[card.rarity] ?? 100;
      core.addGold(g);
      return { kept:false, convertedG:g, newCount:10 };
    }

    const next = cur + 1;
    owned[id] = next;

    // 11枚目に到達した瞬間もG変換したいならここを変えるが、
    // 仕様文「11枚目以降」でOKなので、10超のときのみ変換にしている
    return { kept:true, convertedG:0, newCount:next };
  }

  // ===== ボタンに「価格」を表示する =====
  function applyPriceLabels(){
    if (dom.btnGacha1)  dom.btnGacha1.textContent  = `1回引く（${COST_1}G）`;
    if (dom.btnGacha10) dom.btnGacha10.textContent = `10連（${COST_10}G）`;
    if (dom.btnGachaSR) dom.btnGachaSR.textContent = `SR以上確定（CDP100）${COST_SR ? `（${COST_SR}G）` : ''}`;
  }

  // ===== ガチャ本体 =====
  function doGacha(times, mode){
    // mode: 'normal' | 'srplus'
    const pool = ensureCards();
    if (!pool){
      core.resultPop('カードデータが見つかりません', 'data_cards.js を確認してください。', ()=>{});
      return;
    }

    // コスト処理
    const cost = (times === 10) ? COST_10 : COST_1;
    if (mode === 'srplus'){
      // CDP100消費
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

    // 確認（custom popup）
    const label =
      (mode === 'srplus')
        ? `SR以上確定を実行しますか？（CDP100${COST_SR ? ` / ${COST_SR}G` : ''}）`
        : `${cost}Gです。${times}回引きますか？`;

    core.confirmPop(label, ()=>{
      // 実行
      if (mode === 'srplus'){
        core.setCDP(core.getCDP() - 100);
        if (COST_SR > 0) core.spendGold(COST_SR);
      }else{
        core.spendGold(cost);
      }

      // CDP加算（通常ガチャのみ）
      if (mode === 'normal'){
        core.setCDP(core.getCDP() + times);
      }

      const owned = readOwned();

      const rows = [];
      let convertedTotal = 0;

      for (let i=0; i<times; i++){
        let rar;
        if (mode === 'srplus'){
          rar = pickByWeight(WEIGHT_SRPLUS);
        }else{
          rar = pickByWeight(WEIGHT);
        }

        // そのレアリティのカードが空なら下位に落とす
        const pick = (r)=>{
          if (pool[r] && pool[r].length) return pickRandomFrom(pool[r]);
          if (r === 'SSR') return pick('SR');
          if (r === 'SR')  return pick('R');
          if (r === 'R')   return pick('N');
          return pickRandomFrom(pool.N) || null;
        };

        const card = pick(rar);
        if (!card) continue;

        const res = addOwnedCard(owned, card);
        if (!res.kept) convertedTotal += res.convertedG;

        const tag = card.rarity;
        const sub = res.kept
          ? `所持：${res.newCount}/10`
          : `11枚目以降 → ${res.convertedG}G に変換`;

        rows.push({ text: `[${tag}] ${card.name}`, sub });
      }

      writeOwned(owned);

      // 結果表示（既存の結果枠を使用）
      core.showListResult(rows);

      const extra =
        (mode === 'srplus')
          ? 'SR以上確定を実行した'
          : `${times}回ガチャを引いた`;

      core.setRecent(`ショップ：${extra}${convertedTotal ? `（変換+${convertedTotal}G）` : ''}`);
      core.renderMeta();
    });
  }

  // ===== shop home から呼ばれる「カードガチャを開く」 =====
  function openGacha(){
    core.openGachaView();
  }

  // ===== bind =====
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

    // core に登録（2.カードガチャ の無反応対策）
    core.registerGacha({ openGacha });

    // shop画面が開かれるたびに価格表示が戻らないよう保険
    applyPriceLabels();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
