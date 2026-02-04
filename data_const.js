/* state.js (FULL)
   MOB BR
   VERSION: v1

   役割:
   - 画面状態（Main / Story / Modal / WeekPopup など）を集中管理
   - UI層（ui.js）が参照できる「単一の状態」を持つ
   - game.js / sim系は State を通して状態を更新する（予定）

   重要:
   - v1では最小の枠だけ用意し、後続ファイルで拡張する
*/

(() => {
  'use strict';

  /* =========================
     画面種別
  ========================= */
  const SCREENS = Object.freeze({
    MAIN: 'main',
    STORY: 'story',     // map/ido/battle/winner等
    RESULT: 'result',
    TEAM: 'team',
    TOURNAMENT: 'tournament',
    SHOP: 'shop',
  });

  /* =========================
     初期状態
  ========================= */
  const initialState = () => ({
    // 時間
    year: 1989,
    month: 1,
    week: 1,

    // 企業/チーム
    companyName: '企業名',
    teamName: 'チーム名',
    companyRank: '--',

    // 大会
    nextTournament: '--',
    nextTournamentDate: '--',

    // 現在画面
    screen: SCREENS.MAIN,

    // ログ
    logs: [], // { t:number, text:string, muted?:boolean }

    // Overlay
    overlay: {
      isOpen: false,
      weekPopup: {
        open: false,
        title: '',
        text: '',
      },
      modal: {
        open: false,
        title: '',
        body: '',
        footer: '',
      },
      nameSetup: {
        open: false,
      },
      story: {
        open: false,
        sceneKey: 'map', // map/ido/battle/winner...
      }
    },

    // 選択（修行など）
    selection: {
      trainingId: null,
    },

    // 試合/大会の進行（後で拡張）
    match: {
      inProgress: false,
      storySeq: ['map','ido','battle','winner'],
      storyIndex: 0,
    },
  });

  /* =========================
     ストア
  ========================= */
  let _state = initialState();
  const _listeners = new Set();

  function getState(){
    return _state;
  }

  // shallow merge で更新（必要なら後でdeepに拡張）
  function setState(patch){
    _state = Object.assign({}, _state, patch);
    emit();
  }

  function update(mutator){
    // 破壊的に編集できるように、cloneしたものを渡す
    const s = structuredCloneSafe(_state);
    mutator(s);
    _state = s;
    emit();
  }

  function reset(){
    _state = initialState();
    emit();
  }

  function onChange(fn){
    _listeners.add(fn);
    return () => _listeners.delete(fn);
  }

  function emit(){
    _listeners.forEach(fn => {
      try { fn(_state); } catch(e){ /* 監視者の例外で止めない */ }
    });
  }

  /* =========================
     ユーティリティ
  ========================= */
  function structuredCloneSafe(obj){
    // structuredClone がある環境（現代ブラウザ）優先
    if (typeof structuredClone === 'function'){
      try { return structuredClone(obj); } catch(e){}
    }
    // フォールバック（関数/Map/Setは想定しない）
    return JSON.parse(JSON.stringify(obj));
  }

  /* =========================
     ログ追加
  ========================= */
  function pushLog(text, muted=false){
    update(s => {
      s.logs.push({ t: Date.now(), text, muted: !!muted });
      // ログが増えすぎたら古いのを落とす（UI負荷対策）
      if (s.logs.length > 200) s.logs.splice(0, s.logs.length - 200);
    });
  }

  /* =========================
     週進行（最小）
  ========================= */
  function advanceWeek(){
    update(s => {
      s.week += 1;
      if (s.week > 4){
        s.week = 1;
        s.month += 1;
      }
      s.overlay.isOpen = true;
      s.overlay.weekPopup.open = true;
      s.overlay.weekPopup.title = `${s.year}年${s.month}月 第${s.week}週`;
      s.overlay.weekPopup.text = `企業ランクにより 0G 獲得！（仮）`;
    });
  }

  function closeWeekPopup(){
    update(s => {
      s.overlay.weekPopup.open = false;
      // 他のオーバーレイが開いていなければ閉じる
      s.overlay.isOpen = !!(s.overlay.modal.open || s.overlay.nameSetup.open || s.overlay.story.open);
    });
  }

  /* =========================
     公開
  ========================= */
  window.State = {
    SCREENS,
    getState,
    setState,
    update,
    reset,
    onChange,
    pushLog,

    // actions
    advanceWeek,
    closeWeekPopup,
  };

})();
