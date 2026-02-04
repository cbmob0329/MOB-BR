/* data_const.js (FULL)
   MOB BR
   VERSION: v1

   役割:
   - ゲーム内で共有する定数/初期値/表示用文言の土台
   - 仕様が固まったらここに集約して管理しやすくする

   注意:
   - v1では「動くための最小」。後続ファイルで必ず拡張する。
*/

(() => {
  'use strict';

  const CONST = Object.freeze({
    GAME_TITLE: 'MOB BR',
    START_YEAR: 1989,
    START_MONTH: 1,
    START_WEEK: 1,

    WEEKS_PER_MONTH: 4,

    // 企業ランク（暫定表示。ランク別Gは大会/育成仕様で後から確定）
    COMPANY_RANKS: ['S','A','B','C','D','E','F','--'],

    // 画面表示用
    UI: {
      LOG_MAX: 200,
      AUTO_MS_DEFAULT: 3000,
      STORY_AUTO_MS: 1200, // v1の紙芝居オート
    },

    // v1 暫定：大会ラベル
    TOURNAMENT: {
      LOCAL: 'ローカル大会',
      NATIONAL: 'ナショナル大会',
      WORLD: 'ワールドファイナル',
      CHAMP: 'チャンピオンシップ',
    },

    // 紙芝居シーンキー
    STORY_SCENES: ['map','ido','battle','winner'],
  });

  window.Const = CONST;
})();
