'use strict';

/*
  MOB BR - ui_card.js v17（所持だけで効果有効版 / 正式レア補正対応 / フル）

  今回の修正：
  - ✅ カード効果仕様を正式値に修正
      R   : 初期 0.01% / 同カードごとに +0.005% / +50まで
      SR  : 初期 0.05% / 同カードごとに +0.02%  / +30まで
      SSR : 初期 0.1%  / 同カードごとに +0.05%  / +15まで
  - ✅ 装備概念なし（所持しているだけで効果あり）
  - ✅ ui_card.js 内で独自計算する（data_cards.js の旧計算に依存しない）
  - ✅ mobbr_playerTeam / mobbr_team_power / mobbr_teamPower に正しい値を保存
  - ✅ TEAM画面表示用の cardEffects / eventBuff / eventBuffs も保存
  - ✅ 旧キー mobbr_cardsOwned → mobbr_cards へ自動移行
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
  const K_CARDS = 'mobbr_cards';
  const K_OLD   = 'mobbr_cardsOwned';

  const K_PLAYER_TEAM      = 'mobbr_playerTeam';
  const K_TEAM_POWER       = 'mobbr_team_power';
  const K_TEAM_POWER_ALT   = 'mobbr_teamPower';
  const K_CARD_TOTAL_CACHE = 'mobbr_card_effect_total';

  // ===== 正式カード補正仕様 =====
  // pct は「%そのもの」。0.01 = 0.01%
  const CARD_SPEC = {
    R:   { basePct: 0.01, stepPct: 0.005, maxPlus: 50 },
    SR:  { basePct: 0.05, stepPct: 0.02,  maxPlus: 30 },
    SSR: { basePct: 0.10, stepPct: 0.05,  maxPlus: 15 }
  };

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

  function round3(n){
    return Math.round(num(n) * 1000) / 1000;
  }

  function clone(obj){
    try{ return JSON.parse(JSON.stringify(obj)); }catch(e){ return obj; }
  }

  function migrateIfNeeded(){
    const cur = readJSON(K_CARDS) || {};
    if (Object.keys(cur).length > 0) return;

    const old = readJSON(K_OLD) || {};
    if (Object.keys(old).length <= 0) return;

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
    const v = num(p);
    if (Math.abs(v) >= 1) return `${v.toFixed(2)}%`;
    if (Math.abs(v) >= 0.1) return `${v.toFixed(3)}%`;
    return `${v.toFixed(3)}%`;
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

    if (typeof mem.name !== 'string' || !mem.name.trim()){
      mem.name = mem.id;
    }
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
  // カード1枚ごとの正式効果
  // count = 所持枚数
  // plus = 追加分（初回1枚目は +0）
  // effectiveCount = 1 + cappedPlus
  // pct = base + step * plus
  // =========================================================
  function getCardSpecByRarity(rarity){
    const r = String(rarity || '').toUpperCase();
    return CARD_SPEC[r] || CARD_SPEC.R;
  }

  function calcOwnedCardPercentInfo(rarity, count){
    const spec = getCardSpecByRarity(rarity);
    const owned = Math.max(0, Math.floor(num(count)));

    if (owned <= 0){
      return {
        rarity: String(rarity || '').toUpperCase(),
        owned: 0,
        plus: 0,
        cappedPlus: 0,
        overCap: 0,
        effectiveCount: 0,
        pct: 0
      };
    }

    const plus = Math.max(0, owned - 1);
    const cappedPlus = Math.min(plus, spec.maxPlus);
    const overCap = Math.max(0, plus - spec.maxPlus);
    const effectiveCount = 1 + cappedPlus;
    const pct = round3(spec.basePct + (spec.stepPct * cappedPlus));

    return {
      rarity: String(rarity || '').toUpperCase(),
      owned,
      plus,
      cappedPlus,
      overCap,
      effectiveCount,
      pct
    };
  }

  // =========================================================
  // 所持カード補正の対象判定
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

    if (s.includes('aim') || s.includes('エイム') || s.includes('命中')) return 'aim';
    if (s.includes('mental') || s.includes('メンタル') || s.includes('精神')) return 'mental';
    if (s.includes('tech') || s.includes('技術') || s.includes('テック')) return 'tech';
    if (s.includes('agi') || s.includes('agility') || s.includes('機動') || s.includes('俊敏') || s.includes('スピード')) return 'agi';
    if (s.includes('hp') || s.includes('体力') || s.includes('health')) return 'hp';

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

    return 'power';
  }

  function getOwnedCardRows(){
    const owned = getCards();
    const all = (DC.getAll ? DC.getAll() : []) || [];
    const rows = [];

    for (const card of all){
      const count = Math.max(0, Math.floor(num(owned[card.id] || 0)));
      if (count <= 0) continue;

      const info = calcOwnedCardPercentInfo(card.rarity, count);

      rows.push({
        id: card.id,
        name: card.name,
        rarity: String(card.rarity || '').toUpperCase(),
        imagePath: card.imagePath,
        count,
        bonusP: info.pct,
        plus: info.cappedPlus,
        overCap: info.overCap,
        bucket: detectBucket(card),
        raw: card
      });
    }

    return rows;
  }

  function aggregateOwnedCardEffects(){
    const rows = getOwnedCardRows();

    const total = {
      powerPct: 0,
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

    total.powerPct = round3(total.powerPct);
    total.hpPct = round3(total.hpPct);
    total.aimPct = round3(total.aimPct);
    total.techPct = round3(total.techPct);
    total.mentalPct = round3(total.mentalPct);
    total.agiPct = round3(total.agiPct);

    if (total.powerPct) total.lines.push(`総合 +${fmtPercent(total.powerPct)}`);
    if (total.hpPct) total.lines.push(`体力 +${fmtPercent(total.hpPct)}`);
    if (total.aimPct) total.lines.push(`エイム +${fmtPercent(total.aimPct)}`);
    if (total.techPct) total.lines.push(`技術 +${fmtPercent(total.techPct)}`);
    if (total.mentalPct) total.lines.push(`メンタル +${fmtPercent(total.mentalPct)}`);
    if (total.agiPct) total.lines.push(`機動力 +${fmtPercent(total.agiPct)}`);

    return total;
  }

  // =========================================================
  // 所持だけで PLAYER TEAM に反映
  // powerPct は「%」なので倍率化は /100
  // 例：0.05 => 0.05%
  // =========================================================
  function applyOwnedCardEffectsToPlayerTeam(){
    try{
      const summary = aggregateOwnedCardEffects();

      const team0 = readPlayerTeam();
      const team = ensureTeamBase(clone(team0) || {});

      const basePower = calcBaseTeamPower(team);
      const powerMult = 1 + (num(summary.powerPct) / 100);
      const buffedPower = clamp(Math.round(basePower * powerMult), 1, 100);

      team.cardEffects = Array.isArray(summary.lines) ? summary.lines.slice() : [];

      // TEAM画面表示用
      team.eventBuffs = {
        aim: round3(summary.aimPct),
        mental: round3(summary.mentalPct),
        agi: round3(summary.agiPct)
      };

      team.eventBuff = {
        multPower: round3(powerMult),
        addPower: 0,
        addAim: round3(summary.aimPct),
        addMental: round3(summary.mentalPct),
        addAgi: round3(summary.agiPct),
        addTech: round3(summary.techPct)
      };

      team.cardOwnedBonus = {
        basePower,
        finalPower: buffedPower,
        powerPct: round3(summary.powerPct),
        hpPct: round3(summary.hpPct),
        aimPct: round3(summary.aimPct),
        techPct: round3(summary.techPct),
        mentalPct: round3(summary.mentalPct),
        agiPct: round3(summary.agiPct),
        lines: Array.isArray(summary.lines) ? summary.lines.slice() : []
      };

      team.teamPower = buffedPower;
      team.power = buffedPower;

      writePlayerTeam(team);

      try{ localStorage.setItem(K_TEAM_POWER, String(buffedPower)); }catch(e){}
      try{ localStorage.setItem(K_TEAM_POWER_ALT, String(buffedPower)); }catch(e){}

      writeJSON(K_CARD_TOTAL_CACHE, {
        basePower,
        finalPower: buffedPower,
        powerPct: round3(summary.powerPct),
        hpPct: round3(summary.hpPct),
        aimPct: round3(summary.aimPct),
        techPct: round3(summary.techPct),
        mentalPct: round3(summary.mentalPct),
        agiPct: round3(summary.agiPct),
        lines: Array.isArray(summary.lines) ? summary.lines.slice() : []
      });

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

      const plusText = `+${c.plus}`;
      const pctText = fmtPercent(c.bonusP);
      bonus.textContent = `${plusText} / ${pctText}`;

      row.appendChild(left);

      const rightWrap = document.createElement('div');
      rightWrap.className = 'cardRowRight';
      rightWrap.appendChild(cnt);
      rightWrap.appendChild(bonus);

      if (c.overCap > 0){
        const over = document.createElement('div');
        over.className = 'cardRowBonus';
        over.textContent = `上限超過 ${c.overCap}`;
        rightWrap.appendChild(over);
      }

      row.appendChild(rightWrap);

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
      applyOwnedCardEffectsToPlayerTeam();
      renderList();
      dom.screen.classList.add('show');
      dom.screen.setAttribute('aria-hidden', 'false');
    }else{
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
    applyOwnedCardEffectsToPlayerTeam();
  }

  window.MOBBR.initCardUI = initCardUI;
  window.MOBBR.ui.card = {
    open,
    close,
    render: renderList,
    applyOwnedCardEffectsToPlayerTeam,
    aggregateOwnedCardEffects,
    calcOwnedCardPercentInfo
  };

  document.addEventListener('DOMContentLoaded', initCardUI);
})();
