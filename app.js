/* ガントチャート型タスク管理アプリ — 画面まわり */

// ---------- 定数 ----------
const MONTH_LABELS = ['4月','5月','6月','7月','8月','9月','10月','11月','12月','1月','2月','3月'];
const DOW = ['日','月','火','水','木','金','土'];
const LANE_H = 34;      // ガントバーの高さ（styles.css の --lane-h と合わせる）
const LANE_GAP = 6;     // 同上 --lane-gap
// カレンダーの予定バーは「項目 / 中タスク」と小タスク名の2段組み。
// （styles.css の --cal-bar-h / --cal-bar-gap と合わせること）
const CAL_BAR_H = 44;
const CAL_BAR_GAP = 4;
const VIEW_KEY = 'gantt-app:view';
const SCOPE_KEY = 'gantt-app:scope';

// 項目の色は赤・青の2択だけ（種類の区別が一目で付けばよい、という方針）。
// 細かい色分けは中タスク側で自由に付ける。
const GROUP_COLORS = ['#D9455F', '#3E7CB1'];        // 赤 / 青
const DEFAULT_GROUP_COLOR = { routine: GROUP_COLORS[0], project: GROUP_COLORS[1] };

// 中タスクの色。OSのカラーピッカーは選ぶまでの手数が多いので、
// 一覧から1クリックで選べるようにする。色相をひと回りさせた20色。
const TASK_PALETTE = [
  '#C0392B', '#E05C43', '#E8743B', '#EE9B2F', '#D4A017',
  '#8FA31E', '#5E9C3B', '#2E9E63', '#1FA08C', '#2496A8',
  '#3E7CB1', '#3F5FA8', '#5B54B8', '#7B4FC0', '#9B4DBA',
  '#C0459B', '#D14477', '#B5526B', '#8C6239', '#6B7280',
];
const TAG_LABEL = { routine: '定例', project: 'プロジェクト' };

// Mac は Ctrl+クリックが右クリックなので、複製ドラッグに Ctrl を使えない。
// OSごとの流儀に合わせる（Mac=Option / Windows=Ctrl）
const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const isDuplicateDrag = e => (IS_MAC ? e.altKey : e.ctrlKey);
// コピー等のショートカットは Cmd と Ctrl の両方を受ける
const isCmd = e => e.metaKey || e.ctrlKey;

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

// 中タスクに個別の色が付いていればそれを、無ければ親の項目の色を使う
function taskColor(t, g) {
  return (t && t.color) || (g && g.color) || GROUP_COLORS[0];
}

// カレンダーの予定バー。ガントは1行に1〜数本だが、カレンダーは1マスに何本も
// 積み上がるので、同じ濃さで塗ると画面が真っ黒に近くなって読めなくなる。
// 「下地は淡く、色は左端の帯だけ」にして、色の面積を減らす。
// 文字色も同じ色相から作るので、淡くしても何の予定かは分かる。
function calBarStyle(baseHex) {
  const { h, s } = hexToHsl(baseHex);
  return {
    bg: `hsl(${h.toFixed(0)} ${Math.min(s, 68).toFixed(0)}% 94%)`,
    fg: `hsl(${h.toFixed(0)} ${Math.min(s, 52).toFixed(0)}% 27%)`,
    accent: baseHex,
  };
}

// ガントのバーもカレンダーと同じ組み立てにする（淡い下地＋左端の色帯＋濃い文字）。
// 以前は小タスクが多いほど色そのものまで濃くしていたが、行が増えると
// カレンダーと同じ理由で画面が重くなる。濃さの差は「気持ち変わる」程度に留め、
// 何個あるかはバー右端の数字で読ませる。
function barStyle(baseHex, subCount) {
  const { h, s } = hexToHsl(baseHex);
  const t = Math.min(subCount, 5) / 5;
  return {
    bg: `hsl(${h.toFixed(0)} ${Math.min(s, 68).toFixed(0)}% ${(95 - 7 * t).toFixed(0)}%)`,
    fg: `hsl(${h.toFixed(0)} ${Math.min(s, 52).toFixed(0)}% 27%)`,
    accent: baseHex,
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

// ==========================================================
// 元に戻す（Undo）
// ==========================================================
// 逆操作を1つずつ書くとどれかを書き忘れて戻らない、という事故が起きやすい。
// 操作の直前に状態を丸ごと控えておき、戻すときは差分だけSupabaseへ送る方式にした。
const History = (() => {
  const stack = [];
  const LIMIT = 50;
  let depth = 0;

  return {
    // 1回の「操作」としてまとめたい処理を fn に入れて呼ぶ。
    // 中で Store を何回叩いても、元に戻すときは1回で戻る。
    act(label, fn) {
      if (depth > 0) return fn();              // 入れ子は外側の1回にまとめる
      const before = Store.snapshot();
      depth++;
      let result;
      try {
        result = fn();
      } finally {
        depth--;
      }
      // 何も変わっていないなら履歴に積まない（押しても何も起きないUndoを作らない）
      if (JSON.stringify(before) !== JSON.stringify(Store.snapshot())) {
        stack.push({ label, before });
        if (stack.length > LIMIT) stack.shift();
      }
      return result;
    },
    canUndo: () => stack.length > 0,
    lastLabel: () => (stack.length ? stack[stack.length - 1].label : null),
    undo() {
      const e = stack.pop();
      if (!e) return null;
      Store.restore(e.before);
      return e.label;
    },
  };
})();

// ==========================================================
// 選択状態とクリップボード
// ==========================================================
// selection: { kind:'cell', groupId, monthIdx } | { kind:'task', id } | { kind:'subtask', id }
let selection = null;
// clipboard: { mode:'copy'|'cut', kind:'task'|'subtask', data:… }
let clipboard = null;

function setSelection(sel) {
  selection = sel;
  paintSelection();
}
function clearSelection() { setSelection(null); }

// 選択の見た目を当て直す（描画のたびに呼ぶ）
function paintSelection() {
  groupListEl.querySelectorAll('.is-selected').forEach(el => el.classList.remove('is-selected'));
  calEl.querySelectorAll('.is-selected').forEach(el => el.classList.remove('is-selected'));
  popoverEl.querySelectorAll('.is-selected').forEach(el => el.classList.remove('is-selected'));
  if (!selection) return;

  if (selection.kind === 'task') {
    const b = findBar(selection.id);
    if (b) b.classList.add('is-selected');
  } else if (selection.kind === 'cell') {
    const cell = groupListEl.querySelector(
      `.group-row[data-group-id="${selection.groupId}"] .cell[data-month="${selection.monthIdx}"]`);
    if (cell) cell.classList.add('is-selected');
  } else if (selection.kind === 'subtask') {
    calEl.querySelectorAll(`.cal-bar[data-sub-id="${selection.id}"]`)
      .forEach(el => el.classList.add('is-selected'));
    const li = popoverEl.querySelector(`.sub-item[data-id="${selection.id}"]`);
    if (li) li.classList.add('is-selected');
  }
}

// 切り取り中のものを薄く見せる
function paintClipboard() {
  groupListEl.querySelectorAll('.is-cutting').forEach(el => el.classList.remove('is-cutting'));
  calEl.querySelectorAll('.is-cutting').forEach(el => el.classList.remove('is-cutting'));
  if (!clipboard || clipboard.mode !== 'cut') return;
  if (clipboard.kind === 'task') {
    const b = findBar(clipboard.data.task.id);
    if (b) b.classList.add('is-cutting');
  } else {
    calEl.querySelectorAll(`.cal-bar[data-sub-id="${clipboard.data.sub.id}"]`)
      .forEach(el => el.classList.add('is-cutting'));
  }
}

// 中タスクは配下の小タスクごと控える
function putTaskOnClipboard(t, mode) {
  clipboard = {
    mode, kind: 'task',
    data: { task: { ...t }, subs: Store.subtasksOf(t.id).map(s => ({ ...s })) },
  };
  paintClipboard();
}
function putSubtaskOnClipboard(s, mode) {
  clipboard = { mode, kind: 'subtask', data: { sub: { ...s } } };
  paintClipboard();
}

// 中タスクをセル（項目×月）へ貼る。ずれた月数だけ小タスクも一緒に動かす
function pasteTaskAt(groupId, monthIdx) {
  if (!clipboard || clipboard.kind !== 'task') return;
  const { task, subs } = clipboard.data;
  const mode = clipboard.mode;
  const span = Math.min(task.endMonth - task.startMonth, 11);
  const start = Math.min(Math.max(monthIdx, 0), 11 - span);
  const end = start + span;

  // 年度をまたいでも合うよう、実際の年月の差で移動量を出す
  const from = idxToYM(task.fy, task.startMonth);
  const to = idxToYM(fy, start);
  const delta = absMonth(to.y, to.m) - absMonth(from.y, from.m);

  History.act(mode === 'cut' ? '移動' : '貼り付け', () => {
    if (mode === 'cut') {
      Store.updateTask(task.id, { groupId, fy, startMonth: start, endMonth: end });
      shiftSubtasks(task.id, delta);
    } else {
      const nt = Store.addTask({
        groupId, fy, startMonth: start, endMonth: end,
        name: task.name, color: task.color,
      });
      for (const s of subs) {
        Store.addSubtask({
          taskId: nt.id,
          name: s.name,
          startDate: s.startDate ? shiftDateByMonths(s.startDate, delta) : null,
          endDate: s.endDate ? shiftDateByMonths(s.endDate, delta) : null,
        });
      }
    }
  });
  if (mode === 'cut') clipboard = null;
  clearSelection();
  render();
}

// 小タスクをカレンダーの日付へ貼る。長さは保ったまま開始日だけ変える
function pasteSubtaskAt(iso) {
  if (!clipboard || clipboard.kind !== 'subtask') return;
  const { sub } = clipboard.data;
  const mode = clipboard.mode;
  const len = sub.startDate && sub.endDate ? dayDiff(sub.startDate, sub.endDate) : 0;

  History.act(mode === 'cut' ? '移動' : '貼り付け', () => {
    if (mode === 'cut') {
      Store.updateSubtask(sub.id, { startDate: iso, endDate: addDays(iso, len) });
    } else {
      Store.addSubtask({
        taskId: sub.taskId, name: sub.name,
        startDate: iso, endDate: addDays(iso, len),
      });
    }
  });
  if (mode === 'cut') clipboard = null;
  render();
  if (!$('calendarOverlay').hidden) renderCalendar();
}

function doUndo() {
  if (!History.canUndo()) return;
  History.undo();
  clipboard = null;
  clearSelection();
  render();
  if (!$('calendarOverlay').hidden) renderCalendar();
}

// 右クリックメニューの末尾に足す「元に戻す」
function undoMenuItems() {
  if (!History.canUndo()) return [];
  return [
    { separator: true },
    { label: `元に戻す（${History.lastLabel()}）`, onClick: doUndo },
  ];
}

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
  paintSelection();
  paintClipboard();
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
    `下の「＋ 項目を追加」から${SCOPE_LABEL[scopeMode]}の項目を追加してください。`;
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
      c.dataset.month = i;
      // ワンクリックは選択だけ。作成はダブルクリック（コピー・貼り付けの的にするため）
      c.addEventListener('click', () => setSelection({ kind: 'cell', groupId: g.id, monthIdx: i }));
      c.addEventListener('dblclick', () => createTaskAt(g, i));
      c.addEventListener('contextmenu', e => {
        e.preventDefault();
        e.stopPropagation();
        setSelection({ kind: 'cell', groupId: g.id, monthIdx: i });
        const items = [
          { label: 'ここに中タスクを作る', onClick: () => createTaskAt(g, i) },
        ];
        if (clipboard && clipboard.kind === 'task') {
          items.push({ label: '貼り付け', onClick: () => pasteTaskAt(g.id, i) });
        }
        openContextMenu(e, `${g.name} / ${MONTH_LABELS[i]}`, items.concat(undoMenuItems()));
      });
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

  // この項目に属する小タスクだけをカレンダーで見る
  const cal = document.createElement('button');
  cal.className = 'group-cal';
  cal.type = 'button';
  cal.innerHTML = ICON.calendar;
  cal.title = 'この項目の予定をカレンダーで見る';
  cal.addEventListener('click', () => openCalendarForGroup(g));
  head.appendChild(cal);

  const eye = document.createElement('button');
  eye.className = 'group-eye';
  eye.type = 'button';
  eye.innerHTML = g.hidden ? ICON.eyeOff : ICON.eye;
  eye.title = g.hidden ? 'カレンダーに表示する' : 'カレンダーから隠す';
  eye.addEventListener('click', () => {
    History.act('表示の切り替え', () => Store.setGroupHidden(g.id, !g.hidden));
    render();
  });
  head.appendChild(eye);

  head.addEventListener('contextmenu', e => {
    e.preventDefault();
    const toRed = g.color !== GROUP_COLORS[0];
    openContextMenu(e, g.name, [
      { label: '名前を変更', onClick: () => editGroupName(head.querySelector('.group-name'), g) },
      { label: 'カレンダーで見る', onClick: () => openCalendarForGroup(g) },
      {
        label: toRed ? '色を赤にする' : '色を青にする',
        onClick: () => {
          History.act('色の変更', () =>
            Store.setGroupColor(g.id, toRed ? GROUP_COLORS[0] : GROUP_COLORS[1]));
          render();
        },
      },
      {
        label: g.hidden ? 'カレンダーに表示する' : 'カレンダーから隠す',
        onClick: () => {
          History.act('表示の切り替え', () => Store.setGroupHidden(g.id, !g.hidden));
          render();
        },
      },
      {
        label: `${SCOPE_LABEL[g.scope === 'work' ? 'private' : 'work']}へ移動`,
        onClick: () => {
          History.act('移動', () =>
            Store.setGroupScope(g.id, g.scope === 'work' ? 'private' : 'work'));
          hidePopover();
          render();
        },
      },
      { separator: true },
      {
        label: '削除（中の予定ごと）', danger: true,
        onClick: () => {
          History.act('削除', () => Store.deleteGroup(g.id));
          hidePopover();
          clearSelection();
          render();
        },
      },
    ].concat(undoMenuItems()));
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
  const { bg, fg, accent } = barStyle(taskColor(t, g), subCount);

  const bar = document.createElement('div');
  bar.className = 'bar';
  bar.dataset.taskId = t.id;
  bar.style.background = bg;
  bar.style.color = fg;
  bar.style.setProperty('--accent-color', accent);
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
  // 小タスク一覧を開くのはダブルクリック（ワンクリックは選択に譲った）
  bar.addEventListener('dblclick', e => {
    e.stopPropagation();
    showPopover(t.id, bar);
  });
  bar.addEventListener('contextmenu', e => {
    e.preventDefault();
    e.stopPropagation();
    setSelection({ kind: 'task', id: t.id });
    const items = [
      { label: '名前を変更', onClick: () => { render(); const b = findBar(t.id); if (b) startNameEdit(b, Store.task(t.id)); } },
      { label: '小タスクを開く', onClick: () => { const b = findBar(t.id); if (b) showPopover(t.id, b); } },
      { label: 'カレンダーで見る', onClick: () => openCalendar({ ...idxToYM(t.fy, t.startMonth), taskId: t.id }) },
      { label: '色を変更', onClick: () => pickTaskColor(e, t, g) },
      { separator: true },
      { label: 'コピー', onClick: () => putTaskOnClipboard(t, 'copy') },
      { label: '切り取り', onClick: () => putTaskOnClipboard(t, 'cut') },
    ];
    if (clipboard && clipboard.kind === 'task') {
      items.push({ label: '貼り付け', onClick: () => pasteTaskAt(t.groupId, t.startMonth) });
    }
    items.push({ separator: true });
    items.push({
      label: '削除', danger: true,
      onClick: () => History.act('削除', () => {
        if (popoverTaskId === t.id) hidePopover();
        Store.deleteTask(t.id);
        clearSelection();
        render();
      }),
    });
    openContextMenu(e, t.name || '（無題）', items.concat(undoMenuItems()));
  });
  return bar;
}

// 色の一覧を右クリック位置に出して、1クリックで選ばせる
const colorMenuEl = $('colorMenu');

function openColorMenu(e, current, onPick, onReset) {
  colorMenuEl.innerHTML = '';

  const grid = document.createElement('div');
  grid.className = 'color-grid';
  for (const c of TASK_PALETTE) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'color-swatch' + (c.toLowerCase() === String(current).toLowerCase() ? ' is-active' : '');
    b.style.background = c;
    b.title = c;
    b.addEventListener('click', () => { closeColorMenu(); onPick(c); });
    grid.appendChild(b);
  }
  colorMenuEl.appendChild(grid);

  if (onReset) {
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'color-reset';
    reset.textContent = '項目の色に戻す';
    reset.addEventListener('click', () => { closeColorMenu(); onReset(); });
    colorMenuEl.appendChild(reset);
  }

  colorMenuEl.hidden = false;
  const r = colorMenuEl.getBoundingClientRect();
  const maxX = document.documentElement.clientWidth - r.width - 8;
  const maxY = document.documentElement.clientHeight - r.height - 8;
  colorMenuEl.style.left = (Math.max(8, Math.min(e.clientX, maxX)) + window.scrollX) + 'px';
  colorMenuEl.style.top = (Math.max(8, Math.min(e.clientY, maxY)) + window.scrollY) + 'px';
}

function closeColorMenu() { colorMenuEl.hidden = true; }

document.addEventListener('pointerdown', e => {
  if (!colorMenuEl.hidden && !colorMenuEl.contains(e.target)) closeColorMenu();
}, true);
window.addEventListener('scroll', closeColorMenu, true);

function pickTaskColor(e, t, g) {
  openColorMenu(e, t.color || taskColor(t, g),
    hex => {
      History.act('色の変更', () => Store.updateTask(t.id, { color: hex }));
      render();
    },
    () => {
      History.act('色の変更', () => Store.updateTask(t.id, { color: null }));
      render();
    });
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
    if (v && v !== g.name) History.act('名前の変更', () => Store.renameGroup(g.id, v));
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
      History.act('並べ替え', () =>
        Store.moveGroupBefore(row.dataset.groupId, before ? before.dataset.groupId : null));
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
  const t = History.act('中タスクの作成', () =>
    Store.addTask({ groupId: g.id, fy, startMonth: monthIdx, endMonth: monthIdx }));
  setSelection({ kind: 'task', id: t.id });
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
    else if (!cancel && v && v !== t.name) {
      History.act('名前の変更', () => Store.updateTask(t.id, { name: v }));
    }
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
  const duplicating = mode === 'move' && isDuplicateDrag(e);   // Mac=⌥ / Win=Ctrl で複製
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
    // 動かさずに離しただけなら「選択」。開くのはダブルクリック
    if (!moved) { setSelection({ kind: 'task', id: t.id }); return; }

    if (next.s !== orig.s || next.e !== orig.e) {
      if (duplicating) {
        History.act('複製', () => {
          const nt = Store.addTask({
            groupId: t.groupId, fy: t.fy,
            startMonth: next.s, endMonth: next.e,
            name: t.name, color: t.color,
          });
          const delta = next.s - orig.s;
          for (const s of Store.subtasksOf(t.id)) {
            Store.addSubtask({
              taskId: nt.id, name: s.name,
              startDate: s.startDate ? shiftDateByMonths(s.startDate, delta) : null,
              endDate: s.endDate ? shiftDateByMonths(s.endDate, delta) : null,
            });
          }
          setSelection({ kind: 'task', id: nt.id });
        });
      } else {
        History.act(mode === 'move' ? '移動' : '期間の変更', () => {
          Store.updateTask(t.id, { startMonth: next.s, endMonth: next.e });
          if (mode === 'move') shiftSubtasks(t.id, next.s - orig.s);
          else gatherStraySubtasks(Store.task(t.id));
        });
      }
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
    setSelection({ kind: 'subtask', id: s.id });
    openContextMenu(e, s.name || '（無題）', [
      { label: '名前を変更', onClick: () => renameInline(name, s.id) },
      { label: 'カレンダーで見る', onClick: open },
      { separator: true },
      { label: 'コピー', onClick: () => putSubtaskOnClipboard(s, 'copy') },
      { label: '切り取り', onClick: () => putSubtaskOnClipboard(s, 'cut') },
      { separator: true },
      {
        label: '削除', danger: true,
        onClick: () => { History.act('削除', () => Store.deleteSubtask(s.id)); clearSelection(); render(); },
      },
    ].concat(undoMenuItems()));
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
    const v = input.value.trim();
    if (v !== s.name) History.act('名前の変更', () => Store.updateSubtask(subId, { name: v }));
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
    const s = History.act('小タスクの追加', () => Store.addSubtask({ taskId: t.id }));
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
    <span class="sub-dot" style="background:${taskColor(t, g)}"></span>
    <input class="sub-name" type="text" placeholder="小タスク名">
    <span class="sub-date${s.startDate ? '' : ' unset'}"></span>
    <button type="button" class="sub-del" title="削除">×</button>`;

  const name = li.querySelector('.sub-name');
  name.value = s.name;
  name.addEventListener('change', () => {
    const v = name.value.trim();
    if (v !== s.name) History.act('名前の変更', () => Store.updateSubtask(s.id, { name: v }));
  });
  name.addEventListener('keydown', e => { if (e.key === 'Enter') name.blur(); });

  // ✕ はワンクリックで即削除（確認なし。戻したいときは Cmd+Z）
  li.querySelector('.sub-del').addEventListener('click', e => {
    e.stopPropagation();
    History.act('削除', () => Store.deleteSubtask(s.id));
    clearSelection();
    renderGroups();
    renderPopoverBody();
    if (!$('calendarOverlay').hidden) renderCalendar();
  });

  li.addEventListener('click', () => setSelection({ kind: 'subtask', id: s.id }));

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
    setSelection({ kind: 'subtask', id: s.id });
    openContextMenu(e, s.name || '（無題）', [
      { label: '名前を変更', onClick: () => { name.focus(); name.select(); } },
      { label: 'カレンダーで見る', onClick: open },
      { separator: true },
      { label: 'コピー', onClick: () => putSubtaskOnClipboard(s, 'copy') },
      { label: '切り取り', onClick: () => putSubtaskOnClipboard(s, 'cut') },
      { separator: true },
      {
        label: '削除', danger: true,
        onClick: () => {
          History.act('削除', () => Store.deleteSubtask(s.id));
          clearSelection();
          renderGroups();
          renderPopoverBody();
        },
      },
    ].concat(undoMenuItems()));
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
let calFilterGroupId = null;  // 指定があればその項目に属する小タスクだけ表示
let calSelectFor = null;      // 小タスクIDが入っていれば「期間を新規選択するモード」
let calSelection = null;      // 選択中の日付 {a, b}
let calPreview = null;        // ドラッグ中の仮の期間 {id, from, to}
let calGrid = { start: null, end: null };  // 画面に出ている7×n日の範囲（前後の月を含む）

function openCalendar({ y, m, taskId = null, groupId = null, selectFor = null }) {
  calY = y;
  calM = m;
  calFilterTaskId = taskId;
  calFilterGroupId = groupId;
  calSelectFor = selectFor;
  calSelection = null;
  calPreview = null;
  popoverEl.hidden = true;   // 隠すだけ（popoverTaskId は保持して閉じたときに戻す）
  $('calendarOverlay').hidden = false;
  renderCalendar();
}

// 項目の行のカレンダーアイコンから開く（その項目の小タスクを全部見せる）
function openCalendarForGroup(g) {
  const tasks = Store.tasksOf(g.id, fy);
  const subs = tasks.flatMap(t => Store.subtasksOf(t.id)).filter(s => s.startDate);
  // 予定があればその一番早い月、なければ今日の月を開く
  let y = today.getFullYear(), m = today.getMonth() + 1;
  if (subs.length) {
    const earliest = subs.reduce((a, b) => (dateNum(a.startDate) <= dateNum(b.startDate) ? a : b));
    const p = parseDate(earliest.startDate);
    y = p.y; m = p.m;
  }
  openCalendar({ y, m, groupId: g.id });
}

function closeCalendar() {
  $('calendarOverlay').hidden = true;
  calFilterTaskId = null;
  calFilterGroupId = null;
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

// カレンダーに出す小タスクを集める。
// 判定は「今の月」ではなく「画面に出ている7×n日ぶん」で行う。
// こうしないと月をまたぐ予定が前後の月のマスに描けない。
// 中タスクや項目から開いたときも、**他の予定は隠さず薄く出す**。
// 予定を決めるときは他の予定との兼ね合いを見たいため、絞り込みではなく強調にしている。
function calendarItems() {
  const from = dateNum(calGrid.start);
  const to = dateNum(calGrid.end);

  return Store.allSubtasks()
    .filter(s => s.startDate)
    .map(s => {
      const t = Store.task(s.taskId);
      const g = t ? Store.group(t.groupId) : null;
      const p = calPreview && calPreview.id === s.id
        ? { from: calPreview.from, to: calPreview.to }
        : { from: s.startDate, to: s.endDate || s.startDate };
      const focused =
        (!calFilterTaskId && !calFilterGroupId) ||
        (calFilterTaskId && s.taskId === calFilterTaskId) ||
        (calFilterGroupId && t && t.groupId === calFilterGroupId);
      return { s, t, g, from: p.from, to: p.to, focused: !!focused };
    })
    .filter(x =>
      inScope(x.g) && !x.g.hidden &&
      dateNum(x.to) >= from && dateNum(x.from) <= to);
}

function renderCalendar() {
  $('calendarTitle').textContent = `${calY}年${calM}月`;
  $('calToday').classList.toggle(
    'is-current',
    calY === today.getFullYear() && calM === today.getMonth() + 1);

  const scope = $('calendarScope');
  const filterTask = calFilterTaskId ? Store.task(calFilterTaskId) : null;
  const filterGroup = calFilterGroupId ? Store.group(calFilterGroupId) : null;
  scope.textContent = filterTask ? `${filterTask.name || '（無題）'} を編集中`
    : filterGroup ? `${filterGroup.name} を編集中` : '';

  $('calendarHint').textContent = calSelectFor
    ? 'カレンダー上をドラッグして期間を選んでください（1日だけならクリック）'
    : canAddSubtaskHere()
      ? '空いているところをダブルクリックで追加。ドラッグで移動、端で伸縮。右クリックでメニュー。'
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
  const lead = firstDow(calY, calM);
  const gridStart = addDays(first, -lead);
  const weekCount = Math.ceil((lead + last) / 7);

  // 前後の月にはみ出したマスも「本物の日付」として扱う。
  // これで年末年始のように月をまたぐ予定も作れる・動かせる。
  calGrid = { start: gridStart, end: addDays(gridStart, weekCount * 7 - 1) };

  const items = calendarItems();

  for (let w = 0; w < weekCount; w++) {
    const weekStart = addDays(gridStart, w * 7);
    const weekEnd = addDays(weekStart, 6);

    // この週に出る予定の区間を求め、週ごとに段を詰める
    // （前の週から続くものは週頭から始まるので、自然と上の段に並ぶ）
    const segs = [];
    for (const it of items) {
      // 月の端で切らない。週の端だけで切る（月をまたぐバーをそのまま描くため）
      const from = Math.max(ord(it.from), ord(weekStart));
      const to = Math.min(ord(it.to), ord(weekEnd));
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
      const outside = p.y !== calY || p.m !== calM;
      const kind = dayKind(iso);
      const cell = document.createElement('div');
      cell.className = 'cal-day'
        + (kind ? ' is-' + kind : '')
        + (iso === TODAY ? ' is-today' : '')
        + (outside ? ' other-month' : '');
      cell.dataset.date = iso;      // 前後の月のマスにも日付を持たせる
      const holiday = Holidays.name(iso);
      if (holiday) cell.title = holiday;
      const num = document.createElement('span');
      num.className = 'cal-date';
      num.textContent = outside ? `${p.m}/${p.d}` : p.d;
      cell.appendChild(num);
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
  bar.dataset.subId = it.s.id;
  if (!it.focused) bar.classList.add('is-unfocused');
  const st = calBarStyle(taskColor(it.t, it.g));
  bar.style.background = st.bg;
  bar.style.color = st.fg;
  bar.style.setProperty('--accent-color', st.accent);
  bar.style.left = `calc(${(startCol / 7) * 100}% + ${insL}px)`;
  bar.style.width = `calc(${(span / 7) * 100}% - ${insL + insR}px)`;
  bar.style.top = lane * (CAL_BAR_H + CAL_BAR_GAP) + 'px';

  // 小タスク名だけでは「何の予定か」が分からないので、上に項目名を添える。
  // 中タスク名まで出すと文字が多くて読みにくかったので出さない
  // （2026-07-29 本人の指摘。中タスクまで含めた所属はマウスを乗せれば出る）。
  const path = document.createElement('span');
  path.className = 'cal-bar-path';
  path.textContent = it.g ? (it.g.name || '（無題）') : '';
  bar.appendChild(path);

  const label = document.createElement('span');
  label.className = 'cal-bar-label';
  label.textContent = it.s.name || '（無題）';
  bar.appendChild(label);
  bar.title = `${it.g ? it.g.name : ''} / ${it.t ? (it.t.name || '（無題）') : ''}\n${it.s.name || '（無題）'}`;

  // 実際の開始日・終了日がこの区間にあるときだけ、伸縮用の持ち手を出す
  if (!contLeft) bar.appendChild(calHandle('left'));
  if (!contRight) bar.appendChild(calHandle('right'));

  bar.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    const grabbed = addDays(weekStart, startCol);
    const side = e.target.dataset.side || 'move';
    startCalBarDrag(e, it.s.id, side, grabbed, side === 'move' && isDuplicateDrag(e));
  });

  bar.addEventListener('contextmenu', e => {
    e.preventDefault();
    e.stopPropagation();
    setSelection({ kind: 'subtask', id: it.s.id });
    const items = [
      { label: '名前を変更', onClick: () => renameInline(label, it.s.id) },
      { separator: true },
      { label: 'コピー', onClick: () => putSubtaskOnClipboard(it.s, 'copy') },
      { label: '切り取り', onClick: () => putSubtaskOnClipboard(it.s, 'cut') },
    ];
    if (clipboard && clipboard.kind === 'subtask') {
      items.push({ label: 'ここに貼り付け', onClick: () => pasteSubtaskAt(it.from) });
    }
    items.push({ separator: true });
    items.push({
      label: '削除', danger: true,
      onClick: () => {
        History.act('削除', () => Store.deleteSubtask(it.s.id));
        clearSelection();
        renderCalendar();
        render();
      },
    });
    openContextMenu(e, it.s.name || '（無題）', items.concat(undoMenuItems()));
  });
  return bar;
}

// このカレンダーで小タスクを新規に足せるか（足す先の中タスクが決まるか）
function canAddSubtaskHere() {
  if (calFilterTaskId) return true;
  if (calFilterGroupId) return Store.tasksOf(calFilterGroupId, fy).length > 0;
  return false;
}

// 空いているマスのダブルクリックで小タスクを作る
function addSubtaskOnDate(iso) {
  let taskId = calFilterTaskId;
  if (!taskId && calFilterGroupId) {
    // 項目単位で開いているときは、その日を含む中タスクを優先して選ぶ
    const p = parseDate(iso);
    const a = absMonth(p.y, p.m);
    const tasks = Store.tasksOf(calFilterGroupId, fy);
    if (!tasks.length) return;
    const hit = tasks.find(t => {
      const r = taskAbsRange(t);
      return a >= r.from && a <= r.to;
    });
    taskId = (hit || tasks[0]).id;
  }
  if (!taskId) return;

  const s = History.act('小タスクの追加', () =>
    Store.addSubtask({ taskId, startDate: iso, endDate: iso }));
  setSelection({ kind: 'subtask', id: s.id });
  renderCalendar();
  render();
  // 作った直後に名前を入れられるようにする
  const bar = calEl.querySelector(`.cal-bar[data-sub-id="${s.id}"] .cal-bar-label`);
  if (bar) renameInline(bar, s.id);
}

function calHandle(side) {
  const h = document.createElement('span');
  h.className = 'cal-handle ' + side;
  h.dataset.side = side;
  return h;
}

// 画面上の座標から、カレンダーのどの日かを求める。
// 前後の月のマスも有効な日付として返す（月をまたいでドラッグできるようにするため）
function dateAtPoint(x, y) {
  for (const week of calEl.querySelectorAll('.cal-week')) {
    const r = week.getBoundingClientRect();
    if (y < r.top || y > r.bottom) continue;
    const col = Math.floor((x - r.left) / (r.width / 7));
    if (col < 0 || col > 6) return null;
    return addDays(week.dataset.weekStart, col);
  }
  return null;
}

// カレンダー上の予定バーのドラッグ（本体=移動 / 左右の端=伸縮）
function startCalBarDrag(e, subId, mode, grabbedDay, duplicating = false) {
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
    if (!moved) setSelection({ kind: 'subtask', id: subId });
    if (moved) {
      if (duplicating) {
        History.act('複製', () => {
          const ns = Store.addSubtask({
            taskId: s.taskId, name: s.name, startDate: next.from, endDate: next.to,
          });
          setSelection({ kind: 'subtask', id: ns.id });
        });
      } else {
        History.act(mode === 'move' ? '移動' : '期間の変更', () =>
          Store.updateSubtask(subId, { startDate: next.from, endDate: next.to }));
      }
    }
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
    const target = calSelectFor;
    History.act('期間の設定', () =>
      Store.updateSubtask(target, { startDate: asc ? a : b, endDate: asc ? b : a }));
    calSelectFor = null;      // 以降はバーを直接ドラッグして調整できる
    calSelection = null;
    renderCalendar();
    if (viewMode === 'day') renderDayView(); else renderGroups();
  });

  calEl.addEventListener('pointerleave', () => { dragging = false; });

  // 空いているマスの操作（バーの上はバー側のハンドラが先に止める）
  calEl.addEventListener('dblclick', e => {
    if (e.target.closest('.cal-bar')) return;
    const iso = dateAtPoint(e.clientX, e.clientY);
    if (!iso) return;
    if (!canAddSubtaskHere()) {
      $('calendarHint').textContent =
        '中タスクまたは項目のカレンダーアイコンから開くと、ここに予定を追加できます。';
      return;
    }
    addSubtaskOnDate(iso);
  });

  calEl.addEventListener('contextmenu', e => {
    if (e.target.closest('.cal-bar')) return;   // バーの上は専用メニュー
    const iso = dateAtPoint(e.clientX, e.clientY);
    if (!iso) return;
    e.preventDefault();
    const { m, d } = parseDate(iso);
    const items = [];
    if (canAddSubtaskHere()) {
      items.push({ label: 'ここに予定を追加', onClick: () => addSubtaskOnDate(iso) });
    }
    if (clipboard && clipboard.kind === 'subtask') {
      items.push({ label: '貼り付け', onClick: () => pasteSubtaskAt(iso) });
    }
    if (!items.length && !History.canUndo()) return;
    openContextMenu(e, `${m}月${d}日`, items.concat(undoMenuItems()));
  });
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
let dlgColor = DEFAULT_GROUP_COLOR.routine;

function renderSwatches() {
  const wrap = $('swatches');
  wrap.innerHTML = '';
  GROUP_COLORS.forEach(c => {
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
  dlgColor = DEFAULT_GROUP_COLOR.routine;
  $('groupName').value = '';
  document.querySelectorAll('.tag-btn').forEach(b => b.classList.toggle('is-active', b.dataset.tag === dlgTag));
  renderSwatches();
  $('groupDialog').hidden = false;
  $('groupName').focus();
}

document.querySelectorAll('.tag-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    dlgTag = btn.dataset.tag;
    dlgColor = DEFAULT_GROUP_COLOR[dlgTag];
    document.querySelectorAll('.tag-btn').forEach(b => b.classList.toggle('is-active', b === btn));
    renderSwatches();
  });
});

function saveGroup() {
  const name = $('groupName').value.trim();
  if (!name) { $('groupName').focus(); return; }
  History.act('項目の追加', () =>
    Store.addGroup({ name, tag: dlgTag, color: dlgColor, scope: scopeMode }));
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
  if (e.key === 'Escape') {
    if (!menuEl.hidden) closeContextMenu();
    else if (!$('calendarOverlay').hidden) closeCalendar();
    else if (!$('groupDialog').hidden) $('groupDialog').hidden = true;
    else if (clipboard) { clipboard = null; paintClipboard(); }
    else if (selection) clearSelection();
    else hidePopover();
    return;
  }

  // 文字入力中はアプリ側のショートカットを横取りしない
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;

  // 選択中のものを Delete / Backspace で消す（確認なし。戻すのは Cmd+Z）
  if ((e.key === 'Delete' || e.key === 'Backspace') && selection) {
    if (selection.kind === 'task') {
      const t = Store.task(selection.id);
      if (!t) return;
      e.preventDefault();
      History.act('削除', () => {
        if (popoverTaskId === t.id) hidePopover();
        Store.deleteTask(t.id);
      });
      clearSelection();
      render();
      if (!$('calendarOverlay').hidden) renderCalendar();
    } else if (selection.kind === 'subtask') {
      const s = Store.subtask(selection.id);
      if (!s) return;
      e.preventDefault();
      History.act('削除', () => Store.deleteSubtask(s.id));
      clearSelection();
      render();
      if (!$('calendarOverlay').hidden) renderCalendar();
    }
    return;
  }

  if (!isCmd(e)) return;

  const key = e.key.toLowerCase();

  if (key === 'z' && !e.shiftKey) {
    if (!History.canUndo()) return;
    e.preventDefault();
    doUndo();
    return;
  }

  if (key === 'c' || key === 'x') {
    if (!selection) return;
    const mode = key === 'c' ? 'copy' : 'cut';
    if (selection.kind === 'task') {
      const t = Store.task(selection.id);
      if (t) { e.preventDefault(); putTaskOnClipboard(t, mode); }
    } else if (selection.kind === 'subtask') {
      const s = Store.subtask(selection.id);
      if (s) { e.preventDefault(); putSubtaskOnClipboard(s, mode); }
    }
    return;
  }

  if (key === 'v') {
    if (!clipboard || !selection) return;
    if (clipboard.kind === 'task') {
      // 貼り先はセルの選択が基本。中タスクを選んでいればその位置に重ねる
      if (selection.kind === 'cell') {
        e.preventDefault();
        pasteTaskAt(selection.groupId, selection.monthIdx);
      } else if (selection.kind === 'task') {
        const t = Store.task(selection.id);
        if (t) { e.preventDefault(); pasteTaskAt(t.groupId, t.startMonth); }
      }
    } else if (clipboard.kind === 'subtask' && selection.kind === 'subtask') {
      const s = Store.subtask(selection.id);
      if (s && s.startDate) { e.preventDefault(); pasteSubtaskAt(s.startDate); }
    }
  }
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

function hideSyncError() {
  const bar = $('syncError');
  if (bar) bar.hidden = true;
}

// ---------- ログイン ----------
function showLogin(message) {
  Store.reset();
  clipboard = null;
  clearSelection();
  render();                        // 前に見えていた予定を残さない
  $('logout').hidden = true;
  $('loginOverlay').hidden = false;
  const err = $('loginError');
  err.textContent = message || '';
  err.hidden = !message;
  $('loginPassword').value = '';
  $('loginPassword').focus();
}

$('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = $('loginSubmit');
  const err = $('loginError');
  btn.disabled = true;
  btn.textContent = 'ログイン中…';
  err.hidden = true;
  try {
    await Auth.signIn($('loginPassword').value);
    $('loginPassword').value = '';
    $('loginOverlay').hidden = true;
    await start();
  } catch (e2) {
    err.textContent = /invalid|credential/i.test(e2.message)
      ? 'パスワードが違います。'
      : `ログインできませんでした: ${e2.message}`;
    err.hidden = false;
    $('loginPassword').focus();
  } finally {
    btn.disabled = false;
    btn.textContent = 'ログイン';
  }
});

$('logout').addEventListener('click', () => {
  Auth.signOut();
  hideSyncError();
  showLogin();
});

Store.onError = err => {
  if (err && err.isAuth) showLogin('ログインの期限が切れました。もう一度お願いします。');
  else showSyncError('⚠ 保存できませんでした。通信状況を確認して、ページを再読み込みしてください。');
};

// ---------- 起動 ----------
async function start() {
  if (!Auth.isLoggedIn()) { showLogin(); return; }
  $('loginOverlay').hidden = true;
  $('logout').hidden = false;
  try {
    await Store.init();            // Supabase から読み終えてから最初の描画をする
    hideSyncError();
    render();
  } catch (err) {
    if (err && err.isAuth) { showLogin('ログインの期限が切れました。もう一度お願いします。'); return; }
    console.error('Supabaseからの読み込みに失敗しました', err);
    showSyncError('⚠ データを読み込めませんでした。通信状況を確認して再読み込みしてください。');
    render();
  }
}

start();
