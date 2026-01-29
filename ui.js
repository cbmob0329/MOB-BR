/* =========================================================
   ui.js (FULL)
   UI layer / helpers
   - game.js から window.UI を呼ぶ前提
   - index.html 側の要素が不足していても “落ちない” ように保険
   - ログ/モーダル/フェーズ表示/HUD更新を担当
   ========================================================= */

(() => {
  'use strict';

  const UI = {};

  // ----------------------------
  // DOM refs (optional)
  // ----------------------------
  const $ = (id) => document.getElementById(id);

  const dom = {
    root: null,
    log: null,
    hudCompany: null,
    hudRank: null,
    hudTeam: null,

    // modal
    modalWrap: null,
    modalBox: null,
    modalTitle: null,
    modalBody: null,
    modalClose: null,

    // phase badge (optional)
    phaseBadge: null,
  };

  // ----------------------------
  // Safe element create
  // ----------------------------
  function ensureRoot() {
    dom.root = dom.root || $('ui') || document.body;
  }

  function createEl(tag, attrs = {}, parent = null) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'style' && typeof v === 'object') {
        Object.assign(el.style, v);
      } else if (k === 'className') {
        el.className = v;
      } else if (k === 'text') {
        el.textContent = v;
      } else {
        el.setAttribute(k, v);
      }
    }
    if (parent) parent.appendChild(el);
    return el;
  }

  function ensureLog() {
    dom.log = dom.log || $('logText');
  }

  function ensureHUD() {
    dom.hudCompany = dom.hudCompany || $('hud_company');
    dom.hudRank = dom.hudRank || $('hud_rank');
    dom.hudTeam = dom.hudTeam || $('hud_team');
  }

  // ----------------------------
  // Modal
  // ----------------------------
  function ensureModal() {
    if (dom.modalWrap) return;

    ensureRoot();

    dom.modalWrap = createEl('div', {
      id: 'ui_modal_wrap',
      style: {
        position: 'absolute',
        left: '0',
        top: '0',
        width: '100%',
        height: '100%',
        display: 'none',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.55)',
        zIndex: '9999',
      }
    }, dom.root);

    dom.modalBox = createEl('div', {
      id: 'ui_modal_box',
      style: {
        width: 'min(520px, 92%)',
        maxHeight: '78%',
        background: 'rgba(20,20,20,0.95)',
        border: '2px solid rgba(255,255,255,0.18)',
        borderRadius: '14px',
        boxShadow: '0 16px 40px rgba(0,0,0,0.45)',
        padding: '14px 14px 12px',
        overflow: 'hidden',
      }
    }, dom.modalWrap);

    dom.modalTitle = createEl('div', {
      id: 'ui_modal_title',
      style: {
        fontFamily: 'system-ui, sans-serif',
        fontWeight: '800',
        fontSize: '16px',
        color: 'rgba(255,255,255,0.92)',
        marginBottom: '10px',
      },
      text: 'TITLE'
    }, dom.modalBox);

    dom.modalBody = createEl('div', {
      id: 'ui_modal_body',
      style: {
        fontFamily: 'system-ui, sans-serif',
        fontWeight: '700',
        fontSize: '13px',
        lineHeight: '1.6',
        color: 'rgba(255,255,255,0.80)',
        whiteSpace: 'pre-wrap',
        overflowY: 'auto',
        maxHeight: '52vh',
        paddingRight: '4px',
      },
      text: 'BODY'
    }, dom.modalBox);

    const row = createEl('div', {
      style: {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '10px',
        marginTop: '12px',
      }
    }, dom.modalBox);

    dom.modalClose = createEl('button', {
      id: 'ui_modal_close',
      style: {
        appearance: 'none',
        border: '1px solid rgba(255,255,255,0.22)',
        background: 'rgba(255,255,255,0.10)',
        color: 'rgba(255,255,255,0.92)',
        fontFamily: 'system-ui, sans-serif',
        fontWeight: '800',
        padding: '8px 14px',
        borderRadius: '10px',
        cursor: 'pointer',
      },
      text: '閉じる'
    }, row);

    dom.modalClose.addEventListener('click', () => UI.closeModal());
    dom.modalWrap.addEventListener('click', (e) => {
      if (e.target === dom.modalWrap) UI.closeModal();
    });

    // ESC close
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') UI.closeModal();
    });
  }

  UI.openModal = function(title, body) {
    ensureModal();
    dom.modalTitle.textContent = title || '';
    dom.modalBody.textContent = body || '';
    dom.modalWrap.style.display = 'flex';
  };

  UI.closeModal = function() {
    if (!dom.modalWrap) return;
    dom.modalWrap.style.display = 'none';
  };

  // ----------------------------
  // Phase badge (optional overlay)
  // ----------------------------
  function ensurePhaseBadge() {
    if (dom.phaseBadge) return;

    ensureRoot();

    // uiRootがposition:relativeでない場合もあるので、absoluteで置けるようにする
    // rootがbodyの場合は fixed にして視認性を確保
    const isBody = dom.root === document.body;

    dom.phaseBadge = createEl('div', {
      id: 'ui_phase_badge',
      style: {
        position: isBody ? 'fixed' : 'absolute',
        right: '10px',
        top: '10px',
        padding: '6px 10px',
        borderRadius: '10px',
        background: 'rgba(0,0,0,0.45)',
        border: '1px solid rgba(255,255,255,0.18)',
        color: 'rgba(255,255,255,0.85)',
        fontFamily: 'system-ui, sans-serif',
        fontWeight: '900',
        fontSize: '12px',
        zIndex: '9998',
        userSelect: 'none',
        pointerEvents: 'none',
      },
      text: 'PHASE'
    }, dom.root);
  }

  // ----------------------------
  // HUD + Log
  // ----------------------------
  UI.setHUD = function({ company, rank, team }) {
    ensureHUD();
    if (dom.hudCompany && company != null) dom.hudCompany.textContent = String(company);
    if (dom.hudRank && rank != null) dom.hudRank.textContent = String(rank);
    if (dom.hudTeam && team != null) dom.hudTeam.textContent = String(team);
  };

  UI.setLog = function(text) {
    ensureLog();
    if (dom.log) dom.log.textContent = String(text ?? '');
  };

  // ----------------------------
  // Phase change hook
  // ----------------------------
  UI.onPhaseChange = function(phase, game) {
    ensurePhaseBadge();
    dom.phaseBadge.textContent = `PHASE: ${phase}`;

    // 必要ならフェーズごとにボタン文言等も変える（index.htmlの構造に依存するので保険のみ）
    // 例：Skipをフェーズによって無効化、などは game.js で制御する想定
    // ここではログの補助表示のみ。
    if (game && typeof game === 'object') {
      // phaseごとの軽い案内を差し込む（邪魔しない）
      // ※ログ本文の上書きはしない。末尾に補助を付けたい場合は game.js が行う。
    }
  };

  // ----------------------------
  // Init
  // ----------------------------
  UI.init = function(game) {
    ensureRoot();
    ensureHUD();
    ensureLog();
    ensureModal();
    ensurePhaseBadge();

    // 初期HUD補完
    if (game) {
      UI.setHUD({
        company: game.companyName ?? 'MOB COMPANY',
        rank: game.companyRank != null ? `RANK ${game.companyRank}` : 'RANK ?',
        team: game.teamName ?? 'PLAYER TEAM',
      });
    }

    // rootがbody以外で position が未指定なら relative にして absolute配置を安全化
    if (dom.root && dom.root !== document.body) {
      const cs = getComputedStyle(dom.root);
      if (cs.position === 'static') dom.root.style.position = 'relative';
    }

    // 初期はモーダル閉
    UI.closeModal();
  };

  // expose
  window.UI = UI;
})();
