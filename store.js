/*
 * データ層。保存先は Supabase。
 *
 * 設計の考え方:
 *   - 起動時に全件まとめて読み込み、メモリ上の state に載せる。
 *   - 参照系（groups() など）は今まで通り「同期」で返す。よって app.js は
 *     ほぼ書き換え不要で、画面の反応も待ち時間ゼロ。
 *   - 更新系は先にメモリを書き換えて即座に画面へ反映し、通信は裏で流す（楽観更新）。
 *     通信が失敗したときは Store.onError で通知する。
 *
 * DB側はスネークケース（group_id など）、アプリ側はキャメルケース（groupId など）。
 * その変換はこのファイルの中だけで完結させる。
 *
 * 注意: start_month / end_month は TEXT カラムなので、読み込み時に必ず数値へ戻すこと。
 *       app.js は月を 0〜11 の数値として大小比較している。
 */
const Store = (() => {
  const REST = `${SUPABASE_URL}/rest/v1`;

  const LEGACY_KEY = 'gantt-app:v1';              // localStorage時代の保存先
  const MIGRATED_KEY = 'gantt-app:migrated-to-supabase';

  let state = { groups: [], tasks: [], subtasks: [] };

  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

  // ---------- 通信 ----------
  function headers(extra) {
    return Object.assign({
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    }, extra);
  }

  async function req(method, path, body, extra) {
    const res = await fetch(REST + path, {
      method,
      headers: headers(extra),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`${method} ${path} → ${res.status} ${await res.text()}`);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  // 書き込みは順番を守って直列に流す。
  // （並列にすると「作成」より先に「更新」が届いてしまうことがあるため）
  let chain = Promise.resolve();
  let onError = null;

  function push(fn) {
    chain = chain.then(fn).catch(err => {
      console.error('Supabaseへの保存に失敗しました', err);
      if (onError) onError(err);
    });
    return chain;
  }

  const insert = (table, row) => push(() =>
    req('POST', `/${table}`, row, { Prefer: 'return=minimal' }));
  const patch = (table, id, row) => push(() =>
    req('PATCH', `/${table}?id=eq.${encodeURIComponent(id)}`, row, { Prefer: 'return=minimal' }));
  const remove = (table, id) => push(() =>
    req('DELETE', `/${table}?id=eq.${encodeURIComponent(id)}`, undefined, { Prefer: 'return=minimal' }));

  // ---------- DB行 ⇄ アプリ内オブジェクト ----------
  const toGroup = r => ({
    id: r.id,
    name: r.name,
    tag: r.tag,
    color: r.color,
    scope: r.scope === 'private' ? 'private' : 'work',
    hidden: !!r.hidden,
  });
  const toTask = r => ({
    id: r.id,
    groupId: r.group_id,
    fy: Number(r.fy),
    startMonth: Number(r.start_month),
    endMonth: Number(r.end_month),
    name: r.name || '',
    color: r.color || null,      // null なら親の項目の色を使う
  });
  const toSubtask = r => ({
    id: r.id,
    taskId: r.task_id,
    name: r.name || '',
    startDate: r.start_date,
    endDate: r.end_date,
  });

  const groupRow = (g, order) => ({
    id: g.id, name: g.name, tag: g.tag, color: g.color,
    scope: g.scope, hidden: g.hidden, sort_order: order,
  });
  const taskRow = (t, order) => ({
    id: t.id, group_id: t.groupId, fy: t.fy,
    start_month: t.startMonth, end_month: t.endMonth, name: t.name,
    color: t.color || null, sort_order: order,
  });
  const subtaskRow = (s, order) => ({
    id: s.id, task_id: s.taskId, name: s.name,
    start_date: s.startDate, end_date: s.endDate, sort_order: order,
  });

  // 部分更新（patch）のキー名をDBのカラム名に読み替える
  const TASK_COLS = {
    groupId: 'group_id', fy: 'fy', startMonth: 'start_month',
    endMonth: 'end_month', name: 'name', color: 'color',
  };
  const SUBTASK_COLS = {
    taskId: 'task_id', name: 'name', startDate: 'start_date', endDate: 'end_date',
  };
  function toRow(patchObj, cols) {
    const row = {};
    for (const [k, v] of Object.entries(patchObj)) {
      if (cols[k]) row[cols[k]] = v;
    }
    return row;
  }

  // ---------- 起動 ----------
  async function init() {
    const [g, t, s] = await Promise.all([
      req('GET', '/groups?select=*&order=sort_order.asc'),
      req('GET', '/tasks?select=*&order=sort_order.asc'),
      req('GET', '/subtasks?select=*&order=sort_order.asc'),
    ]);
    state.groups = (g || []).map(toGroup);
    state.tasks = (t || []).map(toTask);
    state.subtasks = (s || []).map(toSubtask);
    await migrateLegacy();
  }

  // localStorage時代のデータを一度だけ引っ越す。
  // Supabase側に既に何か入っている場合は二重登録を避けて何もしない。
  async function migrateLegacy() {
    if (localStorage.getItem(MIGRATED_KEY)) return;

    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) { localStorage.setItem(MIGRATED_KEY, 'no-data'); return; }
    if (state.groups.length || state.tasks.length || state.subtasks.length) {
      localStorage.setItem(MIGRATED_KEY, 'skipped-remote-not-empty');
      return;
    }

    let old;
    try { old = JSON.parse(raw); } catch (e) {
      console.warn('引っ越し元データを読めませんでした', e);
      localStorage.setItem(MIGRATED_KEY, 'unreadable');
      return;
    }

    const groups = (old.groups || []).map(g => ({
      ...g, hidden: !!g.hidden, scope: g.scope === 'private' ? 'private' : 'work',
    }));
    const groupIds = new Set(groups.map(g => g.id));
    // 親を失っている行を送るとFK違反で引っ越し全体が止まるので、先に落とす
    const tasks = (old.tasks || []).filter(t => groupIds.has(t.groupId));
    const taskIds = new Set(tasks.map(t => t.id));
    const subtasks = (old.subtasks || []).filter(s => taskIds.has(s.taskId));

    if (!groups.length) { localStorage.setItem(MIGRATED_KEY, 'empty'); return; }

    // 親→子の順に入れる（外部キーの制約があるため）
    await req('POST', '/groups', groups.map(groupRow), { Prefer: 'return=minimal' });
    if (tasks.length) {
      await req('POST', '/tasks', tasks.map(taskRow), { Prefer: 'return=minimal' });
    }
    if (subtasks.length) {
      await req('POST', '/subtasks', subtasks.map(subtaskRow), { Prefer: 'return=minimal' });
    }

    state.groups = groups.map(g => toGroup(groupRow(g, 0)));
    state.tasks = tasks.map(t => toTask(taskRow(t, 0)));
    state.subtasks = subtasks.map(s => toSubtask(subtaskRow(s, 0)));
    localStorage.setItem(MIGRATED_KEY, new Date().toISOString());
    console.info(`localStorage から ${groups.length} 項目を Supabase に引っ越しました`);
  }

  // 並べ替え後、位置が変わった項目だけ sort_order を送り直す
  function syncGroupOrder(prevIds) {
    state.groups.forEach((g, i) => {
      if (prevIds[i] !== g.id) patch('groups', g.id, { sort_order: i });
    });
  }

  // ---------- 元に戻す用（状態まるごとの保存・復元）----------
  // 件数がたかだか数百なので、丸ごと控えて差分を出すほうが
  // 操作ごとに逆操作を書くより単純で、取りこぼしがない。
  const clone = o => JSON.parse(JSON.stringify(o));

  // before → after の差分を求める。sort_order も含めて比較したいので行に変換して比べる
  function diff(before, after, toRow) {
    const beforeById = new Map(before.map((x, i) => [x.id, toRow(x, i)]));
    const afterIds = new Set(after.map(x => x.id));
    const inserts = [], updates = [], deletes = [];
    after.forEach((x, i) => {
      const row = toRow(x, i);
      const prev = beforeById.get(x.id);
      if (!prev) inserts.push(row);
      else if (JSON.stringify(prev) !== JSON.stringify(row)) updates.push(row);
    });
    for (const x of before) if (!afterIds.has(x.id)) deletes.push(x.id);
    return { inserts, updates, deletes };
  }

  function applyDiff(table, d) {
    for (const row of d.inserts) insert(table, row);
    for (const row of d.updates) {
      const { id, ...rest } = row;
      patch(table, id, rest);
    }
    for (const id of d.deletes) remove(table, id);
  }

  return {
    init,
    set onError(fn) { onError = fn; },
    get onError() { return onError; },

    // --- 元に戻す用 ---
    snapshot: () => clone(state),
    // 控えておいた状態に戻し、その差分だけをSupabaseへ送る。
    // 外部キーの都合で「作成は親→子」「削除は子→親」の順に流す必要がある
    restore(snap) {
      const dg = diff(state.groups, snap.groups, groupRow);
      const dt = diff(state.tasks, snap.tasks, taskRow);
      const ds = diff(state.subtasks, snap.subtasks, subtaskRow);

      applyDiff('groups', { inserts: dg.inserts, updates: dg.updates, deletes: [] });
      applyDiff('tasks', { inserts: dt.inserts, updates: dt.updates, deletes: [] });
      applyDiff('subtasks', { inserts: ds.inserts, updates: ds.updates, deletes: [] });
      applyDiff('subtasks', { inserts: [], updates: [], deletes: ds.deletes });
      applyDiff('tasks', { inserts: [], updates: [], deletes: dt.deletes });
      applyDiff('groups', { inserts: [], updates: [], deletes: dg.deletes });

      state = clone(snap);
    },

    // --- 参照 ---
    groups: () => state.groups,
    groupsIn: scope => state.groups.filter(g => g.scope === scope),
    tasksOf: (groupId, fy) =>
      state.tasks.filter(t => t.groupId === groupId && t.fy === fy),
    task: id => state.tasks.find(t => t.id === id),
    group: id => state.groups.find(g => g.id === id),
    subtasksOf: taskId => state.subtasks.filter(s => s.taskId === taskId),
    subtask: id => state.subtasks.find(s => s.id === id),
    allSubtasks: () => state.subtasks,

    // --- 項目 ---
    addGroup({ name, tag, color, scope = 'work' }) {
      const g = { id: uid(), name, tag, color, scope, hidden: false };
      state.groups.push(g);
      insert('groups', groupRow(g, state.groups.length - 1));
      return g;
    },
    setGroupScope(id, scope) {
      const g = state.groups.find(x => x.id === id);
      if (g) { g.scope = scope; patch('groups', id, { scope }); }
    },
    renameGroup(id, name) {
      const g = state.groups.find(x => x.id === id);
      if (g) { g.name = name; patch('groups', id, { name }); }
    },
    setGroupColor(id, color) {
      const g = state.groups.find(x => x.id === id);
      if (g) { g.color = color; patch('groups', id, { color }); }
    },
    setGroupHidden(id, hidden) {
      const g = state.groups.find(x => x.id === id);
      if (g) { g.hidden = hidden; patch('groups', id, { hidden }); }
    },
    // 並べ替え（表示順＝配列順）。画面は絞り込み表示されることがあるので、
    // 位置ではなく「どの項目の直前に置くか」で指定する（beforeId が null なら末尾）
    moveGroupBefore(id, beforeId) {
      if (id === beforeId) return;
      const from = state.groups.findIndex(g => g.id === id);
      if (from < 0) return;
      const prevIds = state.groups.map(g => g.id);
      const [g] = state.groups.splice(from, 1);
      const at = beforeId ? state.groups.findIndex(x => x.id === beforeId) : -1;
      if (at < 0) state.groups.push(g);
      else state.groups.splice(at, 0, g);
      syncGroupOrder(prevIds);
    },
    deleteGroup(id) {
      const taskIds = state.tasks.filter(t => t.groupId === id).map(t => t.id);
      state.subtasks = state.subtasks.filter(s => !taskIds.includes(s.taskId));
      state.tasks = state.tasks.filter(t => t.groupId !== id);
      state.groups = state.groups.filter(g => g.id !== id);
      // 子（中タスク・小タスク）はDB側の ON DELETE CASCADE で一緒に消える
      remove('groups', id);
    },

    // --- 中タスク（月単位）---
    addTask({ groupId, fy, startMonth, endMonth, name = '', color = null }) {
      const t = { id: uid(), groupId, fy, startMonth, endMonth, name, color };
      state.tasks.push(t);
      insert('tasks', taskRow(t, state.tasks.length - 1));
      return t;
    },
    updateTask(id, patchObj) {
      const t = state.tasks.find(x => x.id === id);
      if (!t) return;
      Object.assign(t, patchObj);
      const row = toRow(patchObj, TASK_COLS);
      if (Object.keys(row).length) patch('tasks', id, row);
    },
    deleteTask(id) {
      state.subtasks = state.subtasks.filter(s => s.taskId !== id);
      state.tasks = state.tasks.filter(t => t.id !== id);
      remove('tasks', id);
    },

    // --- 小タスク（日単位）---
    addSubtask({ taskId, name = '', startDate = null, endDate = null }) {
      const s = { id: uid(), taskId, name, startDate, endDate };
      state.subtasks.push(s);
      insert('subtasks', subtaskRow(s, state.subtasks.length - 1));
      return s;
    },
    updateSubtask(id, patchObj) {
      const s = state.subtasks.find(x => x.id === id);
      if (!s) return;
      Object.assign(s, patchObj);
      const row = toRow(patchObj, SUBTASK_COLS);
      if (Object.keys(row).length) patch('subtasks', id, row);
    },
    deleteSubtask(id) {
      state.subtasks = state.subtasks.filter(s => s.id !== id);
      remove('subtasks', id);
    },
  };
})();
