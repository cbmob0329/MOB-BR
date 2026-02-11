'use strict';

/*
  MOB BR - sim_tournament_flow.js v3（フル）
  修正：
  - CPUデータの参照先を「window.DataCPU」優先に変更（あなたの data_cpu_teams.js 仕様）
  - 互換：window.MOBBR.data.cpu にもブリッジして、他モジュールからも同じ参照で使えるようにする

  A) DataCPU読み込み確認ログ（recent + console）
  B) ローカル大会：20チーム抽選（PLAYER + CPU19）
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.sim = window.MOBBR.sim || {};

(function(){
  const $ = (id) => document.getElementById(id);

  // ui_main.js と同じキー
  const K = {
    recent:  'mobbr_recent',
    team:    'mobbr_team'
  };

  const TS_KEY = 'mobbr_tournamentState';

  function setRecent(text){
    try{ localStorage.setItem(K.recent, String(text || '')); }catch(e){}
    // 画面更新を促す（安全側）
    try{
      if (window.MOBBR?.ui?.main?.render) window.MOBBR.ui.main.render();
      else if (window.MOBBR?.initMainUI) window.MOBBR.initMainUI();
    }catch(e){}
  }

  function hardHideModalBack(){
    const back = $('modalBack');
    if (back){
      back.style.display = 'none';
      back.style.pointerEvents = 'none';
      back.setAttribute('aria-hidden', 'true');
    }
  }

  function getPlayerTeamName(){
    const t = (localStorage.getItem(K.team) || '').trim();
    return t || 'PLAYER TEAM';
  }

  function shuffle(arr){
    const a = arr.slice();
    for (let i=a.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function pickNUniqueTeamObjs(arr, n){
    const out = [];
    const seen = new Set();
    for (const t of arr){
      if (out.length >= n) break;
      const id = (t && (t.teamId || t.id)) ? String(t.teamId || t.id) : '';
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(t);
    }
    return out;
  }

  // ===== DataCPU取得（あなたの仕様に合わせる）=====
  function getDataCPU(){
    // あなたの data_cpu_teams.js は window.DataCPU を定義している
    const direct = window.DataCPU;

    // 互換：将来のために MOBBR.data.cpu も見る
    const bridged = window.MOBBR?.data?.cpu;

    return direct || bridged || null;
  }

  function ensureBridge(DataCPU){
    // 他モジュールが window.MOBBR.data.cpu を期待しても動くようにブリッジ
    if (!DataCPU) return;
    window.MOBBR = window.MOBBR || {};
    window.MOBBR.data = window.MOBBR.data || {};
    if (!window.MOBBR.data.cpu) window.MOBBR.data.cpu = DataCPU;
  }

  // ===== A) DataCPU読み込み確認 =====
  function getCPUAllTeamsSafe(){
    const DataCPU = getDataCPU();
    if (!DataCPU){
      return {
        ok:false,
        teams:[],
        reason:'DataCPU が見つかりません（data_cpu_teams.js の読み込み漏れ/配置ミス）'
      };
    }

    ensureBridge(DataCPU);

    if (typeof DataCPU.getAllTeams !== 'function'){
      return {
        ok:false,
        teams:[],
        reason:'DataCPU.getAllTeams が見つかりません（data_cpu_teams.js のエクスポート不整合）'
      };
    }

    try{
      const all = DataCPU.getAllTeams() || [];
      if (!Array.isArray(all) || all.length === 0){
        return { ok:false, teams:[], reason:'DataCPU.getAllTeams() が空でした（データ破損）' };
      }
      return { ok:true, teams:all, reason:'' };
    }catch(e){
      console.error(e);
      return { ok:false, teams:[], reason:'DataCPU.getAllTeams() で例外（console確認）' };
    }
  }

  function teamIdOf(teamObj){
    const id = teamObj?.teamId || teamObj?.id || '';
    return String(id || '').trim();
  }

  function teamNameOf(teamObj){
    const nm = teamObj?.name || teamObj?.teamName || teamObj?.title || '';
    const id = teamIdOf(teamObj);
    return (String(nm).trim() || id || 'CPU TEAM');
  }

  function cpuImgOf(teamId){
    if (!teamId) return null;
    // あなたの注意書き：<ASSET_BASE>/<teamId>.png で、ASSET_BASE は 'cpu'
    return `cpu/${teamId}.png`;
  }

  // ===== B) 20チーム抽選（ローカル大会）=====
  function buildLocalParticipants(){
    const playerName = getPlayerTeamName();
    const res = getCPUAllTeamsSafe();

    if (!res.ok){
      console.warn('[tournamentFlow] CPU data NG:', res.reason);
      setRecent(`大会：CPUデータNG（${res.reason}）`);

      // 止めずに仮CPUで埋める（デバッグ用）
      const out = [{ id:'P', name:playerName, kind:'player', img:'P1.png' }];
      for (let i=1;i<=19;i++){
        const n = String(i).padStart(2,'0');
        out.push({ id:`CPU${n}`, name:`CPU TEAM ${n}`, kind:'cpu', img:null });
      }
      return { participants: out, debug: { cpuOk:false, pickedFrom:'fallback' } };
    }

    const all = res.teams;

    // ローカル大会：localXX 優先（足りない場合は全体から）
    const locals = all.filter(t => teamIdOf(t).startsWith('local'));
    const pool = (locals.length >= 19) ? locals : all;

    const picked = pickNUniqueTeamObjs(shuffle(pool), 19);

    const out = [{ id:'P', name:playerName, kind:'player', img:'P1.png' }];

    for (const t of picked){
      const tid = teamIdOf(t);
      out.push({
        id: tid || `cpu_${out.length}`,
        name: teamNameOf(t),
        kind: 'cpu',
        img: cpuImgOf(tid)
      });
    }

    // 念のため足りなければ補完（重複なし）
    if (out.length < 20){
      const used = new Set(out.map(x => x.id));
      for (const t of shuffle(all)){
        if (out.length >= 20) break;
        const tid = teamIdOf(t);
        if (!tid || used.has(tid)) continue;
        used.add(tid);
        out.push({ id: tid, name: teamNameOf(t), kind:'cpu', img: cpuImgOf(tid) });
      }
    }

    while (out.length < 20){
      const n = String(out.length).padStart(2,'0');
      out.push({ id:`CPU${n}`, name:`CPU TEAM ${n}`, kind:'cpu', img:null });
    }

    console.log('[tournamentFlow] CPU OK total=', all.length, 'locals=', locals.length);
    console.log('[tournamentFlow] participants=', out.map(x => x.id));
    setRecent(`大会：CPU OK（${all.length}件）／抽選完了（20）`);

    return {
      participants: out,
      debug: {
        cpuOk:true,
        cpuAll: all.length,
        localCount: locals.length,
        pickedFrom: (pool === locals ? 'local' : 'all')
      }
    };
  }

  function initTournamentState(){
    const built = buildLocalParticipants();

    const st = {
      ver: 3,
      ts: Date.now(),
      mode: 'local',
      phase: 'arrival',
      participants: built.participants,
      debug: built.debug
    };

    localStorage.setItem(TS_KEY, JSON.stringify(st));
    return st;
  }

  function startLocalTournament(){
    hardHideModalBack();

    const st = initTournamentState();

    const TUI = window.MOBBR?.ui?.tournament;
    if (TUI && typeof TUI.open === 'function'){
      try{ TUI.open(); }
      catch(err){
        console.error(err);
        setRecent('大会：UI開始に失敗（コンソール確認）');
      }
      return;
    }

    setRecent('大会：UI未接続（ui_tournament.js の読み込み確認）');
    console.log('[tournamentFlow] tournamentState=', st);
  }

  window.MOBBR.sim.tournamentFlow = {
    startLocalTournament,
    initTournamentState
  };
})();
