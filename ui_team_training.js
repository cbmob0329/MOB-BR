'use strict';

/*
  MOB BR - ui_team_training.js v18-split（FULL）
  - 元 ui_team.js から「育成（成長 / パッシブ強化）」部分を分離
  - ui_team_core.js が提供する coreApi に attach して動作

  ★あなたの要望（今回の確定）
  - ✅ ポイント（ストック）完全撤去（muscle/tech/mental を使わない）
  - ✅ スキル取得/強化は廃止 → 既存SKILLSを「パッシブ」としてそのまま使う
  - ✅ 既存の mem.passive は使わない（= “消す/無視”）
  - ✅ パッシブはGで強化可能
       - 次の+1コスト：10000G（初回）→ 以降 +5000Gずつ増加
       - cost = 10000 + (現在plus * 5000)
  - ✅ 発動率 初期値変更
       - 1.0% → 5.0%
       - 0.5% → 2.0%
  - ✅ ポップアップで反映結果を表示（1画面完結を避ける）
  - ✅ ポップアップを開くたびスクロール先頭へ（スクロールリセット）
  - ✅ ログ超強化（育成ログを保存し、後から見返せる）
       ※ここでいうログは「育成/成長/強化」の便利ログ（右下ログとは別）

  追加メモ：
  - 成長（能力アップ）は、ポイント無しでG消費に切り替えています。
    ★コストはこのファイル内の定数で管理（簡単に調整できる）。
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.uiTeamTraining = window.MOBBR.uiTeamTraining || {};

(function(){

  let T = null; // coreApi

  function attach(coreApi){
    T = coreApi || null;

    // coreが先にロードされているケース対応
    if (!T && window.MOBBR?._uiTeamCore) T = window.MOBBR._uiTeamCore;

    if (!T){
      console.warn('[ui_team_training] coreApi missing');
      return;
    }

    // core側へ showMsg を差し込み（育成UI内の小メッセージ）
    T.showMsg = showMsg;

    // 初回UI生成
    ensureTrainingUI();
  }

  // coreが先にロードされて training が後から来ても attach できるように
  if (!window.MOBBR.uiTeamTraining.attach){
    window.MOBBR.uiTeamTraining.attach = attach;
  }

  // coreが既に存在するなら即 attach
  if (window.MOBBR?._uiTeamCore){
    attach(window.MOBBR._uiTeamCore);
  }

  // =========================================================
  // 成長（能力アップ）
  // =========================================================

  const UP_STATS = [
    { key:'hp',     label:'体力'   },
    { key:'aim',    label:'エイム' },
    { key:'tech',   label:'技術'   },
    { key:'mental', label:'メンタル' }
  ];

  // ★成長コスト（G）
  // - ここは “あなたのゲームのテンポ” に合わせて調整しやすいよう定数化
  // - cost = base + (現在upgradeCount * step)
  const STAT_GOLD_BASE = { hp: 9000, aim: 10000, tech: 10000, mental: 10000 };
  const STAT_GOLD_STEP = 2000;

  function goldCostForStat(mem, statKey, addCount){
    const base = Number(STAT_GOLD_BASE[statKey] || 0);
    const curUp = Number(mem?.upgradeCount?.[statKey] || 0);
    let sum = 0;
    for (let i=0;i<addCount;i++){
      const inc = curUp + i;
      sum += (base + inc * STAT_GOLD_STEP);
    }
    return Math.max(0, Math.floor(sum));
  }

  // =========================================================
  // パッシブ（旧スキル）定義
  // =========================================================

  // ★発動率初期値変更
  // - 1.0 → 5.0
  // - 0.5 → 2.0
  const PASSIVES = [
    // IGL
    {
      id:'igl_inspire',
      role:'IGL',
      name:'閃きと輝き',
      baseChance: 5.0,
      trigger:'接敵時',
      type:'buff_team',
      baseEffect: 10,
      desc:'接敵時に発動。チーム全員のステータスを10%アップ。'
    },
    {
      id:'igl_control',
      role:'IGL',
      name:'空間制圧',
      baseChance: 2.0,
      trigger:'接敵時',
      type:'debuff_enemy_power',
      baseEffect: 5,
      desc:'接敵時に発動。敵チームの総合戦闘力を5ダウン。'
    },

    // Attacker
    {
      id:'atk_speedstar',
      role:'アタッカー',
      name:'スピードスター',
      baseChance: 5.0,
      trigger:'接敵時',
      type:'buff_self_aim',
      baseEffect: 20,
      desc:'接敵時に発動。自身のエイムが20%アップ。'
    },
    {
      id:'atk_physical',
      role:'アタッカー',
      name:'フィジカルモンスター',
      baseChance: 2.0,
      trigger:'マッチ開始時',
      type:'buff_match_aim',
      baseEffect: 50,
      desc:'マッチ開始時に発動。発動した試合中、エイムが50%アップ。'
    },

    // Support
    {
      id:'sup_shingan',
      role:'サポーター',
      name:'心眼',
      baseChance: 5.0,
      trigger:'マッチ開始時',
      type:'block_debuff',
      baseEffect: 100,
      desc:'マッチ開始時に発動。発動した試合でデバフイベントが発生しなくなる。'
    },
    {
      id:'sup_godcover',
      role:'サポーター',
      name:'神カバー',
      baseChance: 5.0,
      trigger:'接敵時',
      type:'buff_others',
      baseEffect: 5,
      desc:'接敵時に発動。自分以外の全能力を5%アップ。'
    }
  ];

  const PASSIVE_BY_ID = Object.fromEntries(PASSIVES.map(p => [p.id, p]));

  // ★パッシブ強化コスト（G）
  // 10000Gで+1、以降 5000Gずつ増える
  function goldCostForPassivePlus(curPlus, addCount){
    const p0 = clamp0to30(Number(curPlus || 0));
    let sum = 0;
    for (let i=0;i<addCount;i++){
      const p = p0 + i;
      sum += (10000 + p * 5000);
    }
    return Math.max(0, Math.floor(sum));
  }

  // =========================================================
  // ★ログ超強化：保存 / 閲覧 / 反映結果ポップアップ
  // =========================================================

  const TRAIN_LOG_KEY = 'mobbr:trainingLogs:v2';
  const TRAIN_LOG_LIMIT = 140; // 最新だけ残す

  function nowISO(){
    try { return new Date().toISOString(); } catch(e){ return ''; }
  }

  function safeJsonParse(s, fallback){
    try{ return JSON.parse(s); }catch(e){ return fallback; }
  }

  function getTrainingLogs(){
    const raw = localStorage.getItem(TRAIN_LOG_KEY);
    const arr = safeJsonParse(raw, []);
    return Array.isArray(arr) ? arr : [];
  }

  function pushTrainingLog(entry){
    const logs = getTrainingLogs();
    logs.unshift(entry);
    if (logs.length > TRAIN_LOG_LIMIT) logs.length = TRAIN_LOG_LIMIT;
    localStorage.setItem(TRAIN_LOG_KEY, JSON.stringify(logs));
  }

  function clearTrainingLogs(){
    localStorage.removeItem(TRAIN_LOG_KEY);
  }

  function buildPopupBase(){
    let pop = document.getElementById('mobbrTrainingPopup');
    if (!pop){
      pop = document.createElement('div');
      pop.id = 'mobbrTrainingPopup';
      pop.style.position = 'fixed';
      pop.style.inset = '0';
      pop.style.zIndex = '999999';
      pop.style.background = 'rgba(0,0,0,.86)';
      pop.style.backdropFilter = 'blur(2px)';
      pop.style.padding = '16px';
      pop.style.overflow = 'auto';
      pop.style.color = '#fff';
      document.body.appendChild(pop);
    }
    pop.innerHTML = '';
    return pop;
  }

  function openPopup(title, lines, footerButtons){
    const pop = buildPopupBase();

    const wrap = document.createElement('div');
    wrap.style.maxWidth = '560px';
    wrap.style.margin = '0 auto';
    wrap.style.border = '1px solid rgba(255,255,255,.16)';
    wrap.style.borderRadius = '14px';
    wrap.style.background = 'rgba(255,255,255,.08)';
    wrap.style.padding = '12px';

    const h = document.createElement('div');
    h.style.fontWeight = '1000';
    h.style.fontSize = '15px';
    h.style.marginBottom = '10px';
    h.textContent = title || 'ログ';
    wrap.appendChild(h);

    const body = document.createElement('div');
    body.style.fontSize = '12px';
    body.style.lineHeight = '1.45';
    body.style.whiteSpace = 'pre-wrap';
    body.style.opacity = '0.96';

    const text = Array.isArray(lines) ? lines.join('\n') : String(lines || '');
    body.textContent = text;
    wrap.appendChild(body);

    // 追加ボタン（任意）
    if (Array.isArray(footerButtons) && footerButtons.length){
      const extraRow = document.createElement('div');
      extraRow.style.marginTop = '12px';
      extraRow.style.display = 'grid';
      extraRow.style.gridTemplateColumns = '1fr 1fr';
      extraRow.style.gap = '10px';

      footerButtons.slice(0,2).forEach(b=>{
        extraRow.appendChild(b);
      });

      wrap.appendChild(extraRow);
    }

    const btnRow = document.createElement('div');
    btnRow.style.marginTop = '12px';
    btnRow.style.display = 'grid';
    btnRow.style.gridTemplateColumns = '1fr 1fr';
    btnRow.style.gap = '10px';

    const topBtn = document.createElement('button');
    topBtn.type = 'button';
    topBtn.textContent = '先頭へ';
    topBtn.style.border = '1px solid rgba(255,255,255,.18)';
    topBtn.style.borderRadius = '14px';
    topBtn.style.padding = '12px 12px';
    topBtn.style.fontWeight = '1000';
    topBtn.style.fontSize = '14px';
    topBtn.style.background = 'rgba(255,255,255,.86)';
    topBtn.style.color = '#111';
    topBtn.style.cursor = 'pointer';
    topBtn.style.touchAction = 'manipulation';
    topBtn.addEventListener('click', ()=>{ pop.scrollTop = 0; });

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = '閉じる';
    closeBtn.style.border = '1px solid rgba(255,255,255,.18)';
    closeBtn.style.borderRadius = '14px';
    closeBtn.style.padding = '12px 12px';
    closeBtn.style.fontWeight = '1000';
    closeBtn.style.fontSize = '14px';
    closeBtn.style.background = 'rgba(255,255,255,.10)';
    closeBtn.style.color = '#fff';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.touchAction = 'manipulation';
    closeBtn.addEventListener('click', ()=>{ pop.remove(); });

    btnRow.appendChild(topBtn);
    btnRow.appendChild(closeBtn);
    wrap.appendChild(btnRow);

    pop.appendChild(wrap);

    // ✅ スクロールリセット（開くたび先頭）
    pop.scrollTop = 0;
  }

  function openLogsPopup(){
    const logs = getTrainingLogs();
    if (!logs.length){
      openPopup('育成ログ（0件）', ['まだ育成ログはありません。']);
      return;
    }

    const lines = [];
    lines.push(`育成ログ（最新${Math.min(logs.length, TRAIN_LOG_LIMIT)}件）`);
    lines.push('────────────────────────');

    logs.slice(0, 40).forEach((e, idx)=>{
      lines.push(`【${idx+1}】${e.title || '育成'}  (${e.at || ''})`);
      (e.lines || []).slice(0, 80).forEach(l=>lines.push(`  ${l}`));
      lines.push('────────────────────────');
    });

    const clearBtn = createGhostBtn('ログ全削除');
    clearBtn.addEventListener('click', ()=>{
      clearTrainingLogs();
      openLogsPopup();
    });

    openPopup('育成ログ', lines, [clearBtn]);
  }

  // =========================================================
  // GOLD（storage.js）
  // =========================================================

  function getGold(){
    try{
      const S = window.MOBBR?.storage;
      const key = S?.KEYS?.gold || 'mobbr_gold';
      if (S?.getNum) return Number(S.getNum(key, 0)) || 0;
      const v = Number(localStorage.getItem(key));
      return Number.isFinite(v) ? v : 0;
    }catch(e){
      return 0;
    }
  }

  function setGold(val){
    const v = Math.max(0, Math.floor(Number(val) || 0));
    try{
      const S = window.MOBBR?.storage;
      const key = S?.KEYS?.gold || 'mobbr_gold';
      if (S?.setNum){ S.setNum(key, v); return; }
      localStorage.setItem(key, String(v));
    }catch(e){}
  }

  function formatG(n){
    const v = Math.max(0, Math.floor(Number(n) || 0));
    return `${v.toLocaleString()}G`;
  }

  // =========================================================
  // util（clamp）
  // =========================================================

  function clamp(n, min, max){
    const v = Number(n);
    if (!Number.isFinite(v)) return min;
    return Math.max(min, Math.min(max, v));
  }
  function clamp0(n){
    const v = Number(n);
    return Number.isFinite(v) ? Math.max(0, v) : 0;
  }
  function clamp0to30(n){ return clamp(n, 0, 30); }

  // =========================================================
  // UI injection
  // =========================================================

  let trainingUI = null;

  function findTeamPanel(){
    if (!T?.dom?.teamScreen) return null;
    return T.dom.teamScreen.querySelector?.('.teamPanel') || T.dom.teamScreen;
  }

  function createSectionTitle(text){
    const t = document.createElement('div');
    t.style.fontWeight = '1000';
    t.style.fontSize = '14px';
    t.style.opacity = '0.98';
    t.style.marginTop = '10px';
    t.textContent = text;
    return t;
  }

  function createSubText(text){
    const s = document.createElement('div');
    s.style.marginTop = '6px';
    s.style.fontSize = '12px';
    s.style.opacity = '0.92';
    s.style.lineHeight = '1.35';
    s.textContent = text;
    return s;
  }

  function createTabRow(){
    const row = document.createElement('div');
    row.style.display = 'grid';
    row.style.gridTemplateColumns = 'repeat(3, minmax(0, 1fr))';
    row.style.gap = '8px';
    row.style.marginTop = '10px';
    return row;
  }

  function createTabBtn(label, active){
    const b = document.createElement('button');
    b.type = 'button';
    b.style.border = '1px solid rgba(255,255,255,.16)';
    b.style.borderRadius = '12px';
    b.style.padding = '10px 10px';
    b.style.fontWeight = '1000';
    b.style.fontSize = '13px';
    b.style.cursor = 'pointer';
    b.style.touchAction = 'manipulation';
    b.style.background = active ? 'rgba(255,255,255,.86)' : 'rgba(255,255,255,.10)';
    b.style.color = active ? '#111' : '#fff';
    b.textContent = label;
    b.addEventListener('touchstart', ()=>{}, {passive:true});
    b.onmousedown = ()=>{};
    return b;
  }

  function createCard(){
    const c = document.createElement('div');
    c.style.borderRadius = '14px';
    c.style.padding = '12px';
    c.style.background = 'rgba(255,255,255,.10)';
    c.style.border = '1px solid rgba(255,255,255,.14)';
    return c;
  }

  function createMiniPill(text){
    const p = document.createElement('div');
    p.style.display = 'inline-block';
    p.style.padding = '4px 8px';
    p.style.borderRadius = '999px';
    p.style.fontSize = '11px';
    p.style.fontWeight = '1000';
    p.style.border = '1px solid rgba(255,255,255,.18)';
    p.style.background = 'rgba(0,0,0,.25)';
    p.style.opacity = '0.95';
    p.textContent = text;
    return p;
  }

  function createPrimaryBtn(text){
    const b = document.createElement('button');
    b.type = 'button';
    b.style.width = '100%';
    b.style.border = '1px solid rgba(255,255,255,.18)';
    b.style.borderRadius = '14px';
    b.style.padding = '12px 12px';
    b.style.fontWeight = '1000';
    b.style.fontSize = '14px';
    b.style.background = 'rgba(255,255,255,.86)';
    b.style.color = '#111';
    b.style.cursor = 'pointer';
    b.style.touchAction = 'manipulation';
    b.addEventListener('touchstart', ()=>{}, {passive:true});
    b.onmousedown = ()=>{};
    b.textContent = text;
    return b;
  }

  function createGhostBtn(text){
    const b = document.createElement('button');
    b.type = 'button';
    b.style.width = '100%';
    b.style.border = '1px solid rgba(255,255,255,.16)';
    b.style.borderRadius = '14px';
    b.style.padding = '12px 12px';
    b.style.fontWeight = '1000';
    b.style.fontSize = '14px';
    b.style.background = 'rgba(255,255,255,.10)';
    b.style.color = '#fff';
    b.style.cursor = 'pointer';
    b.style.touchAction = 'manipulation';
    b.addEventListener('touchstart', ()=>{}, {passive:true});
    b.onmousedown = ()=>{};
    b.textContent = text;
    return b;
  }

  function ensureTrainingUI(){
    if (!T) return null;

    const panel = findTeamPanel();
    if (!panel) return null;

    const existing = panel.querySelector?.('#teamTrainingSection');
    if (existing){
      trainingUI = {
        root: existing,
        memberTabs: existing.querySelector('.ttMemberTabs'),
        goldRow: existing.querySelector('.ttGoldRow'),
        upArea: existing.querySelector('.ttUpArea'),
        passiveArea: existing.querySelector('.ttPassiveArea'),
        msg: existing.querySelector('.ttMsg'),
        logBtn: existing.querySelector('.ttLogBtn')
      };
      return trainingUI;
    }

    const section = document.createElement('div');
    section.id = 'teamTrainingSection';
    section.style.marginTop = '12px';

    section.appendChild(createSectionTitle('育成（成長 / パッシブ強化）'));
    section.appendChild(createSubText('タップで + を保留。決定でまとめて反映します。足りない時は反映しません。'));

    const memberTabs = createTabRow();
    memberTabs.className = 'ttMemberTabs';
    section.appendChild(memberTabs);

    const goldRow = document.createElement('div');
    goldRow.className = 'ttGoldRow';
    goldRow.style.display = 'flex';
    goldRow.style.flexWrap = 'wrap';
    goldRow.style.gap = '8px';
    goldRow.style.marginTop = '10px';
    section.appendChild(goldRow);

    // ★ログ閲覧ボタン（ポップアップ）
    const logBtn = createGhostBtn('育成ログを見る');
    logBtn.className = 'ttLogBtn';
    logBtn.style.marginTop = '10px';
    logBtn.addEventListener('click', ()=>openLogsPopup());
    section.appendChild(logBtn);

    const msg = document.createElement('div');
    msg.className = 'ttMsg';
    msg.style.marginTop = '8px';
    msg.style.fontSize = '12px';
    msg.style.lineHeight = '1.35';
    msg.style.opacity = '0.95';
    msg.style.display = 'none';
    msg.style.padding = '10px 10px';
    msg.style.borderRadius = '12px';
    msg.style.border = '1px solid rgba(255,255,255,.16)';
    msg.style.background = 'rgba(0,0,0,.25)';
    section.appendChild(msg);

    section.appendChild(createSectionTitle('成長（能力アップ）'));
    const upArea = document.createElement('div');
    upArea.className = 'ttUpArea';
    upArea.style.marginTop = '10px';
    section.appendChild(upArea);

    section.appendChild(createSectionTitle('パッシブ（強化）'));
    const passiveArea = document.createElement('div');
    passiveArea.className = 'ttPassiveArea';
    passiveArea.style.marginTop = '10px';
    section.appendChild(passiveArea);

    panel.appendChild(section);

    trainingUI = { root: section, memberTabs, goldRow, upArea, passiveArea, msg, logBtn };
    return trainingUI;
  }

  function showMsg(text){
    const ui = ensureTrainingUI();
    if (!ui || !ui.msg) return;
    ui.msg.textContent = String(text || '');
    ui.msg.style.display = text ? 'block' : 'none';
  }

  // =========================================================
  // pending state（保留）
  // =========================================================

  let ttSelectedId = 'A';

  // 成長（能力アップ）保留
  let pendingUp = {
    A: { hp:0, aim:0, tech:0, mental:0 },
    B: { hp:0, aim:0, tech:0, mental:0 },
    C: { hp:0, aim:0, tech:0, mental:0 }
  };

  // パッシブ（強化）保留：memberId -> { passiveId: +count }
  let pendingPassive = { A:{}, B:{}, C:{} };

  function resetPendingUp(){
    pendingUp = {
      A: { hp:0, aim:0, tech:0, mental:0 },
      B: { hp:0, aim:0, tech:0, mental:0 },
      C: { hp:0, aim:0, tech:0, mental:0 }
    };
  }

  function resetPendingPassive(){
    pendingPassive = { A:{}, B:{}, C:{} };
  }

  function resetPendingAll(){
    resetPendingUp();
    resetPendingPassive();
  }

  function getMemById(team, id){
    return (team?.members || []).find(m => String(m?.id) === String(id));
  }

  // =========================================================
  // 表示フォーマット（発動率/効果）
  // =========================================================

  function formatChance(def, plus){
    const base = Number(def?.baseChance || 0);
    const p = clamp0to30(Number(plus || 0));
    const v = Math.min(100, base + p);
    return `${v.toFixed(1)}%`;
  }

  function formatEffect(def, plus){
    const base = Number(def?.baseEffect || 0);
    const p = clamp0to30(Number(plus || 0));
    const v = base + p;

    if (def?.type === 'block_debuff'){
      return 'デバフイベント発生なし';
    }
    return `${v}%`;
  }

  // =========================================================
  // G不足（便利ログ）
  // =========================================================

  function buildShortageLines(title, needG, haveG, detailLines){
    const lines = [];
    lines.push(title || '不足');
    lines.push('────────────────────────');
    lines.push(`所持G：${formatG(haveG)}`);
    lines.push(`必要G：${formatG(needG)}`);
    lines.push(`不足G：${formatG(Math.max(0, needG - haveG))}`);
    if (Array.isArray(detailLines) && detailLines.length){
      lines.push('');
      lines.push('内訳：');
      detailLines.forEach(l=>lines.push(`  ${l}`));
    }
    lines.push('');
    lines.push('※Gが足りないので反映しませんでした。');
    return lines;
  }

  // =========================================================
  // 成長（能力アップ）反映（G消費）
  // =========================================================

  function applyPendingUpToTeam(team){
    const ids = ['A','B','C'];

    // cost集計（保留分のみ）
    let needG = 0;
    const detail = [];

    for (const id of ids){
      const mem = getMemById(team, id);
      if (!mem) continue;

      // upgradeCount を安全化
      mem.upgradeCount = mem.upgradeCount || { hp:0, aim:0, tech:0, mental:0 };

      for (const s of ['hp','aim','tech','mental']){
        const add = Number(pendingUp?.[id]?.[s] || 0);
        if (add > 0){
          const c = goldCostForStat(mem, s, add);
          needG += c;

          const name = (T?.getMemberNameById ? T.getMemberNameById(id) : id);
          detail.push(`${name} ${s.toUpperCase()} +${add}：${formatG(c)}`);
        }
      }
    }

    if (needG <= 0){
      return { ok:false, reason:'保留がありません（成長）', needG:0, detail:[] };
    }

    const haveG = getGold();
    if (haveG < needG){
      return { ok:false, reason:'Gが足りません（成長）', needG, haveG, detail };
    }

    // 反映（G消費 → ステ加算）
    setGold(haveG - needG);

    for (const id of ids){
      const mem = getMemById(team, id);
      if (!mem) continue;

      mem.stats = mem.stats || {};
      mem.upgradeCount = mem.upgradeCount || { hp:0, aim:0, tech:0, mental:0 };

      for (const s of ['hp','aim','tech','mental']){
        const add = Number(pendingUp?.[id]?.[s] || 0);
        if (add <= 0) continue;

        const cur = T?.clamp0to99 ? T.clamp0to99(Number(mem.stats[s] || 0)) : clamp(Number(mem.stats[s]||0), 0, 99);
        const next = T?.clamp0to99 ? T.clamp0to99(cur + add) : clamp(cur + add, 0, 99);

        mem.stats[s] = next;
        mem.upgradeCount[s] = clamp0(Number(mem.upgradeCount[s] || 0) + add);
      }
    }

    return { ok:true, needG, haveGBefore: haveG, haveGAfter: haveG - needG, detail };
  }

  // =========================================================
  // パッシブ強化反映（G消費）
  // =========================================================

  function getPassivePlus(mem, pid){
    const p = Number(mem?.skills?.[pid]?.plus || 0);
    return clamp0to30(p);
  }

  function setPassivePlus(mem, pid, plus){
    mem.skills = mem.skills || {};
    if (!mem.skills[pid]) mem.skills[pid] = { plus:0 };
    mem.skills[pid].plus = clamp0to30(Number(plus || 0));
  }

  function applyPendingPassiveToTeam(team){
    const ids = ['A','B','C'];

    let needG = 0;
    const detail = [];

    for (const id of ids){
      const mem = getMemById(team, id);
      if (!mem) continue;

      mem.skills = (mem.skills && typeof mem.skills === 'object') ? mem.skills : {};

      const pmap = pendingPassive[id] || {};
      for (const pid in pmap){
        const add = Number(pmap[pid] || 0);
        if (add <= 0) continue;

        const curPlus = getPassivePlus(mem, pid);
        if (curPlus >= 30) continue;

        const realAdd = Math.max(0, Math.min(add, 30 - curPlus));
        const c = goldCostForPassivePlus(curPlus, realAdd);
        needG += c;

        const name = (T?.getMemberNameById ? T.getMemberNameById(id) : id);
        const def = PASSIVE_BY_ID[pid];
        const pname = def?.name || pid;
        detail.push(`${name} ${pname} +${realAdd}：${formatG(c)}`);
      }
    }

    if (needG <= 0){
      return { ok:false, reason:'保留がありません（パッシブ）', needG:0, detail:[] };
    }

    const haveG = getGold();
    if (haveG < needG){
      return { ok:false, reason:'Gが足りません（パッシブ）', needG, haveG, detail };
    }

    setGold(haveG - needG);

    for (const id of ids){
      const mem = getMemById(team, id);
      if (!mem) continue;

      mem.skills = (mem.skills && typeof mem.skills === 'object') ? mem.skills : {};

      const pmap = pendingPassive[id] || {};
      for (const pid in pmap){
        const add = Number(pmap[pid] || 0);
        if (add <= 0) continue;

        const curPlus = getPassivePlus(mem, pid);
        if (curPlus >= 30) continue;

        const realAdd = Math.max(0, Math.min(add, 30 - curPlus));
        setPassivePlus(mem, pid, curPlus + realAdd);
      }
    }

    return { ok:true, needG, haveGBefore: haveG, haveGAfter: haveG - needG, detail };
  }

  // =========================================================
  // 反映結果ログ（超強化）
  // =========================================================

  function buildApplyResultLines(beforeTeam, afterTeam, title, goldBefore, goldAfter, spentDetail){
    const lines = [];
    lines.push(title || '育成反映');
    lines.push('────────────────────────');
    lines.push(`G：${formatG(goldBefore)} → ${formatG(goldAfter)}（消費 ${formatG(Math.max(0, goldBefore - goldAfter))}）`);
    if (Array.isArray(spentDetail) && spentDetail.length){
      lines.push('');
      lines.push('内訳：');
      spentDetail.slice(0, 60).forEach(d=>lines.push(`  ${d}`));
    }
    lines.push('');
    lines.push('────────────────────────');

    const ids = ['A','B','C'];

    ids.forEach(id=>{
      const b = getMemById(beforeTeam, id);
      const a = getMemById(afterTeam, id);
      if (!b || !a) return;

      const name = (T?.getMemberNameById ? T.getMemberNameById(id) : id);
      const role = (T?.getMemberRole ? T.getMemberRole(a) : (a.role || ''));
      lines.push(`■ ${name}${role ? `（${role}）` : ''}`);

      // 成長（4ステ）
      let anyStat = false;
      for (const s of ['hp','aim','tech','mental']){
        const bv = Number(b?.stats?.[s] || 0);
        const av = Number(a?.stats?.[s] || 0);
        if (av !== bv){
          anyStat = true;
          const d = av - bv;
          const nearMax = (av >= 99) ? ' ★MAX' : ((av >= 95) ? '（もう少し）' : '');
          lines.push(`  ${s.toUpperCase()}: ${bv} → ${av}（+${d}）${nearMax}`);
        }
      }
      if (!anyStat) lines.push('  成長：なし');

      // パッシブ（強化）
      const changed = [];
      for (const pid in PASSIVE_BY_ID){
        const def = PASSIVE_BY_ID[pid];
        const bp = Number(b?.skills?.[pid]?.plus || 0);
        const ap = Number(a?.skills?.[pid]?.plus || 0);
        if (ap !== bp){
          changed.push(`  ${def.name}: +${bp} → +${ap}（発動率 ${formatChance(def, ap)} / 効果 ${formatEffect(def, ap)}）`);
        }
      }
      if (changed.length){
        lines.push('  パッシブ：');
        changed.forEach(x=>lines.push(x));
      }else{
        lines.push('  パッシブ変化：なし');
      }

      lines.push('');
    });

    return lines;
  }

  // =========================================================
  // render pieces
  // =========================================================

  function renderGoldRow(){
    const ui = ensureTrainingUI();
    if (!ui || !ui.goldRow) return;

    ui.goldRow.innerHTML = '';
    ui.goldRow.appendChild(createMiniPill(`所持G：${formatG(getGold())}`));
    ui.goldRow.appendChild(createMiniPill('成長：G消費'));
    ui.goldRow.appendChild(createMiniPill('パッシブ：Gで強化'));
  }

  function renderMemberTabs(team){
    const ui = ensureTrainingUI();
    if (!ui || !ui.memberTabs) return;

    ui.memberTabs.innerHTML = '';

    const ids = ['A','B','C'];
    ids.forEach(id=>{
      const mem = getMemById(team, id);
      const name = T.getMemberNameById(id);
      const role = T.getMemberRole(mem);
      const label = role ? `${name}（${role}）` : name;

      const btn = createTabBtn(label, ttSelectedId === id);
      btn.addEventListener('click', ()=>{
        ttSelectedId = id;
        showMsg('');
        render();
      });
      ui.memberTabs.appendChild(btn);
    });
  }

  function renderUpArea(team){
    const ui = ensureTrainingUI();
    if (!ui || !ui.upArea) return;

    ui.upArea.innerHTML = '';

    const mem = getMemById(team, ttSelectedId);
    if (!mem) return;

    // 既存 passive を “使わない” ので、ここで UI上も前提を明確化（データを消す処理はしない）
    // ※「既存のパッシブは消して」は仕様として “使用しない” で対応（データ破壊を避ける）
    // mem.passive は参照しません。

    const card = createCard();

    const head = document.createElement('div');
    head.style.display = 'flex';
    head.style.justifyContent = 'space-between';
    head.style.alignItems = 'baseline';
    head.style.gap = '10px';

    const left = document.createElement('div');
    left.style.fontWeight = '1000';
    left.style.fontSize = '14px';
    left.textContent = `${T.getMemberNameById(mem.id)}：成長`;

    const right = document.createElement('div');
    right.style.display = 'flex';
    right.style.gap = '6px';
    right.style.flexWrap = 'wrap';
    right.appendChild(createMiniPill('上限 99'));
    right.appendChild(createMiniPill('G消費'));
    head.appendChild(left);
    head.appendChild(right);
    card.appendChild(head);

    const note = document.createElement('div');
    note.style.marginTop = '8px';
    note.style.fontSize = '12px';
    note.style.opacity = '0.92';
    note.style.lineHeight = '1.35';
    note.textContent = 'タップで + を保留します。決定でまとめて反映します。';
    card.appendChild(note);

    const list = document.createElement('div');
    list.style.marginTop = '10px';
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.gap = '10px';

    // upgradeCount 安全化
    mem.upgradeCount = mem.upgradeCount || { hp:0, aim:0, tech:0, mental:0 };

    UP_STATS.forEach(st=>{
      const row = document.createElement('div');
      row.style.display = 'grid';
      row.style.gridTemplateColumns = '1fr auto';
      row.style.gap = '10px';
      row.style.alignItems = 'center';

      const info = document.createElement('div');

      const curVal = T.clamp0to99(Number(mem?.stats?.[st.key] || 0));
      const pend = Number(pendingUp?.[mem.id]?.[st.key] || 0);
      const after = T.clamp0to99(curVal + pend);

      const line1 = document.createElement('div');
      line1.style.fontWeight = '1000';
      line1.style.fontSize = '13px';
      line1.textContent = `${st.label}：${curVal}  →  ${after}${pend>0 ? `（+${pend}）` : ''}`;

      const costPend = pend > 0 ? goldCostForStat(mem, st.key, pend) : 0;
      const costNext1 = (curVal >= 99) ? 0 : goldCostForStat(mem, st.key, 1);

      const line2 = document.createElement('div');
      line2.style.marginTop = '4px';
      line2.style.fontSize = '12px';
      line2.style.opacity = '0.92';
      line2.textContent = `次+1コスト：${formatG(costNext1)} / 保留分コスト：${formatG(costPend)}`;

      // “あと少し” 表示（便利ログの補助）
      const line3 = document.createElement('div');
      line3.style.marginTop = '4px';
      line3.style.fontSize = '12px';
      line3.style.opacity = '0.88';
      const remain = Math.max(0, 99 - after);
      line3.textContent = remain === 0 ? 'MAXです。' : `MAXまで残り：${remain}`;

      info.appendChild(line1);
      info.appendChild(line2);
      info.appendChild(line3);

      const btnCol = document.createElement('div');
      btnCol.style.display = 'flex';
      btnCol.style.flexDirection = 'column';
      btnCol.style.gap = '6px';
      btnCol.style.minWidth = '120px';

      const plusBtn = createGhostBtn('＋1');
      plusBtn.style.padding = '10px 10px';
      plusBtn.addEventListener('click', ()=>{
        const cur = T.clamp0to99(Number(mem?.stats?.[st.key] || 0));
        const pendNow = Number(pendingUp?.[mem.id]?.[st.key] || 0);
        if (cur + pendNow >= 99){
          showMsg('ステータス上限（99）です。');
          return;
        }
        pendingUp[mem.id][st.key] = pendNow + 1;
        showMsg('');
        render();
      });

      const minusBtn = createGhostBtn('－1');
      minusBtn.style.padding = '10px 10px';
      minusBtn.addEventListener('click', ()=>{
        const pendNow = Number(pendingUp?.[mem.id]?.[st.key] || 0);
        if (pendNow <= 0) return;
        pendingUp[mem.id][st.key] = pendNow - 1;
        showMsg('');
        render();
      });

      const pendTag = document.createElement('div');
      pendTag.style.textAlign = 'right';
      pendTag.style.fontSize = '12px';
      pendTag.style.fontWeight = '1000';
      pendTag.style.opacity = '0.95';
      pendTag.textContent = pend > 0 ? `保留：+${pend}` : '保留：0';

      btnCol.appendChild(plusBtn);
      btnCol.appendChild(minusBtn);
      btnCol.appendChild(pendTag);

      row.appendChild(info);
      row.appendChild(btnCol);
      list.appendChild(row);
    });

    card.appendChild(list);

    const btns = document.createElement('div');
    btns.style.marginTop = '12px';
    btns.style.display = 'grid';
    btns.style.gridTemplateColumns = '1fr 1fr';
    btns.style.gap = '10px';

    const btnCommit = createPrimaryBtn('決定（成長を反映）');
    btnCommit.addEventListener('click', ()=>{
      const team2 = T.clone(team);
      T.ensureTeamMeta(team2);

      // before snapshot（ログ用）
      const before = T.clone(team);

      const goldBefore = getGold();
      const res = applyPendingUpToTeam(team2);

      if (!res.ok){
        if (res.needG && typeof res.haveG === 'number'){
          const lines = buildShortageLines('成長：G不足', res.needG, res.haveG, res.detail);
          pushTrainingLog({ at: nowISO(), title:'成長：不足', lines });
          openPopup('成長：反映できません', lines);
        }else{
          showMsg(res.reason || '反映できません');
        }
        return;
      }

      // 保存（チーム）
      T.writePlayerTeam(team2);

      // 保留クリア（成長だけ）
      resetPendingUp();

      // 再描画
      showMsg('成長を反映しました。');
      renderGoldRow();
      T.renderTeamPower();
      T.render();

      // ログ生成＆ポップアップ
      const goldAfter = getGold();
      const lines = buildApplyResultLines(before, team2, '育成：成長（反映結果）', goldBefore, goldAfter, res.detail);
      pushTrainingLog({ at: nowISO(), title:'成長：反映', lines });
      openPopup('成長：反映結果', lines);
    });

    const btnClear = createGhostBtn('保留をクリア');
    btnClear.addEventListener('click', ()=>{
      resetPendingUp();
      showMsg('保留（成長）をクリアしました。');
      render();
    });

    btns.appendChild(btnCommit);
    btns.appendChild(btnClear);
    card.appendChild(btns);

    ui.upArea.appendChild(card);
  }

  function renderPassiveArea(team){
    const ui = ensureTrainingUI();
    if (!ui || !ui.passiveArea) return;

    ui.passiveArea.innerHTML = '';

    const mem = getMemById(team, ttSelectedId);
    if (!mem) return;

    const card = createCard();

    const head = document.createElement('div');
    head.style.display = 'flex';
    head.style.justifyContent = 'space-between';
    head.style.alignItems = 'baseline';
    head.style.gap = '10px';

    const left = document.createElement('div');
    left.style.fontWeight = '1000';
    left.style.fontSize = '14px';
    left.textContent = `${T.getMemberNameById(mem.id)}：パッシブ`;

    const right = document.createElement('div');
    right.style.display = 'flex';
    right.style.gap = '6px';
    right.style.flexWrap = 'wrap';
    right.appendChild(createMiniPill('上限 +30'));
    right.appendChild(createMiniPill('10000G→+5000Gずつ増加'));
    head.appendChild(left);
    head.appendChild(right);
    card.appendChild(head);

    const note = document.createElement('div');
    note.style.marginTop = '8px';
    note.style.fontSize = '12px';
    note.style.opacity = '0.92';
    note.style.lineHeight = '1.35';
    note.textContent = 'パッシブは最初から持っています。強化（+）だけできます。';
    card.appendChild(note);

    const role = T.getMemberRole(mem);

    const list = document.createElement('div');
    list.style.marginTop = '10px';
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.gap = '10px';

    const passives = PASSIVES.filter(p => !role || p.role === role);
    if (!passives.length){
      const none = document.createElement('div');
      none.style.opacity = '0.92';
      none.style.fontSize = '13px';
      none.textContent = 'このメンバーのロールに対応するパッシブがありません。';
      list.appendChild(none);
    }

    passives.forEach(def=>{
      const row = document.createElement('div');
      row.style.borderRadius = '12px';
      row.style.padding = '12px';
      row.style.background = 'rgba(0,0,0,.18)';
      row.style.border = '1px solid rgba(255,255,255,.14)';

      const top = document.createElement('div');
      top.style.display = 'flex';
      top.style.justifyContent = 'space-between';
      top.style.alignItems = 'baseline';
      top.style.gap = '10px';

      const name = document.createElement('div');
      name.style.fontWeight = '1000';
      name.style.fontSize = '14px';
      name.textContent = def.name;

      const tag = document.createElement('div');
      tag.style.display = 'flex';
      tag.style.gap = '6px';
      tag.style.flexWrap = 'wrap';
      tag.appendChild(createMiniPill(def.role));
      tag.appendChild(createMiniPill(def.trigger));

      top.appendChild(name);
      top.appendChild(tag);

      const curPlus = getPassivePlus(mem, def.id);
      const pend = clamp0to30(Number((pendingPassive[mem.id] || {})[def.id] || 0));
      const nextPlus = clamp0to30(curPlus + pend);

      const line1 = document.createElement('div');
      line1.style.marginTop = '8px';
      line1.style.fontSize = '12px';
      line1.style.opacity = '0.95';
      line1.textContent = def.desc;

      const chanceText = formatChance(def, nextPlus);
      const effText = formatEffect(def, nextPlus);
      const resetNote = (def.trigger === '接敵時') ? '（交戦後リセット）' : '';

      const line2 = document.createElement('div');
      line2.style.marginTop = '6px';
      line2.style.fontSize = '12px';
      line2.style.opacity = '0.95';
      line2.textContent =
        `現在：+${curPlus} → +${nextPlus}${pend>0 ? `（保留+${pend}）` : ''} / 発動率：${chanceText} / 効果：${effText} ${resetNote}`;

      const costNext1 = (curPlus >= 30) ? 0 : goldCostForPassivePlus(curPlus, 1);
      const costPend = pend > 0 ? goldCostForPassivePlus(curPlus, Math.min(pend, 30-curPlus)) : 0;

      const line3 = document.createElement('div');
      line3.style.marginTop = '6px';
      line3.style.fontSize = '12px';
      line3.style.opacity = '0.92';
      line3.textContent =
        `次+1コスト：${formatG(costNext1)} / 保留分コスト：${formatG(costPend)}`;

      const btnRow = document.createElement('div');
      btnRow.style.marginTop = '10px';
      btnRow.style.display = 'grid';
      btnRow.style.gridTemplateColumns = '1fr 1fr';
      btnRow.style.gap = '8px';

      const btnPlus = createGhostBtn('＋1');
      btnPlus.style.padding = '10px 10px';
      btnPlus.addEventListener('click', ()=>{
        const cur = getPassivePlus(mem, def.id);
        const pendNow = clamp0to30(Number((pendingPassive[mem.id] || {})[def.id] || 0));
        if (cur + pendNow >= 30){
          showMsg('パッシブ強化上限（+30）です。');
          return;
        }
        pendingPassive[mem.id] = pendingPassive[mem.id] || {};
        pendingPassive[mem.id][def.id] = pendNow + 1;
        showMsg('');
        render();
      });

      const btnMinus = createGhostBtn('－1');
      btnMinus.style.padding = '10px 10px';
      btnMinus.addEventListener('click', ()=>{
        const pendNow = clamp0to30(Number((pendingPassive[mem.id] || {})[def.id] || 0));
        if (pendNow <= 0) return;
        pendingPassive[mem.id][def.id] = pendNow - 1;
        showMsg('');
        render();
      });

      btnRow.appendChild(btnPlus);
      btnRow.appendChild(btnMinus);

      row.appendChild(top);
      row.appendChild(line1);
      row.appendChild(line2);
      row.appendChild(line3);
      row.appendChild(btnRow);

      list.appendChild(row);
    });

    card.appendChild(list);

    const btns = document.createElement('div');
    btns.style.marginTop = '12px';
    btns.style.display = 'grid';
    btns.style.gridTemplateColumns = '1fr 1fr';
    btns.style.gap = '10px';

    const btnCommit = createPrimaryBtn('決定（パッシブ強化を反映）');
    btnCommit.addEventListener('click', ()=>{
      const team2 = T.clone(team);
      T.ensureTeamMeta(team2);

      // before snapshot（ログ用）
      const before = T.clone(team);

      const goldBefore = getGold();
      const res = applyPendingPassiveToTeam(team2);

      if (!res.ok){
        if (res.needG && typeof res.haveG === 'number'){
          const lines = buildShortageLines('パッシブ：G不足', res.needG, res.haveG, res.detail);
          pushTrainingLog({ at: nowISO(), title:'パッシブ：不足', lines });
          openPopup('パッシブ：反映できません', lines);
        }else{
          showMsg(res.reason || '反映できません');
        }
        return;
      }

      // 保存（チーム）
      T.writePlayerTeam(team2);

      // 保留クリア（パッシブだけ）
      resetPendingPassive();

      // 再描画
      showMsg('パッシブ強化を反映しました。');
      renderGoldRow();
      T.renderTeamPower();
      T.render();

      // ログ生成＆ポップアップ
      const goldAfter = getGold();
      const lines = buildApplyResultLines(before, team2, '育成：パッシブ（反映結果）', goldBefore, goldAfter, res.detail);
      pushTrainingLog({ at: nowISO(), title:'パッシブ：反映', lines });
      openPopup('パッシブ：反映結果', lines);
    });

    const btnClear = createGhostBtn('保留をクリア');
    btnClear.addEventListener('click', ()=>{
      resetPendingPassive();
      showMsg('保留（パッシブ）をクリアしました。');
      render();
    });

    btns.appendChild(btnCommit);
    btns.appendChild(btnClear);
    card.appendChild(btns);

    ui.passiveArea.appendChild(card);
  }

  // =========================================================
  // main render
  // =========================================================

  function render(){
    if (!T) return;

    const team = T.migrateAndPersistTeam();
    const mem = getMemById(team, ttSelectedId) || getMemById(team, 'A');
    if (!mem) return;

    renderMemberTabs(team);
    renderGoldRow();
    renderUpArea(team);
    renderPassiveArea(team);
  }

  // 外部公開（core から呼ぶ）
  window.MOBBR.uiTeamTraining.render = render;

})();
