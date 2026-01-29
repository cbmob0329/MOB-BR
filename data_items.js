/* data_items.js (FULL) - MOB BR
   - Shop Items (battle/training)
   - Coach Skills Gacha (SSR5 / SR15 / R35 = 55)
   Source: アイテム.txt
*/

export const DATA_ITEMS = (() => {
  // -----------------------------
  // Helpers
  // -----------------------------
  const deepFreeze = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    Object.freeze(obj);
    for (const k of Object.keys(obj)) deepFreeze(obj[k]);
    return obj;
  };

  // Normalize stat keys used across the project
  // (You can map these to your internal status system later.)
  const STAT_KEYS = deepFreeze({
    HP: 'HP',
    ARMOR: 'Armor',
    MENTAL: 'Mental',
    AIM: 'Aim',
    AGILITY: 'Agility',
    TECHNIQUE: 'Technique',
    SUPPORT: 'Support',
    HUNT: 'Hunt',
    SYNERGY: 'Synergy',
  });

  // -----------------------------
  // Shop Items (入手：ショップ or ガチャ)
  // - battleUsable: 戦闘中OK
  // - trainingOnly: 育成専用（戦闘中NG）
  // -----------------------------
  const shopItems = [
    // 1. 回復（HP回復 / 戦闘中OK）
    {
      id: 'shop_hp_gummy',
      kind: 'shop',
      category: 'heal_hp',
      name: 'エナジーグミ',
      description: '小回復',
      priceG: 50,
      battleUsable: true,
      effect: { type: 'heal_hp', power: 'small' },
    },
    {
      id: 'shop_hp_choco',
      kind: 'shop',
      category: 'heal_hp',
      name: 'エナジーチョコ',
      description: '中回復',
      priceG: 100,
      battleUsable: true,
      effect: { type: 'heal_hp', power: 'medium' },
    },
    {
      id: 'shop_hp_wataame',
      kind: 'shop',
      category: 'heal_hp',
      name: 'エナジーわたあめ',
      description: '全回復',
      priceG: 300,
      battleUsable: true,
      effect: { type: 'heal_hp', power: 'full' },
    },

    // 2. 回復（Armor回復 / 戦闘中OK）
    {
      id: 'shop_ar_vanilla',
      kind: 'shop',
      category: 'heal_armor',
      name: 'バニラアイス',
      description: '小回復',
      priceG: 50,
      battleUsable: true,
      effect: { type: 'heal_armor', power: 'small' },
    },
    {
      id: 'shop_ar_2dan',
      kind: 'shop',
      category: 'heal_armor',
      name: '2段アイス',
      description: '中回復',
      priceG: 100,
      battleUsable: true,
      effect: { type: 'heal_armor', power: 'medium' },
    },
    {
      id: 'shop_ar_3dan',
      kind: 'shop',
      category: 'heal_armor',
      name: '3段アイス',
      description: '全回復',
      priceG: 300,
      battleUsable: true,
      effect: { type: 'heal_armor', power: 'full' },
    },

    // 3. 攻撃・妨害（戦闘中OK）
    {
      id: 'shop_attack_taiyaki_grenade',
      kind: 'shop',
      category: 'attack_or_debuff',
      name: 'たい焼きグレネード',
      description: '全体攻撃',
      priceG: 1000,
      battleUsable: true,
      effect: { type: 'aoe_damage', power: 'fixed', note: '全体攻撃' },
    },
    {
      id: 'shop_debuff_arc_ramune',
      kind: 'shop',
      category: 'attack_or_debuff',
      name: 'アークラムネ',
      description: '敵1人スピードダウン',
      priceG: 1000,
      battleUsable: true,
      effect: { type: 'debuff', target: 'enemy_one', stat: STAT_KEYS.AGILITY, value: 'down', note: 'スピードダウン' },
    },
    {
      id: 'shop_debuff_pukupuku_launcher',
      kind: 'shop',
      category: 'attack_or_debuff',
      name: 'ぷくぷくランチャー',
      description: '敵全体エイムダウン',
      priceG: 1000,
      battleUsable: true,
      effect: { type: 'debuff', target: 'enemy_all', stat: STAT_KEYS.AIM, value: 'down', note: 'エイムダウン' },
    },

    // 4. チャージ（戦闘中OK）
    {
      id: 'shop_charge_chuppa',
      kind: 'shop',
      category: 'charge',
      name: 'チュッパチャージ',
      description: 'アビリティチャージ',
      priceG: 5000,
      battleUsable: true,
      effect: { type: 'ability_charge', amount: 1 },
    },

    // 5. 特殊（戦闘中OK）
    {
      id: 'shop_special_respawn_ocarina',
      kind: 'shop',
      category: 'special',
      name: 'リスポーンオカリナ',
      description: 'デスボックスから復活',
      priceG: 500,
      battleUsable: true,
      effect: { type: 'respawn_from_deathbox', amount: 1 },
    },

    // 6. 育成（育成専用 / 戦闘中NG）
    // ※使用すると 能力経験値 +5
    {
      id: 'train_hp_toughness_scroll',
      kind: 'shop',
      category: 'training',
      name: 'タフネス極意の巻物',
      description: 'HP経験値+5（育成専用）',
      priceG: 20000,
      battleUsable: false,
      trainingOnly: true,
      effect: { type: 'training_exp', stat: STAT_KEYS.HP, exp: 5 },
    },
    {
      id: 'train_mental_picturebook',
      kind: 'shop',
      category: 'training',
      name: '感動的な絵本',
      description: 'Mental経験値+5（育成専用）',
      priceG: 10000,
      battleUsable: false,
      trainingOnly: true,
      effect: { type: 'training_exp', stat: STAT_KEYS.MENTAL, exp: 5 },
    },
    {
      id: 'train_aim_eyedrops',
      kind: 'shop',
      category: 'training',
      name: '秘伝の目薬',
      description: 'Aim経験値+5（育成専用）',
      priceG: 20000,
      battleUsable: false,
      trainingOnly: true,
      effect: { type: 'training_exp', stat: STAT_KEYS.AIM, exp: 5 },
    },
    {
      id: 'train_agility_kamoshika_steak',
      kind: 'shop',
      category: 'training',
      name: 'カモシカのステーキ',
      description: 'Agility経験値+5（育成専用）',
      priceG: 10000,
      battleUsable: false,
      trainingOnly: true,
      effect: { type: 'training_exp', stat: STAT_KEYS.AGILITY, exp: 5 },
    },
    {
      id: 'train_technique_soroban',
      kind: 'shop',
      category: 'training',
      name: '高級なそろばん',
      description: 'Technique経験値+5（育成専用）',
      priceG: 10000,
      battleUsable: false,
      trainingOnly: true,
      effect: { type: 'training_exp', stat: STAT_KEYS.TECHNIQUE, exp: 5 },
    },
    {
      id: 'train_support_disk',
      kind: 'shop',
      category: 'training',
      name: 'サポートディスク',
      description: 'Support経験値+5（育成専用）',
      priceG: 10000,
      battleUsable: false,
      trainingOnly: true,
      effect: { type: 'training_exp', stat: STAT_KEYS.SUPPORT, exp: 5 },
    },
    {
      id: 'train_hunt_bear_figurine',
      kind: 'shop',
      category: 'training',
      name: '熊の置物',
      description: 'Hunt経験値+5（育成専用）',
      priceG: 10000,
      battleUsable: false,
      trainingOnly: true,
      effect: { type: 'training_exp', stat: STAT_KEYS.HUNT, exp: 5 },
    },

    // 8. 防具（未確定：後日実装）
    {
      id: 'armor_tbd',
      kind: 'shop',
      category: 'armor',
      name: '防具（未確定）',
      description: '※後日実装（未確定）',
      priceG: null,
      battleUsable: false,
      trainingOnly: false,
      effect: null,
      isPlaceholder: true,
    },
  ];

  // -----------------------------
  // Coach Skills Gacha (全55種)
  // - kind: 'coach'
  // - rarity: 'SSR' | 'SR' | 'R'
  // - mods: team buffs / enemy debuffs (flat)
  //   You can later apply caps described in 戦闘まとめ（Aim+15など）に合わせて処理側で制御
  // -----------------------------
  const coachSkills = [
    // ✅SSR（5）
    {
      id: 'coach_ssr_01_champion_road',
      kind: 'coach',
      rarity: 'SSR',
      name: 'チャンピオンロード',
      description: '全員を底上げする万能型',
      mods: { HP: 10, Mental: 6, Aim: 2, Agility: 2, Technique: 2, Support: 6, Hunt: 6, Synergy: 8 },
    },
    {
      id: 'coach_ssr_02_haou_no_shoujun',
      kind: 'coach',
      rarity: 'SSR',
      name: '覇王の照準',
      description: '撃ち合い特化。命中と技術をまとめて強化',
      mods: { Aim: 4, Technique: 4, Mental: 4, enemyAim: -2 },
    },
    {
      id: 'coach_ssr_03_tekketsu_no_tousotsu',
      kind: 'coach',
      rarity: 'SSR',
      name: '鉄壁の統率',
      description: '安定特化。HPと連携で崩れにくくする（命中は少し下がる）',
      mods: { HP: 15, Mental: 8, Support: 8, Synergy: 8, Aim: -1 },
    },
    {
      id: 'coach_ssr_04_hunting_wolf',
      kind: 'coach',
      rarity: 'SSR',
      name: 'ハンティングウルフ',
      description: 'キルチャンス増。狩り性能を強化して攻める',
      mods: { Hunt: 12, Aim: 2, Technique: 3, Support: 4 },
    },
    {
      id: 'coach_ssr_05_all_zone',
      kind: 'coach',
      rarity: 'SSR',
      name: 'オール・ゾーン',
      description: '連携を超強化。支援と噛み合いを最大化',
      mods: { Synergy: 12, Support: 10, Mental: 6, Technique: 2 },
    },

    // ✅SR（15）
    {
      id: 'coach_sr_01_double_ability',
      kind: 'coach',
      rarity: 'SR',
      name: 'ダブルアビリティ',
      description: 'この試合、全員アビリティをもう1回追加で使える',
      special: { type: 'ability_uses_plus', value: 1 },
      mods: {},
    },
    {
      id: 'coach_sr_02_precision_shooting',
      kind: 'coach',
      rarity: 'SR',
      name: '精密射撃指令',
      description: '命中と火力を安定強化',
      mods: { Aim: 3, Technique: 2 },
    },
    {
      id: 'coach_sr_03_aim_focus',
      kind: 'coach',
      rarity: 'SR',
      name: 'エイム集中',
      description: '集中力で命中を押し上げる',
      mods: { Aim: 3, Mental: 4 },
    },
    {
      id: 'coach_sr_04_tech_polish',
      kind: 'coach',
      rarity: 'SR',
      name: '技術研磨',
      description: '技術で撃ち合いを強化',
      mods: { Technique: 4, Aim: 1 },
    },
    {
      id: 'coach_sr_05_reflex_boost',
      kind: 'coach',
      rarity: 'SR',
      name: '反射神経ブースト',
      description: '反応と回避を強化（機動戦向け）',
      mods: { Agility: 4, Technique: 1 },
    },
    {
      id: 'coach_sr_06_mental_boost',
      kind: 'coach',
      rarity: 'SR',
      name: 'メンタル強化',
      description: '終盤に強くなる（粘りが出る）',
      mods: { Mental: 8, Aim: 1 },
    },
    {
      id: 'coach_sr_07_support_priority',
      kind: 'coach',
      rarity: 'SR',
      name: 'サポート最優先',
      description: '支援を強化してチームを立て直しやすくする',
      mods: { Support: 8, Synergy: 4 },
    },
    {
      id: 'coach_sr_08_synergy_priority',
      kind: 'coach',
      rarity: 'SR',
      name: '連携最優先',
      description: '噛み合いを強化して勝ち筋を作る',
      mods: { Synergy: 8, Support: 4 },
    },
    {
      id: 'coach_sr_09_hunt_command',
      kind: 'coach',
      rarity: 'SR',
      name: '狩りの号令',
      description: 'キル狙いの動きが強くなる',
      mods: { Hunt: 10, Aim: 1, Technique: 1 },
    },
    {
      id: 'coach_sr_10_weakpoint_analysis',
      kind: 'coach',
      rarity: 'SR',
      name: '弱点解析',
      description: '相手の弱点を突いて有利を作る',
      mods: { Technique: 3, enemyAim: -2 },
    },
    {
      id: 'coach_sr_11_obstruction_tactics',
      kind: 'coach',
      rarity: 'SR',
      name: '妨害戦術',
      description: '相手を弱体化して撃ち勝ちやすくする',
      mods: { enemyAim: -4, enemyAgility: -2, Mental: 2 },
    },
    {
      id: 'coach_sr_12_grit_command',
      kind: 'coach',
      rarity: 'SR',
      name: '粘りの指揮',
      description: 'HPと精神で崩れにくくする',
      mods: { HP: 25, Mental: 6, Support: 2 },
    },
    {
      id: 'coach_sr_13_game_sense',
      kind: 'coach',
      rarity: 'SR',
      name: '勝負勘',
      description: '命中と噛み合いを少し上げる',
      mods: { Mental: 6, Aim: 2, Synergy: 3 },
    },
    {
      id: 'coach_sr_14_one_shot_plan',
      kind: 'coach',
      rarity: 'SR',
      name: '一撃必殺プラン',
      description: '攻め特化（支援は少し下がる）',
      mods: { Aim: 2, Technique: 3, Support: -2 },
    },
    {
      id: 'coach_sr_15_all_work_mode',
      kind: 'coach',
      rarity: 'SR',
      name: '全員仕事モード',
      description: '全体をバランス良く底上げ',
      mods: { Aim: 1, Agility: 1, Technique: 1, Mental: 4, Synergy: 4 },
    },

    // ✅R（35）
    // Aim系（7）
    { id: 'coach_r_01_eyesight_adjust', kind: 'coach', rarity: 'R', name: 'アイサイト調整', description: '命中が少し上がる', mods: { Aim: 1 } },
    { id: 'coach_r_02_aim_stabilize', kind: 'coach', rarity: 'R', name: '照準安定化', description: '命中が上がる', mods: { Aim: 2 } },
    { id: 'coach_r_03_pinpoint', kind: 'coach', rarity: 'R', name: '一点集中', description: '命中を強化する代わりに精神が少し下がる', mods: { Aim: 3, Mental: -1 } },
    { id: 'coach_r_04_cover_fire_signal', kind: 'coach', rarity: 'R', name: '援護射撃の合図', description: '命中と支援を少し強化', mods: { Aim: 2, Support: 1 } },
    { id: 'coach_r_05_synergy_fire', kind: 'coach', rarity: 'R', name: '連携射撃', description: '命中と連携を少し強化', mods: { Aim: 2, Synergy: 1 } },
    { id: 'coach_r_06_shooting_form', kind: 'coach', rarity: 'R', name: '撃ち方の型', description: '命中と技術を少し強化', mods: { Aim: 1, Technique: 1 } },
    { id: 'coach_r_07_snipe_switch', kind: 'coach', rarity: 'R', name: '狙い撃ちスイッチ', description: '命中を少し上げつつ狩り性能を上げる', mods: { Aim: 1, Hunt: 4 } },

    // Agility系（6）
    { id: 'coach_r_08_reflex_up', kind: 'coach', rarity: 'R', name: '反射強化', description: '反応が少し上がる', mods: { Agility: 1 } },
    { id: 'coach_r_09_quick_move', kind: 'coach', rarity: 'R', name: 'クイックムーブ', description: '反応が上がる', mods: { Agility: 2 } },
    { id: 'coach_r_10_instant_dodge', kind: 'coach', rarity: 'R', name: '瞬間回避', description: '反応を強化する代わりに技術が少し下がる', mods: { Agility: 3, Technique: -1 } },
    { id: 'coach_r_11_calm_dodge', kind: 'coach', rarity: 'R', name: '落ち着いて回避', description: '反応と精神を少し強化', mods: { Agility: 2, Mental: 1 } },
    { id: 'coach_r_12_move_shoot_practice', kind: 'coach', rarity: 'R', name: '動き撃ち練習', description: '反応と命中を少し強化', mods: { Agility: 1, Aim: 1 } },
    { id: 'coach_r_13_breath_step', kind: 'coach', rarity: 'R', name: '息合わせステップ', description: '反応を少し上げつつ連携が上がる', mods: { Agility: 1, Synergy: 4 } },

    // Technique系（6）
    { id: 'coach_r_14_tech_basic', kind: 'coach', rarity: 'R', name: '技の基礎', description: '技術が少し上がる', mods: { Technique: 1 } },
    { id: 'coach_r_15_tech_stack', kind: 'coach', rarity: 'R', name: '技の積み上げ', description: '技術が上がる', mods: { Technique: 2 } },
    { id: 'coach_r_16_craftsman_mode', kind: 'coach', rarity: 'R', name: '職人モード', description: '技術を強化する代わりに精神が少し下がる', mods: { Technique: 3, Mental: -1 } },
    { id: 'coach_r_17_bullet_path', kind: 'coach', rarity: 'R', name: '弾の通し方', description: '技術と命中を少し強化', mods: { Technique: 2, Aim: 1 } },
    { id: 'coach_r_18_support_manners', kind: 'coach', rarity: 'R', name: '支援の作法', description: '技術を少し上げて支援が伸びる', mods: { Technique: 1, Support: 4 } },
    { id: 'coach_r_19_hunt_procedure', kind: 'coach', rarity: 'R', name: '狩りの手順', description: '技術を少し上げて狩り性能が伸びる', mods: { Technique: 1, Hunt: 4 } },

    // Mental系（5）
    { id: 'coach_r_20_calm_mind', kind: 'coach', rarity: 'R', name: '平常心', description: '精神が少し上がる', mods: { Mental: 2 } },
    { id: 'coach_r_21_spirit_focus', kind: 'coach', rarity: 'R', name: '気合いの集中', description: '精神が上がるが命中が少し下がる', mods: { Mental: 3, Aim: -1 } },
    { id: 'coach_r_22_voice_check', kind: 'coach', rarity: 'R', name: '声かけ確認', description: '精神と連携を強化', mods: { Mental: 2, Synergy: 4 } },
    { id: 'coach_r_23_switch_call', kind: 'coach', rarity: 'R', name: '切り替え指示', description: '精神と支援を強化', mods: { Mental: 2, Support: 4 } },
    { id: 'coach_r_24_guts', kind: 'coach', rarity: 'R', name: '勝負根性', description: '精神を強化する代わりに技術が少し下がる', mods: { Mental: 4, Technique: -1 } },

    // Support系（5）
    { id: 'coach_r_25_cover_priority', kind: 'coach', rarity: 'R', name: 'カバー優先', description: '支援が少し上がる', mods: { Support: 3 } },
    { id: 'coach_r_26_ally_first', kind: 'coach', rarity: 'R', name: '味方優先指令', description: '支援が上がるが命中が少し下がる', mods: { Support: 4, Aim: -1 } },
    { id: 'coach_r_27_follow_synergy', kind: 'coach', rarity: 'R', name: 'フォロー連携', description: '支援と連携を同時に強化', mods: { Support: 3, Synergy: 4 } },
    { id: 'coach_r_28_first_aid_support', kind: 'coach', rarity: 'R', name: '応急サポート', description: '支援を少し上げつつHPも少し増える', mods: { Support: 2, HP: 10 } },
    { id: 'coach_r_29_support_focus', kind: 'coach', rarity: 'R', name: '支援集中', description: '支援を強化する代わりに技術が少し下がる', mods: { Support: 5, Technique: -1 } },

    // Hunt系（3）
    { id: 'coach_r_30_search_up', kind: 'coach', rarity: 'R', name: '索敵強化', description: '狩り性能が上がる', mods: { Hunt: 6 } },
    { id: 'coach_r_31_prey_track', kind: 'coach', rarity: 'R', name: '獲物追跡', description: '狩り性能が上がるが精神が少し下がる', mods: { Hunt: 8, Mental: -1 } },
    { id: 'coach_r_32_hunt_accuracy', kind: 'coach', rarity: 'R', name: '狩りの精度', description: '狩り性能と技術を少し強化', mods: { Hunt: 6, Technique: 1 } },

    // Synergy系（3）
    { id: 'coach_r_33_synergy_check', kind: 'coach', rarity: 'R', name: '連携確認', description: '連携が上がる', mods: { Synergy: 6 } },
    { id: 'coach_r_34_synergy_boost', kind: 'coach', rarity: 'R', name: '噛み合い強化', description: '連携が上がるが命中が少し下がる', mods: { Synergy: 8, Aim: -1 } },
    { id: 'coach_r_35_breath_call', kind: 'coach', rarity: 'R', name: '息合わせコール', description: '連携を上げつつ支援も少し上がる', mods: { Synergy: 6, Support: 1 } },
  ];

  // -----------------------------
  // Indexes
  // -----------------------------
  const byId = new Map();
  for (const it of shopItems) byId.set(it.id, it);
  for (const it of coachSkills) byId.set(it.id, it);

  const coachByRarity = deepFreeze({
    SSR: coachSkills.filter((x) => x.rarity === 'SSR'),
    SR: coachSkills.filter((x) => x.rarity === 'SR'),
    R: coachSkills.filter((x) => x.rarity === 'R'),
  });

  // Public API
  const api = {
    STAT_KEYS,

    // Raw lists
    shopItems: deepFreeze(shopItems),
    coachSkills: deepFreeze(coachSkills),

    // Convenience
    getById(id) {
      return byId.get(id) || null;
    },
    listShopByCategory(category) {
      return shopItems.filter((x) => x.category === category);
    },
    listCoachByRarity(rarity) {
      return coachByRarity[rarity] ? [...coachByRarity[rarity]] : [];
    },
  };

  return deepFreeze(api);
})();
