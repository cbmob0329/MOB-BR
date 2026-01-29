/* =========================================================
   data_coachskills.js (FULL)
   - コーチスキル（消耗品） 全55種（R35 / SR15 / SSR5）
   - 5つまで装備可能（装備管理は state / ui 側で扱う）
   - Move補正のコーチスキルは禁止（絶対）
   ========================================================= */

(() => {
  'use strict';

  const CONST = window.DATA_CONST;
  if (!CONST) throw new Error('DATA_CONST not found. Load data_const.js before data_coachskills.js');

  // ---------------------------------------------------------
  // 効果フォーマット（統一）
  // statsAdd: 直接加算（HP, Mental, Aim, Agility, Technique, Support, Hunt, Synergy）
  // enemyAdd: 敵側に直接加算（基本マイナスで弱体化）
  // pctAdd  : %系（命中率 / 被弾率 / 回復量 / ダメージ等） ※シミュ側が解釈
  // special : 特殊効果フラグ
  //
  // NOTE:
  // - Move補正は絶対に入れない（FORBID）
  // - 「命中率」など%は、BATTLEの最終キャップに吸収される前提
  // ---------------------------------------------------------

  /** @type {Array<any>} */
  const SKILLS = [
    // =========================
    // SSR（5）
    // =========================
    {
      id: 'SSR1',
      rarity: 'SSR',
      name: 'チャンピオンロード',
      desc: '全員を底上げする万能型',
      statsAdd: { HP: 10, Mental: 6, Aim: 2, Agility: 2, Technique: 2, Support: 6, Hunt: 6, Synergy: 8 },
      enemyAdd: {},
      pctAdd: {},
      special: {},
    },
    {
      id: 'SSR2',
      rarity: 'SSR',
      name: '覇王の照準',
      desc: '撃ち合い特化。命中と技術をまとめて強化',
      statsAdd: { Aim: 4, Technique: 4, Mental: 4 },
      enemyAdd: { Aim: -2 },
      pctAdd: {},
      special: {},
    },
    {
      id: 'SSR3',
      rarity: 'SSR',
      name: '鉄壁の統率',
      desc: '安定特化。HPと連携で崩れにくくする（命中は少し下がる）',
      statsAdd: { HP: 15, Mental: 8, Support: 8, Synergy: 8, Aim: -1 },
      enemyAdd: {},
      pctAdd: {},
      special: {},
    },
    {
      id: 'SSR4',
      rarity: 'SSR',
      name: 'ハンティングウルフ',
      desc: 'キルチャンス増。狩り性能を強化して攻める',
      statsAdd: { Hunt: 12, Aim: 2, Technique: 3, Support: 4 },
      enemyAdd: {},
      pctAdd: {},
      special: {},
    },
    {
      id: 'SSR5',
      rarity: 'SSR',
      name: 'オール・ゾーン',
      desc: '連携を超強化。支援と噛み合いを最大化',
      statsAdd: { Synergy: 12, Support: 10, Mental: 6, Technique: 2 },
      enemyAdd: {},
      pctAdd: {},
      special: {},
    },

    // =========================
    // SR（15）
    // =========================
    {
      id: 'SR1',
      rarity: 'SR',
      name: 'ダブルアビリティ',
      desc: 'この試合、全員アビリティをもう1回追加で使える',
      statsAdd: {},
      enemyAdd: {},
      pctAdd: {},
      special: { abilityExtraUses: 1 },
    },
    {
      id: 'SR2',
      rarity: 'SR',
      name: '精密射撃指令',
      desc: '命中と火力を安定強化',
      statsAdd: { Aim: 3, Technique: 2 },
      enemyAdd: {},
      pctAdd: {},
      special: {},
    },
    {
      id: 'SR3',
      rarity: 'SR',
      name: 'エイム集中',
      desc: '集中力で命中を押し上げる',
      statsAdd: { Aim: 3, Mental: 4 },
      enemyAdd: {},
      pctAdd: {},
      special: {},
    },
    {
      id: 'SR4',
      rarity: 'SR',
      name: '技術研磨',
      desc: '技術で撃ち合いを強化',
      statsAdd: { Technique: 4, Aim: 1 },
      enemyAdd: {},
      pctAdd: {},
      special: {},
    },
    {
      id: 'SR5',
      rarity: 'SR',
      name: '反射神経ブースト',
      desc: '反応と回避を強化（機動戦向け）',
      statsAdd: { Agility: 4, Technique: 1 },
      enemyAdd: {},
      pctAdd: {},
      special: {},
    },
    {
      id: 'SR6',
      rarity: 'SR',
      name: 'メンタル強化',
      desc: '終盤に強くなる（粘りが出る）',
      statsAdd: { Mental: 8, Aim: 1 },
      enemyAdd: {},
      pctAdd: {},
      special: {},
    },
    {
      id: 'SR7',
      rarity: 'SR',
      name: 'サポート最優先',
      desc: '支援を強化してチームを立て直しやすくする',
      statsAdd: { Support: 8, Synergy: 4 },
      enemyAdd: {},
      pctAdd: {},
      special: {},
    },
    {
      id: 'SR8',
      rarity: 'SR',
      name: '連携最優先',
      desc: '噛み合いを強化して勝ち筋を作る',
      statsAdd: { Synergy: 8, Support: 4 },
      enemyAdd: {},
      pctAdd: {},
      special: {},
    },
    {
      id: 'SR9',
      rarity: 'SR',
      name: '狩りの号令',
      desc: 'キル狙いの動きが強くなる',
      statsAdd: { Hunt: 10, Aim: 1, Technique: 1 },
      enemyAdd: {},
      pctAdd: {},
      special: {},
    },
    {
      id: 'SR10',
      rarity: 'SR',
      name: '弱点解析',
      desc: '相手の弱点を突いて有利を作る',
      statsAdd: { Technique: 3 },
      enemyAdd: { Aim: -2 },
      pctAdd: {},
      special: {},
    },
    {
      id: 'SR11',
      rarity: 'SR',
      name: '妨害戦術',
      desc: '相手を弱体化して撃ち勝ちやすくする',
      statsAdd: { Mental: 2 },
      enemyAdd: { Aim: -4, Agility: -2 },
      pctAdd: {},
      special: {},
    },
    {
      id: 'SR12',
      rarity: 'SR',
      name: '粘りの指揮',
      desc: 'HPと精神で崩れにくくする',
      statsAdd: { HP: 25, Mental: 6, Support: 2 },
      enemyAdd: {},
      pctAdd: {},
      special: {},
    },
    {
      id: 'SR13',
      rarity: 'SR',
      name: '勝負勘',
      desc: '命中と噛み合いを少し上げる',
      statsAdd: { Mental: 6, Aim: 2, Synergy: 3 },
      enemyAdd: {},
      pctAdd: {},
      special: {},
    },
    {
      id: 'SR14',
      rarity: 'SR',
      name: '一撃必殺プラン',
      desc: '攻め特化（支援は少し下がる）',
      statsAdd: { Aim: 2, Technique: 3, Support: -2 },
      enemyAdd: {},
      pctAdd: {},
      special: {},
    },
    {
      id: 'SR15',
      rarity: 'SR',
      name: '全員仕事モード',
      desc: '全体をバランス良く底上げ',
      statsAdd: { Aim: 1, Agility: 1, Technique: 1, Mental: 4, Synergy: 4 },
      enemyAdd: {},
      pctAdd: {},
      special: {},
    },

    // =========================
    // R（35）
    // =========================
    // Aim系（7）
    { id: 'R1', rarity: 'R', name: 'アイサイト調整', desc: '命中が少し上がる', statsAdd: { Aim: 1 }, enemyAdd: {}, pctAdd: {}, special: {} },
    { id: 'R2', rarity: 'R', name: '照準安定化', desc: '命中が上がる', statsAdd: { Aim: 2 }, enemyAdd: {}, pctAdd: {}, special: {} },
    { id: 'R3', rarity: 'R', name: '一点集中', desc: '命中を強化する代わりに精神が少し下がる', statsAdd: { Aim: 3, Mental: -1 }, enemyAdd: {}, pctAdd: {}, special: {} },
    { id: 'R4', rarity: 'R', name: '援護射撃の合図', desc: '命中と支援を少し強化', statsAdd: { Aim: 2, Support: 1 }, enemyAdd: {}, pctAdd: {}, special: {} },
    { id: 'R5', rarity: 'R', name: '連携射撃', desc: '命中と連携を少し強化', statsAdd: { Aim: 2, Synergy: 1 }, enemyAdd: {}, pctAdd: {}, special: {} },
    { id: 'R6', rarity: 'R', name: '撃ち方の型', desc: '命中と技術を少し強化', statsAdd: { Aim: 1, Technique: 1 }, enemyAdd: {}, pctAdd: {}, special: {} },
    { id: 'R7', rarity: 'R', name: '狙い撃ちスイッチ', desc: '命中を少し上げつつ狩り性能を上げる', statsAdd: { Aim: 1, Hunt: 4 }, enemyAdd: {}, pctAdd: {}, special: {} },

    // Agility系（6）
    { id: 'R8', rarity: 'R', name: '反射強化', desc: '反応が少し上がる', statsAdd: { Agility: 1 }, enemyAdd: {}, pctAdd: {}, special: {} },
    { id: 'R9', rarity: 'R', name: 'クイックムーブ', desc: '反応が上がる', statsAdd: { Agility: 2 }, enemyAdd: {}, pctAdd: {}, special: {} },
    { id: 'R10', rarity: 'R', name: '瞬間回避', desc: '反応を強化する代わりに技術が少し下がる', statsAdd: { Agility: 3, Technique: -1 }, enemyAdd: {}, pctAdd: {}, special: {} },
    { id: 'R11', rarity: 'R', name: '落ち着いて回避', desc: '反応と精神を少し強化', statsAdd: { Agility: 2, Mental: 1 }, enemyAdd: {}, pctAdd: {}, special: {} },
    { id: 'R12', rarity: 'R', name: '動き撃ち練習', desc: '反応と命中を少し強化', statsAdd: { Agility: 1, Aim: 1 }, enemyAdd: {}, pctAdd: {}, special: {} },
    { id: 'R13', rarity: 'R', name: '息合わせステップ', desc: '反応を少し上げつつ連携が上がる', statsAdd: { Agility: 1, Synergy: 4 }, enemyAdd: {}, pctAdd: {}, special: {} },

    // Technique系（6）
    { id: 'R14', rarity: 'R', name: '技の基礎', desc: '技術が少し上がる', statsAdd: { Technique: 1 }, enemyAdd: {}, pctAdd: {}, special: {} },
    { id: 'R15', rarity: 'R', name: '技の積み上げ', desc: '技術が上がる', statsAdd: { Technique: 2 }, enemyAdd: {}, pctAdd: {}, special: {} },
    { id: 'R16', rarity: 'R', name: '職人モード', desc: '技術を強化する代わりに精神が少し下がる', statsAdd: { Technique: 3, Mental: -1 }, enemyAdd: {}, pctAdd: {}, special: {} },
    { id: 'R17', rarity: 'R', name: '弾の通し方', desc: '技術と命中を少し強化', statsAdd: { Technique: 2, Aim: 1 }, enemyAdd: {}, pctAdd: {}, special: {} },
    { id: 'R18', rarity: 'R', name: '支援の作法', desc: '技術を少し上げて支援が伸びる', statsAdd: { Technique: 1, Support: 4 }, enemyAdd: {}, pctAdd: {}, special: {} },
    { id: 'R19', rarity: 'R', name: '狩りの手順', desc: '技術を少し上げて狩り性能が伸びる', statsAdd: { Technique: 1, Hunt: 4 }, enemyAdd: {}, pctAdd: {}, special: {} },

    // Mental系（5）
    { id: 'R20', rarity: 'R', name: '平常心', desc: '精神が少し上がる', statsAdd: { Mental: 2 }, enemyAdd: {}, pctAdd: {}, special: {} },
    { id: 'R21', rarity: 'R', name: '気合いの集中', desc: '精神が上がるが命中が少し下がる', statsAdd: { Mental: 3, Aim: -1 }, enemyAdd: {}, pctAdd: {}, special: {} },
    { id: 'R22', rarity: 'R', name: '声かけ確認', desc: '精神と連携を強化', statsAdd: { Mental: 2, Synergy: 4 }, enemyAdd: {}, pctAdd: {}, special: {} },
    { id: 'R23', rarity: 'R', name: '切り替え指示', desc: '精神と支援を強化', statsAdd: { Mental: 2, Support: 4 }, enemyAdd: {}, pctAdd: {}, special: {} },
    { id: 'R24', rarity: 'R', name: '勝負根性', desc: '精神を強化する代わりに技術が少し下がる', statsAdd: { Mental: 4, Technique: -1 }, enemyAdd: {}, pctAdd: {}, special: {} },

    // Support系（5）
    { id: 'R25', rarity: 'R', name: 'カバー優先', desc: '支援が少し上がる', statsAdd: { Support: 3 }, enemyAdd: {}, pctAdd: {}, special: {} },
    { id: 'R26', rarity: 'R', name: '味方優先指令', desc: '支援が上がるが命中が少し下がる', statsAdd: { Support: 4, Aim: -1 }, enemyAdd: {}, pctAdd: {}, special: {} },
    { id: 'R27', rarity: 'R', name: 'フォロー連携', desc: '支援と連携を同時に強化', statsAdd: { Support: 3, Synergy: 4 }, enemyAdd: {}, pctAdd: {}, special: {} },
    { id: 'R28', rarity: 'R', name: '応急サポート', desc: '支援を少し上げつつHPも少し増える', statsAdd: { Support: 2, HP: 10 }, enemyAdd: {}, pctAdd: {}, special: {} },
    { id: 'R29', rarity: 'R', name: '支援集中', desc: '支援を強化する代わりに技術が少し下がる', statsAdd: { Support: 5, Technique: -1 }, enemyAdd: {}, pctAdd: {}, special: {} },

    // Hunt系（3）
    { id: 'R30', rarity: 'R', name: '索敵強化', desc: '狩り性能が上がる', statsAdd: { Hunt: 6 }, enemyAdd: {}, pctAdd: {}, special: {} },
    { id: 'R31', rarity: 'R', name: '獲物追跡', desc: '狩り性能が上がるが精神が少し下がる', statsAdd: { Hunt: 8, Mental: -1 }, enemyAdd: {}, pctAdd: {}, special: {} },
    { id: 'R32', rarity: 'R', name: '狩りの精度', desc: '狩り性能と技術を少し強化', statsAdd: { Hunt: 6, Technique: 1 }, enemyAdd: {}, pctAdd: {}, special: {} },

    // Synergy系（3）
    { id: 'R33', rarity: 'R', name: '連携確認', desc: '連携が上がる', statsAdd: { Synergy: 6 }, enemyAdd: {}, pctAdd: {}, special: {} },
    { id: 'R34', rarity: 'R', name: '噛み合い強化', desc: '連携が上がるが命中が少し下がる', statsAdd: { Synergy: 8, Aim: -1 }, enemyAdd: {}, pctAdd: {}, special: {} },
    { id: 'R35', rarity: 'R', name: '息合わせコール', desc: '連携を上げつつ支援も少し上がる', statsAdd: { Synergy: 6, Support: 1 }, enemyAdd: {}, pctAdd: {}, special: {} },
  ];

  // ---------------------------------------------------------
  // 禁止チェック（Move補正）
  // ---------------------------------------------------------
  function validateNoMoveMods(skill) {
    const ban = CONST.COACH_SKILL_RULES?.FORBID_MOVE_MOD;
    if (!ban) return;

    const all = [
      skill.statsAdd || {},
      skill.enemyAdd || {},
      skill.pctAdd || {},
      skill.special || {},
    ];

    for (const obj of all) {
      for (const k of Object.keys(obj)) {
        if (String(k).toLowerCase().includes('move')) {
          throw new Error(`Forbidden Move modifier found in coach skill: ${skill.id} ${skill.name}`);
        }
      }
    }
  }

  for (const s of SKILLS) validateNoMoveMods(s);

  // ---------------------------------------------------------
  // 参照用ユーティリティ
  // ---------------------------------------------------------
  const byId = Object.create(null);
  const pools = { R: [], SR: [], SSR: [] };

  for (const s of SKILLS) {
    if (byId[s.id]) throw new Error('Duplicate coach skill id: ' + s.id);
    byId[s.id] = s;
    if (!pools[s.rarity]) throw new Error('Unknown rarity: ' + s.rarity);
    pools[s.rarity].push(s.id);
  }

  // 公開
  window.DATA_COACHSKILLS = Object.freeze({
    list: Object.freeze(SKILLS.slice()),
    byId: Object.freeze(byId),
    pools: Object.freeze({
      R: Object.freeze(pools.R.slice()),
      SR: Object.freeze(pools.SR.slice()),
      SSR: Object.freeze(pools.SSR.slice()),
    }),
    rarityOrder: Object.freeze(['R', 'SR', 'SSR']),
  });
})();
