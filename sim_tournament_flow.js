/* =========================================================
   MOB BR - sim_tournament_flow.js (FULL / UPDATED v3.0a)
   ---------------------------------------------------------
   役割：
   ・大会中の「NEXT進行」を一元管理する（段階制STEP）
   ・各大会フェーズ（local / national / world / final）を切り替える
   ・結果/総合の表示は ui_tournament に統一（sim側UIは呼ばない）
   ---------------------------------------------------------
   要件：
   ・試合前コーチスキル使用（使う/使わない選択）
   ・消耗品：使用したら所持から削除（0なら装備からも外す）
   ・使えるスキルが無い時：
     「コーチスキルはもう使い切っている！選手を信じよう！」
   ---------------------------------------------------------
   依存（存在前提）：
   ・ui_tournament.js（window.MOBBR.ui.tournament）
   ・sim_tournament_local.js    （window.MOBBR.sim.tournamentLocal）
   ・sim_tournament_national.js （window.MOBBR.sim.tournamentNational）
   ・sim_tournament_world.js    （window.MOBBR.sim.tournamentWorld）
   ・sim_tournament_final.js    （window.MOBBR.sim.tournamentFinal）
========================================================= */

window.MOBBR = window.MOBBR || {};
window.MOBBR.sim = window.MOBBR.sim || {};

(function(){
  'use strict';

  const Flow = {};
  window.MOBBR.sim.tournamentFlow = Flow;

  /* =========================
     INTERNAL STATE
  ========================== */

  const STEP = {
    NONE: 'NONE',
    INTRO: 'INTRO',
    PREMATCH: 'PREMATCH',
    PLAY: 'PLAY',
    SHOW_MATCH_RESULT: 'SHOW_MATCH_RESULT',
    SHOW_OVERALL: 'SHOW_OVERALL',
    FINISH: 'FINISH'
  };

  const PHASES = ['local','national','world','final'];

  const PHASE_META = {
    local:    { jp:'ローカル大会',   bg:'neonmain.png' },
    national: { jp:'ナショナル大会', bg:'neonmain.png' },
    world:    { jp:'ワールド大会',   bg:'neonmain.png' },
    final:    { jp:'ファイナル',     bg:'neonmain.png' }
  };

  const SIM_BY_PHASE = {
    local:    () => window.MOBBR?.sim?.tournamentLocal,
    national: () => window.MOBBR?.sim?.tournamentNational,
    world:    () => window.MOBBR?.sim?.tournamentWorld,
    final:    () => window.MOBBR?.sim?.tournamentFinal
  };

  let current = {
    phase: null,        // local/national/world/final
    sim: null,          // module
    state: null,        // module state
    busy: false,        // NEXT連打防止
    step: STEP.NONE,    // 段階制STEP
    pending: null       // coachSkillなど
  };

  /* =========================
     COACH SKILLS (MASTER)
     ※ ui_team.js と同一IDで運用
  ========================== */
  const COACH_OWNED_KEY = 'mobbr_coachSkillsOwned';     // { id: count }
  const COACH_EQUIP_KEY = 'mobbr_coachSkillsEquipped';  // [id|null,id|null,id|null]

  const COACH_SKILLS = [
    { id:'tactics_note',  name:'戦術ノート',        effectLabel:'この試合、総合戦闘力が1%アップする', coachLine:'基本を徹底。丁寧に戦おう！', powerAdd: 1 },
    { id:'mental_care',   name:'メンタル整備',      effectLabel:'この試合、チームの雰囲気が安定する',   coachLine:'全員で勝つぞ！',             stable: true },
    { id:'endgame_power', name:'終盤の底力',        effectLabel:'この試合、終盤の勝負で総合戦闘力が3%アップする', coachLine:'終盤一気に押すぞ！', endgamePowerAdd: 3 },
    { id:'clearing',      name:'クリアリング徹底',  effectLabel:'この試合、ファイトに勝った後に人数が残りやすい', coachLine:'周辺をしっかり見ろ！', surviveBias: true },
    { id:'score_mind',    name:'スコア意識',        effectLabel:'この試合、お宝やフラッグを取りやすい', coachLine:'この試合はポイント勝負だ！', scoreBias: true },
    { id:'igl_call',      name:'IGL強化コール',      effectLabel:'この試合、総合戦闘力が4%アップする', coachLine:'コールを信じろ！チャンピオン取るぞ！', powerAdd: 4 },
    { id:'protagonist',   name:'主人公ムーブ',      effectLabel:'この試合、総合戦闘力が6%アップし、アシストも出やすくなる', coachLine:'チームの力を信じろ！', powerAdd: 6, assistBias: true }
  ];
  const COACH_BY_ID = Object.fromEntries(COACH_SKILLS.map(s=>[s.id,s]));

  /* =========================
     PUBLIC API
  ========================== */

  // 互換：既存呼び出し
  Flow.startLocalTournament = () => startTournament('local');
  Flow.startNationalTournament = () => startTournament('national');
  Flow.startWorldTournament = () => startTournament('world');
  Flow.startFinalTournament = () => startTournament('final');

  // 推奨：任意フェーズ開始
  Flow.startTournament = (phase) => startTournament(phase);

  Flow.next = function(){
    if (current.busy) return;
    current.busy = true;

    try{
      if (!current.phase || !current.sim || !current.state){
        announce('大会が開始されていません');
        return;
      }
      stepTournament(); // phase共通STEP
    }finally{
      setTimeout(()=>{ current.busy = false; }, 40);
    }
  };

  Flow.getPhase = function(){ return current.phase; };

  Flow.resetAll = function(){
    current.phase = null;
    current.sim = null;
    current.state = null;
    current.busy = false;
    current.step = STEP.NONE;
    current.pending = null;

    hideCoachSelect();

    // sim側 reset があれば呼ぶ（全フェーズ）
    for (const p of PHASES){
      const Sim = SIM_BY_PHASE[p]();
      if (Sim && typeof Sim.reset === 'function'){
        try{ Sim.reset(); }catch(e){}
      }
    }

    const tUI = window.MOBBR?.ui?.tournament;
    if (tUI && typeof tUI.close === 'function') tUI.close();
  };

  /* =========================
     START
  ========================== */
  function startTournament(phase){
    phase = String(phase || '').toLowerCase();
    if (!PHASES.includes(phase)) phase = 'local';

    const Sim = SIM_BY_PHASE[phase]();
    if (!Sim){
      announce(`大会データがありません（sim_tournament_${phase}.js が見つかりません）`);
      console.error('[Flow] sim missing:', phase);
      return;
    }
    if (typeof Sim.create !== 'function'){
      announce(`大会データの形式が違います（${phase}.create がありません）`);
      console.error('[Flow] create missing:', phase, Sim);
      return;
    }

    current.phase = phase;
    current.sim = Sim;
    current.state = Sim.create({ keepStorage: true });
    current.step = STEP.INTRO;
    current.pending = null;

    openTournamentUIIntro();
  }

  function openTournamentUIIntro(){
    const meta = PHASE_META[current.phase] || { jp:'大会', bg:'neonmain.png' };
    const tUI = window.MOBBR?.ui?.tournament;

    if (tUI && typeof tUI.open === 'function'){
      tUI.open({
        bg: meta.bg,
        playerImage: 'P1.png',
        enemyImage: '',
        title: meta.jp,
        messageLines: [
          `${meta.jp} 開始！`,
          'NEXTで進行します'
        ],
        nextLabel: 'NEXT',
        nextEnabled: true,
        onNext: Flow.next,
        highlightTeamId: getPlayerTeamIdSafe(current.state)
      });
    }else{
      announce(`${meta.jp} 開始！`);
    }
  }

  /* =========================
     STEP ENGINE (PHASE共通)
  ========================== */
  function stepTournament(){
    const Sim = current.sim;
    const st = current.state;

    ensureTournamentNextBound();

    // finishedなら強制FINISHへ
    if (typeof Sim.isFinished === 'function'){
      try{
        if (Sim.isFinished(st) && current.step !== STEP.FINISH){
          current.step = STEP.FINISH;
        }
      }catch(e){}
    }

    const meta = PHASE_META[current.phase] || { jp:'大会', bg:'neonmain.png' };
    const jp = meta.jp;

    switch(current.step){

      case STEP.INTRO: {
        current.step = STEP.PREMATCH;
        const matchNo = getMatchNoForDisplay(st);
        showMsg(jp, [
          `第${matchNo}試合の準備をします`,
          'コーチスキルを使うか選べます'
        ]);
        return;
      }

      case STEP.PREMATCH: {
        const matchNo = getMatchNoForDisplay(st);

        runPreMatchCoachSkill({
          phase: current.phase,
          matchNo,
          onDone: (coachUse)=>{
            current.pending = current.pending || {};
            current.pending.coachSkill = coachUse ? sanitizeCoachUse(coachUse) : null;

            current.step = STEP.PLAY;

            showMsg(jp, [
              `第${matchNo}試合`,
              coachUse ? `コーチスキル使用：${COACH_BY_ID[coachUse.id]?.name || coachUse.id}` : 'コーチスキル：使わない',
              'NEXTで試合開始'
            ]);
            setTournamentNextEnabled(true);
          }
        });
        return;
      }

      case STEP.PLAY: {
        const matchNo = getMatchNoForDisplay(st);

        const matchOpt = {
          title: 'RESULT',
          subtitle: `${jp} 第${matchNo}試合`,
          coachSkill: current.pending?.coachSkill || null
        };

        try{
          if (typeof Sim.playNextMatch === 'function'){
            current.state = Sim.playNextMatch(st, matchOpt);
          }else{
            announce(`試合進行ができません（${current.phase}.playNextMatch がありません）`);
            return;
          }
        }catch(e){
          console.error(e);
          announce('試合進行でエラー（コンソール確認）');
          return;
        }finally{
          if (current.pending) current.pending.coachSkill = null;
        }

        current.step = STEP.SHOW_MATCH_RESULT;
        showMatchResultUI(); // 即表示
        return;
      }

      case STEP.SHOW_MATCH_RESULT: {
        current.step = STEP.SHOW_OVERALL;
        showMsg(jp, ['次は現在の総合順位を表示します', 'NEXT']);
        return;
      }

      case STEP.SHOW_OVERALL: {
        showOverallUI();

        // 次へ
        let finished = false;
        if (typeof Sim.isFinished === 'function'){
          try{ finished = !!Sim.isFinished(current.state); }catch(e){ finished = false; }
        }
        current.step = finished ? STEP.FINISH : STEP.PREMATCH;
        return;
      }

      case STEP.FINISH: {
        showFinalOverallUI();

        const nextPhase = nextPhaseOf(current.phase);
        if (nextPhase){
          showMsg('大会', [
            `${jp} 終了！`,
            `次は ${PHASE_META[nextPhase]?.jp || nextPhase} です`,
            'NEXTで開始'
          ]);

          current.phase = nextPhase;
          current.sim = SIM_BY_PHASE[nextPhase]();
          if (!current.sim || typeof current.sim.create !== 'function'){
            announce(`次の大会データがありません（${nextPhase}）`);
            return;
          }
          current.state = current.sim.create({ keepStorage: true });
          current.step = STEP.INTRO;
          current.pending = null;

          const meta2 = PHASE_META[nextPhase] || { jp:'大会', bg:'neonmain.png' };
          const tUI = window.MOBBR?.ui?.tournament;
          if (tUI && typeof tUI.setScene === 'function'){
            tUI.setScene({
              bg: meta2.bg,
              title: meta2.jp,
              messageLines: [
                `${meta2.jp} 開始！`,
                'NEXTで進行します'
              ],
              nextLabel: 'NEXT',
              nextEnabled: true,
              onNext: Flow.next,
              highlightTeamId: getPlayerTeamIdSafe(current.state)
            });
          }else{
            announce(`${meta2.jp} 開始！`);
          }
        }else{
          showMsg('大会', [
            `${jp} 終了！`,
            '全大会が完了しました'
          ]);
        }
        return;
      }

      default: {
        current.step = STEP.INTRO;
        showMsg(jp, ['進行を再開します', 'NEXT']);
        return;
      }
    }
  }

  function nextPhaseOf(phase){
    const i = PHASES.indexOf(phase);
    if (i < 0) return null;
    if (i === PHASES.length - 1) return null;
    return PHASES[i + 1];
  }

  function getMatchNoForDisplay(st){
    const mi = Number(st?.matchIndex ?? 0);
    return Math.max(1, mi + 1);
  }

  /* =========================
     UI helpers（ui_tournament 統一）
  ========================== */

  function ensureTournamentNextBound(){
    const tUI = window.MOBBR?.ui?.tournament;
    if (!tUI) return;
    if (typeof tUI.setNextHandler === 'function') tUI.setNextHandler(Flow.next);
    if (typeof tUI.setNextEnabled === 'function') tUI.setNextEnabled(true);
    // ★ここで自分自身を呼ばない（無限再帰防止）
  }

  function setTournamentNextEnabled(on){
    const tUI = window.MOBBR?.ui?.tournament;
    if (!tUI) return;
    if (typeof tUI.setNextEnabled === 'function') tUI.setNextEnabled(!!on);
  }

  function showMsg(title, lines){
    const tUI = window.MOBBR?.ui?.tournament;
    if (tUI && typeof tUI.showMessage === 'function'){
      tUI.showMessage(String(title||''), Array.isArray(lines)?lines:[String(lines||'')], 'NEXT');
      ensureTournamentNextBound();
      return;
    }
    announce(Array.isArray(lines)? lines.join(' / ') : String(lines||''));
  }

  function showMatchResultUI(){
    const tUI = window.MOBBR?.ui?.tournament;
    if (!tUI || typeof tUI.showResult !== 'function'){
      announce('結果表示UIがありません（ui_tournament.js を確認）');
      return;
    }

    const meta = PHASE_META[current.phase] || { jp:'大会' };
    const jp = meta.jp;

    const st = current.state || {};
    const matchNoShown = Math.max(1, Number(st.matchIndex ?? 1)); // 試合後想定
    const subtitle = `${jp} 第${matchNoShown}試合`;

    const rows = pickRowsFromStateForMatch(st);
    const hi = getPlayerTeamIdSafe(st);

    tUI.showResult({
      title: 'RESULT',
      sub: subtitle,
      rows,
      highlightTeamId: hi
    });

    ensureTournamentNextBound();
  }

  function showOverallUI(){
    const tUI = window.MOBBR?.ui?.tournament;
    if (!tUI || typeof tUI.showResult !== 'function'){
      announce('総合表示UIがありません（ui_tournament.js を確認）');
      return;
    }

    const meta = PHASE_META[current.phase] || { jp:'大会' };
    const jp = meta.jp;

    const st = current.state || {};
    const rows = pickRowsFromStateForOverall(st, current.sim);

    const shownMatch = Number(st.matchIndex ?? 0) || 0;
    const total = getTotalMatchesSafe(st, current.sim);
    const subtitle = `${jp} 現在順位（${Math.min(shownMatch,total)}/${total}）`;

    const hi = getPlayerTeamIdSafe(st);

    tUI.showResult({
      title: 'OVERALL',
      sub: subtitle,
      rows,
      highlightTeamId: hi
    });

    ensureTournamentNextBound();
  }

  function showFinalOverallUI(){
    const tUI = window.MOBBR?.ui?.tournament;
    if (!tUI || typeof tUI.showResult !== 'function'){
      announce('最終総合表示UIがありません（ui_tournament.js を確認）');
      return;
    }

    const meta = PHASE_META[current.phase] || { jp:'大会' };
    const jp = meta.jp;

    const st = current.state || {};
    const Sim = current.sim;

    let rows = null;
    if (Sim && typeof Sim.getFinalOverall === 'function'){
      try{ rows = Sim.getFinalOverall(st); }catch(e){ rows = null; }
    }
    if (!rows) rows = pickRowsFromStateForOverall(st, Sim);

    const hi = getPlayerTeamIdSafe(st);

    tUI.showResult({
      title: 'FINAL OVERALL',
      sub: `${jp} 最終順位`,
      rows: normalizeRowsForTournamentUI(rows),
      highlightTeamId: hi
    });

    ensureTournamentNextBound();
  }

  function getTotalMatchesSafe(st, Sim){
    const candidates = [
      st?.totalMatches,
      st?.matchTotal,
      st?.maxMatches,
      Sim?.TOTAL_MATCHES,
      Sim?.MAX_MATCHES
    ];
    for (const v of candidates){
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) return n;
    }
    return 5;
  }

  /* =========================
     State → rows 取得（頑丈に）
  ========================== */
  function normalizeRowsForTournamentUI(rows){
    const arr = Array.isArray(rows) ? rows : [];
    return arr.map((r, idx)=>{
      const rank = Number(r.rank ?? r.place ?? r.placement ?? (idx+1));
      const teamId = String(r.teamId ?? r.id ?? r.team ?? '');
      const teamName = String(r.teamName ?? r.name ?? r.team_name ?? teamId || `TEAM${rank}`);
      const pts = Number(r.points ?? r.totalPt ?? r.totalPoints ?? r.total ?? r.pt ?? 0);

      const kills = Number(r.kills_total ?? r.kills ?? r.kill ?? 0);
      const assists = Number(r.assists_total ?? r.assists ?? r.assist ?? 0);
      const treasure = Number(r.treasure ?? 0);
      const flag = Number(r.flag ?? 0);

      return { rank, teamId, teamName, points: pts, kills, assists, treasure, flag };
    });
  }

  function pickRowsFromStateForMatch(st){
    const candidates = [
      st.lastMatchResult,
      st.lastMatchResults,
      st.matchResult,
      st.matchResults,
      st.lastResult,
      st.result,
      st.lastMatch?.result,
      st.lastMatch?.rows,
      st.last?.result,
      st.ui?.lastMatchResult
    ];

    for (const c of candidates){
      if (Array.isArray(c) && c.length) return normalizeRowsForTournamentUI(c);
      if (c && Array.isArray(c.rows) && c.rows.length) return normalizeRowsForTournamentUI(c.rows);
    }
    return [];
  }

  function pickRowsFromStateForOverall(st, Sim){
    if (Sim){
      const getterNames = ['getOverall', 'getOverallRows', 'buildOverall', 'buildOverallRows'];
      for (const g of getterNames){
        if (typeof Sim[g] === 'function'){
          try{
            const out = Sim[g](st);
            if (Array.isArray(out) && out.length) return normalizeRowsForTournamentUI(out);
          }catch(e){}
        }
      }
    }

    const candidates = [
      st.overall,
      st.overallRows,
      st.overallResult,
      st.overallResults,
      st.currentOverall,
      st.ui?.overall,
      st.ui?.overallRows
    ];
    for (const c of candidates){
      if (Array.isArray(c) && c.length) return normalizeRowsForTournamentUI(c);
      if (c && Array.isArray(c.rows) && c.rows.length) return normalizeRowsForTournamentUI(c.rows);
    }
    return [];
  }

  function getPlayerTeamIdSafe(st){
    const idCandidates = [
      st?.playerTeamId,
      st?.player?.teamId,
      st?.playerTeam?.teamId
    ];
    for (const v of idCandidates){
      if (v !== undefined && v !== null && String(v).trim() !== '') return String(v);
    }
    try{
      const rawId = localStorage.getItem('mobbr_playerTeamId');
      if (rawId && rawId.trim()) return rawId.trim();
    }catch{}
    try{
      const raw = localStorage.getItem('mobbr_playerTeam');
      if (raw){
        const obj = JSON.parse(raw);
        if (obj && obj.teamId != null) return String(obj.teamId);
      }
    }catch{}
    return '';
  }

  /* =========================
     PRE-MATCH COACH SKILL
  ========================== */
  function sanitizeCoachUse(s){
    const id = String(s.id || '');
    const base = COACH_BY_ID[id] || {};
    return {
      id,
      name: String(base.name || s.name || ''),
      powerAdd: Number(base.powerAdd || 0),
      endgamePowerAdd: Number(base.endgamePowerAdd || 0),
      stable: !!base.stable,
      surviveBias: !!base.surviveBias,
      scoreBias: !!base.scoreBias,
      assistBias: !!base.assistBias
    };
  }

  function runPreMatchCoachSkill(ctx){
    const equipped = readCoachEquipped();
    const owned = readCoachOwned();

    const usableIds = [];
    for (const id of equipped){
      if (!id) continue;
      const cnt = Number(owned[id] || 0);
      if (cnt > 0 && COACH_BY_ID[id]) usableIds.push(id);
    }
    const uniq = Array.from(new Set(usableIds));

    if (!uniq.length){
      announce('コーチスキルはもう使い切っている！選手を信じよう！');
      ctx.onDone && ctx.onDone(null);
      return;
    }

    showCoachSelect({
      title: `試合前コーチスキル（第${ctx.matchNo}試合）`,
      list: uniq.map(id => {
        const s = COACH_BY_ID[id];
        const cnt = Number(owned[id] || 0);
        return { id, name:s.name, effect:s.effectLabel, line:s.coachLine, count:cnt };
      }),
      onSkip: ()=>{
        hideCoachSelect();
        ctx.onDone && ctx.onDone(null);
      },
      onPick: (id)=>{
        consumeCoachSkill(id);
        hideCoachSelect();
        ctx.onDone && ctx.onDone({ id });
      }
    });
  }

  function readCoachOwned(){
    try{
      const obj = JSON.parse(localStorage.getItem(COACH_OWNED_KEY) || '{}');
      return (obj && typeof obj === 'object') ? obj : {};
    }catch{
      return {};
    }
  }

  function writeCoachOwned(obj){
    localStorage.setItem(COACH_OWNED_KEY, JSON.stringify(obj || {}));
  }

  function readCoachEquipped(){
    try{
      const arr = JSON.parse(localStorage.getItem(COACH_EQUIP_KEY) || '[]');
      if (Array.isArray(arr)){
        const out = [arr[0] ?? null, arr[1] ?? null, arr[2] ?? null].slice(0,3);
        return out.map(v => (typeof v === 'string' && v.trim()) ? v : null);
      }
      return [null,null,null];
    }catch{
      return [null,null,null];
    }
  }

  function writeCoachEquipped(arr){
    const out = Array.isArray(arr) ? arr.slice(0,3) : [null,null,null];
    const norm = out.map(v => (typeof v === 'string' && v.trim()) ? v : null);
    while (norm.length < 3) norm.push(null);
    localStorage.setItem(COACH_EQUIP_KEY, JSON.stringify(norm));
  }

  function consumeCoachSkill(id){
    id = String(id || '');
    if (!id) return;

    const owned = readCoachOwned();
    const cur = Number(owned[id] || 0);
    const next = Math.max(0, cur - 1);

    if (next <= 0){
      delete owned[id];

      const eq = readCoachEquipped();
      for (let i=0;i<eq.length;i++){
        if (eq[i] === id) eq[i] = null;
      }
      writeCoachEquipped(eq);
    }else{
      owned[id] = next;
    }
    writeCoachOwned(owned);
  }

  /* =========================
     COACH SELECT UI (INJECT)
  ========================== */
  let coachDom = null;

  function ensureCoachDom(){
    if (coachDom) return coachDom;

    const wrap = document.createElement('div');
    wrap.id = 'mobbrCoachSelect';
    wrap.style.position = 'fixed';
    wrap.style.inset = '0';
    wrap.style.zIndex = '999999';
    wrap.style.display = 'none';
    wrap.style.alignItems = 'center';
    wrap.style.justifyContent = 'center';
    wrap.style.background = 'rgba(0,0,0,.62)';
    wrap.style.padding = '10px';
    wrap.style.boxSizing = 'border-box';

    const card = document.createElement('div');
    card.style.width = 'min(560px, 96vw)';
    card.style.maxHeight = 'min(86vh, 860px)';
    card.style.background = 'rgba(15,18,24,.97)';
    card.style.border = '1px solid rgba(255,255,255,.12)';
    card.style.borderRadius = '16px';
    card.style.overflow = 'hidden';
    card.style.boxShadow = '0 18px 60px rgba(0,0,0,.65)';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';

    const head = document.createElement('div');
    head.style.padding = '12px 12px 10px';
    head.style.borderBottom = '1px solid rgba(255,255,255,.10)';

    const ttl = document.createElement('div');
    ttl.id = 'mobbrCoachSelectTitle';
    ttl.style.fontWeight = '900';
    ttl.style.fontSize = '14px';
    ttl.style.color = '#fff';
    ttl.textContent = '試合前コーチスキル';

    const sub = document.createElement('div');
    sub.id = 'mobbrCoachSelectSub';
    sub.style.marginTop = '6px';
    sub.style.fontSize = '12px';
    sub.style.color = 'rgba(255,255,255,.82)';
    sub.style.whiteSpace = 'pre-wrap';
    sub.textContent = '使うスキルを選んでください（消耗品）';

    head.appendChild(ttl);
    head.appendChild(sub);

    const list = document.createElement('div');
    list.id = 'mobbrCoachSelectList';
    list.style.padding = '10px 12px 12px';
    list.style.overflow = 'auto';
    list.style.webkitOverflowScrolling = 'touch';
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.gap = '10px';

    const foot = document.createElement('div');
    foot.style.padding = '12px 12px 12px';
    foot.style.borderTop = '1px solid rgba(255,255,255,.10)';
    foot.style.display = 'flex';
    foot.style.gap = '10px';

    const btnSkip = document.createElement('button');
    btnSkip.id = 'mobbrCoachSelectSkip';
    btnSkip.type = 'button';
    btnSkip.textContent = '使わない';
    btnSkip.style.flex = '1';
    btnSkip.style.border = '1px solid rgba(255,255,255,.18)';
    btnSkip.style.background = 'rgba(255,255,255,.06)';
    btnSkip.style.color = '#fff';
    btnSkip.style.fontWeight = '900';
    btnSkip.style.borderRadius = '12px';
    btnSkip.style.padding = '12px 12px';
    btnSkip.style.minHeight = '44px';

    foot.appendChild(btnSkip);

    card.appendChild(head);
    card.appendChild(list);
    card.appendChild(foot);

    wrap.appendChild(card);
    document.body.appendChild(wrap);

    wrap.addEventListener('click', (e)=>{
      e.preventDefault();
      e.stopPropagation();
    }, { passive:false });
    card.addEventListener('click', (e)=>e.stopPropagation());

    coachDom = { wrap, title: ttl, sub, list, btnSkip, onSkip: null, onPick: null };

    btnSkip.addEventListener('click', (e)=>{
      e.preventDefault();
      e.stopPropagation();
      if (typeof coachDom.onSkip === 'function') coachDom.onSkip();
    });

    return coachDom;
  }

  function showCoachSelect(opt){
    const d = ensureCoachDom();

    d.onSkip = (typeof opt.onSkip === 'function') ? opt.onSkip : null;
    d.onPick = (typeof opt.onPick === 'function') ? opt.onPick : null;

    d.title.textContent = String(opt.title || '試合前コーチスキル');
    d.sub.textContent = '使うスキルを選んでください（消耗品）';

    d.list.innerHTML = '';

    const arr = Array.isArray(opt.list) ? opt.list : [];
    for (const item of arr){
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.style.border = '1px solid rgba(255,255,255,.14)';
      btn.style.background = 'rgba(255,255,255,.06)';
      btn.style.color = '#fff';
      btn.style.borderRadius = '14px';
      btn.style.padding = '10px 10px';
      btn.style.textAlign = 'left';
      btn.style.cursor = 'pointer';
      btn.style.touchAction = 'manipulation';

      const top = document.createElement('div');
      top.style.display = 'flex';
      top.style.justifyContent = 'space-between';
      top.style.alignItems = 'baseline';
      top.style.gap = '10px';

      const name = document.createElement('div');
      name.style.fontWeight = '900';
      name.style.fontSize = '14px';
      name.textContent = String(item.name || item.id || '');

      const cnt = document.createElement('div');
      cnt.style.fontWeight = '900';
      cnt.style.fontSize = '12px';
      cnt.style.opacity = '0.92';
      cnt.textContent = `所持：${Number(item.count||0)}`;

      top.appendChild(name);
      top.appendChild(cnt);

      const eff = document.createElement('div');
      eff.style.marginTop = '6px';
      eff.style.fontSize = '12px';
      eff.style.opacity = '0.92';
      eff.textContent = String(item.effect || '');

      const line = document.createElement('div');
      line.style.marginTop = '6px';
      line.style.fontSize = '12px';
      line.style.opacity = '0.92';
      line.textContent = `コーチ：「${String(item.line || '')}」`;

      btn.appendChild(top);
      btn.appendChild(eff);
      btn.appendChild(line);

      btn.addEventListener('click', (e)=>{
        e.preventDefault();
        e.stopPropagation();
        const id = String(item.id || '');
        if (!id) return;
        if (typeof d.onPick === 'function') d.onPick(id);
      });

      d.list.appendChild(btn);
    }

    d.wrap.style.display = 'flex';
  }

  function hideCoachSelect(){
    if (!coachDom) return;
    coachDom.wrap.style.display = 'none';
    coachDom.onSkip = null;
    coachDom.onPick = null;
  }

  /* =========================
     UTIL
  ========================== */
  function announce(text){
    console.log('[ANNOUNCE]', text);

    const tUI = window.MOBBR?.ui?.tournament;
    if (tUI && typeof tUI.showMessage === 'function'){
      tUI.showMessage('大会', [String(text || '')], 'NEXT');
      ensureTournamentNextBound();
      return;
    }

    const ui = window.MOBBR?.ui;
    if (ui && typeof ui.showMessage === 'function'){
      ui.showMessage(text);
    }
  }

})();
