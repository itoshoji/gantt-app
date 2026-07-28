/* ガントチャート型タスク管理アプリ — 画面まわり */

// ---------- 定数 ----------
const MONTH_LABELS = ['4月','5月','6月','7月','8月','9月','10月','11月','12月','1月','2月','3月'];
const DOW = ['日','月','火','水','木','金','土'];
const LANE_H = 34;      // ガントバーの高さ（styles.css の --lane-h と合わせる）
const LANE_GAP = 6;     // 同上 --lane-gap
const CAL_BAR_H = 18;   // カレンダーの予定バーの高さ
const CAL_BAR_GAP = 2;
const VIEW_KEY = 'gantt-app:view';
const SCOPE_KEY = 'gantt-app:scope';

const PALETTES = {
  routine: ['#E05C43', '#F0A13B', '#D9455F', '#C77B3A', '#D4A017', '#B5526B'],
  project: ['#3E7CB1', '#4BA3A3', '#6C6BC4', '#3E9B6E', '#5D8AA8', '#8E6BC4'],
};
const TAG_LABEL = { routine: '定例', project: 'プロジェクト' };

const ICON = {
  eye: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.9 17.9A10.1 10.1 0 0 1 12 20C5 20 1 12 1 12a18.5 18.5 0 0 1 5.1-5.9M9.9 4.2A9.1 9.1 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.2 3.2m-6.7-1.1a3 3 0 1 1-4.2-4.2"/><line x1="1" y1="1" x2="23" y2="23"/></svg>',
  calendar: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
};

// ---------- 日付ユーティリティ ----------
const pad2 = n => String(n).padStart(2, '0');
const ymd = (y, m, d) => `${y}-${pad2(m)}-${pad2(d)}`;
const parseDate = s => { const [y, m, d] = s.split('-').map(Number); return { y, m, d }; };
const dateNum = s => Number(s.replace(/-/g, ''));
const daysInMonth = (y, m) => new Date(y, m, 0).getDate();
const firstDow = (y, m) => new Date(y, m - 1, 1).getDay();
const dowOf = iso => { const { y, m, d } = parseDate(iso); return new Date(y, m - 1, d).getDay(); };

const today = new Date();
const TODAY = ymd(today.getFullYear(), today.getMonth() + 1, today.getDate());

// 通し月番号（年月の足し算・引き算をしやすくするため）
const absMonth = (y, m) => y * 12 + (m - 1);
const absToYM = a => ({ y: Math.floor(a / 12), m: a % 12 + 1 });

// 年度インデックス(0=4月 … 11=3月) → 実際の年月
function idxToYM(fyear, idx) {
  return idx <= 8 ? { y: fyear, m: idx + 4 } : { y: fyear + 1, m: idx - 8 };
}
// 実際の年月 → 年度インデックス（その年度外なら null）
function ymToIdx(fyear, y, m) {
  if (y === fyear && m >= 4) return m - 4;
  if (y === fyear + 1 && m <= 3) return m + 8;
  return null;
}
function currentFiscalYear() {
  const y = today.getFullYear();
  return today.getMonth() + 1 >= 4 ? y : y - 1;
}

// 日付を n ヶ月ずらす。移動先の月に同じ日がなければその月の末日に丸める（31日→30日など）
function shiftDateByMonths(iso, delta) {
  const { y, m, d } = parseDate(iso);
  const { y: ny, m: nm } = absToYM(absMonth(y, m) + delta);
  return ymd(ny, nm, Math.min(d, daysInMonth(ny, nm)));
}

const toUTC = iso => { const { y, m, d } = parseDate(iso); return Date.UTC(y, m - 1, d); };
const ord = iso => toUTC(iso) / 86400000;              // 通し日番号
const dayDiff = (a, b) => Math.round(ord(b) - ord(a));
function addDays(iso, n) {
  const dt = new Date(toUTC(iso) + n * 86400000);
  return ymd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

function fmtShort(iso) {
  const { m, d } = parseDate(iso);
  return `${m}/${d}`;
}
function rangeText(s) {
  if (!s.startDate) return '期間未設定';
  if (!s.endDate || s.endDate === s.startDate) return fmtShort(s.startDate);
  return `${fmtShort(s.startDate)} - ${fmtShort(s.endDate)}`;
}
// 日曜・祝日なら 'sun'、土曜なら 'sat'、それ以外は ''
function dayKind(iso) {
  if (dowOf(iso) === 0 || Holidays.name(iso)) return 'sun';
  if (dowOf(iso) === 6) return 'sat';
  return '';
}

// ---------- 色ユーティリティ ----------
function hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

// 小タスクが多いほど濃くなる（0個=淡い / 5個以上=項目の色そのもの）
function barStyle(baseHex, subCount) {
  const { h, s, l } = hexToHsl(baseHex);
  const t = Math.min(subCount, 5) / 5;
  const light = 84 - (84 - l) * (0.22 + 0.78 * t);
  const sat = s * (0.5 + 0.5 * t);
  return {
    bg: `hsl(${h.toFixed(0)} ${sat.toFixed(0)}% ${light.toFixed(0)}%)`,
    fg: light > 62 ? '#2a2f36' : '#ffffff',
  };
}

// ---------- 画面状態 ----------
let viewMode = localStorage.getItem(VIEW_KEY) || 'year';   // 'year' | 'quarter' | 'day'
let scopeMode = localStorage.getItem(SCOPE_KEY) === 'private' ? 'private' : 'work';
const SCOPE_LABEL = { work: '仕事', private: 'プライベート' };
const inScope = g => !!g && g.scope === scopeMode;
let fy = currentFiscalYear();
let quarter = Math.floor((ymToIdx(fy, today.getFullYear(), today.getMonth() + 1) || 0) / 3);
let popoverTaskId = null;

const $ = id => document.getElementById(id);
const groupListEl = $('groupList');
const monthHeaderEl = $('monthHeader');
const popoverEl = $('popover');
const calEl = $('calendar');

// 表示している月の範囲（年度インデックス）
function visibleRange() {
  return viewMode === 'quarter'
    ? { from: quarter * 3, to: quarter * 3 + 2 }
    : { from: 0, to: 11 };
}

// 重なりを段（レーン）に振り分ける汎用処理。items は {from, to} を持つ。
// 開始が早い順、同じなら長い順に詰めるので、長く続くものほど上の段に来る
function assignLanes(items) {
  const sorted = [...items].sort((a, b) => a.from - b.from || b.to - a.to);
  const laneEnd = [];
  for (const it of sorted) {
    let i = 0;
    while (i < laneEnd.length && laneEnd[i] > it.from) i++;
    laneEnd[i] = it.to + 1;
    it.lane = i;
  }
  return { sorted, laneCount: Math.max(laneEnd.length, 1) };
}

// ==========================================================
// 描画の入口
// ==========================================================
function render() {
  applyViewMode();
  if (viewMode === 'day') { hidePopover(); renderDayView(); return; }
  renderMonthHeader();
  renderGroups();
  if (popoverTaskId) renderPopoverBody();
}

function applyViewMode() {
  document.querySelectorAll('#viewToggle button').forEach(b => {
    b.classList.toggle('is-active', b.dataset.view === viewMode);
  });
  document.querySelectorAll('#scopeToggle button').forEach(b => {
    b.classList.toggle('is-active', b.dataset.scope === scopeMode);
  });
  $('boardView').hidden = viewMode === 'day';
  $('todoView').hidden = viewMode !== 'day';
  $('rangeNav').hidden = viewMode === 'day';
  const vis = visibleRange();
  $('rangeLabel').textContent = viewMode === 'quarter'
    ? `${fy}年度 ${MONTH_LABELS[vis.from]}〜${MONTH_LABELS[vis.to]}`
    : `${fy}年度`;
}

function renderMonthHeader() {
  const vis = visibleRange();
  const count = vis.to - vis.from + 1;
  monthHeaderEl.style.gridTemplateColumns = `repeat(${count}, 1fr)`;
  monthHeaderEl.innerHTML = '';
  const curIdx = ymToIdx(fy, today.getFullYear(), today.getMonth() + 1);
  for (let i = vis.from; i <= vis.to; i++) {
    const el = document.createElement('div');
    el.className = 'month-head' + (i === curIdx ? ' is-current' : '');
    el.textContent = MONTH_LABELS[i];
    el.addEventListener('click', () => openCalendar({ ...idxToYM(fy, i) }));
    monthHeaderEl.appendChild(el);
  }
}

function renderGroups() {
  const groups = Store.groupsIn(scopeMode);
  $('emptyHint').hidden = groups.length > 0;
  $('emptyHint').textContent =
    `右上の「＋」から${SCOPE_LABEL[scopeMode]}の項目を追加してください。`;
  groupListEl.innerHTML = '';
  const vis = visibleRange();
  const count = vis.to - vis.from + 1;
  const curIdx = ymToIdx(fy, today.getFullYear(), today.getMonth() + 1);

  for (const g of groups) {
    const row = document.createElement('div');
    row.className = 'row group-row' + (g.hidden ? ' is-hidden' : '');
    row.dataset.groupId = g.id;
    row.appendChild(buildGroupHead(g, row));

    const lanes = document.createElement('div');
    lanes.className = 'lanes';

    // 表示範囲にかかる中タスクだけを、切り取った範囲でレーン分けする
    const items = Store.tasksOf(g.id, fy)
      .filter(t => t.endMonth >= vis.from && t.startMonth <= vis.to)
      .map(t => ({ t, from: Math.max(t.startMonth, vis.from), to: Math.min(t.endMonth, vis.to) }));
    const { sorted, laneCount } = assignLanes(items);

    const cells = document.createElement('div');
    cells.className = 'cells';
    cells.style.gridTemplateColumns = `repeat(${count}, 1fr)`;
    for (let i = vis.from; i <= vis.to; i++) {
      const c = document.createElement('div');
      c.className = 'cell' + (i === curIdx ? ' is-current' : '');
      c.addEventListener('click', () => createTaskAt(g, i));
      cells.appendChild(c);
    }
    lanes.appendChild(cells);

    const bars = document.createElement('div');
    bars.className = 'bars';
    bars.style.height = (laneCount * LANE_H + (laneCount - 1) * LANE_GAP) + 'px';
    for (const it of sorted) bars.appendChild(createBar(it.t, g, it.lane, vis));
    lanes.appendChild(bars);

    row.appendChild(lanes);
    groupListEl.appendChild(row);
  }
}

function buildGroupHead(g, row) {
  const head = document.createElement('div');
  head.className = 'group-head';

  const grip = document.createElement('span');
  grip.className = 'group-grip';
  grip.textContent = '⠿';
  grip.title = 'ドラッグで並べ替え';
  grip.addEventListener('pointerdown', e => startGroupDrag(e, row));
  head.appendChild(grip);

  const dot = document.createElement('span');
  dot.className = 'group-color';
  dot.style.background = g.color;
  head.appendChild(dot);

  const meta = document.createElement('span');
  meta.className = 'group-meta';
  const nameEl = document.createElement('span');
  nameEl.className = 'group-name';
  nameEl.textContent = g.name;
  nameEl.addEventListener('click', () => editGroupName(nameEl, g));
  const tagEl = document.createElement('span');
  tagEl.className = 'group-tag';
  tagEl.textContent = TAG_LABEL[g.tag];
  meta.append(nameEl, tagEl);
  head.appendChild(meta);

  const eye = document.createElement('button');
  eye.className = 'group-eye';
  eye.type = 'button';
  eye.innerHTML = g.hidden ? ICON.eyeOff : ICON.eye;
  eye.title = g.hidden ? 'カレンダーに表示する' : 'カレンダーから隠す';
  eye.addEventListener('click', () => { Store.setGroupHidden(g.id, !g.hidden); render(); });
  head.appendChild(eye);

  head.addEventListener('contextmenu', e => {
    e.preventDefault();
    openContextMenu(e, g.name, [
      { label: '名前を変更', onClick: () => editGroupName(head.querySelector('.group-name'), g) },
      {
        label: g.hidden ? 'カレンダーに表示する' : 'カレンダーから隠す',
        onClick: () => { Store.setGroupHidden(g.id, !g.hidden); render(); },
      },
      {
        label: `${SCOPE_LABEL[g.scope === 'work' ? 'private' : 'work']}へ移動`,
        onClick: () => {
          Store.setGroupScope(g.id, g.scope === 'work' ? 'private' : 'work');
          hidePopover();
          render();
        },
      },
      { separator: true },
      {
        label: '削除（中の予定ごと）', danger: true,
        onClick: () => { Store.deleteGroup(g.id); hidePopover(); render(); },
      },
    ]);
  });

  return head;
}

// バーの位置と幅を、表示範囲で切り取って反映する
function applyBarGeometry(bar, startMonth, endMonth, vis) {
  const count = vis.to - vis.from + 1;
  const from = Math.max(startMonth, vis.from);
  const to = Math.min(endMonth, vis.to);
  const clipL = startMonth < vis.from;
  const clipR = endMonth > vis.to;
  const insL = clipL ? 0 : 3;
  const insR = clipR ? 0 : 3;
  bar.style.left = `calc(${((from - vis.from) / count) * 100}% + ${insL}px)`;
  bar.style.width = `calc(${((to - from + 1) / count) * 100}% - ${insL + insR}px)`;
  bar.classList.toggle('clip-left', clipL);
  bar.classList.toggle('clip-right', clipR);
}

function createBar(t, g, lane, vis) {
  const subCount = Store.subtasksOf(t.id).length;
  const { bg, fg } = barStyle(g.color, subCount);

  const bar = document.createElement('div');
  bar.className = 'bar';
  bar.dataset.taskId = t.id;
  bar.style.background = bg;
  bar.style.color = fg;
  bar.style.top = lane * (LANE_H + LANE_GAP) + 'px';
  applyBarGeometry(bar, t.startMonth, t.endMonth, vis);

  // 表示範囲からはみ出しているときは「◯月から」「◯月まで」を端に出す
  if (t.startMonth < vis.from) {
    const e = document.createElement('span');
    e.className = 'edge';
    e.textContent = `${MONTH_LABELS[t.startMonth]}から`;
    bar.appendChild(e);
  }

  const label = document.createElement('span');
  label.className = 'label';
  label.textContent = t.name || '（無題）';
  bar.appendChild(label);

  if (subCount > 0) {
    const count = document.createElement('span');
    count.className = 'count';
    count.textContent = subCount;
    bar.appendChild(count);
  }

  if (t.endMonth > vis.to) {
    const e = document.createElement('span');
    e.className = 'edge';
    e.textContent = `${MONTH_LABELS[t.endMonth]}まで`;
    bar.appendChild(e);
  }

  for (const side of ['left', 'right']) {
    const h = document.createElement('span');
    h.className = 'handle ' + side;
    h.dataset.side = side;
    bar.appendChild(h);
  }

  bar.addEventListener('pointerdown', e => startBarDrag(e, t, bar, vis));
  bar.addEventListener('contextmenu', e => {
    e.preventDefault();
    e.stopPropagation();
    openContextMenu(e, t.name || '（無題）', [
      { label: '名前を変更', onClick: () => { render(); const b = findBar(t.id); if (b) startNameEdit(b, Store.task(t.id)); } },
      { label: 'カレンダーで見る', onClick: () => openCalendar({ ...idxToYM(t.fy, t.startMonth), taskId: t.id }) },
      { separator: true },
      { label: '削除', danger: true, onClick: () => { if (popoverTaskId === t.id) hidePopover(); Store.deleteTask(t.id); render(); } },
    ]);
  });
  return bar;
}

const findBar = taskId => groupListEl.querySelector(`.bar[data-task-id="${taskId}"]`);

// ---------- 項目名のインライン編集 ----------
function editGroupName(span, g) {
  if (!span) return;
  const input = document.createElement('input');
  input.type = 'text';
  input.value = g.name;
  input.style.cssText = 'font:inherit;font-weight:600;width:100%;border:1px solid #d5dae1;border-radius:4px;padding:1px 4px;';
  span.replaceWith(input);
  input.focus();
  input.select();
  let done = false;
  const commit = () => {
    if (done) return;
    done = true;
    const v = input.value.trim();
    if (v) Store.renameGroup(g.id, v);
    render();
  };
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') { done = true; render(); }
  });
}

// ---------- 項目の並べ替え（ドラッグ＆ドロップ）----------
function startGroupDrag(e, row) {
  if (e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();

  const rows = [...groupListEl.querySelectorAll('.group-row')];
  const from = rows.indexOf(row);
  let insertAt = from;
  row.classList.add('is-reordering');
  const line = $('dropLine');

  const onMove = ev => {
    let idx = rows.length;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i].getBoundingClientRect();
      if (ev.clientY < r.top + r.height / 2) { idx = i; break; }
    }
    insertAt = idx;
    const board = groupListEl.getBoundingClientRect();
    const edge = idx >= rows.length
      ? rows[rows.length - 1].getBoundingClientRect().bottom
      : rows[idx].getBoundingClientRect().top;
    line.hidden = false;
    line.style.top = (edge + window.scrollY - 1) + 'px';
    line.style.left = (board.left + window.scrollX) + 'px';
    line.style.width = board.width + 'px';
  };

  const onUp = () => {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    line.hidden = true;
    row.classList.remove('is-reordering');
    if (insertAt !== from && insertAt !== from + 1) {
      const before = rows[insertAt];
      Store.moveGroupBefore(row.dataset.groupId, before ? before.dataset.groupId : null);
    }
    render();
  };

  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
}

// ==========================================================
// 中タスクの作成・ドラッグ
// ==========================================================
function createTaskAt(g, monthIdx) {
  hidePopover();
  const t = Store.addTask({ groupId: g.id, fy, startMonth: monthIdx, endMonth: monthIdx });
  render();
  const bar = findBar(t.id);
  if (bar) startNameEdit(bar, t);
}

function startNameEdit(bar, t) {
  if (!bar || !t) return;
  bar.innerHTML = '';
  const input = document.createElement('input');
  input.type = 'text';
  input.value = t.name;
  input.placeholder = 'タスク名';
  bar.appendChild(input);
  input.focus();
  input.select();

  let done = false;
  const finish = cancel => {
    if (done) return;
    done = true;
    const v = input.value.trim();
    if (!v && !t.name) Store.deleteTask(t.id);          // 名前を入れずに終了 → 作成をなかったことに
    else if (!cancel && v) Store.updateTask(t.id, { name: v });
    render();
  };
  input.addEventListener('blur', () => finish(false));
  input.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Enter') finish(false);
    if (e.key === 'Escape') finish(true);
  });
  input.addEventListener('pointerdown', e => e.stopPropagation());
}

// 中タスクの通し月レンジ
function taskAbsRange(t) {
  const s = idxToYM(t.fy, t.startMonth), e = idxToYM(t.fy, t.endMonth);
  return { from: absMonth(s.y, s.m), to: absMonth(e.y, e.m) };
}

// 中タスクを移動したとき、中の小タスクも同じ月数だけずらす（日はそのまま）
function shiftSubtasks(taskId, delta) {
  if (!delta) return;
  for (const s of Store.subtasksOf(taskId)) {
    if (!s.startDate) continue;
    Store.updateSubtask(s.id, {
      startDate: shiftDateByMonths(s.startDate, delta),
      endDate: s.endDate ? shiftDateByMonths(s.endDate, delta) : null,
    });
  }
}

// 中タスクを伸縮したとき、期間からはみ出した小タスクだけを近い側の端の月にまとめる
function gatherStraySubtasks(t) {
  const { from, to } = taskAbsRange(t);
  for (const s of Store.subtasksOf(t.id)) {
    if (!s.startDate) continue;
    const p = parseDate(s.startDate);
    const a = absMonth(p.y, p.m);
    const delta = a < from ? from - a : a > to ? to - a : 0;
    if (!delta) continue;
    Store.updateSubtask(s.id, {
      startDate: shiftDateByMonths(s.startDate, delta),
      endDate: s.endDate ? shiftDateByMonths(s.endDate, delta) : null,
    });
  }
}

function startBarDrag(e, t, bar, vis) {
  if (e.button !== 0) return;
  if (e.target.tagName === 'INPUT') return;
  e.stopPropagation();

  const mode = e.target.dataset.side ? 'resize-' + e.target.dataset.side : 'move';
  const lanesEl = bar.closest('.lanes');
  const count = vis.to - vis.from + 1;
  const cellW = lanesEl.getBoundingClientRect().width / count;
  const startX = e.clientX;
  const orig = { s: t.startMonth, e: t.endMonth };
  let moved = false;
  let next = { ...orig };

  bar.setPointerCapture(e.pointerId);

  const onMove = ev => {
    if (Math.abs(ev.clientX - startX) > 3) moved = true;
    if (!moved) return;
    bar.classList.add('is-dragging');
    const delta = Math.round((ev.clientX - startX) / cellW);

    if (mode === 'move') {
      const span = orig.e - orig.s;
      const s = Math.min(Math.max(orig.s + delta, 0), 11 - span);
      next = { s, e: s + span };
    } else if (mode === 'resize-left') {
      const s = Math.min(Math.max(orig.s + delta, 0), orig.e);
      next = { s, e: orig.e };
    } else {
      const en = Math.max(Math.min(orig.e + delta, 11), orig.s);
      next = { s: orig.s, e: en };
    }
    applyBarGeometry(bar, next.s, next.e, vis);
  };

  const onUp = () => {
    bar.removeEventListener('pointermove', onMove);
    bar.removeEventListener('pointerup', onUp);
    bar.classList.remove('is-dragging');
    if (!moved) { showPopover(t.id, bar); return; }
    if (next.s !== orig.s || next.e !== orig.e) {
      Store.updateTask(t.id, { startMonth: next.s, endMonth: next.e });
      if (mode === 'move') shiftSubtasks(t.id, next.s - orig.s);
      else gatherStraySubtasks(Store.task(t.id));
    }
    render();
  };

  bar.addEventListener('pointermove', onMove);
  bar.addEventListener('pointerup', onUp);
}

// ==========================================================
// 日ビュー（直近の予定をToDoとして時系列に並べる）
// ==========================================================
function upcomingItems() {
  return Store.allSubtasks()
    .filter(s => s.startDate)
    .map(s => {
      const t = Store.task(s.taskId);
      return { s, t, g: t ? Store.group(t.groupId) : null };
    })
    .filter(x => inScope(x.g) && !x.g.hidden && dateNum(x.s.endDate || x.s.startDate) >= dateNum(TODAY))
    .sort((a, b) =>
      dateNum(a.s.startDate) - dateNum(b.s.startDate) ||
      (a.s.name || '').localeCompare(b.s.name || ''));
}

function relativeLabel(iso) {
  const diff = dayDiff(TODAY, iso);
  if (diff === 0) return '今日';
  if (diff === 1) return '明日';
  if (diff === 2) return '明後日';
  return `${diff}日後`;
}

function renderDayView() {
  const view = $('todoView');
  view.innerHTML = '';

  const items = upcomingItems();
  if (!items.length) {
    const p = document.createElement('p');
    p.className = 'todo-empty';
    p.textContent = '直近の予定はありません。';
    view.appendChild(p);
    return;
  }

  const ongoing = items.filter(x => dateNum(x.s.startDate) < dateNum(TODAY));
  const upcoming = items.filter(x => dateNum(x.s.startDate) >= dateNum(TODAY));

  const sectionTitle = text => {
    const h = document.createElement('p');
    h.className = 'todo-section-title';
    h.textContent = text;
    view.appendChild(h);
  };

  if (ongoing.length) {
    sectionTitle('進行中');
    for (const x of ongoing) view.appendChild(createTodoItem(x));
  }

  if (upcoming.length) {
    if (ongoing.length) sectionTitle('これからの予定');
    let currentDate = null;
    for (const x of upcoming) {
      if (x.s.startDate !== currentDate) {
        currentDate = x.s.startDate;
        view.appendChild(createTodoDayHeader(currentDate));
      }
      view.appendChild(createTodoItem(x));
    }
  }
}

function createTodoDayHeader(iso) {
  const { m, d } = parseDate(iso);
  const kind = dayKind(iso);
  const holiday = Holidays.name(iso);

  const head = document.createElement('div');
  head.className = 'todo-day';

  const date = document.createElement('span');
  date.className = 'todo-date' + (kind ? ' is-' + kind : '');
  date.textContent = `${m}月${d}日(${DOW[dowOf(iso)]})`;
  head.appendChild(date);

  if (holiday) {
    const h = document.createElement('span');
    h.className = 'todo-holiday';
    h.textContent = holiday;
    head.appendChild(h);
  }

  const rel = document.createElement('span');
  rel.className = 'todo-relative';
  rel.textContent = relativeLabel(iso);
  head.appendChild(rel);

  return head;
}

function createTodoItem(x) {
  const { s, t, g } = x;
  const el = document.createElement('div');
  el.className = 'todo-item';

  const bar = document.createElement('span');
  bar.className = 'todo-bar';
  bar.style.background = g.color;
  el.appendChild(bar);

  const body = document.createElement('div');
  body.className = 'todo-body';
  const name = document.createElement('div');
  name.className = 'todo-name';
  name.textContent = s.name || '（無題）';
  const path = document.createElement('div');
  path.className = 'todo-path';
  path.textContent = `${g.name} › ${t.name || '（無題）'}`;
  body.append(name, path);
  el.appendChild(body);

  const span = document.createElement('span');
  span.className = 'todo-span';
  span.textContent = rangeText(s);
  el.appendChild(span);

  const open = () => {
    const p = parseDate(s.startDate);
    openCalendar({ y: p.y, m: p.m, taskId: t.id });
  };
  el.addEventListener('click', open);
  el.addEventListener('contextmenu', e => {
    e.preventDefault();
    e.stopPropagation();
    openContextMenu(e, s.name || '（無題）', [
      { label: '名前を変更', onClick: () => renameInline(name, s.id) },
      { label: 'カレンダーで見る', onClick: open },
      { separator: true },
      { label: '削除', danger: true, onClick: () => { Store.deleteSubtask(s.id); render(); } },
    ]);
  });

  return el;
}

// その場でテキストボックスに差し替えて小タスク名を編集する
function renameInline(host, subId) {
  const s = Store.subtask(subId);
  if (!s || !host.isConnected) return;
  const input = document.createElement('input');
  input.type = 'text';
  input.value = s.name;
  input.style.cssText = 'width:100%;font:inherit;border:1px solid #d5dae1;border-radius:4px;padding:1px 4px;outline:none;';
  host.innerHTML = '';
  host.appendChild(input);
  input.focus();
  input.select();
  let done = false;
  const commit = () => {
    if (done) return;
    done = true;
    Store.updateSubtask(subId, { name: input.value.trim() });
    render();
    if (!$('calendarOverlay').hidden) renderCalendar();
  };
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') { done = true; render(); }
  });
  input.addEventListener('pointerdown', e => e.stopPropagation());
  input.addEventListener('click', e => e.stopPropagation());
}

// ==========================================================
// 中タスクの吹き出し（小タスク一覧）
// ==========================================================
function showPopover(taskId, anchorEl) {
  popoverTaskId = taskId;
  popoverEl.hidden = false;
  renderPopoverBody();

  const r = anchorEl.getBoundingClientRect();
  const w = popoverEl.offsetWidth || 330;
  let left = r.left + window.scrollX;
  left = Math.min(left, window.scrollX + document.documentElement.clientWidth - w - 12);
  left = Math.max(left, window.scrollX + 12);
  popoverEl.style.left = left + 'px';
  popoverEl.style.top = (r.bottom + window.scrollY + 6) + 'px';
}

function hidePopover() {
  popoverTaskId = null;
  popoverEl.hidden = true;
}

function renderPopoverBody() {
  const t = Store.task(popoverTaskId);
  if (!t) { hidePopover(); return; }
  const g = Store.group(t.groupId);

  const subs = Store.subtasksOf(t.id).sort((a, b) => {
    if (!a.startDate && !b.startDate) return 0;
    if (!a.startDate) return 1;
    if (!b.startDate) return -1;
    return dateNum(a.startDate) - dateNum(b.startDate);
  });

  const rangeLabel = t.startMonth === t.endMonth
    ? MONTH_LABELS[t.startMonth]
    : `${MONTH_LABELS[t.startMonth]} 〜 ${MONTH_LABELS[t.endMonth]}`;

  popoverEl.innerHTML = `
    <div class="pop-head">
      <span class="pop-dot" style="background:${g.color}"></span>
      <input class="pop-title" type="text">
      <button type="button" class="pop-cal" title="このタスクの予定をカレンダーで見る">${ICON.calendar}</button>
    </div>
    <p class="pop-range">${rangeLabel}</p>
    <ul class="sub-list"></ul>
    <button type="button" class="pop-add">＋ 小タスクを追加</button>
    <p class="pop-foot">右クリックでメニュー</p>`;

  const title = popoverEl.querySelector('.pop-title');
  title.value = t.name;
  title.addEventListener('change', () => {
    const v = title.value.trim();
    if (v) { Store.updateTask(t.id, { name: v }); renderGroups(); }
  });

  popoverEl.querySelector('.pop-cal').addEventListener('click', () => {
    openCalendar({ ...idxToYM(t.fy, t.startMonth), taskId: t.id });
  });

  const list = popoverEl.querySelector('.sub-list');
  if (!subs.length) {
    const li = document.createElement('li');
    li.className = 'sub-empty';
    li.textContent = 'まだ小タスクはありません。';
    list.appendChild(li);
  }
  for (const s of subs) list.appendChild(createSubItem(s, g, t));

  popoverEl.querySelector('.pop-add').addEventListener('click', () => {
    const s = Store.addSubtask({ taskId: t.id });
    renderGroups();
    renderPopoverBody();
    const input = popoverEl.querySelector(`.sub-item[data-id="${s.id}"] .sub-name`);
    if (input) input.focus();
  });
}

// 小タスクの開始日が属する月（未設定なら中タスクの開始月）
function calendarMonthFor(s, t) {
  if (s.startDate) {
    const p = parseDate(s.startDate);
    return { y: p.y, m: p.m };
  }
  return idxToYM(t.fy, t.startMonth);
}

function createSubItem(s, g, t) {
  const li = document.createElement('li');
  li.className = 'sub-item';
  li.dataset.id = s.id;
  li.innerHTML = `
    <span class="sub-dot" style="background:${g.color}"></span>
    <input class="sub-name" type="text" placeholder="小タスク名">
    <span class="sub-date${s.startDate ? '' : ' unset'}"></span>`;

  const name = li.querySelector('.sub-name');
  name.value = s.name;
  name.addEventListener('change', () => Store.updateSubtask(s.id, { name: name.value.trim() }));
  name.addEventListener('keydown', e => { if (e.key === 'Enter') name.blur(); });

  const date = li.querySelector('.sub-date');
  date.textContent = rangeText(s);
  date.title = 'クリックしてカレンダーで期間を設定';
  const open = () => openCalendar({
    ...calendarMonthFor(s, t), taskId: t.id, selectFor: s.startDate ? null : s.id,
  });
  date.addEventListener('click', open);

  li.addEventListener('contextmenu', e => {
    e.preventDefault();
    e.stopPropagation();
    openContextMenu(e, s.name || '（無題）', [
      { label: '名前を変更', onClick: () => { name.focus(); name.select(); } },
      { label: 'カレンダーで見る', onClick: open },
      { separator: true },
      {
        label: '削除', danger: true,
        onClick: () => { Store.deleteSubtask(s.id); renderGroups(); renderPopoverBody(); },
      },
    ]);
  });
  return li;
}

document.addEventListener('pointerdown', e => {
  if (popoverEl.hidden) return;
  if (popoverEl.contains(e.target)) return;
  if ($('contextMenu').contains(e.target)) return;
  if (e.target.closest('.bar')) return;
  hidePopover();
});

// ==========================================================
// 右クリックの小窓（コンテキストメニュー）
// ==========================================================
const menuEl = $('contextMenu');

function openContextMenu(e, label, items) {
  menuEl.innerHTML = '';
  if (label) {
    const t = document.createElement('div');
    t.className = 'cm-label';
    t.textContent = label;
    menuEl.appendChild(t);
  }
  for (const it of items) {
    if (it.separator) {
      const sep = document.createElement('div');
      sep.className = 'cm-sep';
      menuEl.appendChild(sep);
      continue;
    }
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cm-item' + (it.danger ? ' danger' : '');
    b.textContent = it.label;
    b.addEventListener('click', () => { closeContextMenu(); it.onClick(); });
    menuEl.appendChild(b);
  }

  menuEl.hidden = false;
  const r = menuEl.getBoundingClientRect();
  const maxX = document.documentElement.clientWidth - r.width - 8;
  const maxY = document.documentElement.clientHeight - r.height - 8;
  menuEl.style.left = (Math.max(8, Math.min(e.clientX, maxX)) + window.scrollX) + 'px';
  menuEl.style.top = (Math.max(8, Math.min(e.clientY, maxY)) + window.scrollY) + 'px';
}

function closeContextMenu() { menuEl.hidden = true; }

document.addEventListener('pointerdown', e => {
  if (!menuEl.hidden && !menuEl.contains(e.target)) closeContextMenu();
}, true);
window.addEventListener('scroll', closeContextMenu, true);
window.addEventListener('resize', closeContextMenu);

// ==========================================================
// 月間カレンダー
// ==========================================================
let calY = today.getFullYear();
let calM = today.getMonth() + 1;
let calFilterTaskId = null;   // 指定があればその中タスクの小タスクだけ表示
let calSelectFor = null;      // 小タスクIDが入っていれば「期間を新規選択するモード」
let calSelection = null;      // 選択中の日付 {a, b}
let calPreview = null;        // ドラッグ中の仮の期間 {id, from, to}

function openCalendar({ y, m, taskId = null, selectFor = null }) {
  calY = y;
  calM = m;
  calFilterTaskId = taskId;
  calSelectFor = selectFor;
  calSelection = null;
  calPreview = null;
  popoverEl.hidden = true;   // 隠すだけ（popoverTaskId は保持して閉じたときに戻す）
  $('calendarOverlay').hidden = false;
  renderCalendar();
}

function closeCalendar() {
  $('calendarOverlay').hidden = true;
  calFilterTaskId = null;
  calSelectFor = null;
  calSelection = null;
  calPreview = null;
  render();
  if (viewMode !== 'day' && popoverTaskId) {
    const bar = findBar(popoverTaskId);
    if (bar) showPopover(popoverTaskId, bar);
    else hidePopover();
  }
}

function shiftCalendarMonth(delta) {
  const { y, m } = absToYM(absMonth(calY, calM) + delta);
  calY = y;
  calM = m;
  calSelection = null;
  renderCalendar();
}

// 今日を含む月へ移動し、今日の週までスクロールする
function goToTodayInCalendar() {
  calY = today.getFullYear();
  calM = today.getMonth() + 1;
  calSelection = null;
  renderCalendar();
  scrollTodayIntoView();
}

function scrollTodayIntoView() {
  const cell = calEl.querySelector('.cal-day.is-today');
  if (!cell) return;
  const week = cell.closest('.cal-week');
  const calRect = calEl.getBoundingClientRect();
  const weekRect = week.getBoundingClientRect();
  const dowRow = calEl.querySelector('.cal-dow-row');
  const headH = dowRow ? dowRow.offsetHeight : 0;
  // 曜日の見出しは上に固定されているので、その分だけ余計に送る
  if (weekRect.top - headH < calRect.top || weekRect.bottom > calRect.bottom) {
    calEl.scrollTop += (weekRect.top - calRect.top) - headH - 4;
  }
}

// カレンダーに出す小タスクを集める
function calendarItems() {
  const monthStart = dateNum(ymd(calY, calM, 1));
  const monthEnd = dateNum(ymd(calY, calM, daysInMonth(calY, calM)));

  return Store.allSubtasks()
    .filter(s => s.startDate)
    .map(s => {
      const t = Store.task(s.taskId);
      const g = t ? Store.group(t.groupId) : null;
      const p = calPreview && calPreview.id === s.id
        ? { from: calPreview.from, to: calPreview.to }
        : { from: s.startDate, to: s.endDate || s.startDate };
      return { s, t, g, from: p.from, to: p.to };
    })
    .filter(x =>
      inScope(x.g) && !x.g.hidden &&
      (!calFilterTaskId || x.s.taskId === calFilterTaskId) &&
      dateNum(x.to) >= monthStart && dateNum(x.from) <= monthEnd);
}

function renderCalendar() {
  $('calendarTitle').textContent = `${calY}年${calM}月`;
  $('calToday').classList.toggle(
    'is-current',
    calY === today.getFullYear() && calM === today.getMonth() + 1);

  const scope = $('calendarScope');
  const filterTask = calFilterTaskId ? Store.task(calFilterTaskId) : null;
  scope.textContent = filterTask ? `${filterTask.name || '（無題）'} のみ` : '';

  $('calendarHint').textContent = calSelectFor
    ? 'カレンダー上をドラッグして期間を選んでください（1日だけならクリック）'
    : '予定をドラッグで移動、左右の端をドラッグで伸縮できます。右クリックでメニュー。';

  calEl.innerHTML = '';

  const dowRow = document.createElement('div');
  dowRow.className = 'cal-dow-row';
  DOW.forEach((d, i) => {
    const el = document.createElement('div');
    el.className = 'cal-dow' + (i === 0 ? ' sun' : i === 6 ? ' sat' : '');
    el.textContent = d;
    dowRow.appendChild(el);
  });
  calEl.appendChild(dowRow);

  const last = daysInMonth(calY, calM);
  const first = ymd(calY, calM, 1);
  const lastIso = ymd(calY, calM, last);
  const lead = firstDow(calY, calM);
  const gridStart = addDays(first, -lead);
  const weekCount = Math.ceil((lead + last) / 7);

  const items = calendarItems();

  for (let w = 0; w < weekCount; w++) {
    const weekStart = addDays(gridStart, w * 7);
    const weekEnd = addDays(weekStart, 6);

    // この週に出る予定の区間を求め、週ごとに段を詰める
    // （前の週から続くものは週頭から始まるので、自然と上の段に並ぶ）
    const segs = [];
    for (const it of items) {
      const from = Math.max(ord(it.from), ord(weekStart), ord(first));
      const to = Math.min(ord(it.to), ord(weekEnd), ord(lastIso));
      if (from > to) continue;
      segs.push({ it, from, to });
    }
    const { sorted: segments, laneCount } = assignLanes(segs);
    const rows = segs.length ? laneCount : 1;

    const week = document.createElement('div');
    week.className = 'cal-week';
    week.dataset.weekStart = weekStart;
    week.style.setProperty('--rows', rows);

    const days = document.createElement('div');
    days.className = 'cal-days';
    for (let c = 0; c < 7; c++) {
      const iso = addDays(weekStart, c);
      const p = parseDate(iso);
      const cell = document.createElement('div');
      if (p.y !== calY || p.m !== calM) {
        cell.className = 'cal-day blank';
      } else {
        const kind = dayKind(iso);
        cell.className = 'cal-day' + (kind ? ' is-' + kind : '') + (iso === TODAY ? ' is-today' : '');
        cell.dataset.date = iso;
        const holiday = Holidays.name(iso);
        if (holiday) cell.title = holiday;
        const num = document.createElement('span');
        num.className = 'cal-date';
        num.textContent = p.d;
        cell.appendChild(num);
      }
      days.appendChild(cell);
    }
    week.appendChild(days);

    const barsLayer = document.createElement('div');
    barsLayer.className = 'cal-bars';
    barsLayer.style.height = (rows * (CAL_BAR_H + CAL_BAR_GAP)) + 'px';
    for (const seg of segments) barsLayer.appendChild(createCalBar(seg, weekStart));
    week.appendChild(barsLayer);

    calEl.appendChild(week);
  }
}

function createCalBar(seg, weekStart) {
  const { it, from: segFrom, to: segTo, lane } = seg;
  const contLeft = segFrom > ord(it.from);
  const contRight = segTo < ord(it.to);
  const startCol = segFrom - ord(weekStart);
  const span = segTo - segFrom + 1;
  const insL = contLeft ? 0 : 2;
  const insR = contRight ? 0 : 2;

  const bar = document.createElement('div');
  bar.className = 'cal-bar'
    + (contLeft ? ' cont-left' : '')
    + (contRight ? ' cont-right' : '')
    + (calPreview && calPreview.id === it.s.id ? ' is-ghost' : '');
  const st = barStyle(it.g.color, 5);
  bar.style.background = st.bg;
  bar.style.color = st.fg;
  bar.style.left = `calc(${(startCol / 7) * 100}% + ${insL}px)`;
  bar.style.width = `calc(${(span / 7) * 100}% - ${insL + insR}px)`;
  bar.style.top = lane * (CAL_BAR_H + CAL_BAR_GAP) + 'px';

  const label = document.createElement('span');
  label.className = 'cal-bar-label';
  label.textContent = it.s.name || '（無題）';
  bar.appendChild(label);
  bar.title = `${it.s.name || '（無題）'}（${it.t ? it.t.name : ''}）`;

  // 実際の開始日・終了日がこの区間にあるときだけ、伸縮用の持ち手を出す
  if (!contLeft) bar.appendChild(calHandle('left'));
  if (!contRight) bar.appendChild(calHandle('right'));

  bar.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    const grabbed = addDays(weekStart, startCol);
    startCalBarDrag(e, it.s.id, e.target.dataset.side || 'move', grabbed);
  });

  bar.addEventListener('contextmenu', e => {
    e.preventDefault();
    e.stopPropagation();
    openContextMenu(e, it.s.name || '（無題）', [
      { label: '名前を変更', onClick: () => renameInline(label, it.s.id) },
      { separator: true },
      {
        label: '削除', danger: true,
        onClick: () => { Store.deleteSubtask(it.s.id); renderCalendar(); render(); },
      },
    ]);
  });
  return bar;
}

function calHandle(side) {
  const h = document.createElement('span');
  h.className = 'cal-handle ' + side;
  h.dataset.side = side;
  return h;
}

// 画面上の座標から、カレンダーのどの日かを求める
function dateAtPoint(x, y) {
  for (const week of calEl.querySelectorAll('.cal-week')) {
    const r = week.getBoundingClientRect();
    if (y < r.top || y > r.bottom) continue;
    const col = Math.floor((x - r.left) / (r.width / 7));
    if (col < 0 || col > 6) return null;
    const iso = addDays(week.dataset.weekStart, col);
    const p = parseDate(iso);
    return (p.y === calY && p.m === calM) ? iso : null;
  }
  return null;
}

// カレンダー上の予定バーのドラッグ（本体=移動 / 左右の端=伸縮）
function startCalBarDrag(e, subId, mode, grabbedDay) {
  e.preventDefault();
  e.stopPropagation();
  const s = Store.subtask(subId);
  if (!s || !s.startDate) return;

  // 掴んだ位置を、バーの中のどこを掴んだかで補正する
  const pointerDate = dateAtPoint(e.clientX, e.clientY) || grabbedDay;
  const origFrom = s.startDate;
  const origTo = s.endDate || s.startDate;
  let next = { from: origFrom, to: origTo };
  let moved = false;

  const onMove = ev => {
    const target = dateAtPoint(ev.clientX, ev.clientY);
    if (!target) return;

    if (mode === 'move') {
      const delta = dayDiff(pointerDate, target);
      next = { from: addDays(origFrom, delta), to: addDays(origTo, delta) };
    } else if (mode === 'left') {
      if (dateNum(target) > dateNum(origTo)) return;
      next = { from: target, to: origTo };
    } else {
      if (dateNum(target) < dateNum(origFrom)) return;
      next = { from: origFrom, to: target };
    }
    if (next.from !== origFrom || next.to !== origTo) moved = true;
    calPreview = { id: subId, ...next };
    renderCalendar();
  };

  const onUp = () => {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    calPreview = null;
    if (moved) Store.updateSubtask(subId, { startDate: next.from, endDate: next.to });
    renderCalendar();
    if (viewMode === 'day') renderDayView(); else renderGroups();
    if (popoverTaskId) renderPopoverBody();
  };

  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
}

// 期間未設定の小タスクを、空きマスのドラッグで設定する（リスナーは最初に一度だけ張る）
(function setupRangeSelect() {
  let dragging = false;

  const paint = () => {
    if (!calSelection) return;
    const a = Math.min(dateNum(calSelection.a), dateNum(calSelection.b));
    const b = Math.max(dateNum(calSelection.a), dateNum(calSelection.b));
    calEl.querySelectorAll('.cal-day[data-date]').forEach(el => {
      const n = dateNum(el.dataset.date);
      el.classList.toggle('in-range', n >= a && n <= b);
    });
  };

  calEl.addEventListener('pointerdown', e => {
    if (!calSelectFor) return;
    const iso = dateAtPoint(e.clientX, e.clientY);
    if (!iso) return;
    e.preventDefault();
    dragging = true;
    calSelection = { a: iso, b: iso };
    paint();
  });

  calEl.addEventListener('pointermove', e => {
    if (!dragging) return;
    const iso = dateAtPoint(e.clientX, e.clientY);
    if (!iso) return;
    calSelection.b = iso;
    paint();
  });

  calEl.addEventListener('pointerup', () => {
    if (!dragging || !calSelection || !calSelectFor) return;
    dragging = false;
    const { a, b } = calSelection;
    const asc = dateNum(a) <= dateNum(b);
    Store.updateSubtask(calSelectFor, { startDate: asc ? a : b, endDate: asc ? b : a });
    calSelectFor = null;      // 以降はバーを直接ドラッグして調整できる
    calSelection = null;
    renderCalendar();
    if (viewMode === 'day') renderDayView(); else renderGroups();
  });

  calEl.addEventListener('pointerleave', () => { dragging = false; });
})();

$('calPrev').addEventListener('click', () => shiftCalendarMonth(-1));
$('calNext').addEventListener('click', () => shiftCalendarMonth(1));
$('calToday').addEventListener('click', goToTodayInCalendar);
$('calendarClose').addEventListener('click', closeCalendar);
$('calendarOverlay').addEventListener('pointerdown', e => {
  if (e.target === $('calendarOverlay')) closeCalendar();
});

// ==========================================================
// 項目の追加ダイアログ
// ==========================================================
let dlgTag = 'routine';
let dlgColor = PALETTES.routine[0];

function renderSwatches() {
  const wrap = $('swatches');
  wrap.innerHTML = '';
  PALETTES[dlgTag].forEach(c => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch' + (c === dlgColor ? ' is-active' : '');
    b.style.background = c;
    b.addEventListener('click', () => { dlgColor = c; renderSwatches(); });
    wrap.appendChild(b);
  });
}

function openGroupDialog() {
  $('groupDialog').querySelector('.dialog-title').textContent =
    `${SCOPE_LABEL[scopeMode]}の項目を追加`;
  dlgTag = 'routine';
  dlgColor = PALETTES.routine[0];
  $('groupName').value = '';
  document.querySelectorAll('.tag-btn').forEach(b => b.classList.toggle('is-active', b.dataset.tag === dlgTag));
  renderSwatches();
  $('groupDialog').hidden = false;
  $('groupName').focus();
}

document.querySelectorAll('.tag-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    dlgTag = btn.dataset.tag;
    dlgColor = PALETTES[dlgTag][0];
    document.querySelectorAll('.tag-btn').forEach(b => b.classList.toggle('is-active', b === btn));
    renderSwatches();
  });
});

function saveGroup() {
  const name = $('groupName').value.trim();
  if (!name) { $('groupName').focus(); return; }
  Store.addGroup({ name, tag: dlgTag, color: dlgColor, scope: scopeMode });
  $('groupDialog').hidden = true;
  render();
}

$('addGroup').addEventListener('click', openGroupDialog);
$('groupCancel').addEventListener('click', () => { $('groupDialog').hidden = true; });
$('groupSave').addEventListener('click', saveGroup);
$('groupName').addEventListener('keydown', e => { if (e.key === 'Enter') saveGroup(); });
$('groupDialog').addEventListener('pointerdown', e => {
  if (e.target === $('groupDialog')) $('groupDialog').hidden = true;
});

// ---------- 表示の切り替え ----------
document.querySelectorAll('#viewToggle button').forEach(btn => {
  btn.addEventListener('click', () => {
    viewMode = btn.dataset.view;
    localStorage.setItem(VIEW_KEY, viewMode);
    hidePopover();
    render();
  });
});

document.querySelectorAll('#scopeToggle button').forEach(btn => {
  btn.addEventListener('click', () => {
    scopeMode = btn.dataset.scope;
    localStorage.setItem(SCOPE_KEY, scopeMode);
    hidePopover();
    render();
  });
});

$('prevRange').addEventListener('click', () => {
  if (viewMode === 'quarter') {
    quarter--;
    if (quarter < 0) { quarter = 3; fy--; }
  } else fy--;
  hidePopover();
  render();
});

$('nextRange').addEventListener('click', () => {
  if (viewMode === 'quarter') {
    quarter++;
    if (quarter > 3) { quarter = 0; fy++; }
  } else fy++;
  hidePopover();
  render();
});

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (!menuEl.hidden) closeContextMenu();
  else if (!$('calendarOverlay').hidden) closeCalendar();
  else if (!$('groupDialog').hidden) $('groupDialog').hidden = true;
  else hidePopover();
});

// ブラウザ標準の右クリックメニューは出さない
document.addEventListener('contextmenu', e => {
  if (e.target.closest('input')) return;
  e.preventDefault();
});

// ---------- 起動 ----------
// 保存に失敗したら黙って消えるのが一番こわいので、画面上部に出しっぱなしにする
function showSyncError(message) {
  let bar = $('syncError');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'syncError';
    bar.className = 'sync-error';
    document.body.prepend(bar);
  }
  bar.textContent = message;
  bar.hidden = false;
}

Store.onError = () => showSyncError(
  '⚠ 保存できませんでした。通信状況を確認して、ページを再読み込みしてください。'
);

// Supabase から読み込み終わってから最初の描画をする
Store.init().then(render).catch(err => {
  console.error('Supabaseからの読み込みに失敗しました', err);
  showSyncError('⚠ データを読み込めませんでした。通信状況を確認して再読み込みしてください。');
  render();
});
