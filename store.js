/*
 * データ層。今はブラウザの localStorage に保存している。
 * 将来 Supabase に差し替えるときは、この Store の中身だけを書き換えれば
 * app.js 側は基本そのまま動く想定。
 *
 * groups の配列の順序が、そのまま画面の表示順になる。
 */
const Store = (() => {
  const KEY = 'gantt-app:v1';

  const empty = () => ({ groups: [], tasks: [], subtasks: [] });

  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return empty();
      const parsed = JSON.parse(raw);
      return {
        // scope 導入前に作られた項目は仕事扱いにする
        groups: (parsed.groups || []).map(g => ({
          ...g, hidden: !!g.hidden, scope: g.scope === 'private' ? 'private' : 'work',
        })),
        tasks: parsed.tasks || [],
        subtasks: parsed.subtasks || [],
      };
    } catch (e) {
      console.warn('保存データを読めなかったため初期化します', e);
      return empty();
    }
  }

  function save() {
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

  return {
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
      save();
      return g;
    },
    setGroupScope(id, scope) {
      const g = state.groups.find(x => x.id === id);
      if (g) { g.scope = scope; save(); }
    },
    renameGroup(id, name) {
      const g = state.groups.find(x => x.id === id);
      if (g) { g.name = name; save(); }
    },
    setGroupHidden(id, hidden) {
      const g = state.groups.find(x => x.id === id);
      if (g) { g.hidden = hidden; save(); }
    },
    // 並べ替え（表示順＝配列順）。画面は絞り込み表示されることがあるので、
    // 位置ではなく「どの項目の直前に置くか」で指定する（beforeId が null なら末尾）
    moveGroupBefore(id, beforeId) {
      if (id === beforeId) return;
      const from = state.groups.findIndex(g => g.id === id);
      if (from < 0) return;
      const [g] = state.groups.splice(from, 1);
      const at = beforeId ? state.groups.findIndex(x => x.id === beforeId) : -1;
      if (at < 0) state.groups.push(g);
      else state.groups.splice(at, 0, g);
      save();
    },
    deleteGroup(id) {
      const taskIds = state.tasks.filter(t => t.groupId === id).map(t => t.id);
      state.subtasks = state.subtasks.filter(s => !taskIds.includes(s.taskId));
      state.tasks = state.tasks.filter(t => t.groupId !== id);
      state.groups = state.groups.filter(g => g.id !== id);
      save();
    },

    // --- 中タスク（月単位）---
    addTask({ groupId, fy, startMonth, endMonth, name = '' }) {
      const t = { id: uid(), groupId, fy, startMonth, endMonth, name };
      state.tasks.push(t);
      save();
      return t;
    },
    updateTask(id, patch) {
      const t = state.tasks.find(x => x.id === id);
      if (t) { Object.assign(t, patch); save(); }
    },
    deleteTask(id) {
      state.subtasks = state.subtasks.filter(s => s.taskId !== id);
      state.tasks = state.tasks.filter(t => t.id !== id);
      save();
    },

    // --- 小タスク（日単位）---
    addSubtask({ taskId, name = '', startDate = null, endDate = null }) {
      const s = { id: uid(), taskId, name, startDate, endDate };
      state.subtasks.push(s);
      save();
      return s;
    },
    updateSubtask(id, patch) {
      const s = state.subtasks.find(x => x.id === id);
      if (s) { Object.assign(s, patch); save(); }
    },
    deleteSubtask(id) {
      state.subtasks = state.subtasks.filter(s => s.id !== id);
      save();
    },
  };
})();
