/* =====================================================
   game.js  (FULL)
   MOB Tournament Simulation
   中央制御・週進行・基本イベント管理
   ===================================================== */

/* ====== Global Access ====== */
const Game = {};
window.Game = Game;

/* ====== DOM ====== */
Game.dom = {
  date: document.getElementById('current-date'),
  nextTournamentName: document.getElementById('next-tournament-name'),
  nextTournamentDate: document.getElementById('next-tournament-date'),
  goldValue: document.getElementById('gold-value'),

  mainImage: document.getElementById('main-image'),
  playerTeamImage: document.getElementById('player-team-image'),
  logArea: document.getElementById('log-area'),

  btnTeam: document.getElementById('btn-team'),
  btnTournament: document.getElementById('btn-tournament'),
  btnTraining: document.getElementById('btn-training'),
  btnShop: document.getElementById('btn-shop'),
};

/* ====== Init ====== */
Game.init = function () {
  State.init();
  UI.init();
  Assets.init();

  Game.updateHeader();
  Game.log('ゲーム開始');

  Game.bindButtons();
};

/* ====== Header Update ====== */
Game.updateHeader = function () {
  const time = State.time;
  Game.dom.date.textContent =
    `${time.year}年 第${time.week}週`;

  Game.dom.nextTournamentName.textContent =
    time.nextTournament.name;

  Game.dom.nextTournamentDate.textContent =
    time.nextTournament.date;

  Game.dom.goldValue.textContent = State.gold;
};

/* ====== Logging ====== */
Game.log = function (text) {
  const div = document.createElement('div');
  div.className = 'log-line';
  div.textContent = text;
  Game.dom.logArea.appendChild(div);
  Game.dom.logArea.scrollTop = Game.dom.logArea.scrollHeight;
};

/* ====== Button Bindings ====== */
Game.bindButtons = function () {

  // TEAM
  Game.dom.btnTeam.addEventListener('dblclick', () => {
    UI.openTeamMenu();
  });

  // TOURNAMENT
  Game.dom.btnTournament.addEventListener('dblclick', () => {
    UI.openTournamentMenu();
  });

  // TRAINING
  Game.dom.btnTraining.addEventListener('dblclick', () => {
    UI.openTrainingMenu();
  });

  // SHOP
  Game.dom.btnShop.addEventListener('dblclick', () => {
    UI.openShopMenu();
  });
};

/* ====== Weekly Progress ====== */
Game.nextWeek = function () {
  State.time.week++;

  // 年送り
  if (State.time.week > 52) {
    State.time.week = 1;
    State.time.year++;
    Game.log(`${State.time.year - 1}年が終了しました`);
  }

  Game.log(`第${State.time.week}週 開始`);

  Game.grantWeeklyGold();
  Game.checkTournamentTrigger();
  Game.updateHeader();
};

/* ====== Gold Gain ====== */
Game.grantWeeklyGold = function () {
  const rank = State.companyRank;
  let gain = 0;

  if (rank <= 5) gain = 500;
  else if (rank <= 10) gain = 800;
  else if (rank <= 20) gain = 1000;
  else if (rank <= 30) gain = 2000;
  else gain = 3000;

  State.gold += gain;
  Game.log(`${gain}G 獲得！`);
};

/* ====== Tournament Trigger ====== */
Game.checkTournamentTrigger = function () {
  const event = State.getTournamentAtCurrentTime();
  if (!event) return;

  Game.log(`大会期間：${event.name}`);

  UI.confirm(
    `大会「${event.name}」に出場しますか？`,
    () => {
      Game.startTournament(event);
    }
  );
};

/* ====== Tournament Start ====== */
Game.startTournament = function (event) {
  Game.log(`${event.name} 開始！`);

  // マップ切替
  Assets.setMainImage('map.png');

  // シミュレーション開始
  SimTournament.start(event, (result) => {
    Game.onTournamentEnd(result);
  });
};

/* ====== Tournament End ====== */
Game.onTournamentEnd = function (result) {
  Game.log(`${result.name} 終了`);

  State.applyTournamentResult(result);

  Assets.setMainImage('main1.png');
  Game.updateHeader();
};

/* ====== Image Helpers ====== */
Game.setPlayerImage = function (src) {
  Game.dom.playerTeamImage.src = src;
};

/* ====== Boot ====== */
window.addEventListener('load', () => {
  Game.init();
});
