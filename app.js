'use strict';

/*
  MOB BR - app.js v18（FULL）
  役割：
  - タイトル → メイン表示の制御（不安定対策込み）
  - タイトルのテスト用「ローカル大会（テスト）」ボタン
    → メインには行かず大会（B案：runtime.start）を開始

  前提：
  - index.html に #titleScreen と #app が存在する
  - B案の大会一式：
      tournament_flow.js
      tournament_runtime.js  (window.MOBBR.tournament.runtime.start)
      ui_tournament.js
      tournament_hooks.js
*/

(function(){
  const $ = (id)=>document.getElementById(id);

  const elTitle = $('titleScreen');
  const elApp   = $('app');

  const btnTitleNext      = $('btnTitleNext');
  const btnTitleLocalTest = $('btnTitleLocalTest');

  // ====== safe show/hide ======
  function showTitle(){
    if (elTitle) elTitle.style.display = 'block';
    if (elApp) elApp.style.display = 'none';
  }

  function showMain(){
    if (elTitle) elTitle.style.display = 'none';
    if (elApp) elApp.style.display = 'block';
  }

  // 「タイトルNEXT」不安定対策：
  // - display切替 → rAF → rAF → もう一度 display を強制
  // - iOSでたまに反映が落ちるのを潰す
  function goMainStable(){
    // 先に即切替
    showMain();

    // 2フレーム待ってから再度強制
    requestAnimationFrame(()=>{
      requestAnimationFrame(()=>{
        showMain();

        // さらに保険：微小遅延で再強制
        setTimeout(()=>{ showMain(); }, 0);
        setTimeout(()=>{ showMain(); }, 30);

        // メインUI再描画（存在すれば）
        try{
          if (window.MOBBR?.initMainUI) window.MOBBR.initMainUI();
          if (window.MOBBR?.ui?.team?.render) window.MOBBR.ui.team.render();
        }catch(e){}
      });
    });
  }

  // ====== Tournament start (B案) ======
  function startLocalTournamentFromTitle(){
    // メインには行かない（ここ重要）
    // タイトルは閉じる（画面上は大会overlayが出る）
    if (elTitle) elTitle.style.display = 'none';
    if (elApp) elApp.style.display = 'none';

    // runtime を呼ぶ
    const rt = window.MOBBR?.tournament?.runtime;
    if (!rt || typeof rt.start !== 'function'){
      // ここに来るなら読み込み順 or ファイル名不一致
      alert('大会が起動できません：tournament_runtime.js の読み込み/名前を確認してください');
      // 逃げ道：メインへ
      goMainStable();
      return;
    }

    // まずUI用DOMを作れる状態にするため、1tick遅らせて開始（iOS保険）
    setTimeout(()=>{
      try{
        // type は runtime 側が大文字想定なら 'LOCAL'、小文字想定なら 'local'
        // ここは今回の flow PLAN に合わせて 'LOCAL'
        rt.start('LOCAL');
      }catch(e){
        console.error(e);
        alert('大会開始でエラー（console確認）');
        goMainStable();
      }
    }, 0);
  }

  // ====== bind ======
  let bound = false;
  function bind(){
    if (bound) return;
    bound = true;

    if (btnTitleNext){
      btnTitleNext.addEventListener('click', (e)=>{
        e.preventDefault();
        e.stopPropagation();
        goMainStable();
      }, { passive:false });
    }

    if (btnTitleLocalTest){
      btnTitleLocalTest.addEventListener('click', (e)=>{
        e.preventDefault();
        e.stopPropagation();
        startLocalTournamentFromTitle();
      }, { passive:false });
    }
  }

  // ====== init ======
  function init(){
    bind();

    // 初期はタイトル
    showTitle();

    // 既に自動起動系が走ってる場合でもメインを隠す
    // （ui_main.js が即 init してても、表示は app.js が優先）
    setTimeout(()=>{ showTitle(); }, 0);
  }

  // DOM ready
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  }else{
    init();
  }

})();
