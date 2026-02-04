/* =====================================================
   ui.js
   - 画面表示（紙芝居レイヤー）
   - 左：プレイヤー / 右：敵チーム
   - 中央：ログ枠（RPG風）
   - result / 総合result / ランキング表示（汎用テーブル）
   ===================================================== */

/* global Assets, State */

(() => {

  const UI = {
    els: {
      root: null,
      bg: null,
      player: null,
      enemy: null,
      logLayer: null,
      logBox: null,
      logText: null,
      nextBtn: null,
      autoBtn: null,
      overlay: null, // result 等の表示用（動的生成）
    },

    init() {
      this.els.root = document.getElementById('game-root');
      this.els.bg = document.getElementById('bg-layer');
      this.els.player = document.getElementById('player-layer');
      this.els.enemy = document.getElementById('enemy-layer');
      this.els.logLayer = document.getElementById('log-layer');
      this.els.logBox = document.getElementById('log-box');
      this.els.logText = document.getElementById('log-text');
      this.els.nextBtn = document.getElementById('btn-next');
      this.els.autoBtn = document.getElementById('btn-auto');

      // overlay（テーブル系表示）を log-layer に作る（HTMLは増やさず動的）
      this.els.overlay = document.createElement('div');
      this.els.overlay.id = 'ui-overlay';
      this.els.overlay.style.position = 'absolute';
      this.els.overlay.style.inset = '0';
      this.els.overlay.style.display = 'none';
      this.els.overlay.style.alignItems = 'center';
      this.els.overlay.style.justifyContent = 'center';
      this.els.overlay.style.padding = '14px';
      this.els.overlay.style.pointerEvents = 'none'; // UI操作は下のボタンで
      this.els.logLayer.appendChild(this.els.overlay);

      // 初期クリア
      this.clearOverlay();
      this.setLog(['準備中…']);
    },

    /* =====================================
       ログ表示
       ===================================== */
    setLog(lines) {
      this.clearOverlay();

      const arr = Array.isArray(lines) ? lines : [String(lines ?? '')];
      this.els.logText.textContent = arr.join('\n');
    },

    /* =====================================
       プレイヤー表示
       ===================================== */
    showPlayer() {
      // 装備中P?.png の概念：Stateが無い/未実装でも破綻しないようにフォールバック
      const file = this._getEquippedPlayerImageFile();

      this._setSideImage(this.els.player, file, {
        label: this._getPlayerTeamName(),
        labelId: 'player-label',
      });
    },

    /* =====================================
       敵表示
       ===================================== */
    showEnemy(enemyTeamId, enemyTeamName) {
      // teamId.png を表示する（命名規則確定）
      const file = `${enemyTeamId}.png`;

      this._setSideImage(this.els.enemy, file, {
        label: enemyTeamName || enemyTeamId,
        labelId: 'enemy-label',
      });
    },

    hideEnemy() {
      this.els.enemy.innerHTML = '';
    },

    /* =====================================
       Result 表示（汎用テーブル）
       - summary の形は state.js 側で確定するが、
         ここでは「columns/rows/title」を受け取れれば描ける形にする
       ===================================== */
    showResultTable(summary) {
      this.clearOverlay();

      const title = (summary && summary.title) ? String(summary.title) : 'result';
      const columns = (summary && Array.isArray(summary.columns)) ? summary.columns : null;
      const rows = (summary && Array.isArray(summary.rows)) ? summary.rows : null;

      // columns/rows が無い場合でも破綻させない（State側が未実装でも画面が止まらない）
      const safeColumns = columns || ['順位', 'チーム', 'Total'];
      const safeRows = rows || [];

      const wrap = document.createElement('div');
      wrap.className = 'table-wrap';
      wrap.style.pointerEvents = 'auto'; // スクロール可能にする（スマホ想定）

      const h = document.createElement('div');
      h.style.marginBottom = '10px';
      h.style.fontWeight = '900';
      h.style.letterSpacing = '.05em';
      h.style.textAlign = 'center';
      h.textContent = title;

      const table = document.createElement('table');

      const thead = document.createElement('thead');
      const trh = document.createElement('tr');
      for (const c of safeColumns) {
        const th = document.createElement('th');
        th.textContent = String(c);
        trh.appendChild(th);
      }
      thead.appendChild(trh);
      table.appendChild(thead);

      const tbody = document.createElement('tbody');

      for (const r of safeRows) {
        const tr = document.createElement('tr');

        // 行は「配列」or「オブジェクト」両対応
        if (Array.isArray(r)) {
          for (let i = 0; i < safeColumns.length; i++) {
            const td = document.createElement('td');
            td.textContent = (r[i] === undefined || r[i] === null) ? '' : String(r[i]);
            tr.appendChild(td);
          }
        } else if (r && typeof r === 'object') {
          for (const c of safeColumns) {
            const td = document.createElement('td');
            const key = String(c);
            td.textContent = (r[key] === undefined || r[key] === null) ? '' : String(r[key]);
            tr.appendChild(td);
          }
        } else {
          // 不正行は空行として扱う
          for (let i = 0; i < safeColumns.length; i++) {
            const td = document.createElement('td');
            td.textContent = '';
            tr.appendChild(td);
          }
        }

        tbody.appendChild(tr);
      }

      // rows が空の場合は案内行
      if (safeRows.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = safeColumns.length;
        td.style.textAlign = 'center';
        td.style.padding = '18px 8px';
        td.textContent = '（結果データ準備中）';
        tr.appendChild(td);
        tbody.appendChild(tr);
      }

      table.appendChild(tbody);
      wrap.appendChild(table);

      const box = document.createElement('div');
      box.style.display = 'flex';
      box.style.flexDirection = 'column';
      box.style.alignItems = 'center';
      box.style.gap = '8px';
      box.appendChild(h);
      box.appendChild(wrap);

      this.els.overlay.innerHTML = '';
      this.els.overlay.appendChild(box);
      this.els.overlay.style.display = 'flex';

      // ログ枠はテーブル時は空に（視認性優先）
      this.els.logText.textContent = '';
    },

    /* =====================================
       大会結果（中央メッセージ＋必要ならテーブル）
       ===================================== */
    showTournamentResult(res) {
      this.clearOverlay();

      // winner.png の前面に優勝チーム画像も表示する想定（game.js側で背景は切替済み）
      // ここではログ表示を担う
      const msg = [];
      if (res && res.message) {
        msg.push(String(res.message));
      } else {
        msg.push('大会が終了しました！');
      }

      // 追加情報（任意）
      if (res && res.subMessage) msg.push(String(res.subMessage));

      // 大会総合表を渡されたら表示
      if (res && (res.columns || res.rows)) {
        this.showResultTable({
          title: res.title || '総合順位',
          columns: res.columns,
          rows: res.rows,
        });
        return;
      }

      this.setLog(msg);
    },

    /* =====================================
       内部：overlay を消す
       ===================================== */
    clearOverlay() {
      if (!this.els.overlay) return;
      this.els.overlay.style.display = 'none';
      this.els.overlay.innerHTML = '';
    },

    /* =====================================
       内部：左右の画像＋ラベル
       ===================================== */
    _setSideImage(sideEl, fileName, opts) {
      sideEl.innerHTML = '';

      const label = document.createElement('div');
      label.className = 'team-label';
      label.id = opts && opts.labelId ? opts.labelId : '';
      label.textContent = (opts && opts.label) ? String(opts.label) : '';
      sideEl.appendChild(label);

      const img = document.createElement('img');
      img.alt = fileName;

      // Assets がまだ無い/未実装でも動くようにする
      img.src = this._resolveImageSrc(fileName);

      // pixel-art 表示
      img.style.imageRendering = 'pixelated';

      sideEl.appendChild(img);
    },

    _resolveImageSrc(fileName) {
      try {
        if (window.Assets && typeof window.Assets.getImageSrc === 'function') {
          return window.Assets.getImageSrc(fileName);
        }
      } catch (e) {
        // noop
      }
      return `./${fileName}`;
    },

    _getEquippedPlayerImageFile() {
      try {
        if (window.State && typeof window.State.getEquippedPlayerImageFile === 'function') {
          const f = window.State.getEquippedPlayerImageFile();
          if (f) return String(f);
        }
      } catch (e) {
        // noop
      }
      return 'P1.png';
    },

    _getPlayerTeamName() {
      try {
        if (window.State && typeof window.State.getPlayerTeamName === 'function') {
          const n = window.State.getPlayerTeamName();
          if (n) return String(n);
        }
      } catch (e) {
        // noop
      }
      return 'あなたの部隊';
    },
  };

  window.UI = UI;

})();
