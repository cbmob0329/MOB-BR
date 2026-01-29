// data_coachskills.js
// Coach Skill Gacha master data (ES Modules)
// - 全55種（SSR5 / SR15 / R35）
// - Move補正のコーチスキルは禁止（仕様）
// Source: アイテム.txt（コーチスキルガチャ全55種）

export const COACH_EQUIP_MAX = 5; // 5つまで装備可能（UI/ルール側で使用）

export const COACH_RARITY = {
  SSR: "SSR",
  SR: "SR",
  R: "R",
};

/**
 * 効果の扱い方（ゲーム側の実装想定）
 * - statsAdd: 自チーム全員のステ補正（試合中のみ）
 * - enemyDebuff: 敵全体へのデバフ（試合中のみ）
 * - special: ルール特化（例：アビリティ回数+1）
 *
 * 注意：
 * - ここでは「定義」だけ。実際にどう適用するかは sim_battle / sim_tournament_core 側。
 */

export const COACH_SKILLS = [
  // --------------------
  // SSR (5)
  // --------------------
  {
    id: "SSR1",
    rarity: COACH_RARITY.SSR,
    name: "チャンピオンロード",
    desc: "全員を底上げする万能型",
    effect: {
      statsAdd: { hp: 10, mental: 6, aim: 2, agility: 2, technique: 2, support: 6, hunt: 6, synergy: 8 },
      enemyDebuff: {},
      special: {},
    },
  },
  {
    id: "SSR2",
    rarity: COACH_RARITY.SSR,
    name: "覇王の照準",
    desc: "撃ち合い特化。命中と技術をまとめて強化",
    effect: {
      statsAdd: { aim: 4, technique: 4, mental: 4 },
      enemyDebuff: { aim: -2 },
      special: {},
    },
  },
  {
    id: "SSR3",
    rarity: COACH_RARITY.SSR,
    name: "鉄壁の統率",
    desc: "安定特化。HPと連携で崩れにくくする（命中は少し下がる）",
    effect: {
      statsAdd: { hp: 15, mental: 8, support: 8, synergy: 8, aim: -1 },
      enemyDebuff: {},
      special: {},
    },
  },
  {
    id: "SSR4",
    rarity: COACH_RARITY.SSR,
    name: "ハンティングウルフ",
    desc: "キルチャンス増。狩り性能を強化して攻める",
    effect: {
      statsAdd: { hunt: 12, aim: 2, technique: 3, support: 4 },
      enemyDebuff: {},
      special: {},
    },
  },
  {
    id: "SSR5",
    rarity: COACH_RARITY.SSR,
    name: "オール・ゾーン",
    desc: "連携を超強化。支援と噛み合いを最大化",
    effect: {
      statsAdd: { synergy: 12, support: 10, mental: 6, technique: 2 },
      enemyDebuff: {},
      special: {},
    },
  },

  // --------------------
  // SR (15)
  // --------------------
  {
    id: "SR1",
    rarity: COACH_RARITY.SR,
    name: "ダブルアビリティ",
    desc: "この試合、全員アビリティをもう1回追加で使える",
    effect: {
      statsAdd: {},
      enemyDebuff: {},
      special: { abilityUsesAdd: 1 },
    },
  },
  {
    id: "SR2",
    rarity: COACH_RARITY.SR,
    name: "精密射撃指令",
    desc: "命中と火力を安定強化",
    effect: {
      statsAdd: { aim: 3, technique: 2 },
      enemyDebuff: {},
      special: {},
    },
  },
  {
    id: "SR3",
    rarity: COACH_RARITY.SR,
    name: "エイム集中",
    desc: "集中力で命中を押し上げる",
    effect: {
      statsAdd: { aim: 3, mental: 4 },
      enemyDebuff: {},
      special: {},
    },
  },
  {
    id: "SR4",
    rarity: COACH_RARITY.SR,
    name: "技術研磨",
    desc: "技術で撃ち合いを強化",
    effect: {
      statsAdd: { technique: 4, aim: 1 },
      enemyDebuff: {},
      special: {},
    },
  },
  {
    id: "SR5",
    rarity: COACH_RARITY.SR,
    name: "反射神経ブースト",
    desc: "反応と回避を強化（機動戦向け）",
    effect: {
      statsAdd: { agility: 4, technique: 1 },
      enemyDebuff: {},
      special: {},
    },
  },
  {
    id: "SR6",
    rarity: COACH_RARITY.SR,
    name: "メンタル強化",
    desc: "終盤に強くなる（粘りが出る）",
    effect: {
      statsAdd: { mental: 8, aim: 1 },
      enemyDebuff: {},
      special: {},
    },
  },
  {
    id: "SR7",
    rarity: COACH_RARITY.SR,
    name: "サポート最優先",
    desc: "支援を強化してチームを立て直しやすくする",
    effect: {
      statsAdd: { support: 8, synergy: 4 },
      enemyDebuff: {},
      special: {},
    },
  },
  {
    id: "SR8",
    rarity: COACH_RARITY.SR,
    name: "連携最優先",
    desc: "噛み合いを強化して勝ち筋を作る",
    effect: {
      statsAdd: { synergy: 8, support: 4 },
      enemyDebuff: {},
      special: {},
    },
  },
  {
    id: "SR9",
    rarity: COACH_RARITY.SR,
    name: "狩りの号令",
    desc: "キル狙いの動きが強くなる",
    effect: {
      statsAdd: { hunt: 10, aim: 1, technique: 1 },
      enemyDebuff: {},
      special: {},
    },
  },
  {
    id: "SR10",
    rarity: COACH_RARITY.SR,
    name: "弱点解析",
    desc: "相手の弱点を突いて有利を作る",
    effect: {
      statsAdd: { technique: 3 },
      enemyDebuff: { aim: -2 },
      special: {},
    },
  },
  {
    id: "SR11",
    rarity: COACH_RARITY.SR,
    name: "妨害戦術",
    desc: "相手を弱体化して撃ち勝ちやすくする",
    effect: {
      statsAdd: { mental: 2 },
      enemyDebuff: { aim: -4, agility: -2 },
      special: {},
    },
  },
  {
    id: "SR12",
    rarity: COACH_RARITY.SR,
    name: "粘りの指揮",
    desc: "HPと精神で崩れにくくする",
    effect: {
      statsAdd: { hp: 25, mental: 6, support: 2 },
      enemyDebuff: {},
      special: {},
    },
  },
  {
    id: "SR13",
    rarity: COACH_RARITY.SR,
    name: "勝負勘",
    desc: "命中と噛み合いを少し上げる",
    effect: {
      statsAdd: { mental: 6, aim: 2, synergy: 3 },
      enemyDebuff: {},
      special: {},
    },
  },
  {
    id: "SR14",
    rarity: COACH_RARITY.SR,
    name: "一撃必殺プラン",
    desc: "攻め特化（支援は少し下がる）",
    effect: {
      statsAdd: { aim: 2, technique: 3, support: -2 },
      enemyDebuff: {},
      special: {},
    },
  },
  {
    id: "SR15",
    rarity: COACH_RARITY.SR,
    name: "全員仕事モード",
    desc: "全体をバランス良く底上げ",
    effect: {
      statsAdd: { aim: 1, agility: 1, technique: 1, mental: 4, synergy: 4 },
      enemyDebuff: {},
      special: {},
    },
  },

  // --------------------
  // R (35)
  // --------------------
  // Aim系（7）
  { id: "R1", rarity: COACH_RARITY.R, name: "アイサイト調整", desc: "命中が少し上がる", effect: { statsAdd: { aim: 1 }, enemyDebuff: {}, special: {} } },
  { id: "R2", rarity: COACH_RARITY.R, name: "照準安定化", desc: "命中が上がる", effect: { statsAdd: { aim: 2 }, enemyDebuff: {}, special: {} } },
  { id: "R3", rarity: COACH_RARITY.R, name: "一点集中", desc: "命中を強化する代わりに精神が少し下がる", effect: { statsAdd: { aim: 3, mental: -1 }, enemyDebuff: {}, special: {} } },
  { id: "R4", rarity: COACH_RARITY.R, name: "援護射撃の合図", desc: "命中と支援を少し強化", effect: { statsAdd: { aim: 2, support: 1 }, enemyDebuff: {}, special: {} } },
  { id: "R5", rarity: COACH_RARITY.R, name: "連携射撃", desc: "命中と連携を少し強化", effect: { statsAdd: { aim: 2, synergy: 1 }, enemyDebuff: {}, special: {} } },
  { id: "R6", rarity: COACH_RARITY.R, name: "撃ち方の型", desc: "命中と技術を少し強化", effect: { statsAdd: { aim: 1, technique: 1 }, enemyDebuff: {}, special: {} } },
  { id: "R7", rarity: COACH_RARITY.R, name: "狙い撃ちスイッチ", desc: "命中を少し上げつつ狩り性能を上げる", effect: { statsAdd: { aim: 1, hunt: 4 }, enemyDebuff: {}, special: {} } },

  // Agility系（6）
  { id: "R8", rarity: COACH_RARITY.R, name: "反射強化", desc: "反応が少し上がる", effect: { statsAdd: { agility: 1 }, enemyDebuff: {}, special: {} } },
  { id: "R9", rarity: COACH_RARITY.R, name: "クイックムーブ", desc: "反応が上がる", effect: { statsAdd: { agility: 2 }, enemyDebuff: {}, special: {} } },
  { id: "R10", rarity: COACH_RARITY.R, name: "瞬間回避", desc: "反応を強化する代わりに技術が少し下がる", effect: { statsAdd: { agility: 3, technique: -1 }, enemyDebuff: {}, special: {} } },
  { id: "R11", rarity: COACH_RARITY.R, name: "落ち着いて回避", desc: "反応と精神を少し強化", effect: { statsAdd: { agility: 2, mental: 1 }, enemyDebuff: {}, special: {} } },
  { id: "R12", rarity: COACH_RARITY.R, name: "動き撃ち練習", desc: "反応と命中を少し強化", effect: { statsAdd: { agility: 1, aim: 1 }, enemyDebuff: {}, special: {} } },
  { id: "R13", rarity: COACH_RARITY.R, name: "息合わせステップ", desc: "反応を少し上げつつ連携が上がる", effect: { statsAdd: { agility: 1, synergy: 4 }, enemyDebuff: {}, special: {} } },

  // Technique系（6）
  { id: "R14", rarity: COACH_RARITY.R, name: "技の基礎", desc: "技術が少し上がる", effect: { statsAdd: { technique: 1 }, enemyDebuff: {}, special: {} } },
  { id: "R15", rarity: COACH_RARITY.R, name: "技の積み上げ", desc: "技術が上がる", effect: { statsAdd: { technique: 2 }, enemyDebuff: {}, special: {} } },
  { id: "R16", rarity: COACH_RARITY.R, name: "職人モード", desc: "技術を強化する代わりに精神が少し下がる", effect: { statsAdd: { technique: 3, mental: -1 }, enemyDebuff: {}, special: {} } },
  { id: "R17", rarity: COACH_RARITY.R, name: "弾の通し方", desc: "技術と命中を少し強化", effect: { statsAdd: { technique: 2, aim: 1 }, enemyDebuff: {}, special: {} } },
  { id: "R18", rarity: COACH_RARITY.R, name: "支援の作法", desc: "技術を少し上げて支援が伸びる", effect: { statsAdd: { technique: 1, support: 4 }, enemyDebuff: {}, special: {} } },
  { id: "R19", rarity: COACH_RARITY.R, name: "狩りの手順", desc: "技術を少し上げて狩り性能が伸びる", effect: { statsAdd: { technique: 1, hunt: 4 }, enemyDebuff: {}, special: {} } },

  // Mental系（5）
  { id: "R20", rarity: COACH_RARITY.R, name: "平常心", desc: "精神が少し上がる", effect: { statsAdd: { mental: 2 }, enemyDebuff: {}, special: {} } },
  { id: "R21", rarity: COACH_RARITY.R, name: "気合いの集中", desc: "精神が上がるが命中が少し下がる", effect: { statsAdd: { mental: 3, aim: -1 }, enemyDebuff: {}, special: {} } },
  { id: "R22", rarity: COACH_RARITY.R, name: "声かけ確認", desc: "精神と連携を強化", effect: { statsAdd: { mental: 2, synergy: 4 }, enemyDebuff: {}, special: {} } },
  { id: "R23", rarity: COACH_RARITY.R, name: "切り替え指示", desc: "精神と支援を強化", effect: { statsAdd: { mental: 2, support: 4 }, enemyDebuff: {}, special: {} } },
  { id: "R24", rarity: COACH_RARITY.R, name: "勝負根性", desc: "精神を強化する代わりに技術が少し下がる", effect: { statsAdd: { mental: 4, technique: -1 }, enemyDebuff: {}, special: {} } },

  // Support系（5）
  { id: "R25", rarity: COACH_RARITY.R, name: "カバー優先", desc: "支援が少し上がる", effect: { statsAdd: { support: 3 }, enemyDebuff: {}, special: {} } },
  { id: "R26", rarity: COACH_RARITY.R, name: "味方優先指令", desc: "支援が上がるが命中が少し下がる", effect: { statsAdd: { support: 4, aim: -1 }, enemyDebuff: {}, special: {} } },
  { id: "R27", rarity: COACH_RARITY.R, name: "フォロー連携", desc: "支援と連携を同時に強化", effect: { statsAdd: { support: 3, synergy: 4 }, enemyDebuff: {}, special: {} } },
  { id: "R28", rarity: COACH_RARITY.R, name: "応急サポート", desc: "支援を少し上げつつHPも少し増える", effect: { statsAdd: { support: 2, hp: 10 }, enemyDebuff: {}, special: {} } },
  { id: "R29", rarity: COACH_RARITY.R, name: "支援集中", desc: "支援を強化する代わりに技術が少し下がる", effect: { statsAdd: { support: 5, technique: -1 }, enemyDebuff: {}, special: {} } },

  // Hunt系（3）
  { id: "R30", rarity: COACH_RARITY.R, name: "索敵強化", desc: "狩り性能が上がる", effect: { statsAdd: { hunt: 6 }, enemyDebuff: {}, special: {} } },
  { id: "R31", rarity: COACH_RARITY.R, name: "獲物追跡", desc: "狩り性能が上がるが精神が少し下がる", effect: { statsAdd: { hunt: 8, mental: -1 }, enemyDebuff: {}, special: {} } },
  { id: "R32", rarity: COACH_RARITY.R, name: "狩りの精度", desc: "狩り性能と技術を少し強化", effect: { statsAdd: { hunt: 6, technique: 1 }, enemyDebuff: {}, special: {} } },

  // Synergy系（3）
  { id: "R33", rarity: COACH_RARITY.R, name: "連携確認", desc: "連携が上がる", effect: { statsAdd: { synergy: 6 }, enemyDebuff: {}, special: {} } },
  { id: "R34", rarity: COACH_RARITY.R, name: "噛み合い強化", desc: "連携が上がるが命中が少し下がる", effect: { statsAdd: { synergy: 8, aim: -1 }, enemyDebuff: {}, special: {} } },
  { id: "R35", rarity: COACH_RARITY.R, name: "息合わせコール", desc: "連携を上げつつ支援も少し上がる", effect: { statsAdd: { synergy: 6, support: 1 }, enemyDebuff: {}, special: {} } },
];

// --------------------
// Indexes / helpers
// --------------------
const byId = new Map(COACH_SKILLS.map((s) => [s.id, s]));
const byRarity = {
  SSR: COACH_SKILLS.filter((s) => s.rarity === COACH_RARITY.SSR),
  SR: COACH_SKILLS.filter((s) => s.rarity === COACH_RARITY.SR),
  R: COACH_SKILLS.filter((s) => s.rarity === COACH_RARITY.R),
};

export function getCoachSkillById(id) {
  return byId.get(id) || null;
}

export function listCoachSkills() {
  return COACH_SKILLS.slice();
}

export function listCoachSkillsByRarity(rarity) {
  return (byRarity[rarity] || []).slice();
}

/**
 * Gacha roll (rate is adjustable)
 * ※レートは仕様に明記が無いので、ここは “デフォルト値” として置く。
 * game.js / ui.js 側で好きに差し替え可能。
 */
export const DEFAULT_COACH_GACHA_RATES = {
  SSR: 0.05,
  SR: 0.25,
  R: 0.70,
};

function pickOne(arr, rng) {
  if (!arr || arr.length === 0) return null;
  const i = Math.floor(rng() * arr.length);
  return arr[i] || null;
}

export function rollCoachSkill(rng = Math.random, rates = DEFAULT_COACH_GACHA_RATES) {
  const r = rng();
  const pSSR = rates.SSR ?? 0;
  const pSR = rates.SR ?? 0;

  if (r < pSSR) return pickOne(byRarity.SSR, rng);
  if (r < pSSR + pSR) return pickOne(byRarity.SR, rng);
  return pickOne(byRarity.R, rng);
}
