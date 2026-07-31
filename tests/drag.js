// 中タスクのドラッグをまとめた（startTaskDrag）ので、
// 一覧と詳細ビューの両方で、まとめる前と同じ月に落ち着くかを確かめる。
// DOM は偽物を渡して、実物の startTaskDrag をそのまま動かす。

var SRC = readFile('app.js');

function grabFn(name) {
  var i = SRC.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('見つからない: function ' + name);
  var j = SRC.indexOf('{', i);
  var depth = 0;
  for (var k = j; k < SRC.length; k++) {
    if (SRC[k] === '{') depth++;
    else if (SRC[k] === '}') { depth--; if (depth === 0) return SRC.slice(i, k + 1); }
  }
  throw new Error('括弧が閉じてない: ' + name);
}

// 実物の startTaskDrag を持ってくる。周りは全部ここで用意した偽物で受ける
var calls = [];
var setup = [
  'var IS_MAC = false;',
  'var isDuplicateDrag = function (e) { return !!e.ctrlKey; };',
  'var Store = {',
  '  addTask: function (a) { calls.push(["addTask", a]); return { id: "new" }; },',
  '  updateTask: function (id, p) { calls.push(["updateTask", id, p]); },',
  '  addSubtask: function (a) { calls.push(["addSubtask", a]); },',
  '  subtasksOf: function () { return []; },',
  '  task: function (id) { return { id: id }; },',
  '};',
  'var History = { act: function (label, fn) { calls.push(["history", label]); return fn(); } };',
  'var setSelection = function (s) { calls.push(["select", s]); };',
  'var shiftSubtasks = function (id, d) { calls.push(["shiftSubtasks", d]); };',
  'var gatherStraySubtasks = function () { calls.push(["gatherStray"]); };',
  'var shiftDateByMonths = function (iso) { return iso; };',
  'var render = function () { calls.push(["render"]); };',
].join('\n');

eval(setup + '\n' + grabFn('startTaskDrag'));

// ---------- 偽のバー ----------
function fakeBar() {
  var handlers = {};
  return {
    classList: { add: function () {}, remove: function () {} },
    setPointerCapture: function () {},
    addEventListener: function (n, fn) { handlers[n] = fn; },
    removeEventListener: function (n) { delete handlers[n]; },
    fire: function (n, ev) { if (handlers[n]) handlers[n](ev); },
  };
}

// ドラッグを1回演じる。掴んだ場所から dx px 動かして離す
function drag(task, opts) {
  calls = [];
  var placed = [];
  var bar = fakeBar();
  var down = {
    button: 0,
    clientX: 0,
    pointerId: 1,
    ctrlKey: !!opts.duplicate,
    target: { tagName: 'DIV', dataset: opts.side ? { side: opts.side } : {} },
    stopPropagation: function () {},
  };
  startTaskDrag(down, task, bar, {
    cellW: function () { return opts.cellW; },
    place: function (s, e) { placed.push([s, e]); },
  });
  bar.fire('pointermove', { clientX: opts.dx });
  bar.fire('pointerup', {});
  return { placed: placed, calls: calls };
}

// ---------- テストの道具 ----------
var pass = 0, fail = 0;
function eq(actual, expected, label) {
  var a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a === b) { pass++; return; }
  fail++;
  print('NG  ' + label + '\n      期待: ' + b + '\n      実際: ' + a);
}
function find(calls, name) {
  for (var i = 0; i < calls.length; i++) if (calls[i][0] === name) return calls[i];
  return null;
}

var T = { id: 't1', groupId: 'g1', fy: 2026, startMonth: 3, endMonth: 5, name: 'x', color: null };

// ---------- 移動 ----------
var r = drag(T, { cellW: 100, dx: 200 });
eq(r.placed[r.placed.length - 1], [5, 7], '右へ2マス動かすと2ヶ月ずれる');
eq(find(r.calls, 'updateTask')[2], { startMonth: 5, endMonth: 7 }, '保存されるのも2ヶ月ぶん');
eq(find(r.calls, 'history')[1], '移動', '履歴のラベルは「移動」');
eq(find(r.calls, 'shiftSubtasks')[1], 2, '小タスクも同じ2ヶ月だけ動く');

r = drag(T, { cellW: 100, dx: -200 });
eq(find(r.calls, 'updateTask')[2], { startMonth: 1, endMonth: 3 }, '左へも動く');
eq(find(r.calls, 'shiftSubtasks')[1], -2, '小タスクも左へ');

// 年度の外へは出さない
r = drag(T, { cellW: 100, dx: 9999 });
eq(find(r.calls, 'updateTask')[2], { startMonth: 9, endMonth: 11 }, '右端（3月）で止まる');
r = drag(T, { cellW: 100, dx: -9999 });
eq(find(r.calls, 'updateTask')[2], { startMonth: 0, endMonth: 2 }, '左端（4月）で止まる');

// ---------- 伸縮 ----------
r = drag(T, { cellW: 100, dx: -200, side: 'left' });
eq(find(r.calls, 'updateTask')[2], { startMonth: 1, endMonth: 5 }, '左端を引っ張ると頭だけ伸びる');
eq(find(r.calls, 'history')[1], '期間の変更', '履歴のラベルは「期間の変更」');
eq(find(r.calls, 'gatherStray') !== null, true, 'はみ出した小タスクを寄せる処理が走る');
eq(find(r.calls, 'shiftSubtasks'), null, '伸縮では小タスクを一律に動かさない');

r = drag(T, { cellW: 100, dx: 200, side: 'right' });
eq(find(r.calls, 'updateTask')[2], { startMonth: 3, endMonth: 7 }, '右端を引っ張ると尻だけ伸びる');

// 端を追い越さない
r = drag(T, { cellW: 100, dx: 9999, side: 'left' });
eq(find(r.calls, 'updateTask')[2], { startMonth: 5, endMonth: 5 }, '左端は終わりの月を越えない');
r = drag(T, { cellW: 100, dx: -9999, side: 'right' });
eq(find(r.calls, 'updateTask')[2], { startMonth: 3, endMonth: 3 }, '右端は始まりの月を下回らない');

// ---------- 複製（Mac=⌥ / Win=Ctrl）----------
r = drag(T, { cellW: 100, dx: 200, duplicate: true });
eq(find(r.calls, 'history')[1], '複製', '履歴のラベルは「複製」');
eq(find(r.calls, 'updateTask'), null, '元の中タスクは動かさない');
var added = find(r.calls, 'addTask')[1];
eq([added.startMonth, added.endMonth], [5, 7], '複製先は動かした位置');
eq([added.groupId, added.fy, added.name], ['g1', 2026, 'x'], '項目・年度・名前は引き継ぐ');
eq(find(r.calls, 'select')[1], { kind: 'task', id: 'new' }, '複製したほうが選択される');

// ---------- 動かさずに離したとき ----------
calls = [];
var bar = fakeBar();
startTaskDrag(
  { button: 0, clientX: 0, pointerId: 1, target: { tagName: 'DIV', dataset: {} }, stopPropagation: function () {} },
  T, bar, { cellW: function () { return 100; }, place: function () {} });
bar.fire('pointermove', { clientX: 2 });   // 3px 以内は「動かしていない」
bar.fire('pointerup', {});
eq(find(calls, 'select')[1], { kind: 'task', id: 't1' }, 'ほぼ動かさずに離したら「選択」だけ');
eq(find(calls, 'updateTask'), null, 'そのときは保存しない');
eq(find(calls, 'render'), null, '描き直しもしない');

// ---------- 右クリックや文字入力中は始まらない ----------
calls = [];
bar = fakeBar();
startTaskDrag(
  { button: 2, clientX: 0, pointerId: 1, target: { tagName: 'DIV', dataset: {} }, stopPropagation: function () {} },
  T, bar, { cellW: function () { return 100; }, place: function () {} });
eq(calls.length, 0, '右クリックではドラッグを始めない');

calls = [];
bar = fakeBar();
startTaskDrag(
  { button: 0, clientX: 0, pointerId: 1, target: { tagName: 'INPUT', dataset: {} }, stopPropagation: function () {} },
  T, bar, { cellW: function () { return 100; }, place: function () {} });
eq(calls.length, 0, '名前を書き換えている最中は始めない');

// ---------- 1マスの幅が違っても同じ結果になる（＝一覧と詳細ビューで揃う）----------
// 一覧は12ヶ月ぶんの幅、詳細ビューは36ヶ月ぶんの幅。1マスあたりの px が違うだけ
var listCell = 1200 / 12;    // 一覧: 100px
var dvCell = 3600 / 36;      // 詳細ビュー: 100px（同じ幅になるよう合わせた場合）
eq(
  find(drag(T, { cellW: listCell, dx: listCell * 2 }).calls, 'updateTask')[2],
  find(drag(T, { cellW: dvCell, dx: dvCell * 2 }).calls, 'updateTask')[2],
  '一覧でも詳細ビューでも、2マス動かせば2ヶ月');

print('');
print(fail === 0 ? ('全部通った（' + pass + '件）') : ('失敗 ' + fail + '件 / 成功 ' + pass + '件'));
