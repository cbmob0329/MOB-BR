// data_teams_world.js
// World teams (40).
// Source: CPUチーム確定.txt / ✅ワールドチーム パッシブ完成版（常時発動）
//
// 方針:
// - データは「UIにそのまま表示できる」形（raw）を必ず保持。
// - よくある文言は effects に簡易変換（sim.jsで使いやすくする）。
// - 変換できない特殊パッシブは effects に {type:"raw_unparsed"} を入れるだけにする。
//   → sim側で個別対応しやすい。

const CAP_ARMOR = 100;

function detectTiming(raw) {
  if (raw.includes("戦闘開始時")) return "battle_start";
  if (raw.includes("毎ターン")) return "per_turn";
  if (raw.includes("戦闘1ターン目だけ")) return "turn1_only";
  if (raw.includes("戦闘中1回だけ")) return "once_per_battle";
  if (raw.includes("戦闘中")) return "battle";
  return "always";
}

function splitAndNormalize(raw) {
  // "A＆B" / "A& B" / "A、B" などを分割
  return raw
    .replace(/&/g, "＆")
    .replace(/、/g, "＆")
    .split("＆")
    .map(s => s.trim())
    .filter(Boolean);
}

function parseOneClause(clause, timingDefault) {
  // examples:
  // "味方全員のAim+3"
  // "敵全体の命中率-3%"
  // "戦闘開始時、味方全員Armor+12 ※最大100"
  // "回復量-10%"
  // "被ダメージ-7%"
  // "被弾率-3%"
  // "ダメージ+6%"
  // "Crit率+3%"
  // "敵全体のArmor-5で開始"
  const timing = timingDefault;

  // helper target detect
  const target =
    clause.includes("敵全体") ? "enemy_all"
    : clause.includes("味方全員") ? "ally_all"
    : clause.includes("敵1人") ? "enemy_one"
    : clause.includes("敵の") ? "enemy_all"
    : "ally_all";

  // Stat patterns
  // Aim / Agility / Move / Armor / HP (flat add)
  let m = clause.match(/(Aim|Agility|Move|Armor|HP)\s*([+\-]\d+)/i);
  if (m) {
    const stat = m[1].toLowerCase();
    const value = parseInt(m[2], 10);
    const effect = { type: "stat_add", stat, value, target, timing };
    if (stat === "armor" && clause.includes("最大100")) effect.clampMax = CAP_ARMOR;
    return effect;
  }

  // 命中率 / 被弾率 / 弱狙い率 / Crit率 / 回復量 / 被ダメージ / ダメージ (% add or mul)
  // We store as additive percentage points for rates, and multiplicative for dmg/heal/reduction when obvious.
  m = clause.match(/(命中率|被弾率|弱狙い率|Crit率|回復量)\s*([+\-]\d+)%/);
  if (m) {
    const label = m[1];
    const valuePct = parseInt(m[2], 10);
    const map = {
      "命中率": "hitRateAddPct",
      "被弾率": "hitTakenRateAddPct",
      "弱狙い率": "focusWeakAddPct",
      "Crit率": "critRateAddPct",
      "回復量": "healAmountAddPct",
    };
    return { type: map[label] || "rate_add_pct", valuePct, target, timing };
  }

  m = clause.match(/(被ダメージ|ダメージ)\s*([+\-]\d+)%/);
  if (m) {
    const label = m[1];
    const valuePct = parseInt(m[2], 10);
    // +6% => 1.06, -7% => 0.93
    const mul = 1 + (valuePct / 100);
    const type = (label === "被ダメージ") ? "damageTakenMul" : "damageMul";
    return { type, mul, target, timing };
  }

  // "敵全体のArmor-5で開始"
  if (clause.includes("Armor-5で開始")) {
    return { type: "stat_add", stat: "armor", value: -5, target: "enemy_all", timing: "battle_start" };
  }

  // Special recognizable patterns (team-level once)
  if (clause.includes("被ダメ無効") && clause.includes("チームで1回")) {
    return { type: "team_once_negate_damage", target: "ally_team", timing: "battle" };
  }
  if (clause.includes("HP1で耐える") && clause.includes("チームで1回")) {
    return { type: "team_once_survive_1hp", target: "ally_team", timing: "battle" };
  }

  // Action-order / delay chance
  if (clause.includes("行動を1回遅らせる") && clause.includes("確率")) {
    const mm = clause.match(/確率\+?(\d+)%/);
    const chancePct = mm ? parseInt(mm[1], 10) : 0;
    return { type: "delay_action_chance", chancePct, target: "enemy_one", timing: "battle" };
  }

  // "敵の弱狙い率を0%にする"
  if (clause.includes("弱狙い率") && clause.includes("0%")) {
    return { type: "set_focus_weak_pct", valuePct: 0, target: "enemy_team", timing: "battle_start" };
  }

  // "敵1人を指定して命中率-6%"
  if (clause.includes("敵1人を指定") && clause.includes("命中率")) {
    const mm = clause.match(/命中率([+\-]\d+)%/);
    const valuePct = mm ? parseInt(mm[1], 10) : -6;
    return { type: "mark_enemy_hitRateAddPct", valuePct, target: "enemy_one", timing: "battle_start" };
  }

  // "戦闘中1回だけ敵の攻撃をミスにする"
  if (clause.includes("1回だけ") && clause.includes("攻撃") && clause.includes("ミス")) {
    return { type: "team_once_force_enemy_miss", target: "ally_team", timing: "battle" };
  }

  // fallback
  return { type: "raw_unparsed", raw: clause, target, timing };
}

function buildPassive(passiveName, passiveRaw) {
  const timing = detectTiming(passiveRaw);
  // remove leading timing phrase like "戦闘開始時、"
  const cleaned = passiveRaw.replace(/^戦闘開始時、/,"").replace(/^戦闘中、/,"").replace(/^毎ターン、/,"").trim();
  const clauses = splitAndNormalize(cleaned);

  const effects = clauses.map(c => parseOneClause(c, timing));
  return { name: passiveName, raw: passiveRaw, timing, effects };
}

export const WORLD_TEAMS = [
  {
    id: "W01",
    name: "ホークス",
    powerPct: 95,
    tagline: "世界No.1のチーム力",
    members: ["アサモモ", "ヨルモモ", "ネコヤダイ"],
    passive: buildPassive("王者の完成度", "味方全員のAim+3＆Agility+2"),
  },
  {
    id: "W02",
    name: "ブラックオーダー",
    powerPct: 92,
    tagline: "ホークスのライバル",
    members: ["サノース", "プロキシマン", "マウマウ"],
    passive: buildPassive("黒の圧力", "敵全体の命中率-3%"),
  },
  {
    id: "W03",
    name: "フリーズマスターズ",
    powerPct: 90,
    tagline: "冷酷な最恐集団",
    members: ["フリーザー", "クーラー", "ゴールド"],
    passive: buildPassive("冷酷支配", "敵全体のAgility-2＆回復量-10%"),
  },
  {
    id: "W04",
    name: "アカツキ",
    powerPct: 90,
    tagline: "企業財力が世界一",
    members: ["イカリーノ", "イカススム", "ヨジョウ"],
    passive: buildPassive("資金力", "戦闘開始時、味方全員Armor+12 ※最大100"),
  },
  {
    id: "W05",
    name: "アンドロメダ",
    powerPct: 90,
    tagline: "ロボのごとく正確無比",
    members: ["ジュピター", "ムーン", "アースドン"],
    passive: buildPassive("機械精度", "味方全員の命中率+4%"),
  },
  {
    id: "W06",
    name: "鬼ヶ島",
    powerPct: 90,
    tagline: "圧倒的連携力",
    members: ["カイドウロック", "キングスキー", "クイーンデフ"],
    passive: buildPassive("怪物連携", "味方全員の被ダメージ-7%"),
  },
  {
    id: "W07",
    name: "大将オールスターズ",
    powerPct: 89,
    tagline: "個々が強い",
    members: ["アカイノシシ", "キヒヒ", "アオクジャク"],
    passive: buildPassive("個の暴力", "味方全員のダメージ+6%"),
  },
  {
    id: "W08",
    name: "読みかけの本",
    powerPct: 88,
    tagline: "最高のパフォーマンス",
    members: ["あのヒーロー", "見習いビーム", "いつかの巨人"],
    passive: buildPassive("物語補正", "HP半分以下で味方全員のAim+4"),
  },
  {
    id: "W09",
    name: "レジェンズ",
    powerPct: 88,
    tagline: "ファイト力世界一",
    members: ["レイース", "オックタン", "ブラハン"],
    passive: buildPassive("戦闘民族", "味方全員のCrit率+3%"),
  },
  {
    id: "W10",
    name: "ムギワラーノ",
    powerPct: 87,
    tagline: "主人公的チーム",
    members: ["ルーフ", "ゾーロ", "ダイサンジ"],
    passive: buildPassive("主人公補正", "戦闘中1回だけ被ダメ無効 ※チームで1回"),
  },
  {
    id: "W11",
    name: "ニンジャタイ",
    powerPct: 87,
    tagline: "",
    members: ["ナルトノ", "サラスケ", "サクランド"],
    passive: buildPassive("忍び足", "戦闘1ターン目だけ敵の命中率-5%"),
  },
  {
    id: "W12",
    name: "ホールケーキ",
    powerPct: 86,
    tagline: "",
    members: ["カタクリコ", "クラッカー", "オーブンレンジ"],
    passive: buildPassive("甘党強化", "戦闘中の回復アイテム効果+15%"),
  },
  {
    id: "W13",
    name: "スカイハイ",
    powerPct: 86,
    tagline: "",
    members: ["ヴァルキー", "レヴント", "クリップトン"],
    passive: buildPassive("高所優位", "味方全員の弱狙い率+15%"),
  },
  {
    id: "W14",
    name: "デーモンクラン",
    powerPct: 84,
    tagline: "悪知恵の働く強豪",
    members: ["ラプソン", "プチソン", "エッソン"],
    passive: buildPassive("悪知恵", "敵1人を指定して命中率-6%"),
  },
  {
    id: "W15",
    name: "テイオウ",
    powerPct: 84,
    tagline: "安定感抜群",
    members: ["アカシーマ", "アオミン", "ムラバラ"],
    passive: buildPassive("帝王の安定", "味方全員の被弾率-3%"),
  },
  {
    id: "W16",
    name: "ウルフキッド",
    powerPct: 84,
    tagline: "最速移動チーム",
    members: ["ウルフ", "アンドル", "エクシーズ"],
    passive: buildPassive("最速", "味方全員のAgility+3"),
  },
  {
    id: "W17",
    name: "ディスティニーズ",
    powerPct: 84,
    tagline: "",
    members: ["ミミッキー", "ドーナルド", "プルフート"],
    passive: buildPassive("ドリーム連携", "味方全員のMove+1＆Armorダメージ-3%"),
  },
  {
    id: "W18",
    name: "ドンキホーテ",
    powerPct: 84,
    tagline: "",
    members: ["ドフラクック", "ディアマール", "ピースケ"],
    passive: buildPassive("支配者", "敵全体のMental-5%扱い"),
  },
  {
    id: "W19",
    name: "デビルバット",
    powerPct: 83,
    tagline: "エイム重視",
    members: ["ヒルーマ", "セナシールド", "モンタン"],
    passive: buildPassive("狙撃精度", "味方全員のAim+3"),
  },
  {
    id: "W20",
    name: "CP3",
    powerPct: 82,
    tagline: "",
    members: ["ルーチ", "カック", "カリーファ"],
    passive: buildPassive("諜報", "敵の弱狙い率+10%"),
  },
  {
    id: "W21",
    name: "イレブンズ",
    powerPct: 81,
    tagline: "",
    members: ["カーミュ", "レベーカ", "セニャ"],
    passive: buildPassive("イレブン連携", "味方全員のAim+2＆Agility+1"),
  },
  {
    id: "W22",
    name: "レインボーロード",
    powerPct: 81,
    tagline: "",
    members: ["アカスター", "アオアース", "キンミドリ"],
    passive: buildPassive("虹加速", "戦闘開始時、味方全員のAgility+2"),
  },
  {
    id: "W23",
    name: "アーティスト",
    powerPct: 80,
    tagline: "",
    members: ["ゴッホチー", "ピカソウ", "ミューシャ"],
    passive: buildPassive("芸術爆発", "味方全員のCrit率+2%＆命中率+1%"),
  },
  {
    id: "W24",
    name: "もののけ",
    powerPct: 80,
    tagline: "",
    members: ["ライジングサン", "アシタング", "デイダラ"],
    passive: buildPassive("霊気", "敵全体の被ダメージ+3%"),
  },
  {
    id: "W25",
    name: "かみかくし",
    powerPct: 80,
    tagline: "",
    members: ["チヒロ", "ユーババ", "カオアリ"],
    passive: buildPassive("神隠し", "戦闘開始時、敵1人の行動順を最後にする確率+50%"),
  },
  {
    id: "W26",
    name: "13階段",
    powerPct: 80,
    tagline: "",
    members: ["ぜムンクルス", "マルシャー", "サイクル"],
    passive: buildPassive("階段罠", "戦闘中1回だけ敵の攻撃をミスにする"),
  },
  {
    id: "W27",
    name: "ヴィランズ",
    powerPct: 79,
    tagline: "",
    members: ["マレフィファント", "ジャーファル", "ハーデス"],
    passive: buildPassive("悪意", "敵全体の回復量-12%"),
  },
  {
    id: "W28",
    name: "グリッチハンターズ",
    powerPct: 79,
    tagline: "",
    members: ["バグズ", "ノイズ", "パッチ"],
    passive: buildPassive("バグ侵食", "敵全体のAim-2"),
  },
  {
    id: "W29",
    name: "シーソルト",
    powerPct: 78,
    tagline: "",
    members: ["ロクス", "シオ", "アクリア"],
    passive: buildPassive("塩耐性", "味方全員の被ダメージ-4%"),
  },
  {
    id: "W30",
    name: "ハイパーカーニバル",
    powerPct: 78,
    tagline: "",
    members: ["ピエロック", "ショーマン", "ドラムン"],
    passive: buildPassive("盛り上げ", "戦闘中、味方全員のMental+5%扱い"),
  },
  {
    id: "W31",
    name: "テンテン",
    powerPct: 77,
    tagline: "",
    members: ["フーラ", "マーユ", "ヒューガ"],
    passive: buildPassive("点取り", "敵が倒れるたび味方全員のAim+1 ※最大+3"),
  },
  {
    id: "W32",
    name: "プリンセス",
    powerPct: 77,
    tagline: "",
    members: ["シンディララ", "シラユキ", "オーロラ"],
    passive: buildPassive("姫の加護", "戦闘中1回だけHPが0になった時HP1で耐える ※チームで1回"),
  },
  {
    id: "W33",
    name: "ナイトメア",
    powerPct: 77,
    tagline: "",
    members: ["ドレッド", "ファントム", "スリープ"],
    passive: buildPassive("悪夢", "敵全体のAgility-1＆命中率-1%"),
  },
  {
    id: "W34",
    name: "オーケストラ",
    powerPct: 76,
    tagline: "",
    members: ["ピッコロ", "チェロ", "パイプ"],
    passive: buildPassive("合奏", "味方全員のAim+1＆Agility+1"),
  },
  {
    id: "W35",
    name: "ネオンパルス",
    powerPct: 75,
    tagline: "",
    members: ["グロウ", "フラッシュ", "ビート"],
    passive: buildPassive("ネオン加速", "戦闘1ターン目だけ味方全員のAgility+4"),
  },
  {
    id: "W36",
    name: "クロノギア",
    powerPct: 73,
    tagline: "",
    members: ["タイム", "ギアード", "リセット"],
    passive: buildPassive("時間操作", "敵1人の行動を1回遅らせる確率+25%"),
  },
  {
    id: "W37",
    name: "メテオラッシ",
    powerPct: 71,
    tagline: "",
    members: ["メテオ", "ノヴァ", "スターロロ"],
    passive: buildPassive("隕石圧", "敵全体のArmor-5で開始"),
  },
  {
    id: "W38",
    name: "ラグーンレジェンド",
    powerPct: 71,
    tagline: "",
    members: ["ラグーナ", "コーラル", "シード"],
    passive: buildPassive("海底回復", "毎ターン味方全員Armor+2 ※最大100"),
  },
  {
    id: "W39",
    name: "ストームコア",
    powerPct: 70,
    tagline: "",
    members: ["サンダー", "タイフーン", "活火山"],
    passive: buildPassive("嵐", "戦闘開始時、敵全体の命中率-2%"),
  },
  {
    id: "W40",
    name: "マジシャンズ",
    powerPct: 85,
    tagline: "何をするか分からない恐ろしさ",
    members: ["カオスブラック", "イリュージョニスト", "サクリファイス"],
    passive: buildPassive("幻惑", "戦闘開始時、敵の弱狙い率を0%にする"),
  },
];

export const WORLD_TEAM_BY_ID = Object.fromEntries(WORLD_TEAMS.map(t => [t.id, t]));

export function getWorldTeamById(id) {
  return WORLD_TEAM_BY_ID[id] || null;
}

export function sortTeamsByPowerDesc(teams) {
  return [...teams].sort((a, b) => (b.powerPct ?? 0) - (a.powerPct ?? 0));
}
