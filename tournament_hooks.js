'use strict';

/*
  MOB BR - tournament_hooks.js（FULL）
  役割：
  - tournament_flow の hooks 実装
  - 表示は ui_tournament に完全委譲
  - NEXT は runtime.next() に統一（B案）
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.tournament = window.MOBBR.tournament || {};

(function(){

  const UI = () => window.MOBBR?.ui?.tournament;
  const RT = () => window.MOBBR?.tournament?.runtime;

  /* =========================
     共通画像セット
  ========================= */
  function baseImages(){
    return {
      bg: 'neonmain.png',
      tent: 'tent.png',
      playerImage: 'P1.png'
    };
  }

  /* =========================
     NEXT共通
  ========================= */
  function next(){
    const rt = RT();
    if (rt) rt.next();
  }

  /* =========================
     Hooks 実体
  ========================= */
  function createHooks(){

    return {

      /* ===== 週開始バナー ===== */
      onWeekStartBanner({ tournamentType }){
        UI()?.open({
          ...baseImages(),
          title: '大会週',
          messageLines: [
            `${tournamentType} 大会週に突入！`
          ],
          nextLabel: '大会へ',
          onNext: next
        });
      },

      /* ===== エントリー確認 ===== */
      onEnterConfirm({ tournamentType }){
        UI()?.open({
          ...baseImages(),
          title: 'エントリー確認',
          messageLines: [
            `${tournamentType} 大会に出場しますか？`
          ],
          nextLabel: '出場する',
          onNext: () => RT()?.chooseEnter(true)
        });
      },

      /* ===== 入場トランジション ===== */
      onEnterTransition({ tournamentType, phase }){
        UI()?.open({
          ...baseImages(),
          title: phase.title,
          messageLines: [
            `${phase.title} 会場へ移動中…`
          ],
          nextLabel: '到着',
          onNext: next
        });
      },

      /* ===== 会場アナウンス ===== */
      onVenueAnnounce({ phase }){
        UI()?.open({
          ...baseImages(),
          title: phase.title,
          messageLines: [
            `${phase.title} 開幕！`,
            '健闘を祈る！'
          ],
          nextLabel: '試合開始',
          onNext: next
        });
      },

      /* ===== 試合開始 ===== */
      onMatchDayStart({ matchDay }){
        UI()?.open({
          ...baseImages(),
          title: '試合開始',
          messageLines: matchDay
            ? [`第 ${matchDay.index} 試合 / 全 ${matchDay.total} 試合`]
            : ['FINAL 開始'],
          nextLabel: '進行',
          onNext: next
        });
      },

      /* ===== 試合実行（仮実装） ===== */
      async onRunMatchDay(){
        // ※ここは後で battle / sim に差し替える
        return {
          resultsByLobbyKey: {},
          updatedOverall: null
        };
      },

      /* ===== 試合結果 ===== */
      onShowMatchDayResult({ matchDay }){
        UI()?.showMessage(
          '試合結果',
          matchDay
            ? [`第 ${matchDay.index} 試合 終了`]
            : ['FINAL 終了'],
          '総合順位へ'
        );
        UI()?.setNextHandler(next);
      },

      /* ===== 総合順位 ===== */
      onShowOverall({ progressText }){
        UI()?.showMessage(
          '総合順位',
          [
            '現在の順位を更新しました',
            progressText || ''
          ],
          '次へ'
        );
        UI()?.setNextHandler(next);
      },

      /* ===== フェーズ終了 ===== */
      onPhaseEndUI({ phase }){
        UI()?.open({
          ...baseImages(),
          title: phase.title,
          messageLines: [
            `${phase.title} 終了`
          ],
          nextLabel: '次へ',
          onNext: next
        });
      },

      /* ===== メインへ戻る ===== */
      onReturnToMain(){
        UI()?.open({
          ...baseImages(),
          title: '大会中断',
          messageLines: [
            '一度メイン画面に戻ります'
          ],
          nextLabel: '戻る',
          onNext: () => {
            UI()?.close();
          }
        });
      },

      /* ===== 大会終了 ===== */
      onTournamentEnd(){
        UI()?.open({
          ...baseImages(),
          title: '大会終了',
          messageLines: [
            '大会が終了しました',
            'お疲れさまでした！'
          ],
          nextLabel: '閉じる',
          onNext: () => {
            UI()?.close();
          }
        });
      }
    };
  }

  /* =========================
     export
  ========================= */
  window.MOBBR.tournament.createHooks = createHooks;

})();
