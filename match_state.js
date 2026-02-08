'use strict';

/*
  MOB BR - match_state.js v1（フル / 試合の土台ステート）

  役割（これが担当）：
  - 1試合（1マッチ）中の「20チーム状態」を統一フォーマットで保持する
  - teamId / areaId / alive / deathBoxes / eliminated
    kills_total / assists_total / members[kills,assists]
    treasure / flag / eventBuffs（試合中だけ有効）
  - 初期化（20チーム生成）・参照・更新系の共通関数を提供する
  - ここは “表示(UI)” も “勝敗計算/交戦/イベント抽選” もやらない（次ファイル）

  これが担当しない：
  - マップ/移動/ラウンド進行（match_map.js / match_flow.js）
  - イベント抽選（match_events.js）
  - 交戦枠/敵選び（match_encounter.js）
  - 勝敗/キルアシ配分/順位計算（match_battle.js / match_result.js）
  - UI表示（ui_match.js / ui_result.js）

  依存（あれば使う / 無くても動く）：
  - window.MOBBR.storage（メンバー名などの読み取りに使用。無ければ A/B/C 固定でも動く）
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.match = window.MOBBR.match || {};

(function(){
  const S = window.MOBBR?.storage || null;

  const FALLBACK_KEYS = {
    playerTeam: 'mobbr_playerTeam',
    m1: 'mobbr_m1',
    m2: 'mobbr_m2',
    m3: 'mobbr_m3',
  };
  const K = (S && S.KEYS) ? S.KEYS : FALLBACK_KEYS;

  function getStr(key, def){
    if (S?.getStr) return S.getStr(key, def);
    const v = localStorage.getItem(key);
    return (v === null || v === undefined || v === '') ? def : v;
  }

  // =============================
  // 仕様固定：チーム状態フォーマット
  // =============================
  function createMember(name){
    return {
      name: String(name || ''),
      kills: 0,
      assists: 0,
    };
  }

  function createEventBuffs(){
    // Aim/Mental/Agility は「％」で保持（+2% -> 2）に統一
    // 計算側で ×(1 + pct/100) する想定
    return {
      aimPct: 0,
      mentalPct: 0,
      agilityPct: 0,
    };
  }

  function createTeam(teamId, opts){
    const o = opts || {};
    const members = Array.isArray(o.members) ? o.members : [];

    // alive は 0〜3
    const alive = clampInt(o.alive ?? 3, 0, 3);

    return {
      // ===== 必須（仕様の唯一の正）=====
      teamId: String(teamId || ''),
      group: String(o.group || ''),     // 'A'/'B'/'C'/'D' or ''（大会側で付与）
      areaId: clampInt(o.areaId ?? 0, 0, 9999),

      alive: alive,
      deathBoxes: clampInt(o.deathBoxes ?? 0, 0, 3),
      eliminated: Boolean(o.eliminated || false),

      kills_total: clampInt(o.kills_total ?? 0, 0, 999999),
      assists_total: clampInt(o.assists_total ?? 0, 0, 999999),

      members: [
        createMember(members[0]?.name ?? ''),
        createMember(members[1]?.name ?? ''),
        createMember(members[2]?.name ?? ''),
      ],

      treasure: clampInt(o.treasure ?? 0, 0, 999999),
      flag: clampInt(o.flag ?? 0, 0, 999999),

      eventBuffs: createEventBuffs(),

      // ===== 便利：結果計算側が入れていく拡張枠（ここでは触らない）=====
      // matchPoints: 0, // 1試合分のポイント（順位/キル/アシ/宝/旗）合算、result側で付与など
      // lastPlacement: null, // 1〜20（result側で付与）
    };
  }

  function createMatchState(params){
    const p = params || {};

    // 必須：20チームの teamId リスト（ローカル/ナショナル/ワールド等は上位側で用意）
    // ここでは「受け取った順」で state.teams を作るだけ（シャッフルは上位で）
    const teamIds = Array.isArray(p.teamIds) ? p.teamIds : [];
    if (teamIds.length === 0){
      // 空でも壊れないようにする（ただし試合は成立しない）
      return {
        matchId: String(p.matchId || ''),
        createdAt: Date.now(),
        round: 0,
        teams: [],
        meta: { mode: String(p.mode || ''), note: String(p.note || '') }
      };
    }

    const teams = teamIds.map((id)=>{
      const o = (p.teamInitMap && p.teamInitMap[id]) ? p.teamInitMap[id] : {};
      return createTeam(id, o);
    });

    return {
      matchId: String(p.matchId || ''),
      createdAt: Date.now(),

      // ラウンド進行は match_flow が握る。ここでは数字箱だけ
      round: clampInt(p.round ?? 0, 0, 99),

      // 20チーム配列（仕様の唯一の正）
      teams: teams,

      // 予備：上位が使うメタ
      meta: {
        mode: String(p.mode || ''), // 'tournament' / 'free' 等
        note: String(p.note || ''),
      },
    };
  }

  // =============================
  // プレイヤー情報（最低限）
  // =============================
  function getPlayerTeamId(){
    return getStr(K.playerTeam, 'PLAYER');
  }

  function getPlayerMemberNames(){
    return {
      A: getStr(K.m1, 'A'),
      B: getStr(K.m2, 'B'),
      C: getStr(K.m3, 'C'),
    };
  }

  function applyPlayerMembers(team){
    if (!team) return;
    const names = getPlayerMemberNames();
    // 表示/ログ側が使いやすいよう members[].name に入れる
    team.members[0].name = names.A;
    team.members[1].name = names.B;
    team.members[2].name = names.C;
  }

  // =============================
  // 参照ユーティリティ
  // =============================
  function findTeam(state, teamId){
    if (!state || !Array.isArray(state.teams)) return null;
    const id = String(teamId || '');
    return state.teams.find(t => t && t.teamId === id) || null;
  }

  function getTeams(state){
    return (state && Array.isArray(state.teams)) ? state.teams : [];
  }

  function getAliveTeams(state){
    return getTeams(state).filter(t => t && !t.eliminated && t.alive > 0);
  }

  function getActiveTeams(state){
    // eliminated=false の全チーム（alive=0でもDB待ちなどで存在はする）
    return getTeams(state).filter(t => t && !t.eliminated);
  }

  // =============================
  // 変更系（ロジックは上位が決め、ここは安全に更新）
  // =============================
  function setRound(state, round){
    if (!state) return;
    state.round = clampInt(round, 0, 99);
  }

  function setGroup(state, teamId, group){
    const t = findTeam(state, teamId);
    if (!t) return false;
    t.group = String(group || '');
    return true;
  }

  function setArea(state, teamId, areaId){
    const t = findTeam(state, teamId);
    if (!t) return false;
    t.areaId = clampInt(areaId, 0, 9999);
    return true;
  }

  function setEliminated(state, teamId, eliminated){
    const t = findTeam(state, teamId);
    if (!t) return false;
    t.eliminated = Boolean(eliminated);
    if (t.eliminated){
      t.alive = 0;
      t.deathBoxes = 0;
    }
    return true;
  }

  function setAlive(state, teamId, alive){
    const t = findTeam(state, teamId);
    if (!t) return false;
    const a = clampInt(alive, 0, 3);
    t.alive = a;
    if (a <= 0){
      // alive=0 でも eliminated にはしない（DB待ちや残存扱いを上位で決めるため）
      // eliminated を立てるのは勝敗処理側
    }
    return true;
  }

  function addDeathBoxes(state, teamId, delta){
    const t = findTeam(state, teamId);
    if (!t) return false;
    t.deathBoxes = clampInt((t.deathBoxes + (Number(delta)||0)), 0, 3);
    return true;
  }

  function addTreasure(state, teamId, delta){
    const t = findTeam(state, teamId);
    if (!t) return false;
    t.treasure = clampInt((t.treasure + (Number(delta)||0)), 0, 999999);
    return true;
  }

  function addFlag(state, teamId, delta){
    const t = findTeam(state, teamId);
    if (!t) return false;
    t.flag = clampInt((t.flag + (Number(delta)||0)), 0, 999999);
    return true;
  }

  function resetEventBuffs(state){
    getTeams(state).forEach(t=>{
      if (!t) return;
      t.eventBuffs = createEventBuffs();
    });
  }

  function addEventBuffPct(state, teamId, kind, pct){
    // kind: 'aim'|'mental'|'agility'
    const t = findTeam(state, teamId);
    if (!t) return false;

    const p = Number(pct) || 0;
    if (!t.eventBuffs) t.eventBuffs = createEventBuffs();

    if (kind === 'aim')      t.eventBuffs.aimPct     += p;
    else if (kind === 'mental')  t.eventBuffs.mentalPct  += p;
    else if (kind === 'agility') t.eventBuffs.agilityPct += p;
    else return false;

    // 異常値はここでクランプ（暴走防止）
    t.eventBuffs.aimPct = clampNum(t.eventBuffs.aimPct, -50, 50);
    t.eventBuffs.mentalPct = clampNum(t.eventBuffs.mentalPct, -50, 50);
    t.eventBuffs.agilityPct = clampNum(t.eventBuffs.agilityPct, -50, 50);
    return true;
  }

  function addKill(state, teamId, memberIndex, delta){
    const t = findTeam(state, teamId);
    if (!t) return false;

    const d = clampInt(delta ?? 1, 0, 999999);
    t.kills_total = clampInt(t.kills_total + d, 0, 999999);

    const idx = clampInt(memberIndex, 0, 2);
    const m = t.members && t.members[idx] ? t.members[idx] : null;
    if (m) m.kills = clampInt((m.kills + d), 0, 999999);
    return true;
  }

  function addAssist(state, teamId, memberIndex, delta){
    const t = findTeam(state, teamId);
    if (!t) return false;

    const d = clampInt(delta ?? 1, 0, 999999);
    t.assists_total = clampInt(t.assists_total + d, 0, 999999);

    const idx = clampInt(memberIndex, 0, 2);
    const m = t.members && t.members[idx] ? t.members[idx] : null;
    if (m) m.assists = clampInt((m.assists + d), 0, 999999);
    return true;
  }

  // =============================
  // シリアライズ（保存/復元）
  // =============================
  function cloneState(state){
    // 安全のため JSON clone（速度より破綻防止）
    try{
      return JSON.parse(JSON.stringify(state || null));
    }catch{
      return null;
    }
  }

  function validateTeamShape(team){
    // 最低限の型チェック（壊れたセーブ等の事故防止）
    if (!team || typeof team !== 'object') return false;
    if (typeof team.teamId !== 'string') return false;
    if (!Array.isArray(team.members) || team.members.length !== 3) return false;
    return true;
  }

  function validateStateShape(state){
    if (!state || typeof state !== 'object') return false;
    if (!Array.isArray(state.teams)) return false;
    for (const t of state.teams){
      if (!validateTeamShape(t)) return false;
    }
    return true;
  }

  // =============================
  // small helpers
  // =============================
  function clampInt(v, min, max){
    const n = Math.floor(Number(v));
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
  }

  function clampNum(v, min, max){
    const n = Number(v);
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
  }

  // =============================
  // 公開API
  // =============================
  const api = {
    VERSION: 'v1',

    // player info
    getPlayerTeamId,
    getPlayerMemberNames,
    applyPlayerMembers,

    // create
    createMember,
    createTeam,
    createMatchState,

    // query
    findTeam,
    getTeams,
    getActiveTeams,
    getAliveTeams,

    // mutate
    setRound,
    setGroup,
    setArea,
    setEliminated,
    setAlive,
    addDeathBoxes,
    addTreasure,
    addFlag,
    resetEventBuffs,
    addEventBuffPct,
    addKill,
    addAssist,

    // serialize
    cloneState,
    validateStateShape,
  };

  window.MOBBR.match.state = api;
})();
