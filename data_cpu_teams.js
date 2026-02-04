/* =========================================================
   MOB BR - data_cpu_teams.js (FULL)
   - CPUチーム確定データ
   - local01〜local20
   - national01〜national39
   - world01〜world40
   ---------------------------------------------------------
   注意：
   ・teamId は画像名に直結（assets/<teamId>.png）
   ・総合力/個人%レンジは内部用データとして保持（UIに%は出さない）
========================================================= */

(function(){
  'use strict';

  const DataCPU = {};
  window.DataCPU = DataCPU;

  /* =========================
     TEAM DATA (確定)
  ========================== */
  const TEAMS = [
    // -------------------------
    // LOCAL (local01〜local20)
    // -------------------------
    mkTeam('local01','ハンマーズ',79, [
      mkMember('IGL','ブラウニー',75,81),
      mkMember('ATTACKER','キスケ',68,92),
      mkMember('SUPPORT','ヅッチー',73,85),
    ]),
    mkTeam('local02','マツヤマーズ',78, [
      mkMember('IGL','トニトニ',76,81),
      mkMember('ATTACKER','ロジャー',70,88),
      mkMember('SUPPORT','マルティン',74,84),
    ]),
    mkTeam('local03','ギャラクシー',73, [
      mkMember('IGL','スターズ',68,75),
      mkMember('ATTACKER','ロケッツ',60,88),
      mkMember('SUPPORT','グルトン',66,80),
    ]),
    mkTeam('local04','ビーダマンズ',72, [
      mkMember('IGL','フェニックス',68,74),
      mkMember('ATTACKER','ワイバーン',60,89),
      mkMember('SUPPORT','スフィンクス',66,78),
    ]),
    mkTeam('local05','マカイムラ',71, [
      mkMember('IGL','クサチー',67,74),
      mkMember('ATTACKER','メタッツ',61,83),
      mkMember('SUPPORT','グレムリン',66,80),
    ]),
    mkTeam('local06','温泉愛好会',69, [
      mkMember('IGL','どうごすけ',65,71),
      mkMember('ATTACKER','たかのこぞー',59,81),
      mkMember('SUPPORT','ひめひこっち',63,75),
    ]),
    mkTeam('local07','三色坊ちゃんズ',68, [
      mkMember('IGL','もちもち',64,70),
      mkMember('ATTACKER','あまあま',58,80),
      mkMember('SUPPORT','まんぷく',62,74),
    ]),
    mkTeam('local08','ファイアファイターズ',68, [
      mkMember('IGL','キャンプ',64,70),
      mkMember('ATTACKER','マキっち',56,82),
      mkMember('SUPPORT','トカゲイヌ',62,74),
    ]),
    mkTeam('local09','ゴーストライダー',67, [
      mkMember('IGL','ゴーストン',63,69),
      mkMember('ATTACKER','ゴスクー',57,79),
      mkMember('SUPPORT','おばけっち',61,73),
    ]),
    mkTeam('local10','ホイホイホイム',66, [
      mkMember('IGL','ホイスケ',62,68),
      mkMember('ATTACKER','ホイミー',56,77),
      mkMember('SUPPORT','ホームン',61,75),
    ]),
    mkTeam('local11','タートルパンチ',66, [
      mkMember('IGL','クリケット',62,69),
      mkMember('ATTACKER','ジャックハンマー',54,78),
      mkMember('SUPPORT','UFO',62,72),
    ]),
    mkTeam('local12','インファイト鉄工所',66, [
      mkMember('IGL','タツタフネス',60,66),
      mkMember('ATTACKER','スタースタミン',52,74),
      mkMember('SUPPORT','パワータウリン',59,78),
    ]),
    mkTeam('local13','アートロボッツ',66, [
      mkMember('IGL','ガンダヤンク',62,68),
      mkMember('ATTACKER','ザークック',56,78),
      mkMember('SUPPORT','エヴァリュー',60,72),
    ]),
    mkTeam('local14','ドングリ隊',58, [
      mkMember('IGL','ドン・ドングリーノ',52,72),
      mkMember('ATTACKER','グリノリオン',45,73),
      mkMember('SUPPORT','コロコ・ロコモコ',60,66),
    ]),
    mkTeam('local15','カミナダシモナダ',58, [
      mkMember('IGL','うみちりんぐ',52,62),
      mkMember('ATTACKER','かぜちーず',45,73),
      mkMember('SUPPORT','なみちっち',50,66),
    ]),
    mkTeam('local16','イチロクマルマルーズ',58, [
      mkMember('IGL','ヤンボータルト',52,66),
      mkMember('ATTACKER','ミカタルトン',45,73),
      mkMember('SUPPORT','まっちゃまちゃ',50,67),
    ]),
    mkTeam('local17','ヤマノコ',58, [
      mkMember('IGL','ハヤシ',52,62),
      mkMember('ATTACKER','コヤ',45,73),
      mkMember('SUPPORT','テンキ',50,66),
    ]),
    mkTeam('local18','キリノモリ',57, [
      mkMember('IGL','だいふく',51,61),
      mkMember('ATTACKER','まんじゅう',44,72),
      mkMember('SUPPORT','こな',49,65),
    ]),
    mkTeam('local19','ポコポコペン',57, [
      mkMember('IGL','らむね',51,61),
      mkMember('ATTACKER','さいだー',44,72),
      mkMember('SUPPORT','コロッケ',49,65),
    ]),
    mkTeam('local20','ポテサラ隊',57, [
      mkMember('IGL','ポテト',51,61),
      mkMember('ATTACKER','ハム',44,72),
      mkMember('SUPPORT','きゅうり',49,65),
    ]),

    // -------------------------
    // NATIONAL (national01〜national39)
    // -------------------------
    mkTeam('national01','シンビオッツ',85, [
      mkMember('IGL','ヴェノムン',81,87),
      mkMember('ATTACKER','カネイジ',74,97),
      mkMember('SUPPORT','スクリーム',79,91),
    ]),
    mkTeam('national02','スカイアイランドかみのしま',80, [
      mkMember('IGL','ゴッドエネルギー',80,94),
      mkMember('ATTACKER','マキシマム',69,89),
      mkMember('SUPPORT','エルトルーラー',74,86),
    ]),
    mkTeam('national03','スリラー団',79, [
      mkMember('IGL','モリアン',72,82),
      mkMember('ATTACKER','ペロナ',69,94),
      mkMember('SUPPORT','アブサロ',71,87),
    ]),
    mkTeam('national04','セトコーポレーション',78, [
      mkMember('IGL','セトノシン',75,86),
      mkMember('ATTACKER','ブルーオベリスク',68,90),
      mkMember('SUPPORT','アオメドラゴ',73,88),
    ]),
    mkTeam('national05','ミレニアムキングダム',78, [
      mkMember('IGL','キングアテム',74,82),
      mkMember('ATTACKER','マジシャンブラック',66,92),
      mkMember('SUPPORT','レッドオシリス',70,88),
    ]),
    mkTeam('national06','悪霊連合',78, [
      mkMember('IGL','ジャ・ハゴーン',73,84),
      mkMember('ATTACKER','ロクノテシードー',65,99),
      mkMember('SUPPORT','スリーアクリョウ',72,86),
    ]),
    mkTeam('national07','リベンジマリック',78, [
      mkMember('IGL','イシュタルノマリク',72,82),
      mkMember('ATTACKER','イエローゴッド・ラー',69,95),
      mkMember('SUPPORT','ヘルポエム',72,86),
    ]),
    mkTeam('national08','海の城ファイターズ',77, [
      mkMember('IGL','ザンテツアローン',73,83),
      mkMember('ATTACKER','タコスケハッチ',67,88),
      mkMember('SUPPORT','ムラサキオビ',71,85),
    ]),
    mkTeam('national09','エージェントスミーズ',78, [
      mkMember('IGL','スミス',61,85),
      mkMember('ATTACKER','ジョン',65,92),
      mkMember('SUPPORT','レオン',71,89),
    ]),
    mkTeam('national10','シニスタースリー',77, [
      mkMember('IGL','科学者オクトパス',74,83),
      mkMember('ATTACKER','トカゲのリザドン',66,88),
      mkMember('SUPPORT','砂人サンド',72,84),
    ]),
    mkTeam('national11','スパイダーズ',78, [
      mkMember('IGL','隣人ピーター',80,81),
      mkMember('ATTACKER','バンドマングウェン',66,94),
      mkMember('SUPPORT','ニューフェイスマイル',72,88),
    ]),
    mkTeam('national12','10年公演アンルーシア',77, [
      mkMember('IGL','海辺のヒュザ',73,79),
      mkMember('ATTACKER','剛腕マユ',66,88),
      mkMember('SUPPORT','二面のアン',72,91),
    ]),
    mkTeam('national13','ミュータントゴブリンズ',74, [
      mkMember('IGL','グリーン',71,76),
      mkMember('ATTACKER','ボブ',62,86),
      mkMember('SUPPORT','オズ',69,83),
    ]),
    mkTeam('national14','仮面ファイターバトロンズ',73, [
      mkMember('IGL','スピードブイスリー',68,79),
      mkMember('ATTACKER','カワノアマゾン',70,88),
      mkMember('SUPPORT','デンオウキ',67,81),
    ]),
    mkTeam('national15','名探偵シャーロック',73, [
      mkMember('IGL','コナンドシンイチ',69,85),
      mkMember('ATTACKER','ツルギノヘイジ',61,86),
      mkMember('SUPPORT','シーフキドキッド',68,82),
    ]),
    mkTeam('national16','黒のやつらKarasu',71, [
      mkMember('IGL','ジンジン',75,77),
      mkMember('ATTACKER','ウォーカー',58,88),
      mkMember('SUPPORT','ベルモット',66,89),
    ]),
    mkTeam('national17','スナカベ',70, [
      mkMember('IGL','タヌキチガーラ',67,86),
      mkMember('ATTACKER','職人カンクック',59,82),
      mkMember('SUPPORT','風のテマ',66,80),
    ]),
    mkTeam('national18','ダークス',70, [
      mkMember('IGL','レンノ',66,72),
      mkMember('ATTACKER','ルド',58,82),
      mkMember('SUPPORT','シス',64,76),
    ]),
    mkTeam('national19','チョコスタリオ',70, [
      mkMember('IGL','ウミチョ',66,77),
      mkMember('ATTACKER','ヤマチョ',58,82),
      mkMember('SUPPORT','ウルチョ',64,76),
    ]),
    mkTeam('national20','ミラージュ研究所',70, [
      mkMember('IGL','ミラーン',66,72),
      mkMember('ATTACKER','フェイクス',56,84),
      mkMember('SUPPORT','スモークン',65,79),
    ]),
    mkTeam('national21','モノクロ騎士団',70, [
      mkMember('IGL','クロナイト',66,72),
      mkMember('ATTACKER','シロナイト',58,82),
      mkMember('SUPPORT','グレイヴ',64,76),
    ]),
    mkTeam('national22','クリスマスキャメル',72, [
      mkMember('IGL','ギャンブルサンタ',60,84),
      mkMember('ATTACKER','ツイントナカイ',58,86),
      mkMember('SUPPORT','爆弾ツリー',65,79),
    ]),
    mkTeam('national23','クライクラウド',70, [
      mkMember('IGL','コオリノケイゴ',76,79),
      mkMember('ATTACKER','ガバカバッチ',57,85),
      mkMember('SUPPORT','トザンノガクト',65,79),
    ]),
    mkTeam('national24','フルスイング',70, [
      mkMember('IGL','アマノクニ',55,82),
      mkMember('ATTACKER','スピーディーピノ',56,86),
      mkMember('SUPPORT','キャプテンウシオ',69,79),
    ]),
    mkTeam('national25','東のリーク団',70, [
      mkMember('IGL','ボス・ク・リーク',60,79),
      mkMember('ATTACKER','オニギン',55,87),
      mkMember('SUPPORT','シールドパール',66,76),
    ]),
    mkTeam('national26','ウチジョーノ',69, [
      mkMember('IGL','時かけベビー',43,92),
      mkMember('ATTACKER','ショッカーズサイコ',56,86),
      mkMember('SUPPORT','アカメドラゴ',64,88),
    ]),
    mkTeam('national27','センゴク連合',70, [
      mkMember('IGL','シンゲンチタケノブ',65,71),
      mkMember('ATTACKER','ダテジャナイマサムン',67,81),
      mkMember('SUPPORT','サナダマルユキムラ',63,75),
    ]),
    mkTeam('national28','イエローレモンズ',68, [
      mkMember('IGL','ゲンゲン',64,70),
      mkMember('ATTACKER','ノジッコ',56,80),
      mkMember('SUPPORT','オオナミ',62,74),
    ]),
    mkTeam('national29','スモークキャッツ',68, [
      mkMember('IGL','クロ・ザ・ブラック',64,70),
      mkMember('ATTACKER','12サンゴ',56,80),
      mkMember('SUPPORT','カーヤ',62,74),
    ]),
    mkTeam('national30','ワルツ',68, [
      mkMember('IGL','クロイチ',65,71),
      mkMember('ATTACKER','クロニ',57,79),
      mkMember('SUPPORT','クロサン',64,76),
    ]),
    mkTeam('national31','NAGI食堂',65, [
      mkMember('IGL','ギンボシカレー',61,67),
      mkMember('ATTACKER','コスモン',53,77),
      mkMember('SUPPORT','オムライス',59,71),
    ]),
    mkTeam('national32','バクハツ工房',65, [
      mkMember('IGL','ドッカン老師',60,67),
      mkMember('ATTACKER','バチバチー',51,79),
      mkMember('SUPPORT','チリチリー',59,71),
    ]),
    mkTeam('national33','平和の象徴',65, [
      mkMember('IGL','せんとうもも',61,67),
      mkMember('ATTACKER','パシフィック',53,77),
      mkMember('SUPPORT','パシフィック2号',59,71),
    ]),
    mkTeam('national34','影ふみ隊',63, [
      mkMember('IGL','カゲロウ',59,69),
      mkMember('ATTACKER','フミフミ',51,75),
      mkMember('SUPPORT','ヨルスケ',57,69),
    ]),
    mkTeam('national35','ライトスモモンズ',62, [
      mkMember('IGL','ガンテツ',58,64),
      mkMember('ATTACKER','クサリマル',50,74),
      mkMember('SUPPORT','ブロックン',56,68),
    ]),
    mkTeam('national36','サクラバースト',60, [
      mkMember('IGL','ハナミ',56,62),
      mkMember('ATTACKER','サクラギ',48,72),
      mkMember('SUPPORT','ヨザクラ',54,66),
    ]),
    mkTeam('national37','カリブガブリチュウ',60, [
      mkMember('IGL','キッドライジン',65,69),
      mkMember('ATTACKER','カミナリオ',46,74),
      mkMember('SUPPORT','イナズマル',54,68),
    ]),
    mkTeam('national38','カワウソミュージック',60, [
      mkMember('IGL','カワノサメ',56,69),
      mkMember('ATTACKER','ウソターコイズ',48,72),
      mkMember('SUPPORT','イカラッパ',54,66),
    ]),
    mkTeam('national39','ドラゴンズベリー',58, [
      mkMember('IGL','ベリドラ',54,60),
      mkMember('ATTACKER','コドラ',46,70),
      mkMember('SUPPORT','リンドラ',52,64),
    ]),

    // -------------------------
    // WORLD (world01〜world40)
    // -------------------------
    mkTeam('world01','ホークス',95, [
      mkMember('IGL','アサモモ',92,97),
      mkMember('ATTACKER','ヨルモモ',82,99),
      mkMember('SUPPORT','ネコヤダイ',89,97),
    ]),
    mkTeam('world02','IFブラックオーダー',92, [
      mkMember('IGL','サノース',88,94),
      mkMember('ATTACKER','プロキシマン',78,99),
      mkMember('SUPPORT','マウマウ',86,98),
    ]),
    mkTeam('world03','フリーズマスターズ',90, [
      mkMember('IGL','フリーザー',85,92),
      mkMember('ATTACKER','クーラー',76,99),
      mkMember('SUPPORT','ゴールド',84,96),
    ]),
    mkTeam('world04','アカツキ',90, [
      mkMember('IGL','イカリーノ',86,92),
      mkMember('ATTACKER','イカススム',77,98),
      mkMember('SUPPORT','ヨジョウ',85,97),
    ]),
    mkTeam('world05','アンドロメダ',90, [
      mkMember('IGL','ジュピター',88,92),
      mkMember('ATTACKER','ムーン',80,95),
      mkMember('SUPPORT','アースドン',86,94),
    ]),
    mkTeam('world06','鬼ヶ島',90, [
      mkMember('IGL','カイドウロック',88,92),
      mkMember('ATTACKER','キングスキー',80,96),
      mkMember('SUPPORT','クイーンデフ',86,94),
    ]),
    mkTeam('world07','マリーンオフィス',89, [
      mkMember('IGL','アカイノシシ',84,91),
      mkMember('ATTACKER','キヒヒ',74,99),
      mkMember('SUPPORT','アオクジャク',83,95),
    ]),
    mkTeam('world08','読みかけの本',88, [
      mkMember('IGL','あのヒーロー',85,94),
      mkMember('ATTACKER','見習いビーム',81,96),
      mkMember('SUPPORT','いつかの巨人',84,94),
    ]),
    mkTeam('world09','ファーストレジェンズ',88, [
      mkMember('IGL','レイース',83,90),
      mkMember('ATTACKER','オックタン',74,99),
      mkMember('SUPPORT','ブラハン',82,94),
    ]),
    mkTeam('world10','ナンバーD',87, [
      mkMember('IGL','ルーフ',83,89),
      mkMember('ATTACKER','ゾーロ',74,98),
      mkMember('SUPPORT','ダイサンジ',81,93),
    ]),
    mkTeam('world11','ダブルマレフィセント',87, [
      mkMember('IGL','バルログキティ',83,89),
      mkMember('ATTACKER','サイコケロロン',78,98),
      mkMember('SUPPORT','シナンモン',81,93),
    ]),
    mkTeam('world12','ホールケーキファミリーズ',86, [
      mkMember('IGL','カタクリコ',82,88),
      mkMember('ATTACKER','クラッカー',72,98),
      mkMember('SUPPORT','クイーンママ',80,99),
    ]),
    mkTeam('world13','スカイハイムーブ',86, [
      mkMember('IGL','ヴァルキー',82,88),
      mkMember('ATTACKER','レヴント',72,98),
      mkMember('SUPPORT','クリップトン',80,92),
    ]),
    mkTeam('world14','デストロイネコヤシキ',88, [
      mkMember('IGL','ミケロックスキー',85,89),
      mkMember('ATTACKER','シマスカイ',77,92),
      mkMember('SUPPORT','ゴールデンキャット',80,90),
    ]),
    mkTeam('world15','シルバーウルフキッド',84, [
      mkMember('IGL','ウルフ',79,86),
      mkMember('ATTACKER','アンドル',70,96),
      mkMember('SUPPORT','エクシーズ',78,90),
    ]),
    mkTeam('world16','デーモンクラン',84, [
      mkMember('IGL','ラプソン',79,86),
      mkMember('ATTACKER','プチソン',70,96),
      mkMember('SUPPORT','エッソン',78,90),
    ]),
    mkTeam('world17','ディスティニーズ',84, [
      mkMember('IGL','ミミッキー',80,86),
      mkMember('ATTACKER','ドーナルド',72,94),
      mkMember('SUPPORT','プルフート',78,90),
    ]),
    mkTeam('world18','ドレスドンキホーテ',84, [
      mkMember('IGL','ドフラクック',80,86),
      mkMember('ATTACKER','ディアマール',72,94),
      mkMember('SUPPORT','ピースケ',78,90),
    ]),
    mkTeam('world19','シールドデビルバット',83, [
      mkMember('IGL','ヒルーマ',78,85),
      mkMember('ATTACKER','セナシールド',68,97),
      mkMember('SUPPORT','モンタン',77,89),
    ]),
    mkTeam('world20','CP3',82, [
      mkMember('IGL','ルーチ',78,89),
      mkMember('ATTACKER','カック',68,94),
      mkMember('SUPPORT','カリーファ',76,88),
    ]),
    mkTeam('world21','ベロニカイレブンズ',81, [
      mkMember('IGL','カーミュ',77,83),
      mkMember('ATTACKER','ウルトノーガ',77,93),
      mkMember('SUPPORT','セニャ',75,87),
    ]),
    mkTeam('world22','レインボーロード',81, [
      mkMember('IGL','キラアカスター',77,83),
      mkMember('ATTACKER','アオアース',67,93),
      mkMember('SUPPORT','キンミドリ',75,87),
    ]),
    mkTeam('world23','ワールドアーティスト',81, [
      mkMember('IGL','ゴッホチー',76,85),
      mkMember('ATTACKER','ピカソウ',76,92),
      mkMember('SUPPORT','ミューシャ',74,86),
    ]),
    mkTeam('world24','キャンディーもののけ',80, [
      mkMember('IGL','ライジングサン',76,89),
      mkMember('ATTACKER','アシタング',66,92),
      mkMember('SUPPORT','デイダラ',74,86),
    ]),
    mkTeam('world25','避雷針とかみかくし',80, [
      mkMember('IGL','リン・チヒーロ',76,82),
      mkMember('ATTACKER','ユーババ',66,92),
      mkMember('SUPPORT','カオノアリ',74,89),
    ]),
    mkTeam('world26','13階段',80, [
      mkMember('IGL','ぜムンクルス',76,82),
      mkMember('ATTACKER','マルシャー',66,92),
      mkMember('SUPPORT','サイクル',74,86),
    ]),
    mkTeam('world27','ワールドマジシャンズ',85, [
      mkMember('IGL','カオスブラック',78,88),
      mkMember('ATTACKER','イリュージョニスト',70,99),
      mkMember('SUPPORT','サクリファイス',80,92),
    ]),
    mkTeam('world28','スペースバーガーズ',79, [
      mkMember('IGL','チーズファントム',75,81),
      mkMember('ATTACKER','ポテトジャーファル',65,91),
      mkMember('SUPPORT','カフェハーデス',73,85),
    ]),
    mkTeam('world29','ホワイトタイガークロ―',79, [
      mkMember('IGL','バグズ',74,82),
      mkMember('ATTACKER','ノイズ',64,93),
      mkMember('SUPPORT','パッチ',73,85),
    ]),
    mkTeam('world30','コンバット007',78, [
      mkMember('IGL','ゴールデンロクス',74,87),
      mkMember('ATTACKER','シオ',64,90),
      mkMember('SUPPORT','アクリア',72,84),
    ]),
    mkTeam('world31','インフェルノモンスターズ',78, [
      mkMember('IGL','ピエロック',74,80),
      mkMember('ATTACKER','ショーマン',64,90),
      mkMember('SUPPORT','ドラムン',72,84),
    ]),
    mkTeam('world32','バスターハムスターズ',77, [
      mkMember('IGL','ハシルンデス',73,85),
      mkMember('ATTACKER','トットコ',63,89),
      mkMember('SUPPORT','ヒューガ',71,83),
    ]),
    mkTeam('world33','戦場のプリンセス',77, [
      mkMember('IGL','シンディララ',73,84),
      mkMember('ATTACKER','シラユキ',63,89),
      mkMember('SUPPORT','オーロラ',71,83),
    ]),
    mkTeam('world34','ナイトメアアイスキング',77, [
      mkMember('IGL','ドレッド',72,79),
      mkMember('ATTACKER','ファントム',61,99),
      mkMember('SUPPORT','スリープ',71,83),
    ]),
    mkTeam('world35','オーケストラサムライズ',76, [
      mkMember('IGL','ピッコロ',72,86),
      mkMember('ATTACKER','チェロ',62,88),
      mkMember('SUPPORT','パイプ',70,82),
    ]),
    mkTeam('world36','スカイロード31',75, [
      mkMember('IGL','グロウ',71,77),
      mkMember('ATTACKER','フラッシュ',61,87),
      mkMember('SUPPORT','ビート',69,81),
    ]),
    mkTeam('world37','クロノギアナイフ',73, [
      mkMember('IGL','タイム',69,75),
      mkMember('ATTACKER','ギアード',59,95),
      mkMember('SUPPORT','リセット',67,79),
    ]),
    mkTeam('world38','メテオストライカーズ',71, [
      mkMember('IGL','メテオ',67,73),
      mkMember('ATTACKER','ノヴァ',57,83),
      mkMember('SUPPORT','スターロロ',65,77),
    ]),
    mkTeam('world39','ラグーンレジェンド',71, [
      mkMember('IGL','ラグーナ',67,73),
      mkMember('ATTACKER','コーラル',57,83),
      mkMember('SUPPORT','シード',65,77),
    ]),
    mkTeam('world40','ジュラシックラプトルズ',75, [
      mkMember('IGL','サンダーブルー',66,82),
      mkMember('ATTACKER','タイフーン',56,89),
      mkMember('SUPPORT','活火山',64,76),
    ]),
  ];

  /* =========================
     PUBLIC API
  ========================== */

  DataCPU.getAllTeams = function(){
    // player は含めない（DataPlayer 側で扱う）
    return TEAMS.map(t => clone(t));
  };

  DataCPU.getById = function(teamId){
    const t = TEAMS.find(x => x.teamId === teamId);
    return t ? clone(t) : null;
  };

  /* =========================
     FACTORY
  ========================== */
  function mkTeam(teamId, name, basePower, members){
    return {
      isPlayer: false,
      teamId,
      name,
      image: `assets/${teamId}.png`,
      basePower,           // 総合力（内部用）
      members: members || []
    };
  }

  function mkMember(role, name, min, max){
    return { role, name, powerMin: min, powerMax: max };
  }

  function clone(v){
    return JSON.parse(JSON.stringify(v));
  }

})();
