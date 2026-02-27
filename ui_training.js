'use strict';

/* =========================================================
   MOB BR - ui_training.js v19.3（FULL）
   ✅ 「育成（修行）」はこの画面だけで実行（チーム画面では不可）
   ✅ 1週につき1回だけ実行（無限強化を根絶）
   ✅ ルール確定（あなたの指定）
      - 射撃：エイムEXP +50
      - 研究：技術EXP +50
      - パズル：メンタルEXP +50
      - ダッシュ：体力EXP +50
      - 専門以外も +10 は必ず上がる（= 全能力 +10、専門は +50 追加で合計 +60）
   ✅ EXP は growth(0..100) として保持し、100到達ごとにステ+1（繰り越し）
   ✅ 結果OKでのみ確定（EXP反映＋週進行＋週収入G）
========================================================= */

window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};

(function(){

  const $ = (id) => document.getElementById(id);

  // ------------------------------
  // Storage keys（既存と合わせる）
  // ------------------------------
  const KLS = {
    year:'mobbr_year',
    month:'mobbr_month',
    week:'mobbr_week',
    gold:'mobbr_gold',
    rank:'mobbr_rank',
    recent:'mobbr_recent'
  };

  const KEY_PLAYER_TEAM = 'mobbr_playerTeam';

  // 1週1回ガード
  const TRAIN_DONE_KEY = 'mobbr_training_done_v1';

  // 成長（EXP）ゲージ
  const GROW_MAX = 100;
  const STAT_MAX = 99;

  // 表示/対象ステ（これだけ）
  const STATS = [
    { key:'hp',     label:'体力'   },
    { key:'aim',    label:'エイム' },
    { key:'tech',   label:'技術'   },
    { key:'mental', label:'メンタル' }
  ];

  // 修行メニュー（専門+50 / 全能力+10）
  const MENUS = [
    { id:'shoot',  title:'射撃',   sub:'エイム経験値 +50（全能力 +10）',   mainKey:'aim'    },
    { id:'study',  title:'研究',   sub:'技術経験値 +50（全能力 +10）',     mainKey:'tech'   },
    { id:'puzzle', title:'パズル', sub:'メンタル経験値 +50（全能力 +10）', mainKey:'mental' },
    { id:'dash',   title:'ダッシュ', sub:'体力経験値 +50（全能力 +10）',   mainKey:'hp'     }
  ];

  // 週収入（app.js と同じ）
  function weeklyGoldByRank(rank){
    if (rank >= 1 && rank <= 5) return 500;
    if (rank >= 6 && rank <= 10) return 800;
    if (rank >= 11 && rank <= 20) return 1000;
    if (rank >= 21 && rank <= 30) return 2000;
    return 3000;
  }

  // ------------------------------
  // util
  // ------------------------------
  function safeJsonParse(s, fallback){
    try{ return JSON.parse(s); }catch(e){ return fallback; }
  }

  function clamp(n, min, max){
    const v = Number(n);
    if (!Number.isFinite(v)) return min;
    return Math.max(min, Math.min(max, v));
  }

  function getNumLS(key, def){
    const v = Number(localStorage.getItem(key));
    return Number.isFinite(v) ? v : def;
  }
  function setNumLS(key, val){ localStorage.setItem(key, String(Number(val))); }
  function setStrLS(key, val){ localStorage.setItem(key, String(val)); }

  function getNowYMW(){
    const y = getNumLS(KLS.year, 1989);
    const m = getNumLS(KLS.month, 1);
    const w = getNumLS(KLS.week, 1);
    return { y, m, w };
  }

  function setNowYMW(y, m, w){
    setNumLS(KLS.year, y);
    setNumLS(KLS.month, m);
    setNumLS(KLS.week, w);
  }

  function advanceWeekBy1(){
    let { y, m, w } = getNowYMW();

    w += 1;
    if (w >= 5){
      w = 1;
      m += 1;
      if (m >= 13){
        m = 1;
        y += 1;
      }
    }

    const rank = getNumLS(KLS.rank, 10);
    const gain = weeklyGoldByRank(rank);
    const gold = getNumLS(KLS.gold, 0);
    setNumLS(KLS.gold, gold + gain);

    setNowYMW(y, m, w);

    return { y, m, w, gain };
  }

  function getDoneStamp(){
    const raw = localStorage.getItem(TRAIN_DONE_KEY);
    const obj = safeJsonParse(raw, null);
    if (!obj || typeof obj !== 'object') return null;
    return {
      y: Number(obj.y) || 0,
      m: Number(obj.m) || 0,
      w: Number(obj.w) || 0
    };
  }

  function setDoneStamp(y, m, w){
    localStorage.setItem(TRAIN_DONE_KEY, JSON.stringify({ y, m, w }));
  }

  function isDoneThisWeek(){
    const cur = getNowYMW();
    const done = getDoneStamp();
    if (!done) return false;
    return done.y === cur.y && done.m === cur.m && done.w === cur.w;
  }

  // ------------------------------
  // team I/O + migrate（壊さない）
  // ------------------------------
  function readPlayerTeam(){
    const S = window.MOBBR?.storage;
    if (S?.getJSON){
      return S.getJSON(KEY_PLAYER_TEAM, null);
    }
    const raw = localStorage.getItem(KEY_PLAYER_TEAM);
    if (!raw) return null;
    return safeJsonParse(raw, null);
  }

  function writePlayerTeam(team){
    const S = window.MOBBR?.storage;
    if (S?.setJSON){
      S.setJSON(KEY_PLAYER_TEAM, team);
      return;
    }
    try{ localStorage.setItem(KEY_PLAYER_TEAM, JSON.stringify(team)); }catch(e){}
  }

  function ensureGrowth(mem){
    if (!mem || typeof mem !== 'object') return;
    if (!mem.growth || typeof mem.growth !== 'object'){
      mem.growth = { hp:0, aim:0, tech:0, mental:0 };
    }
    for (const s of STATS){
      mem.growth[s.key] = clamp(Number(mem.growth[s.key] || 0), 0, GROW_MAX);
    }
  }

  function ensureStats(mem){
    if (!mem || typeof mem !== 'object') return;
    mem.stats = (mem.stats && typeof mem.stats === 'object') ? mem.stats : {};
    for (const s of STATS){
      if (!Number.isFinite(Number(mem.stats[s.key]))){
        mem.stats[s.key] = 66;
      }else{
        mem.stats[s.key] = clamp(Number(mem.stats[s.key]), 0, STAT_MAX);
      }
    }
  }

  function migrateTeam(team){
    if (!team || typeof team !== 'object') team = {};
    if (!Array.isArray(team.members)) team.members = [];

    // A/B/Cは必ずいる前提（いなければ作る）
    const rolesFallback = { A:'IGL', B:'アタッカー', C:'サポーター' };
    const getById = (id) => team.members.find(m => String(m?.id) === String(id));

    ['A','B','C'].forEach(id=>{
      let mem = getById(id);
      if (!mem){
        mem = { id, name:id, role:rolesFallback[id], stats:{}, growth:{} };
        team.members.push(mem);
      }
      mem.id = String(mem.id || id);
      if (typeof mem.name !== 'string' || !mem.name.trim()) mem.name = mem.id;
      if (typeof mem.role !== 'string' || !mem.role.trim()) mem.role = rolesFallback[id] || '';
      ensureStats(mem);
      ensureGrowth(mem);
    });

    // 既存の他メンバーは消さない（ただし修行はA/B/Cのみ実行）
    team.members.forEach(mem=>{
      if (!mem || typeof mem !== 'object') return;
      ensureStats(mem);
      ensureGrowth(mem);
    });

    return team;
  }

  // ------------------------------
  // UI（オーバーレイ自前生成）
  // ------------------------------
  let overlay = null;
  let selectedMenuId = '';
  let lastRenderStamp = '';

  function buildOverlay(){
    if (overlay) return overlay;

    const back = $('modalBack') || (function(){
      const b = document.createElement('div');
      b.id = 'modalBack';
      b.style.position = 'fixed';
      b.style.inset = '0';
      b.style.zIndex = '999990';
      b.style.background = 'rgba(0,0,0,.55)';
      b.style.display = 'none';
      b.style.pointerEvents = 'none';
      document.body.appendChild(b);
      return b;
    })();

    const root = document.createElement('div');
    root.id = 'mobbrTrainingOverlay';
    root.style.position = 'fixed';
    root.style.inset = '0';
    root.style.zIndex = '999999';
    root.style.display = 'none';
    root.style.pointerEvents = 'none';
    root.style.padding = '14px';
    root.style.overflow = 'auto';
    root.style.color = '#fff';

    const panel = document.createElement('div');
    panel.style.maxWidth = '720px';
    panel.style.margin = '0 auto';
    panel.style.borderRadius = '18px';
    panel.style.border = '1px solid rgba(255,255,255,.16)';
    panel.style.background = 'rgba(10,10,12,.86)';
    panel.style.backdropFilter = 'blur(3px)';
    panel.style.padding = '14px';

    // header
    const headerRow = document.createElement('div');
    headerRow.style.display = 'grid';
    headerRow.style.gridTemplateColumns = '1fr auto';
    headerRow.style.gap = '10px';
    headerRow.style.alignItems = 'center';

    const title = document.createElement('div');
    title.className = 'trTitle';
    title.style.fontWeight = '1000';
    title.style.fontSize = '18px';
    title.textContent = '育成（修行）';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = '閉じる';
    closeBtn.style.border = '1px solid rgba(255,255,255,.18)';
    closeBtn.style.borderRadius = '14px';
    closeBtn.style.padding = '10px 14px';
    closeBtn.style.fontWeight = '1000';
    closeBtn.style.fontSize = '14px';
    closeBtn.style.background = 'rgba(255,255,255,.86)';
    closeBtn.style.color = '#111';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.touchAction = 'manipulation';
    closeBtn.addEventListener('touchstart', ()=>{}, {passive:true});
    closeBtn.onmousedown = ()=>{};
    closeBtn.addEventListener('click', ()=>close());

    headerRow.appendChild(title);
    headerRow.appendChild(closeBtn);
    panel.appendChild(headerRow);

    const ymw = document.createElement('div');
    ymw.className = 'trYMW';
    ymw.style.marginTop = '10px';
    ymw.style.fontWeight = '1000';
    ymw.style.fontSize = '26px';
    ymw.textContent = '----年 --月 第-週';
    panel.appendChild(ymw);

    const note = document.createElement('div');
    note.className = 'trNote';
    note.style.marginTop = '8px';
    note.style.fontSize = '13px';
    note.style.opacity = '0.92';
    note.style.lineHeight = '1.5';
    note.textContent = '※3人分の修行を選択して実行\n※結果OKでのみ確定（EXP反映＋週進行）';
    panel.appendChild(note);

    const secTitle = document.createElement('div');
    secTitle.style.marginTop = '14px';
    secTitle.style.fontWeight = '1000';
    secTitle.style.fontSize = '16px';
    secTitle.textContent = '修行メニュー';
    panel.appendChild(secTitle);

    const secSub = document.createElement('div');
    secSub.style.marginTop = '8px';
    secSub.style.fontSize = '13px';
    secSub.style.opacity = '0.92';
    secSub.style.lineHeight = '1.45';
    secSub.textContent = '修行メニューを1つ選択すると、A/B/C 全員にEXPが入ります。';
    panel.appendChild(secSub);

    const grid = document.createElement('div');
    grid.className = 'trGrid';
    grid.style.marginTop = '12px';
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = '1fr 1fr';
    grid.style.gap = '12px';
    panel.appendChild(grid);

    const execBtn = document.createElement('button');
    execBtn.type = 'button';
    execBtn.className = 'trExecBtn';
    execBtn.textContent = '修行を実行';
    execBtn.style.marginTop = '14px';
    execBtn.style.width = '100%';
    execBtn.style.border = '1px solid rgba(255,255,255,.18)';
    execBtn.style.borderRadius = '14px';
    execBtn.style.padding = '12px 14px';
    execBtn.style.fontWeight = '1000';
    execBtn.style.fontSize = '16px';
    execBtn.style.background = 'rgba(255,255,255,.30)';
    execBtn.style.color = '#111';
    execBtn.style.opacity = '0.6';
    execBtn.disabled = true;
    execBtn.style.cursor = 'pointer';
    execBtn.style.touchAction = 'manipulation';
    execBtn.addEventListener('touchstart', ()=>{}, {passive:true});
    execBtn.onmousedown = ()=>{};
    execBtn.addEventListener('click', ()=>onExecute());

    panel.appendChild(execBtn);

    const bottom = document.createElement('div');
    bottom.className = 'trBottom';
    bottom.style.marginTop = '10px';
    bottom.style.fontSize = '14px';
    bottom.style.opacity = '0.95';
    bottom.style.lineHeight = '1.5';
    bottom.textContent = '共通：全能力 EXP +10\n専門：対象能力 EXP +50（共通+10 +追加+50 = 合計+60）';
    panel.appendChild(bottom);

    root.appendChild(panel);
    document.body.appendChild(root);

    overlay = {
      root,
      back,
      ymw,
      grid,
      execBtn,
      title
    };

    return overlay;
  }

  function open(){
    const o = buildOverlay();
    o.back.style.display = 'block';
    o.back.style.pointerEvents = 'auto';
    o.back.setAttribute('aria-hidden', 'false');

    o.root.style.display = 'block';
    o.root.style.pointerEvents = 'auto';

    // 初期選択リセット（毎回）
    selectedMenuId = '';
    render();
  }

  function close(){
    const o = buildOverlay();
    o.root.style.display = 'none';
    o.root.style.pointerEvents = 'none';

    o.back.style.display = 'none';
    o.back.style.pointerEvents = 'none';
    o.back.setAttribute('aria-hidden', 'true');
  }

  function menuCard(menu, active){
    const card = document.createElement('div');
    card.style.borderRadius = '14px';
    card.style.padding = '12px';
    card.style.border = '1px solid rgba(255,255,255,.16)';
    card.style.background = active ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.08)';
    card.style.cursor = 'pointer';
    card.style.touchAction = 'manipulation';
    card.addEventListener('touchstart', ()=>{}, {passive:true});
    card.onmousedown = ()=>{};

    const t = document.createElement('div');
    t.style.fontWeight = '1000';
    t.style.fontSize = '18px';
    t.textContent = menu.title;

    const s = document.createElement('div');
    s.style.marginTop = '8px';
    s.style.fontSize = '13px';
    s.style.opacity = '0.92';
    s.textContent = menu.sub;

    card.appendChild(t);
    card.appendChild(s);

    card.addEventListener('click', ()=>{
      if (isDoneThisWeek()) return;
      selectedMenuId = menu.id;
      render();
    });

    return card;
  }

  function render(){
    const o = buildOverlay();

    const { y, m, w } = getNowYMW();
    const stamp = `${y}-${m}-${w}-${selectedMenuId}-${isDoneThisWeek() ? 'done' : 'open'}`;
    if (stamp === lastRenderStamp) return;
    lastRenderStamp = stamp;

    o.ymw.textContent = `${y}年 ${m}月 第${w}週`;

    // grid
    o.grid.innerHTML = '';
    MENUS.forEach(menu=>{
      o.grid.appendChild(menuCard(menu, selectedMenuId === menu.id));
    });

    // exec button
    const done = isDoneThisWeek();
    if (done){
      o.execBtn.disabled = true;
      o.execBtn.style.opacity = '0.55';
      o.execBtn.style.background = 'rgba(255,255,255,.30)';
      o.execBtn.textContent = 'この週は修行済み';
    }else{
      const ok = !!selectedMenuId;
      o.execBtn.disabled = !ok;
      o.execBtn.style.opacity = ok ? '1' : '0.6';
      o.execBtn.style.background = ok ? 'rgba(255,255,255,.86)' : 'rgba(255,255,255,.30)';
      o.execBtn.textContent = '修行を実行';
    }
  }

  // ------------------------------
  // execute flow（結果OKで確定）
  // ------------------------------
  function buildResultPopup(lines, onOk){
    // 既存の membersPop があるなら使う（なければ自前）
    const back = $('modalBack') || buildOverlay().back;

    let pop = $('mobbrTrainingResultPop');
    if (!pop){
      pop = document.createElement('div');
      pop.id = 'mobbrTrainingResultPop';
      pop.style.position = 'fixed';
      pop.style.left = '50%';
      pop.style.top = '50%';
      pop.style.transform = 'translate(-50%, -50%)';
      pop.style.zIndex = '1000005';
      pop.style.width = 'min(92vw, 560px)';
      pop.style.maxHeight = '74vh';
      pop.style.overflow = 'auto';
      pop.style.padding = '14px';
      pop.style.borderRadius = '14px';
      pop.style.border = '1px solid rgba(255,255,255,.16)';
      pop.style.background = 'rgba(0,0,0,.86)';
      pop.style.color = '#fff';
      document.body.appendChild(pop);
    }
    pop.innerHTML = '';

    back.style.display = 'block';
    back.style.pointerEvents = 'auto';
    back.setAttribute('aria-hidden', 'false');

    const h = document.createElement('div');
    h.style.fontWeight = '1000';
    h.style.fontSize = '15px';
    h.textContent = '修行結果（OKで確定）';
    pop.appendChild(h);

    const body = document.createElement('div');
    body.style.marginTop = '10px';
    body.style.fontSize = '12px';
    body.style.lineHeight = '1.45';
    body.style.whiteSpace = 'pre-wrap';
    body.style.opacity = '0.96';
    body.textContent = Array.isArray(lines) ? lines.join('\n') : String(lines || '');
    pop.appendChild(body);

    const row = document.createElement('div');
    row.style.display = 'grid';
    row.style.gridTemplateColumns = '1fr 1fr';
    row.style.gap = '10px';
    row.style.marginTop = '12px';

    const ok = document.createElement('button');
    ok.type = 'button';
    ok.textContent = 'OK（確定）';
    ok.style.border = '1px solid rgba(255,255,255,.18)';
    ok.style.borderRadius = '14px';
    ok.style.padding = '12px 12px';
    ok.style.fontWeight = '1000';
    ok.style.fontSize = '14px';
    ok.style.background = 'rgba(255,255,255,.86)';
    ok.style.color = '#111';
    ok.style.cursor = 'pointer';
    ok.style.touchAction = 'manipulation';
    ok.addEventListener('touchstart', ()=>{}, {passive:true});
    ok.onmousedown = ()=>{};
    ok.addEventListener('click', ()=>{
      try{ onOk && onOk(); }catch(e){}
      closePop();
    });

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'キャンセル';
    cancel.style.border = '1px solid rgba(255,255,255,.18)';
    cancel.style.borderRadius = '14px';
    cancel.style.padding = '12px 12px';
    cancel.style.fontWeight = '1000';
    cancel.style.fontSize = '14px';
    cancel.style.background = 'rgba(255,255,255,.10)';
    cancel.style.color = '#fff';
    cancel.style.cursor = 'pointer';
    cancel.style.touchAction = 'manipulation';
    cancel.addEventListener('touchstart', ()=>{}, {passive:true});
    cancel.onmousedown = ()=>{};
    cancel.addEventListener('click', ()=>closePop());

    row.appendChild(ok);
    row.appendChild(cancel);
    pop.appendChild(row);

    function closePop(){
      try{ pop.remove(); }catch(e){ pop.style.display = 'none'; pop.innerHTML=''; }
      // overlay側が開いているので back は消さない（close()で管理）
    }
  }

  function applyExpToMember(mem, mainKey){
    ensureStats(mem);
    ensureGrowth(mem);

    // 共通 +10（全能力）
    STATS.forEach(s=>{
      mem.growth[s.key] = clamp(Number(mem.growth[s.key] || 0) + 10, 0, 999999);
    });

    // 専門 +50（対象能力）
    mem.growth[mainKey] = clamp(Number(mem.growth[mainKey] || 0) + 50, 0, 999999);

    // 100到達ごとにステ+1（繰り越し）
    STATS.forEach(s=>{
      let g = Number(mem.growth[s.key] || 0);
      let st = clamp(Number(mem.stats[s.key] || 0), 0, STAT_MAX);

      while (g >= GROW_MAX && st < STAT_MAX){
        g -= GROW_MAX;
        st += 1;
      }

      mem.growth[s.key] = clamp(g, 0, 999999);
      mem.stats[s.key] = clamp(st, 0, STAT_MAX);
    });
  }

  function onExecute(){
    if (isDoneThisWeek()) return;
    const menu = MENUS.find(x=>x.id === selectedMenuId);
    if (!menu) return;

    const team0 = readPlayerTeam();
    const team = migrateTeam(team0);
    const members = (team.members || []).filter(m=>{
      const id = String(m?.id || '');
      return id === 'A' || id === 'B' || id === 'C';
    });

    if (!members.length) return;

    // プレビュー（OKで確定）
    const lines = [];
    lines.push(`選択：${menu.title}`);
    lines.push('ルール：全能力 +10 / 専門 +50（= 専門は合計 +60）');
    lines.push('────────────────────────');

    members.forEach(mem=>{
      const before = {
        id: mem.id,
        name: mem.name,
        stats: { ...(mem.stats || {}) },
        growth: { ...(mem.growth || {}) }
      };

      // 仮適用（クローンで）
      const tmp = safeJsonParse(JSON.stringify(mem), mem);
      applyExpToMember(tmp, menu.mainKey);

      const showName = String(before.name || before.id);
      lines.push(`【${showName}】`);
      STATS.forEach(s=>{
        const bG = Number(before.growth?.[s.key] || 0);
        const aG = Number(tmp.growth?.[s.key] || 0);
        const bS = Number(before.stats?.[s.key] || 0);
        const aS = Number(tmp.stats?.[s.key] || 0);

        const deltaS = aS - bS;
        const growAdd = aG - bG; // 大体 +10 or +60 から 100繰越分減る場合あり
        const label = s.label;

        const statText = deltaS > 0 ? ` / ${label} ${bS}→${aS}(+${deltaS})` : '';
        lines.push(`  ${label}：EXP +${growAdd}（${bG}→${aG}）${statText}`);
      });
      lines.push('');
    });

    // OKでのみ確定
    buildResultPopup(lines, ()=>{
      // 実適用
      members.forEach(mem=>applyExpToMember(mem, menu.mainKey));
      writePlayerTeam(team);

      // 週進行＋週収入
      const cur = getNowYMW();
      setDoneStamp(cur.y, cur.m, cur.w);
      const weekInfo = advanceWeekBy1();

      // recent
      setStrLS(KLS.recent, `修行：${menu.title} 実行 / 週が進んだ（+${weekInfo.gain}G）`);

      // UI更新
      try{ if (window.MOBBR?.initMainUI) window.MOBBR.initMainUI(); }catch(e){}
      try{ if (window.MOBBR?.initTeamUI) window.MOBBR.initTeamUI(); }catch(e){}

      // 閉じる
      close();
    });
  }

  // ------------------------------
  // public API
  // ------------------------------
  function initTrainingUI(){
    // 画面は必要時に生成
    buildOverlay();
  }

  window.MOBBR.initTrainingUI = initTrainingUI;

  // UI公開（任意で呼べる）
  window.MOBBR.ui.training = window.MOBBR.ui.training || {};
  window.MOBBR.ui.training.open = open;
  window.MOBBR.ui.training.close = close;

  // 既存UIから呼ばれがち：openTraining / showTraining の互換
  window.MOBBR.openTraining = open;

})();
