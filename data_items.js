/* =========================================================
   data_items.js (FULL)
   - アイテム定義（ショップ/ガチャ用）
   - 依存：data_const.js（DATA_CONST）
   ========================================================= */

(() => {
  'use strict';

  const CONST = window.DATA_CONST;
  if (!CONST) throw new Error('DATA_CONST not found. Load data_const.js before data_items.js');

  // ---------------------------------------------------------
  // 方針（ユーザー指定）
  // - 育成アイテム以外：戦闘中も使用可能
  // - アイテムはショップ or ガチャで入手
  // - 価格/効果は提示通り
  // ---------------------------------------------------------

  // カテゴリ定義（UI表示用）
  const CATEGORIES = {
    HEAL_HP: '回復（HP）',
    HEAL_ARMOR: '回復（Armor）',
    OFFENSE: '攻撃・妨害',
    CHARGE: 'チャージ',
    SPECIAL: '特殊',
    TRAINING: '育成',
  };

  // 使用タイミング定義（sim側/表示用のタグ）
  const USE_TIMING = {
    BATTLE_AUTO: 'BATTLE_AUTO',        // 戦闘中：自動使用（行動開始時に判定）
    BATTLE_MANUAL: 'BATTLE_MANUAL',    // 戦闘中：手動（将来拡張）
    OUTSIDE_ONLY: 'OUTSIDE_ONLY',      // 育成/拠点のみ
  };

  // 効果kind（sim側で解釈）
  const EFFECT_KIND = {
    HP_HEAL_FLAT: 'HP_HEAL_FLAT',
    ARMOR_HEAL_FLAT: 'ARMOR_HEAL_FLAT',
    DAMAGE_AOE_FLAT: 'DAMAGE_AOE_FLAT',
    DEBUFF_SPEED_DOWN_ONE: 'DEBUFF_SPEED_DOWN_ONE',
    DEBUFF_AIM_DOWN_AOE: 'DEBUFF_AIM_DOWN_AOE',
    ABILITY_CHARGE_ADD: 'ABILITY_CHARGE_ADD',
    RESPAWN_FROM_DEATHBOX: 'RESPAWN_FROM_DEATHBOX',
    TRAINING_XP_ADD: 'TRAINING_XP_ADD',
  };

  // ---------------------------------------------------------
  // アイテム定義
  // ---------------------------------------------------------
  const items = [
    // 1. 回復（HP）
    {
      id: 'ITEM_HP_GUMMY',
      name: 'エナジーグミ',
      category: CATEGORIES.HEAL_HP,
      priceG: 50,
      obtain: { shop: true, gacha: true },
      useTiming: USE_TIMING.BATTLE_AUTO,
      effect: { kind: EFFECT_KIND.HP_HEAL_FLAT, value: 30, capToMaxHP: true },
      note: 'HP小回復',
    },
    {
      id: 'ITEM_HP_CHOCOLATE',
      name: 'エナジーチョコ',
      category: CATEGORIES.HEAL_HP,
      priceG: 100,
      obtain: { shop: true, gacha: true },
      useTiming: USE_TIMING.BATTLE_AUTO,
      effect: { kind: EFFECT_KIND.HP_HEAL_FLAT, value: 60, capToMaxHP: true },
      note: 'HP中回復',
    },
    {
      id: 'ITEM_HP_COTTONCANDY',
      name: 'エナジーわたあめ',
      category: CATEGORIES.HEAL_HP,
      priceG: 300,
      obtain: { shop: true, gacha: true },
      useTiming: USE_TIMING.BATTLE_AUTO,
      effect: { kind: EFFECT_KIND.HP_HEAL_FLAT, value: 9999, capToMaxHP: true },
      note: 'HP全回復',
    },

    // 2. 回復（Armor）
    {
      id: 'ITEM_AR_VANILLA',
      name: 'バニラアイス',
      category: CATEGORIES.HEAL_ARMOR,
      priceG: 50,
      obtain: { shop: true, gacha: true },
      useTiming: USE_TIMING.BATTLE_AUTO,
      effect: { kind: EFFECT_KIND.ARMOR_HEAL_FLAT, value: 30, capToMaxArmor: true },
      note: 'Armor小回復',
    },
    {
      id: 'ITEM_AR_2SCOOP',
      name: '2段アイス',
      category: CATEGORIES.HEAL_ARMOR,
      priceG: 100,
      obtain: { shop: true, gacha: true },
      useTiming: USE_TIMING.BATTLE_AUTO,
      effect: { kind: EFFECT_KIND.ARMOR_HEAL_FLAT, value: 60, capToMaxArmor: true },
      note: 'Armor中回復',
    },
    {
      id: 'ITEM_AR_3SCOOP',
      name: '3段アイス',
      category: CATEGORIES.HEAL_ARMOR,
      priceG: 300,
      obtain: { shop: true, gacha: true },
      useTiming: USE_TIMING.BATTLE_AUTO,
      effect: { kind: EFFECT_KIND.ARMOR_HEAL_FLAT, value: 9999, capToMaxArmor: true },
      note: 'Armor全回復',
    },

    // 3. 攻撃・妨害
    {
      id: 'ITEM_OFF_TAIYAKI_GRENADE',
      name: 'たい焼きグレネード',
      category: CATEGORIES.OFFENSE,
      priceG: 1000,
      obtain: { shop: true, gacha: true },
      useTiming: USE_TIMING.BATTLE_AUTO,
      effect: {
        kind: EFFECT_KIND.DAMAGE_AOE_FLAT,
        value: 20, // NOTE: battleルールの1発最大45キャップを邪魔しない範囲。sim側でもcapされる前提。
        target: 'ENEMY_TEAM_ALL',
      },
      note: '全体攻撃',
    },
    {
      id: 'ITEM_OFF_ARC_RAMUNE',
      name: 'アークラムネ',
      category: CATEGORIES.OFFENSE,
      priceG: 1000,
      obtain: { shop: true, gacha: true },
      useTiming: USE_TIMING.BATTLE_AUTO,
      effect: {
        kind: EFFECT_KIND.DEBUFF_SPEED_DOWN_ONE,
        value: 2,              // speedDown量（Move/Agility側で解釈する余地）
        duration: 'NEXT_ATTACK', // 次の行動1回分想定
        target: 'ENEMY_ONE',
      },
      note: '1人スピードダウン',
    },
    {
      id: 'ITEM_OFF_PUKUPUKU_LAUNCHER',
      name: 'ぷくぷくランチャー',
      category: CATEGORIES.OFFENSE,
      priceG: 1000,
      obtain: { shop: true, gacha: true },
      useTiming: USE_TIMING.BATTLE_AUTO,
      effect: {
        kind: EFFECT_KIND.DEBUFF_AIM_DOWN_AOE,
        value: 4,                // 敵Aimダウン（キャップ：最大-12はsim側で適用）
        duration: 'NEXT_ATTACK',  // 次の攻撃1回分
        target: 'ENEMY_TEAM_ALL',
      },
      note: '全体エイムダウン',
    },

    // 4. チャージ
    {
      id: 'ITEM_CHG_CHUPPA',
      name: 'チュッパチャージ',
      category: CATEGORIES.CHARGE,
      priceG: 5000,
      obtain: { shop: true, gacha: true },
      useTiming: USE_TIMING.BATTLE_AUTO,
      effect: { kind: EFFECT_KIND.ABILITY_CHARGE_ADD, value: 1 },
      note: 'アビリティチャージ（使用回数を回復/追加）',
    },

    // 5. 特殊
    {
      id: 'ITEM_SP_OCARINA',
      name: 'リスポーンオカリナ',
      category: CATEGORIES.SPECIAL,
      priceG: 500,
      obtain: { shop: true, gacha: true },
      useTiming: USE_TIMING.BATTLE_AUTO,
      effect: { kind: EFFECT_KIND.RESPAWN_FROM_DEATHBOX, value: 1, hpPercent: 0.35, armor: 0 },
      note: 'デスボックスから復活（HPは一部で復帰）',
    },

    // 6. 育成（能力経験値+5）
    // NOTE: 「能力経験値→能力+」は state側の育成処理に委譲（ここはアイテムの定義だけ）
    {
      id: 'ITEM_TR_HP_SCROLL',
      name: 'タフネス極意の巻物',
      category: CATEGORIES.TRAINING,
      priceG: 20000,
      obtain: { shop: true, gacha: true },
      useTiming: USE_TIMING.OUTSIDE_ONLY,
      effect: { kind: EFFECT_KIND.TRAINING_XP_ADD, stat: 'HP', value: 5 },
      note: '育成：HP経験値+5',
    },
    {
      id: 'ITEM_TR_MENTAL_BOOK',
      name: '感動的な絵本',
      category: CATEGORIES.TRAINING,
      priceG: 10000,
      obtain: { shop: true, gacha: true },
      useTiming: USE_TIMING.OUTSIDE_ONLY,
      effect: { kind: EFFECT_KIND.TRAINING_XP_ADD, stat: 'Mental', value: 5 },
      note: '育成：Mental経験値+5',
    },
    {
      id: 'ITEM_TR_AIM_EYEDROP',
      name: '秘伝の目薬',
      category: CATEGORIES.TRAINING,
      priceG: 20000,
      obtain: { shop: true, gacha: true },
      useTiming: USE_TIMING.OUTSIDE_ONLY,
      effect: { kind: EFFECT_KIND.TRAINING_XP_ADD, stat: 'Aim', value: 5 },
      note: '育成：Aim経験値+5',
    },
    {
      id: 'ITEM_TR_AGI_STEAK',
      name: 'カモシカのステーキ',
      category: CATEGORIES.TRAINING,
      priceG: 10000,
      obtain: { shop: true, gacha: true },
      useTiming: USE_TIMING.OUTSIDE_ONLY,
      effect: { kind: EFFECT_KIND.TRAINING_XP_ADD, stat: 'Agility', value: 5 },
      note: '育成：Agility経験値+5',
    },
    {
      id: 'ITEM_TR_TECH_ABACUS',
      name: '高級なそろばん',
      category: CATEGORIES.TRAINING,
      priceG: 10000,
      obtain: { shop: true, gacha: true },
      useTiming: USE_TIMING.OUTSIDE_ONLY,
      effect: { kind: EFFECT_KIND.TRAINING_XP_ADD, stat: 'Technique', value: 5 },
      note: '育成：Technique経験値+5',
    },
    {
      id: 'ITEM_TR_SUP_DISK',
      name: 'サポートディスク',
      category: CATEGORIES.TRAINING,
      priceG: 10000,
      obtain: { shop: true, gacha: true },
      useTiming: USE_TIMING.OUTSIDE_ONLY,
      effect: { kind: EFFECT_KIND.TRAINING_XP_ADD, stat: 'Support', value: 5 },
      note: '育成：Support経験値+5',
    },
    {
      id: 'ITEM_TR_HUNT_BEAR',
      name: '熊の置物',
      category: CATEGORIES.TRAINING,
      priceG: 10000,
      obtain: { shop: true, gacha: true },
      useTiming: USE_TIMING.OUTSIDE_ONLY,
      effect: { kind: EFFECT_KIND.TRAINING_XP_ADD, stat: 'Hunt', value: 5 },
      note: '育成：Hunt経験値+5',
    },
  ];

  // ---------------------------------------------------------
  // 参照補助
  // ---------------------------------------------------------
  const byId = Object.create(null);
  for (const it of items) byId[it.id] = it;

  const exportObj = {
    CATEGORIES,
    USE_TIMING,
    EFFECT_KIND,
    items,

    getById(id) {
      const key = String(id);
      return byId[key] || null;
    },

    listByCategory(cat) {
      const c = String(cat);
      return items.filter(x => x.category === c);
    },

    listShopItems() {
      return items.filter(x => x.obtain && x.obtain.shop);
    },

    listGachaItems() {
      return items.filter(x => x.obtain && x.obtain.gacha);
    },

    isBattleUsable(itemId) {
      const it = byId[String(itemId)];
      if (!it) return false;
      return it.useTiming === USE_TIMING.BATTLE_AUTO || it.useTiming === USE_TIMING.BATTLE_MANUAL;
    },

    isTrainingItem(itemId) {
      const it = byId[String(itemId)];
      if (!it) return false;
      return it.category === CATEGORIES.TRAINING;
    },
  };

  // Freeze（データ保護）
  (function deepFreeze(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    Object.freeze(obj);
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (v && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v);
    }
    return obj;
  })(exportObj);

  window.DATA_ITEMS = exportObj;
})();
