/* =========================================================
   MOB BR - storage.js (FULL)
   - セーブ / ロード（localStorage）
   - 週
   - チーム状態（プレイヤーチーム中心）
   - 所持データ（G / アイテム / コーチスキル等の枠）
   ---------------------------------------------------------
   依存：
   - RULES（data_rules.js）
   ---------------------------------------------------------
   注意：
   ・内部数値は保持してOK。ただしUIには出さない前提。
========================================================= */

(function(){
  'use strict';

  const Storage = {};
  window.Storage = Storage;

  const KEY = 'MOB_BR_SAVE_V1';

  /* =========================
     DEFAULT STATE
  ========================== */
  function defaultState(){
    const cal = (window.RULES && RULES.CALENDAR) ? RULES.CALENDAR : {
      startYear:1989, startMonth:1, startWeek:1, weeksPerMonth:4
    };

    return {
      version: (window.RULES && RULES.GAME) ? RULES.GAME.saveVersion : 1,

      // 週（行動=1週）
      current: {
        year: cal.startYear,
        month: cal.startMonth,
        week: cal.startWeek,
        weekCount: 0, // 開始からの経過週数（0スタート）
      },

      // プレイヤーチーム
      playerTeam: {
        name: 'PLAYER TEAM',
        // 画像は P1.png が基本（今後増える想定）
        image: 'assets/P1.png',
        // 企業ランク（暫定：D→C→B→A→S など）
        companyRank: 'D',
      },

      // 所持
      wallet: {
        g: 0
      },
      inventory: {
        // アイテム所持数
        items: {}, // { ITEM_ID: count }
      },
      coach: {
        // コーチスキル所持/解放
        skills: {}, // { SKILL_ID: true }
      },

      // 履歴
      history: {
        tournaments: [], // [{weekCount,tier,title,top10:[...] , champion:'...'}]
        matches: [],     // [{weekCount,title,rows:[...]}]
      }
    };
  }

  /* =========================
     CORE
  ========================== */
  Storage.init = function(){
    const s = load();
    if(!s){
      save(defaultState());
      return;
    }

    // バージョン差異吸収（最低限）
    if(!s.version){
      s.version = 1;
      save(s);
    }
    if(!s.current){
      const d = defaultState();
      save(d);
      return;
    }
  };

  Storage.reset = function(){
    save(defaultState());
  };

  Storage.getState = function(){
    const s = load();
    return s || defaultState();
  };

  Storage.save = function(){
    const s = Storage.getState();
    save(s);
  };

  /* =========================
     DATE / WEEK
  ========================== */
  Storage.getCurrentDate = function(){
    const s = Storage.getState();
    return { ...s.current };
  };

  Storage.nextWeek = function(){
    const s = Storage.getState();
    const cal = (window.RULES && RULES.CALENDAR) ? RULES.CALENDAR : { weeksPerMonth:4 };

    s.current.weekCount = (s.current.weekCount || 0) + 1;

    // week++
    s.current.week += 1;
    if(s.current.week > cal.weeksPerMonth){
      s.current.week = 1;
      s.current.month += 1;
      if(s.current.month > 12){
        s.current.month = 1;
        s.current.year += 1;
      }
    }

    // 週収入
    const g = Storage.calcWeeklyG();
    s.wallet.g = (s.wallet.g || 0) + g;

    save(s);
  };

  /* =========================
     PLAYER TEAM
  ========================== */
  Storage.getTeamName = function(){
    const s = Storage.getState();
    return s.playerTeam?.name || 'PLAYER TEAM';
  };

  Storage.setTeamName = function(name){
    const s = Storage.getState();
    s.playerTeam.name = String(name || '').trim() || 'PLAYER TEAM';
    save(s);
  };

  Storage.getPlayerTeamImage = function(){
    const s = Storage.getState();
    return s.playerTeam?.image || 'assets/P1.png';
  };

  Storage.setPlayerTeamImage = function(path){
    const s = Storage.getState();
    s.playerTeam.image = String(path || 'assets/P1.png');
    save(s);
  };

  Storage.getCompanyRank = function(){
    const s = Storage.getState();
    return s.playerTeam?.companyRank || 'D';
  };

  Storage.setCompanyRank = function(rank){
    const s = Storage.getState();
    s.playerTeam.companyRank = String(rank || 'D');
    save(s);
  };

  /* =========================
     ECONOMY
  ========================== */
  Storage.calcWeeklyG = function(){
    const eco = (window.RULES && RULES.ECONOMY) ? RULES.ECONOMY : {
      weeklyGBase:50, weeklyGRankBonus:{D:0,C:30,B:60,A:120,S:220}
    };
    const rank = Storage.getCompanyRank();
    const b = eco.weeklyGRankBonus?.[rank] ?? 0;
    const g = (eco.weeklyGBase || 0) + b;
    return Math.max(0, Math.floor(g));
  };

  Storage.getG = function(){
    const s = Storage.getState();
    return s.wallet?.g || 0;
  };

  Storage.addG = function(amount){
    const s = Storage.getState();
    s.wallet.g = (s.wallet.g || 0) + Math.floor(amount || 0);
    if(s.wallet.g < 0) s.wallet.g = 0;
    save(s);
  };

  /* =========================
     TOURNAMENT CHECK
     - 週のトリガ（暫定ルール）
       WORLD:    24週ごと
       NATIONAL: 12週ごと（WORLD週はWORLD優先）
       LOCAL:     4週ごと（上位週は上位優先）
  ========================== */
  Storage.getTournamentTier = function(){
    const s = Storage.getState();
    const wc = s.current?.weekCount || 0;

    const sch = (window.RULES && RULES.TOURNAMENT && RULES.TOURNAMENT.schedule)
      ? RULES.TOURNAMENT.schedule
      : { LOCAL:{everyWeeks:4}, NATIONAL:{everyWeeks:12}, WORLD:{everyWeeks:24} };

    const w = sch.WORLD?.everyWeeks || 24;
    const n = sch.NATIONAL?.everyWeeks || 12;
    const l = sch.LOCAL?.everyWeeks || 4;

    if(wc > 0 && (wc % w === 0)) return 'WORLD';
    if(wc > 0 && (wc % n === 0)) return 'NATIONAL';
    if(wc > 0 && (wc % l === 0)) return 'LOCAL';
    return null;
  };

  Storage.isTournamentWeek = function(){
    return !!Storage.getTournamentTier();
  };

  Storage.getTournamentStartMessage = function(){
    const tier = Storage.getTournamentTier();
    const msg = (window.RULES && RULES.TOURNAMENT && RULES.TOURNAMENT.startMessages)
      ? RULES.TOURNAMENT.startMessages
      : { LOCAL:'ローカル大会 開幕！', NATIONAL:'ナショナル大会 開幕！', WORLD:'ワールドファイナル 開幕！' };

    return msg?.[tier] || '大会 開幕！';
  };

  /* =========================
     INVENTORY (枠)
  ========================== */
  Storage.getItemCount = function(itemId){
    const s = Storage.getState();
    return (s.inventory?.items?.[itemId] || 0);
  };

  Storage.addItem = function(itemId, delta){
    const s = Storage.getState();
    if(!s.inventory) s.inventory = { items:{} };
    if(!s.inventory.items) s.inventory.items = {};
    const cur = s.inventory.items[itemId] || 0;
    const next = cur + Math.floor(delta || 0);
    s.inventory.items[itemId] = Math.max(0, next);
    save(s);
  };

  Storage.hasCoachSkill = function(skillId){
    const s = Storage.getState();
    return !!(s.coach?.skills?.[skillId]);
  };

  Storage.unlockCoachSkill = function(skillId){
    const s = Storage.getState();
    if(!s.coach) s.coach = { skills:{} };
    if(!s.coach.skills) s.coach.skills = {};
    s.coach.skills[skillId] = true;
    save(s);
  };

  /* =========================
     HISTORY
  ========================== */
  Storage.pushMatchHistory = function(matchResult){
    const s = Storage.getState();
    if(!s.history) s.history = { tournaments:[], matches:[] };
    if(!s.history.matches) s.history.matches = [];
    s.history.matches.push({
      weekCount: s.current?.weekCount || 0,
      title: String(matchResult?.title || 'MATCH RESULT'),
      rows: Array.isArray(matchResult?.rows) ? matchResult.rows : [],
    });
    save(s);
  };

  Storage.pushTournamentHistory = function(tournamentResult){
    const s = Storage.getState();
    if(!s.history) s.history = { tournaments:[], matches:[] };
    if(!s.history.tournaments) s.history.tournaments = [];
    s.history.tournaments.push({
      weekCount: s.current?.weekCount || 0,
      tier: Storage.getTournamentTier(),
      title: String(tournamentResult?.title || 'TOURNAMENT'),
      top10: Array.isArray(tournamentResult?.top10) ? tournamentResult.top10 : [],
      champion: String(tournamentResult?.champion || ''),
    });
    save(s);
  };

  /* =========================
     INTERNAL LOAD/SAVE
  ========================== */
  function load(){
    try{
      const raw = localStorage.getItem(KEY);
      if(!raw) return null;
      const obj = JSON.parse(raw);
      if(!obj || typeof obj !== 'object') return null;
      return obj;
    }catch(e){
      return null;
    }
  }

  function save(state){
    try{
      localStorage.setItem(KEY, JSON.stringify(state));
    }catch(e){
      // 失敗してもクラッシュしない
    }
  }

})();
