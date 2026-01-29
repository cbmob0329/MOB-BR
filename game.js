了解。**③ game.js（フル）**いきます。
※ここでは **起動・メイン画面UI・修行横スライド強調・ログ・モーダル**までを確実に動かします。
（大会シミュ等は次のファイルで順番に追加）

```js
// MOB BR - game.js (v0.1)
// ルール：index.html の script は game.js 1本のみ
// このファイルは「起動・共通UI管理・画面遷移の土台」を担当

(() => {
  "use strict";

  /* =========================
    DOM
  ========================= */
  const $ = (id) => document.getElementById(id);

  const companyNameEl = $("companyName");
  const companyRankEl = $("companyRank");
  const teamNameEl = $("teamName");

  const btnTeam = $("btnTeam");
  const btnRecruit = $("btnRecruit");
  const btnGacha = $("btnGacha");
  const btnTournament = $("btnTournament");
  const btnMap = $("btnMap");
  const btnReset = $("btnReset");

  const sceneTitleEl = $("sceneTitle");
  const sceneBadgeEl = $("sceneBadge");
  const sceneTextEl  = $("sceneText");
  const hotBarEl = $("hotBar");

  const logEl = $("log");

  const trainListEl = $("trainList");
  const btnDoTrain = $("btnDoTrain");
  const btnClearLog = $("btnClearLog");

  const modalEl = $("modal");
  const modalTitleEl = $("modalTitle");
  const modalBodyEl = $("modalBody");
  const modalCloseEl = $("modalClose");
  const modalOkEl = $("modalOk");

  /* =========================
    Version
  ========================= */
  const VERSION = "v0.1";
  const versionValueEl = $("versionValue");
  if (versionValueEl) versionValueEl.textContent = VERSION;

  /* =========================
    Storage
  ========================= */
  const LS_KEY = "mobbr_save_v01";

  function loadSave() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function saveNow() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch (e) {
      // ignore
    }
  }

  /* =========================
    Utils
  ========================= */
  function nowTag() {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }

  function log(line) {
    const msg = `[${nowTag()}] ${line}\n`;
    logEl.textContent += msg;
    logEl.scrollTop = logEl.scrollHeight;
  }

  function setScene(title, badge, text) {
    sceneTitleEl.textContent = title;
    sceneBadgeEl.textContent = badge;
    sceneTextEl.textContent = text;
  }

  function setHot(text) {
    hotBarEl.textContent = text;
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  /* =========================
    Modal
  ========================= */
  function openModal(title, body) {
    modalTitleEl.textContent = title;
    modalBodyEl.textContent = body;
    modalEl.classList.remove("hidden");
    modalEl.setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    modalEl.classList.add("hidden");
    modalEl.setAttribute("aria-hidden", "true");
  }

  modalCloseEl.onclick = closeModal;
  modalOkEl.onclick = closeModal;
  modalEl.onclick = (e) => {
    if (e.target === modalEl) closeModal();
  };

  /* =========================
    State
  ========================= */
  const defaultState = {
    version: VERSION,

    companyName: "MOB COMPANY",
    companyRank: "A",
    teamName: "MOBCREW",

    // 育成（週進行の土台）
    week: 1,

    // 修行選択
    trainIndex: 0,

    // ログ設定
    logLines: [],

    // ここから後の大会・チーム・アイテム等は次ファイルで増やす
  };

  const loaded = loadSave();
  const state = loaded ? { ...defaultState, ...loaded } : { ...defaultState };

  /* =========================
    Train Menu (あなたの仕様の修行カテゴリ)
    射撃 / ダッシュ / パズル / 実戦 / 滝 / 研究 / 総合
    ※画像が来たらアイコン化する
  ========================= */
  const TRAIN_MENU = [
    { key: "shoot", name: "射撃", sub: "aim / recoil" },
    { key: "dash",  name: "ダッシュ", sub: "speed / move" },
    { key: "puzzle",name: "パズル", sub: "判断 / 思考" },
    { key: "field", name: "実戦", sub: "立ち回り" },
    { key: "fall",  name: "滝", sub: "メンタル" },
    { key: "lab",   name: "研究", sub: "分析" },
    { key: "all",   name: "総合", sub: "all exp +" },
  ];

  /* =========================
    Render Train Cards
    - 横スクロール
    - 中央に来たカードを強調（active）
  ========================= */
  function renderTrainCards() {
    trainListEl.innerHTML = "";

    TRAIN_MENU.forEach((t, i) => {
      const card = document.createElement("div");
      card.className = "trainCard";
      card.dataset.index = String(i);

      const title = document.createElement("div");
      title.className = "tTitle";
      title.textContent = t.name;

      const sub = document.createElement("div");
      sub.className = "tSub";
      sub.textContent = t.sub;

      card.appendChild(title);
      card.appendChild(sub);

      card.onclick = () => {
        state.trainIndex = i;
        highlightActiveTrain();
        saveNow();
        setHot(`修行：${TRAIN_MENU[state.trainIndex].name}`);
      };

      trainListEl.appendChild(card);
    });

    // 初期位置：選択中へ寄せる
    requestAnimationFrame(() => {
      scrollToTrain(state.trainIndex);
      highlightActiveTrain();
    });
  }

  function getTrainCards() {
    return Array.from(trainListEl.querySelectorAll(".trainCard"));
  }

  function highlightActiveTrain() {
    const cards = getTrainCards();
    cards.forEach((c) => c.classList.remove("active"));
    const active = cards[state.trainIndex];
    if (active) active.classList.add("active");
  }

  function scrollToTrain(index) {
    const cards = getTrainCards();
    const card = cards[index];
    if (!card) return;
    card.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }

  // スクロールして中央付近のカードを自動でactiveにする
  let railTick = 0;
  trainListEl.addEventListener("scroll", () => {
    // スクロールのたびに重くしない
    railTick++;
    const tick = railTick;
    requestAnimationFrame(() => {
      if (tick !== railTick) return;
      autoPickCenterTrain();
    });
  });

  function autoPickCenterTrain() {
    const cards = getTrainCards();
    if (!cards.length) return;

    const railRect = trainListEl.getBoundingClientRect();
    const centerX = railRect.left + railRect.width / 2;

    let bestIdx = 0;
    let bestDist = Infinity;

    cards.forEach((card, i) => {
      const r = card.getBoundingClientRect();
      const cardCenter = r.left + r.width / 2;
      const dist = Math.abs(cardCenter - centerX);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    });

    bestIdx = clamp(bestIdx, 0, TRAIN_MENU.length - 1);
    if (state.trainIndex !== bestIdx) {
      state.trainIndex = bestIdx;
      highlightActiveTrain();
      saveNow();
    }
  }

  /* =========================
    Top Inputs Sync
  ========================= */
  function syncTopInputsFromState() {
    companyNameEl.value = state.companyName;
    companyRankEl.value = state.companyRank;
    teamNameEl.value = state.teamName;
  }

  function bindTopInputs() {
    companyNameEl.addEventListener("input", () => {
      state.companyName = companyNameEl.value.trim() || "MOB COMPANY";
      saveNow();
    });
    companyRankEl.addEventListener("change", () => {
      state.companyRank = companyRankEl.value;
      saveNow();
    });
    teamNameEl.addEventListener("input", () => {
      state.teamName = teamNameEl.value.trim() || "MOBCREW";
      saveNow();
    });
  }

  /* =========================
    Screens (今はメインだけ)
  ========================= */
  const SCREENS = {
    MAIN: "MAIN",
  };

  function goMain() {
    setScene(
      "メイン画面",
      "READY",
      [
        "左メニューから進めます。",
        "",
        "■今この段階で動くもの",
        "・修行（横スライド、中央強調）",
        "・ログ",
        "・保存/ロード（ローカルストレージ）",
        "",
        "次：大会/チーム/マップ/戦闘を順番に実装します。",
      ].join("\n")
    );
    setHot(`READY / Week ${state.week}`);
    log("起動しました");
  }

  /* =========================
    Actions
  ========================= */
  function doTrainOnce() {
    const t = TRAIN_MENU[state.trainIndex];
    state.week += 1;
    saveNow();

    // ここは後でステータス実装に繋げる
    setHot(`Week ${state.week}：${t.name} 修行！`);
    log(`修行：${t.name}（Week ${state.week}）`);

    openModal(
      "修行結果",
      [
        `選択：${t.name}`,
        `週：${state.week}`,
        "",
        "※ステータス上昇の詳細は次の実装で反映します。",
      ].join("\n")
    );
  }

  function clearLog() {
    logEl.textContent = "";
    log("ログ消去");
  }

  function hardReset() {
    if (!confirm("本当にリセットしますか？（セーブが消えます）")) return;
    localStorage.removeItem(LS_KEY);
    location.reload();
  }

  /* =========================
    Left Menu Buttons (今は仮の通知だけ)
  ========================= */
  btnTeam.onclick = () => {
    openModal("チーム編成", "次のファイルで実装します。");
    log("チーム編成を開こうとしました");
  };
  btnRecruit.onclick = () => {
    openModal("勧誘", "次のファイルで実装します。");
    log("勧誘を開こうとしました");
  };
  btnGacha.onclick = () => {
    openModal("ガチャ", "次のファイルで実装します。");
    log("ガチャを開こうとしました");
  };
  btnTournament.onclick = () => {
    openModal("大会", "次のファイルで実装します。");
    log("大会を開こうとしました");
  };
  btnMap.onclick = () => {
    openModal("マップ", "次のファイルで実装します。");
    log("マップを開こうとしました");
  };

  btnReset.onclick = hardReset;

  btnDoTrain.onclick = doTrainOnce;
  btnClearLog.onclick = clearLog;

  /* =========================
    Boot
  ========================= */
  function boot() {
    syncTopInputsFromState();
    bindTopInputs();

    renderTrainCards();
    goMain();

    // 初期ログ少なめ
    setTimeout(() => {
      log("修行は下の横スライドから選べます");
    }, 150);
  }

  boot();
})();
```

次は **④ チーム編成（ui_team相当）** を入れるか、
あなたの順番指定が「④〜」で決まってるなら、その番号を教えて。
