// ui_common.js
// UIの共通：画面切替、HUD更新、ログ、テーブル描画、モーダル。
// ここに「試合ロジック」は入れない。表示だけ。

import { SCREENS } from './state.js';

export function $(sel, root = document) {
  return root.querySelector(sel);
}
export function $all(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
}

export function showScreen(screenKey) {
  const map = {
    [SCREENS.MAIN]:   '#screen_main',
    [SCREENS.MAP]:    '#screen_map',
    [SCREENS.MATCH]:  '#screen_match',
    [SCREENS.RESULT]: '#screen_result',
    [SCREENS.TOTAL]:  '#screen_total',
    [SCREENS.LOADING]:'#screen_loading',
  };
  const targetSel = map[screenKey] || '#screen_main';

  $all('.screen').forEach(el => el.classList.remove('is-active'));
  const target = $(targetSel);
  if (target) target.classList.add('is-active');
}

export function setFooterStatus({ version, statusText }) {
  const v = $('#hud_version');
  const s = $('#hud_status');
  if (v) v.textContent = version ?? 'v0';
  if (s) s.textContent = statusText ?? '';
}

export function setHUD({ companyName, companyRank, teamName, week, gold }) {
  const c = $('#hud_company');
  const r = $('#hud_rank');
  const t = $('#hud_team');
  const w = $('#hud_week');
  const g = $('#hud_gold');

  if (c) c.textContent = companyName ?? '---';
  if (r) r.textContent = companyRank ?? '---';
  if (t) t.textContent = teamName ?? '---';
  if (w) w.textContent = String(week ?? 1);
  if (g) g.textContent = String(gold ?? 0);
}

/* =========================
   Log
========================= */
export function clearLog() {
  const el = $('#match_log');
  if (!el) return;
  el.innerHTML = '';
}

export function addLogLine(text, { important = false } = {}) {
  const el = $('#match_log');
  if (!el) return;

  const line = document.createElement('div');
  line.className = important ? 'logline important' : 'logline';
  line.textContent = text;

  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
}

/* =========================
   Scene（match画面）
========================= */
export function setMatchChips({ seasonStage, tournamentKind, matchIndex, matchCount, roundIndex }) {
  const chipStage = $('#chip_stage');
  const chipTour  = $('#chip_tournament');
  const chipMatch = $('#chip_matchNo');
  const chipRound = $('#chip_round');

  if (chipStage) chipStage.textContent = String(seasonStage ?? '');
  if (chipTour)  chipTour.textContent  = String(tournamentKind ?? '');
  if (chipMatch) chipMatch.textContent = `試合 ${Number(matchIndex ?? 0) + 1} / ${matchCount ?? 5}`;
  if (chipRound) chipRound.textContent = `R${Number(roundIndex ?? 0) + 1}`;
}

export function setScene({ title, desc, mediaText = 'SCENE' }) {
  const t = $('#scene_title');
  const d = $('#scene_desc');
  const m = $('#scene_media');
  if (t) t.textContent = title ?? '';
  if (d) d.textContent = desc ?? '';
  if (m) m.textContent = mediaText ?? 'SCENE';
}

export function setAutoChip(isOn) {
  const chip = $('#auto_state');
  if (!chip) return;
  chip.textContent = isOn ? 'AUTO: ON' : 'AUTO: OFF';
}

/* =========================
   Table renderer
========================= */
export function renderTable(containerEl, { columns, rows }) {
  if (!containerEl) return;

  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const trh = document.createElement('tr');

  for (const col of columns) {
    const th = document.createElement('th');
    th.textContent = col.label;
    trh.appendChild(th);
  }
  thead.appendChild(trh);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (const row of rows) {
    const tr = document.createElement('tr');
    for (const col of columns) {
      const td = document.createElement('td');
      const v = row[col.key];
      td.textContent = v == null ? '' : String(v);
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);

  containerEl.innerHTML = '';
  containerEl.appendChild(table);
}

export function renderMatchResult(matchResult) {
  // matchResult: [{rank, team, kills, points, totalKills, totalPoints...}] など想定
  const el = $('#table_match_result');
  if (!el) return;

  const columns = [
    { key: 'rank',   label: '順位' },
    { key: 'team',   label: 'チーム' },
    { key: 'kills',  label: 'KILL' },
    { key: 'points', label: 'PT' },
  ];

  const rows = Array.isArray(matchResult) ? matchResult : [];
  renderTable(el, { columns, rows });
}

export function renderTotalStandings(totalRows, caption = '総合（20チーム）') {
  const el = $('#table_total');
  const cap = $('#total_table_caption');
  if (cap) cap.textContent = caption;

  if (!el) return;

  const columns = [
    { key: 'rank',        label: '順位' },
    { key: 'team',        label: 'チーム' },
    { key: 'totalKills',  label: '総K' },
    { key: 'totalPoints', label: '総PT' },
    { key: 'wins',        label: '優勝' }, // 同点処理のために見える化（不要なら後で消せる）
  ];

  const rows = Array.isArray(totalRows) ? totalRows : [];
  renderTable(el, { columns, rows });
}

/* =========================
   Modal
========================= */
export function openModal({ title = 'IMPORTANT', text = '', mediaText = 'SCENE' } = {}) {
  const modal = $('#modal');
  if (!modal) return;

  $('#modal_title') && ($('#modal_title').textContent = title);
  $('#modal_text')  && ($('#modal_text').textContent = text);
  $('#modal_media') && ($('#modal_media').textContent = mediaText);

  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
}

export function closeModal() {
  const modal = $('#modal');
  if (!modal) return;
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
}

/* =========================
   Map overlay
========================= */
export function setMapText({ title, sub }) {
  const t = $('#map_title');
  const s = $('#map_sub');
  if (t) t.textContent = title ?? '';
  if (s) s.textContent = sub ?? '';
}
