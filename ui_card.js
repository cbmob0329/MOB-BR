　'use strict';

/*
  MOB BR - ui_card.js v16（所持だけで効果有効版 / SSR最高レア版 / 補正%表示 / ID順 / プレビュー小さめ）

  修正（今回）：
  - ガチャ側とキー統一：mobbr_cards を正として扱う
  - 旧キー mobbr_cardsOwned しか残っていない人を救済（自動で mobbr_cards に移行）
  - 補正%表示が 0.05% になっていたので、実際の仕様（0.05=5%）として×100して表示
  - ✅ 装備概念なし：
      「所持しているだけで効果あり」に統一
  - ✅ 所持カードを全部集計して mobbr_playerTeam に反映
  - ✅ チーム戦闘力も再計算して保存
      -> mobbr_playerTeam.power
      -> mobbr_playerTeam.teamPower
      -> mobbr_team_power
      -> mobbr_teamPower
  - ✅ TEAM画面表示用の cardEffects / eventBuff / eventBuffs も保存
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};

(function(){
  const $ = (id) => document.getElementById(id);

  const S  = window.MOBBR?.storage;
  const DC = window.MOBBR?.data?.cards;

  if (!S || !DC){
    console.warn('[ui_card] storage.js / data_cards.js not found');
    return;
  }

  // ===== storage key =====
  const K_CARDS = 'mobbr_cards';       // 正：所持カード {id: count}
  const K_OLD   = 'mobbr_cardsOwned';  // 旧：ガチャ側が使っていたキー（救済用）

  const K_PLAYER_TEAM      = 'mobbr_playerTeam';
  const K_TEAM_POWER       = 'mobbr_team_power';
  const K_TEAM_POWER_ALT   = 'mobbr_teamPower';
  const K_CARD_TOTAL_CACHE = 'mobbr_card_effect_total';

  // ===== DOM =====
  const dom = {
    btnCard: $('btnCard'),

    screen: $('cardScreen'),
    btnClose: $('btnCloseCard'),

    list: $('cardList'),

    preview: $('cardPreview'),
    previewImg: $('cardPreviewImg'),
    btnPreviewClose: $('btnCloseCardPreview')
  };

  // ===== utils =====
  function readJSON(key){
    try{
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }catch{
      return null;
    }
  }

  function writeJSON(key, obj){
    try{
      localStorage.setItem(key, JSON.stringify(obj || {}));
    }catch(e){}
  }

  function clamp(n, lo, hi){
    const v = Number(n);
    if (!Number.isFinite(v)) return lo;
    return Math.max(lo, Math.min(hi, v));
  }

  function num(n){
    const v = Number(n);
    return Number.isFinite(v) ? v : 0;
  }

  function round2(n){
    return Math.round(num(n) * 100) / 100;
  }

  function clone(obj){
    try{ return JSON.parse(JSON.stringify(obj)); }catch(e){ return obj; }
  }

  function migrateIfNeeded(){
    const cur = readJSON(K_CARDS) || {};
    const hasCur = Object.keys(cur).length > 0;

    if (hasCur) return;

    const old = readJSON(K_OLD) || {};
    const hasOld = Object.keys(old).length > 0;

    if (!hasOld) return;

    // 旧→新へ移行
    writeJSON(K_CARDS, old);
  }

  function getCards(){
    migrateIfNeeded();
    return readJSON(K_CARDS) || {};
  }

  function clearList(){
    if (dom.list) dom.list.innerHTML = '';
  }

  function fmtPercent(p){
    // data_cards.js は 0.05 = 5% のような「小数」で持っている
    const v = Number(p) || 0;
    return `${(v * 100).toFixed(2)}%`;
  }

  function readPlayerTeam(){
    return readJSON(K_PLAYER_TEAM) || null;
  }

  function writePlayerTeam(team){
    writeJSON(K_PLAYER_TEAM, team);
  }

  function ensureMemberBase(mem, id, fallbackRole){
    if (!mem || typeof mem !== 'object') mem = {};

    mem.id = String(mem.id || id || 'A');

    if (typeof mem.name !== 'string') mem.name = mem.id;
    if (typeof mem.role !== 'string' || !mem.role){
      mem.role = fallbackRole || '';
    }

    if (!mem.stats || typeof mem.stats !== 'object') mem.stats = {};

    if (!Number.isFinite(Number(mem.stats.hp))) mem.stats.hp = 66;
    if (!Number.isFinite(Number(mem.stats.aim))) mem.stats.aim = 66;
    if (!Number.isFinite(Number(mem.stats.tech))) mem.stats.tech = 66;
    if (!Number.isFinite(Number(mem.stats.mental))) mem.stats.mental = 66;

    mem.stats.hp = clamp(mem.stats.hp, 0, 99);
    mem.stats.aim = clamp(mem.stats.aim, 0, 99);
    mem.stats.tech = clamp(mem.stats.tech, 0, 99);
    mem.stats.mental = clamp(mem.stats.mental, 0, 99);

    if (typeof mem.img !== 'string') mem.img = '';

    return mem;
  }

  function ensureTeamBase(team){
    if (!team || typeof team !== 'object') team = {};

    if (typeof team.teamName !== 'string') team.teamName = 'PLAYER TEAM';
    if (!Array.isArray(team.members)) team.members = [];

    const byId = {};
    team.members.forEach(m=>{
      const id = String(m?.id || '');
      if (!id) return;
      byId[id] = m;
    });

    const A = ensureMemberBase(byId.A || team.members.find(x=>String(x?.id)==='A'), 'A', 'IGL');
    const B = ensureMemberBase(byId.B || team.members.find(x=>String(x?.id)==='B'), 'B', 'アタッカー');
    const C = ensureMemberBase(byId.C || team.members.find(x=>String(x?.id)==='C'), 'C', 'サポーター');

    const rest = team.members.filter(m=>{
      const id = String(m?.id || '');
      return id !== 'A' && id !== 'B' && id !== 'C';
    });

    team.members = [A, B, C, ...rest];

    return team;
  }

  function calcBaseMemberPower(mem){
    const st = mem?.stats || {};
    const hp = clamp(num(st.hp), 0, 99);
    const aim = clamp(num(st.aim), 0, 99);
    const tech = clamp(num(st.tech), 0, 99);
    const mental = clamp(num(st.mental), 0, 99);
    return Math.round((hp + aim + tech + mental) / 4);
  }

  function calcBaseTeamPower(team){
    const ms = (team?.members || []).filter(m=>{
      const id = String(m?.id || '');
      return id === 'A' || id === 'B' || id === 'C';
    });

    if (!ms.length) return 55;

    let sum = 0;
    for (const m of ms){
      sum += calcBaseMemberPower(m);
    }
    return clamp(Math.round(sum / ms.length), 1, 100);
  }

  // =========================================================
  // 所持カード補正の判定
  // - data_cards.js 側の定義差に耐えるように、複数プロパティ＋名前ヒューリスティックで吸収
  // =========================================================
  function normalizeTargetText(card){
    const parts = [
      card?.target,
      card?.bonusTarget,
      card?.bonusType,
      card?.effectTarget,
      card?.effectType,
      card?.type,
      card?.kind,
      card?.stat,
      card?.status,
      card?.attribute,
      card?.tag,
      card?.category,
      card?.name
    ];

    return parts
      .map(v => String(v || '').toLowerCase().trim())
      .filter(Boolean)
      .join(' | ');
  }

  function detectBucket(card){
    const s = normalizeTargetText(card);

    // 個別優先
    if (
      s.includes('aim') ||
      s.includes('エイム') ||
      s.includes('命中')
    ){
      return 'aim';
    }

    if (
      s.includes('mental') ||
      s.includes('メンタル') ||
      s.includes('精神')
    ){
      return 'mental';
    }

    if (
      s.includes('tech') ||
      s.includes('技術') ||
      s.includes('テック')
    ){
      return 'tech';
    }

    if (
      s.includes('agi') ||
      s.includes('agility') ||
      s.includes('機動') ||
      s.includes('俊敏') ||
      s.includes('スピード')
    ){
      return 'agi';
    }

    if (
      s.includes('hp') ||
      s.includes('体力') ||
      s.includes('health')
    ){
      return 'hp';
    }

    // 総合系
    if (
      s.includes('power') ||
      s.includes('team') ||
      s.includes('battle') ||
      s.includes('戦闘力') ||
      s.includes('総合') ||
      s.includes('チーム')
    ){
      return 'power';
    }

    // 情報不足時は「総合」に寄せる
    return 'power';
  }

  function getOwnedCardRows(){
    const owned = getCards();
    const all = (DC.getAll ? DC.getAll() : []) || [];

    const rows = [];

    for (const card of all){
      const count = Number(owned[card.id] || 0);
      if (count <= 0) continue;

      const bonusP = DC.calcSingleCardPercent
        ? Number(DC.calcSingleCardPercent(card.rarity, count) || 0)
        : 0;

      rows.push({
        id: card.id,
        name: card.name,
        rarity: card.rarity,
        imagePath: card.imagePath,
        count,
        bonusP,
        bucket: detectBucket(card),
        raw: card
      });
    }

    return rows;
  }

  function aggregateOwnedCardEffects(){
    const rows = getOwnedCardRows();

    const total = {
      powerPct: 0,   // 0.05 = 5%
      hpPct: 0,
      aimPct: 0,
      techPct: 0,
      mentalPct: 0,
      agiPct: 0,
      lines: []
    };

    for (const r of rows){
      const p = num(r.bonusP);
      if (!p) continue;

      if (r.bucket === 'power') total.powerPct += p;
      else if (r.bucket === 'hp') total.hpPct += p;
      else if (r.bucket === 'aim') total.aimPct += p;
      else if (r.bucket === 'tech') total.techPct += p;
      else if (r.bucket === 'mental') total.mentalPct += p;
      else if (r.bucket === 'agi') total.agiPct += p;
      else total.powerPct += p;
    }

    total.powerPct = round2(total.powerPct);
    total.hpPct = round2(total.hpPct);
    total.aimPct = round2(total.aimPct);
    total.techPct = round2(total.techPct);
    total.mentalPct = round2(total.mentalPct);
    total.agiPct = round2(total.agiPct);

    if (total.powerPct) total.lines.push(`総合 +${fmtPercent(total.powerPct)}`);
    if (total.hpPct) total.lines.push(`体力 +${fmtPercent(total.hpPct)}`);
    if (total.aimPct) total.lines.push(`エイム +${fmtPercent(total.aimPct)}`);
    if (total.techPct) total.lines.push(`技術 +${fmtPercent(total.techPct)}`);
    if (total.mentalPct) total.lines.push(`メンタル +${fmtPercent(total.mentalPct)}`);
    if (total.agiPct) total.lines.push(`機動力 +${fmtPercent(total.agiPct)}`);

    return total;
  }

  // =========================================================
  // ✅ 所持カード補正を PLAYER TEAM に反映
  // - TEAM画面表示用
  // - 試合側で読む teamPower / power / mobbr_team_power も更新
  // =========================================================
  function applyOwnedCardEffectsToPlayerTeam(){
    try{
      const summary = aggregateOwnedCardEffects();

      const team0 = readPlayerTeam();
      const team = ensureTeamBase(clone(team0) || {});

      const basePower = calcBaseTeamPower(team);

      const powerMult = 1 + num(summary.powerPct);
      const buffedPower = clamp(Math.round(basePower * powerMult), 1, 100);

      // TEAM画面の表示用
      team.cardEffects = Array.isArray(summary.lines) ? summary.lines.slice() : [];

      // ui_team_core.js が読む表示キー
      team.eventBuffs = {
        aim: Math.round(num(summary.aimPct) * 100),
        mental: Math.round(num(summary.mentalPct) * 100),
        agi: Math.round(num(summary.agiPct) * 100)
      };

      team.eventBuff = {
        multPower: round2(powerMult),
        addPower: 0,
        addAim: Math.round(num(summary.aimPct) * 100),
        addMental: Math.round(num(summary.mentalPct) * 100),
        addAgi: Math.round(num(summary.agiPct) * 100),
        addTech: Math.round(num(summary.techPct) * 100)
      };

      // デバッグ/参照用
      team.cardOwnedBonus = {
        basePower,
        finalPower: buffedPower,
        powerPct: summary.powerPct,
        hpPct: summary.hpPct,
        aimPct: summary.aimPct,
        techPct: summary.techPct,
        mentalPct: summary.mentalPct,
        agiPct: summary.agiPct
      };

      // 試合側で読む戦闘力
      team.teamPower = buffedPower;
      team.power = buffedPower;

      writePlayerTeam(team);

      // sim_tournament_logic / sim_tournament_core_step 側の互換キー
      try{ localStorage.setItem(K_TEAM_POWER, String(buffedPower)); }catch(e){}
      try{ localStorage.setItem(K_TEAM_POWER_ALT, String(buffedPower)); }catch(e){}

      // キャッシュ
      writeJSON(K_CARD_TOTAL_CACHE, {
        basePower,
        finalPower: buffedPower,
        powerPct: summary.powerPct,
        hpPct: summary.hpPct,
        aimPct: summary.aimPct,
        techPct: summary.techPct,
        mentalPct: summary.mentalPct,
        agiPct: summary.agiPct,
        lines: summary.lines || []
      });

      // TEAM UI が既にあれば再描画
      try{
        if (window.MOBBR?.initTeamUI){
          window.MOBBR.initTeamUI();
        }else if (window.MOBBR?.ui?._teamCore?.render){
          window.MOBBR.ui._teamCore.render();
        }
      }catch(e){}

      return {
        basePower,
        finalPower: buffedPower,
        summary
      };
    }catch(e){
      console.error('[ui_card] applyOwnedCardEffectsToPlayerTeam failed:', e);
      return null;
    }
  }

  // ===== render =====
  function renderList(){
    if (!dom.list) return;

    clearList();

    // 所持カードを開くたびに補正を再集計
    applyOwnedCardEffectsToPlayerTeam();

    const rows = getOwnedCardRows();
    const all = DC.getAll ? DC.getAll() : [];

    if (rows.length === 0){
      const div = document.createElement('div');
      div.className = 'cardEmpty';
      div.textContent = 'まだカードを所持していません';
      dom.list.appendChild(div);
      return;
    }

    const orderIndex = {};
    all.forEach((c,i)=>{ orderIndex[c.id] = i; });
    rows.sort((a,b)=>(orderIndex[a.id] ?? 999999) - (orderIndex[b.id] ?? 999999));

    rows.forEach(c=>{
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'cardRow';

      const left = document.createElement('div');
      left.className = 'cardRowLeft';
      left.textContent = `【${c.rarity}】${c.name}`;

      const right = document.createElement('div');
      right.className = 'cardRowRight';

      const cnt = document.createElement('div');
      cnt.className = 'cardRowCount';
      cnt.textContent = `×${c.count}`;

      const bonus = document.createElement('div');
      bonus.className = 'cardRowBonus';
      bonus.textContent = `+${fmtPercent(c.bonusP)}`;

      right.appendChild(cnt);
      right.appendChild(bonus);

      row.appendChild(left);
      row.appendChild(right);

      row.addEventListener('click', ()=>{
        showPreview(c);
      });

      dom.list.appendChild(row);
    });
  }

  // ===== preview =====
  function showPreview(card){
    if (!dom.preview || !dom.previewImg) return;

    dom.previewImg.src = card.imagePath || '';
    dom.previewImg.alt = card.name || 'カード';

    dom.previewImg.style.width = 'min(320px, 72vw)';
    dom.previewImg.style.height = 'auto';
    dom.previewImg.style.display = 'block';
    dom.previewImg.style.margin = '10px auto 0';
    dom.previewImg.style.borderRadius = '12px';

    dom.preview.style.display = 'block';
  }

  function closePreview(){
    if (dom.preview){
      dom.preview.style.display = 'none';
    }
  }

  // ===== open / close =====
  function open(){
    if (dom.screen){
      // 開いたときに毎回反映
      applyOwnedCardEffectsToPlayerTeam();
      renderList();
      dom.screen.classList.add('show');
      dom.screen.setAttribute('aria-hidden', 'false');
    }else{
      // 画面が無くても補正だけは更新
      applyOwnedCardEffectsToPlayerTeam();
      S.setStr(S.KEYS.recent, 'カードコレクションを確認した');
      if (window.MOBBR.initMainUI) window.MOBBR.initMainUI();
    }
  }

  function close(){
    closePreview();
    if (dom.screen){
      dom.screen.classList.remove('show');
      dom.screen.setAttribute('aria-hidden', 'true');
    }
  }

  // ===== bind =====
  function bind(){
    if (dom.btnCard) dom.btnCard.addEventListener('click', open);
    if (dom.btnClose) dom.btnClose.addEventListener('click', close);
    if (dom.btnPreviewClose) dom.btnPreviewClose.addEventListener('click', closePreview);
  }

  function initCardUI(){
    bind();

    // 起動時にも1回反映
    applyOwnedCardEffectsToPlayerTeam();
  }

  window.MOBBR.initCardUI = initCardUI;
  window.MOBBR.ui.card = {
    open,
    close,
    render: renderList,
    applyOwnedCardEffectsToPlayerTeam,
    aggregateOwnedCardEffects
  };

  document.addEventListener('DOMContentLoaded', initCardUI);
})();
