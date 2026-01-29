// data_players.js (FULL)
// Player Characters Data for MOB BR
// - 初期キャラ3人：テキスト仕様をそのまま実装（CPU固定A / プレイヤー依存B）
// - オファーキャラ：役割＆適正企業ランク帯(10/30/50)に合わせてステータスと係数を設計（後で調整しやすい）
//
// Export:
//   PLAYER_CHARACTERS (Array)
//   getPlayerCharacterById(id)
//   getPlayerCharacterByName(name)
//   getOfferCharactersByCompanyRank(companyRank)  // 現在の企業ランクでオファー一覧
//   isOfferUnlocked(offer, companyRank)

export const PLAYER_CHARACTERS = [
  // =========================================================
  // 初期キャラ（所属：プレイヤー初期）
  // =========================================================
  {
    id: "pl_001",
    name: "ウニチー",
    affiliation: "player_initial",
    role: "Support",
    offer: null, // 初期キャラはオファーではない
    stats: {
      HP: 100,
      Armor: 100,
      Mental: 50,
      Move: 3,
      Aim: 85,
      Agility: 30,
      Support: 8, // 1〜10
      Hunt: 4,    // 1〜10
    },
    passive: {
      name: "ウニチーの挨拶",
      type: "Passive",
      timing: "always",
      description: "戦闘中、チームのMentalを+10%（常時）",
      // 実処理は戦闘エンジン側で参照
      effect: {
        teamMentalMul: 1.10,
        scope: "team",
        phase: "combat",
      },
    },
    ability: {
      name: "ウニチーのお散歩（ハイプコール）",
      type: "Fight",
      timing: "combat",
      maxUsesPerMatch: 2,
      descriptionCPU: "この戦闘で味方全員のAimを+5（1回分）",
      descriptionPlayer: "Support×0.5 を追加（例：Support8なら+4） → Aim + (5 + Support×0.5)（この戦闘1回分）",
      effect: {
        // A: CPU固定
        cpu: {
          teamAimAdd: 5,
          oneAttackOnly: true,
        },
        // B: プレイヤー依存
        player: {
          baseTeamAimAdd: 5,
          addBy: { stat: "Support", mul: 0.5 },
          oneAttackOnly: true,
        },
      },
    },
    ult: {
      name: "ビルドハンマー",
      type: "Fight",
      timing: "combat",
      maxUsesPerMatch: 1,
      descriptionCPU: "この戦闘中、味方全員の被ダメージを1回だけ無効化",
      descriptionPlayer: "無効化は確定＋追加でArmor+25（戦闘中即時）。Mentalが高いほど安定（条件付けも可）",
      effect: {
        cpu: {
          teamNegateDamageHits: 1,
        },
        player: {
          teamNegateDamageHits: 1,
          teamArmorAddInstant: 25,
          // ここは「条件付けも可」とあるので、後でON/OFFできるように残す
          optionalCondition: {
            enabled: false,
            stat: "Mental",
            threshold: 55,
            onMet: { teamArmorAddInstant: 10 },
          },
        },
      },
    },
  },

  {
    id: "pl_002",
    name: "ネコクー",
    affiliation: "player_initial",
    role: "Scout",
    offer: null,
    stats: {
      HP: 100,
      Armor: 100,
      Mental: 55,
      Move: 2,
      Aim: 80,
      Agility: 32,
      Support: 5,
      Hunt: 7,
    },
    passive: {
      name: "お昼寝",
      type: "Passive",
      timing: "always",
      description: "索敵アビリティによる「戦闘回避率」を+5%",
      effect: {
        avoidCombatRateAdd: 0.05,
        scope: "team",
        phase: "move",
      },
    },
    ability: {
      name: "ジャンプドルフィン",
      type: "Scout",
      timing: "move", // R移動中
      maxUsesPerMatch: 1,
      descriptionCPU: "このRの戦闘発生率を-10%",
      descriptionPlayer: "Hunt×0.6% 追加で下げる → 戦闘発生率 - (10% + Hunt×0.6%)（Hunt7なら-14.2%）",
      effect: {
        cpu: {
          combatOccurrenceRateAdd: -0.10,
          durationRounds: 1,
        },
        player: {
          baseCombatOccurrenceRateAdd: -0.10,
          addBy: { stat: "Hunt", mul: 0.006 }, // 0.6% = 0.006
          durationRounds: 1,
        },
      },
    },
    ult: {
      name: "パーフェクトルート",
      type: "Fight",
      timing: "combat",
      maxUsesPerMatch: 1,
      descriptionCPU: "この戦闘中、味方全員のAgilityを20アップする",
      descriptionPlayer: "20アップは確定＋追加で+1～10（Mentalが高いほど増加）",
      effect: {
        cpu: {
          teamAgilityAdd: 20,
          duration: "combat",
        },
        player: {
          teamAgilityAdd: 20,
          // 追加分は「Mental依存で+1〜10」
          bonusByMental: {
            min: 1,
            max: 10,
            stat: "Mental",
            // 55付近を基準に、上に伸びるほど最大寄りになる想定
            // 実際の乱数/補間は戦闘エンジン側で処理
            curveHint: "higher_is_better",
          },
          duration: "combat",
        },
      },
    },
  },

  {
    id: "pl_003",
    name: "ドオー",
    affiliation: "player_initial",
    role: "Controller",
    offer: null,
    stats: {
      HP: 95,
      Armor: 100,
      Mental: 58,
      Move: 3,
      Aim: 83,
      Agility: 32,
      Support: 4,
      Hunt: 3,
    },
    passive: {
      name: "丸くなる",
      type: "Passive",
      timing: "combat",
      description: "戦闘中、1度だけ敵の攻撃を無効化する（原案そのまま）",
      effect: {
        selfNegateDamageHits: 1,
        duration: "combat",
      },
    },
    ability: {
      name: "しっぽをふる",
      type: "Fight",
      timing: "combat",
      maxUsesPerMatch: 2,
      descriptionCPU: "敵全体のAimを-5（次の攻撃1回分）",
      descriptionPlayer: "Agility×0.2 をAimダウンに上乗せ → 敵全体Aim - (5 + Agility×0.2)（次の攻撃1回分）",
      effect: {
        cpu: {
          enemyTeamAimAdd: -5,
          oneAttackOnly: true,
        },
        player: {
          baseEnemyTeamAimAdd: -5,
          addBy: { stat: "Agility", mul: 0.2 },
          oneAttackOnly: true,
        },
      },
    },
    ult: {
      name: "スリープスマイル",
      type: "Fight",
      timing: "combat",
      maxUsesPerMatch: 1,
      descriptionCPU: "敵1人を「行動不能（次の攻撃1回スキップ）」",
      descriptionPlayer: "敵1人を確定で行動スキップ＋さらにMove-1（次Rまで）（Moveが高いほど捕まえる精度UP）",
      effect: {
        cpu: {
          targetEnemySkipNextAttack: true,
          extra: null,
        },
        player: {
          targetEnemySkipNextAttack: true,
          targetEnemyMoveAddUntilNextRound: -1,
          // 命中・成功判定を戦闘エンジン側が持つ場合のヒント
          accuracyHintBy: { stat: "Move", curveHint: "higher_is_better" },
        },
      },
    },
  },

  // =========================================================
  // オファーキャラ（最初からオファー可能 / 条件解放あり）
  // ※ ステータスは「任せる」なので、役割＆適正企業ランク帯で設計
  // =========================================================

  // -------- 適正企業ランク: 10（最初からオファー可能） --------
  {
    id: "of_101",
    name: "キヅチー",
    affiliation: "offer",
    role: "Attacker",
    offer: {
      priceG: 10000,
      recommendedCompanyRank: 10,
      unlockCompanyRank: 0,
      failChanceByRankGap: true, // ランク差があると失敗もある想定（メイン画面仕様）
    },
    stats: {
      HP: 105,
      Armor: 95,
      Mental: 50,
      Move: 3,
      Aim: 84,
      Agility: 34,
      Support: 2,
      Hunt: 4,
    },
    passive: {
      name: "猪突猛進",
      type: "Passive",
      timing: "combat",
      description: "戦闘開始時、自己強化（攻撃力+5% / 被弾率+1%）",
      effect: {
        selfDamageMul: 1.05,
        selfHitTakenRateAdd: 0.01,
        duration: "combat",
      },
    },
    ability: {
      name: "ビルドクラッシュ",
      type: "Fight",
      timing: "combat",
      maxUsesPerMatch: 2,
      descriptionCPU: "この戦闘で自己の攻撃ダメージ+6%（2ターン）",
      descriptionPlayer: "Aimが高いほど伸びる：+6% + (Aim-80)×0.2%（上限+12%）",
      effect: {
        cpu: {
          selfDamageMulAdd: 0.06,
          durationTurns: 2,
        },
        player: {
          baseSelfDamageMulAdd: 0.06,
          addBy: { stat: "Aim", base: 80, mul: 0.002, cap: 0.12 }, // 最大+12%
          durationTurns: 2,
        },
      },
    },
    ult: {
      name: "ハンマークラッシュ",
      type: "Fight",
      timing: "combat",
      maxUsesPerMatch: 1,
      descriptionCPU: "敵1人に大ダメージ（与ダメージ+20%扱いで1回）",
      descriptionPlayer: "確定クリティカル扱い + 追加で敵Armorを-15（戦闘中）",
      effect: {
        cpu: {
          targetEnemyDamageMulAdd: 0.20,
          hitCount: 1,
        },
        player: {
          guaranteedCrit: true,
          targetEnemyArmorAddInstant: -15,
          hitCount: 1,
        },
      },
    },
  },

  {
    id: "of_102",
    name: "プチのん",
    affiliation: "offer",
    role: "Support",
    offer: {
      priceG: 10000,
      recommendedCompanyRank: 10,
      unlockCompanyRank: 0,
      failChanceByRankGap: true,
    },
    stats: {
      HP: 95,
      Armor: 105,
      Mental: 58,
      Move: 2,
      Aim: 78,
      Agility: 30,
      Support: 8,
      Hunt: 3,
    },
    passive: {
      name: "回復の心得",
      type: "Passive",
      timing: "always",
      description: "回復量+8%（アイテム/回復効果）",
      effect: {
        teamHealMul: 1.08,
        scope: "team",
        phase: "all",
      },
    },
    ability: {
      name: "波乗り",
      type: "Support",
      timing: "combat",
      maxUsesPerMatch: 2,
      descriptionCPU: "味方全員のArmor+8（即時）",
      descriptionPlayer: "Support×1 を追加 → Armor + (8 + Support)",
      effect: {
        cpu: {
          teamArmorAddInstant: 8,
        },
        player: {
          baseTeamArmorAddInstant: 8,
          addBy: { stat: "Support", mul: 1.0 },
        },
      },
    },
    ult: {
      name: "マヒャデノン",
      type: "Fight",
      timing: "combat",
      maxUsesPerMatch: 1,
      descriptionCPU: "敵全体のAim-3（この戦闘中）",
      descriptionPlayer: "敵全体Aim-3は確定＋さらに敵1人を行動スキップ（次の攻撃1回）",
      effect: {
        cpu: {
          enemyTeamAimAdd: -3,
          duration: "combat",
        },
        player: {
          enemyTeamAimAdd: -3,
          duration: "combat",
          extra: { targetEnemySkipNextAttack: true },
        },
      },
    },
  },

  {
    id: "of_103",
    name: "ハリネズミ",
    affiliation: "offer",
    role: "Scout",
    offer: {
      priceG: 10000,
      recommendedCompanyRank: 10,
      unlockCompanyRank: 0,
      failChanceByRankGap: true,
    },
    stats: {
      HP: 100,
      Armor: 95,
      Mental: 52,
      Move: 3,
      Aim: 79,
      Agility: 36,
      Support: 3,
      Hunt: 8,
    },
    passive: {
      name: "トゲトゲ",
      type: "Passive",
      timing: "combat",
      description: "被弾時に相手へ反射ダメージ（小）/ 被弾率-1%",
      effect: {
        selfHitTakenRateAdd: -0.01,
        reflectDamageFlat: 2, // 戦闘エンジン側で扱う
        trigger: "on_hit_taken",
      },
    },
    ability: {
      name: "新しいパワー",
      type: "Scout",
      timing: "move",
      maxUsesPerMatch: 1,
      descriptionCPU: "このRの戦闘発生率-8%",
      descriptionPlayer: "Hunt×0.5% 追加で下げる → - (8% + Hunt×0.5%)",
      effect: {
        cpu: {
          combatOccurrenceRateAdd: -0.08,
          durationRounds: 1,
        },
        player: {
          baseCombatOccurrenceRateAdd: -0.08,
          addBy: { stat: "Hunt", mul: 0.005 },
          durationRounds: 1,
        },
      },
    },
    ult: {
      name: "みかんアタック",
      type: "Fight",
      timing: "combat",
      maxUsesPerMatch: 1,
      descriptionCPU: "敵1人のAgility-3（この戦闘中）",
      descriptionPlayer: "さらに味方全員のAgility+2（この戦闘中）",
      effect: {
        cpu: {
          targetEnemyAgilityAdd: -3,
          duration: "combat",
        },
        player: {
          targetEnemyAgilityAdd: -3,
          duration: "combat",
          extra: { teamAgilityAdd: 2, duration: "combat" },
        },
      },
    },
  },

  {
    id: "of_104",
    name: "チャコチェ",
    affiliation: "offer",
    role: "Controller",
    offer: {
      priceG: 10000,
      recommendedCompanyRank: 10,
      unlockCompanyRank: 0,
      failChanceByRankGap: true,
    },
    stats: {
      HP: 98,
      Armor: 102,
      Mental: 56,
      Move: 3,
      Aim: 82,
      Agility: 33,
      Support: 5,
      Hunt: 5,
    },
    passive: {
      name: "農家育ち",
      type: "Passive",
      timing: "always",
      description: "お宝/フラッグの獲得判定+5%（探索系）",
      effect: {
        lootFindRateAdd: 0.05,
        scope: "team",
        phase: "move",
      },
    },
    ability: {
      name: "新鮮なトマト",
      type: "Control",
      timing: "combat",
      maxUsesPerMatch: 2,
      descriptionCPU: "敵1人のAim-6（次の攻撃1回分）",
      descriptionPlayer: "さらにSupport×0.5を上乗せ → Aim - (6 + Support×0.5)",
      effect: {
        cpu: {
          targetEnemyAimAdd: -6,
          oneAttackOnly: true,
        },
        player: {
          baseTargetEnemyAimAdd: -6,
          addBy: { stat: "Support", mul: 0.5 },
          oneAttackOnly: true,
        },
      },
    },
    ult: {
      name: "パン愛好家",
      type: "Support",
      timing: "combat",
      maxUsesPerMatch: 1,
      descriptionCPU: "味方全員HP+6（即時）",
      descriptionPlayer: "さらに味方全員Mental+2（即時）",
      effect: {
        cpu: {
          teamHPAddInstant: 6,
        },
        player: {
          teamHPAddInstant: 6,
          teamMentalAddInstant: 2,
        },
      },
    },
  },

  // -------- 適正企業ランク: 30（ランク15で開放） --------
  {
    id: "of_201",
    name: "ジゴック",
    affiliation: "offer",
    role: "Controller",
    offer: {
      priceG: 30000,
      recommendedCompanyRank: 30,
      unlockCompanyRank: 15,
      failChanceByRankGap: true,
    },
    stats: {
      HP: 110,
      Armor: 110,
      Mental: 62,
      Move: 3,
      Aim: 86,
      Agility: 36,
      Support: 5,
      Hunt: 5,
    },
    passive: {
      name: "いじわる",
      type: "Passive",
      timing: "combat",
      description: "戦闘開始時、敵全体のAim-1（この戦闘中）",
      effect: {
        enemyTeamAimAdd: -1,
        duration: "combat",
      },
    },
    ability: {
      name: "暗闇",
      type: "Control",
      timing: "combat",
      maxUsesPerMatch: 2,
      descriptionCPU: "敵全体のAim-3（次の攻撃1回分）",
      descriptionPlayer: "さらにAgility×0.15を上乗せ（上限-8）",
      effect: {
        cpu: {
          enemyTeamAimAdd: -3,
          oneAttackOnly: true,
        },
        player: {
          baseEnemyTeamAimAdd: -3,
          addBy: { stat: "Agility", mul: 0.15, cap: -8 }, // capは戦闘側で扱う想定
          oneAttackOnly: true,
        },
      },
    },
    ult: {
      name: "信仰",
      type: "Support",
      timing: "combat",
      maxUsesPerMatch: 1,
      descriptionCPU: "味方全員の被ダメージ-6%（この戦闘中）",
      descriptionPlayer: "さらに味方全員Armor+10（即時）",
      effect: {
        cpu: {
          teamDamageTakenMul: 0.94,
          duration: "combat",
        },
        player: {
          teamDamageTakenMul: 0.94,
          duration: "combat",
          extra: { teamArmorAddInstant: 10 },
        },
      },
    },
  },

  {
    id: "of_202",
    name: "マメラス",
    affiliation: "offer",
    role: "Attacker",
    offer: {
      priceG: 30000,
      recommendedCompanyRank: 30,
      unlockCompanyRank: 15,
      failChanceByRankGap: true,
    },
    stats: {
      HP: 120,
      Armor: 115,
      Mental: 55,
      Move: 2,
      Aim: 88,
      Agility: 32,
      Support: 2,
      Hunt: 4,
    },
    passive: {
      name: "鋼の肉体",
      type: "Passive",
      timing: "always",
      description: "被ダメージ-3%（常時）",
      effect: {
        selfDamageTakenMul: 0.97,
        phase: "all",
      },
    },
    ability: {
      name: "パワークラッシュ",
      type: "Fight",
      timing: "combat",
      maxUsesPerMatch: 2,
      descriptionCPU: "自己の攻撃ダメージ+8%（2ターン）",
      descriptionPlayer: "HPが高いほど伸びる：+8% + (HP-110)×0.15%（上限+14%）",
      effect: {
        cpu: { selfDamageMulAdd: 0.08, durationTurns: 2 },
        player: {
          baseSelfDamageMulAdd: 0.08,
          addBy: { stat: "HP", base: 110, mul: 0.0015, cap: 0.14 },
          durationTurns: 2,
        },
      },
    },
    ult: {
      name: "巨大化",
      type: "Fight",
      timing: "combat",
      maxUsesPerMatch: 1,
      descriptionCPU: "自己の被ダメージ-10%＆与ダメージ+10%（この戦闘中）",
      descriptionPlayer: "さらに自己Armor+15（即時）",
      effect: {
        cpu: {
          selfDamageTakenMul: 0.90,
          selfDamageMul: 1.10,
          duration: "combat",
        },
        player: {
          selfDamageTakenMul: 0.90,
          selfDamageMul: 1.10,
          duration: "combat",
          extra: { selfArmorAddInstant: 15 },
        },
      },
    },
  },

  {
    id: "of_203",
    name: "いなりん",
    affiliation: "offer",
    role: "Scout",
    offer: {
      priceG: 30000,
      recommendedCompanyRank: 30,
      unlockCompanyRank: 15,
      failChanceByRankGap: true,
    },
    stats: {
      HP: 108,
      Armor: 102,
      Mental: 60,
      Move: 4,
      Aim: 84,
      Agility: 40,
      Support: 4,
      Hunt: 8,
    },
    passive: {
      name: "ふわふわボディ",
      type: "Passive",
      timing: "always",
      description: "被弾率-2%（常時）",
      effect: {
        selfHitTakenRateAdd: -0.02,
        phase: "all",
      },
    },
    ability: {
      name: "熱い視線",
      type: "Scout",
      timing: "move",
      maxUsesPerMatch: 1,
      descriptionCPU: "このRのお宝ゲット成功率+10%",
      descriptionPlayer: "さらにHunt×1.0% を上乗せ → + (10% + Hunt×1.0%)",
      effect: {
        cpu: { treasureGetRateAdd: 0.10, durationRounds: 1 },
        player: {
          baseTreasureGetRateAdd: 0.10,
          addBy: { stat: "Hunt", mul: 0.01 },
          durationRounds: 1,
        },
      },
    },
    ult: {
      name: "神のかくれんぼ",
      type: "Scout",
      timing: "move",
      maxUsesPerMatch: 1,
      descriptionCPU: "このRの戦闘発生率-15%",
      descriptionPlayer: "さらにチームの被弾率-2%（このR）",
      effect: {
        cpu: { combatOccurrenceRateAdd: -0.15, durationRounds: 1 },
        player: {
          combatOccurrenceRateAdd: -0.15,
          durationRounds: 1,
          extra: { teamHitTakenRateAdd: -0.02, durationRounds: 1 },
        },
      },
    },
  },

  {
    id: "of_204",
    name: "ゴマプリン",
    affiliation: "offer",
    role: "Support",
    offer: {
      priceG: 30000,
      recommendedCompanyRank: 30,
      unlockCompanyRank: 15,
      failChanceByRankGap: true,
    },
    stats: {
      HP: 105,
      Armor: 115,
      Mental: 65,
      Move: 2,
      Aim: 80,
      Agility: 32,
      Support: 9,
      Hunt: 4,
    },
    passive: {
      name: "やわらかボディ",
      type: "Passive",
      timing: "combat",
      description: "戦闘開始時、味方全員のArmor+6（即時）",
      effect: {
        teamArmorAddInstant: 6,
        duration: "instant",
      },
    },
    ability: {
      name: "甘い風",
      type: "Support",
      timing: "combat",
      maxUsesPerMatch: 2,
      descriptionCPU: "味方全員HP+5（即時）",
      descriptionPlayer: "さらにSupport×0.6 を上乗せ → HP + (5 + Support×0.6)",
      effect: {
        cpu: { teamHPAddInstant: 5 },
        player: {
          baseTeamHPAddInstant: 5,
          addBy: { stat: "Support", mul: 0.6 },
        },
      },
    },
    ult: {
      name: "香ばしいサポート",
      type: "Support",
      timing: "combat",
      maxUsesPerMatch: 1,
      descriptionCPU: "味方全員のAim+3（この戦闘中）",
      descriptionPlayer: "さらに味方全員のMental+3（即時）",
      effect: {
        cpu: { teamAimAdd: 3, duration: "combat" },
        player: {
          teamAimAdd: 3,
          duration: "combat",
          extra: { teamMentalAddInstant: 3 },
        },
      },
    },
  },

  // -------- 適正企業ランク: 50（ランク40で開放） --------
  {
    id: "of_301",
    name: "ブルーアイズ",
    affiliation: "offer",
    role: "Attacker",
    offer: {
      priceG: 50000,
      recommendedCompanyRank: 50,
      unlockCompanyRank: 40,
      failChanceByRankGap: true,
    },
    stats: {
      HP: 135,
      Armor: 125,
      Mental: 68,
      Move: 3,
      Aim: 92,
      Agility: 38,
      Support: 3,
      Hunt: 5,
    },
    passive: {
      name: "命の恩人",
      type: "Passive",
      timing: "combat",
      description: "戦闘中、初回被弾時にHP+10（即時）",
      effect: {
        trigger: "on_first_hit_taken",
        selfHPAddInstant: 10,
        oncePerCombat: true,
      },
    },
    ability: {
      name: "絶対的エース",
      type: "Fight",
      timing: "combat",
      maxUsesPerMatch: 2,
      descriptionCPU: "この戦闘で自己のAim+4（この戦闘中）",
      descriptionPlayer: "さらに(Aim-85)×0.2 を上乗せ（上限+10）",
      effect: {
        cpu: { selfAimAdd: 4, duration: "combat" },
        player: {
          baseSelfAimAdd: 4,
          addBy: { stat: "Aim", base: 85, mul: 0.2, cap: 10 },
          duration: "combat",
        },
      },
    },
    ult: {
      name: "夜の会議",
      type: "Fight",
      timing: "combat",
      maxUsesPerMatch: 1,
      descriptionCPU: "味方全員の与ダメージ+8%（この戦闘中）",
      descriptionPlayer: "さらに味方全員の被ダメージ-5%（この戦闘中）",
      effect: {
        cpu: { teamDamageMul: 1.08, duration: "combat" },
        player: {
          teamDamageMul: 1.08,
          duration: "combat",
          extra: { teamDamageTakenMul: 0.95, duration: "combat" },
        },
      },
    },
  },

  {
    id: "of_302",
    name: "キョロゾー",
    affiliation: "offer",
    role: "Support",
    offer: {
      priceG: 50000,
      recommendedCompanyRank: 50,
      unlockCompanyRank: 40,
      failChanceByRankGap: true,
    },
    stats: {
      HP: 120,
      Armor: 135,
      Mental: 75,
      Move: 2,
      Aim: 84,
      Agility: 36,
      Support: 10,
      Hunt: 4,
    },
    passive: {
      name: "クリエイター",
      type: "Passive",
      timing: "always",
      description: "チームのMental+5%（常時）＆戦闘中の回復量+5%",
      effect: {
        teamMentalMul: 1.05,
        teamHealMul: 1.05,
        scope: "team",
        phase: "all",
      },
    },
    ability: {
      name: "ブラックローブ",
      type: "Support",
      timing: "combat",
      maxUsesPerMatch: 2,
      descriptionCPU: "味方全員の被ダメージ-4%（2ターン）",
      descriptionPlayer: "さらにSupport×0.4% を上乗せ（上限-8%）",
      effect: {
        cpu: { teamDamageTakenMul: 0.96, durationTurns: 2 },
        player: {
          baseTeamDamageTakenMul: 0.96,
          addBy: { stat: "Support", mul: -0.004, capMul: 0.92 }, // 最小0.92まで（=最大-8%）
          durationTurns: 2,
        },
      },
    },
    ult: {
      name: "キョロちゃん",
      type: "Support",
      timing: "combat",
      maxUsesPerMatch: 1,
      descriptionCPU: "味方全員HP+10＆Armor+10（即時）",
      descriptionPlayer: "さらに味方全員のAim+3（この戦闘中）",
      effect: {
        cpu: {
          teamHPAddInstant: 10,
          teamArmorAddInstant: 10,
        },
        player: {
          teamHPAddInstant: 10,
          teamArmorAddInstant: 10,
          extra: { teamAimAdd: 3, duration: "combat" },
        },
      },
    },
  },
];

// =========================================================
// Helpers
// =========================================================
export function getPlayerCharacterById(id) {
  return PLAYER_CHARACTERS.find(c => c.id === id) || null;
}

export function getPlayerCharacterByName(name) {
  return PLAYER_CHARACTERS.find(c => c.name === name) || null;
}

export function isOfferUnlocked(offerChar, companyRank) {
  if (!offerChar || offerChar.affiliation !== "offer") return false;
  const unlock = offerChar.offer?.unlockCompanyRank ?? 0;
  return companyRank >= unlock;
}

export function getOfferCharactersByCompanyRank(companyRank) {
  return PLAYER_CHARACTERS
    .filter(c => c.affiliation === "offer")
    .filter(c => isOfferUnlocked(c, companyRank))
    .sort((a, b) => {
      const ar = a.offer?.recommendedCompanyRank ?? 0;
      const br = b.offer?.recommendedCompanyRank ?? 0;
      if (ar !== br) return ar - br;
      const ap = a.offer?.priceG ?? 0;
      const bp = b.offer?.priceG ?? 0;
      return ap - bp;
    });
}
