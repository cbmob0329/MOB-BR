'use strict';

/* =========================================================
   MOB BR - sim_tournament_flow.js v1（FULL / APEX風 1試合→result→総合→次）
   ---------------------------------------------------------
   目的：
   ・大会「進行だけ」を担う（UIは呼び出しフックで接続）
   ・1試合ごとに result(20) → 現在総合(20/40) → 次試合
   ・プレイヤーは常にGroup A固定
   ・プレイヤーが属さないグループは裏でオート処理（ログ/画像なし）
   ・戦闘ロジックは含まない（SimMatch へ委譲）

   必須想定（どれか無くても落ちないようにガード）：
   ・window.DataCPU.getAllTeams()
   ・window.DataPlayer.getTeam()  または window.MOBBR.data.player
   ・window.SimMatch.runMatch(payload)         // 20チームの1試合を返す（UI向け）
   ・window.SimMatch.runMatchSilent(payload)   // 裏試合（UIなし）
   ※無い場合は “仮結果” で進行できるようフォールバックあり（後で置換推奨）

   公開API：
     window.SimTournamentFlow.start(tourKey, opt)
     window.SimTournamentFlow.next()
     window.SimTournamentFlow.getState()
     window.SimTournamentFlow.reset()

   UI連携（任意）：
     window.SimTournamentFlow.hooks = {
        onEnterTournament(ctx)        // 大会到着演出（テント等）
        onAnnounce(ctx, msg)          // アナウンス文字列
        onMatchWillStart(ctx)         // 試合開始直前
        onMatchResult(ctx, payload)   // ui_match_result.open へ渡すpayload
        onTournamentEnd(ctx, summary) // 大会終了
     }

   tourKey（想定）：
     'LOCAL' | 'NATIONAL' | 'LASTCHANCE' | 'WORLD' | 'CHAMP_WORLD'
========================================================= */

(function(){
  const SimTournamentFlow = {};
  window.SimTournamentFlow = SimTournamentFlow;

  // -------------------------
  // Hooks（UIはここで受ける）
  // -------------------------
  SimTournamentFlow.hooks = SimTournamentFlow.hooks || {};

  // -------------------------
  // Const / Keys
  // -------------------------
  const LS_KEY = 'mobbr_tournamentFlowState_v1';

  // 順位ポイント（ユーザー確定）
  const PLACEMENT_PT = {
    1:12, 2:8, 3:6, 4:5, 5:4, 6:3, 7:2, 8:1, 9:1, 10:1
  };

  // -------------------------
  // Utilities
  // -------------------------
  const clone = (v)=>JSON.parse(JSON.stringify(v));
  const nowId = ()=>`${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const rnd = (a,b)=>Math.floor(Math.random()*(b-a+1))+a;

  function safeCall(fn, ...args){
    try{ return (typeof fn === 'function') ? fn(...args) : undefined; }catch(e){ console.warn(e); }
  }

  function pickShuffle(arr){
    const a = arr.slice();
    for(let i=a.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      const t=a[i]; a[i]=a[j]; a[j]=t;
    }
    return a;
  }

  function getPlayerTeam(){
    // 優先：DataPlayer.getTeam()
    const dp = window.DataPlayer;
    if (dp && typeof dp.getTeam === 'function'){
      const t = dp.getTeam();
      if (t) return normalizeTeam(t, true);
    }

    // 次：MOBBR.data.player
    const p = window.MOBBR?.data?.player || null;
    if (p && (p.teamId || p.id)){
      return normalizeTeam({
        isPlayer: true,
        teamId: p.teamId || p.id || 'player',
        name: p.name || 'PLAYER',
        image: p.image || p.img || p.path || `cpu/${p.teamId || p.id}.png`,
        basePower: p.basePower || 75,
        members: p.members || []
      }, true);
    }

    // フォールバック
    return normalizeTeam({
      isPlayer: true,
      teamId: 'player',
      name: 'プレイヤー',
      image: 'P1.png',
      basePower: 75,
      members: []
    }, true);
  }

  function getCpuTeams(){
    const dc = window.DataCPU;
    if (dc && typeof dc.getAllTeams === 'function'){
      const list = dc.getAllTeams() || [];
      return list.map(t=>normalizeTeam(t, false));
    }
    return [];
  }

  function normalizeTeam(t, isPlayer){
    const teamId = String(t?.teamId ?? t?.id ?? '');
    return {
      isPlayer: !!isPlayer || !!t?.isPlayer,
      teamId: teamId || (isPlayer ? 'player' : nowId()),
      name: String(t?.name ?? teamId ?? 'TEAM'),
      image: String(t?.image ?? t?.img ?? ''),
      basePower: Number(t?.basePower ?? 70) || 70,
      members: Array.isArray(t?.members) ? t.members.map(m=>({
        role: m.role,
        name: m.name,
        powerMin: Number(m.powerMin ?? 50) || 50,
        powerMax: Number(m.powerMax ?? 80) || 80,
        kills: Number(m.kills ?? 0) || 0,
        assists: Number(m.assists ?? 0) || 0,
      })) : [],

      // match / tournament counters
      kp: 0,
      ap: 0,
      treasure: 0,
      flag: 0,

      // 総合（大会）加算
      tour: {
        placementP: 0,
        kp: 0,
        ap: 0,
        treasure: 0,
        flag: 0,
        total: 0,
        matches: 0,
        avgPlaceSum: 0,
        killsSum: 0,
        assistsSum: 0
      }
    };
  }

  function placementPoint(place){
    return PLACEMENT_PT[place] || 0;
  }

  function calcRowTotal(row){
    return (
      (row.placementP||0) +
      (row.kp||0) +
      (row.ap||0) +
      (row.treasure||0) +
      (row.flag||0) * 2
    );
  }

  function tieBreakCompare(a, b){
    // 同点時優先：総合ポイント → 総合キル → 平均順位 → 総合アシスト → ランダム
    if ((b.total||0) !== (a.total||0)) return (b.total||0) - (a.total||0);
    if ((b.kp||0) !== (a.kp||0)) return (b.kp||0) - (a.kp||0);
    // 平均順位：小さいほど上（avgPlace）
    const aa = a.matches ? (a.avgPlaceSum / a.matches) : 999;
    const bb = b.matches ? (b.avgPlaceSum / b.matches) : 999;
    if (aa !== bb) return aa - bb;
    if ((b.ap||0) !== (a.ap||0)) return (b.ap||0) - (a.ap||0);
    return Math.random() < 0.5 ? -1 : 1;
  }

  function computeOverallRows(teams){
    const rows = teams.map(t=>{
      const tour = t.tour || {};
      return {
        teamId: t.teamId,
        name: t.name,
        placementP: Number(tour.placementP||0),
        kp: Number(tour.kp||0),
        ap: Number(tour.ap||0),
        treasure: Number(tour.treasure||0),
        flag: Number(tour.flag||0),
        total: Number(tour.total||0),
        matches: Number(tour.matches||0),
        avgPlaceSum: Number(tour.avgPlaceSum||0),
        killsSum: Number(tour.killsSum||0),
        assistsSum: Number(tour.assistsSum||0),
      };
    });

    rows.sort(tieBreakCompare);
    // place 付与
    rows.forEach((r,i)=>{ r.place = i+1; });
    return rows;
  }

  // -------------------------
  // Participant builders
  // -------------------------
  function filterByPrefix(teams, prefix){
    return teams.filter(t => String(t.teamId||'').startsWith(prefix));
  }

  function pickTopPower(teams, n){
    return teams.slice().sort((a,b)=> (b.basePower||0)-(a.basePower||0)).slice(0,n);
  }

  function pickRandomExcluding(pool, excludeIds, n){
    const ex = new Set(excludeIds || []);
    const cand = pool.filter(t=>!ex.has(t.teamId));
    return pickShuffle(cand).slice(0,n);
  }

  function buildLocalParticipants(){
    const player = getPlayerTeam();
    const cpuAll = getCpuTeams();
    const locals = filterByPrefix(cpuAll, 'local');
    const must = pickTopPower(cpuAll, 10); // 「総合%上位10チーム必ず登場」概念
    const exclude = new Set([player.teamId, ...must.map(t=>t.teamId)]);

    const picked = [];
    // must から local を優先で混ぜる（無ければそのまま）
    for (const t of must){
      if (picked.length >= 19) break;
      if (t.teamId.startsWith('local')) picked.push(t);
    }

    // 足りない分を local から
    const need = 19 - picked.length;
    const more = pickRandomExcluding(locals, exclude, need);
    picked.push(...more);

    // 20チーム（player + 19）
    const teams = [player, ...picked].slice(0,20);
    return teams;
  }

  function buildNationalParticipants(localTop10TeamIds){
    const player = getPlayerTeam();
    const cpuAll = getCpuTeams();
    const nationals = filterByPrefix(cpuAll, 'national');
    const locals = filterByPrefix(cpuAll, 'local');

    const localTop = (localTop10TeamIds && localTop10TeamIds.length)
      ? localTop10TeamIds.map(id => cpuAll.find(t=>t.teamId===id)).filter(Boolean)
      : pickShuffle(locals).slice(0,10);

    const national30 = pickShuffle(nationals).slice(0,30);

    // 40：player を含める（playerがlocalTopに入っていてもOK）
    // ここでは「ローカル上位10 + ナショナル30」。playerはそのどちらかに属する前提だが
    // データ的には player を必ず参加させるため、重複回避して差し替え。
    const combined = [...localTop, ...national30];
    const byId = new Map();
    for (const t of combined) byId.set(t.teamId, t);

    // player のIDがCPU側と被らない想定。被ったら player を優先
    byId.set(player.teamId, player);

    const list = Array.from(byId.values());
    // 40に満たない場合は national から補完
    const need = 40 - list.length;
    if (need > 0){
      const more = pickRandomExcluding(nationals, new Set(list.map(t=>t.teamId)), need);
      list.push(...more);
    }

    return list.slice(0,40);
  }

  function buildLastChanceParticipants(nationalOverallRows){
    // 対象：9〜28位（20チーム）
    const cpuAll = getCpuTeams();
    const player = getPlayerTeam();

    const rows = Array.isArray(nationalOverallRows) ? nationalOverallRows : [];
    const targets = rows.filter(r=>r.place>=9 && r.place<=28).map(r=>r.teamId);

    const teams = targets.map(id=>{
      if (id === player.teamId) return player;
      const t = cpuAll.find(x=>x.teamId===id);
      return t ? t : null;
    }).filter(Boolean);

    // 20チームに満たない場合の補完（事故対策）
    if (teams.length < 20){
      const pool = cpuAll.filter(t=>t.teamId.startsWith('national') || t.teamId.startsWith('local'));
      const more = pickRandomExcluding(pool, new Set(teams.map(t=>t.teamId)), 20-teams.length);
      teams.push(...more);
    }
    return teams.slice(0,20);
  }

  function buildWorldParticipants(nationalTop10TeamIds){
    const player = getPlayerTeam();
    const cpuAll = getCpuTeams();
    const worlds = filterByPrefix(cpuAll, 'world');
    const nationals = filterByPrefix(cpuAll, 'national');

    const natTop = (nationalTop10TeamIds && nationalTop10TeamIds.length)
      ? nationalTop10TeamIds.map(id => cpuAll.find(t=>t.teamId===id)).filter(Boolean)
      : pickShuffle(nationals).slice(0,10);

    const world30 = pickShuffle(worlds).slice(0,30);

    const byId = new Map();
    for (const t of [...natTop, ...world30]) byId.set(t.teamId, t);
    byId.set(player.teamId, player);

    const list = Array.from(byId.values());
    const need = 40 - list.length;
    if (need > 0){
      const more = pickRandomExcluding(worlds, new Set(list.map(t=>t.teamId)), need);
      list.push(...more);
    }
    return list.slice(0,40);
  }

  // -------------------------
  // Grouping (A/B/C/D)
  // -------------------------
  function splitGroups40(teams40){
    const player = getPlayerTeam();
    const list = teams40.slice();

    // player 必ずAに
    const others = list.filter(t=>t.teamId !== player.teamId);
    const shuffled = pickShuffle(others);

    const A = [player];
    const B = [];
    const C = [];
    const D = [];

    // Aを10にする（player + 9）
    while (A.length < 10 && shuffled.length) A.push(shuffled.shift());
    while (B.length < 10 && shuffled.length) B.push(shuffled.shift());
    while (C.length < 10 && shuffled.length) C.push(shuffled.shift());
    while (D.length < 10 && shuffled.length) D.push(shuffled.shift());

    return { A, B, C, D };
  }

  function concatGroups(groups, names){
    const out = [];
    for (const n of names){
      const g = groups[n];
      if (Array.isArray(g)) out.push(...g);
    }
    // 20想定
    return out.slice(0,20);
  }

  // -------------------------
  // Match runner adapters
  // -------------------------
  function runMatchUI(ctx, matchTeams, meta){
    // SimMatch.runMatch を優先
    const SM = window.SimMatch || {};
    if (typeof SM.runMatch === 'function'){
      return SM.runMatch({
        teams: matchTeams,
        meta: meta || {},
        context: ctx
      });
    }
    // フォールバック：仮の順位を作る（戦闘ロジック未接続でも進行できる）
    return mockMatch(matchTeams, meta);
  }

  function runMatchSilent(ctx, matchTeams, meta){
    const SM = window.SimMatch || {};
    if (typeof SM.runMatchSilent === 'function'){
      return SM.runMatchSilent({
        teams: matchTeams,
        meta: meta || {},
        context: ctx
      });
    }
    return mockMatch(matchTeams, meta);
  }

  function mockMatch(matchTeams){
    const teams = matchTeams.slice();
    // 適当に「強いほど上」へ寄せたシャッフル
    teams.sort((a,b)=>{
      const pa = (a.basePower||0) + rnd(-8,8);
      const pb = (b.basePower||0) + rnd(-8,8);
      return pb - pa;
    });

    const rows = teams.map((t,i)=>{
      const place = i+1;
      const kp = Math.max(0, Math.round(((t.basePower||0)-60)/10) + rnd(-1,2));
      const ap = Math.max(0, kp + rnd(-1,1));
      const treasure = Math.random()<0.06 ? 1 : 0;
      const flag = Math.random()<0.03 ? 1 : 0;
      const placementP = placementPoint(place);
      const row = {
        place, teamId: t.teamId, name: t.name,
        placementP, kp, ap, treasure, flag
      };
      row.total = calcRowTotal(row);
      return row;
    });

    return { rows };
  }

  // -------------------------
  // Apply match result into tournament totals
  // -------------------------
  function applyMatchToTotals(allTeamsMap, matchRows){
    for (const r of matchRows){
      const t = allTeamsMap.get(r.teamId);
      if (!t) continue;

      const place = Number(r.place)||0;
      const placementP = Number(r.placementP)||0;
      const kp = Number(r.kp)||0;
      const ap = Number(r.ap)||0;
      const treasure = Number(r.treasure)||0;
      const flag = Number(r.flag)||0;

      t.tour.placementP += placementP;
      t.tour.kp += kp;
      t.tour.ap += ap;
      t.tour.treasure += treasure;
      t.tour.flag += flag;

      t.tour.total += (placementP + kp + ap + treasure + flag*2);

      t.tour.matches += 1;
      t.tour.avgPlaceSum += place;
      t.tour.killsSum += kp;
      t.tour.assistsSum += ap;
    }
  }

  // -------------------------
  // Flow building
  // -------------------------
  function buildStepsForTournament(ctx){
    const steps = [];

    // 到着演出（テント等）
    steps.push({ type:'ENTER' });

    // アナウンス（大会名コール：ctx.announceList）
    for (const msg of ctx.announceList){
      steps.push({ type:'ANNOUNCE', msg });
    }

    // 試合ブロック（ctx.blocks）
    // block = { label, groups: ['A','B'] or 'LOCAL', matches:5, ui:true/false }
    for (const block of ctx.blocks){
      for (let i=1; i<=block.matches; i++){
        steps.push({ type:'MATCH', blockIndex: ctx.blocks.indexOf(block), matchIndex: i });
      }
    }

    // 大会終了
    steps.push({ type:'END' });

    return steps;
  }

  function buildCtx(tourKey, opt){
    const ctx = {
      id: nowId(),
      tourKey: String(tourKey || 'LOCAL'),
      opt: opt || {},

      // participants
      teams: [],
      groups: null,     // {A,B,C,D}
      allTeamsMap: null,

      // flow
      stepIndex: 0,
      steps: [],
      blocks: [],
      announceList: [],

      // standings cache
      lastMatchRows: null,
      lastOverallRows: null,

      // derived
      playerTeamId: getPlayerTeam().teamId,

      // carry
      carry: {
        localTop10: [],
        nationalOverallRows: [],
        nationalTop10: []
      }
    };

    // 大会タイプ別セットアップ
    if (ctx.tourKey === 'LOCAL'){
      ctx.announceList = [
        '全ての始まり、ローカル大会を行います！',
        '上位10チームがナショナル大会へ進出します！'
      ];
      ctx.teams = buildLocalParticipants();
      ctx.groups = null;
      ctx.blocks = [
        { label:'LOCAL', kind:'LOCAL', matches:5, ui:true }
      ];
    }

    else if (ctx.tourKey === 'NATIONAL'){
      // opt.localTop10TeamIds を渡せる
      ctx.announceList = [
        'ナショナル代表として世界への挑戦権をかけた戦いが始まります！'
      ];
      ctx.teams = buildNationalParticipants(opt?.localTop10TeamIds || []);
      ctx.groups = splitGroups40(ctx.teams);
      ctx.blocks = [
        { label:'序盤 A & B', kind:'GROUP', groups:['A','B'], matches:5, ui:true },
        { label:'序盤 C & D', kind:'GROUP', groups:['C','D'], matches:5, ui:false }, // 裏処理
        { label:'中盤 A & C', kind:'GROUP', groups:['A','C'], matches:5, ui:true },
        { label:'終盤 B & C', kind:'GROUP', groups:['B','C'], matches:5, ui:false }, // 裏
        { label:'終盤 A & D', kind:'GROUP', groups:['A','D'], matches:5, ui:true },
        { label:'終盤 B & D', kind:'GROUP', groups:['B','D'], matches:5, ui:false }, // 裏
      ];
    }

    else if (ctx.tourKey === 'LASTCHANCE'){
      ctx.announceList = [
        '世界への最後のチャンス！夢を掴むのは2チームのみ！'
      ];
      ctx.teams = buildLastChanceParticipants(opt?.nationalOverallRows || []);
      ctx.groups = null;
      ctx.blocks = [
        { label:'LAST CHANCE', kind:'LOCAL', matches:5, ui:true }
      ];
    }

    else if (ctx.tourKey === 'WORLD' || ctx.tourKey === 'CHAMP_WORLD'){
      ctx.announceList = [
        (ctx.tourKey === 'CHAMP_WORLD')
          ? 'いよいよ世界大会だね！世界一目指して頑張ろう！'
          : '世界大会開幕！ファイナルへの道はどのチームが掴む!?'
      ];

      ctx.teams = buildWorldParticipants(opt?.nationalTop10TeamIds || []);
      ctx.groups = splitGroups40(ctx.teams);

      // 予選リーグ構成
      ctx.blocks = [
        { label:'予選リーグ1 A & B', kind:'GROUP', groups:['A','B'], matches:5, ui:true },
        { label:'予選リーグ1 C & D', kind:'GROUP', groups:['C','D'], matches:5, ui:false },

        { label:'予選リーグ2 A & C', kind:'GROUP', groups:['A','C'], matches:5, ui:true },
        { label:'予選リーグ2 B & D', kind:'GROUP', groups:['B','D'], matches:5, ui:false },

        { label:'予選リーグ3 A & D', kind:'GROUP', groups:['A','D'], matches:5, ui:true },
        { label:'予選リーグ3 B & C', kind:'GROUP', groups:['B','C'], matches:5, ui:false },
      ];

      // Winners/Losers は別途 next() 内で予選終了時に自動で追加する（確定）
    }

    else {
      // フォールバック：LOCAL扱い
      ctx.tourKey = 'LOCAL';
      ctx.announceList = [
        '全ての始まり、ローカル大会を行います！',
        '上位10チームがナショナル大会へ進出します！'
      ];
      ctx.teams = buildLocalParticipants();
      ctx.blocks = [{ label:'LOCAL', kind:'LOCAL', matches:5, ui:true }];
    }

    // map
    ctx.allTeamsMap = new Map(ctx.teams.map(t=>[t.teamId, t]));

    // steps
    ctx.steps = buildStepsForTournament(ctx);
    return ctx;
  }

  // -------------------------
  // Persistence
  // -------------------------
  function save(ctx){
    try{
      localStorage.setItem(LS_KEY, JSON.stringify(ctx));
    }catch(e){
      console.warn(e);
    }
  }

  function load(){
    try{
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      const ctx = JSON.parse(raw);

      // Map は復元
      if (ctx && Array.isArray(ctx.teams)){
        ctx.allTeamsMap = new Map(ctx.teams.map(t=>[t.teamId, t]));
      }else{
        return null;
      }
      return ctx;
    }catch(e){
      console.warn(e);
      return null;
    }
  }

  function clear(){
    try{ localStorage.removeItem(LS_KEY); }catch{}
  }

  // -------------------------
  // World branching (Winners/Losers)
  // -------------------------
  function injectWorldFinalPhasesIfNeeded(ctx){
    if (!(ctx.tourKey === 'WORLD' || ctx.tourKey === 'CHAMP_WORLD')) return;
    if (ctx._worldInjected) return;

    // 予選ブロックが全部終わったタイミングで呼ぶ想定
    // 総合上位20 → Winners / 下位20 → Losers
    const overall = computeOverallRows(ctx.teams);
    const winners20 = overall.slice(0,20).map(r=>r.teamId);
    const losers20 = overall.slice(20,40).map(r=>r.teamId);

    ctx.carry.worldWinners20 = winners20;
    ctx.carry.worldLosers20 = losers20;

    const cpuAll = getCpuTeams();
    const player = getPlayerTeam();

    const getTeamById = (id)=>{
      if (id === player.teamId) return player;
      return ctx.allTeamsMap.get(id) || cpuAll.find(t=>t.teamId===id) || null;
    };

    const winnersTeams = winners20.map(getTeamById).filter(Boolean);
    const losersTeams = losers20.map(getTeamById).filter(Boolean);

    // Winners 5試合（上位10→FINAL確定 / 下位10→Losers2）
    // Losers 5試合（上位10→Losers2 / 下位10→敗退）
    // Losers2 5試合（上位10→FINAL / 下位10→敗退）
    // FINAL（条件決着）は sim_final.js 等で後続想定。ここでは枠だけ用意。

    ctx._worldInjected = true;

    ctx.blocks.push(
      { label:'Winners', kind:'SET', teams: winnersTeams, matches:5, ui:true, stage:'WINNERS' },
      { label:'Losers',  kind:'SET', teams: losersTeams,  matches:5, ui:false, stage:'LOSERS' },
    );

    // steps へ差し込む（ENDの手前に追加）
    const endIndex = ctx.steps.findIndex(s=>s.type==='END');
    const extra = [];

    extra.push({ type:'ANNOUNCE', msg:'予選を勝ち上がった猛者たちによるファイナルをかけた大一番！' });
    // Winners 5
    for (let i=1;i<=5;i++) extra.push({ type:'MATCH', blockIndex: ctx.blocks.length-2, matchIndex:i });

    extra.push({ type:'ANNOUNCE', msg:'ファイナルへの道はまだ残されている！反撃開始だ！' });
    // Losers 5
    for (let i=1;i<=5;i++) extra.push({ type:'MATCH', blockIndex: ctx.blocks.length-1, matchIndex:i });

    // Losers2 と FINAL は Winners/Losers結果確定後に next() 内で注入する（確定）
    ctx.steps.splice(endIndex, 0, ...extra);
  }

  function injectLosers2AndFinalIfNeeded(ctx){
    if (!(ctx.tourKey === 'WORLD' || ctx.tourKey === 'CHAMP_WORLD')) return;
    if (!ctx._worldInjected) return;
    if (ctx._losers2Injected) return;

    // Winners/Losers ブロックが終わった後に呼ぶ想定
    // ここでは「直近の総合」から stage 用の割り出しを簡易で行う
    // （本来は Winners内順位/Losers内順位で分けるが、現段階は進行枠確保が目的）

    const overall = computeOverallRows(ctx.teams);

    // Losers2候補：全体11〜30位 を仮の Losers2 として扱う（後で厳密化OK）
    const losers2Ids = overall.slice(10,30).map(r=>r.teamId);
    const finalIds = overall.slice(0,10).map(r=>r.teamId);

    const cpuAll = getCpuTeams();
    const player = getPlayerTeam();
    const getTeamById = (id)=>{
      if (id === player.teamId) return player;
      return ctx.allTeamsMap.get(id) || cpuAll.find(t=>t.teamId===id) || null;
    };

    const losers2Teams = losers2Ids.map(getTeamById).filter(Boolean).slice(0,20);
    const finalTeams = finalIds.map(getTeamById).filter(Boolean).slice(0,10);

    ctx._losers2Injected = true;
    ctx.carry.worldFinal10 = finalIds.slice(0,10);

    ctx.blocks.push(
      { label:'Losers2', kind:'SET', teams: losers2Teams, matches:5, ui:true, stage:'LOSERS2' },
      { label:'FINAL', kind:'FINAL', teams: finalTeams, matches:0, ui:true, stage:'FINAL' }
    );

    const endIndex = ctx.steps.findIndex(s=>s.type==='END');
    const extra = [];

    extra.push({ type:'ANNOUNCE', msg:'これが本当のラストチャンス！全力で挑むんだ！' });
    for (let i=1;i<=5;i++) extra.push({ type:'MATCH', blockIndex: ctx.blocks.length-2, matchIndex:i });

    extra.push({ type:'ANNOUNCE', msg:'いよいよ世界一が決まる!!歴史に名を刻むのはどのチームだ！' });
    extra.push({ type:'FINAL' }); // FINAL条件決着は別 sim_final で実装して接続

    ctx.steps.splice(endIndex, 0, ...extra);
  }

  // -------------------------
  // Step executor
  // -------------------------
  function execEnter(ctx){
    safeCall(SimTournamentFlow.hooks.onEnterTournament, ctx);
    ctx.stepIndex++;
    save(ctx);
  }

  function execAnnounce(ctx, step){
    safeCall(SimTournamentFlow.hooks.onAnnounce, ctx, step.msg);
    ctx.stepIndex++;
    save(ctx);
  }

  function getBlockTeams(ctx, block){
    if (!block) return [];

    if (block.kind === 'LOCAL'){
      return ctx.teams.slice(0,20);
    }
    if (block.kind === 'GROUP'){
      return concatGroups(ctx.groups, block.groups);
    }
    if (block.kind === 'SET'){
      // 固定セット（20想定）
      return (block.teams || []).slice(0,20);
    }
    return [];
  }

  function execMatch(ctx, step){
    const block = ctx.blocks[step.blockIndex];
    const matchTeams = getBlockTeams(ctx, block);

    // UIに出す試合かどうか
    const uiOn = !!block?.ui;

    // 試合開始直前フック（背景切替など）
    safeCall(SimTournamentFlow.hooks.onMatchWillStart, ctx, {
      blockLabel: block?.label || '',
      matchIndex: step.matchIndex,
      matchCount: block?.matches || 0,
      ui: uiOn
    });

    // 試合を実行（UI or silent）
    const meta = {
      tourKey: ctx.tourKey,
      blockLabel: block?.label || '',
      matchIndex: step.matchIndex,
      matchCount: block?.matches || 0
    };

    const res = uiOn
      ? runMatchUI(ctx, matchTeams, meta)
      : runMatchSilent(ctx, matchTeams, meta);

    const matchRows = Array.isArray(res?.rows) ? res.rows : [];
    // rows に placementP が無い場合でも補完
    for (const r of matchRows){
      if (r.placementP == null) r.placementP = placementPoint(Number(r.place)||0);
      if (r.total == null) r.total = calcRowTotal(r);
      if (r.treasure == null) r.treasure = 0;
      if (r.flag == null) r.flag = 0;
      if (r.kp == null) r.kp = 0;
      if (r.ap == null) r.ap = 0;
    }

    // 大会総合へ反映
    applyMatchToTotals(ctx.allTeamsMap, matchRows);

    // 直近キャッシュ
    ctx.lastMatchRows = matchRows;

    // 総合（大会）順位
    const overall = computeOverallRows(ctx.teams);
    ctx.lastOverallRows = overall;

    // UI表示（20のresult + 20/40の総合）
    if (uiOn){
      const payload = {
        title: block?.label || 'RESULT',
        subtitle: `${ctx.tourKey}`,
        matchIndex: step.matchIndex,
        matchCount: block?.matches || 0,
        matchRows: matchRows.map(r=>({
          place: r.place,
          teamId: r.teamId,
          name: r.name,
          placementP: r.placementP,
          kp: r.kp,
          ap: r.ap,
          treasure: r.treasure,
          flag: r.flag,
          total: r.total
        })),
        overallRows: overall.map(r=>({
          place: r.place,
          teamId: r.teamId,
          name: r.name,
          placementP: r.placementP,
          kp: r.kp,
          ap: r.ap,
          treasure: r.treasure,
          flag: r.flag,
          total: r.total
        })),
        playerTeamId: ctx.playerTeamId,
        onNext: ()=>SimTournamentFlow.next(),
        onClose: null
      };

      safeCall(SimTournamentFlow.hooks.onMatchResult, ctx, payload);
      // ★UIがNEXTを押して next() を呼ぶ前提なので stepIndex は進めない
      // （ただしUIが無い場合は即進める）
      save(ctx);
      return;
    }

    // 裏試合：即時に次へ
    ctx.stepIndex++;
    save(ctx);
  }

  function execFinal(ctx){
    // FINAL条件決着は別 sim_final.js で実装して接続する想定
    // ここでは “到達した” を通知して止める
    safeCall(SimTournamentFlow.hooks.onAnnounce, ctx, 'FINAL（条件決着）は未実装です（sim_final.jsで接続してください）');
    ctx.stepIndex++;
    save(ctx);
  }

  function execEnd(ctx){
    // Top10 / Top8 / etc は大会種で分岐（UI側で出せるよう summary を返す）
    const overall = computeOverallRows(ctx.teams);
    const top10 = overall.slice(0,10).map(r=>r.teamId);
    const top8  = overall.slice(0,8).map(r=>r.teamId);
    const top2  = overall.slice(0,2).map(r=>r.teamId);

    const summary = {
      tourKey: ctx.tourKey,
      overallRows: overall,
      top10,
      top8,
      top2
    };

    // carry 更新
    if (ctx.tourKey === 'LOCAL'){
      ctx.carry.localTop10 = top10.slice();
    }
    if (ctx.tourKey === 'NATIONAL'){
      ctx.carry.nationalOverallRows = overall.slice();
      ctx.carry.nationalTop10 = top10.slice();
    }

    safeCall(SimTournamentFlow.hooks.onTournamentEnd, ctx, summary);

    // WORLD系：予選終了なら Winners/Losers を注入
    // （END手前で呼べるが、ここは最後なので、既に注入済みならそのまま）
    ctx.stepIndex++;
    save(ctx);
  }

  function maybeInjectWorld(ctx){
    // 予選ブロック（最初の6ブロック）の最後を超えたら注入
    if (!(ctx.tourKey === 'WORLD' || ctx.tourKey === 'CHAMP_WORLD')) return;

    // 予選のMATCH数：6ブロック * 5 = 30 MATCH ステップ
    // steps内の MATCH を数えて現在位置が超えたら注入する（確実）
    const totalMatchCount = ctx.steps.filter(s=>s.type==='MATCH').length;
    // まだ何も注入してない段階で、予選相当（LOCAL/NATIONALより長い）を過ぎたら注入
    // ※簡易：blocksが6の時点で、stepIndexがstepsの80%付近に達したら注入…のような曖昧は避ける
    // → “予選 blocks (6) が終わった瞬間” を検出：次の step に END が見えている場合
    const nextStep = ctx.steps[ctx.stepIndex] || null;
    const prevStep = ctx.steps[ctx.stepIndex - 1] || null;

    // 予選の最後のMATCHを終えた直後は prevStep.type==='MATCH' かつ nextStep.type==='END' の可能性が高い
    if (!ctx._worldInjected && prevStep && prevStep.type==='MATCH' && nextStep && nextStep.type==='END'){
      injectWorldFinalPhasesIfNeeded(ctx);
      save(ctx);
    }

    // Winners/Losersの最後を終えた直後も nextStep が END に近づくので、Losers2/FINAL注入
    if (ctx._worldInjected && !ctx._losers2Injected && prevStep && prevStep.type==='MATCH' && nextStep && nextStep.type==='END'){
      injectLosers2AndFinalIfNeeded(ctx);
      save(ctx);
    }
  }

  // -------------------------
  // Public API
  // -------------------------
  let _ctx = null;

  SimTournamentFlow.start = function(tourKey, opt){
    _ctx = buildCtx(tourKey, opt || {});
    save(_ctx);
    return clone(_ctx);
  };

  SimTournamentFlow.getState = function(){
    if (_ctx) return clone(_ctx);
    const loaded = load();
    if (loaded){
      _ctx = loaded;
      return clone(_ctx);
    }
    return null;
  };

  SimTournamentFlow.reset = function(){
    _ctx = null;
    clear();
  };

  SimTournamentFlow.next = function(){
    // 状態復元
    if (!_ctx){
      const loaded = load();
      if (loaded) _ctx = loaded;
    }
    if (!_ctx){
      // 自動でLOCAL開始（事故防止）
      _ctx = buildCtx('LOCAL', {});
      save(_ctx);
    }

    // UIのNEXTで呼ばれた場合：MATCH表示中に stepIndex を進めていなかったので、ここで進める
    const curStep = _ctx.steps[_ctx.stepIndex];
    if (!curStep){
      return clone(_ctx);
    }

    // UI表示のMATCH後：手動で stepIndex を進める必要がある
    // curStep が MATCH のまま残っているケースは “表示して止めた” なので、まず進める
    if (curStep.type === 'MATCH'){
      // 直前に execMatch が呼ばれている前提（payload.onNext -> next）
      // なので stepIndex++ して次のstepへ
      _ctx.stepIndex++;
      save(_ctx);
    }

    // WORLD注入のタイミング判定
    maybeInjectWorld(_ctx);

    const step = _ctx.steps[_ctx.stepIndex];
    if (!step){
      return clone(_ctx);
    }

    if (step.type === 'ENTER'){
      execEnter(_ctx);
      return clone(_ctx);
    }

    if (step.type === 'ANNOUNCE'){
      execAnnounce(_ctx, step);
      return clone(_ctx);
    }

    if (step.type === 'MATCH'){
      execMatch(_ctx, step);
      // uiOn の場合は止まる（stepIndex進めない）
      return clone(_ctx);
    }

    if (step.type === 'FINAL'){
      execFinal(_ctx);
      return clone(_ctx);
    }

    if (step.type === 'END'){
      execEnd(_ctx);
      return clone(_ctx);
    }

    // 未知stepはスキップ
    _ctx.stepIndex++;
    save(_ctx);
    return clone(_ctx);
  };

  // 起動時に既存stateがあれば保持
  (function boot(){
    const loaded = load();
    if (loaded) _ctx = loaded;
  })();

})();
