var SRC = readFile('app.js');
function grab(re, name) {
  var m = SRC.match(re);
  if (!m) throw new Error('見つからない: ' + name);
  return m[0];
}
eval([
  grab(/^function hexToHsl[\s\S]*?\n}/m, 'hexToHsl'),
  grab(/^function tint[\s\S]*?\n}/m, 'tint'),
  grab(/^const calBarStyle = .*$/m, 'calBarStyle').replace('const', 'var'),
  grab(/^const barStyle = [\s\S]*?;$/m, 'barStyle').replace('const', 'var'),
  grab(/^const dvTaskStyle = .*$/m, 'dvTaskStyle').replace('const', 'var'),
  grab(/^const dvSubStyle = .*$/m, 'dvSubStyle').replace('const', 'var'),
].join('\n'));

// まとめる前の実装（v12 時点のもの）を、比較用にそのまま書き写したもの
function old_calBarStyle(b){var x=hexToHsl(b);return{bg:'hsl('+x.h.toFixed(0)+' '+Math.min(x.s,68).toFixed(0)+'% 94%)',fg:'hsl('+x.h.toFixed(0)+' '+Math.min(x.s,52).toFixed(0)+'% 27%)',accent:b};}
function old_barStyle(b,c){var x=hexToHsl(b);var t=Math.min(c,5)/5;return{bg:'hsl('+x.h.toFixed(0)+' '+Math.min(x.s,68).toFixed(0)+'% '+(95-7*t).toFixed(0)+'%)',fg:'hsl('+x.h.toFixed(0)+' '+Math.min(x.s,52).toFixed(0)+'% 27%)',accent:b};}
function old_dvTaskStyle(b){var x=hexToHsl(b);return{bg:'hsl('+x.h.toFixed(0)+' '+Math.min(x.s,60).toFixed(0)+'% 91%)',fg:'hsl('+x.h.toFixed(0)+' '+Math.min(x.s,52).toFixed(0)+'% 24%)',accent:b};}
function old_dvSubStyle(b){var x=hexToHsl(b);return{bg:'hsl('+x.h.toFixed(0)+' '+Math.min(x.s,55).toFixed(0)+'% 98%)',fg:'hsl('+x.h.toFixed(0)+' '+Math.min(x.s,52).toFixed(0)+'% 30%)',line:'hsl('+x.h.toFixed(0)+' '+Math.min(x.s,45).toFixed(0)+'% 79%)',accent:b};}

var PALETTE = ['#C0392B','#E05C43','#E8743B','#EE9B2F','#D4A017','#8FA31E','#5E9C3B','#2E9E63',
  '#1FA08C','#2496A8','#3E7CB1','#3F5FA8','#5B54B8','#7B4FC0','#9B4DBA','#C0459B','#D14477',
  '#B5526B','#8C6239','#6B7280','#D9455F','#FFFFFF','#000000'];

var pass = 0, fail = 0;
// キーの並び順は関係ない。中身だけを見る
function norm(o) {
  return Object.keys(o).sort().map(function (k) { return k + '=' + o[k]; }).join('|');
}
function same(a, b, label) {
  if (norm(a) === norm(b)) { pass++; return; }
  fail++; print('NG ' + label + '\n   前: ' + norm(b) + '\n   後: ' + norm(a));
}
PALETTE.forEach(function (hex) {
  same(calBarStyle(hex), old_calBarStyle(hex), 'calBarStyle ' + hex);
  same(dvTaskStyle(hex), old_dvTaskStyle(hex), 'dvTaskStyle ' + hex);
  same(dvSubStyle(hex), old_dvSubStyle(hex), 'dvSubStyle ' + hex);
  for (var c = 0; c <= 7; c++) same(barStyle(hex, c), old_barStyle(hex, c), 'barStyle ' + hex + ' /' + c);
});
print(fail === 0 ? 'まとめる前と完全に同じ色（' + pass + '通り）' : '色が変わった: ' + fail + '件');
