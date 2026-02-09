/* =========================================================
   MOB BR - sim_tournament_flow.js (FULL)
   ---------------------------------------------------------
   役割：
   ・大会中の「NEXT進行」を一元管理する
   ・各大会フェーズ（local / national / world / final）を切り替える
   ・UI → sim_tournament_xxx を“順番通り”に呼ぶだけの司令塔
   ---------------------------------------------------------
   このファイルは「薄く保つ」前提：
   ・戦闘ロジックなし
   ・結果計算なし
   ・UI詳細制御なし
   ---------------------------------------------------------
   依存：
   ・sim_tournament_local.js
   ・（将来）sim_tournament_national.js
   ・（将来）sim_tournament_world.js
   ・（将来）sim_tournament_final.js
========================================================= */

window.MOBBR = window.MOBBR || {};
window.MOBBR.sim = window.MOBBR.sim || {};

(function(){
  'use strict';

  const Flow = {};
  window.MOBBR.sim.tournamentFlow = Flow;

  /* =========================
     INTERNAL STATE
  ========================== */
  let current = {
    phase: null,        // 'local' | 'national' | 'world' | 'final'
    state: null         // 各 sim_tournament_xxx の state
  };

  /* =========================
     PUBLIC API
  ========================== */

  /**
   * 大会開始（ローカルから）
   */
  Flow.startLocalTournament = function(){
    const Local = window.MOBBR?.sim?.tournamentLocal;
    if (!Local){
      console.error('[Flow] sim_tournament_local.js not found');
      return;
    }

    current.phase = 'local';
    current.state = Local.create({ keepStorage: true });

    announce('ローカル大会 開始！');
  };

  /**
   * NEXT ボタン押下時の共通入口
   * UI側は必ずこれだけ呼ぶ
   */
  Flow.next = function(){
    if (!current.phase){
      console.warn('[Flow] phase not set');
      return;
    }

    switch(current.phase){
      case 'local':
        nextLocal();
        break;

      case 'national':
        console.warn('[Flow] national not implemented yet');
        break;

      case 'world':
        console.warn('[Flow] world not implemented yet');
        break;

      case 'final':
        console.warn('[Flow] final not implemented yet');
        break;

      default:
        console.warn('[Flow] unknown phase', current.phase);
    }
  };

  /**
   * 現在のフェーズ取得（UI確認用）
   */
  Flow.getPhase = function(){
    return current.phase;
  };

  /**
   * 強制リセット（デバッグ用）
   */
  Flow.resetAll = function(){
    current.phase = null;
    current.state = null;

    const Local = window.MOBBR?.sim?.tournamentLocal;
    if (Local && Local.reset) Local.reset();
  };

  /* =========================
     LOCAL FLOW
  ========================== */
  function nextLocal(){
    const Local = window.MOBBR.sim.tournamentLocal;
    const st = current.state;

    if (!st){
      console.error('[Flow] local state missing');
      return;
    }

    // まだ試合が残っている
    if (!Local.isFinished(st)){
      current.state = Local.playNextMatch(st, {
        title: 'RESULT',
        subtitle: `ローカル大会 第${st.matchIndex + 1}試合`
      });

      // 試合後に「現在の総合順位」を出したい場合はここ
      Local.openOverallUI(current.state, {
        title: 'OVERALL',
        subtitle: `ローカル大会 現在順位（${current.state.matchIndex}/5）`
      });

      return;
    }

    // 5試合すべて終了
    const finalOverall = Local.getFinalOverall(st);

    announce('ローカル大会 終了！');

    // ここで「上位10通過／敗退」を判定する
    // ※実処理は次フェーズでやる
    console.log('[Flow] Local Final Overall', finalOverall);

    // 次フェーズ（未実装）
    announce('次はナショナル大会！（※未実装）');
    current.phase = 'national';
  }

  /* =========================
     UTIL
  ========================== */

  function announce(text){
    // 今は console だけ
    // 後で「テント＋中央ログ」に差し替える
    console.log('[ANNOUNCE]', text);

    const ui = window.MOBBR?.ui;
    if (ui && typeof ui.showMessage === 'function'){
      ui.showMessage(text);
    }
  }

})();
