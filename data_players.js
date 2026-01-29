/* =========================================================
   data_players.js (FULL)
   - プレイヤー側キャラクター定義（初期3人 + オファー候補）
   - 依存：data_const.js（DATA_CONST）
   ========================================================= */

(() => {
  'use strict';

  const CONST = window.DATA_CONST;
  if (!CONST) throw new Error('DATA_CONST not found. Load data_const.js before data_players.js');

  // ---------------------------------------------------------
  // 共通：ステータスの最低限の整合（Armorはゲーム側で基本100固定だが、定義も持つ）
  // ---------------------------------------------------------
  const ARMOR_BASE = 100;

  // ---------------------------------------------------------
  // 初期キャラ（プレイヤー初期所属）
  // ※ユーザー提示の数値を優先。Techniqueは最新ステ項目に合わせて「基礎値」を補完。
  //   （育成で伸びる前提。ここはゲーム開始時の初期値）
  // ---------------------------------------------------------
  const starters = [
    {
      id: 'P_START_01',
      name: 'ウニチー',
      classRole: 'Support',

      stats: {
        HP: 100,
        Armor: ARMOR_BASE,
        Mental: 50,
        Move: 3,
        Aim: 85,
        Agility: 30,
        Technique: 6,   // 補完（最新ステに合わせた初期値）
        Support: 8,
        Hunt: 4,
      },

      passive: {
        id: 'PASSIVE_UNICHI_GREETING',
        name: 'ウニチーの挨拶',
        type: 'Passive',
        // 常時：戦闘中、チームMental +10%（常時）
        effect: { kind: 'TEAM_MENTAL_MULT', value: 1.10, scope: 'BATTLE_ONLY' },
        note: '戦闘中、チームのMentalを+10%（常時）',
      },

      ability: {
        id: 'ABI_UNICHI_HIPECALL',
        name: 'ウニチーのお散歩（ハイプコール）',
        type: 'Fight',
        usesPerMatch: 2,

        cpuEffect: {
          kind: 'TEAM_AIM_ADD',
          value: 5,
          scope: 'BATTLE_ONE_SHOT', // 「次の攻撃1回分」扱い（戦闘内の1回分）
        },

        playerEffect: {
          kind: 'TEAM_AIM_ADD_FORMULA',
          base: 5,
          addFromStat: { stat: 'Support', mul: 0.5 }, // Aim + (5 + Support×0.5)
          scope: 'BATTLE_ONE_SHOT',
        },

        note: 'この戦闘で味方全員のAimを上げる（1回分）。プレイヤー時はSupport依存で上乗せ。',
      },

      ult: {
        id: 'ULT_UNICHI_BUILDHAMMER',
        name: 'ビルドハンマー',
        type: 'Fight',
        usesPerMatch: 1,

        cpuEffect: {
          kind: 'TEAM_NEGATE_DAMAGE',
          times: 1,
          scope: 'BATTLE_ONLY',
        },

        playerEffect: [
          { kind: 'TEAM_NEGATE_DAMAGE', times: 1, scope: 'BATTLE_ONLY' },
          // 追加Armor+25は「条件付き」を許容（条件はルール側で判定）
          {
            kind: 'TEAM_ARMOR_ADD_CONDITIONAL',
            add: 25,
            condition: { stat: 'Mental', op: '>=', value: 55 },
            scope: 'BATTLE_INSTANT',
            capMaxArmor: 100,
          },
        ],

        note: '味方全員の被ダメ1回無効。プレイヤー時は条件を満たすとArmor+25（最大100）。',
      },
    },

    {
      id: 'P_START_02',
      name: 'ネコクー',
      classRole: 'Scout',

      stats: {
        HP: 100,
        Armor: ARMOR_BASE,
        Mental: 55,
        Move: 2,
        Aim: 80,
        Agility: 32,
        Technique: 7,   // 補完
        Support: 5,
        Hunt: 7,
      },

      passive: {
        id: 'PASSIVE_NEKOKU_NAP',
        name: 'お昼寝',
        type: 'Passive',
        effect: { kind: 'SCOUT_EVASION_BONUS', valuePct: 5, scope: 'MATCH_ONLY' },
        note: '索敵アビリティによる「戦闘回避率」+5%',
      },

      ability: {
        id: 'ABI_NEKOKU_JUMPDOLPHIN',
        name: 'ジャンプドルフィン',
        type: 'Scout',
        usesPerMatch: 1,

        cpuEffect: {
          kind: 'ROUND_COMBAT_RATE_ADD',
          valuePct: -10,
          scope: 'ROUND_ONLY',
        },

        playerEffect: {
          kind: 'ROUND_COMBAT_RATE_ADD_FORMULA',
          basePct: -10,
          addFromStat: { stat: 'Hunt', mul: -0.6 }, // - (10% + Hunt×0.6%)
          scope: 'ROUND_ONLY',
        },

        note: '移動中に発動。該当Rの戦闘発生率を下げる（プレイヤー時はHunt依存で追加低下）。',
      },

      ult: {
        id: 'ULT_NEKOKU_PERFECTROUTE',
        name: 'パーフェクトルート',
        type: 'Rotate',
        usesPerMatch: 1,

        cpuEffect: {
          kind: 'RETREAT_BIAS',
          valuePct: 20,
          scope: 'ROUND_ONLY',
        },

        playerEffect: {
          kind: 'RETREAT_BIAS_FORMULA',
          basePct: 20,
          addFromStat: { stat: 'Agility', mul: 0.5 }, // 例：Agilityで撤退成功率を上げる（設計上の係数）
          scope: 'ROUND_ONLY',
          note: '撤退（痛み分け）仕様は現行ルールでは「撤退無し」に変更済み。未実装扱いの保険枠。',
        },

        // IMPORTANT: 現在の確定ルールは「撤退無し」。よってこのULTは
        // sim側で「未実装」扱いにするためのフラグを持たせる。
        flags: { notImplemented: true, reason: '撤退無し（完全決着）ルールのため' },

        note: '撤退（痛み分け）を想定したULT。現行ルールでは未実装扱い。',
      },
    },

    {
      id: 'P_START_03',
      name: 'ドオー',
      classRole: 'Controller',

      stats: {
        HP: 95,
        Armor: ARMOR_BASE,
        Mental: 58,
        Move: 3,
        Aim: 83,
        Agility: 32,
        Technique: 6,   // 補完
        Support: 4,
        Hunt: 3,
      },

      passive: {
        id: 'PASSIVE_DOOU_ROLL',
        name: '丸くなる',
        type: 'Passive',
        effect: { kind: 'SELF_NEGATE_DAMAGE', times: 1, scope: 'BATTLE_ONLY' },
        note: '戦闘中、1度だけ敵の攻撃を無効化する',
      },

      ability: {
        id: 'ABI_DOOU_TAILWAVE',
        name: 'しっぽをふる',
        type: 'Fight',
        usesPerMatch: 2,

        cpuEffect: {
          kind: 'ENEMY_TEAM_AIM_ADD',
          value: -5,
          scope: 'ENEMY_NEXT_ATTACK', // 次の攻撃1回分
        },

        playerEffect: {
          kind: 'ENEMY_TEAM_AIM_ADD_FORMULA',
          base: -5,
          addFromStat: { stat: 'Agility', mul: -0.2 }, // - (5 + Agility×0.2)
          scope: 'ENEMY_NEXT_ATTACK',
        },

        note: '敵全体のAimを下げる（次の攻撃1回分）。プレイヤー時はAgility依存で下げ幅増。',
      },

      ult: {
        id: 'ULT_DOOU_SLEEP_SMILE',
        name: 'スリープスマイル',
        type: 'Fight',
        usesPerMatch: 1,

        cpuEffect: {
          kind: 'ENEMY_ONE_SKIP',
          turns: 1,
          scope: 'BATTLE_ONLY',
        },

        playerEffect: [
          { kind: 'ENEMY_ONE_SKIP', turns: 1, scope: 'BATTLE_ONLY' },
          {
            kind: 'ENEMY_ONE_STAT_ADD',
            stat: 'Move',
            value: -1,
            duration: 'NEXT_ROUND', // 次Rまで
          },
        ],

        note: '敵1人を次の行動1回スキップ。プレイヤー時はさらにMove-1（次Rまで）。',
      },
    },
  ];

  // ---------------------------------------------------------
  // オファーキャラ
  // - ユーザー要望：ステータスは任せる
  // - 方針：企業ランク帯で「基礎値レンジ」を用意し、同価格帯で役割差を出す
  // - 注意：Armorは固定100想定なので差は付けない
  // ---------------------------------------------------------
  function makeOfferChar(opts) {
    return {
      id: opts.id,
      name: opts.name,
      classRole: opts.classRole,

      offer: {
        costG: opts.costG,
        suitableCompanyRank: opts.suitableCompanyRank, // “適正企業ランク”
        unlockCompanyRank: opts.unlockCompanyRank || 0, // “(ランク15で開放)”等
        availableFromStart: !!opts.availableFromStart,
      },

      stats: {
        HP: opts.stats.HP,
        Armor: ARMOR_BASE,
        Mental: opts.stats.Mental,
        Move: opts.stats.Move,
        Aim: opts.stats.Aim,
        Agility: opts.stats.Agility,
        Technique: opts.stats.Technique,
        Support: opts.stats.Support,
        Hunt: opts.stats.Hunt,
      },

      passive: { id: opts.passiveId, name: opts.passiveName, type: 'Passive', note: opts.passiveNote || '' },
      ability: { id: opts.abilityId, name: opts.abilityName, type: 'Ability', note: opts.abilityNote || '' },
      ult: { id: opts.ultId, name: opts.ultName, type: 'Ult', note: opts.ultNote || '' },
    };
  }

  // 企業ランク10帯（最初からオファー可能）
  // 目標：初期3人と同格〜やや尖り。価格が同じなので「役割差」で魅せる。
  const offers_rank10 = [
    makeOfferChar({
      id: 'P_OFFER_R10_01',
      name: 'キヅチー',
      classRole: 'Attacker',
      costG: 10000,
      suitableCompanyRank: 10,
      unlockCompanyRank: 0,
      availableFromStart: true,
      stats: { HP: 102, Mental: 50, Move: 3, Aim: 84, Agility: 33, Technique: 6, Support: 3, Hunt: 4 },
      passiveId: 'PASSIVE_KIDUCHI_BOAR',
      passiveName: '猪突猛進',
      abilityId: 'ABI_KIDUCHI_BUILDCRASH',
      abilityName: 'ビルドクラッシュ',
      ultId: 'ULT_KIDUCHI_HAMMERCRASH',
      ultName: 'ハンマークラッシュ',
    }),
    makeOfferChar({
      id: 'P_OFFER_R10_02',
      name: 'プチのん',
      classRole: 'Supporter',
      costG: 10000,
      suitableCompanyRank: 10,
      unlockCompanyRank: 0,
      availableFromStart: true,
      stats: { HP: 100, Mental: 56, Move: 3, Aim: 80, Agility: 30, Technique: 6, Support: 8, Hunt: 4 },
      passiveId: 'PASSIVE_PUCHINON_HEAL',
      passiveName: '回復の心得',
      abilityId: 'ABI_PUCHINON_WAVESURF',
      abilityName: '波乗り',
      ultId: 'ULT_PUCHINON_MAHYADENON',
      ultName: 'マヒャデノン',
    }),
    makeOfferChar({
      id: 'P_OFFER_R10_03',
      name: 'ハリネズミ',
      classRole: 'Scout',
      costG: 10000,
      suitableCompanyRank: 10,
      unlockCompanyRank: 0,
      availableFromStart: true,
      stats: { HP: 98, Mental: 52, Move: 4, Aim: 78, Agility: 36, Technique: 6, Support: 4, Hunt: 7 },
      passiveId: 'PASSIVE_HARINEZUMI_SPIKE',
      passiveName: 'トゲトゲ',
      abilityId: 'ABI_HARINEZUMI_NEWPWR',
      abilityName: '新しいパワー',
      ultId: 'ULT_HARINEZUMI_MIKAN',
      ultName: 'みかんアタック',
    }),
    makeOfferChar({
      id: 'P_OFFER_R10_04',
      name: 'チャコチェ',
      classRole: 'Controller',
      costG: 10000,
      suitableCompanyRank: 10,
      unlockCompanyRank: 0,
      availableFromStart: true,
      stats: { HP: 100, Mental: 54, Move: 3, Aim: 79, Agility: 32, Technique: 7, Support: 5, Hunt: 5 },
      passiveId: 'PASSIVE_CHAKOCHE_FARM',
      passiveName: '農家育ち',
      abilityId: 'ABI_CHAKOCHE_TOMATO',
      abilityName: '新鮮なトマト',
      ultId: 'ULT_CHAKOCHE_BREAD',
      ultName: 'パン愛好家',
    }),
  ];

  // 企業ランク30帯（ランク15で開放）
  // 目標：初期より明確に強い。尖りがあり、戦闘の勝ち筋を増やす。
  const offers_rank30 = [
    makeOfferChar({
      id: 'P_OFFER_R30_01',
      name: 'ジゴック',
      classRole: 'Controller',
      costG: 30000,
      suitableCompanyRank: 30,
      unlockCompanyRank: 15,
      availableFromStart: false,
      stats: { HP: 105, Mental: 60, Move: 3, Aim: 84, Agility: 35, Technique: 8, Support: 5, Hunt: 5 },
      passiveId: 'PASSIVE_ZIGOKKU_MEAN',
      passiveName: 'いじわる',
      abilityId: 'ABI_ZIGOKKU_DARK',
      abilityName: '暗闇',
      ultId: 'ULT_ZIGOKKU_FAITH',
      ultName: '信仰',
    }),
    makeOfferChar({
      id: 'P_OFFER_R30_02',
      name: 'マメラス',
      classRole: 'Attacker',
      costG: 30000,
      suitableCompanyRank: 30,
      unlockCompanyRank: 15,
      availableFromStart: false,
      stats: { HP: 112, Mental: 55, Move: 3, Aim: 86, Agility: 34, Technique: 7, Support: 3, Hunt: 4 },
      passiveId: 'PASSIVE_MAMERAS_STEEL',
      passiveName: '鋼の肉体',
      abilityId: 'ABI_MAMERAS_PWRCRASH',
      abilityName: 'パワークラッシュ',
      ultId: 'ULT_MAMERAS_GIANT',
      ultName: '巨大化',
    }),
    makeOfferChar({
      id: 'P_OFFER_R30_03',
      name: 'いなりん',
      classRole: 'Scout',
      costG: 30000,
      suitableCompanyRank: 30,
      unlockCompanyRank: 15,
      availableFromStart: false,
      stats: { HP: 102, Mental: 58, Move: 4, Aim: 82, Agility: 38, Technique: 7, Support: 4, Hunt: 9 },
      passiveId: 'PASSIVE_INARIN_FLUFFY',
      passiveName: 'ふわふわボディ',
      abilityId: 'ABI_INARIN_HOTLOOK',
      abilityName: '熱い視線',
      ultId: 'ULT_INARIN_HIDE',
      ultName: '神のかくれんぼ',
    }),
    makeOfferChar({
      id: 'P_OFFER_R30_04',
      name: 'ゴマプリン',
      classRole: 'Supporter',
      costG: 30000,
      suitableCompanyRank: 30,
      unlockCompanyRank: 15,
      availableFromStart: false,
      stats: { HP: 108, Mental: 62, Move: 3, Aim: 82, Agility: 33, Technique: 7, Support: 9, Hunt: 5 },
      passiveId: 'PASSIVE_GOMAPURIN_SOFT',
      passiveName: 'やわらかボディ',
      abilityId: 'ABI_GOMAPURIN_SWEETWIND',
      abilityName: '甘い風',
      ultId: 'ULT_GOMAPURIN_AROMA',
      ultName: '香ばしいサポート',
    }),
  ];

  // 企業ランク50帯（ランク40で開放）
  // 目標：トップ帯。単体性能が強く、育成が進んだ初期キャラと並ぶ/超える想定。
  const offers_rank50 = [
    makeOfferChar({
      id: 'P_OFFER_R50_01',
      name: 'ブルーアイズ',
      classRole: 'Attacker',
      costG: 50000,
      suitableCompanyRank: 50,
      unlockCompanyRank: 40,
      availableFromStart: false,
      stats: { HP: 118, Mental: 65, Move: 3, Aim: 90, Agility: 36, Technique: 8, Support: 4, Hunt: 5 },
      passiveId: 'PASSIVE_BLUEEYES_SAVIOR',
      passiveName: '命の恩人',
      abilityId: 'ABI_BLUEEYES_ACE',
      abilityName: '絶対的エース',
      ultId: 'ULT_BLUEEYES_MEETING',
      ultName: '夜の会議',
    }),
    makeOfferChar({
      id: 'P_OFFER_R50_02',
      name: 'キョロゾー',
      classRole: 'Supporter',
      costG: 50000,
      suitableCompanyRank: 50,
      unlockCompanyRank: 40,
      availableFromStart: false,
      stats: { HP: 115, Mental: 70, Move: 3, Aim: 84, Agility: 34, Technique: 8, Support: 10, Hunt: 6 },
      passiveId: 'PASSIVE_KYOROZO_CREATOR',
      passiveName: 'クリエイター',
      abilityId: 'ABI_KYOROZO_BLACKROBE',
      abilityName: 'ブラックローブ',
      ultId: 'ULT_KYOROZO_KYOROCHAN',
      ultName: 'キョロちゃん',
    }),
  ];

  const offers = []
    .concat(offers_rank10)
    .concat(offers_rank30)
    .concat(offers_rank50);

  // ---------------------------------------------------------
  // 公開
  // ---------------------------------------------------------
  const exportObj = {
    starters,
    offers,

    // 参照用
    getStarterById(id) {
      const key = String(id);
      return starters.find(c => c.id === key) || null;
    },
    getOfferById(id) {
      const key = String(id);
      return offers.find(c => c.id === key) || null;
    },
    getAllPlayerCharacters() {
      return starters.concat(offers);
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

  window.DATA_PLAYERS = exportObj;
})();
