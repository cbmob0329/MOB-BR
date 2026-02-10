'use strict';

/*
  MOB BR - app.js v2（フル）
  目的：
  - タイトルNEXTの不安定（押してもメインへ行かないことがある）を確実に解消
  - タイトルに「ローカル大会（テスト）」ボタン（後で消す前提）
  - メイン左メニューの bbattle.png（#btnBattle）からも大会開始できるようにする
  - B案：tournament_runtime（window.MOBBR.tournament.runtime）経由で start/next を回す

  対応DOM（どちらのindexでも動くように安全側で実装）
  - タイトル：#titleScreen, #btnTitleNext, #btnTitleLocalTest
  - メイン：#app（あなたの本命index） or #mainScreen（簡易index）
  - 大会開始ボタン：#btnBattle（bbattle.png） / #btnGoTournament（簡易index）
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.app = window.MOBBR.app || {};

(function(){
  const App = window.MOBBR.app;

  const $ = (id) => document.getElementById(id);

  let bound = false;
  let transitioning = false;

  function getTitleRoot(){
    return $('titleScreen') || null;
  }

  function getMainRoot(){
    // 本命：#app（display:none で初期非表示）
    // 簡易：#mainScreen
    return $('app') || $('mainScreen') || null;
  }

  function isVisible(el){
    if (!el) return false;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
    return true;
  }

  function showEl(el){
    if (!el) return;
    // show/hide は「既存CSSの show クラス」もあるので両対応
    el.classList.add('show');
    el.classList.add('is-active');
    el.style.display = '';
    el.style.visibility = 'visible';
    el.style.pointerEvents = 'auto';
    el.setAttribute('aria-hidden', 'false');
  }

  function hideEl(el){
    if (!el) return;
    el.classList.remove('show');
    el.classList.remove('is-active');
    el.style.display = 'none';
    el.style.pointerEvents = 'none';
    el.setAttribute('aria-hidden', 'true');
  }

  function forceShowMain(){
    const title = getTitleRoot();
    const main = getMainRoot();

    if (!main){
      console.warn('[app] main root not found (#app or #mainScreen)');
      return;
    }

    // 連打・多重遷移防止
    if (transitioning) return;
    transitioning = true;

    try{
      // タイトルを確実に隠す
      if (title) hideEl(title);

      // メインを確実に出す
      showEl(main);

      // iOS/Safariで描画が追いつかず「表示されない」ことがあるので、
      // 2フレーム分押し出して強制再評価する
      requestAnimationFrame(()=>{
        try{
          // もしまだ見えてないなら display を明示
          if (!isVisible(main)) main.style.display = 'block';
          // 再度 class/aria も念のため
          main.classList.add('show');
          main.setAttribute('aria-hidden', 'false');
        }catch(e){}
        requestAnimationFrame(()=>{
          transitioning = false;
        });
      });
    }catch(e){
      transitioning = false;
    }
  }

  function forceShowTitle(){
    const title = getTitleRoot();
    const main = getMainRoot();
    if (main) hideEl(main);
    if (title) showEl(title);
  }

  // ===== Tournament（B案 runtime 経由）=====
  function startTournament(type){
    const rt = window.MOBBR?.tournament?.runtime;

    if (!rt || typeof rt.start !== 'function'){
      console.warn('[app] tournament runtime missing (window.MOBBR.tournament.runtime.start)');
      // フォールバック（旧式Flowが残ってる場合）
      const Flow = window.MOBBR?.sim?.tournamentFlow;
      if (Flow && typeof Flow.startLocalTournament === 'function' && String(type).toUpperCase() === 'LOCAL'){
        try{
          // 大会はオーバーレイなので、メインは隠してもOK（好みで）
          const main = getMainRoot();
          if (main) hideEl(main);
          Flow.startLocalTournament();
          return;
        }catch(e){
          console.error(e);
        }
      }
      alert('大会を開始できません（tournament_runtime.js の読み込み順を確認）');
      return;
    }

    try{
      // 大会オーバーレイを前面に出すので、メインは隠す（事故防止）
      const main = getMainRoot();
      if (main) hideEl(main);

      rt.start(String(type || 'LOCAL'));
    }catch(err){
      console.error(err);
      alert('大会開始エラー（console確認）');
    }
  }

  function bind(){
    if (bound) return;
    bound = true;

    // ===== タイトルNEXT =====
    const btnNext = $('btnTitleNext');
    if (btnNext){
      // クリック遅延や二重発火を避ける
      btnNext.addEventListener('click', (e)=>{
        e.preventDefault();
        e.stopPropagation();
        forceShowMain();
      }, { passive:false });
    }else{
      console.warn('[app] #btnTitleNext not found');
    }

    // ===== タイトル：ローカル大会（テスト） =====
    const btnLocalTest = $('btnTitleLocalTest');
    if (btnLocalTest){
      btnLocalTest.addEventListener('click', (e)=>{
        e.preventDefault();
        e.stopPropagation();
        // タイトルから直接大会開始（後で消すボタン）
        startTournament('LOCAL');
      }, { passive:false });
    }

    // ===== メイン左メニュー：bbattle.png（あなたの本命index）=====
    const btnBattle = $('btnBattle');
    if (btnBattle){
      btnBattle.addEventListener('click', (e)=>{
        e.preventDefault();
        e.stopPropagation();
        startTournament('LOCAL');
      }, { passive:false });
    }

    // ===== 簡易index用：#btnGoTournament =====
    const btnGoTournament = $('btnGoTournament');
    if (btnGoTournament){
      btnGoTournament.addEventListener('click', (e)=>{
        e.preventDefault();
        e.stopPropagation();
        startTournament('LOCAL');
      }, { passive:false });
    }

    // もし「メインへ戻す」導線を後で追加する時のために公開しておく
    App.showMain = forceShowMain;
    App.showTitle = forceShowTitle;
    App.startTournament = startTournament;
  }

  function init(){
    bind();

    // 初期表示の補正：
    // - 本命indexは #app が display:none で始まる
    // - 簡易indexは #titleScreen が is-active
    const title = getTitleRoot();
    const main = getMainRoot();

    // どちらも見えてる/どちらも見えてない、みたいな事故を補正
    if (title && main){
      const tVis = isVisible(title);
      const mVis = isVisible(main);

      // 両方見えてたらタイトル優先（誤操作防止）
      if (tVis && mVis){
        hideEl(main);
        showEl(title);
      }
      // 両方見えてないならタイトルを出す
      if (!tVis && !mVis){
        showEl(title);
      }
    }
  }

  // 起動
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init, { once:true });
  }else{
    init();
  }
})();
