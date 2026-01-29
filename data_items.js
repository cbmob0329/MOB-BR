// data_items.js
// Items + Coach Skills (Gacha / Equip)
// ES Modules

// Source: アイテム案（最新版） [oai_citation:0‡アイテム.txt](sediment://file_00000000d85c7208accd68f824e681e3)
// NOTE:
// - 育成アイテム以外は「戦闘中も使用可能」 [oai_citation:1‡アイテム.txt](sediment://file_00000000d85c7208accd68f824e681e3)
// - コーチスキルは「最大5つまで装備可能」 [oai_citation:2‡アイテム.txt](sediment://file_00000000d85c7208accd68f824e681e3)
// - コーチスキルは全55種（SSR5 / SR15 / R35） [oai_citation:3‡アイテム.txt](sediment://file_00000000d85c7208accd68f824e681e3)
// - 「Move補正のコーチスキルは禁止」(固定ルール) → このリストにMove補正は含めない設計

export const ITEM_CATEGORY = Object.freeze({
  HEAL_HP: 'heal_hp',
  HEAL_ARMOR: 'heal_armor',
  ATTACK_JAM: 'attack_jam',
  CHARGE: 'charge',
  SPECIAL: 'special',
  TRAINING: 'training',
  COACH_SKILL: 'coach_skill',
});

export const ITEM_USE_PHASE = Object.freeze({
  ANYTIME: 'anytime', // 戦闘中もOK
  OUT_OF_BATTLE: 'out_of_battle', // 育成など（戦闘中NG）
  BATTLE_ONLY: 'battle_only',
});

export const COACH_RARITY = Object.freeze({
  R: 'R',
  SR: 'SR',
  SSR: 'SSR',
});

// -------------------------------------
// Item definitions
// -------------------------------------
function makeItemId(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^\wぁ-んァ-ン一-龠ー]/g, '');
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

/**
 * effect schema (game側で解釈):
 * - type:
 *   - 'heal_hp' / 'heal_armor' : amount / mode('flat'|'full')
 *   - 'damage_all'             : amount
 *   - 'debuff_one'             : stat + amount + duration
 *   - 'debuff_all'             : stat + amount + duration
 *   - 'charge_ability'         : amount(=charges)
 *   - 'respawn_from_deathbox'  : true
 *   - 'training_exp'           : stat + exp
 */
export const ITEMS = Object.freeze([
  // 1. 回復（HP） [oai_citation:4‡アイテム.txt](sediment://file_00000000d85c7208accd68f824e681e3)
  {
    id: makeItemId('エナジーグミ'),
    name: 'エナジーグミ',
    category: ITEM_CATEGORY.HEAL_HP,
    priceG: 50,
    usePhase: ITEM_USE_PHASE.ANYTIME,
    desc: 'HP小回復',
    effects: [{ type: 'heal_hp', mode: 'flat', amount: 25 }],
    tags: ['heal', 'hp'],
  },
  {
    id: makeItemId('エナジーチョコ'),
    name: 'エナジーチョコ',
    category: ITEM_CATEGORY.HEAL_HP,
    priceG: 100,
    usePhase: ITEM_USE_PHASE.ANYTIME,
    desc: 'HP中回復',
    effects: [{ type: 'heal_hp', mode: 'flat', amount: 50 }],
    tags: ['heal', 'hp'],
  },
  {
    id: makeItemId('エナジーわたあめ'),
    name: 'エナジーわたあめ',
    category: ITEM_CATEGORY.HEAL_HP,
    priceG: 300,
    usePhase: ITEM_USE_PHASE.ANYTIME,
    desc: 'HP全回復',
    effects: [{ type: 'heal_hp', mode: 'full' }],
    tags: ['heal', 'hp'],
  },

  // 2. 回復（Armor） [oai_citation:5‡アイテム.txt](sediment://file_00000000d85c7208accd68f824e681e3)
  {
    id: makeItemId('バニラアイス'),
    name: 'バニラアイス',
    category: ITEM_CATEGORY.HEAL_ARMOR,
    priceG: 50,
    usePhase: ITEM_USE_PHASE.ANYTIME,
    desc: 'Armor小回復',
    effects: [{ type: 'heal_armor', mode: 'flat', amount: 25 }],
    tags: ['heal', 'armor'],
  },
  {
    id: makeItemId('2段アイス'),
    name: '2段アイス',
    category: ITEM_CATEGORY.HEAL_ARMOR,
    priceG: 100,
    usePhase: ITEM_USE_PHASE.ANYTIME,
    desc: 'Armor中回復',
    effects: [{ type: 'heal_armor', mode: 'flat', amount: 50 }],
    tags: ['heal', 'armor'],
  },
  {
    id: makeItemId('3段アイス'),
    name: '3段アイス',
    category: ITEM_CATEGORY.HEAL_ARMOR,
    priceG: 300,
    usePhase: ITEM_USE_PHASE.ANYTIME,
    desc: 'Armor全回復',
    effects: [{ type: 'heal_armor', mode: 'full' }],
    tags: ['heal', 'armor'],
  },

  // 3. 攻撃・妨害 [oai_citation:6‡アイテム.txt](sediment://file_00000000d85c7208accd68f824e681e3)
  {
    id: makeItemId('たい焼きグレネード'),
    name: 'たい焼きグレネード',
    category: ITEM_CATEGORY.ATTACK_JAM,
    priceG: 1000,
    usePhase: ITEM_USE_PHASE.ANYTIME,
    desc: '全体攻撃',
    effects: [{ type: 'damage_all', amount: 20 }],
    tags: ['attack', 'aoe'],
  },
  {
    id: makeItemId('アークラムネ'),
    name: 'アークラムネ',
    category: ITEM_CATEGORY.ATTACK_JAM,
    priceG: 1000,
    usePhase: ITEM_USE_PHASE.ANYTIME,
    desc: '1人スピードダウン',
    effects: [{ type: 'debuff_one', stat: 'agility', amount: -6, duration: 'next_attack_once' }],
    tags: ['debuff', 'single'],
  },
  {
    id: makeItemId('ぷくぷくランチャー'),
    name: 'ぷくぷくランチャー',
    category: ITEM_CATEGORY.ATTACK_JAM,
    priceG: 1000,
    usePhase: ITEM_USE_PHASE.ANYTIME,
    desc: '全体エイムダウン',
    effects: [{ type: 'debuff_all', stat: 'aim', amount: -4, duration: 'next_attack_once' }],
    tags: ['debuff', 'aoe'],
  },

  // 4. チャージ [oai_citation:7‡アイテム.txt](sediment://file_00000000d85c7208accd68f824e681e3)
  {
    id: makeItemId('チュッパチャージ'),
    name: 'チュッパチャージ',
    category: ITEM_CATEGORY.CHARGE,
    priceG: 5000,
    usePhase: ITEM_USE_PHASE.ANYTIME,
    desc: 'アビリティチャージ',
    effects: [{ type: 'charge_ability', amount: 1 }],
    tags: ['charge', 'ability'],
  },

  // 5. 特殊 [oai_citation:8‡アイテム.txt](sediment://file_00000000d85c7208accd68f824e681e3)
  {
    id: makeItemId('リスポーンオカリナ'),
    name: 'リスポーンオカリナ',
    category: ITEM_CATEGORY.SPECIAL,
    priceG: 500,
    usePhase: ITEM_USE_PHASE.ANYTIME,
    desc: 'デスボックスから復活',
    effects: [{ type: 'respawn_from_deathbox', value: true }],
    tags: ['special', 'respawn'],
  },

  // 6. 育成（戦闘中NG） [oai_citation:9‡アイテム.txt](sediment://file_00000000d85c7208accd68f824e681e3)
  {
    id: makeItemId('タフネス極意の巻物'),
    name: 'タフネス極意の巻物',
    category: ITEM_CATEGORY.TRAINING,
    priceG: 20000,
    usePhase: ITEM_USE_PHASE.OUT_OF_BATTLE,
    desc: 'HP経験値+5',
    effects: [{ type: 'training_exp', stat: 'hp', exp: 5 }],
    tags: ['training'],
  },
  {
    id: makeItemId('感動的な絵本'),
    name: '感動的な絵本',
    category: ITEM_CATEGORY.TRAINING,
    priceG: 10000,
    usePhase: ITEM_USE_PHASE.OUT_OF_BATTLE,
    desc: 'Mental経験値+5',
    effects: [{ type: 'training_exp', stat: 'mental', exp: 5 }],
    tags: ['training'],
  },
  {
    id: makeItemId('秘伝の目薬'),
    name: '秘伝の目薬',
    category: ITEM_CATEGORY.TRAINING,
    priceG: 20000,
    usePhase: ITEM_USE_PHASE.OUT_OF_BATTLE,
    desc: 'Aim経験値+5',
    effects: [{ type: 'training_exp', stat: 'aim', exp: 5 }],
    tags: ['training'],
  },
  {
    id: makeItemId('カモシカのステーキ'),
    name: 'カモシカのステーキ',
    category: ITEM_CATEGORY.TRAINING,
    priceG: 10000,
    usePhase: ITEM_USE_PHASE.OUT_OF_BATTLE,
    desc: 'Agility経験値+5',
    effects: [{ type: 'training_exp', stat: 'agility', exp: 5 }],
    tags: ['training'],
  },
  {
    id: makeItemId('高級なそろばん'),
    name: '高級なそろばん',
    category: ITEM_CATEGORY.TRAINING,
    priceG: 10000,
    usePhase: ITEM_USE_PHASE.OUT_OF_BATTLE,
    desc: 'Technique経験値+5',
    effects: [{ type: 'training_exp', stat: 'technique', exp: 5 }],
    tags: ['training'],
  },
  {
    id: makeItemId('サポートディスク'),
    name: 'サポートディスク',
    category: ITEM_CATEGORY.TRAINING,
    priceG: 10000,
    usePhase: ITEM_USE_PHASE.OUT_OF_BATTLE,
    desc: 'Support経験値+5',
    effects: [{ type: 'training_exp', stat: 'support', exp: 5 }],
    tags: ['training'],
  },
  {
    id: makeItemId('熊の置物'),
    name: '熊の置物',
    category: ITEM_CATEGORY.TRAINING,
    priceG: 10000,
    usePhase: ITEM_USE_PHASE.OUT_OF_BATTLE,
    desc: 'Hunt経験値+5',
    effects: [{ type: 'training_exp', stat: 'hunt', exp: 5 }],
    tags: ['training'],
  },
]);

// -------------------------------------
// Coach Skills (55)
// - 装備最大5つ [oai_citation:10‡アイテム.txt](sediment://file_00000000d85c7208accd68f824e681e3)
// - SR「ダブルアビリティ」は全員アビリティ回数+1 [oai_citation:11‡アイテム.txt](sediment://file_00000000d85c7208accd68f824e681e3)
// -------------------------------------
function makeCoachId(name) {
  return makeItemId(name);
}

/**
 * coach effect schema (game側で解釈):
 * - scope: 'team'|'enemy'|'enemies'
 * - stat ops:
 *   - add: +N（HPなど）
 *   - pct: +0.2（例：全能力20%アップが必要ならここに追加する方式も可）
 * - special:
 *   - 'ability_uses_add': +1 など
 */
export const COACH_SKILLS = Object.freeze([
  // SSR（5） [oai_citation:12‡アイテム.txt](sediment://file_00000000d85c7208accd68f824e681e3)
  {
    id: makeCoachId('チャンピオンロード'),
    name: 'チャンピオンロード',
    rarity: COACH_RARITY.SSR,
    desc: '全員を底上げする万能型',
    effects: [
      { scope: 'team', stat: 'hp', op: 'add', value: 10 },
      { scope: 'team', stat: 'mental', op: 'add', value: 6 },
      { scope: 'team', stat: 'aim', op: 'add', value: 2 },
      { scope: 'team', stat: 'agility', op: 'add', value: 2 },
      { scope: 'team', stat: 'technique', op: 'add', value: 2 },
      { scope: 'team', stat: 'support', op: 'add', value: 6 },
      { scope: 'team', stat: 'hunt', op: 'add', value: 6 },
      { scope: 'team', stat: 'synergy', op: 'add', value: 8 },
    ],
  },
  {
    id: makeCoachId('覇王の照準'),
    name: '覇王の照準',
    rarity: COACH_RARITY.SSR,
    desc: '撃ち合い特化。命中と技術をまとめて強化',
    effects: [
      { scope: 'team', stat: 'aim', op: 'add', value: 4 },
      { scope: 'team', stat: 'technique', op: 'add', value: 4 },
      { scope: 'team', stat: 'mental', op: 'add', value: 4 },
      { scope: 'enemies', stat: 'aim', op: 'add', value: -2 },
    ],
  },
  {
    id: makeCoachId('鉄壁の統率'),
    name: '鉄壁の統率',
    rarity: COACH_RARITY.SSR,
    desc: '安定特化。HPと連携で崩れにくくする（命中は少し下がる）',
    effects: [
      { scope: 'team', stat: 'hp', op: 'add', value: 15 },
      { scope: 'team', stat: 'mental', op: 'add', value: 8 },
      { scope: 'team', stat: 'support', op: 'add', value: 8 },
      { scope: 'team', stat: 'synergy', op: 'add', value: 8 },
      { scope: 'team', stat: 'aim', op: 'add', value: -1 },
    ],
  },
  {
    id: makeCoachId('ハンティングウルフ'),
    name: 'ハンティングウルフ',
    rarity: COACH_RARITY.SSR,
    desc: 'キルチャンス増。狩り性能を強化して攻める',
    effects: [
      { scope: 'team', stat: 'hunt', op: 'add', value: 12 },
      { scope: 'team', stat: 'aim', op: 'add', value: 2 },
      { scope: 'team', stat: 'technique', op: 'add', value: 3 },
      { scope: 'team', stat: 'support', op: 'add', value: 4 },
    ],
  },
  {
    id: makeCoachId('オール・ゾーン'),
    name: 'オール・ゾーン',
    rarity: COACH_RARITY.SSR,
    desc: '連携を超強化。支援と噛み合いを最大化',
    effects: [
      { scope: 'team', stat: 'synergy', op: 'add', value: 12 },
      { scope: 'team', stat: 'support', op: 'add', value: 10 },
      { scope: 'team', stat: 'mental', op: 'add', value: 6 },
      { scope: 'team', stat: 'technique', op: 'add', value: 2 },
    ],
  },

  // SR（15） [oai_citation:13‡アイテム.txt](sediment://file_00000000d85c7208accd68f824e681e3)
  {
    id: makeCoachId('ダブルアビリティ'),
    name: 'ダブルアビリティ',
    rarity: COACH_RARITY.SR,
    desc: 'この試合、全員アビリティをもう1回追加で使える',
    effects: [{ scope: 'team', special: 'ability_uses_add', value: 1 }],
  },
  { id: makeCoachId('精密射撃指令'), name: '精密射撃指令', rarity: COACH_RARITY.SR, desc: '命中と火力を安定強化', effects: [{ scope: 'team', stat: 'aim', op: 'add', value: 3 }, { scope: 'team', stat: 'technique', op: 'add', value: 2 }] },
  { id: makeCoachId('エイム集中'), name: 'エイム集中', rarity: COACH_RARITY.SR, desc: '集中力で命中を押し上げる', effects: [{ scope: 'team', stat: 'aim', op: 'add', value: 3 }, { scope: 'team', stat: 'mental', op: 'add', value: 4 }] },
  { id: makeCoachId('技術研磨'), name: '技術研磨', rarity: COACH_RARITY.SR, desc: '技術で撃ち合いを強化', effects: [{ scope: 'team', stat: 'technique', op: 'add', value: 4 }, { scope: 'team', stat: 'aim', op: 'add', value: 1 }] },
  { id: makeCoachId('反射神経ブースト'), name: '反射神経ブースト', rarity: COACH_RARITY.SR, desc: '反応と回避を強化（機動戦向け）', effects: [{ scope: 'team', stat: 'agility', op: 'add', value: 4 }, { scope: 'team', stat: 'technique', op: 'add', value: 1 }] },
  { id: makeCoachId('メンタル強化'), name: 'メンタル強化', rarity: COACH_RARITY.SR, desc: '終盤に強くなる（粘りが出る）', effects: [{ scope: 'team', stat: 'mental', op: 'add', value: 8 }, { scope: 'team', stat: 'aim', op: 'add', value: 1 }] },
  { id: makeCoachId('サポート最優先'), name: 'サポート最優先', rarity: COACH_RARITY.SR, desc: '支援を強化してチームを立て直しやすくする', effects: [{ scope: 'team', stat: 'support', op: 'add', value: 8 }, { scope: 'team', stat: 'synergy', op: 'add', value: 4 }] },
  { id: makeCoachId('連携最優先'), name: '連携最優先', rarity: COACH_RARITY.SR, desc: '噛み合いを強化して勝ち筋を作る', effects: [{ scope: 'team', stat: 'synergy', op: 'add', value: 8 }, { scope: 'team', stat: 'support', op: 'add', value: 4 }] },
  { id: makeCoachId('狩りの号令'), name: '狩りの号令', rarity: COACH_RARITY.SR, desc: 'キル狙いの動きが強くなる', effects: [{ scope: 'team', stat: 'hunt', op: 'add', value: 10 }, { scope: 'team', stat: 'aim', op: 'add', value: 1 }, { scope: 'team', stat: 'technique', op: 'add', value: 1 }] },
  { id: makeCoachId('弱点解析'), name: '弱点解析', rarity: COACH_RARITY.SR, desc: '相手の弱点を突いて有利を作る', effects: [{ scope: 'team', stat: 'technique', op: 'add', value: 3 }, { scope: 'enemies', stat: 'aim', op: 'add', value: -2 }] },
  { id: makeCoachId('妨害戦術'), name: '妨害戦術', rarity: COACH_RARITY.SR, desc: '相手を弱体化して撃ち勝ちやすくする', effects: [{ scope: 'enemies', stat: 'aim', op: 'add', value: -4 }, { scope: 'enemies', stat: 'agility', op: 'add', value: -2 }, { scope: 'team', stat: 'mental', op: 'add', value: 2 }] },
  { id: makeCoachId('粘りの指揮'), name: '粘りの指揮', rarity: COACH_RARITY.SR, desc: 'HPと精神で崩れにくくする', effects: [{ scope: 'team', stat: 'hp', op: 'add', value: 25 }, { scope: 'team', stat: 'mental', op: 'add', value: 6 }, { scope: 'team', stat: 'support', op: 'add', value: 2 }] },
  { id: makeCoachId('勝負勘'), name: '勝負勘', rarity: COACH_RARITY.SR, desc: '命中と噛み合いを少し上げる', effects: [{ scope: 'team', stat: 'mental', op: 'add', value: 6 }, { scope: 'team', stat: 'aim', op: 'add', value: 2 }, { scope: 'team', stat: 'synergy', op: 'add', value: 3 }] },
  { id: makeCoachId('一撃必殺プラン'), name: '一撃必殺プラン', rarity: COACH_RARITY.SR, desc: '攻め特化（支援は少し下がる）', effects: [{ scope: 'team', stat: 'aim', op: 'add', value: 2 }, { scope: 'team', stat: 'technique', op: 'add', value: 3 }, { scope: 'team', stat: 'support', op: 'add', value: -2 }] },
  { id: makeCoachId('全員仕事モード'), name: '全員仕事モード', rarity: COACH_RARITY.SR, desc: '全体をバランス良く底上げ', effects: [{ scope: 'team', stat: 'aim', op: 'add', value: 1 }, { scope: 'team', stat: 'agility', op: 'add', value: 1 }, { scope: 'team', stat: 'technique', op: 'add', value: 1 }, { scope: 'team', stat: 'mental', op: 'add', value: 4 }, { scope: 'team', stat: 'synergy', op: 'add', value: 4 }] },

  // R（35） [oai_citation:14‡アイテム.txt](sediment://file_00000000d85c7208accd68f824e681e3)
  { id: makeCoachId('アイサイト調整'), name: 'アイサイト調整', rarity: COACH_RARITY.R, desc: '命中が少し上がる', effects: [{ scope: 'team', stat: 'aim', op: 'add', value: 1 }] },
  { id: makeCoachId('照準安定化'), name: '照準安定化', rarity: COACH_RARITY.R, desc: '命中が上がる', effects: [{ scope: 'team', stat: 'aim', op: 'add', value: 2 }] },
  { id: makeCoachId('一点集中'), name: '一点集中', rarity: COACH_RARITY.R, desc: '命中を強化する代わりに精神が少し下がる', effects: [{ scope: 'team', stat: 'aim', op: 'add', value: 3 }, { scope: 'team', stat: 'mental', op: 'add', value: -1 }] },
  { id: makeCoachId('援護射撃の合図'), name: '援護射撃の合図', rarity: COACH_RARITY.R, desc: '命中と支援を少し強化', effects: [{ scope: 'team', stat: 'aim', op: 'add', value: 2 }, { scope: 'team', stat: 'support', op: 'add', value: 1 }] },
  { id: makeCoachId('連携射撃'), name: '連携射撃', rarity: COACH_RARITY.R, desc: '命中と連携を少し強化', effects: [{ scope: 'team', stat: 'aim', op: 'add', value: 2 }, { scope: 'team', stat: 'synergy', op: 'add', value: 1 }] },
  { id: makeCoachId('撃ち方の型'), name: '撃ち方の型', rarity: COACH_RARITY.R, desc: '命中と技術を少し強化', effects: [{ scope: 'team', stat: 'aim', op: 'add', value: 1 }, { scope: 'team', stat: 'technique', op: 'add', value: 1 }] },
  { id: makeCoachId('狙い撃ちスイッチ'), name: '狙い撃ちスイッチ', rarity: COACH_RARITY.R, desc: '命中を少し上げつつ狩り性能を上げる', effects: [{ scope: 'team', stat: 'aim', op: 'add', value: 1 }, { scope: 'team', stat: 'hunt', op: 'add', value: 4 }] },

  { id: makeCoachId('反射強化'), name: '反射強化', rarity: COACH_RARITY.R, desc: '反応が少し上がる', effects: [{ scope: 'team', stat: 'agility', op: 'add', value: 1 }] },
  { id: makeCoachId('クイックムーブ'), name: 'クイックムーブ', rarity: COACH_RARITY.R, desc: '反応が上がる', effects: [{ scope: 'team', stat: 'agility', op: 'add', value: 2 }] },
  { id: makeCoachId('瞬間回避'), name: '瞬間回避', rarity: COACH_RARITY.R, desc: '反応を強化する代わりに技術が少し下がる', effects: [{ scope: 'team', stat: 'agility', op: 'add', value: 3 }, { scope: 'team', stat: 'technique', op: 'add', value: -1 }] },
  { id: makeCoachId('落ち着いて回避'), name: '落ち着いて回避', rarity: COACH_RARITY.R, desc: '反応と精神を少し強化', effects: [{ scope: 'team', stat: 'agility', op: 'add', value: 2 }, { scope: 'team', stat: 'mental', op: 'add', value: 1 }] },
  { id: makeCoachId('動き撃ち練習'), name: '動き撃ち練習', rarity: COACH_RARITY.R, desc: '反応と命中を少し強化', effects: [{ scope: 'team', stat: 'agility', op: 'add', value: 1 }, { scope: 'team', stat: 'aim', op: 'add', value: 1 }] },
  { id: makeCoachId('息合わせステップ'), name: '息合わせステップ', rarity: COACH_RARITY.R, desc: '反応を少し上げつつ連携が上がる', effects: [{ scope: 'team', stat: 'agility', op: 'add', value: 1 }, { scope: 'team', stat: 'synergy', op: 'add', value: 4 }] },

  { id: makeCoachId('技の基礎'), name: '技の基礎', rarity: COACH_RARITY.R, desc: '技術が少し上がる', effects: [{ scope: 'team', stat: 'technique', op: 'add', value: 1 }] },
  { id: makeCoachId('技の積み上げ'), name: '技の積み上げ', rarity: COACH_RARITY.R, desc: '技術が上がる', effects: [{ scope: 'team', stat: 'technique', op: 'add', value: 2 }] },
  { id: makeCoachId('職人モード'), name: '職人モード', rarity: COACH_RARITY.R, desc: '技術を強化する代わりに精神が少し下がる', effects: [{ scope: 'team', stat: 'technique', op: 'add', value: 3 }, { scope: 'team', stat: 'mental', op: 'add', value: -1 }] },
  { id: makeCoachId('弾の通し方'), name: '弾の通し方', rarity: COACH_RARITY.R, desc: '技術と命中を少し強化', effects: [{ scope: 'team', stat: 'technique', op: 'add', value: 2 }, { scope: 'team', stat: 'aim', op: 'add', value: 1 }] },
  { id: makeCoachId('支援の作法'), name: '支援の作法', rarity: COACH_RARITY.R, desc: '技術を少し上げて支援が伸びる', effects: [{ scope: 'team', stat: 'technique', op: 'add', value: 1 }, { scope: 'team', stat: 'support', op: 'add', value: 4 }] },
  { id: makeCoachId('狩りの手順'), name: '狩りの手順', rarity: COACH_RARITY.R, desc: '技術を少し上げて狩り性能が伸びる', effects: [{ scope: 'team', stat: 'technique', op: 'add', value: 1 }, { scope: 'team', stat: 'hunt', op: 'add', value: 4 }] },

  { id: makeCoachId('平常心'), name: '平常心', rarity: COACH_RARITY.R, desc: '精神が少し上がる', effects: [{ scope: 'team', stat: 'mental', op: 'add', value: 2 }] },
  { id: makeCoachId('気合いの集中'), name: '気合いの集中', rarity: COACH_RARITY.R, desc: '精神が上がるが命中が少し下がる', effects: [{ scope: 'team', stat: 'mental', op: 'add', value: 3 }, { scope: 'team', stat: 'aim', op: 'add', value: -1 }] },
  { id: makeCoachId('声かけ確認'), name: '声かけ確認', rarity: COACH_RARITY.R, desc: '精神と連携を強化', effects: [{ scope: 'team', stat: 'mental', op: 'add', value: 2 }, { scope: 'team', stat: 'synergy', op: 'add', value: 4 }] },
  { id: makeCoachId('切り替え指示'), name: '切り替え指示', rarity: COACH_RARITY.R, desc: '精神と支援を強化', effects: [{ scope: 'team', stat: 'mental', op: 'add', value: 2 }, { scope: 'team', stat: 'support', op: 'add', value: 4 }] },
  { id: makeCoachId('勝負根性'), name: '勝負根性', rarity: COACH_RARITY.R, desc: '精神を強化する代わりに技術が少し下がる', effects: [{ scope: 'team', stat: 'mental', op: 'add', value: 4 }, { scope: 'team', stat: 'technique', op: 'add', value: -1 }] },

  { id: makeCoachId('カバー優先'), name: 'カバー優先', rarity: COACH_RARITY.R, desc: '支援が少し上がる', effects: [{ scope: 'team', stat: 'support', op: 'add', value: 3 }] },
  { id: makeCoachId('味方優先指令'), name: '味方優先指令', rarity: COACH_RARITY.R, desc: '支援が上がるが命中が少し下がる', effects: [{ scope: 'team', stat: 'support', op: 'add', value: 4 }, { scope: 'team', stat: 'aim', op: 'add', value: -1 }] },
  { id: makeCoachId('フォロー連携'), name: 'フォロー連携', rarity: COACH_RARITY.R, desc: '支援と連携を同時に強化', effects: [{ scope: 'team', stat: 'support', op: 'add', value: 3 }, { scope: 'team', stat: 'synergy', op: 'add', value: 4 }] },
  { id: makeCoachId('応急サポート'), name: '応急サポート', rarity: COACH_RARITY.R, desc: '支援を少し上げつつHPも少し増える', effects: [{ scope: 'team', stat: 'support', op: 'add', value: 2 }, { scope: 'team', stat: 'hp', op: 'add', value: 10 }] },
  { id: makeCoachId('支援集中'), name: '支援集中', rarity: COACH_RARITY.R, desc: '支援を強化する代わりに技術が少し下がる', effects: [{ scope: 'team', stat: 'support', op: 'add', value: 5 }, { scope: 'team', stat: 'technique', op: 'add', value: -1 }] },

  { id: makeCoachId('索敵強化'), name: '索敵強化', rarity: COACH_RARITY.R, desc: '狩り性能が上がる', effects: [{ scope: 'team', stat: 'hunt', op: 'add', value: 6 }] },
  { id: makeCoachId('獲物追跡'), name: '獲物追跡', rarity: COACH_RARITY.R, desc: '狩り性能が上がるが精神が少し下がる', effects: [{ scope: 'team', stat: 'hunt', op: 'add', value: 8 }, { scope: 'team', stat: 'mental', op: 'add', value: -1 }] },
  { id: makeCoachId('狩りの精度'), name: '狩りの精度', rarity: COACH_RARITY.R, desc: '狩り性能と技術を少し強化', effects: [{ scope: 'team', stat: 'hunt', op: 'add', value: 6 }, { scope: 'team', stat: 'technique', op: 'add', value: 1 }] },

  { id: makeCoachId('連携確認'), name: '連携確認', rarity: COACH_RARITY.R, desc: '連携が上がる', effects: [{ scope: 'team', stat: 'synergy', op: 'add', value: 6 }] },
  { id: makeCoachId('噛み合い強化'), name: '噛み合い強化', rarity: COACH_RARITY.R, desc: '連携が上がるが命中が少し下がる', effects: [{ scope: 'team', stat: 'synergy', op: 'add', value: 8 }, { scope: 'team', stat: 'aim', op: 'add', value: -1 }] },
  { id: makeCoachId('息合わせコール'), name: '息合わせコール', rarity: COACH_RARITY.R, desc: '連携を上げつつ支援も少し上がる', effects: [{ scope: 'team', stat: 'synergy', op: 'add', value: 6 }, { scope: 'team', stat: 'support', op: 'add', value: 1 }] },
]);

// -------------------------------------
// Helpers
// -------------------------------------
export function getItemById(id) {
  const key = String(id || '').trim();
  if (!key) return null;
  return ITEMS.find((it) => it.id === key) || null;
}

export function listItemsByCategory(category) {
  const c = String(category || '').trim();
  return ITEMS.filter((it) => it.category === c);
}

export function getCoachSkillById(id) {
  const key = String(id || '').trim();
  if (!key) return null;
  return COACH_SKILLS.find((cs) => cs.id === key) || null;
}

export function listCoachSkillsByRarity(rarity) {
  const r = String(rarity || '').trim();
  return COACH_SKILLS.filter((cs) => cs.rarity === r);
}

export function canUseItemInPhase(item, phase) {
  if (!item) return false;
  const p = String(phase || '').trim();
  if (item.usePhase === ITEM_USE_PHASE.ANYTIME) return true;
  return item.usePhase === p;
}

/**
 * Simple applicator (game側の実装が出来るまでの暫定)
 * - statsObj: {hp, armor, ...}
 */
export function applyItemEffectsToStats(statsObj, item) {
  const s = { ...(statsObj || {}) };
  if (!item || !Array.isArray(item.effects)) return s;

  for (const ef of item.effects) {
    if (!ef || !ef.type) continue;

    if (ef.type === 'heal_hp') {
      if (ef.mode === 'full') s.hp = s.hpMax ?? s.hp; // game側で hpMax を持つなら回せる
      else s.hp = (s.hp ?? 0) + (ef.amount ?? 0);
    }
    if (ef.type === 'heal_armor') {
      if (ef.mode === 'full') s.armor = 100;
      else s.armor = (s.armor ?? 0) + (ef.amount ?? 0);
      s.armor = clamp(s.armor ?? 0, 0, 100);
    }
    if (ef.type === 'training_exp') {
      // 経験値は game側で管理が本命。ここではそのまま返す（スタブ）。
      // 例: s._exp = { ... } のように積むならここで実装可能
    }
  }
  return s;
}
