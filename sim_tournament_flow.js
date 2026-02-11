'use strict';

/*
  MOB BR - sim_tournament_flow.js v2（フル）
  A) data_cpu_teams.js が読めているかを「中央ログ(recent) + console」で確認
  B) ローカル大会：20チーム抽選（PLAYER + CPU19）
     - 可能なら localXX から抽選
     - 足りない/不在なら全CPUから補完
  生成state：
    mobbr_tournamentState = {
      ver, ts, mode:'local',
      participants:[ { id, name, kind:'player'|'cpu', img? } ... ] (20)
    }
  ※大会UIがあれば open()、無ければログのみ
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.sim = window.MOBBR.sim || {};

(function(){
  const $ = (id) => document.getElementById(id);

  // ui_main.js と同じキー
  const K = {
    recent:  'mobbr_recent',
    team:    'mobbr_team',
    company: 'mobbr_company'
  };

  const TS_KEY = 'mobbr_tournamentState';

  function setRecent(text){
    try{ localStorage.setItem(K.recent, String(text || '')); }catch(e){}
    // ui_main が render を握ってるので、再描画を促す（安全側）
    try{
      if (window.MOBBR?.initMainUI) window.MOBBR.initMainUI();
      if (window.MOBBR?.ui?.main?.render) window.MOBBR.ui.main.render();
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

  function pickNUnique(arr, n){
    const out = [];
    const seen = new Set();
    for (const x of arr){
      if (out.length >= n) break;
      const key = (typeof x === 'string') ? x : (x && (x.id || x.teamId || x.key));
      const k = String(key || '');
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(x);
    }
    return out;
  }

  // ===== A) DataCPU読み込み確認 =====
  function getCPUAllTeamsSafe(){
    const DataCPU = window.MOBBR?.data?.cpu; // data_cpu_teams.js は window.MOBBR.data.cpu を想定
    if (!DataCPU || typeof DataCPU.getAllTeams !== 'function'){
      return { ok:false, teams:[], reason:'DataCPU.getAllTeams が見つかりません（data_cpu_teams.js 読み込み漏れ）' };
    }
    try{
      const all = DataCPU.getAllTeams() || [];
      if (!Array.isArray(all) || all.length === 0){
        return { ok:false, teams:[], reason:'DataCPU.getAllTeams() は空でした（データ破損 or 返却形式不正）' };
      }
      return { ok:true, teams:all, reason:'' };
    }catch(e){
      return { ok:false, teams:[], reason:'DataCPU.getAllTeams() 実行で例外（console確認）' };
    }
  }

  function cpuNameOf(teamObj, fallbackId){
    if (!teamObj) return fallbackId || 'CPU TEAM';
    // data_cpu_teams.js の形に合わせて柔軟対応
    const nm = teamObj.name || teamObj.teamName || teamObj.title || '';
    const id = teamObj.id || teamObj.teamId || fallbackId || '';
    return (String(nm).trim() || String(id).trim() || 'CPU TEAM');
  }

  function cpuIdOf(teamObj, fallbackId){
    const id = teamObj?.id || teamObj?.teamId || fallbackId;
    return String(id || '').trim();
  }

  function cpuImgOf(teamId){
    // data_cpu_teams.js 仕様：cpu/<teamId>.png
    if (!teamId) return null;
    return `cpu/${teamId}.png`;
  }

  // ===== B) 20チーム抽選（ローカル大会）=====
  function buildLocalParticipants(){
    const playerName = getPlayerTeamName();
    const res = getCPUAllTeamsSafe();

    // Aログ（console + recent）
    if (!res.ok){
      console.warn('[tournamentFlow] CPU data not ready:', res.reason);
      setRecent(`大会：CPUデータNG（${res.reason}）`);
      // フォールバック：CPU19を仮生成
      const out = [{ id:'P', name:playerName, kind:'player', img:'P1.png' }];
      for (let i=1;i<=19;i++){
        const n = String(i).padStart(2,'0');
        out.push({ id:`CPU${n}`, name:`CPU TEAM ${n}`, kind:'cpu', img:null });
      }
      return { participants: out, debug: { cpuOk:false, pickedFrom:'fallback' } };
    }

    const all = res.teams;

    // ローカル大会なので localXX 優先（なければ全部から）
    const locals = all.filter(t => cpuIdOf(t, '').startsWith('local'));
    const basePool = (locals.length >= 19) ? locals : all;

    // シャッフルして19抽選
    const shuffled = shuffle(basePool);
    const picked = pickNUnique(shuffled, 19);

    // participants
    const out = [{ id:'P', name:playerName, kind:'player', img:'P1.png' }];

    // 19 CPU
    for (const t of picked){
      const tid = cpuIdOf(t, '');
      out.push({
        id: tid || `cpu_${out.length}`,
        name: cpuNameOf(t, tid),
        kind: 'cpu',
        img: cpuImgOf(tid)
      });
    }

    // 万一 19 未満なら補完（重複避け）
    if (out.length < 20){
      const used = new Set(out.map(x => x.id));
      const fillPool = shuffle(all);
      for (const t of fillPool){
        if (out.length >= 20) break;
        const tid = cpuIdOf(t, '');
        if (!tid || used.has(tid)) continue;
        used.add(tid);
        out.push({ id: tid, name: cpuNameOf(t, tid), kind:'cpu', img: cpuImgOf(tid) });
      }
    }

    // それでも足りない場合は仮で埋める
    while (out.length < 20){
      const n = String(out.length).padStart(2,'0');
      out.push({ id:`CPU${n}`, name:`CPU TEAM ${n}`, kind:'cpu', img:null });
    }

    // Aログ（成功）
    const sample = out.slice(0,4).map(x => x.name).join(' / ');
    console.log('[tournamentFlow] CPU OK teams=', all.length, 'locals=', locals.length);
    console.log('[tournamentFlow] picked participants=', out.map(x => x.id));
    setRecent(`大会：CPU OK（${all.length}件）／抽選完了（20）`);

    return {
      participants: out,
      debug: { cpuOk:true, cpuAll:all.length, localCount:locals.length, pickedFrom:(basePool===locals?'local':'all'), sample }
    };
  }

  function initTournamentState(){
    const built = buildLocalParticipants();

    const st = {
      ver: 2,
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

    // UIがあるなら開く
    const TUI = window.MOBBR?.ui?.tournament;
    if (TUI && typeof TUI.open === 'function'){
      try{
        TUI.open();
      }catch(err){
        console.error(err);
        setRecent('大会：UI開始に失敗（コンソール確認）');
      }
      return;
    }

    // UIが無い場合
    setRecent('大会：UI未接続（ui_tournament.js の読み込み確認）');
  }

  window.MOBBR.sim.tournamentFlow = {
    startLocalTournament,
    initTournamentState
  };
})();
