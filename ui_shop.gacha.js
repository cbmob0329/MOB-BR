/* =========================
   ui_shop.gacha.js v18（フル）
   ※ v17 のロジックは削除せず維持
   ※ 追加：
      - 当たったカード画像の演出表示
      - 1連は1枚表示
      - 10連は1枚ずつ順番表示
      - R / SR / SSR で演出差分
========================= */
'use strict';

/*
  MOB BR - ui_shop.gacha.js v18（フル）

  修正（今回）：
  - data_cards.js の正しい読み方に統一（window.MOBBR.data.cards.getAll()）
  - 所持カードの保存キーを ui_card.js と統一：mobbr_cards
  - R/SR/SSR のみ前提（Nは使わない）
  - ガチャ後にカードコレクションを再描画（開いていなくても内部更新）
  - ✅ 当たったカード画像を表示
  - ✅ 10連は順番に1枚ずつ表示
  - ✅ 簡易演出（暗転→発光→カード表示→次へ）
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
  const COST_10 = 10;    // 10連
  const COST_SR_G = 0;   // SR以上確定：Gは取らない（CDP100のみ）

  // ===== CDP =====
  const SRPLUS_CDP_COST = 100;

  // ===== Reveal UI =====
  let revealInjected = false;
  let revealWrap = null;
  let revealFlash = null;
  let revealCard = null;
  let revealImg = null;
  let revealRarity = null;
  let revealName = null;
  let revealSub = null;
  let revealIndex = null;
  let revealHint = null;
  let revealNextBtn = null;
  let revealTapHandlerBound = false;

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

  function escapeHtml(str){
    return String(str || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function injectRevealCSS(){
    if (revealInjected) return;
    revealInjected = true;

    const style = document.createElement('style');
    style.textContent = `
.mobbrGachaReveal{
  position:fixed;
  inset:0;
  z-index:10020;
  display:none;
  background:
    radial-gradient(circle at center, rgba(255,255,255,.06) 0%, rgba(255,255,255,0) 32%),
    rgba(0,0,0,.88);
  backdrop-filter: blur(2px);
}
.mobbrGachaReveal.isOpen{ display:block; }

.mobbrGachaRevealFlash{
  position:absolute;
  inset:0;
  opacity:0;
  pointer-events:none;
}
.mobbrGachaRevealFlash.isR{
  background: radial-gradient(circle at center, rgba(255,210,80,.18) 0%, rgba(255,210,80,0) 40%);
}
.mobbrGachaRevealFlash.isSR{
  background: radial-gradient(circle at center, rgba(80,210,255,.20) 0%, rgba(80,210,255,0) 44%);
}
.mobbrGachaRevealFlash.isSSR{
  background:
    radial-gradient(circle at center, rgba(255,120,210,.24) 0%, rgba(255,120,210,0) 40%),
    radial-gradient(circle at center, rgba(255,240,120,.14) 0%, rgba(255,240,120,0) 55%);
}
.mobbrGachaRevealFlash.anim{
  animation: mobbrGachaFlash .48s ease-out;
}
@keyframes mobbrGachaFlash{
  0%   { opacity:0; transform:scale(.92); }
  25%  { opacity:1; }
  100% { opacity:.0; transform:scale(1.06); }
}

.mobbrGachaRevealCard{
  position:absolute;
  left:50%;
  top:50%;
  transform:translate(-50%,-50%) scale(.92);
  width:min(88vw, 430px);
  border-radius:22px;
  padding:16px 16px 14px;
  border:1px solid rgba(255,255,255,.14);
  background:linear-gradient(180deg, rgba(20,24,32,.96), rgba(10,12,18,.96));
  box-shadow:0 24px 80px rgba(0,0,0,.55);
  color:#fff;
  opacity:0;
}
.mobbrGachaRevealCard.show{
  animation: mobbrGachaCardIn .30s ease-out forwards;
}
@keyframes mobbrGachaCardIn{
  0%{ opacity:0; transform:translate(-50%,-50%) scale(.90); }
  100%{ opacity:1; transform:translate(-50%,-50%) scale(1); }
}

.mobbrGachaRevealCard.isR{
  box-shadow:
    0 0 0 1px rgba(255,210,80,.18) inset,
    0 24px 80px rgba(0,0,0,.55),
    0 0 34px rgba(255,210,80,.10);
}
.mobbrGachaRevealCard.isSR{
  box-shadow:
    0 0 0 1px rgba(80,210,255,.22) inset,
    0 24px 80px rgba(0,0,0,.55),
    0 0 42px rgba(80,210,255,.16);
}
.mobbrGachaRevealCard.isSSR{
  box-shadow:
    0 0 0 1px rgba(255,130,215,.28) inset,
    0 24px 80px rgba(0,0,0,.55),
    0 0 58px rgba(255,130,215,.18);
}

.mobbrGachaRevealTop{
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:10px;
}
.mobbrGachaRevealRarity{
  min-width:62px;
  height:30px;
  padding:0 12px;
  border-radius:999px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  font-weight:900;
  letter-spacing:.05em;
  font-size:13px;
  border:1px solid rgba(255,255,255,.16);
}
.mobbrGachaRevealRarity.isR{
  background:rgba(255,210,80,.14);
  color:#ffe7a0;
}
.mobbrGachaRevealRarity.isSR{
  background:rgba(80,210,255,.14);
  color:#b8efff;
}
.mobbrGachaRevealRarity.isSSR{
  background:rgba(255,120,210,.14);
  color:#ffd0ef;
}
.mobbrGachaRevealIndex{
  font-size:12px;
  font-weight:900;
  opacity:.82;
}

.mobbrGachaRevealImgWrap{
  margin-top:14px;
  display:flex;
  justify-content:center;
  align-items:center;
  min-height:220px;
}
.mobbrGachaRevealImg{
  display:block;
  width:min(70vw, 280px);
  max-height:46vh;
  object-fit:contain;
  border-radius:14px;
  background:rgba(255,255,255,.04);
  box-shadow:0 10px 34px rgba(0,0,0,.35);
}

.mobbrGachaRevealName{
  margin-top:14px;
  text-align:center;
  font-size:20px;
  line-height:1.3;
  font-weight:1000;
}
.mobbrGachaRevealSub{
  margin-top:8px;
  text-align:center;
  font-size:13px;
  line-height:1.45;
  opacity:.88;
  min-height:2.9em;
  white-space:pre-line;
}
.mobbrGachaRevealHint{
  margin-top:12px;
  text-align:center;
  font-size:12px;
  opacity:.72;
}

.mobbrGachaRevealNext{
  margin-top:14px;
  width:100%;
  min-height:46px;
  border:none;
  border-radius:14px;
  font-size:15px;
  font-weight:1000;
  color:#fff;
  background:rgba(255,255,255,.12);
  border:1px solid rgba(255,255,255,.16);
}
.mobbrGachaRevealNext:active{
  transform:translateY(1px);
}
`;
    document.head.appendChild(style);
  }

  function ensureRevealUI(){
    if (revealWrap) return;

    injectRevealCSS();

    revealWrap = document.createElement('div');
    revealWrap.className = 'mobbrGachaReveal';
    revealWrap.setAttribute('aria-hidden', 'true');

    revealFlash = document.createElement('div');
    revealFlash.className = 'mobbrGachaRevealFlash';

    revealCard = document.createElement('div');
    revealCard.className = 'mobbrGachaRevealCard';

    const top = document.createElement('div');
    top.className = 'mobbrGachaRevealTop';

    revealRarity = document.createElement('div');
    revealRarity.className = 'mobbrGachaRevealRarity';
    revealRarity.textContent = 'R';

    revealIndex = document.createElement('div');
    revealIndex.className = 'mobbrGachaRevealIndex';
    revealIndex.textContent = '';

    top.appendChild(revealRarity);
    top.appendChild(revealIndex);

    const imgWrap = document.createElement('div');
    imgWrap.className = 'mobbrGachaRevealImgWrap';

    revealImg = document.createElement('img');
    revealImg.className = 'mobbrGachaRevealImg';
    revealImg.alt = 'card';

    imgWrap.appendChild(revealImg);

    revealName = document.createElement('div');
    revealName.className = 'mobbrGachaRevealName';
    revealName.textContent = '';

    revealSub = document.createElement('div');
    revealSub.className = 'mobbrGachaRevealSub';
    revealSub.textContent = '';

    revealHint = document.createElement('div');
    revealHint.className = 'mobbrGachaRevealHint';
    revealHint.textContent = 'タップで次へ';

    revealNextBtn = document.createElement('button');
    revealNextBtn.type = 'button';
    revealNextBtn.className = 'mobbrGachaRevealNext';
    revealNextBtn.textContent = '次へ';

    revealCard.appendChild(top);
    revealCard.appendChild(imgWrap);
    revealCard.appendChild(revealName);
    revealCard.appendChild(revealSub);
    revealCard.appendChild(revealHint);
    revealCard.appendChild(revealNextBtn);

    revealWrap.appendChild(revealFlash);
    revealWrap.appendChild(revealCard);
    document.body.appendChild(revealWrap);
  }

  function sleep(ms){
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function rarityClass(r){
    const x = String(r || 'R').toUpperCase();
    if (x === 'SSR') return 'isSSR';
    if (x === 'SR') return 'isSR';
    return 'isR';
  }

  function rarityLabel(r){
    const x = String(r || 'R').toUpperCase();
    if (x === 'SSR') return 'SSR';
    if (x === 'SR') return 'SR';
    return 'R';
  }

  function openReveal(){
    ensureRevealUI();
    revealWrap.classList.add('isOpen');
    revealWrap.setAttribute('aria-hidden', 'false');

    try{
      if (dom.modalBack){
        dom.modalBack.style.display = 'block';
        dom.modalBack.style.pointerEvents = 'auto';
        dom.modalBack.setAttribute('aria-hidden', 'false');
      }
    }catch(e){}
  }

  function closeReveal(){
    if (!revealWrap) return;
    revealWrap.classList.remove('isOpen');
    revealWrap.setAttribute('aria-hidden', 'true');

    try{
      if (dom.modalBack){
        dom.modalBack.style.display = 'block';
        dom.modalBack.style.pointerEvents = 'auto';
        dom.modalBack.setAttribute('aria-hidden', 'false');
      }
    }catch(e){}
  }

  function waitRevealAdvance(){
    return new Promise(resolve => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        revealNextBtn.removeEventListener('click', onBtn);
        revealWrap.removeEventListener('click', onTap);
        document.removeEventListener('keydown', onKey);
        resolve();
      };

      const onBtn = (e) => {
        if (e){
          e.preventDefault();
          e.stopPropagation();
        }
        finish();
      };

      const onTap = (e) => {
        if (!revealWrap.classList.contains('isOpen')) return;
        if (e && e.target === revealImg) return;
        finish();
      };

      const onKey = (e) => {
        if (e.key === 'Enter' || e.key === ' '){
          e.preventDefault();
          finish();
        }
      };

      revealNextBtn.addEventListener('click', onBtn, { passive:false });
      revealWrap.addEventListener('click', onTap, { passive:false });
      document.addEventListener('keydown', onKey);
    });
  }

  async function showOneReveal(row, idx, total){
    ensureRevealUI();
    openReveal();

    const rar = rarityLabel(row?.rarity || 'R');
    const cls = rarityClass(rar);

    revealFlash.className = `mobbrGachaRevealFlash ${cls}`;
    revealCard.className = `mobbrGachaRevealCard ${cls}`;

    revealRarity.className = `mobbrGachaRevealRarity ${cls}`;
    revealRarity.textContent = rar;

    revealIndex.textContent = total > 1 ? `${idx + 1} / ${total}` : '1枚獲得';

    revealImg.src = String(row?.imagePath || '');
    revealImg.alt = String(row?.name || 'card');

    revealName.textContent = String(row?.name || '');

    const subText = row?.kept
      ? `獲得！  所持：${Number(row?.newCount || 0)}/10`
      : `11枚目以降 → ${Number(row?.convertedG || 0)}G に変換`;

    revealSub.textContent = subText;

    if (idx >= total - 1){
      revealHint.textContent = 'タップで結果一覧へ';
      revealNextBtn.textContent = '結果へ';
    }else{
      revealHint.textContent = 'タップで次へ';
      revealNextBtn.textContent = '次へ';
    }

    revealCard.classList.remove('show');
    revealFlash.classList.remove('anim');

    // 一旦非表示状態へ
    revealCard.style.opacity = '0';
    revealCard.style.transform = 'translate(-50%,-50%) scale(.92)';

    await sleep(rar === 'SSR' ? 180 : rar === 'SR' ? 120 : 80);

    revealFlash.classList.add('anim');
    await sleep(rar === 'SSR' ? 260 : rar === 'SR' ? 220 : 180);

    revealCard.classList.add('show');

    await waitRevealAdvance();
  }

  async function playGachaReveal(rows, onDone){
    try{
      const arr = Array.isArray(rows) ? rows.slice() : [];
      if (!arr.length){
        onDone && onDone();
        return;
      }

      for (let i=0; i<arr.length; i++){
        await showOneReveal(arr[i], i, arr.length);
      }

      closeReveal();
      try{ onDone && onDone(); }catch(e){ console.error(e); }
    }catch(e){
      console.error('[ui_shop.gacha] reveal failed:', e);
      closeReveal();
      try{ onDone && onDone(); }catch(_){}
    }
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
          sub: res.kept ? `所持：${res.newCount}/10` : `11枚目以降 → ${res.convertedG}G に変換`,
          id: String(card.id || ''),
          name: String(card.name || ''),
          rarity: String(card.rarity || 'R').toUpperCase(),
          imagePath: String(card.imagePath || ''),
          kept: !!res.kept,
          convertedG: Number(res.convertedG || 0),
          newCount: Number(res.newCount || 0)
        });
      }

      writeOwned(owned);

      playGachaReveal(rows, ()=>{
        core.showListResult(rows);
        core.renderMeta();
        refreshCardCollectionUI();

        core.setRecent(
          `ショップ：ガチャ${t}回${convertedTotal ? `（変換+${convertedTotal}G）` : ''}`
        );
      });
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
    ensureRevealUI();

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
