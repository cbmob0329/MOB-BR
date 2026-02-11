'use strict';

/*
  sim_match_core.js
  - ローカル大会：5試合
  - 手動NEXT専用
  - ui_match.js を使用
  - 試合最新版仕様に準拠（ダウンなし）
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.sim = window.MOBBR.sim || {};

(function(){

  const MAP_PATH = 'maps/';

  const AREAS = {
    1:'neonhun.png',2:'neonhun.png',3:'neonhun.png',4:'neonhun.png',
    5:'neonmain.png',6:'neongym.png',
    7:'neonstreet.png',8:'neonstreet.png',
    9:'neonpap.png',10:'neonpap.png',
    11:'neonpal.png',12:'neonpal.png',
    13:'neonura.png',14:'neonura.png',15:'neonura.png',16:'neonura.png',
    17:'neonbrige.png',18:'neonfact.png',
    19:'neondon.png',20:'neondon.png',
    21:'neonske.png',22:'neonhimi.png',
    23:'neonlivehouse.png',24:'neonlivestage.png',
    25:'neonfinal.png'
  };

  const BATTLE_LINES = [
    "やってやんべ！","裏取るぞ！","展開する！","サポートするぞ！",
    "うわあー！","ミスった！","一気に行くぞ！","今のうちに回復だ！",
    "絶対勝つぞ！","撃て―！","なんて動きだ！","撃ちまくれ！",
    "グレ使う！","グレ投げろ！","リロードする！","被弾した！",
    "カバー頼む！","大丈夫か!?","走れーー！","耐えるぞー！"
  ];

  function rand(arr){
    return arr[(Math.random()*arr.length)|0];
  }

  async function runSingleMatch(matchIndex){

    const ui = window.MOBBR.ui.match;
    const battle = window.MOBBR.sim.matchFlow;

    // 会場到着
    await ui.showArrival('tent.png',"バトルスタート！","降下開始…！");

    // 初期エリア
    const startArea = 1 + ((Math.random()*16)|0);
    await ui.setBackground(MAP_PATH + AREAS[startArea]);
    await ui.showCenterLog3("降下完了","周囲を確認…","");

    let playerAlive = true;

    for(let round=1; round<=6; round++){

      await ui.showCenterLog3(`Round ${round} 開始！`,"","");

      if(round===6){
        await ui.setBackground(MAP_PATH + AREAS[25]);
      }

      // 交戦確率（仕様通り）
      const fightChance = (
        round===1 ? 0.6 :
        round===2 ? 0.7 :
        round===3 ? 0.75 :
        1.0
      );

      if(playerAlive && Math.random() < fightChance){

        // 敵選定（ローカルのみ）
        const enemyId = "local" + String(1 + (Math.random()*19|0)).padStart(2,'0');
        const enemyName = enemyId.toUpperCase();

        ui.setEnemy(enemyName, enemyId + ".png");

        // 接敵演出
        await ui.showContactIntro("PLAYER", enemyName);

        // 交戦ログ（演出）
        const lines = [];
        for(let i=0;i<10;i++){
          if(Math.random()<0.15){
            lines.push("ウルト行くぞ！");
          }else{
            lines.push(rand(BATTLE_LINES));
          }
        }

        await ui.playBattleChatter(lines,120);

        // 勝敗
        const win = Math.random() < 0.55;

        if(win){
          await ui.showBattleBanner(round===6?'finalwin':'win');
          await ui.showCenterLog3(rand([
            "よし！次に備えるぞ！",
            "やったー！勝ったぞ！",
            "ナイスー！"
          ]),"","");
        }else{
          playerAlive = false;
          await ui.showBattleBanner('lose');
          await ui.showCenterLog3(rand([
            "やられた..",
            "次だ次！",
            "負けちまった.."
          ]),"","");
          break;
        }
      }

      if(round<6){
        await ui.showMoveStart();
        const nextArea = Math.min(25, startArea + round);
        await ui.setBackground(MAP_PATH + AREAS[nextArea]);
        await ui.showCenterLog3("エリア到着","次の交戦に備える","");
      }
    }

    // result
    await ui.setBackground('battle.png');

    if(playerAlive){
      await ui.showCenterLog3("チャンピオン獲得！","ナイスチーム！！","");
    }else{
      await ui.showCenterLog3("試合終了","次は勝つぞ！","");
    }
  }

  async function startLocalTournament(){

    const ui = window.MOBBR.ui.match;

    ui.open();

    // チーム紹介（大会開始前のみ）
    await ui.showTeamIntroStart();
    await ui.showTeamList([{name:"PLAYER",power_rep:75}]); // 仮。後で実データに差替可

    await ui.showCenterLog3("それでは試合を開始します！","","");

    for(let i=1;i<=5;i++){
      await runSingleMatch(i);
      if(i<5){
        await ui.showCenterLog3(`第${i}試合終了`,`次の試合へ進む`,``);
      }
    }

    await ui.showCenterLog3("ローカル大会終了！","メイン画面へ戻ります","");
    ui.close();
  }

  window.MOBBR.sim.matchCore = {
    startLocalTournament
  };

})();
