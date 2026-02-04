/* data_items.js (FULL)
   MOB BR
   VERSION: v1

   役割:
   - アイテム定義（修行補助・試合補助・大会補助など）
   - 効果の“型”だけを持ち、実処理は sim / ui 側で行う

   方針:
   - v1は「形だけ」。削除せず、後続で中身を埋める
*/

(() => {
  'use strict';

  const ITEMS = Object.freeze({
    // 修行系（例）
    TRAINING_SHOES: {
      id: 'TRAINING_SHOES',
      name: 'トレーニングシューズ',
      type: 'training',
      rarity: 'R',
      desc: '走力系修行の効果が少し上がる（仮）',
      effect: { speed: +5 },
    },

    AIM_SCOPE: {
      id: 'AIM_SCOPE',
      name: 'エイムスコープ',
      type: 'training',
      rarity: 'SR',
      desc: '索敵・命中系に影響（仮）',
      effect: { aim: +5 },
    },

    // 試合系（例）
    LUCK_CHARM: {
      id: 'LUCK_CHARM',
      name: 'ラッキーチャーム',
      type: 'match',
      rarity: 'R',
      desc: '試合中の運が少し上がる（仮）',
      effect: { luck: +3 },
    },

    // 大会系（例）
    SPONSOR_CONTRACT: {
      id: 'SPONSOR_CONTRACT',
      name: 'スポンサー契約書',
      type: 'tournament',
      rarity: 'SSR',
      desc: '大会終了時の獲得Gが増える（仮）',
      effect: { bonusG: 10 },
    },
  });

  window.DataItems = ITEMS;
})();
