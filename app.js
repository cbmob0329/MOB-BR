'use strict';

/*
  MOB BR - app.js v19（FULL）
  - index.html は app.js だけ読み込む前提（重複script禁止）
  - 必須ファイルだけ先にロードして「メイン画面は必ず開く」
  - 大会はテストボタン/ BATTLEボタン押下時に必要分だけチェック
  - iPhoneでも原因特定できるように「不足ファイル名」をalert表示
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.__boot = window.MOBBR.__boot || {};

(function(){
  const V = 'v19';

  const $ = (id)=>document.getElementById(id);

  const dom = {
    titleScreen: $('titleScreen'),
    app: $('app'),
    btnTitleNext: $('btnTitleNext'),
    btnTitleLocalTest: $('btnTitleLocalTest')
  };

  // ===== 設定：ここが“あなたの実ファイル名”と1文字でも違うと失敗します =====
  // まず「メイン起動に必須」だけロード（これが欠けるとメインすら出せない）
  const REQUIRED = [
    'storage.js',
    'data_player.js',
    'ui_team.js',
    'ui_training.js',
    'ui_shop.js',
    'ui_card.js',
    'ui_schedule.js',
    'ui_main.js'
  ];

  // 大会テストに必要（ローカルだけ）
  const TOURNAMENT_REQUIRED = [
    'ui_tournament.js',
    'sim_tournament_flow.js',
    'sim_tournament_local.js'
  ];

  // そのうち必要（今は無くてもOK扱いにする：欠けてても起動を止めない）
  const OPTIONAL = [
    'sim_tournament_national.js',
    'sim_tournament_world.js',
    'sim_tournament_final.js'
  ];

  // query付与（キャッシュ対策）
  function withVer(url){
    const u = String(url);
    return u.includes('?') ? u : `${u}?v=19`;
  }

  // 既に読み込まれたか（重複注入防止）
  function isLoaded(url){
    const base = String(url).split('?')[0];
    return !!document.querySelector(`script[data-mobbr-src="${base}"]`);
  }

  function loadScript(url){
    return new Promise((resolve, reject)=>{
      const base = String(url).split('?')[0];
      if (isLoaded(url)) return resolve({ url, cached:true });

      const s = document.createElement('script');
      s.src = withVer(url);
      s.defer = true;
      s.async = false;
      s.dataset.mobbrSrc = base;

      s.onload = ()=> resolve({ url, cached:false });
      s.onerror = ()=> reject({ url, reason:'load_error' });

      document.head.appendChild(s);
    });
  }

  async function loadAllSequential(list){
    const ok = [];
    for (const f of list){
      try{
        const r = await loadScript(f);
        ok.push(r.url);
      }catch(e){
        throw e;
      }
    }
    return ok;
  }

  function showAlertMissing(title, missingUrl){
    // iPhoneで特定できるよう「ファイル名」をそのまま出す
    alert(
      `${title}\n\n` +
      `読み込みに失敗しました\n` +
      `不足/名前違い/置き場所違いの可能性\n\n` +
      `× ${missingUrl}\n\n` +
      `（GitHub Pagesは大文字小文字を区別します）`
    );
  }

  function setTitleButtonsEnabled(on){
    if (dom.btnTitleNext) dom.btnTitleNext.disabled = !on;
    if (dom.btnTitleLocalTest) dom.btnTitleLocalTest.disabled = !on;
    if (dom.btnTitleNext) dom.btnTitleNext.style.opacity = on ? '1' : '0.55';
    if (dom.btnTitleLocalTest) dom.btnTitleLocalTest.style.opacity = on ? '1' : '0.55';
  }

  function openMain(){
    // タイトル→メインの切替（必ず成功させる）
    if (dom.titleScreen) dom.titleScreen.style.display = 'none';
    if (dom.app) dom.app.style.display = 'block';

    // ui_main.js は自動で initMainUI() している前提だが、
    // 念のため再実行できる場合は叩く（“押しても開かない”対策）
    try{
      if (typeof window.MOBBR?.initMainUI === 'function'){
        window.MOBBR.initMainUI();
      }
    }catch(e){
      console.warn('[app] initMainUI failed', e);
    }
  }

  async function ensureTournamentCore(){
    // 大会に必要な最低限だけを読み込む
    for (const f of TOURNAMENT_REQUIRED){
      try{
        await loadScript(f);
      }catch(e){
        showAlertMissing('大会が開始できません', e.url || f);
        return false;
      }
    }
    // OPTIONALは失敗しても止めない（あとでフェーズ移行時に必要になったら追加する）
    for (const f of OPTIONAL){
      loadScript(f).catch(()=>{ /* ignore */ });
    }
    return true;
  }

  async function startLocalTournamentFromTitle(){
    const ok = await ensureTournamentCore();
    if (!ok) return;

    // ここまで来たらFlowが存在するはず
    const Flow = window.MOBBR?.sim?.tournamentFlow;
    if (!Flow || typeof Flow.startLocalTournament !== 'function'){
      alert(
        '大会が開始できません\n\n' +
        'tournamentFlow が見つかりません\n' +
        '（sim_tournament_flow.js の中で window.MOBBR.sim.tournamentFlow を設定しているか確認）'
      );
      return;
    }

    // メイン画面を開かずに大会だけ出してもOK（あなたのテスト要望）
    // ただしUIが重なるのが嫌なら openMain() を先に呼んでOK
    // openMain();

    try{
      Flow.startLocalTournament();
    }catch(e){
      console.error(e);
      alert('大会開始でエラー（コンソール確認）');
    }
  }

  function bindTitle(){
    let locked = false;

    if (dom.btnTitleNext){
      dom.btnTitleNext.addEventListener('click', (e)=>{
        e.preventDefault();
        if (locked) return;
        locked = true;
        try{
          openMain();
        }finally{
          setTimeout(()=>{ locked = false; }, 250);
        }
      }, { passive:false });
    }

    if (dom.btnTitleLocalTest){
      dom.btnTitleLocalTest.addEventListener('click', (e)=>{
        e.preventDefault();
        if (locked) return;
        locked = true;
        startLocalTournamentFromTitle().finally(()=>{
          setTimeout(()=>{ locked = false; }, 250);
        });
      }, { passive:false });
    }
  }

  async function boot(){
    bindTitle();
    setTitleButtonsEnabled(false);

    // 必須ロード（ここで失敗したら、メインすら出せないので確実に表示）
    try{
      await loadAllSequential(REQUIRED);
    }catch(e){
      showAlertMissing('読み込みに失敗しました', e.url || '(unknown)');
      // タイトルのまま止める
      return;
    }

    // 起動成功
    setTitleButtonsEnabled(true);

    // 初期はタイトル表示のまま
    if (dom.titleScreen) dom.titleScreen.style.display = 'block';
    if (dom.app) dom.app.style.display = 'none';
  }

  boot();
})();
