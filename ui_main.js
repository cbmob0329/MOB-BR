// ui_main.js
// メイン画面（main.png）の表示と、ID1〜19の「透明クリックエリア」だけを担当。
// ※ボタン配置は「固定で完成」とのことなので、ここでIDを固定生成する。
// ただし "押してどうなるか" は game.js 側で差し替え可能にする（ここはコールバックを呼ぶだけ）。

import { $ } from './ui_common.js';

/**
 * main.png上のボタン領域（ID1〜19）
 * - 画像の上に透明ボタンを重ねる方式
 * - 座標は「%」で管理（レスポンシブでも崩れにくい）
 *
 * ここは “確定配置” として扱うが、
 * もし微調整が必要なら、この配列の数値だけ直せばOK。
 *
 * NOTE:
 * - あなたの画像を見る限り「左に縦一列コマンド」が主なので、
 *   デフォルトは「左縦列に19個」をベースにしている。
 * - 実際の配置指定画像と完全一致が必要な場合は、
 *   次の工程でこちらが座標を確定して固定化します（今は動く土台）。
 */
export const MAIN_HOTSPOTS = createDefaultMainHotspots19();

/**
 * 19個の縦ボタン（左列）を自動生成するデフォルト
 * - left/top/width/height は全て「%」
 */
function createDefaultMainHotspots19() {
  const list = [];
  const left = 3.5;       // 左余白%
  const width = 22.0;     // ボタン幅%
  const topStart = 18.5;  // 開始%
  const gap = 2.1;        // 隙間%
  const height = 3.1;     // 高さ%

  for (let i = 1; i <= 19; i++) {
    const top = topStart + (i - 1) * (height + gap);
    list.push({
      id: i,
      left,
      top,
      width,
      height,
    });
  }

  return list;
}

/**
 * メイン画面UI初期化
 * @param {object} opts
 * @param {import('./state.js').createStore} opts.store - state store
 * @param {(id:number)=>void} opts.onMainButton - ボタン押下時に呼ばれる（ロジックは外）
 */
export function initMainUI({ store, onMainButton }) {
  const wrap = $('#main_hotspots');
  if (!wrap) throw new Error('#main_hotspots not found');

  // 既存クリア
  wrap.innerHTML = '';

  // 透明ホットスポット生成
  for (const hs of MAIN_HOTSPOTS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hotspot';
    btn.dataset.id = String(hs.id);
    btn.style.left = `${hs.left}%`;
    btn.style.top = `${hs.top}%`;
    btn.style.width = `${hs.width}%`;
    btn.style.height = `${hs.height}%`;
    btn.title = `ID${hs.id}`;
    btn.setAttribute('aria-label', `Main Button ${hs.id}`);

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (typeof onMainButton === 'function') onMainButton(hs.id);
    });

    wrap.appendChild(btn);
  }

  // デバッグ可視化切替（state.settings.debugHotspots）
  const applyDebug = () => {
    const st = store.getState();
    const debug = !!st?.settings?.debugHotspots;
    wrap.querySelectorAll('.hotspot').forEach((el) => {
      el.classList.toggle('debug', debug);
    });
  };

  applyDebug();
  const unsub = store.subscribe((state, action) => {
    if (action.type === 'SET_DEBUG_HOTSPOTS') applyDebug();
    if (action.type === 'SET_SCREEN') applyDebug();
  });

  // 便利関数：外からデバッグを切り替えたい時用
  const api = {
    destroy() { unsub && unsub(); },
  };
  return api;
}

/**
 * メイン画面のヒント表示（必要なら）
 */
export function setMainHint(text) {
  const el = $('#main_hint .hint-text');
  if (el) el.textContent = text ?? '';
}
