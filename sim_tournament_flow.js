'use strict';

/*
  MOB BR - sim_tournament_flow.js v1（フル）
  目的：
  - ui_main.js(v18) の BATTLE ボタンが呼ぶ入口
    window.MOBBR.sim.tournamentFlow.startLocalTournament() を提供
  - 大会UI（ui_tournament.js）が存在すれば open で進行
  - 無ければ main の recent に「未実装」を出すだけ

  ※大会データは 1から前提（現状は仮の参加チーム一覧を生成）
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.sim = window.MOBBR.sim || {};

(function(){
  const $ = (id) => document.getElementById(id);

  // ui_main.js と合わせる（K相当）
  const K = {
    recent: 'mobbr_recent',
    team: 'mobbr_team',
    company: 'mobbr_company'
  };

  const TS_KEY = 'mobbr_tournamentState'; // { phase, ts, participants[] }

  function setRecent(text){
    try{
      localStorage.setItem(K.recent, String(text || ''));
    }catch(e){}
    // ui_main.js が render() 持ってるなら反映を促す
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

  function buildParticipantsFallback(){
    // 参加20チーム：PLAYER + CPU19（仮）
    const playerTeam = (localStorage.getItem(K.team) || 'PLAYER TEAM') || 'PLAYER TEAM';
    const out = [{ id:'P', name: playerTeam, kind:'player' }];

    for (let i=1;i<=19;i++){
      const n = String(i).padStart(2,'0');
      out.push({ id:`CPU${n}`, name:`CPU TEAM ${n}`, kind:'cpu' });
    }
    return out;
  }

  function initTournamentState(){
    const st = {
      ver: 1,
      ts: Date.now(),
      phase: 'arrival',
      participants: buildParticipantsFallback()
    };
    localStorage.setItem(TS_KEY, JSON.stringify(st));
    return st;
  }

  function startLocalTournament(){
    // “透明フタ事故”の保険
    hardHideModalBack();

    // state 初期化
    initTournamentState();

    // 大会UIがあるなら開く
    const TUI = window.MOBBR?.ui?.tournament;
    if (TUI && typeof TUI.open === 'function'){
      setRecent('大会：ローカル大会を開始！');
      try{
        TUI.open();
      }catch(err){
        console.error(err);
        setRecent('大会：UI開始に失敗（コンソール確認）');
      }
      return;
    }

    // UIが無い場合
    setRecent('大会：未実装（ui_tournament.js の読み込みを確認）');
  }

  window.MOBBR.sim.tournamentFlow = {
    startLocalTournament,
    initTournamentState
  };
})();
