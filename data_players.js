/* data_players.js (FULL)
   MOB BR
   VERSION: v1

   役割:
   - プレイヤー側の固定データ（P1 / P2 / P3 など）を保持
   - 画像名や初期パラメータ、表示名をここにまとめる

   注意:
   - v1では最小。ステータス/育成仕様と接続して拡張する。
*/

(() => {
  'use strict';

  const PLAYERS = Object.freeze({
    P1: {
      id: 'P1',
      displayName: 'P1',
      teamImageKey: 'P1', // Assets.IMAGES のキー（assets.js）
      // v1は仮。後で「ステータスと育成機能」仕様に合わせて増やす
      stats: {
        power: 50,
        speed: 50,
        aim: 50,
        brain: 50,
        luck: 50,
      }
    },

    // 仕様でP2/P3が必要になったらここに追加
    // P2: {...}
    // P3: {...}
  });

  window.DataPlayers = PLAYERS;
})();
