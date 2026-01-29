// data_teams_national.js
// National-tier CPU teams (fixed data)
// Source: CPUチーム確定.txt（ナショナル）
// NOTE: This file should be imported by game.js (via ES Modules), but index.html must only load game.js.

export const TEAMS_NATIONAL = Object.freeze([
  {
    id: "N01_SYMBIOTS",
    tier: "national",
    name: "シンビオッツ",
    strength: 85,
    tagline: "ナショナルNo.1の実力者",
    members: ["ヴェノムン", "カネイジ", "スクリーム"],
    passive: {
      name: "完全支配",
      desc: "味方全員のAim+3＆被弾率-2%",
      effects: { aimAdd: 3, enemyHitRateAddPct: -2 }
    }
  },
  {
    id: "N02_KAMINOSHIMA",
    tier: "national",
    name: "かみのしま",
    strength: 80,
    tagline: "天からすべてを見ている",
    members: ["ゴッドエネルギー", "ガンホール", "ワイプ―"],
    passive: {
      name: "天啓",
      desc: "戦闘開始時、敵全体のAim-2",
      effects: { enemyAimAddAtBattleStart: -2 }
    }
  },
  {
    id: "N03_THRILLERDAN",
    tier: "national",
    name: "スリラー団",
    strength: 79,
    tagline: "全員トリッキー",
    members: ["モリアン", "ペロナ", "アブサロ"],
    passive: {
      name: "恐怖の空気",
      desc: "敵全体のMental消費+15%",
      effects: { enemyMentalSpendMult: 1.15 }
    }
  },
  {
    id: "N04_SETO_KAIBA",
    tier: "national",
    name: "セトカイバー",
    strength: 78,
    tagline: "統率力",
    members: ["ミノタウロス", "オベリスク", "アオメドラゴ"],
    passive: {
      name: "統率の号令",
      desc: "味方全員のAgility+2",
      effects: { agilityAdd: 2 }
    }
  },
  {
    id: "N05_YUGIMUTO",
    tier: "national",
    name: "ユーギムト",
    strength: 78,
    tagline: "結束の力と運命の一枚",
    members: ["ブラマジ", "ガイア", "オシリス"],
    passive: {
      name: "運命の手札",
      desc: "戦闘開始時、味方全員のAim+2＆Crit率+1%",
      effects: { aimAddAtBattleStart: 2, critAddPctAtBattleStart: 1 }
    }
  },
  {
    id: "N06_BAGONSHIDO",
    tier: "national",
    name: "バゴンシド",
    strength: 78,
    tagline: "勢いが凄くキルを取りに行く",
    members: ["ハゴーン", "シードー", "りゅうのおう"],
    passive: {
      name: "狩りの本能",
      desc: "敵が1人倒れるたび味方全員のAim+1 ※最大+4",
      effects: { aimAddOnEnemyDown: 1, aimAddOnEnemyDownCap: 4 }
    }
  },
  {
    id: "N07_ISHTAR_MARIK",
    tier: "national",
    name: "イシュタルマリーク",
    strength: 78,
    tagline: "非常に好戦的",
    members: ["マキュラ", "ラー", "ヘルポエム"],
    passive: {
      name: "処刑の刻印",
      desc: "敵のHPが半分以下の時、味方全員のダメージ+8%",
      effects: { dmgMultVsEnemyBelowHalfHP: 1.08 }
    }
  },
  {
    id: "N08_GYOGYO_COMPANY",
    tier: "national",
    name: "ギョギョカンパニー",
    strength: 77,
    tagline: "海の王者",
    members: ["アローン", "ハッチ", "ムラサキオビ"],
    passive: {
      name: "海王の圧",
      desc: "敵全体のAgility-2 ※戦闘中のみ",
      effects: { enemyAgilityAddInBattle: -2 }
    }
  },
  {
    id: "N09_KAMOGAWA",
    tier: "national",
    name: "鴨川一家",
    strength: 77,
    tagline: "根性はナショナルトップ",
    members: ["丸ノ内", "鷹町", "青木村"],
    passive: {
      name: "根性魂",
      desc: "HPが半分以下の時、味方全員のArmor回復+3/ターン ※最大100",
      effects: { armorRegenPerTurnWhenBelowHalfHP: 3, armorMaxCap: 100 }
    }
  },
  {
    id: "N10_SINISTER_THREE",
    tier: "national",
    name: "シニスタースリー",
    strength: 77,
    tagline: "索敵に優れており着実に上位",
    members: ["オクトパス", "リザドン", "サンド"],
    passive: {
      name: "徹底索敵",
      desc: "敵の弱ってるキャラを狙う確率+20%",
      effects: { weakTargetAddPct: 20 }
    }
  },
  {
    id: "N11_SPIDERS",
    tier: "national",
    name: "スパイダーズ",
    strength: 78,
    tagline: "機動力が高くファイトと連携に自信あり",
    members: ["ピーター", "グウェン", "マイル"],
    passive: {
      name: "高速連携",
      desc: "味方全員のMove+1＆Agility+1",
      effects: { moveAdd: 1, agilityAdd: 1 }
    }
  },
  {
    id: "N12_ANLUCIA",
    tier: "national",
    name: "アンルーシア",
    strength: 77,
    tagline: "お宝でポイントを稼ぐ",
    members: ["ヒュザ", "マユ", "プク"],
    passive: {
      name: "お宝嗅覚",
      desc: "チームのHunt判定+15%",
      effects: { huntAddPct: 15 }
    }
  },
  {
    id: "N13_GOBLINS",
    tier: "national",
    name: "ゴブリンズ",
    strength: 74,
    tagline: "アイテム使用が上手く被弾が少ない",
    members: ["グリーン", "ボブ", "オズ"],
    passive: {
      name: "アイテム達人",
      desc: "戦闘中のアイテム使用成功率+10%",
      effects: { itemUseSuccessAddPctInBattle: 10 }
    }
  },
  {
    id: "N14_MASK_FIGHTER",
    tier: "national",
    name: "仮面ファイター",
    strength: 73,
    tagline: "ファイトに自信",
    members: ["ブイスリー", "アマゾン", "デンオウキ"],
    passive: {
      name: "ファイト魂",
      desc: "味方全員の攻撃ダメージ+6%",
      effects: { dmgMult: 1.06 }
    }
  },
  {
    id: "N15_DETECTIVE",
    tier: "national",
    name: "名探偵",
    strength: 73,
    tagline: "外ムーブの生存チーム",
    members: ["シンイチ", "ヘイジ", "キドキッド"],
    passive: {
      name: "推理回避",
      desc: "敵の先制バフを無効化する確率+25%",
      effects: { negateEnemyOpeningBuffChancePct: 25 }
    }
  },
  {
    id: "N16_BLACK_GUYS",
    tier: "national",
    name: "黒のやつら",
    strength: 71,
    tagline: "噛み合えばチャンピオン量産",
    members: ["ジンジン", "ウォーカー", "ベルモット"],
    passive: {
      name: "噛み合い爆発",
      desc: "戦闘開始時、味方全員のAim+0〜5をランダム付与",
      effects: { aimAddRandomAtBattleStartMin: 0, aimAddRandomAtBattleStartMax: 5 }
    }
  },
  {
    id: "N17_SUNAKABE",
    tier: "national",
    name: "スナカベ",
    strength: 70,
    tagline: "守り重視の中入りムーブ",
    members: ["ガーラ", "カンクック", "テマ"],
    passive: {
      name: "砂壁防御",
      desc: "味方全員の被ダメージ-5%",
      effects: { dmgTakenMult: 0.95 }
    }
  },
  {
    id: "N18_DARKS",
    tier: "national",
    name: "ダークス",
    strength: 70,
    tagline: "",
    members: ["レンノ", "ルド", "シス"],
    passive: {
      name: "闇の壁",
      desc: "戦闘開始時、味方全員Armor+8 ※最大100",
      effects: { armorAddAtBattleStart: 8, armorMaxCap: 100 }
    }
  },
  {
    id: "N19_CHOCO_STARIO",
    tier: "national",
    name: "チョコスタリオ",
    strength: 70,
    tagline: "",
    members: ["ウミチョ", "ヤマチョ", "ウルチョ"],
    passive: {
      name: "甘い集中",
      desc: "味方全員のTechnique+2相当効果＝弱狙い率+8%",
      effects: { weakTargetAddPct: 8 }
    }
  },
  {
    id: "N20_MIRAGE_LAB",
    tier: "national",
    name: "ミラージュ研究所",
    strength: 70,
    tagline: "",
    members: ["ミラーン", "フェイクス", "スモークン"],
    passive: {
      name: "蜃気楼",
      desc: "敵の命中率-2%",
      effects: { enemyHitRateAddPct: -2 }
    }
  },
  {
    id: "N21_MONOCHROME_KNIGHTS",
    tier: "national",
    name: "モノクロ騎士団",
    strength: 70,
    tagline: "",
    members: ["クロナイト", "シロナイト", "グレイヴ"],
    passive: {
      name: "黒白守護",
      desc: "味方全員のArmorダメージ-6%",
      effects: { armorDamageTakenMult: 0.94 }
    }
  },
  {
    id: "N22_AOGAKU",
    tier: "national",
    name: "アオガク",
    strength: 70,
    tagline: "油断しない",
    members: ["リョーマ", "フジサン", "クニミツ"],
    passive: {
      name: "ノーミス意識",
      desc: "味方全員の命中率+2%＆Crit率-1%",
      effects: { hitRateAddPct: 2, critAddPct: -1 }
    }
  },
  {
    id: "N23_KOORITEI",
    tier: "national",
    name: "コオリテイ",
    strength: 70,
    tagline: "氷の帝王",
    members: ["ケイゴ", "ガバ", "ガクト"],
    passive: {
      name: "氷結制圧",
      desc: "敵全体のAgility-1＆Move-1 ※戦闘中のみ",
      effects: { enemyAgilityAddInBattle: -1, enemyMoveAddInBattle: -1 }
    }
  },
  {
    id: "N24_FULLSWING",
    tier: "national",
    name: "フルスイング",
    strength: 70,
    tagline: "フルスイングで戦う",
    members: ["アマノクニ", "ピノ", "ウシオ"],
    passive: {
      name: "強振り",
      desc: "味方全員のダメージ+7% / 命中率-2%",
      effects: { dmgMult: 1.07, hitRateAddPct: -2 }
    }
  },
  {
    id: "N25_LEAK_GANG",
    tier: "national",
    name: "リーク団",
    strength: 70,
    tagline: "",
    members: ["ドンリーク", "キン", "ハル"],
    passive: {
      name: "情報漏洩",
      desc: "敵1人を指定してその敵の被ダメージ+10%",
      effects: { markOneEnemyDamageTakenMult: 1.10 }
    }
  },
  {
    id: "N26_JOHNOUCHI",
    tier: "national",
    name: "ジョーノウチ",
    strength: 69,
    tagline: "ギャンブルムーブ",
    members: ["ベビドラ", "サイコ", "アカメドラゴ"],
    passive: {
      name: "運試し",
      desc: "戦闘開始時に効果抽選：Aim+4 or Aim-2",
      effects: { aimAddAtBattleStartEither: [4, -2] }
    }
  },
  {
    id: "N27_SENGOKU_RENGOU",
    tier: "national",
    name: "センゴク連合",
    strength: 69,
    tagline: "",
    members: ["タケノブ", "マサムン", "ユキムラ"],
    passive: {
      name: "戦国の覇気",
      desc: "味方全員のMental+5%扱い",
      effects: { mentalTreatAsAddPct: 5 }
    }
  },
  {
    id: "N28_KOKOYA",
    tier: "national",
    name: "ココヤ",
    strength: 68,
    tagline: "",
    members: ["ゲンゲン", "ノジッコ", "オオナミ"],
    passive: {
      name: "南国回復",
      desc: "毎ターン味方全員HP+2",
      effects: { hpRegenPerTurn: 2 }
    }
  },
  {
    id: "N29_NEKONOTE",
    tier: "national",
    name: "猫の手",
    strength: 68,
    tagline: "",
    members: ["ブラック", "サンゴ", "カヤ"],
    passive: {
      name: "器用さ",
      desc: "味方全員のTechnique+2相当効果＝命中+2%",
      effects: { hitRateAddPct: 2 }
    }
  },
  {
    id: "N30_WALTZ",
    tier: "national",
    name: "ワルツ",
    strength: 68,
    tagline: "圧倒的な連携",
    members: ["クロイチ", "クロニ", "クロサン"],
    passive: {
      name: "三拍子",
      desc: "味方全員のAgility+1＆被弾率-1%",
      effects: { agilityAdd: 1, enemyHitRateAddPct: -1 }
    }
  },
  {
    id: "N31_GINGA_SHOKUDOU",
    tier: "national",
    name: "銀河食堂",
    strength: 65,
    tagline: "",
    members: ["ギンボシ", "コスモン", "オムライス"],
    passive: {
      name: "フルコース",
      desc: "戦闘中、味方全員のアイテム回復量+8%",
      effects: { itemHealMultInBattle: 1.08 }
    }
  },
  {
    id: "N32_BAKUHATSU_KOUBOU",
    tier: "national",
    name: "バクハツ工房",
    strength: 65,
    tagline: "",
    members: ["ドッカンD", "バチバチー", "チリチリー"],
    passive: {
      name: "爆発癖",
      desc: "味方全員のCrit率+2% / 被弾率+1%",
      effects: { critAddPct: 2, enemyHitRateAddPct: 1 }
    }
  },
  {
    id: "N33_HEIWA_NO_SHOUCHOU",
    tier: "national",
    name: "平和の象徴",
    strength: 65,
    tagline: "",
    members: ["せんとうもも", "パシフィック", "パシフィック2号"],
    passive: {
      name: "平和主義",
      desc: "味方全員の被弾率-2%",
      effects: { enemyHitRateAddPct: -2 }
    }
  },
  {
    id: "N34_KAGEFUMI_TAI",
    tier: "national",
    name: "影ふみ隊",
    strength: 63,
    tagline: "",
    members: ["カゲロウ", "フミフミ", "ヨルスケ"],
    passive: {
      name: "影ふみ",
      desc: "敵の弱狙い率を下げる＝敵の弱狙い率-15%",
      effects: { enemyWeakTargetAddPct: -15 }
    }
  },
  {
    id: "N35_TEPPEKI_PRESS",
    tier: "national",
    name: "鉄壁プレス",
    strength: 62,
    tagline: "",
    members: ["ガンテツ", "クサリマル", "ブロックン"],
    passive: {
      name: "重装プレス",
      desc: "味方全員の被ダメージ-6% / Agility-1",
      effects: { dmgTakenMult: 0.94, agilityAdd: -1 }
    }
  },
  {
    id: "N36_SAKURA_BURST",
    tier: "national",
    name: "サクラバースト",
    strength: 60,
    tagline: "",
    members: ["ハナミ", "サクラギ", "ヨザクラ"],
    passive: {
      name: "桜吹雪",
      desc: "戦闘開始時、敵全体の命中率-2%",
      effects: { enemyHitRateAddPctAtBattleStart: -2 }
    }
  },
  {
    id: "N37_RAIMEIDAN",
    tier: "national",
    name: "雷鳴団（らいめいだん）",
    strength: 60,
    tagline: "",
    members: ["キッドライジン", "カミナリオ", "イナズマル"],
    passive: {
      name: "雷鳴",
      desc: "戦闘開始時、敵全体のAgility-2",
      effects: { enemyAgilityAddAtBattleStart: -2 }
    }
  },
  {
    id: "N38_UMINOSACHI",
    tier: "national",
    name: "ウミノサチ",
    strength: 60,
    tagline: "",
    members: ["サメサメ", "ターコイズ", "イカラッパ"],
    passive: {
      name: "潮流",
      desc: "戦闘中、味方全員のMove+1",
      effects: { moveAddInBattle: 1 }
    }
  },
  {
    id: "N39_DRAGONS_BERRY",
    tier: "national",
    name: "ドラゴンズベリー",
    strength: 58,
    tagline: "",
    members: ["ベリドラ", "コドラ", "リンドラ"],
    passive: {
      name: "ベリー根性",
      desc: "HPが半分以下でダメージ+8%",
      effects: { dmgMultWhenBelowHalfHP: 1.08 }
    }
  }
]);

export function getNationalTeams() {
  // convenience getter (returns immutable array)
  return TEAMS_NATIONAL;
}
