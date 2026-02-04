/* =====================================================
   data_teams_national.js
   Source: CPUチーム確定.txt（ナショナル：national01〜 記載分）
   - 注意：原文に national40 の定義が無いため、本データも national39 まで
   ===================================================== */

(() => {

  const TEAMS_NATIONAL = [
    {
      id: "national01",
      name: "シンビオッツ",
      img: "national01.png",
      overall: 85,
      members: [
        { role: "IGL", name: "ヴェノムン", min: 81, max: 87 },
        { role: "アタッカー", name: "カネイジ", min: 74, max: 97 },
        { role: "サポーター", name: "スクリーム", min: 79, max: 91 },
      ],
    },
    {
      id: "national02",
      name: "スカイアイランドかみのしま",
      img: "national02.png",
      overall: 80,
      members: [
        { role: "IGL", name: "ゴッドエネルギー", min: 80, max: 94 },
        { role: "アタッカー", name: "マキシマム", min: 69, max: 89 },
        { role: "サポーター", name: "エルトルーラー", min: 74, max: 86 },
      ],
    },
    {
      id: "national03",
      name: "スリラー団",
      img: "national03.png",
      overall: 79,
      members: [
        { role: "IGL", name: "モリアン", min: 72, max: 82 },
        { role: "アタッカー", name: "ペロナ", min: 69, max: 94 },
        { role: "サポーター", name: "アブサロ", min: 71, max: 87 },
      ],
    },
    {
      id: "national04",
      name: "セトコーポレーション",
      img: "national04.png",
      overall: 78,
      members: [
        { role: "IGL", name: "セトノシン", min: 75, max: 86 },
        { role: "アタッカー", name: "ブルーオベリスク", min: 68, max: 90 },
        { role: "サポーター", name: "アオメドラゴ", min: 73, max: 88 },
      ],
    },
    {
      id: "national05",
      name: "ミレニアムキングダム",
      img: "national05.png",
      overall: 78,
      members: [
        { role: "IGL", name: "キングアテム", min: 74, max: 82 },
        { role: "アタッカー", name: "マジシャンブラック", min: 66, max: 92 },
        { role: "サポーター", name: "レッドオシリス", min: 70, max: 88 },
      ],
    },
    {
      id: "national06",
      name: "悪霊連合",
      img: "national06.png",
      overall: 78,
      members: [
        { role: "IGL", name: "ジャ・ハゴーン", min: 73, max: 84 },
        { role: "アタッカー", name: "ロクノテシードー", min: 65, max: 99 },
        { role: "サポーター", name: "スリーアクリョウ", min: 72, max: 86 },
      ],
    },
    {
      id: "national07",
      name: "リベンジマリック",
      img: "national07.png",
      overall: 78,
      members: [
        { role: "IGL", name: "イシュタルノマリク", min: 72, max: 82 },
        { role: "アタッカー", name: "イエローゴッド・ラー", min: 69, max: 95 },
        { role: "サポーター", name: "ヘルポエム", min: 72, max: 86 },
      ],
    },
    {
      id: "national08",
      name: "海の城ファイターズ",
      img: "national08.png",
      overall: 77,
      members: [
        { role: "IGL", name: "ザンテツアローン", min: 73, max: 83 },
        { role: "アタッカー", name: "タコスケハッチ", min: 67, max: 88 },
        { role: "サポーター", name: "ムラサキオビ", min: 71, max: 85 },
      ],
    },
    {
      id: "national09",
      name: "エージェントスミーズ",
      img: "national09.png",
      overall: 78,
      members: [
        { role: "IGL", name: "スミス", min: 61, max: 85 },
        { role: "アタッカー", name: "ジョン", min: 65, max: 92 },
        { role: "サポーター", name: "レオン", min: 71, max: 89 },
      ],
    },
    {
      id: "national10",
      name: "シニスタースリー",
      img: "national10.png",
      overall: 78,
      members: [
        { role: "IGL", name: "ボンド", min: 70, max: 82 },
        { role: "アタッカー", name: "ハニー", min: 66, max: 92 },
        { role: "サポーター", name: "Q", min: 70, max: 86 },
      ],
    },
    {
      id: "national11",
      name: "ジオラマ研究所",
      img: "national11.png",
      overall: 78,
      members: [
        { role: "IGL", name: "隣人ピーター", min: 80, max: 81 },
        { role: "アタッカー", name: "バンドマングウェン", min: 66, max: 94 },
        { role: "サポーター", name: "ニューフェイスマイル", min: 72, max: 88 },
      ],
    },
    {
      id: "national12",
      name: "10年公演アンルーシア",
      img: "national12.png",
      overall: 77,
      members: [
        { role: "IGL", name: "海辺のヒュザ", min: 73, max: 79 },
        { role: "アタッカー", name: "剛腕マユ", min: 66, max: 88 },
        { role: "サポーター", name: "二面のアン", min: 72, max: 91 },
      ],
    },
    {
      id: "national13",
      name: "ミュータントゴブリンズ",
      img: "national13.png",
      overall: 74,
      members: [
        { role: "IGL", name: "グリーン", min: 71, max: 76 },
        { role: "アタッカー", name: "ボブ", min: 62, max: 86 },
        { role: "サポーター", name: "オズ", min: 69, max: 83 },
      ],
    },
    {
      id: "national14",
      name: "仮面ファイターバトロンズ",
      img: "national14.png",
      overall: 73,
      members: [
        { role: "IGL", name: "スピードブイスリー", min: 68, max: 79 },
        { role: "アタッカー", name: "カワノアマゾン", min: 70, max: 88 },
        { role: "サポーター", name: "デンオウキ", min: 67, max: 81 },
      ],
    },
    {
      id: "national15",
      name: "名探偵シャーロック",
      img: "national15.png",
      overall: 73,
      members: [
        { role: "IGL", name: "コナンドシンイチ", min: 69, max: 85 },
        { role: "アタッカー", name: "ツルギノヘイジ", min: 61, max: 86 },
        { role: "サポーター", name: "シーフキドキッド", min: 68, max: 82 },
      ],
    },
    {
      id: "national16",
      name: "黒のやつらKarasu",
      img: "national16.png",
      overall: 71,
      members: [
        { role: "IGL", name: "ジンジン", min: 75, max: 77 },
        { role: "アタッカー", name: "ウォーカー", min: 58, max: 88 },
        { role: "サポーター", name: "ベルモット", min: 66, max: 89 },
      ],
    },
    {
      id: "national17",
      name: "スナカベ",
      img: "national17.png",
      overall: 70,
      members: [
        { role: "IGL", name: "タヌキチガーラ", min: 67, max: 86 },
        { role: "アタッカー", name: "職人カンクック", min: 59, max: 82 },
        { role: "サポーター", name: "風のテマ", min: 66, max: 80 },
      ],
    },
    {
      id: "national18",
      name: "ダークス",
      img: "national18.png",
      overall: 70,
      members: [
        { role: "IGL", name: "レンノ", min: 66, max: 72 },
        { role: "アタッカー", name: "ルド", min: 58, max: 82 },
        { role: "サポーター", name: "シス", min: 64, max: 76 },
      ],
    },
    {
      id: "national19",
      name: "チョコスタリオ",
      img: "national19.png",
      overall: 70,
      members: [
        { role: "IGL", name: "ウミチョ", min: 66, max: 77 },
        { role: "アタッカー", name: "ヤマチョ", min: 58, max: 82 },
        { role: "サポーター", name: "ウルチョ", min: 64, max: 76 },
      ],
    },
    {
      id: "national20",
      name: "ミラージュ研究所",
      img: "national20.png",
      overall: 70,
      members: [
        { role: "IGL", name: "サイコレンズ", min: 66, max: 72 },
        { role: "アタッカー", name: "ハイパーピクセル", min: 58, max: 82 },
        { role: "サポーター", name: "ミラーシールド", min: 64, max: 76 },
      ],
    },
    {
      id: "national21",
      name: "おかしな水族館",
      img: "national21.png",
      overall: 69,
      members: [
        { role: "IGL", name: "イルカス", min: 65, max: 71 },
        { role: "アタッカー", name: "サメゴン", min: 59, max: 81 },
        { role: "サポーター", name: "クラゲーネ", min: 63, max: 75 },
      ],
    },
    {
      id: "national22",
      name: "海の城パトロール",
      img: "national22.png",
      overall: 69,
      members: [
        { role: "IGL", name: "サメダチ", min: 65, max: 71 },
        { role: "アタッカー", name: "タコノコ", min: 59, max: 81 },
        { role: "サポーター", name: "イカッパ", min: 63, max: 75 },
      ],
    },
    {
      id: "national23",
      name: "銀河カフェ",
      img: "national23.png",
      overall: 69,
      members: [
        { role: "IGL", name: "カフェスター", min: 65, max: 71 },
        { role: "アタッカー", name: "ラテロケッツ", min: 59, max: 81 },
        { role: "サポーター", name: "ミルクグルトン", min: 63, max: 75 },
      ],
    },
    {
      id: "national24",
      name: "夜ふかしラボ",
      img: "national24.png",
      overall: 68,
      members: [
        { role: "IGL", name: "ヨルカガク", min: 64, max: 70 },
        { role: "アタッカー", name: "フヨウ", min: 58, max: 80 },
        { role: "サポーター", name: "ネムラボ", min: 62, max: 74 },
      ],
    },
    {
      id: "national25",
      name: "星の工務店",
      img: "national25.png",
      overall: 68,
      members: [
        { role: "IGL", name: "ホシビルド", min: 64, max: 70 },
        { role: "アタッカー", name: "カナヅチ", min: 58, max: 80 },
        { role: "サポーター", name: "セメントン", min: 62, max: 74 },
      ],
    },
    {
      id: "national26",
      name: "ビート農園",
      img: "national26.png",
      overall: 68,
      members: [
        { role: "IGL", name: "ビートマスター", min: 64, max: 70 },
        { role: "アタッカー", name: "コーン", min: 58, max: 80 },
        { role: "サポーター", name: "トマトン", min: 62, max: 74 },
      ],
    },
    {
      id: "national27",
      name: "ゴロゴロ商会",
      img: "national27.png",
      overall: 67,
      members: [
        { role: "IGL", name: "ゴロキング", min: 63, max: 69 },
        { role: "アタッカー", name: "バクバク", min: 57, max: 79 },
        { role: "サポーター", name: "ゴロミン", min: 61, max: 73 },
      ],
    },
    {
      id: "national28",
      name: "みかん武装隊",
      img: "national28.png",
      overall: 67,
      members: [
        { role: "IGL", name: "ミカンチーフ", min: 63, max: 69 },
        { role: "アタッカー", name: "カンキツ", min: 57, max: 79 },
        { role: "サポーター", name: "ミカポ", min: 61, max: 73 },
      ],
    },
    {
      id: "national29",
      name: "コロコロ新聞部",
      img: "national29.png",
      overall: 67,
      members: [
        { role: "IGL", name: "シンブン", min: 63, max: 69 },
        { role: "アタッカー", name: "ヘッドライン", min: 57, max: 79 },
        { role: "サポーター", name: "スクープ", min: 61, max: 73 },
      ],
    },
    {
      id: "national30",
      name: "ギンボシ食堂",
      img: "national30.png",
      overall: 65,
      members: [
        { role: "IGL", name: "ギンボシカレー", min: 61, max: 67 },
        { role: "アタッカー", name: "コスモン", min: 53, max: 77 },
        { role: "サポーター", name: "オムライス", min: 59, max: 71 },
      ],
    },
    {
      id: "national31",
      name: "バクハツ工房",
      img: "national31.png",
      overall: 65,
      members: [
        { role: "IGL", name: "ドッカン老師", min: 60, max: 67 },
        { role: "アタッカー", name: "バチバチー", min: 51, max: 79 },
        { role: "サポーター", name: "チリチリー", min: 59, max: 71 },
      ],
    },
    {
      id: "national32",
      name: "平和の象徴",
      img: "national32.png",
      overall: 65,
      members: [
        { role: "IGL", name: "せんとうもも", min: 61, max: 67 },
        { role: "アタッカー", name: "パシフィック", min: 53, max: 77 },
        { role: "サポーター", name: "パシフィック2号", min: 59, max: 71 },
      ],
    },
    {
      id: "national33",
      name: "影ふみ隊",
      img: "national33.png",
      overall: 63,
      members: [
        { role: "IGL", name: "カゲロウ", min: 59, max: 69 },
        { role: "アタッカー", name: "フミフミ", min: 51, max: 75 },
        { role: "サポーター", name: "ヨルスケ", min: 57, max: 69 },
      ],
    },
    {
      id: "national34",
      name: "ライトスモモンズ",
      img: "national34.png",
      overall: 62,
      members: [
        { role: "IGL", name: "ガンテツ", min: 58, max: 64 },
        { role: "アタッカー", name: "クサリマル", min: 50, max: 74 },
        { role: "サポーター", name: "ブロックン", min: 56, max: 68 },
      ],
    },
    {
      id: "national35",
      name: "サクラバースト",
      img: "national35.png",
      overall: 60,
      members: [
        { role: "IGL", name: "ハナミ", min: 56, max: 62 },
        { role: "アタッカー", name: "サクラギ", min: 48, max: 72 },
        { role: "サポーター", name: "ヨザクラ", min: 54, max: 66 },
      ],
    },
    {
      id: "national36",
      name: "カリブガブリチュウ",
      img: "national36.png",
      overall: 60,
      members: [
        { role: "IGL", name: "キッドライジン", min: 65, max: 69 },
        { role: "アタッカー", name: "カミナリオ", min: 46, max: 74 },
        { role: "サポーター", name: "イナズマル", min: 54, max: 68 },
      ],
    },
    {
      id: "national37",
      name: "カワウソミュージック",
      img: "national37.png",
      overall: 60,
      members: [
        { role: "IGL", name: "カワノサメ", min: 56, max: 69 },
        { role: "アタッカー", name: "ウソターコイズ", min: 48, max: 72 },
        { role: "サポーター", name: "イカラッパ", min: 54, max: 66 },
      ],
    },
    {
      id: "national38",
      name: "ドラゴンズベリー",
      img: "national38.png",
      overall: 58,
      members: [
        { role: "IGL", name: "ベリドラ", min: 54, max: 60 },
        { role: "アタッカー", name: "コドラ", min: 46, max: 70 },
        { role: "サポーター", name: "リンドラ", min: 52, max: 64 },
      ],
    },
    {
      id: "national39",
      name: "ドラゴンズベリー",
      img: "national39.png",
      overall: 58,
      members: [
        { role: "IGL", name: "ベリドラ", min: 54, max: 60 },
        { role: "アタッカー", name: "コドラ", min: 46, max: 70 },
        { role: "サポーター", name: "リンドラ", min: 52, max: 64 },
      ],
    },
  ];

  window.TEAMS_NATIONAL = TEAMS_NATIONAL;

})();
