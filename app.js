'use strict';

/*
  MOB BR - app.js v2.1（フル）
  - タイトルNEXTの不安定を解消（確実にメイン表示）
  - タイトルに「ローカル大会（テスト）」ボタン
  - 左メニュー bbattle.png（#btnBattle）からもローカル大会開始
  - B案：tournament_runtime 経由で start(type) / next() を回す

  ポイント：
  - 大会UIが開けない/ロード失敗しても “真っ黒” にならないよう
    「大会開始前にメイン(#app)を必ず表示」してから runtime.start() を呼ぶ
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.app = window.MOBBR.app || {};

(function(){
  const App = window.MOBBR.app;

  const $ = (id) => document.getElementById(id);

  let bound = false;
  let transitioning = false;

  function show(el){
    if (!el) return;
    el.style.display = '';
    el.classList.add('show');
    el.setAttribute('aria-hidden', 'false');
  }

  function hide(el){
    if (!el) return;
    el.style.display = 'none';
    el.classList.remove('show');
    el.setAttribute('aria-hidden', 'true');
  }

  function getTitle(){ return $('titleScreen'); }
  function getMain(){ return $('app'); }

  function showMain(){
    const title = getTitle();
    const main = getMain();
    if (!main) return;

    if (transitioning) return;
    transitioning = true;

    // タイトルを閉じる
    if (title) hide(title);

    // メインを確実に出す（iOSの描画遅延対策で2フレーム）
    main.style.display = 'block';
    show(main);

    requestAnimationFrame(()=>{
      main.style.display = 'block';
      show(main);
      requestAnimationFrame(()=>{ transitioning = false; });
    });
  }

  function startTournament(type){
    // ★真っ黒事故防止：大会開始前にメインを必ず出す
    showMain();

    const rt = window.MOBBR?.tournament?.runtime;
    if (rt && typeof rt.start === 'function'){
      try{
        rt.start(String(type || 'LOCAL'));
        return;
      }catch(e){
        console.error(e);
        alert('大会開始エラー（console確認）');
        return;
      }
    }

    // フォールバック（旧simフローが残ってる場合）
    const Flow = window.MOBBR?.sim?.tournamentFlow;
    if (Flow && typeof Flow.startLocalTournament === 'function' && String(type).toUpperCase() === 'LOCAL'){
      try{
        Flow.startLocalTournament();
        return;
      }catch(e){
        console.error(e);
      }
    }

    alert('大会を開始できません（tournament_runtime.js の読み込み順を確認）');
  }

  function bind(){
    if (bound) return;
    bound = true;

    // タイトルNEXT
    const btnNext = $('btnTitleNext');
    if (btnNext){
      btnNext.addEventListener('click', (e)=>{
        e.preventDefault();
        e.stopPropagation();
        showMain();
      }, { passive:false });
    }

    // タイトル：ローカル大会（テスト）
    const btnTest = $('btnTitleLocalTest');
    if (btnTest){
      btnTest.addEventListener('click', (e)=>{
        e.preventDefault();
        e.stopPropagation();
        startTournament('LOCAL');
      }, { passive:false });
    }

    // 左メニュー：bbattle.png
    const btnBattle = $('btnBattle');
    if (btnBattle){
      btnBattle.addEventListener('click', (e)=>{
        e.preventDefault();
        e.stopPropagation();
        startTournament('LOCAL');
      }, { passive:false });
    }

    // 公開（デバッグ用）
    App.showMain = showMain;
    App.startTournament = startTournament;
  }

  function init(){
    bind();

    // 初期：タイトル表示 / メイン非表示が前提
    const title = getTitle();
    const main = getMain();
    if (title) show(title);
    if (main) hide(main);
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init, { once:true });
  }else{
    init();
  }
})();
