// data_players.js
// Initial players + Offer (recruit) players
// ES Modules

export const PLAYER_ROLE = Object.freeze({
  ATTACKER: 'Attacker',
  SUPPORT: 'Support',
  SCOUT: 'Scout',
  CONTROLLER: 'Controller',
});

export function makePlayerId(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^\wぁ-んァ-ン一-龠ー]/g, '');
}

/**
 * ステータス共通:
 * - Armorは基本100固定（設計前提）
 * - Techniqueは「武器Req / 観察」用途。初期キャラ原文に無いので、ここでは控えめな初期値を付与（後で調整しやすいよう明示）
 * - Support/Huntは 1〜10
 */
export const PLAYERS_INITIAL = Object.freeze([
  {
    id: makePlayerId('ウニチー'),
    name: 'ウニチー',
    origin: 'player_initial',
    role: PLAYER_ROLE.SUPPORT,
    costG: 0,
    recommendedCorpRank: 0,
    stats: {
      hp: 100,
      armor: 100,
      mental: 50,
      move: 3,
      aim: 85,
      agility: 30,
      technique: 50, // 原文に未記載のため暫定
      support: 8,
      hunt: 4,
    },
    passive: {
      name: 'ウニチーの挨拶',
      type: 'Passive',
      desc: '戦闘中、チームのMentalを+10%（常時）',
      effects: [
        { scope: 'team', stat: 'mental_mult', op: 'mul', value: 1.10, when: 'battle', capKey: 'mental_mult' },
      ],
    },
    ability: {
      name: 'ウニチーのお散歩（ハイプコール）',
      type: 'Fight',
      usesMaxPerMatch: 2,
      timing: ['battle'],
      cpuFixed: { aimTeamAdd: 5, duration: 'this_battle' }, // 1回分
      playerScaling: {
        formulaText: 'Aim + (5 + Support×0.5)（この戦闘1回分）',
        params: [{ stat: 'support', mul: 0.5 }],
        base: 5,
        apply: { scope: 'team', stat: 'aim_add', duration: 'this_battle' },
      },
      caps: [{ stat: 'aim_add_total', max: 15 }], // 戦闘側の共通キャップ参照
    },
    ult: {
      name: 'ビルドハンマー',
      type: 'Fight',
      usesMaxPerMatch: 1,
      timing: ['battle'],
      cpuFixed: { negateDamageTeamOnce: true, limit: { perBattlePerActor: 1, perBattleTeam: 2 } },
      playerScaling: {
        formulaText: '無効化は確定＋追加でArmor+25（戦闘中即時）※Mental条件付けも可',
        base: 0,
        conditional: { stat: 'mental', gte: 55, grant: { scope: 'team', stat: 'armor_add', value: 25, when: 'battle_instant' } },
        apply: { scope: 'team', effect: 'negate_damage_once', when: 'battle', limit: { perBattlePerActor: 1, perBattleTeam: 2 } },
      },
    },
  },

  {
    id: makePlayerId('ネコクー'),
    name: 'ネコクー',
    origin: 'player_initial',
    role: PLAYER_ROLE.SCOUT,
    costG: 0,
    recommendedCorpRank: 0,
    stats: {
      hp: 100,
      armor: 100,
      mental: 55,
      move: 2,
      aim: 80,
      agility: 32,
      technique: 48, // 原文に未記載のため暫定
      support: 5,
      hunt: 7,
    },
    passive: {
      name: 'お昼寝',
      type: 'Passive',
      desc: '索敵アビリティによる「戦闘回避率」を+5%',
      effects: [
        { scope: 'team', stat: 'avoid_battle_bonus', op: 'add', value: 0.05, when: 'scout_ability' },
      ],
    },
    ability: {
      name: 'ジャンプドルフィン',
      type: 'Scout',
      usesMaxPerMatch: 1,
      timing: ['rotate'],
      cpuFixed: { battleRateAdd: -0.10, duration: 'this_round' },
      playerScaling: {
        formulaText: '戦闘発生率 - (10% + Hunt×0.6%)（このR）',
        params: [{ stat: 'hunt', mul: 0.006 }],
        base: -0.10,
        apply: { scope: 'team', stat: 'battle_rate_add', duration: 'this_round' },
      },
    },
    ult: {
      name: 'パーフェクトルート',
      type: 'Rotate',
      usesMaxPerMatch: 1,
      timing: ['battle_start', 'rotate'],
      cpuFixed: { retreatBiasAdd: 0.20, duration: 'this_round' },
      playerScaling: {
        formulaText: '撤退（痛み分け）確率+20% ＋ 自チームの被害が軽くなる（Agility依存で安定）',
        base: 0.20,
        params: [{ stat: 'agility', mul: 0.0 }], // 実装側で「被害軽減」等に使う余地
        apply: { scope: 'team', stat: 'retreat_bias_add', duration: 'this_round' },
      },
    },
  },

  {
    id: makePlayerId('ドオー'),
    name: 'ドオー',
    origin: 'player_initial',
    role: PLAYER_ROLE.CONTROLLER,
    costG: 0,
    recommendedCorpRank: 0,
    stats: {
      hp: 95,
      armor: 100,
      mental: 58,
      move: 3,
      aim: 83,
      agility: 32,
      technique: 52, // 原文に未記載のため暫定
      support: 4,
      hunt: 3,
    },
    passive: {
      name: '丸くなる',
      type: 'Passive',
      desc: '戦闘中、1度だけ敵の攻撃を無効化する',
      effects: [
        { scope: 'self', effect: 'negate_damage_once', when: 'battle', limit: { perBattlePerActor: 1, perBattleTeam: 2 } },
      ],
    },
    ability: {
      name: 'しっぽをふる',
      type: 'Fight',
      usesMaxPerMatch: 2,
      timing: ['battle'],
      cpuFixed: { aimEnemiesAdd: -5, duration: 'next_attack_once' },
      playerScaling: {
        formulaText: '敵全体Aim - (5 + Agility×0.2)（次の攻撃1回分）',
        params: [{ stat: 'agility', mul: 0.2 }],
        base: -5,
        apply: { scope: 'enemies', stat: 'aim_add', duration: 'next_attack_once' },
      },
      caps: [{ stat: 'enemy_aim_down_total', min: -12 }],
    },
    ult: {
      name: 'スリープスマイル',
      type: 'Fight',
      usesMaxPerMatch: 1,
      timing: ['battle'],
      cpuFixed: { disableEnemyOnce: true, duration: 'next_attack_once' },
      playerScaling: {
        formulaText: '敵1人を確定で行動スキップ＋さらにMove-1（次Rまで）※Move依存で精度UP扱い',
        target: 'one_enemy',
        apply: [
          { scope: 'enemy', effect: 'skip_next_attack_once', duration: 'next_attack_once' },
          { scope: 'enemy', stat: 'move_add', value: -1, duration: 'next_round' },
        ],
      },
    },
  },
]);

// ----------------------------
// Offer (Recruit) players
// 原文は「ステータスは任せる」なので、ここでは価格/解放ランクに応じた“基礎値”を付与。
// 強すぎ防止は sim 側のキャップ・確率・係数で調整する想定。
// ----------------------------
function makeOfferBaseStats(tier) {
  // tier: 1=10ランク, 2=30ランク, 3=50ランク
  // 役割別の「らしさ」だけ付与。数値は控えめで後から微調整しやすいレンジ。
  const base = {
    hp: 100,
    armor: 100,
    mental: 55 + (tier - 1) * 3,
    move: 3,
    aim: 82 + (tier - 1) * 2,
    agility: 32 + (tier - 1) * 2,
    technique: 55 + (tier - 1) * 3,
    support: 5,
    hunt: 5,
  };
  return base;
}

function withRoleFlavor(stats, role) {
  const s = { ...stats };
  if (role === PLAYER_ROLE.ATTACKER) {
    s.aim += 4; s.technique += 2; s.support = Math.max(1, s.support - 1);
  } else if (role === PLAYER_ROLE.SUPPORT) {
    s.support = Math.min(10, s.support + 3); s.mental += 3; s.aim -= 1;
  } else if (role === PLAYER_ROLE.SCOUT) {
    s.hunt = Math.min(10, s.hunt + 3); s.agility += 2; s.move += 1; s.aim -= 1;
  } else if (role === PLAYER_ROLE.CONTROLLER) {
    s.technique += 4; s.mental += 2; s.move -= 1;
  }
  // clamp
  s.hp = Math.max(60, Math.min(140, s.hp));
  s.armor = 100;
  s.mental = Math.max(35, Math.min(90, s.mental));
  s.move = Math.max(1, Math.min(5, s.move));
  s.aim = Math.max(55, Math.min(95, s.aim));
  s.agility = Math.max(20, Math.min(70, s.agility));
  s.technique = Math.max(30, Math.min(90, s.technique));
  s.support = Math.max(1, Math.min(10, s.support));
  s.hunt = Math.max(1, Math.min(10, s.hunt));
  return s;
}

export const OFFER_PLAYERS = Object.freeze([
  // Rank 10 / 10000G
  {
    id: makePlayerId('キヅチー'),
    name: 'キヅチー',
    origin: 'offer',
    role: PLAYER_ROLE.ATTACKER,
    costG: 10000,
    recommendedCorpRank: 10,
    stats: withRoleFlavor(makeOfferBaseStats(1), PLAYER_ROLE.ATTACKER),
    passive: { name: '猪突猛進', type: 'Passive', desc: '（後で効果詳細を確定）', effects: [] },
    ability: { name: 'ビルドクラッシュ', type: 'Fight', usesMaxPerMatch: 2, timing: ['battle'], cpuFixed: null, playerScaling: null },
    ult: { name: 'ハンマークラッシュ', type: 'Fight', usesMaxPerMatch: 1, timing: ['battle'], cpuFixed: null, playerScaling: null },
  },
  {
    id: makePlayerId('プチのん'),
    name: 'プチのん',
    origin: 'offer',
    role: PLAYER_ROLE.SUPPORT,
    costG: 10000,
    recommendedCorpRank: 10,
    stats: withRoleFlavor(makeOfferBaseStats(1), PLAYER_ROLE.SUPPORT),
    passive: { name: '回復の心得', type: 'Passive', desc: '（後で効果詳細を確定）', effects: [] },
    ability: { name: '波乗り', type: 'Support', usesMaxPerMatch: 2, timing: ['battle'], cpuFixed: null, playerScaling: null },
    ult: { name: 'マヒャデノン', type: 'Support', usesMaxPerMatch: 1, timing: ['battle'], cpuFixed: null, playerScaling: null },
  },
  {
    id: makePlayerId('ハリネズミ'),
    name: 'ハリネズミ',
    origin: 'offer',
    role: PLAYER_ROLE.SCOUT,
    costG: 10000,
    recommendedCorpRank: 10,
    stats: withRoleFlavor(makeOfferBaseStats(1), PLAYER_ROLE.SCOUT),
    passive: { name: 'トゲトゲ', type: 'Passive', desc: '（後で効果詳細を確定）', effects: [] },
    ability: { name: '新しいパワー', type: 'Scout', usesMaxPerMatch: 1, timing: ['rotate'], cpuFixed: null, playerScaling: null },
    ult: { name: 'みかんアタック', type: 'Fight', usesMaxPerMatch: 1, timing: ['battle'], cpuFixed: null, playerScaling: null },
  },
  {
    id: makePlayerId('チャコチェ'),
    name: 'チャコチェ',
    origin: 'offer',
    role: PLAYER_ROLE.CONTROLLER,
    costG: 10000,
    recommendedCorpRank: 10,
    stats: withRoleFlavor(makeOfferBaseStats(1), PLAYER_ROLE.CONTROLLER),
    passive: { name: '農家育ち', type: 'Passive', desc: '（後で効果詳細を確定）', effects: [] },
    ability: { name: '新鮮なトマト', type: 'Control', usesMaxPerMatch: 2, timing: ['battle'], cpuFixed: null, playerScaling: null },
    ult: { name: 'パン愛好家', type: 'Control', usesMaxPerMatch: 1, timing: ['battle'], cpuFixed: null, playerScaling: null },
  },

  // Rank 30 (unlock at 15) / 30000G
  {
    id: makePlayerId('ジゴック'),
    name: 'ジゴック',
    origin: 'offer',
    role: PLAYER_ROLE.CONTROLLER,
    costG: 30000,
    recommendedCorpRank: 30,
    unlockCorpRank: 15,
    stats: withRoleFlavor(makeOfferBaseStats(2), PLAYER_ROLE.CONTROLLER),
    passive: { name: 'いじわる', type: 'Passive', desc: '（後で効果詳細を確定）', effects: [] },
    ability: { name: '暗闇', type: 'Control', usesMaxPerMatch: 2, timing: ['battle'], cpuFixed: null, playerScaling: null },
    ult: { name: '信仰', type: 'Control', usesMaxPerMatch: 1, timing: ['battle'], cpuFixed: null, playerScaling: null },
  },
  {
    id: makePlayerId('マメラス'),
    name: 'マメラス',
    origin: 'offer',
    role: PLAYER_ROLE.ATTACKER,
    costG: 30000,
    recommendedCorpRank: 30,
    unlockCorpRank: 15,
    stats: withRoleFlavor(makeOfferBaseStats(2), PLAYER_ROLE.ATTACKER),
    passive: { name: '鋼の肉体', type: 'Passive', desc: '（後で効果詳細を確定）', effects: [] },
    ability: { name: 'パワークラッシュ', type: 'Fight', usesMaxPerMatch: 2, timing: ['battle'], cpuFixed: null, playerScaling: null },
    ult: { name: '巨大化', type: 'Fight', usesMaxPerMatch: 1, timing: ['battle'], cpuFixed: null, playerScaling: null },
  },
  {
    id: makePlayerId('いなりん'),
    name: 'いなりん',
    origin: 'offer',
    role: PLAYER_ROLE.SCOUT,
    costG: 30000,
    recommendedCorpRank: 30,
    unlockCorpRank: 15,
    stats: withRoleFlavor(makeOfferBaseStats(2), PLAYER_ROLE.SCOUT),
    passive: { name: 'ふわふわボディ', type: 'Passive', desc: '（後で効果詳細を確定）', effects: [] },
    ability: { name: '熱い視線', type: 'Scout', usesMaxPerMatch: 1, timing: ['rotate'], cpuFixed: null, playerScaling: null },
    ult: { name: '神のかくれんぼ', type: 'Rotate', usesMaxPerMatch: 1, timing: ['rotate', 'battle_start'], cpuFixed: null, playerScaling: null },
  },
  {
    id: makePlayerId('ゴマプリン'),
    name: 'ゴマプリン',
    origin: 'offer',
    role: PLAYER_ROLE.SUPPORT,
    costG: 30000,
    recommendedCorpRank: 30,
    unlockCorpRank: 15,
    stats: withRoleFlavor(makeOfferBaseStats(2), PLAYER_ROLE.SUPPORT),
    passive: { name: 'やわらかボディ', type: 'Passive', desc: '（後で効果詳細を確定）', effects: [] },
    ability: { name: '甘い風', type: 'Support', usesMaxPerMatch: 2, timing: ['battle'], cpuFixed: null, playerScaling: null },
    ult: { name: '香ばしいサポート', type: 'Support', usesMaxPerMatch: 1, timing: ['battle'], cpuFixed: null, playerScaling: null },
  },

  // Rank 50 (unlock at 40) / 50000G
  {
    id: makePlayerId('ブルーアイズ'),
    name: 'ブルーアイズ',
    origin: 'offer',
    role: PLAYER_ROLE.ATTACKER,
    costG: 50000,
    recommendedCorpRank: 50,
    unlockCorpRank: 40,
    stats: withRoleFlavor(makeOfferBaseStats(3), PLAYER_ROLE.ATTACKER),
    passive: { name: '命の恩人', type: 'Passive', desc: '（後で効果詳細を確定）', effects: [] },
    ability: { name: '絶対的エース', type: 'Fight', usesMaxPerMatch: 2, timing: ['battle'], cpuFixed: null, playerScaling: null },
    ult: { name: '夜の会議', type: 'Fight', usesMaxPerMatch: 1, timing: ['battle'], cpuFixed: null, playerScaling: null },
  },
  {
    id: makePlayerId('キョロゾー'),
    name: 'キョロゾー',
    origin: 'offer',
    role: PLAYER_ROLE.SUPPORT,
    costG: 50000,
    recommendedCorpRank: 50,
    unlockCorpRank: 40,
    stats: withRoleFlavor(makeOfferBaseStats(3), PLAYER_ROLE.SUPPORT),
    passive: { name: 'クリエイター', type: 'Passive', desc: '（後で効果詳細を確定）', effects: [] },
    ability: { name: 'ブラックローブ', type: 'Support', usesMaxPerMatch: 2, timing: ['battle'], cpuFixed: null, playerScaling: null },
    ult: { name: 'キョロちゃん', type: 'Support', usesMaxPerMatch: 1, timing: ['battle'], cpuFixed: null, playerScaling: null },
  },
]);

export const PLAYERS_ALL = Object.freeze([...PLAYERS_INITIAL, ...OFFER_PLAYERS]);

export function getPlayerById(id) {
  const key = String(id || '').trim();
  if (!key) return null;
  return PLAYERS_ALL.find((p) => p.id === key) || null;
}

export function getPlayerByName(name) {
  const n = String(name || '').trim();
  if (!n) return null;
  return PLAYERS_ALL.find((p) => p.name === n) || null;
}

export function listOfferPlayersByUnlockRank(corpRank) {
  const r = Number(corpRank || 0);
  return OFFER_PLAYERS.filter((p) => (p.unlockCorpRank ?? p.recommendedCorpRank ?? 0) <= r);
}
