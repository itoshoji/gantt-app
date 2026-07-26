/*
 * 日本の祝日。ネット接続なしで動かすため、法律どおりの計算をここに持たせている。
 * 春分・秋分は 1980〜2099年で有効な近似式を使用。
 */
const Holidays = (() => {
  const pad2 = n => String(n).padStart(2, '0');
  const key = (y, m, d) => `${y}-${pad2(m)}-${pad2(d)}`;
  const dowOf = (y, m, d) => new Date(y, m - 1, d).getDay();
  const lastDay = (y, m) => new Date(y, m, 0).getDate();

  // その月の n 番目の月曜日
  const nthMonday = (y, m, n) => 1 + ((8 - dowOf(y, m, 1)) % 7) + (n - 1) * 7;

  const vernal = y => Math.floor(20.8431 + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4));
  const autumnal = y => Math.floor(23.2488 + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4));

  const cache = {};

  function build(y) {
    const map = {};
    const put = (m, d, name) => { if (d >= 1 && d <= lastDay(y, m)) map[key(y, m, d)] = name; };

    put(1, 1, '元日');
    put(1, nthMonday(y, 1, 2), '成人の日');
    put(2, 11, '建国記念の日');
    put(2, 23, '天皇誕生日');
    put(3, vernal(y), '春分の日');
    put(4, 29, '昭和の日');
    put(5, 3, '憲法記念日');
    put(5, 4, 'みどりの日');
    put(5, 5, 'こどもの日');
    put(7, nthMonday(y, 7, 3), '海の日');
    put(8, 11, '山の日');
    put(9, nthMonday(y, 9, 3), '敬老の日');
    put(9, autumnal(y), '秋分の日');
    put(10, nthMonday(y, 10, 2), 'スポーツの日');
    put(11, 3, '文化の日');
    put(11, 23, '勤労感謝の日');

    // 振替休日: 祝日が日曜のとき、その後の最初の平日（祝日でない日）を休みにする
    for (let m = 1; m <= 12; m++) {
      for (let d = 1; d <= lastDay(y, m); d++) {
        if (!map[key(y, m, d)] || dowOf(y, m, d) !== 0) continue;
        let t = new Date(y, m - 1, d);
        do {
          t = new Date(t.getTime() + 86400000);
        } while (map[key(t.getFullYear(), t.getMonth() + 1, t.getDate())]);
        if (t.getFullYear() === y) {
          map[key(t.getFullYear(), t.getMonth() + 1, t.getDate())] = '振替休日';
        }
      }
    }

    // 国民の休日: 祝日と祝日に挟まれた平日（例: 敬老の日と秋分の日の間の日）
    for (let m = 1; m <= 12; m++) {
      for (let d = 2; d <= lastDay(y, m) - 1; d++) {
        if (map[key(y, m, d)] || dowOf(y, m, d) === 0) continue;
        const prev = new Date(y, m - 1, d - 1);
        const nextD = new Date(y, m - 1, d + 1);
        const has = t => !!map[key(t.getFullYear(), t.getMonth() + 1, t.getDate())];
        if (has(prev) && has(nextD)) map[key(y, m, d)] = '国民の休日';
      }
    }

    return map;
  }

  return {
    // 'YYYY-MM-DD' → 祝日名 / 祝日でなければ null
    name(iso) {
      const y = Number(iso.slice(0, 4));
      if (!cache[y]) cache[y] = build(y);
      return cache[y][iso] || null;
    },
  };
})();
