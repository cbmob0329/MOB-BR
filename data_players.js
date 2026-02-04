/* =====================================================
   data_players.js
   - プレイヤー側キャラデータ（初期＋オファー）
   - 役割：igl / attacker / support
   - ステータス：hp / armor / mental / aim / agility / technique / support / hunt
   - パッシブ/ウルト：ログ演出＋内部反映（数値は表示しない）
   ===================================================== */

(() => {
  // 役割キー（固定）
  const ROLE = {
    IGL: 'igl',
    ATTACKER: 'attacker',
    SUPPORT: 'support',
  };

  // パッシブ効果の型（sim側で解釈）
  // - teamStatAdd: チームの特定ステータスに +X（戦闘中のみ）
  // - enemyTeamFormDelta: 敵のTeamFormを内部で±扱い（戦闘中のみ）
  // - accidentRateDeltaPct: 事故率を内部で±%扱い（戦闘中のみ）
  // - godPlayRateDeltaPct: 神プレイ率を内部で±%扱い（戦闘中のみ）
  //
  // ※表示ログには数値を出さない（sim側ルール）
  const PASSIVE_TYPE = {
    TEAM_STAT_ADD: 'teamStatAdd',
    ENEMY_TEAMFORM_DELTA: 'enemyTeamFormDelta',
    ACCIDENT_RATE_DELTA_PCT: 'accidentRateDeltaPct',
    GODPLAY_RATE_DELTA_PCT: 'godPlayRateDeltaPct',
  };

  // ウルトは全キャラ統一：FightBoost +2（確定）
  // 発動はログ演出のみ（数値非表示）
  const ULT_TEMPLATE = (name) => ({
    name,
    type: 'fightBoost',
    fightBoost: 2,
    maxUsePerMatch: 1,
  });

  // キャラ定義（アップいただいた確定テキストのみ反映）
  const LIST = [
    /* ============================
       初期プレイヤーチーム
       ============================ */
    {
      id: 'ice',
      name: 'アイス',
      role: ROLE.IGL,

      stats: {
        hp: 100,
        armor: 100,
        mental: 60,
        aim: 70,
        agility: 30,
        technique: 20,
        support: 55,
        hunt: 60,
      },

      passive: {
        name: 'フリーズスタイル',
        type: PASSIVE_TYPE.TEAM_STAT_ADD,
        // 戦闘中：チームのアーマー+5
        data: { stat: 'armor', add: 5 },
      },

      ult: ULT_TEMPLATE('タテケイの系譜'),

      offer: {
        type: 'starter',
        costG: 0,
        requiredCompanyRank: 0,
        unlockAtCompanyRank: 0,
      },
    },

    {
      id: 'nekoku',
      name: 'ネコクー',
      role: ROLE.ATTACKER,

      stats: {
        hp: 100,
        armor: 100,
        mental: 55,
        aim: 76,
        agility: 32,
        technique: 23,
        support: 43,
        hunt: 48,
      },

      passive: {
        name: 'キャット・ザ・スイム',
        type: PASSIVE_TYPE.TEAM_STAT_ADD,
        // 戦闘中：チームの敏捷性+5
        data: { stat: 'agility', add: 5 },
      },

      ult: ULT_TEMPLATE('ねこにこばん'),

      offer: {
        type: 'starter',
        costG: 0,
        requiredCompanyRank: 0,
        unlockAtCompanyRank: 0,
      },
    },

    {
      id: 'doorock',
      name: 'ドオーロック',
      role: ROLE.SUPPORT,

      stats: {
        hp: 90,
        armor: 100,
        mental: 50,
        aim: 66,
        agility: 37,
        technique: 33,
        support: 70,
        hunt: 40,
      },

      passive: {
        name: 'スリープモード',
        type: PASSIVE_TYPE.TEAM_STAT_ADD,
        // 戦闘中：チームの探知+5
        data: { stat: 'hunt', add: 5 },
      },

      ult: ULT_TEMPLATE('おおきくしっぽをふる'),

      offer: {
        type: 'starter',
        costG: 0,
        requiredCompanyRank: 0,
        unlockAtCompanyRank: 0,
      },
    },

    /* ============================
       オファー（適正企業ランク10）
       最初からオファー可能｜10000G
       ============================ */
    {
      id: 'kiduchi',
      name: 'キヅチー',
      role: ROLE.ATTACKER,

      stats: {
        hp: 100,
        armor: 95,
        mental: 52,
        aim: 78,
        agility: 40,
        technique: 25,
        support: 35,
        hunt: 45,
      },

      passive: {
        name: '猪突猛進',
        type: PASSIVE_TYPE.TEAM_STAT_ADD,
        data: { stat: 'agility', add: 5 },
      },

      ult: ULT_TEMPLATE('ハンマークラッシュ'),

      offer: {
        type: 'offer',
        costG: 10000,
        requiredCompanyRank: 10,
        unlockAtCompanyRank: 0,
      },
    },

    {
      id: 'puchinon',
      name: 'プチのん',
      role: ROLE.IGL,

      stats: {
        hp: 95,
        armor: 100,
        mental: 62,
        aim: 67,
        agility: 33,
        technique: 40,
        support: 45,
        hunt: 65,
      },

      passive: {
        name: '抜群に器用',
        type: PASSIVE_TYPE.TEAM_STAT_ADD,
        data: { stat: 'technique', add: 5 },
      },

      ult: ULT_TEMPLATE('マヒャデノン'),

      offer: {
        type: 'offer',
        costG: 10000,
        requiredCompanyRank: 10,
        unlockAtCompanyRank: 0,
      },
    },

    {
      id: 'harinezumi',
      name: 'ハリネズミ',
      role: ROLE.SUPPORT,

      stats: {
        hp: 90,
        armor: 105,
        mental: 58,
        aim: 60,
        agility: 30,
        technique: 25,
        support: 72,
        hunt: 52,
      },

      passive: {
        name: 'ぷにぷにでトゲトゲ',
        type: PASSIVE_TYPE.TEAM_STAT_ADD,
        data: { stat: 'armor', add: 5 },
      },

      ult: ULT_TEMPLATE('みかんアタック'),

      offer: {
        type: 'offer',
        costG: 10000,
        requiredCompanyRank: 10,
        unlockAtCompanyRank: 0,
      },
    },

    {
      id: 'chakoche',
      name: 'チャコチェ',
      role: ROLE.SUPPORT,

      stats: {
        hp: 100,
        armor: 95,
        mental: 55,
        aim: 58,
        agility: 35,
        technique: 30,
        support: 68,
        hunt: 55,
      },

      passive: {
        name: '農家育ち',
        type: PASSIVE_TYPE.TEAM_STAT_ADD,
        data: { stat: 'mental', add: 5 },
      },

      ult: ULT_TEMPLATE('パン愛好家'),

      offer: {
        type: 'offer',
        costG: 10000,
        requiredCompanyRank: 10,
        unlockAtCompanyRank: 0,
      },
    },

    /* ============================
       オファー（適正企業ランク30）
       ランク15で開放｜30000G
       ============================ */
    {
      id: 'jigock',
      name: 'ジゴック',
      role: ROLE.IGL,

      stats: {
        hp: 100,
        armor: 105,
        mental: 68,
        aim: 70,
        agility: 34,
        technique: 45,
        support: 42,
        hunt: 70,
      },

      passive: {
        name: 'いじわる',
        type: PASSIVE_TYPE.ENEMY_TEAMFORM_DELTA,
        // 戦闘中：敵のTeamFormを内部-1扱い
        data: { delta: -1 },
      },

      ult: ULT_TEMPLATE('信仰'),

      offer: {
        type: 'offer',
        costG: 30000,
        requiredCompanyRank: 30,
        unlockAtCompanyRank: 15,
      },
    },

    {
      id: 'mameras',
      name: 'マメラス',
      role: ROLE.ATTACKER,

      stats: {
        hp: 110,
        armor: 100,
        mental: 60,
        aim: 82,
        agility: 36,
        technique: 30,
        support: 35,
        hunt: 48,
      },

      passive: {
        name: '鋼の肉体',
        type: PASSIVE_TYPE.TEAM_STAT_ADD,
        data: { stat: 'armor', add: 5 },
      },

      ult: ULT_TEMPLATE('巨大化'),

      offer: {
        type: 'offer',
        costG: 30000,
        requiredCompanyRank: 30,
        unlockAtCompanyRank: 15,
      },
    },

    {
      id: 'inarin',
      name: 'いなりん',
      role: ROLE.SUPPORT,

      stats: {
        hp: 95,
        armor: 105,
        mental: 65,
        aim: 62,
        agility: 35,
        technique: 30,
        support: 75,
        hunt: 60,
      },

      passive: {
        name: 'ふわふわボディ',
        type: PASSIVE_TYPE.TEAM_STAT_ADD,
        data: { stat: 'mental', add: 5 },
      },

      ult: ULT_TEMPLATE('神のかくれんぼ'),

      offer: {
        type: 'offer',
        costG: 30000,
        requiredCompanyRank: 30,
        unlockAtCompanyRank: 15,
      },
    },

    {
      id: 'gomapurin',
      name: 'ゴマプリン',
      role: ROLE.ATTACKER,

      stats: {
        hp: 100,
        armor: 95,
        mental: 58,
        aim: 80,
        agility: 42,
        technique: 33,
        support: 38,
        hunt: 50,
      },

      passive: {
        name: 'やわらかボディ',
        type: PASSIVE_TYPE.TEAM_STAT_ADD,
        data: { stat: 'agility', add: 5 },
      },

      ult: ULT_TEMPLATE('香ばしいエイム'),

      offer: {
        type: 'offer',
        costG: 30000,
        requiredCompanyRank: 30,
        unlockAtCompanyRank: 15,
      },
    },

    /* ============================
       オファー（適正企業ランク50）
       ランク40で開放｜50000G
       ============================ */
    {
      id: 'blue_wataame',
      name: 'ブルーわたあめ',
      role: ROLE.ATTACKER,

      stats: {
        hp: 105,
        armor: 105,
        mental: 70,
        aim: 85,
        agility: 40,
        technique: 38,
        support: 40,
        hunt: 55,
      },

      passive: {
        name: '命の恩人',
        type: PASSIVE_TYPE.ACCIDENT_RATE_DELTA_PCT,
        // 戦闘中：事故率を内部-2%扱い
        data: { deltaPct: -2 },
      },

      ult: ULT_TEMPLATE('夜の会議'),

      offer: {
        type: 'offer',
        costG: 50000,
        requiredCompanyRank: 50,
        unlockAtCompanyRank: 40,
      },
    },

    {
      id: 'kyorozo',
      name: 'キョロゾー',
      role: ROLE.SUPPORT,

      stats: {
        hp: 100,
        armor: 110,
        mental: 75,
        aim: 65,
        agility: 35,
        technique: 40,
        support: 80,
        hunt: 70,
      },

      passive: {
        name: 'クリエイター',
        type: PASSIVE_TYPE.GODPLAY_RATE_DELTA_PCT,
        // 戦闘中：神プレイ率を内部+2%扱い
        data: { deltaPct: 2 },
      },

      ult: ULT_TEMPLATE('キョロちゃん'),

      offer: {
        type: 'offer',
        costG: 50000,
        requiredCompanyRank: 50,
        unlockAtCompanyRank: 40,
      },
    },
  ];

  const byId = {};
  for (const c of LIST) byId[c.id] = c;

  const DATA_PLAYERS = {
    ROLE,
    PASSIVE_TYPE,
    LIST,
    byId,

    // 初期チーム（確定）
    PLAYER_STARTER_IDS: ['ice', 'nekoku', 'doorock'],
  };

  window.DATA_PLAYERS = DATA_PLAYERS;
})();
