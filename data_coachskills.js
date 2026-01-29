/* =====================================================
   data_coachskills.js  (FULL)
   MOB Tournament Simulation
   コーチスキル55種（SSR5 / SR15 / R35）
   - Move補正は禁止（このデータはMove直接上昇なし）
   - 効果は battle/sim 側で解釈して適用
   ===================================================== */

window.DATA_COACHSKILLS = (function () {

  // effectType の方針：
  // - addStat: ステータス加算（HP/Mental/Aim/Agility/Technique/Support/Hunt/Synergy/Armor）
  // - addRate: 率の加算（hitRate, critRate, dmgRate, evadeRate, healRate 等）
  // - enemyDebuff: 敵側への弱体（enemyAim, enemyAgility, enemyHitRate, enemyHealRate 等）
  // - special: 特殊（abilityExtraUse 等）
  //
  // ※実際の適用は sim_battle.js / sim_rules_* で行う。

  const SKILLS = [];

  function push(skill) {
    SKILLS.push(skill);
  }

  /* =========================
     SSR (5)
     ========================= */

  push({
    id: 'SSR1_CHAMPION_ROAD',
    rarity: 'SSR',
    name: 'チャンピオンロード',
    desc: '全員を底上げする万能型',
    effects: [
      { type: 'addStat', stat: 'HP', value: 10 },
      { type: 'addStat', stat: 'Mental', value: 6 },
      { type: 'addStat', stat: 'Aim', value: 2 },
      { type: 'addStat', stat: 'Agility', value: 2 },
      { type: 'addStat', stat: 'Technique', value: 2 },
      { type: 'addStat', stat: 'Support', value: 6 },
      { type: 'addStat', stat: 'Hunt', value: 6 },
      { type: 'addStat', stat: 'Synergy', value: 8 }
    ]
  });

  push({
    id: 'SSR2_HAOU_NO_SHOUJUN',
    rarity: 'SSR',
    name: '覇王の照準',
    desc: '撃ち合い特化。命中と技術をまとめて強化',
    effects: [
      { type: 'addStat', stat: 'Aim', value: 4 },
      { type: 'addStat', stat: 'Technique', value: 4 },
      { type: 'addStat', stat: 'Mental', value: 4 },
      { type: 'enemyDebuff', stat: 'enemyAim', value: -2 }
    ]
  });

  push({
    id: 'SSR3_TEPPEKI_NO_TOUSOTSU',
    rarity: 'SSR',
    name: '鉄壁の統率',
    desc: '安定特化。HPと連携で崩れにくくする（命中は少し下がる）',
    effects: [
      { type: 'addStat', stat: 'HP', value: 15 },
      { type: 'addStat', stat: 'Mental', value: 8 },
      { type: 'addStat', stat: 'Support', value: 8 },
      { type: 'addStat', stat: 'Synergy', value: 8 },
      { type: 'addStat', stat: 'Aim', value: -1 }
    ]
  });

  push({
    id: 'SSR4_HUNTING_WOLF',
    rarity: 'SSR',
    name: 'ハンティングウルフ',
    desc: 'キルチャンス増。狩り性能を強化して攻める',
    effects: [
      { type: 'addStat', stat: 'Hunt', value: 12 },
      { type: 'addStat', stat: 'Aim', value: 2 },
      { type: 'addStat', stat: 'Technique', value: 3 },
      { type: 'addStat', stat: 'Support', value: 4 }
    ]
  });

  push({
    id: 'SSR5_ALL_ZONE',
    rarity: 'SSR',
    name: 'オール・ゾーン',
    desc: '連携を超強化。支援と噛み合いを最大化',
    effects: [
      { type: 'addStat', stat: 'Synergy', value: 12 },
      { type: 'addStat', stat: 'Support', value: 10 },
      { type: 'addStat', stat: 'Mental', value: 6 },
      { type: 'addStat', stat: 'Technique', value: 2 }
    ]
  });

  /* =========================
     SR (15)
     ========================= */

  push({
    id: 'SR1_DOUBLE_ABILITY',
    rarity: 'SR',
    name: 'ダブルアビリティ',
    desc: 'この試合、全員アビリティをもう1回追加で使える',
    effects: [
      { type: 'special', key: 'abilityExtraUse', value: 1 }
    ]
  });

  push({
    id: 'SR2_SEIMITSU_SHAGEKI',
    rarity: 'SR',
    name: '精密射撃指令',
    desc: '命中と火力を安定強化',
    effects: [
      { type: 'addStat', stat: 'Aim', value: 3 },
      { type: 'addStat', stat: 'Technique', value: 2 }
    ]
  });

  push({
    id: 'SR3_AIM_SHUCHU',
    rarity: 'SR',
    name: 'エイム集中',
    desc: '集中力で命中を押し上げる',
    effects: [
      { type: 'addStat', stat: 'Aim', value: 3 },
      { type: 'addStat', stat: 'Mental', value: 4 }
    ]
  });

  push({
    id: 'SR4_GIJUTSU_KENMA',
    rarity: 'SR',
    name: '技術研磨',
    desc: '技術で撃ち合いを強化',
    effects: [
      { type: 'addStat', stat: 'Technique', value: 4 },
      { type: 'addStat', stat: 'Aim', value: 1 }
    ]
  });

  push({
    id: 'SR5_HANSHINKEI_BOOST',
    rarity: 'SR',
    name: '反射神経ブースト',
    desc: '反応と回避を強化（機動戦向け）',
    effects: [
      { type: 'addStat', stat: 'Agility', value: 4 },
      { type: 'addStat', stat: 'Technique', value: 1 }
    ]
  });

  push({
    id: 'SR6_MENTAL_KYOKA',
    rarity: 'SR',
    name: 'メンタル強化',
    desc: '終盤に強くなる（粘りが出る）',
    effects: [
      { type: 'addStat', stat: 'Mental', value: 8 },
      { type: 'addStat', stat: 'Aim', value: 1 }
    ]
  });

  push({
    id: 'SR7_SUPPORT_SAIYUSEN',
    rarity: 'SR',
    name: 'サポート最優先',
    desc: '支援を強化してチームを立て直しやすくする',
    effects: [
      { type: 'addStat', stat: 'Support', value: 8 },
      { type: 'addStat', stat: 'Synergy', value: 4 }
    ]
  });

  push({
    id: 'SR8_SYNERGY_SAIYUSEN',
    rarity: 'SR',
    name: '連携最優先',
    desc: '噛み合いを強化して勝ち筋を作る',
    effects: [
      { type: 'addStat', stat: 'Synergy', value: 8 },
      { type: 'addStat', stat: 'Support', value: 4 }
    ]
  });

  push({
    id: 'SR9_KARI_NO_GOREI',
    rarity: 'SR',
    name: '狩りの号令',
    desc: 'キル狙いの動きが強くなる',
    effects: [
      { type: 'addStat', stat: 'Hunt', value: 10 },
      { type: 'addStat', stat: 'Aim', value: 1 },
      { type: 'addStat', stat: 'Technique', value: 1 }
    ]
  });

  push({
    id: 'SR10_JAKUTEN_KAISEKI',
    rarity: 'SR',
    name: '弱点解析',
    desc: '相手の弱点を突いて有利を作る',
    effects: [
      { type: 'addStat', stat: 'Technique', value: 3 },
      { type: 'enemyDebuff', stat: 'enemyAim', value: -2 }
    ]
  });

  push({
    id: 'SR11_BOUGAI_SENJUTSU',
    rarity: 'SR',
    name: '妨害戦術',
    desc: '相手を弱体化して撃ち勝ちやすくする',
    effects: [
      { type: 'enemyDebuff', stat: 'enemyAim', value: -4 },
      { type: 'enemyDebuff', stat: 'enemyAgility', value: -2 },
      { type: 'addStat', stat: 'Mental', value: 2 }
    ]
  });

  push({
    id: 'SR12_NEBARI_NO_SHIKI',
    rarity: 'SR',
    name: '粘りの指揮',
    desc: 'HPと精神で崩れにくくする',
    effects: [
      { type: 'addStat', stat: 'HP', value: 25 },
      { type: 'addStat', stat: 'Mental', value: 6 },
      { type: 'addStat', stat: 'Support', value: 2 }
    ]
  });

  push({
    id: 'SR13_SHOUBUKAN',
    rarity: 'SR',
    name: '勝負勘',
    desc: '命中と噛み合いを少し上げる',
    effects: [
      { type: 'addStat', stat: 'Mental', value: 6 },
      { type: 'addStat', stat: 'Aim', value: 2 },
      { type: 'addStat', stat: 'Synergy', value: 3 }
    ]
  });

  push({
    id: 'SR14_ICHIGEKI_HISSATSU_PLAN',
    rarity: 'SR',
    name: '一撃必殺プラン',
    desc: '攻め特化（支援は少し下がる）',
    effects: [
      { type: 'addStat', stat: 'Aim', value: 2 },
      { type: 'addStat', stat: 'Technique', value: 3 },
      { type: 'addStat', stat: 'Support', value: -2 }
    ]
  });

  push({
    id: 'SR15_ZENIN_SHIGOTO_MODE',
    rarity: 'SR',
    name: '全員仕事モード',
    desc: '全体をバランス良く底上げ',
    effects: [
      { type: 'addStat', stat: 'Aim', value: 1 },
      { type: 'addStat', stat: 'Agility', value: 1 },
      { type: 'addStat', stat: 'Technique', value: 1 },
      { type: 'addStat', stat: 'Mental', value: 4 },
      { type: 'addStat', stat: 'Synergy', value: 4 }
    ]
  });

  /* =========================
     R (35)
     ========================= */

  // Aim系（7）
  push({ id:'R1_EYESIGHT', rarity:'R', name:'アイサイト調整', desc:'命中が少し上がる', effects:[{type:'addStat', stat:'Aim', value:1}] });
  push({ id:'R2_SHOUJUN_ANTEI', rarity:'R', name:'照準安定化', desc:'命中が上がる', effects:[{type:'addStat', stat:'Aim', value:2}] });
  push({ id:'R3_ITEN_SHUCHU', rarity:'R', name:'一点集中', desc:'命中を強化する代わりに精神が少し下がる', effects:[{type:'addStat', stat:'Aim', value:3},{type:'addStat', stat:'Mental', value:-1}] });
  push({ id:'R4_ENGO_SHAGEKI', rarity:'R', name:'援護射撃の合図', desc:'命中と支援を少し強化', effects:[{type:'addStat', stat:'Aim', value:2},{type:'addStat', stat:'Support', value:1}] });
  push({ id:'R5_RENKEI_SHAGEKI', rarity:'R', name:'連携射撃', desc:'命中と連携を少し強化', effects:[{type:'addStat', stat:'Aim', value:2},{type:'addStat', stat:'Synergy', value:1}] });
  push({ id:'R6_UCHIKATA_NO_KATA', rarity:'R', name:'撃ち方の型', desc:'命中と技術を少し強化', effects:[{type:'addStat', stat:'Aim', value:1},{type:'addStat', stat:'Technique', value:1}] });
  push({ id:'R7_NERAU_SWITCH', rarity:'R', name:'狙い撃ちスイッチ', desc:'命中を少し上げつつ狩り性能を上げる', effects:[{type:'addStat', stat:'Aim', value:1},{type:'addStat', stat:'Hunt', value:4}] });

  // Agility系（6）
  push({ id:'R8_HANSHIN', rarity:'R', name:'反射強化', desc:'反応が少し上がる', effects:[{type:'addStat', stat:'Agility', value:1}] });
  push({ id:'R9_QUICK_MOVE', rarity:'R', name:'クイックムーブ', desc:'反応が上がる', effects:[{type:'addStat', stat:'Agility', value:2}] });
  push({ id:'R10_SHUNKAN_KAIHI', rarity:'R', name:'瞬間回避', desc:'反応を強化する代わりに技術が少し下がる', effects:[{type:'addStat', stat:'Agility', value:3},{type:'addStat', stat:'Technique', value:-1}] });
  push({ id:'R11_OCHITSUITE_KAIHI', rarity:'R', name:'落ち着いて回避', desc:'反応と精神を少し強化', effects:[{type:'addStat', stat:'Agility', value:2},{type:'addStat', stat:'Mental', value:1}] });
  push({ id:'R12_UGOKIUCHI', rarity:'R', name:'動き撃ち練習', desc:'反応と命中を少し強化', effects:[{type:'addStat', stat:'Agility', value:1},{type:'addStat', stat:'Aim', value:1}] });
  push({ id:'R13_IKIAWASE_STEP', rarity:'R', name:'息合わせステップ', desc:'反応を少し上げつつ連携が上がる', effects:[{type:'addStat', stat:'Agility', value:1},{type:'addStat', stat:'Synergy', value:4}] });

  // Technique系（6）
  push({ id:'R14_GI_NO_KISO', rarity:'R', name:'技の基礎', desc:'技術が少し上がる', effects:[{type:'addStat', stat:'Technique', value:1}] });
  push({ id:'R15_GI_NO_TSUMIAGE', rarity:'R', name:'技の積み上げ', desc:'技術が上がる', effects:[{type:'addStat', stat:'Technique', value:2}] });
  push({ id:'R16_SHOKUNIN_MODE', rarity:'R', name:'職人モード', desc:'技術を強化する代わりに精神が少し下がる', effects:[{type:'addStat', stat:'Technique', value:3},{type:'addStat', stat:'Mental', value:-1}] });
  push({ id:'R17_TAMA_NO_TOOSHIKATA', rarity:'R', name:'弾の通し方', desc:'技術と命中を少し強化', effects:[{type:'addStat', stat:'Technique', value:2},{type:'addStat', stat:'Aim', value:1}] });
  push({ id:'R18_SHIEN_NO_SAHOU', rarity:'R', name:'支援の作法', desc:'技術を少し上げて支援が伸びる', effects:[{type:'addStat', stat:'Technique', value:1},{type:'addStat', stat:'Support', value:4}] });
  push({ id:'R19_KARI_NO_TEUJUN', rarity:'R', name:'狩りの手順', desc:'技術を少し上げて狩り性能が伸びる', effects:[{type:'addStat', stat:'Technique', value:1},{type:'addStat', stat:'Hunt', value:4}] });

  // Mental系（5）
  push({ id:'R20_HEIJOSHIN', rarity:'R', name:'平常心', desc:'精神が少し上がる', effects:[{type:'addStat', stat:'Mental', value:2}] });
  push({ id:'R21_KIAI_SHUCHU', rarity:'R', name:'気合いの集中', desc:'精神が上がるが命中が少し下がる', effects:[{type:'addStat', stat:'Mental', value:3},{type:'addStat', stat:'Aim', value:-1}] });
  push({ id:'R22_KOEKAKE_KAKUNIN', rarity:'R', name:'声かけ確認', desc:'精神と連携を強化', effects:[{type:'addStat', stat:'Mental', value:2},{type:'addStat', stat:'Synergy', value:4}] });
  push({ id:'R23_KIRIKAE_SHIJI', rarity:'R', name:'切り替え指示', desc:'精神と支援を強化', effects:[{type:'addStat', stat:'Mental', value:2},{type:'addStat', stat:'Support', value:4}] });
  push({ id:'R24_SHOUBU_KONJOU', rarity:'R', name:'勝負根性', desc:'精神を強化する代わりに技術が少し下がる', effects:[{type:'addStat', stat:'Mental', value:4},{type:'addStat', stat:'Technique', value:-1}] });

  // Support系（5）
  push({ id:'R25_COVER_YUUSEN', rarity:'R', name:'カバー優先', desc:'支援が少し上がる', effects:[{type:'addStat', stat:'Support', value:3}] });
  push({ id:'R26_MIKATA_YUUSEN', rarity:'R', name:'味方優先指令', desc:'支援が上がるが命中が少し下がる', effects:[{type:'addStat', stat:'Support', value:4},{type:'addStat', stat:'Aim', value:-1}] });
  push({ id:'R27_FOLLOW_RENKEI', rarity:'R', name:'フォロー連携', desc:'支援と連携を同時に強化', effects:[{type:'addStat', stat:'Support', value:3},{type:'addStat', stat:'Synergy', value:4}] });
  push({ id:'R28_OUKYU_SUPPORT', rarity:'R', name:'応急サポート', desc:'支援を少し上げつつHPも少し増える', effects:[{type:'addStat', stat:'Support', value:2},{type:'addStat', stat:'HP', value:10}] });
  push({ id:'R29_SUPPORT_SHUCHU', rarity:'R', name:'支援集中', desc:'支援を強化する代わりに技術が少し下がる', effects:[{type:'addStat', stat:'Support', value:5},{type:'addStat', stat:'Technique', value:-1}] });

  // Hunt系（3）
  push({ id:'R30_SAKUTEKI_KYOKA', rarity:'R', name:'索敵強化', desc:'狩り性能が上がる', effects:[{type:'addStat', stat:'Hunt', value:6}] });
  push({ id:'R31_EMONO_TSUISeki', rarity:'R', name:'獲物追跡', desc:'狩り性能が上がるが精神が少し下がる', effects:[{type:'addStat', stat:'Hunt', value:8},{type:'addStat', stat:'Mental', value:-1}] });
  push({ id:'R32_KARI_NO_SEIDO', rarity:'R', name:'狩りの精度', desc:'狩り性能と技術を少し強化', effects:[{type:'addStat', stat:'Hunt', value:6},{type:'addStat', stat:'Technique', value:1}] });

  // Synergy系（3）
  push({ id:'R33_RENKEI_KAKUNIN', rarity:'R', name:'連携確認', desc:'連携が上がる', effects:[{type:'addStat', stat:'Synergy', value:6}] });
  push({ id:'R34_KAMIAWASE_KYOKA', rarity:'R', name:'噛み合い強化', desc:'連携が上がるが命中が少し下がる', effects:[{type:'addStat', stat:'Synergy', value:8},{type:'addStat', stat:'Aim', value:-1}] });
  push({ id:'R35_IKIAWASE_CALL', rarity:'R', name:'息合わせコール', desc:'連携を上げつつ支援も少し上がる', effects:[{type:'addStat', stat:'Synergy', value:6},{type:'addStat', stat:'Support', value:1}] });

  /* =========================
     公開API
     ========================= */

  function getAll() { return SKILLS.slice(); }

  function getById(id) {
    return SKILLS.find(s => s.id === id) || null;
  }

  function listByRarity(rarity) {
    return SKILLS.filter(s => s.rarity === rarity);
  }

  function countByRarity() {
    const c = { SSR: 0, SR: 0, R: 0, ALL: SKILLS.length };
    for (const s of SKILLS) {
      if (c[s.rarity] !== undefined) c[s.rarity]++;
    }
    return c;
  }

  return {
    skills: SKILLS,
    getAll,
    getById,
    listByRarity,
    countByRarity
  };
})();
