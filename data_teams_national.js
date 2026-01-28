// data_teams_national.js
// National teams (ranked by %).
// Source: your "CPUチーム＆キャラクター：パッシブ完成版（常時発動）" national section.
//
// 使い方想定（例）:
// import { NATIONAL_TEAMS } from './data_teams_national.js';
// NATIONAL_TEAMS は「そのままUIに出せる」+「simで処理しやすい」構造にしています。

export const NATIONAL_TEAMS = [
  {
    id: "N01",
    name: "シンビオッツ",
    powerPct: 85,
    tagline: "ナショナルNo.1の実力者",
    members: ["ヴェノムン", "カネイジ", "スクリーム"],
    passive: {
      name: "完全支配",
      desc: "味方全員のAim+3＆被弾率-2%",
      effects: [
        { type: "stat_add", stat: "aim", value: 3, target: "ally_all", timing: "always" },
        { type: "hit_rate_taken_add", value: -2, target: "ally_all", timing: "always" },
      ],
    },
  },
  {
    id: "N02",
    name: "かみのしま",
    powerPct: 80,
    tagline: "天からすべてを見ている",
    members: ["ゴッドエネルギー", "ガンホール", "ワイプ―"],
    passive: {
      name: "天啓",
      desc: "戦闘開始時、敵全体のAim-2",
      effects: [{ type: "stat_add", stat: "aim", value: -2, target: "enemy_all", timing: "battle_start" }],
    },
  },
  {
    id: "N03",
    name: "スリラー団",
    powerPct: 79,
    tagline: "全員トリッキー",
    members: ["モリアン", "ペロナ", "アブサロ"],
    passive: {
      name: "恐怖の空気",
      desc: "敵全体のMental消費+15%",
      effects: [{ type: "mental_cost_mul", value: 1.15, target: "enemy_all", timing: "always" }],
    },
  },
  {
    id: "N04",
    name: "セトカイバー",
    powerPct: 78,
    tagline: "統率力",
    members: ["ミノタウロス", "オベリスク", "アオメドラゴ"],
    passive: {
      name: "統率の号令",
      desc: "味方全員のAgility+2",
      effects: [{ type: "stat_add", stat: "agility", value: 2, target: "ally_all", timing: "always" }],
    },
  },
  {
    id: "N05",
    name: "ユーギムト",
    powerPct: 78,
    tagline: "結束の力と運命の一枚",
    members: ["ブラマジ", "ガイア", "オシリス"],
    passive: {
      name: "運命の手札",
      desc: "戦闘開始時、味方全員のAim+2＆Crit率+1%",
      effects: [
        { type: "stat_add", stat: "aim", value: 2, target: "ally_all", timing: "battle_start" },
        { type: "crit_rate_add", value: 1, target: "ally_all", timing: "battle_start" }, // %加算想定
      ],
    },
  },
  {
    id: "N06",
    name: "バゴンシド",
    powerPct: 78,
    tagline: "勢いが凄くキルを取りに行く",
    members: ["ハゴーン", "シードー", "りゅうのおう"],
    passive: {
      name: "狩りの本能",
      desc: "敵が1人倒れるたび味方全員のAim+1（最大+4）",
      effects: [
        {
          type: "stack_on_enemy_down",
          stat: "aim",
          valuePerStack: 1,
          maxStacks: 4,
          target: "ally_all",
          timing: "battle",
        },
      ],
    },
  },
  {
    id: "N07",
    name: "イシュタルマリーク",
    powerPct: 78,
    tagline: "非常に好戦的",
    members: ["マキュラ", "ラー", "ヘルポエム"],
    passive: {
      name: "処刑の刻印",
      desc: "敵のHPが半分以下の時、味方全員のダメージ+8%",
      effects: [
        { type: "damage_mul_vs_enemy_hp_leq", thresholdPct: 50, value: 1.08, target: "ally_all", timing: "always" },
      ],
    },
  },
  {
    id: "N08",
    name: "ギョギョカンパニー",
    powerPct: 77,
    tagline: "海の王者",
    members: ["アローン", "ハッチ", "ムラサキオビ"],
    passive: {
      name: "海王の圧",
      desc: "敵全体のAgility-2（戦闘中のみ）",
      effects: [{ type: "stat_add", stat: "agility", value: -2, target: "enemy_all", timing: "battle" }],
    },
  },
  {
    id: "N09",
    name: "鴨川一家",
    powerPct: 77,
    tagline: "根性はナショナルトップ",
    members: ["丸ノ内", "鷹町", "青木村"],
    passive: {
      name: "根性魂",
      desc: "HPが半分以下の時、味方全員のArmor回復+3/ターン（最大100）",
      effects: [
        { type: "armor_regen_per_turn_if_hp_leq", thresholdPct: 50, value: 3, cap: 100, target: "ally_all", timing: "turn_end" },
      ],
    },
  },
  {
    id: "N10",
    name: "シニスタースリー",
    powerPct: 77,
    tagline: "索敵に優れており着実に上位",
    members: ["オクトパス", "リザドン", "サンド"],
    passive: {
      name: "徹底索敵",
      desc: "敵の弱ってるキャラを狙う確率+20%",
      effects: [{ type: "focus_weak_add", value: 20, target: "ally_team", timing: "always" }],
    },
  },
  {
    id: "N11",
    name: "スパイダーズ",
    powerPct: 78,
    tagline: "機動力が高くファイトと連携に自信あり",
    members: ["ピーター", "グウェン", "マイル"],
    passive: {
      name: "高速連携",
      desc: "味方全員のMove+1＆Agility+1",
      effects: [
        { type: "stat_add", stat: "move", value: 1, target: "ally_all", timing: "always" },
        { type: "stat_add", stat: "agility", value: 1, target: "ally_all", timing: "always" },
      ],
    },
  },
  {
    id: "N12",
    name: "アンルーシア",
    powerPct: 77,
    tagline: "お宝でポイントを稼ぐ",
    members: ["ヒュザ", "マユ", "プク"],
    passive: {
      name: "お宝嗅覚",
      desc: "チームのHunt判定+15%",
      effects: [{ type: "hunt_add", value: 15, target: "ally_team", timing: "always" }],
    },
  },
  {
    id: "N13",
    name: "ゴブリンズ",
    powerPct: 74,
    tagline: "アイテム使用が上手く被弾が少ない",
    members: ["グリーン", "ボブ", "オズ"],
    passive: {
      name: "アイテム達人",
      desc: "戦闘中のアイテム使用成功率+10%",
      effects: [{ type: "item_success_add", value: 10, target: "ally_team", timing: "battle" }],
    },
  },
  {
    id: "N14",
    name: "仮面ファイター",
    powerPct: 73,
    tagline: "ファイトに自信",
    members: ["ブイスリー", "アマゾン", "デンオウキ"],
    passive: {
      name: "ファイト魂",
      desc: "味方全員の攻撃ダメージ+6%",
      effects: [{ type: "damage_mul", value: 1.06, target: "ally_all", timing: "always" }],
    },
  },
  {
    id: "N15",
    name: "名探偵",
    powerPct: 73,
    tagline: "外ムーブの生存チーム",
    members: ["シンイチ", "ヘイジ", "キドキッド"],
    passive: {
      name: "推理回避",
      desc: "敵の先制バフを無効化する確率+25%",
      effects: [{ type: "negate_enemy_prebuff_chance_add", value: 25, target: "ally_team", timing: "battle_start" }],
    },
  },
  {
    id: "N16",
    name: "黒のやつら",
    powerPct: 71,
    tagline: "噛み合えばチャンピオン量産",
    members: ["ジンジン", "ウォーカー", "ベルモット"],
    passive: {
      name: "噛み合い爆発",
      desc: "戦闘開始時、味方全員のAim+0〜5をランダム付与",
      effects: [{ type: "random_stat_add", stat: "aim", min: 0, max: 5, target: "ally_all", timing: "battle_start" }],
    },
  },
  {
    id: "N17",
    name: "スナカベ",
    powerPct: 70,
    tagline: "守り重視の中入りムーブ",
    members: ["ガーラ", "カンクック", "テマ"],
    passive: {
      name: "砂壁防御",
      desc: "味方全員の被ダメージ-5%",
      effects: [{ type: "damage_taken_mul", value: 0.95, target: "ally_all", timing: "always" }],
    },
  },
  {
    id: "N18",
    name: "ダークス",
    powerPct: 70,
    tagline: "",
    members: ["レンノ", "ルド", "シス"],
    passive: {
      name: "闇の壁",
      desc: "戦闘開始時、味方全員Armor+8（最大100）",
      effects: [{ type: "armor_add", value: 8, cap: 100, target: "ally_all", timing: "battle_start" }],
    },
  },
  {
    id: "N19",
    name: "チョコスタリオ",
    powerPct: 70,
    tagline: "",
    members: ["ウミチョ", "ヤマチョ", "ウルチョ"],
    passive: {
      name: "甘い集中",
      desc: "弱狙い率+8%相当（Technique+2相当効果）",
      effects: [{ type: "focus_weak_add", value: 8, target: "ally_team", timing: "always" }],
    },
  },
  {
    id: "N20",
    name: "ミラージュ研究所",
    powerPct: 70,
    tagline: "",
    members: ["ミラーン", "フェイクス", "スモークン"],
    passive: {
      name: "蜃気楼",
      desc: "敵の命中率-2%",
      effects: [{ type: "hit_rate_add", value: -2, target: "enemy_all", timing: "always" }],
    },
  },
  {
    id: "N21",
    name: "モノクロ騎士団",
    powerPct: 70,
    tagline: "",
    members: ["クロナイト", "シロナイト", "グレイヴ"],
    passive: {
      name: "黒白守護",
      desc: "味方全員のArmorダメージ-6%",
      effects: [{ type: "armor_damage_taken_mul", value: 0.94, target: "ally_all", timing: "always" }],
    },
  },
  {
    id: "N22",
    name: "アオガク",
    powerPct: 70,
    tagline: "油断しない",
    members: ["リョーマ", "フジサン", "クニミツ"],
    passive: {
      name: "ノーミス意識",
      desc: "味方全員の命中率+2%＆Crit率-1%",
      effects: [
        { type: "hit_rate_add", value: 2, target: "ally_all", timing: "always" },
        { type: "crit_rate_add", value: -1, target: "ally_all", timing: "always" },
      ],
    },
  },
  {
    id: "N23",
    name: "コオリテイ",
    powerPct: 70,
    tagline: "氷の帝王",
    members: ["ケイゴ", "ガバ", "ガクト"],
    passive: {
      name: "氷結制圧",
      desc: "敵全体のAgility-1＆Move-1（戦闘中のみ）",
      effects: [
        { type: "stat_add", stat: "agility", value: -1, target: "enemy_all", timing: "battle" },
        { type: "stat_add", stat: "move", value: -1, target: "enemy_all", timing: "battle" },
      ],
    },
  },
  {
    id: "N24",
    name: "フルスイング",
    powerPct: 70,
    tagline: "フルスイングで戦う",
    members: ["アマノクニ", "ピノ", "ウシオ"],
    passive: {
      name: "強振り",
      desc: "味方全員のダメージ+7% / 命中率-2%",
      effects: [
        { type: "damage_mul", value: 1.07, target: "ally_all", timing: "always" },
        { type: "hit_rate_add", value: -2, target: "ally_all", timing: "always" },
      ],
    },
  },
  {
    id: "N25",
    name: "リーク団",
    powerPct: 70,
    tagline: "",
    members: ["ドンリーク", "キン", "ハル"],
    passive: {
      name: "情報漏洩",
      desc: "敵1人を指定してその敵の被ダメージ+10%",
      effects: [{ type: "mark_enemy_damage_taken_mul", value: 1.10, target: "enemy_one", timing: "battle_start" }],
    },
  },
  {
    id: "N26",
    name: "ジョーノウチ",
    powerPct: 69,
    tagline: "ギャンブルムーブ",
    members: ["ベビドラ", "サイコ", "アカメドラゴ"],
    passive: {
      name: "運試し",
      desc: "戦闘開始時に効果抽選：Aim+4 or Aim-2",
      effects: [{ type: "random_pick", options: [{ type: "stat_add", stat: "aim", value: 4 }, { type: "stat_add", stat: "aim", value: -2 }], target: "ally_all", timing: "battle_start" }],
    },
  },
  {
    id: "N27",
    name: "センゴク連合",
    powerPct: 69,
    tagline: "",
    members: ["タケノブ", "マサムン", "ユキムラ"],
    passive: {
      name: "戦国の覇気",
      desc: "味方全員のMental+5%扱い",
      effects: [{ type: "mental_mul", value: 1.05, target: "ally_all", timing: "always" }],
    },
  },
  {
    id: "N28",
    name: "ココヤ",
    powerPct: 68,
    tagline: "",
    members: ["ゲンゲン", "ノジッコ", "オオナミ"],
    passive: {
      name: "南国回復",
      desc: "毎ターン味方全員HP+2",
      effects: [{ type: "hp_regen_per_turn", value: 2, target: "ally_all", timing: "turn_end" }],
    },
  },
  {
    id: "N29",
    name: "猫の手",
    powerPct: 68,
    tagline: "",
    members: ["ブラック", "サンゴ", "カヤ"],
    passive: {
      name: "器用さ",
      desc: "命中+2%相当（Technique+2相当効果）",
      effects: [{ type: "hit_rate_add", value: 2, target: "ally_all", timing: "always" }],
    },
  },
  {
    id: "N30",
    name: "ワルツ",
    powerPct: 68,
    tagline: "圧倒的な連携",
    members: ["クロイチ", "クロニ", "クロサン"],
    passive: {
      name: "三拍子",
      desc: "味方全員のAgility+1＆被弾率-1%",
      effects: [
        { type: "stat_add", stat: "agility", value: 1, target: "ally_all", timing: "always" },
        { type: "hit_rate_taken_add", value: -1, target: "ally_all", timing: "always" },
      ],
    },
  },
  {
    id: "N31",
    name: "銀河食堂",
    powerPct: 65,
    tagline: "",
    members: ["ギンボシ", "コスモン", "オムライス"],
    passive: {
      name: "フルコース",
      desc: "戦闘中、味方全員のアイテム回復量+8%",
      effects: [{ type: "item_heal_mul", value: 1.08, target: "ally_all", timing: "battle" }],
    },
  },
  {
    id: "N32",
    name: "バクハツ工房",
    powerPct: 65,
    tagline: "",
    members: ["ドッカンD", "バチバチー", "チリチリー"],
    passive: {
      name: "爆発癖",
      desc: "味方全員のCrit率+2% / 被弾率+1%",
      effects: [
        { type: "crit_rate_add", value: 2, target: "ally_all", timing: "always" },
        { type: "hit_rate_taken_add", value: 1, target: "ally_all", timing: "always" },
      ],
    },
  },
  {
    id: "N33",
    name: "平和の象徴",
    powerPct: 65,
    tagline: "",
    members: ["せんとうもも", "パシフィック", "パシフィック2号"],
    passive: {
      name: "平和主義",
      desc: "味方全員の被弾率-2%",
      effects: [{ type: "hit_rate_taken_add", value: -2, target: "ally_all", timing: "always" }],
    },
  },
  {
    id: "N34",
    name: "影ふみ隊",
    powerPct: 63,
    tagline: "",
    members: ["カゲロウ", "フミフミ", "ヨルスケ"],
    passive: {
      name: "影ふみ",
      desc: "敵の弱狙い率-15%",
      effects: [{ type: "focus_weak_add", value: -15, target: "enemy_team", timing: "always" }],
    },
  },
  {
    id: "N35",
    name: "鉄壁プレス",
    powerPct: 62,
    tagline: "",
    members: ["ガンテツ", "クサリマル", "ブロックン"],
    passive: {
      name: "重装プレス",
      desc: "被ダメ-6% / Agility-1",
      effects: [
        { type: "damage_taken_mul", value: 0.94, target: "ally_all", timing: "always" },
        { type: "stat_add", stat: "agility", value: -1, target: "ally_all", timing: "always" },
      ],
    },
  },
  {
    id: "N36",
    name: "サクラバースト",
    powerPct: 60,
    tagline: "",
    members: ["ハナミ", "サクラギ", "ヨザクラ"],
    passive: {
      name: "桜吹雪",
      desc: "戦闘開始時、敵全体の命中率-2%",
      effects: [{ type: "hit_rate_add", value: -2, target: "enemy_all", timing: "battle_start" }],
    },
  },
  {
    id: "N37",
    name: "雷鳴団（らいめいだん）",
    powerPct: 60,
    tagline: "",
    members: ["キッドライジン", "カミナリオ", "イナズマル"],
    passive: {
      name: "雷鳴",
      desc: "戦闘開始時、敵全体のAgility-2",
      effects: [{ type: "stat_add", stat: "agility", value: -2, target: "enemy_all", timing: "battle_start" }],
    },
  },
  {
    id: "N38",
    name: "ウミノサチ",
    powerPct: 60,
    tagline: "",
    members: ["サメサメ", "ターコイズ", "イカラッパ"],
    passive: {
      name: "潮流",
      desc: "戦闘中、味方全員のMove+1",
      effects: [{ type: "stat_add", stat: "move", value: 1, target: "ally_all", timing: "battle" }],
    },
  },
  {
    id: "N39",
    name: "ドラゴンズベリー",
    powerPct: 58,
    tagline: "",
    members: ["ベリドラ", "コドラ", "リンドラ"],
    passive: {
      name: "ベリー根性",
      desc: "HPが半分以下でダメージ+8%",
      effects: [{ type: "damage_mul_if_hp_leq", thresholdPct: 50, value: 1.08, target: "ally_all", timing: "always" }],
    },
  },
];

// （任意）検索用：id→team
export const NATIONAL_TEAM_BY_ID = Object.fromEntries(NATIONAL_TEAMS.map(t => [t.id, t]));
