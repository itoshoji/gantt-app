// 詳細ビューの計算まわりのテスト。
// app.js から実物のソースを切り出して動かすので、テストと実装がズレない。

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

function grabConst(name) {
  var re = new RegExp('^const ' + name + ' = .*$', 'm');
  var m = SRC.match(re);
  if (!m) throw new Error('見つからない: const ' + name);
  return 'var ' + m[0].slice('const '.length);
}

var pieces = [];
['MONTH_LABELS', 'DOW', 'DV_HEAD_W', 'DV_COL_MIN', 'DV_COL_MAX', 'DV_NARROW', 'DV_WINDOW',
 'pad2', 'ymd', 'parseDate', 'dateNum', 'daysInMonth',
 'dowOf', 'absMonth', 'absToYM', 'toUTC', 'ord', 'dayDiff', 'fyOf', 'fyOfIso']
  .forEach(function (n) { pieces.push(grabConst(n)); });

['idxToYM', 'ymToIdx', 'addDays', 'fmtShort',
 'dvAxis', 'dvTodayPos', 'dvLeftPos', 'dvPosToIso', 'dvIsoToPos', 'dvScrollToPos',
 'dvFitColW', 'dvCurColW', 'dvTaskSpan', 'dvPlace', 'dvPlaceExact',
 'dvSpanCols', 'dvRangeLabel', 'assignLanes']
  .forEach(function (n) { pieces.push(grabFn(n)); });

// 画面状態と、DOM のかわり（実物では let / document から取るもの）
var setup = [
  'var dvMode, dvFy, dvColW;',
  // 今日を 2026-07-31（金）に固定して、実行日でテストが揺れないようにする
  'var today = new Date(2026, 6, 31);',
  'var TODAY = "2026-07-31";',
  'var scrollEl = { clientWidth: 1200, scrollLeft: 0 };',
  'function $(id) { return id === "detailScroll" ? scrollEl : null; }',
].join('\n');

eval(setup + '\n' + pieces.join('\n'));

// ---------- テストの道具 ----------
var pass = 0, fail = 0;
function eq(actual, expected, label) {
  var a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a === b) { pass++; return; }
  fail++;
  print('NG  ' + label + '\n      期待: ' + b + '\n      実際: ' + a);
}
function ok(cond, label) { eq(!!cond, true, label); }

function fakeEl() {
  var el = { style: {}, cls: {} };
  el.classList = { toggle: function (n, v) { el.cls[n] = !!v; } };
  return el;
}
function place(span, axis) {
  var el = fakeEl();
  dvPlace(el, span, axis);
  return { left: el.style.left, width: el.style.width, clipL: el.cls['clip-left'], clipR: el.cls['clip-right'] };
}

function reset() { dvColW = null; scrollEl.scrollLeft = 0; scrollEl.clientWidth = 1200; }

// ---------- 年度の判定 ----------
eq(fyOf(2026, 3), 2025, '3月は前の年度');
eq(fyOf(2026, 4), 2026, '4月から新しい年度');
eq(fyOfIso('2027-03-31'), 2026, '年度またぎの日付');

// ---------- 横軸は一続き ----------
dvFy = 2026; reset();

dvMode = 'year';
var yearAxis = dvAxis();
eq(yearAxis.unit, 'month', '年は月の目盛り');
eq(yearAxis.count, 36, '年は前後1年ぶんを含めて36ヶ月');
eq(yearAxis.from, absMonth(2025, 4), '左端は前年度の4月');
eq(yearAxis.to, absMonth(2028, 3), '右端は翌年度の3月');

dvMode = 'quarter';
eq(dvAxis(), yearAxis, '四半期は年と同じ目盛り（見せる幅だけが違う）');

dvMode = 'month';
var monthAxis = dvAxis();
eq(monthAxis.unit, 'day', '月は日の目盛り');
eq(monthAxis.start, '2026-03-01', '左端は年度の頭の1ヶ月前');
eq(monthAxis.end, '2027-05-01', '右端は年度の終わりの1ヶ月後');
eq(monthAxis.count, dayDiff('2026-03-01', '2027-05-01') + 1, '列数は日数ぶん');

dvMode = 'week';
eq(dvAxis(), monthAxis, '週は月と同じ目盛り（見せる幅だけが違う）');
// ↑ここが「月跨ぎ・週跨ぎがシームレス」の中身。
//   月や週で切っていないので、境目でも予定が途切れない

// 年度をまたぐ中タスクを拾えるだけの年度をなめているか
ok(monthAxis.fyFrom <= 2026 && monthAxis.fyTo >= 2026, '日の目盛りは当該年度を含む');
ok(monthAxis.fyFrom <= 2025, '前年度から始まる予定も拾える');
ok(yearAxis.fyFrom <= 2025 && yearAxis.fyTo >= 2027, '月の目盛りは前後の年度も拾える');

// ---------- 1列の幅 ----------
reset();
dvMode = 'year';
eq(dvFitColW(dvAxis()), (1200 - DV_HEAD_W) / 12, '年は12列ぶんが画面に収まる幅');
dvMode = 'quarter';
eq(dvFitColW(dvAxis()), (1200 - DV_HEAD_W) / 3, '四半期は3列ぶん');
dvMode = 'week';
eq(dvFitColW(dvAxis()), (1200 - DV_HEAD_W) / 7, '週は7列ぶん');
dvMode = 'month';
eq(dvFitColW(dvAxis()), (1200 - DV_HEAD_W) / 31, '月は31列ぶん');

// 画面が狭くても、細くなりすぎる手前で止める
scrollEl.clientWidth = 400;
ok(dvFitColW(dvAxis()) === DV_COL_MIN.day, '狭い画面では最小の列幅で止まる');
scrollEl.clientWidth = 1200;

eq(dvCurColW(dvAxis()), dvFitColW(dvAxis()), '拡大していないときは幅に合わせた値');
dvColW = 77;
eq(dvCurColW(dvAxis()), 77, '拡大中はその値を使う');
dvColW = null;

// ---------- 左端の位置 ----------
reset();
dvMode = 'month';
var ax = dvAxis();
var colW = 40;

eq(dvLeftPos(ax, colW), ax.from, 'スクロール0なら左端は目盛りの先頭');
scrollEl.scrollLeft = colW * 10;
eq(dvLeftPos(ax, colW), ax.from + 10, '10列ぶん送れば左端も10進む');
scrollEl.scrollLeft = colW * 99999;
eq(dvLeftPos(ax, colW), ax.to, '行き過ぎても右端で止まる');
scrollEl.scrollLeft = -500;
eq(dvLeftPos(ax, colW), ax.from, '戻り過ぎても左端で止まる');
scrollEl.scrollLeft = 0;

// 「今日」を左端に持ってくる
dvScrollToPos(ax, colW, dvTodayPos(ax));
eq(scrollEl.scrollLeft, (ord('2026-07-31') - ax.from) * colW, '今日が左端に来る位置までスクロールする');
eq(dvLeftPos(ax, colW), ord('2026-07-31'), '結果、左端の列が今日になる');
scrollEl.scrollLeft = 0;

// ---------- 表示を切り替えても同じ場所に居る ----------
dvMode = 'month';
var dayAxis = dvAxis();
var iso = dvPosToIso(dayAxis, ord('2026-09-15'));
eq(iso, '2026-09-15', '日の目盛りの位置はそのまま日付');
dvMode = 'year';
var monAxis = dvAxis();
eq(dvIsoToPos(monAxis, iso), absMonth(2026, 9), '月の目盛りに移すとその月になる');
eq(dvPosToIso(monAxis, absMonth(2026, 9)), '2026-09-01', '月の位置は月初の日付に均す');
eq(dvIsoToPos(dayAxis, '2026-09-01'), ord('2026-09-01'), '日の目盛りに戻せば通し日番号');

// ---------- 見出し ----------
reset();
dvMode = 'week';
ax = dvAxis();
colW = (1200 - DV_HEAD_W) / 7;
dvScrollToPos(ax, colW, ord('2026-07-26'));
eq(dvRangeLabel(ax, colW), '2026年 7/26(日) 〜 8/1(土)', '週の見出しは月をまたいで出る');

dvMode = 'month';
ax = dvAxis();
colW = (1200 - DV_HEAD_W) / 31;
dvScrollToPos(ax, colW, ord('2026-07-20'));
var lbl = dvRangeLabel(ax, colW);
ok(lbl.indexOf('2026年 7/20') === 0, '月の見出しは左端の日付から始まる（' + lbl + '）');

dvMode = 'year';
ax = dvAxis();
colW = (1200 - DV_HEAD_W) / 12;
dvScrollToPos(ax, colW, absMonth(2026, 4));
eq(dvRangeLabel(ax, colW), '2026年4月 〜 2027年3月', '年の見出しは年をまたぐ');
dvScrollToPos(ax, colW, absMonth(2026, 5));
eq(dvRangeLabel(ax, colW), '2026年5月 〜 2027年4月', '1ヶ月送れば見出しもずれる（一続きなので）');

dvMode = 'quarter';
ax = dvAxis();
colW = (1200 - DV_HEAD_W) / 3;
dvScrollToPos(ax, colW, absMonth(2026, 7));
eq(dvRangeLabel(ax, colW), '2026年 7月〜9月', '四半期の見出し');

// ---------- 中タスクの期間を軸の単位に直す ----------
reset();
var t = { fy: 2026, startMonth: 0, endMonth: 2 };      // 4月〜6月
dvMode = 'year';
eq(dvTaskSpan(t, dvAxis()), { from: absMonth(2026, 4), to: absMonth(2026, 6) }, '4-6月（月の単位）');
dvMode = 'month';
var sp = dvTaskSpan(t, dvAxis());
eq(sp.from, ord('2026-04-01'), '4-6月の始まりは4/1');
eq(sp.to, ord('2026-06-30'), '4-6月の終わりは6/30');

var t2 = { fy: 2026, startMonth: 9, endMonth: 11 };    // 1月〜3月（翌年）
sp = dvTaskSpan(t2, dvAxis());
eq(sp.from, ord('2027-01-01'), '年をまたぐ中タスクの始まり');
eq(sp.to, ord('2027-03-31'), '年をまたぐ中タスクの終わり');

// ---------- バーの位置と幅 ----------
dvMode = 'year'; dvFy = 2026;
ax = dvAxis();
var r = place(dvTaskSpan(t, ax), ax);
// 36ヶ月の目盛りの中で、2026年4月は12番目（0起点）から3ヶ月ぶん
eq(r.left, 'calc(' + ((12 / 36) * 100) + '% + 3px)', '4月始まりの位置');
eq(r.width, 'calc(' + ((3 / 36) * 100) + '% - 6px)', '3ヶ月ぶんの幅');
eq([r.clipL, r.clipR], [false, false], '目盛りの中に収まっていれば切り取りなし');

// 目盛りの外まで伸びるものは切り取る
dvMode = 'month';
ax = dvAxis();
r = place({ from: ord('2020-01-01'), to: ord('2030-01-01') }, ax);
eq([r.clipL, r.clipR], [true, true], '両側にはみ出している');
eq(r.left, 'calc(0% + 0px)', '左は切り取られて0');
eq(r.width, 'calc(100% - 0px)', '幅いっぱい');

// 余白なしの配置（空きマスの層）
var exact = fakeEl();
dvPlaceExact(exact, { from: ax.from + 5, to: ax.from + 9 }, ax);
eq(exact.style.left, ((5 / ax.count) * 100) + '%', '空きマスの層は余白なしで置く');
eq(exact.style.width, ((5 / ax.count) * 100) + '%', '5列ぶんぴったり');

// ---------- 画面に出る列数（名前を外に出すかの判定） ----------
dvMode = 'month';
ax = dvAxis();
eq(dvSpanCols({ from: ord('2026-07-05'), to: ord('2026-07-05') }, ax), 1, '1日ぶんは1列');
eq(dvSpanCols({ from: ord('2026-07-05'), to: ord('2026-07-09') }, ax), 5, '5日ぶんは5列');
eq(dvSpanCols({ from: ord('2020-01-01'), to: ord('2026-03-05') }, ax), 5,
   '左にはみ出す分は数えない（3/1〜3/5の5列）');
eq(dvSpanCols({ from: ord('2019-01-01'), to: ord('2019-12-31') }, ax), 0, '範囲の外なら0');

ok(1 * 40 < DV_NARROW.sub, '1日ぶんは細いので名前を外に出す');
ok(5 * 40 >= DV_NARROW.sub, '5日ぶんあれば名前はバーの中に入る');

// ---------- 段の振り分け（小タスクの重なり） ----------
var lanes = assignLanes([
  { id: 'a', from: ord('2026-07-01'), to: ord('2026-07-10') },
  { id: 'b', from: ord('2026-07-05'), to: ord('2026-07-08') },
  { id: 'c', from: ord('2026-07-11'), to: ord('2026-07-12') },
]);
eq(lanes.laneCount, 2, '重なりは2段になる');
var byId = {};
lanes.sorted.forEach(function (x) { byId[x.id] = x.lane; });
eq(byId.a, 0, '長いほうが上の段');
eq(byId.b, 1, '重なるほうが下の段');
eq(byId.c, 0, '重ならなければ上の段に戻る');

print('');
print(fail === 0 ? ('全部通った（' + pass + '件）') : ('失敗 ' + fail + '件 / 成功 ' + pass + '件'));
