'use strict';

/*
  MOB BR - ui_team_training.js v18-growth（FULL）
  - ui_team_core.js が提供する coreApi に attach して動作
  - 育成＝成長（ゲージ） / パッシブ＝Gで強化
  - ★追加（今回）
    ✅ メンバー名タップで「パッシブ強化ポップアップ」を開ける API を実装
       window.MOBBR.uiTeamTraining.openPassivePopup(memberId)
    ✅ パッシブは最初から装備済み（ロールに応じて自動付与）

  ✅ FIX（今回）:
    - core が先にロード済みの場合、attach() が即時実行される
    - その中で ensureTrainingUI() が呼ばれ、trainingUI を参照
    - しかし trainingUI が let 宣言より前だと TDZ で落ちる
    => trainingUI を attach より前に初期化してTDZを防止（機能削除なし）
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.uiTeamTraining = window.MOBBR.uiTeamTraining || {};

(function(){

  let T = null; // coreApi

  // =========================================================
  // UI injection state
  // ✅ FIX: attach が先に走っても安全な位置に置く（TDZ回避）
  // =========================================================
  let trainingUI = null;

  function attach(coreApi){
    T = coreApi || null;

    // coreが先にロードされているケース対応
    if (!T && window.MOBBR?._uiTeamCore) T = window.MOBBR._uiTeamCore;

    if (!T){
      console.warn('[ui_team_training] coreApi missing');
      return;
    }

    // core側へ showMsg を差し込み（必要なら使う）
    T.showMsg = showMsg;

    // 初回UI生成
    ensureTrainingUI();
  }

  if (!window.MOBBR.uiTeamTraining.attach){
    window.MOBBR.uiTeamTraining.attach = attach;
  }
  if (window.MOBBR?._uiTeamCore){
    attach(window.MOBBR._uiTeamCore);
  }

  // =========================================================
  // 定数
  // =========================================================

  const UP_STATS = [
    { key:'hp',     label:'体力'   },
    { key:'aim',    label:'エイム' },
    { key:'tech',   label:'技術'   },
    { key:'mental', label:'メンタル' }
  ];

  const TRAIN_LOG_KEY = 'mobbr:trainingLogs:v2'; // v2（ポイント廃止/成長対応）
  const TRAIN_LOG_LIMIT = 160;

  const GKEY = 'mobbr_gold';

  // 成長ゲージ（0..100で+1、余り繰り越し）
  const GROW_MAX = 100;

  // 「あと少し」判定（ゲージがこの値以上）
  const NEAR_UP_TH = 85;

  // 1回のトレーニングで増える量（ランダム）
  const GROW_ADD_MIN = 12;
  const GROW_ADD_MAX = 26;

  // ステ上限
  const STAT_MAX = 99;

  // パッシブ強化コスト
  const PASSIVE_COST_BASE = 10000;
  const PASSIVE_COST_STEP = 5000;
  const PASSIVE_PLUS_MAX = 30;

  // =========================================================
  // パッシブ定義（旧SKILLSをそのまま流用）
  // ※「取得」はしない。存在するものを強化するだけ。
  // =========================================================

  const PASSIVES = [
    // IGL
    {
      id:'igl_inspire',
      role:'IGL',
      name:'閃きと輝き',
      baseChance: 1.0,      // 後で 5.0 へ補正
      trigger:'接敵時',
      type:'buff_team',
      baseEffect: 10,
      desc:'接敵時に発動。チーム全員のステータスを10%アップ。'
    },
    {
      id:'igl_control',
      role:'IGL',
      name:'空間制圧',
      baseChance: 0.5,      // 後で 2.0 へ補正
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
      baseChance: 1.0,      // → 5.0
      trigger:'接敵時',
      type:'buff_self_aim',
      baseEffect: 20,
      desc:'接敵時に発動。自身のエイムが20%アップ。'
    },
    {
      id:'atk_physical',
      role:'アタッカー',
      name:'フィジカルモンスター',
      baseChance: 0.5,      // → 2.0
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
      baseChance: 1.0,      // → 5.0
      trigger:'マッチ開始時',
      type:'block_debuff',
      baseEffect: 100,
      desc:'マッチ開始時に発動。発動した試合でデバフイベントが発生しなくなる。'
    },
    {
      id:'sup_godcover',
      role:'サポーター',
      name:'神カバー',
      baseChance: 5.0,      // これはそのまま
      trigger:'接敵時',
      type:'buff_others',
      baseEffect: 5,
      desc:'接敵時に発動。自分以外の全能力を5%アップ。'
    }
  ];

  // ★発動率初期値補正（あなたの指定）
  PASSIVES.forEach(p=>{
    if (Number(p.baseChance) === 1.0) p.baseChance = 5.0;
    else if (Number(p.baseChance) === 0.5) p.baseChance = 2.0;
  });

  const PASSIVE_BY_ID = Object.fromEntries(PASSIVES.map(p => [p.id, p]));

  // =========================================================
  // util
  // =========================================================

  function clamp(n, min, max){
    const v = Number(n);
    if (!Number.isFinite(v)) return min;
    return Math.max(min, Math.min(max, v));
  }
  function clamp0(n){ return Math.max(0, Number.isFinite(Number(n)) ? Number(n) : 0); }

  function nowISO(){
    try { return new Date().toISOString(); } catch(e){ return ''; }
  }

  function safeJsonParse(s, fallback){
    try{ return JSON.parse(s); }catch(e){ return fallback; }
  }

  function getGold(){
    // 可能なら storage.js を使う
    const S = window.MOBBR?.storage;
    if (S?.getNum && S?.KEYS?.gold){
      return Number(S.getNum(S.KEYS.gold, 0)) || 0;
    }
    return Number(localStorage.getItem(GKEY) || 0) || 0;
  }

  function setGold(v){
    const n = Math.max(0, Number(v) || 0);
    const S = window.MOBBR?.storage;
    if (S?.setNum && S?.KEYS?.gold){
      S.setNum(S.KEYS.gold, n);
      return;
    }
    localStorage.setItem(GKEY, String(n));
  }

  // =========================================================
  // ログ（保存/閲覧/ポップアップ）
  // =========================================================

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

  function makeBtn(text, primary){
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    b.style.border = '1px solid rgba(255,255,255,.18)';
    b.style.borderRadius = '14px';
    b.style.padding = '12px 12px';
    b.style.fontWeight = '1000';
    b.style.fontSize = '14px';
    b.style.cursor = 'pointer';
    b.style.touchAction = 'manipulation';
    b.style.background = primary ? 'rgba(255,255,255,.86)' : 'rgba(255,255,255,.10)';
    b.style.color = primary ? '#111' : '#fff';
    b.addEventListener('touchstart', ()=>{}, {passive:true});
    b.onmousedown = ()=>{};
    return b;
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

    // 追加ボタン（任意、最大2つ）
    if (Array.isArray(footerButtons) && footerButtons.length){
      const extraRow = document.createElement('div');
      extraRow.style.marginTop = '10px';
      extraRow.style.display = 'grid';
      extraRow.style.gridTemplateColumns = '1fr 1fr';
      extraRow.style.gap = '10px';
      footerButtons.slice(0,2).forEach(b=>extraRow.appendChild(b));
      wrap.appendChild(extraRow);
    }

    const btnRow = document.createElement('div');
    btnRow.style.marginTop = '12px';
    btnRow.style.display = 'grid';
    btnRow.style.gridTemplateColumns = '1fr 1fr';
    btnRow.style.gap = '10px';

    const topBtn = makeBtn('先頭へ', true);
    topBtn.addEventListener('click', ()=>{ pop.scrollTop = 0; });

    const closeBtn = makeBtn('閉じる', false);
    closeBtn.addEventListener('click', ()=>{ pop.remove(); });

    btnRow.appendChild(topBtn);
    btnRow.appendChild(closeBtn);

    wrap.appendChild(btnRow);
    pop.appendChild(wrap);

    // ✅ スクロールリセット
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

    logs.slice(0, 50).forEach((e, idx)=>{
      lines.push(`【${idx+1}】${e.title || '育成'}  (${e.at || ''})`);
      (e.lines || []).slice(0, 80).forEach(l=>lines.push(`  ${l}`));
      lines.push('────────────────────────');
    });

    const clearBtn = makeBtn('ログ全削除', false);
    clearBtn.addEventListener('click', ()=>{
      clearTrainingLogs();
      openLogsPopup();
    });

    openPopup('育成ログ', lines, [clearBtn]);
  }

  // =========================================================
  // ★ポイント廃止/成長/パッシブ のデータ整形（互換）
  // =========================================================

  function ensureGrowth(mem){
    if (!mem || typeof mem !== 'object') return;
    if (!mem.growth || typeof mem.growth !== 'object'){
      mem.growth = { hp:0, aim:0, tech:0, mental:0 };
    }
    for (const s of ['hp','aim','tech','mental']){
      mem.growth[s] = clamp(Number(mem.growth[s] || 0), 0, GROW_MAX);
    }
  }

  function ensurePassives(mem){
    if (!mem || typeof mem !== 'object') return;

    // 正：passives
    if (!mem.passives || typeof mem.passives !== 'object'){
      // 旧: skills を passives に寄せる（残ってる場合は引き継ぐ）
      if (mem.skills && typeof mem.skills === 'object'){
        mem.passives = mem.skills;
      }else{
        mem.passives = {};
      }
    }

    // 既存の passive（文字列）は廃止（UI表示もこちらのpassivesに寄せる）
    if ('passive' in mem) mem.passive = '';

    // skills は他が参照してる可能性があるので“残して良い”
    if (!mem.skills || typeof mem.skills !== 'object'){
      mem.skills = {};
    }

    // plus 正規化
    for (const pid in mem.passives){
      const ent = mem.passives[pid];
      if (!ent || typeof ent !== 'object'){
        mem.passives[pid] = { plus:0 };
        continue;
      }
      ent.plus = clamp(Number(ent.plus || 0), 0, PASSIVE_PLUS_MAX);
    }
  }

  function ensureNoPoints(mem){
    if (!mem || typeof mem !== 'object') return;
    // stock/points 系は完全に使わない（残ってても表示/計算に使わない）
    // データは壊さない
  }

  // ✅ パッシブを「最初から装備済み」にする（ロールに応じて自動付与）
  function ensureDefaultEquippedPassives(mem){
    if (!mem || typeof mem !== 'object') return;
    ensurePassives(mem);

    const role = String(mem.role || '');
    if (!role) return;

    const defs = PASSIVES.filter(p => p.role === role);
    if (!defs.length) return;

    mem.passives = mem.passives || {};
    defs.forEach(d=>{
      if (!mem.passives[d.id] || typeof mem.passives[d.id] !== 'object'){
        mem.passives[d.id] = { plus:0 };
      }else{
        // plusだけ整形
        mem.passives[d.id].plus = clamp(Number(mem.passives[d.id].plus || 0), 0, PASSIVE_PLUS_MAX);
      }
    });
  }

  function migrateTeamForTraining(team){
    if (!team || typeof team !== 'object') return team;
    if (!Array.isArray(team.members)) team.members = [];
    for (const mem of team.members){
      ensureNoPoints(mem);
      ensureGrowth(mem);
      ensurePassives(mem);
      ensureDefaultEquippedPassives(mem); // ★追加：装備済み保証
    }
    return team;
  }

  // =========================================================
  // UI injection
  // =========================================================

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
        topRow: existing.querySelector('.ttTopRow'),
        logBtn: existing.querySelector('.ttLogBtn'),
        msg: existing.querySelector('.ttMsg'),
        growthArea: existing.querySelector('.ttGrowthArea'),
        passiveArea: existing.querySelector('.ttPassiveArea')
      };
      return trainingUI;
    }

    const section = document.createElement('div');
    section.id = 'teamTrainingSection';
    section.style.marginTop = '12px';

    section.appendChild(createSectionTitle('育成（成長 / パッシブ強化）'));
    section.appendChild(createSubText('ステータスは「トレーニング＝成長」で上がります。Gは使いません。Gはパッシブ強化だけ。'));

    const memberTabs = createTabRow();
    memberTabs.className = 'ttMemberTabs';
    section.appendChild(memberTabs);

    const topRow = document.createElement('div');
    topRow.className = 'ttTopRow';
    topRow.style.display = 'flex';
    topRow.style.flexWrap = 'wrap';
    topRow.style.gap = '8px';
    topRow.style.marginTop = '10px';
    section.appendChild(topRow);

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

    section.appendChild(createSectionTitle('成長（トレーニング）'));
    const growthArea = document.createElement('div');
    growthArea.className = 'ttGrowthArea';
    growthArea.style.marginTop = '10px';
    section.appendChild(growthArea);

    section.appendChild(createSectionTitle('パッシブ（Gで強化）'));
    const passiveArea = document.createElement('div');
    passiveArea.className = 'ttPassiveArea';
    passiveArea.style.marginTop = '10px';
    section.appendChild(passiveArea);

    panel.appendChild(section);

    trainingUI = { root: section, memberTabs, topRow, logBtn, msg, growthArea, passiveArea };
    return trainingUI;
  }

  function showMsg(text){
    const ui = ensureTrainingUI();
    if (!ui || !ui.msg) return;
    ui.msg.textContent = String(text || '');
    ui.msg.style.display = text ? 'block' : 'none';
  }

  // =========================================================
  // 描画
  // =========================================================

  let ttSelectedId = 'A';

  function getMemById(team, id){
    return (team?.members || []).find(m => String(m?.id) === String(id));
  }

  function getName(id){
    try{
      if (T?.getMemberNameById) return T.getMemberNameById(id);
    }catch(e){}
    return String(id);
  }

  function getRole(mem){
    try{
      if (T?.getMemberRole) return T.getMemberRole(mem);
    }catch(e){}
    return String(mem?.role || '');
  }

  function statVal(mem, key){
    const v = Number(mem?.stats?.[key] || 0);
    if (T?.clamp0to99) return T.clamp0to99(v);
    return clamp(v, 0, 99);
  }

  function growthVal(mem, key){
    return clamp(Number(mem?.growth?.[key] || 0), 0, GROW_MAX);
  }

  function renderMemberTabs(team){
    const ui = ensureTrainingUI();
    if (!ui || !ui.memberTabs) return;

    ui.memberTabs.innerHTML = '';

    ['A','B','C'].forEach(id=>{
      const mem = getMemById(team, id);
      const name = getName(id);
      const role = getRole(mem);
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

  function renderTopRow(team){
    const ui = ensureTrainingUI();
    if (!ui || !ui.topRow) return;
    ui.topRow.innerHTML = '';

    const g = getGold();
    ui.topRow.appendChild(createMiniPill(`所持G：${g}G`));
    ui.topRow.appendChild(createMiniPill(`成長ゲージ：${GROW_MAX}で+1`));
    ui.topRow.appendChild(createMiniPill(`あと少し：${NEAR_UP_TH}以上`));
  }

  // =========================================================
  // 成長（トレーニング）
  // =========================================================

  function randInt(min, max){
    const a = Math.ceil(min);
    const b = Math.floor(max);
    const r = Math.random();
    return Math.floor(a + r * (b - a + 1));
  }

  function buildTrainingLines(memBefore, memAfter, statKey, add, upCount){
    const name = getName(memAfter.id);
    const role = getRole(memAfter);

    const label = (UP_STATS.find(x=>x.key===statKey)?.label || statKey);
    const bStat = statVal(memBefore, statKey);
    const aStat = statVal(memAfter, statKey);
    const bGrow = growthVal(memBefore, statKey);
    const aGrow = growthVal(memAfter, statKey);

    const lines = [];
    lines.push(`${name}${role?`（${role}）`:''}：トレーニング（${label}）`);
    lines.push(`成長 +${add}  →  ゲージ ${bGrow} → ${aGrow}`);
    if (upCount > 0){
      lines.push(`成長！ ${label} ${bStat} → ${aStat}（+${aStat - bStat}）`);
    }else{
      if (aGrow >= NEAR_UP_TH){
        lines.push(`あと少しで成長！（${label}）`);
      }else{
        lines.push(`成長中…（${label}）`);
      }
    }
    return lines;
  }

  function applyTraining(team, memberId, statKey){
    const team2 = T?.clone ? T.clone(team) : safeJsonParse(JSON.stringify(team), team);
    migrateTeamForTraining(team2);

    const mem = getMemById(team2, memberId);
    if (!mem) return { ok:false, reason:'メンバーが見つかりません' };

    // before snapshot（1人だけで十分）
    const beforeMem = safeJsonParse(JSON.stringify(mem), mem);

    // 既に上限なら止める
    const curStat = statVal(mem, statKey);
    if (curStat >= STAT_MAX){
      return { ok:false, reason:'ステータス上限（99）です' };
    }

    const add = randInt(GROW_ADD_MIN, GROW_ADD_MAX);

    ensureGrowth(mem);
    let g = growthVal(mem, statKey);
    let stat = curStat;

    g += add;

    let upCount = 0;
    while (g >= GROW_MAX && stat < STAT_MAX){
      g -= GROW_MAX;
      stat += 1;
      upCount += 1;
    }

    mem.growth[statKey] = clamp(g, 0, GROW_MAX);
    mem.stats = mem.stats || {};
    mem.stats[statKey] = clamp(stat, 0, STAT_MAX);

    // 保存
    if (T?.writePlayerTeam){
      T.writePlayerTeam(team2);
    }else{
      try{ localStorage.setItem('mobbr_playerTeam', JSON.stringify(team2)); }catch(e){}
    }

    // UI更新
    try{ if (T?.renderTeamPower) T.renderTeamPower(); }catch(e){}
    try{ if (T?.render) T.render(); }catch(e){}

    const afterMem = getMemById(team2, memberId) || mem;

    const lines = buildTrainingLines(beforeMem, afterMem, statKey, add, upCount);

    // ログ保存＆ポップアップ
    pushTrainingLog({
      at: nowISO(),
      title: 'トレーニング',
      lines
    });

    openPopup('成長：トレーニング結果', lines);

    return { ok:true };
  }

  function renderGrowthArea(team){
    const ui = ensureTrainingUI();
    if (!ui || !ui.growthArea) return;

    ui.growthArea.innerHTML = '';

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
    left.textContent = `${getName(mem.id)}：成長（トレーニング）`;

    const right = document.createElement('div');
    right.style.display = 'flex';
    right.style.gap = '6px';
    right.style.flexWrap = 'wrap';
    right.appendChild(createMiniPill(`1回 +${GROW_ADD_MIN}〜${GROW_ADD_MAX}`));
    right.appendChild(createMiniPill(`ゲージ${GROW_MAX}で+1`));

    head.appendChild(left);
    head.appendChild(right);
    card.appendChild(head);

    const note = document.createElement('div');
    note.style.marginTop = '8px';
    note.style.fontSize = '12px';
    note.style.opacity = '0.92';
    note.style.lineHeight = '1.35';
    note.textContent = 'ボタンを押すと成長ゲージが進み、満タンでステータスが+1されます（Gは使いません）。';
    card.appendChild(note);

    const list = document.createElement('div');
    list.style.marginTop = '10px';
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.gap = '10px';

    migrateTeamForTraining(team); // 表示のため最低限整形

    UP_STATS.forEach(st=>{
      const row = document.createElement('div');
      row.style.display = 'grid';
      row.style.gridTemplateColumns = '1fr auto';
      row.style.gap = '10px';
      row.style.alignItems = 'center';

      const info = document.createElement('div');

      const sv = statVal(mem, st.key);
      const gv = growthVal(mem, st.key);

      const line1 = document.createElement('div');
      line1.style.fontWeight = '1000';
      line1.style.fontSize = '13px';
      line1.textContent = `${st.label}：${sv}（成長ゲージ ${gv}/${GROW_MAX}）`;

      const line2 = document.createElement('div');
      line2.style.marginTop = '4px';
      line2.style.fontSize = '12px';
      line2.style.opacity = '0.92';
      line2.textContent = (sv >= STAT_MAX)
        ? '上限（99）です。'
        : (gv >= NEAR_UP_TH ? 'あと少しで成長！' : '成長中…');

      info.appendChild(line1);
      info.appendChild(line2);

      const btnCol = document.createElement('div');
      btnCol.style.minWidth = '160px';
      btnCol.style.display = 'flex';
      btnCol.style.flexDirection = 'column';
      btnCol.style.gap = '8px';

      const trainBtn = createPrimaryBtn('トレーニング');
      trainBtn.style.padding = '10px 10px';
      trainBtn.addEventListener('click', ()=>{
        const res = applyTraining(team, mem.id, st.key);
        if (!res.ok){
          showMsg(res.reason || '失敗しました');
        }else{
          showMsg('');
        }
      });

      btnCol.appendChild(trainBtn);

      row.appendChild(info);
      row.appendChild(btnCol);
      list.appendChild(row);
    });

    card.appendChild(list);

    ui.growthArea.appendChild(card);
  }

  // =========================================================
  // パッシブ（Gで強化）
  // =========================================================

  function passivePlus(mem, pid){
    const v = Number(mem?.passives?.[pid]?.plus || 0);
    return clamp(v, 0, PASSIVE_PLUS_MAX);
  }

  function nextPassiveCost(curPlus){
    // 次の +1 に必要なG
    return PASSIVE_COST_BASE + (PASSIVE_COST_STEP * clamp0(curPlus));
  }

  function formatChance(def, plus){
    const base = Number(def?.baseChance || 0);
    const p = clamp(Number(plus || 0), 0, PASSIVE_PLUS_MAX);
    const v = Math.min(100, base + p);
    return `${v.toFixed(1)}%`;
  }

  function formatEffect(def, plus){
    const base = Number(def?.baseEffect || 0);
    const p = clamp(Number(plus || 0), 0, PASSIVE_PLUS_MAX);
    const v = base + p;
    if (def?.type === 'block_debuff'){
      return 'デバフイベント発生なし';
    }
    return `${v}%`;
  }

  function buildPassiveUpgradeLines(memBefore, memAfter, def, cost){
    const name = getName(memAfter.id);
    const role = getRole(memAfter);

    const bPlus = passivePlus(memBefore, def.id);
    const aPlus = passivePlus(memAfter, def.id);

    const lines = [];
    lines.push(`${name}${role?`（${role}）`:''}：パッシブ強化`);
    lines.push(`${def.name}  +${bPlus} → +${aPlus}`);
    lines.push(`消費：${cost}G`);
    lines.push(`所持G：${getGold()}G`);
    lines.push(`発動率：${formatChance(def, aPlus)} / 効果：${formatEffect(def, aPlus)}`);
    return lines;
  }

  function upgradePassive(team, memberId, passiveId){
    const def = PASSIVE_BY_ID[passiveId];
    if (!def) return { ok:false, reason:'パッシブ定義が見つかりません' };

    const team2 = T?.clone ? T.clone(team) : safeJsonParse(JSON.stringify(team), team);
    migrateTeamForTraining(team2);

    const mem = getMemById(team2, memberId);
    if (!mem) return { ok:false, reason:'メンバーが見つかりません' };

    const beforeMem = safeJsonParse(JSON.stringify(mem), mem);

    // ★装備済み保証（万一欠けててもここで作る）
    ensureDefaultEquippedPassives(mem);

    const curPlus = passivePlus(mem, passiveId);
    if (curPlus >= PASSIVE_PLUS_MAX){
      return { ok:false, reason:'パッシブ強化上限（+30）です' };
    }

    const cost = nextPassiveCost(curPlus);
    const g = getGold();
    if (g < cost){
      return { ok:false, reason:`Gが足りません（必要 ${cost}G）` };
    }

    // 消費
    setGold(g - cost);

    // 強化
    mem.passives = mem.passives || {};
    if (!mem.passives[passiveId]) mem.passives[passiveId] = { plus:0 };
    mem.passives[passiveId].plus = clamp(curPlus + 1, 0, PASSIVE_PLUS_MAX);

    // 保存
    if (T?.writePlayerTeam){
      T.writePlayerTeam(team2);
    }else{
      try{ localStorage.setItem('mobbr_playerTeam', JSON.stringify(team2)); }catch(e){}
    }

    // UI更新
    try{ if (T?.renderTeamPower) T.renderTeamPower(); }catch(e){}
    try{ if (T?.render) T.render(); }catch(e){}

    const afterMem = getMemById(team2, memberId) || mem;

    const lines = buildPassiveUpgradeLines(beforeMem, afterMem, def, cost);

    pushTrainingLog({
      at: nowISO(),
      title: 'パッシブ強化',
      lines
    });

    openPopup('パッシブ：強化結果', lines);

    return { ok:true };
  }

  // ★メンバー名タップ用：パッシブ強化ポップアップを開く
  // core側が openPassivePopup(memberId) を呼ぶ想定
  function openPassivePopup(memberId){
    const id = String(memberId || 'A');
    ttSelectedId = (id === 'A' || id === 'B' || id === 'C') ? id : 'A';
    showMsg('');

    // 最新チームを取って整形
    let team = null;
    try{
      team = T?.migrateAndPersistTeam ? T.migrateAndPersistTeam() : null;
    }catch(e){
      team = null;
    }
    if (!team){
      try{ team = safeJsonParse(localStorage.getItem('mobbr_playerTeam'), null); }catch(e){}
    }
    if (!team) return;

    migrateTeamForTraining(team);

    const mem = getMemById(team, ttSelectedId);
    if (!mem) return;

    // 装備済み保証＆保存（表示だけじゃなくデータに反映）
    ensureDefaultEquippedPassives(mem);
    try{
      if (T?.writePlayerTeam) T.writePlayerTeam(team);
      else localStorage.setItem('mobbr_playerTeam', JSON.stringify(team));
    }catch(e){}

    const role = getRole(mem);
    const defs = PASSIVES.filter(p => !role || p.role === role);

    const lines = [];
    lines.push(`${getName(mem.id)}${role?`（${role}）`:''}：パッシブ強化`);
    lines.push(`所持G：${getGold()}G`);
    lines.push('────────────────────────');

    if (!defs.length){
      lines.push('このメンバーのロールに対応するパッシブがありません。');
      openPopup('パッシブ（Gで強化）', lines);
      return;
    }

    defs.forEach(def=>{
      const curPlus = passivePlus(mem, def.id);
      const cost = (curPlus >= PASSIVE_PLUS_MAX) ? null : nextPassiveCost(curPlus);

      lines.push(`■ ${def.name}`);
      lines.push(`  ${def.desc}`);
      lines.push(`  現在：+${curPlus} / 発動率：${formatChance(def, curPlus)} / 効果：${formatEffect(def, curPlus)}`);
      if (curPlus >= PASSIVE_PLUS_MAX){
        lines.push('  強化上限です。');
      }else{
        lines.push(`  次の強化コスト：${cost}G`);
      }
      lines.push('');
    });

    // ここで「強化ボタン」を2つまで付ける（スマホの操作性優先）
    // ロールごとに2つある想定なので、その2つをボタン化
    const buttons = [];
    defs.slice(0,2).forEach(def=>{
      const curPlus = passivePlus(mem, def.id);
      const cost = (curPlus >= PASSIVE_PLUS_MAX) ? null : nextPassiveCost(curPlus);

      const b = makeBtn(
        (curPlus >= PASSIVE_PLUS_MAX) ? `${def.name}（上限）` : `${def.name} を強化（${cost}G）`,
        true
      );
      b.style.background = (curPlus >= PASSIVE_PLUS_MAX) ? 'rgba(255,255,255,.10)' : 'rgba(255,255,255,.86)';
      b.style.color = (curPlus >= PASSIVE_PLUS_MAX) ? '#fff' : '#111';
      b.style.opacity = (curPlus >= PASSIVE_PLUS_MAX) ? '0.6' : '1';
      b.disabled = (curPlus >= PASSIVE_PLUS_MAX);

      b.addEventListener('click', ()=>{
        // 再取得してから強化（ポップアップ内で数値が古くならない）
        let team2 = null;
        try{
          team2 = T?.migrateAndPersistTeam ? T.migrateAndPersistTeam() : null;
        }catch(e){
          team2 = null;
        }
        if (!team2){
          try{ team2 = safeJsonParse(localStorage.getItem('mobbr_playerTeam'), null); }catch(e){}
        }
        if (!team2) return;

        migrateTeamForTraining(team2);

        const res = upgradePassive(team2, ttSelectedId, def.id);
        if (!res.ok){
          showMsg(res.reason || '失敗しました');
          return;
        }

        // もう一回このポップアップを開き直して更新
        openPassivePopup(ttSelectedId);

        // training UI も更新
        try{ render(); }catch(e){}
      });

      buttons.push(b);
    });

    openPopup('パッシブ（Gで強化）', lines, buttons);

    // ついでに育成UIも “選択中メンバー” を同期して描画
    try{ render(); }catch(e){}
  }

  function renderPassiveArea(team){
    const ui = ensureTrainingUI();
    if (!ui || !ui.passiveArea) return;

    ui.passiveArea.innerHTML = '';

    const mem = getMemById(team, ttSelectedId);
    if (!mem) return;

    migrateTeamForTraining(team);

    // ★装備済み保証（画面表示でも担保）
    ensureDefaultEquippedPassives(mem);

    const card = createCard();

    const head = document.createElement('div');
    head.style.display = 'flex';
    head.style.justifyContent = 'space-between';
    head.style.alignItems = 'baseline';
    head.style.gap = '10px';

    const left = document.createElement('div');
    left.style.fontWeight = '1000';
    left.style.fontSize = '14px';
    left.textContent = `${getName(mem.id)}：パッシブ（Gで強化）`;

    const right = document.createElement('div');
    right.style.display = 'flex';
    right.style.gap = '6px';
    right.style.flexWrap = 'wrap';
    right.appendChild(createMiniPill(`+1: ${PASSIVE_COST_BASE}G`));
    right.appendChild(createMiniPill(`増分: +${PASSIVE_COST_STEP}G`));
    right.appendChild(createMiniPill(`上限 +${PASSIVE_PLUS_MAX}`));

    head.appendChild(left);
    head.appendChild(right);
    card.appendChild(head);

    const note = document.createElement('div');
    note.style.marginTop = '8px';
    note.style.fontSize = '12px';
    note.style.opacity = '0.92';
    note.style.lineHeight = '1.35';
    note.textContent = 'ここだけGを使います。パッシブは最初から装備済みで、強化のみ行えます。';
    card.appendChild(note);

    const role = getRole(mem);

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

      const curPlus = passivePlus(mem, def.id);
      const cost = (curPlus >= PASSIVE_PLUS_MAX) ? null : nextPassiveCost(curPlus);

      const line1 = document.createElement('div');
      line1.style.marginTop = '8px';
      line1.style.fontSize = '12px';
      line1.style.opacity = '0.95';
      line1.textContent = def.desc;

      const resetNote = (def.trigger === '接敵時') ? '（交戦後リセット）' : '';

      const line2 = document.createElement('div');
      line2.style.marginTop = '6px';
      line2.style.fontSize = '12px';
      line2.style.opacity = '0.95';
      line2.textContent =
        `現在：+${curPlus} / 発動率：${formatChance(def, curPlus)} / 効果：${formatEffect(def, curPlus)} ${resetNote}`;

      const line3 = document.createElement('div');
      line3.style.marginTop = '6px';
      line3.style.fontSize = '12px';
      line3.style.opacity = '0.92';
      line3.textContent =
        (curPlus >= PASSIVE_PLUS_MAX)
          ? '強化上限です。'
          : `次の強化（+1）コスト：${cost}G`;

      const btnRow = document.createElement('div');
      btnRow.style.marginTop = '10px';
      btnRow.style.display = 'grid';
      btnRow.style.gridTemplateColumns = '1fr';
      btnRow.style.gap = '8px';

      const upBtn = createPrimaryBtn(curPlus >= PASSIVE_PLUS_MAX ? '上限です' : `強化する（${cost}G）`);
      upBtn.style.padding = '10px 10px';
      upBtn.disabled = (curPlus >= PASSIVE_PLUS_MAX);
      upBtn.style.opacity = upBtn.disabled ? '0.5' : '1';
      upBtn.addEventListener('click', ()=>{
        const res = upgradePassive(team, mem.id, def.id);
        if (!res.ok){
          showMsg(res.reason || '失敗しました');
        }else{
          showMsg('');
          render();
        }
      });

      btnRow.appendChild(upBtn);

      row.appendChild(top);
      row.appendChild(line1);
      row.appendChild(line2);
      row.appendChild(line3);
      row.appendChild(btnRow);

      list.appendChild(row);
    });

    card.appendChild(list);
    ui.passiveArea.appendChild(card);

    // ★装備済み保証を保存（表示しただけでなく実データにも反映）
    try{
      if (T?.writePlayerTeam) T.writePlayerTeam(team);
      else localStorage.setItem('mobbr_playerTeam', JSON.stringify(team));
    }catch(e){}
  }

  // =========================================================
  // render 本体
  // =========================================================

  function render(){
    if (!T) return;

    // core の migrateAndPersistTeam を使いつつ、こちらの育成仕様用に整形
    let team = null;
    try{
      team = T.migrateAndPersistTeam ? T.migrateAndPersistTeam() : null;
    }catch(e){
      team = null;
    }
    if (!team){
      try{
        team = safeJsonParse(localStorage.getItem('mobbr_playerTeam'), null);
      }catch(e){}
    }
    if (!team) return;

    migrateTeamForTraining(team);

    const mem = getMemById(team, ttSelectedId) || getMemById(team, 'A');
    if (!mem) return;

    renderMemberTabs(team);
    renderTopRow(team);
    renderGrowthArea(team);
    renderPassiveArea(team);
  }

  // 外部公開（core から呼ぶ）
  window.MOBBR.uiTeamTraining.render = render;
  window.MOBBR.uiTeamTraining.openPassivePopup = openPassivePopup; // ★追加：メンバー名タップで呼ばれる

  // ✅ 互換alias（壊さない・削らない）
  // app.js の split check / 将来参照のため、ui配下にも同じ参照を置く
  window.MOBBR.ui = window.MOBBR.ui || {};
  if (!window.MOBBR.ui._teamTraining){
    window.MOBBR.ui._teamTraining = window.MOBBR.uiTeamTraining;
  }

})();
