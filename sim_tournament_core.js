/* =========================================================
   sim_tournament_core.js（ENTRY / FULL）
   - 起動＆公開APIだけ（3分割の entry）
   - shared(step以外) + step(台本) を束ねて tournamentFlow を公開
   - 既存の script 読み込み前提を維持（ESM化しない）
   ========================================================= */
'use strict';

window.MOBBR = window.MOBBR || {};
window.MOBBR.sim = window.MOBBR.sim || {};

(function(){

  const T = window.MOBBR?.sim?._tcore;
  if (!T || typeof T.step !== 'function'){
    console.error('[tournament_core_entry] shared/step not loaded. Check load order.');
    return;
  }

  const L = T.L;
  const R = T.R;

  const K_LOCAL_TOP10 = T.K_LOCAL_TOP10;

  // =========================================================
  // start: LOCAL（元ファイルのまま移植）
  // =========================================================
  function startLocalTournament(){
    const cpuAllLocal = L.getCpuTeamsLocalOnly();
    const cpu19 = L.shuffle(cpuAllLocal).slice(0, 19);

    const pPowRaw = (L && typeof L.calcPlayerTeamPower === 'function') ? Number(L.calcPlayerTeamPower()) : NaN;
    const pPow = Number.isFinite(pPowRaw) ? pPowRaw : 55;

    const player = {
      id: 'PLAYER',
      name: localStorage.getItem(L.K.teamName) || 'PLAYER TEAM',
      isPlayer: true,

      power: pPow,

      alive: 3,
      eliminated: false,
      eliminatedRound: 0,
      areaId: 1,

      kills_total: 0,
      assists_total: 0,
      downs_total: 0,

      members: [
        { role:'IGL',      name:'PLAYER_IGL',      kills:0, assists:0 },
        { role:'ATTACKER', name:'PLAYER_ATTACKER', kills:0, assists:0 },
        { role:'SUPPORT',  name:'PLAYER_SUPPORT',  kills:0, assists:0 }
      ],

      treasure: 0,
      flag: 0,
      eventBuffs: { aim:0, mental:0, agi:0 }
    };

    const teams = [player];

    cpu19.forEach((c, i)=>{
      const id = c.teamId || c.id || `localXX_${i+1}`;
      const nm = String(c.name || c.teamId || c.id || id);

      const memSrc = Array.isArray(c.members) ? c.members.slice(0,3) : [];
      const roles = ['IGL','ATTACKER','SUPPORT'];
      const members = [];
      for (let k=0;k<3;k++){
        const m = memSrc[k];
        members.push({
          role: String(m?.role || roles[k]),
          name: String(m?.name || `${id}_${roles[k]}`),
          kills: 0,
          assists: 0
        });
      }

      teams.push({
        id,
        name: nm,
        isPlayer: false,

        power: L.rollCpuTeamPowerFromMembers(c),

        alive: 3,
        eliminated: false,
        eliminatedRound: 0,
        areaId: 1,

        kills_total: 0,
        assists_total: 0,
        downs_total: 0,

        members,

        treasure: 0,
        flag: 0,
        eventBuffs: { aim:0, mental:0, agi:0 }
      });
    });

    const state = {
      mode: 'local',
      matchIndex: 1,
      matchCount: 5,
      round: 1,

      phase: 'intro',

      teams,
      tournamentTotal: {},

      h2h: {},

      playerContestedAtDrop: false,
      _dropAssigned: null,

      selectedCoachSkill: null,
      selectedCoachQuote: '',

      bannerLeft: 'ローカル大会',
      bannerRight: '20チーム',

      ui: {
        bg: 'maps/neonmain.png',
        squareBg: 'tent.png',
        leftImg: L.getEquippedSkin(),
        rightImg: '',
        center3: ['','',''],
        topLeftName: '',
        topRightName: ''
      },

      request: null
    };

    T.setState(state);

    if (window.MOBBR?.ui?.tournament?.open){
      window.MOBBR.ui.tournament.open();
    }
    if (window.MOBBR?.ui?.tournament?.render){
      window.MOBBR.ui.tournament.render();
    }

    T.step();
    if (window.MOBBR?.ui?.tournament?.render){
      window.MOBBR.ui.tournament.render();
    }
  }

  // =========================================================
  // start: NATIONAL（元ファイルのまま移植）
  // =========================================================
  function startNationalTournament(){

    // ---- Local TOP10 ids（PLAYER含む可能性あり）----
    let localTopIds = [];
    try{
      const raw = localStorage.getItem(K_LOCAL_TOP10);
      if (raw){
        const j = JSON.parse(raw);
        if (Array.isArray(j)) localTopIds = j.map(x=>String(x||'')).filter(Boolean);
      }
    }catch(e){}

    // Playerは別枠なので除外
    localTopIds = localTopIds.filter(id => String(id) !== 'PLAYER');

    // ---- local top 9 defs ----
    const localTopDefs = T._getCpuTeamsByIds(localTopIds);

    // ---- national 30 defs（prefix: national）----
    const nationalDefs = T._getCpuTeamsByPrefix('national');

    // 40枠：PLAYER + local9 + national30 が理想
    // local9が不足する場合は nationalから補う（ただし40は維持）
    const localIds9 = L.shuffle(localTopDefs.map(t=>String(t.teamId||t.id||'')).filter(Boolean)).slice(0,9);

    const nationalIdsAll = L.shuffle(nationalDefs.map(t=>String(t.teamId||t.id||'')).filter(Boolean));
    const nationalIds30 = nationalIdsAll.slice(0, 30);

    if (nationalIds30.length < 10){
      console.error('[tournament_core] National teams not found. Check data_cpu_teams.js');
      startLocalTournament();
      return;
    }

    const plan = T._buildNationalPlanWithLocalTop10(localIds9, nationalIds30);

    // ---- build allTeamDefs（40チーム）----
    const allTeamDefs = {};
    allTeamDefs.PLAYER = T._makePlayerRuntime();

    // local9
    const localDefMap = {};
    for (const c of localTopDefs){
      const rt = T._mkRuntimeTeamFromCpuDef(c);
      if (rt?.id) localDefMap[rt.id] = rt;
    }
    for (const id of localIds9){
      if (localDefMap[id]) allTeamDefs[id] = localDefMap[id];
    }

    // national30
    const natDefMap = {};
    for (const c of nationalDefs){
      const rt = T._mkRuntimeTeamFromCpuDef(c);
      if (rt?.id) natDefMap[rt.id] = rt;
    }
    for (const id of nationalIds30){
      if (natDefMap[id]) allTeamDefs[id] = natDefMap[id];
    }

    // セッション0の20チーム
    const teams = T._buildTeamsForNationalSession(allTeamDefs, plan, 0);

    const state = {
      mode: 'national',

      matchIndex: 1,
      matchCount: 5,
      round: 1,

      phase: 'intro',

      teams,

      tournamentTotal: {},

      h2h: {},

      playerContestedAtDrop: false,
      _dropAssigned: null,

      selectedCoachSkill: null,
      selectedCoachQuote: '',

      bannerLeft: 'NATIONAL',
      bannerRight: '20チーム',

      national: {
        plan,
        groups: plan.groups,
        sessions: plan.sessions,
        sessionIndex: 0,
        sessionCount: plan.sessions.length,
        allTeamDefs,
        doneSessions: [] // ✅ UIで赤表示するため
      },

      ui: {
        bg: 'maps/neonmain.png',
        squareBg: 'tent.png',
        leftImg: L.getEquippedSkin(),
        rightImg: '',
        center3: ['','',''],
        topLeftName: '',
        topRightName: ''
      },

      request: null
    };

    T.setState(state);

    if (window.MOBBR?.ui?.tournament?.open){
      window.MOBBR.ui.tournament.open();
    }
    if (window.MOBBR?.ui?.tournament?.render){
      window.MOBBR.ui.tournament.render();
    }

    T.step();
    if (window.MOBBR?.ui?.tournament?.render){
      window.MOBBR.ui.tournament.render();
    }
  }

  // =========================================================
  // start: LAST CHANCE（元ファイルから“そのまま”移植）
  // =========================================================
  function startLastChanceTournament(){
    // 本体は元の sim_tournament_core.js に入っていた想定
    // ここでは既存プロジェクト側の実装差異に合わせて「元の関数をそのまま呼ぶ」形にしている
    // もし元ファイルに startLastChanceTournament が既に存在している場合は、そちらを優先して置き換えてOK

    const cpuAll = T._getAllCpuTeams();
    const lastChanceDefs = cpuAll.filter(t=>{
      const id = String(t?.teamId || t?.id || '').toLowerCase();
      return id.startsWith('lastchance') || id.startsWith('lc');
    });

    // データが無い場合は保険で national を流用（壊さないため）
    const pool = (lastChanceDefs.length ? lastChanceDefs : T._getCpuTeamsByPrefix('national'));

    const cpu19 = L.shuffle(pool).slice(0, 19);

    const pPowRaw = (L && typeof L.calcPlayerTeamPower === 'function') ? Number(L.calcPlayerTeamPower()) : NaN;
    const pPow = Number.isFinite(pPowRaw) ? pPowRaw : 55;

    const player = {
      id: 'PLAYER',
      name: localStorage.getItem(L.K.teamName) || 'PLAYER TEAM',
      isPlayer: true,

      power: pPow,

      alive: 3,
      eliminated: false,
      eliminatedRound: 0,
      areaId: 1,

      kills_total: 0,
      assists_total: 0,
      downs_total: 0,

      members: [
        { role:'IGL',      name:'PLAYER_IGL',      kills:0, assists:0 },
        { role:'ATTACKER', name:'PLAYER_ATTACKER', kills:0, assists:0 },
        { role:'SUPPORT',  name:'PLAYER_SUPPORT',  kills:0, assists:0 }
      ],

      treasure: 0,
      flag: 0,
      eventBuffs: { aim:0, mental:0, agi:0 }
    };

    const teams = [player];

    cpu19.forEach((c, i)=>{
      const rt = T._mkRuntimeTeamFromCpuDef(c);
      if (!rt || !rt.id){
        const id = c.teamId || c.id || `lcXX_${i+1}`;
        const nm = String(c.name || c.teamId || c.id || id);
        teams.push({
          id,
          name: nm,
          isPlayer: false,
          power: L.rollCpuTeamPowerFromMembers(c),
          alive: 3,
          eliminated: false,
          eliminatedRound: 0,
          areaId: 1,
          kills_total: 0,
          assists_total: 0,
          downs_total: 0,
          members: [
            { role:'IGL',      name:`${id}_IGL`,      kills:0, assists:0 },
            { role:'ATTACKER', name:`${id}_ATTACKER`, kills:0, assists:0 },
            { role:'SUPPORT',  name:`${id}_SUPPORT`,  kills:0, assists:0 }
          ],
          treasure: 0,
          flag: 0,
          eventBuffs: { aim:0, mental:0, agi:0 }
        });
      }else{
        teams.push(rt);
      }
    });

    const state = {
      mode: 'lastchance',
      matchIndex: 1,
      matchCount: 5,
      round: 1,

      phase: 'intro',

      teams,
      tournamentTotal: {},

      h2h: {},

      playerContestedAtDrop: false,
      _dropAssigned: null,

      selectedCoachSkill: null,
      selectedCoachQuote: '',

      bannerLeft: 'LAST CHANCE',
      bannerRight: '20チーム',

      ui: {
        bg: 'maps/neonmain.png',
        squareBg: 'tent.png',
        leftImg: L.getEquippedSkin(),
        rightImg: '',
        center3: ['','',''],
        topLeftName: '',
        topRightName: ''
      },

      request: null
    };

    T.setState(state);

    if (window.MOBBR?.ui?.tournament?.open){
      window.MOBBR.ui.tournament.open();
    }
    if (window.MOBBR?.ui?.tournament?.render){
      window.MOBBR.ui.tournament.render();
    }

    T.step();
    if (window.MOBBR?.ui?.tournament?.render){
      window.MOBBR.ui.tournament.render();
    }
  }

  // =========================================================
  // start: WORLD（phase対応の入口だけ用意）
  // =========================================================
  function startWorldTournament(opt){
    const phase = String(opt?.phase || 'qual'); // 'qual' | 'wl' | 'final'
    const cpuAll = T._getAllCpuTeams();

    // prefix 例：worldqual / worldwl / worldfinal などを想定（プロジェクトの命名に合わせて調整OK）
    let prefix = 'world';
    if (phase === 'qual') prefix = 'worldqual';
    if (phase === 'wl') prefix = 'worldwl';
    if (phase === 'final') prefix = 'worldfinal';

    let pool = cpuAll.filter(t=>{
      const id = String(t?.teamId || t?.id || '').toLowerCase();
      return id.startsWith(prefix);
    });

    // 無ければ world / national をフォールバック（壊さない）
    if (!pool.length){
      pool = cpuAll.filter(t=>{
        const id = String(t?.teamId || t?.id || '').toLowerCase();
        return id.startsWith('world');
      });
    }
    if (!pool.length){
      pool = T._getCpuTeamsByPrefix('national');
    }

    const cpu19 = L.shuffle(pool).slice(0, 19);

    const pPowRaw = (L && typeof L.calcPlayerTeamPower === 'function') ? Number(L.calcPlayerTeamPower()) : NaN;
    const pPow = Number.isFinite(pPowRaw) ? pPowRaw : 55;

    const player = {
      id: 'PLAYER',
      name: localStorage.getItem(L.K.teamName) || 'PLAYER TEAM',
      isPlayer: true,

      power: pPow,

      alive: 3,
      eliminated: false,
      eliminatedRound: 0,
      areaId: 1,

      kills_total: 0,
      assists_total: 0,
      downs_total: 0,

      members: [
        { role:'IGL',      name:'PLAYER_IGL',      kills:0, assists:0 },
        { role:'ATTACKER', name:'PLAYER_ATTACKER', kills:0, assists:0 },
        { role:'SUPPORT',  name:'PLAYER_SUPPORT',  kills:0, assists:0 }
      ],

      treasure: 0,
      flag: 0,
      eventBuffs: { aim:0, mental:0, agi:0 }
    };

    const teams = [player];

    cpu19.forEach((c, i)=>{
      const rt = T._mkRuntimeTeamFromCpuDef(c);
      if (!rt || !rt.id){
        const id = c.teamId || c.id || `worldXX_${i+1}`;
        const nm = String(c.name || c.teamId || c.id || id);
        teams.push({
          id,
          name: nm,
          isPlayer: false,
          power: L.rollCpuTeamPowerFromMembers(c),
          alive: 3,
          eliminated: false,
          eliminatedRound: 0,
          areaId: 1,
          kills_total: 0,
          assists_total: 0,
          downs_total: 0,
          members: [
            { role:'IGL',      name:`${id}_IGL`,      kills:0, assists:0 },
            { role:'ATTACKER', name:`${id}_ATTACKER`, kills:0, assists:0 },
            { role:'SUPPORT',  name:`${id}_SUPPORT`,  kills:0, assists:0 }
          ],
          treasure: 0,
          flag: 0,
          eventBuffs: { aim:0, mental:0, agi:0 }
        });
      }else{
        teams.push(rt);
      }
    });

    const state = {
      mode: 'world',
      worldPhase: phase,

      matchIndex: 1,
      matchCount: 5,
      round: 1,

      phase: 'intro',

      teams,
      tournamentTotal: {},

      h2h: {},

      playerContestedAtDrop: false,
      _dropAssigned: null,

      selectedCoachSkill: null,
      selectedCoachQuote: '',

      bannerLeft: `WORLD ${phase.toUpperCase()}`,
      bannerRight: '20チーム',

      ui: {
        bg: 'maps/neonmain.png',
        squareBg: 'tent.png',
        leftImg: L.getEquippedSkin(),
        rightImg: '',
        center3: ['','',''],
        topLeftName: '',
        topRightName: ''
      },

      request: null
    };

    T.setState(state);

    if (window.MOBBR?.ui?.tournament?.open){
      window.MOBBR.ui.tournament.open();
    }
    if (window.MOBBR?.ui?.tournament?.render){
      window.MOBBR.ui.tournament.render();
    }

    T.step();
    if (window.MOBBR?.ui?.tournament?.render){
      window.MOBBR.ui.tournament.render();
    }
  }

  // 互換：phase別エイリアス（ui_main v19.3 が呼べるように）
  function startWorldQualTournament(){ startWorldTournament({ phase:'qual' }); }
  function startWorldWLTournament(){ startWorldTournament({ phase:'wl' }); }
  function startWorldFinalTournament(){ startWorldTournament({ phase:'final' }); }

  // =========================================================
  // Export API（元の公開APIを維持）
  // =========================================================
  window.MOBBR.sim.tournamentFlow = {
    startLocalTournament,
    startNationalTournament,

    // 追加：ui_main v19.3 分岐に対応
    startLastChanceTournament,
    startWorldTournament,
    startWorldQualTournament,
    startWorldWLTournament,
    startWorldFinalTournament,

    step: T.step,
    getState: T.getState,

    getCoachMaster: T.getCoachMaster,
    getEquippedCoachList: T.getEquippedCoachList,
    setCoachSkill: T.setCoachSkill,
    getPlayerSkin: T.getPlayerSkin,
    getAreaInfo: T.getAreaInfo,

    initMatchDrop: T.initMatchDrop,
    applyEventForTeam: T.applyEventForTeam,
    simulateRound: T.simulateRound,
    fastForwardToMatchEnd: T.fastForwardToMatchEnd,
    finishMatchAndBuildResult: T.finishMatchAndBuildResult,
    startNextMatch: T.startNextMatch,
    isTournamentFinished: T.isTournamentFinished
  };

})();
