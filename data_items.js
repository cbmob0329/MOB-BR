/* =====================================================
   data_items.js
   - アイテム定義（ショップ/入手/試合内効果/育成などの“器”）
   - 重要：現時点で確定仕様が未提示のため、内容は創作しない
   - ただし、ゲーム全体が破綻しないよう「参照スキーマ」は確定しておく
   ===================================================== */

(() => {

  /* -------------------------------------
     Item カテゴリ（将来拡張用）
     ------------------------------------- */
  const ITEM_CATEGORY = {
    SHOP: 'shop',           // ショップで購入
    DROP: 'drop',           // 試合で入手（お宝/フラッグとは別概念）
    TRAINING: 'training',   // 育成（修行補助など）
    COLLECTION: 'collection', // コレクション（所持効果）
    OTHER: 'other',
  };

  /* -------------------------------------
     Item 効果タイプ（将来拡張用）
     ------------------------------------- */
  const ITEM_EFFECT_TYPE = {
    // 恒久強化（例：基礎ステ+、総合力+ など）
    PERMANENT: 'permanent',
    // 試合内のみ（例：イベントbuffのように試合中だけ）
    MATCH_ONLY: 'match_only',
    // 大会単位（例：大会中だけ続く）
    TOURNAMENT_ONLY: 'tournament_only',
    // 通貨/資源（G増加など）
    CURRENCY: 'currency',
    // 特殊（未分類）
    SPECIAL: 'special',
  };

  /* -------------------------------------
     Item スキーマ（設計固定）
     -------------------------------------
     id: string（ユニーク）
     name: string（表示名）
     category: ITEM_CATEGORY
     rarity: 'R'|'SR'|'SSR'|'UR'|'LR' 等（必要なら）
     priceG: number|null（ショップ価格）
     stackMax: number|null（所持上限。null=無制限）
     icon: string|null（アイコン画像ファイル名。未画像は assets.js がプレースホルダ表示）
     description: string（説明文）
     effects: [
       {
         type: ITEM_EFFECT_TYPE,
         // effectKey / params は sim / state 側で解釈
         effectKey: string,
         params: object
       }
     ]
  ------------------------------------- */

  const LIST = [
    // 現時点では「確定したアイテム定義」が未提示のため空。
    // ここに今後、仕様確定テキストに沿って“そのまま”追加していく。
  ];

  const byId = {};
  for (const it of LIST) byId[it.id] = it;

  const DATA_ITEMS = {
    ITEM_CATEGORY,
    ITEM_EFFECT_TYPE,
    LIST,
    byId,

    // 参照用ヘルパ（UI/ショップ/シムで使える）
    get(id) {
      const k = String(id || '');
      return byId[k] || null;
    },

    listByCategory(cat) {
      const c = String(cat || '');
      return LIST.filter(it => it.category === c);
    },
  };

  window.DATA_ITEMS = DATA_ITEMS;

})();
