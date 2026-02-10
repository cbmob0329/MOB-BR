'use strict';

/*
  MOB BR - app.js v2.2（フル）
  目的：
  - タイトルNEXTの不安定を解消（確実にメイン表示へ）
  - タイトルに「ローカル大会（テスト）」ボタン追加（後で削除）
  - 左メニュー bbattle.png（#btnBattle）からも大会開始（B案：runtime.start）
  - ui_main.js のルーティング（TEAM/TRAINING/SHOP...）を壊さない
  - modalBack（透明フタ）事故の最終保険を入れる

  重要：
  - #app を初期化時に勝手に display:none にしない（ui_main / 既存CSSと衝突するため）
  - 「タイトル→メイン」切替だけを担当。左メニューの他ボタンは ui_main.js に任せる。
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.app = window.MOBBR.app || {};

(function(){
  const App = window.MOBBR.app;
  const $ = (id) => document.getElementById(id);

  let bound = false;
  let switching = false;

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

  function killModalBack(){
    const back = $('modalBack');
    if (!back) return;
    back.style.display = 'none';
    back.style.pointerEvents = 'none';
    back.setAttribute('aria-hidden', 'true');
  }

  function showMain(){
    const title = $('titleScreen');
    const main = $('app');
    if (!main) return;

    if (switching) return;
    switching = true;

    // 透明フタ事故の保険
    killModalBack();

    // タイトルを閉じる
    if (title) hide(title);

    // メインを確実に表示（iOS描画遅延対策で2フレーム）
    main.style.display = 'block';
    main.setAttribute('aria-hidden', 'false');

    requestAnimationFrame(()=>{
      main.style.display = 'block';
      main.setAttribute('aria-hidden', 'false');

      requestAnimationFrame(()=>{
        switching = false;
      });
    });
  }

  function startTournamentLocal(){
    // 大会開始前にメイン表示を確定（黒画面回避）
    showMain();

    // B案：runtime.start
    const rt = window.MOBBR?.tournament?.runtime;
    if (rt && typeof rt.start === 'function'){
      try{
        rt.start('LOCAL');
        return;
      }catch(e){
        console.error(e);
        alert('大会開始エラー（console確認）');
        return;
      }
    }

    // 旧：sim側 flow が残っている場合の保険
    const Flow = window.MOBBR?.sim?.tournamentFlow;
    if (Flow && typeof Flow.startLocalTournament === 'function'){
      try{
        Flow.startLocalTournament();
        return;
      }catch(e){
        console.error(e);
      }
    }

    alert('大会を開始できません（tournament_runtime.js の読み込みを確認）');
  }

  function ensureTitleLocalTestButton(){
    // index.html 側に #btnTitleLocalTest が無い場合でも、後付けで作る
    const titleInner = document.querySelector('#titleScreen .titleInner');
    if (!titleInner) return;

    let btn = $('btnTitleLocalTest');
    if (btn) return;

    btn = document.createElement('button');
    btn.id = 'btnTitleLocalTest';
    btn.type = 'button';
    btn.className = 'titleNextBtn';
    btn.textContent = 'ローカル大会（テスト）';
    btn.style.marginTop = '10px';

    titleInner.appendChild(btn);
  }

  function bind(){
    if (bound) return;
    bound = true;

    ensureTitleLocalTestButton();

    // タイトルNEXT
    const btnNext = $('btnTitleNext');
    if (btnNext){
      // iOSで「一回目が効かない」対策：pointerdown と click 両方で呼ぶ
      btnNext.addEventListener('pointerdown', (e)=>{
        e.preventDefault();
        e.stopPropagation();
        showMain();
      }, { passive:false });

      btnNext.addEventListener('click', (e)=>{
        e.preventDefault();
        e.stopPropagation();
        showMain();
      }, { passive:false });
    }

    // タイトル：ローカル大会（テスト）
    const btnTest = $('btnTitleLocalTest');
    if (btnTest){
      btnTest.addEventListener('pointerdown', (e)=>{
        e.preventDefault();
        e.stopPropagation();
        startTournamentLocal();
      }, { passive:false });

      btnTest.addEventListener('click', (e)=>{
        e.preventDefault();
        e.stopPropagation();
        startTournamentLocal();
      }, { passive:false });
    }

    // 左メニュー：bbattle.png
    // ※他の左メニューは ui_main.js に任せる（ここでは触らない）
    const btnBattle = $('btnBattle');
    if (btnBattle){
      btnBattle.addEventListener('click', (e)=>{
        // ここだけ大会へ
        e.preventDefault();
        e.stopPropagation();

        // modalBack事故の保険
        killModalBack();

        startTournamentLocal();
      }, { passive:false });
    }

    // 公開（デバッグ用）
    App.showMain = showMain;
    App.startTournamentLocal = startTournamentLocal;
  }

  function init(){
    bind();

    // 初期：タイトルが見えている前提。メインは index 側で display:none のままでOK
    // ※ここで #app を強制的に隠さない（ui_main / CSSの整合性を壊すため）
    killModalBack();
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init, { once:true });
  }else{
    init();
  }
})();
