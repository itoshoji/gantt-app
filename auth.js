/*
 * ログインまわり。Supabase Auth の REST を直接叩く（ライブラリなしで完結させる）。
 *
 * 画面で聞くのはパスワードだけ。メールアドレスは config.js の APP_LOGIN_EMAIL で固定する。
 *
 * 持っておくもの:
 *   - アクセストークン（短命。だいたい1時間）
 *   - 更新用トークン（長命）
 * どちらも localStorage に置くので、**一度ログインすればその端末では入りっぱなし**になる。
 * アクセストークンは期限の1分前に自動で取り直すため、利用者が再入力することはない。
 */
const Auth = (() => {
  const ENDPOINT = `${SUPABASE_URL}/auth/v1`;
  const KEY = 'gantt-app:session';
  const MARGIN_MS = 60 * 1000;

  let session = load();
  let refreshing = null;      // 同時に何本も更新を投げないための門番

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function save(s) {
    session = s;
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  }

  // Supabaseの返事を、期限を絶対時刻に直して保存できる形にする
  function shape(data) {
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + (data.expires_in || 3600) * 1000,
    };
  }

  async function call(path, body) {
    const res = await fetch(ENDPOINT + path, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error_description || data.msg || data.message || `HTTP ${res.status}`);
    }
    return data;
  }

  async function refresh() {
    if (!session || !session.refresh_token) { save(null); return null; }
    if (refreshing) return refreshing;         // すでに更新中なら相乗りする

    refreshing = (async () => {
      try {
        const data = await call('/token?grant_type=refresh_token',
          { refresh_token: session.refresh_token });
        save(shape(data));
        return session;
      } catch (e) {
        // 更新用トークンまで失効している＝もう復帰できないのでログアウト扱い
        console.warn('ログインの期限が切れました', e);
        save(null);
        return null;
      } finally {
        refreshing = null;
      }
    })();
    return refreshing;
  }

  return {
    isLoggedIn: () => !!session,

    // パスワードだけ受け取る。メールアドレスは固定
    async signIn(password) {
      const data = await call('/token?grant_type=password',
        { email: APP_LOGIN_EMAIL, password });
      save(shape(data));
      return session;
    },

    // 有効なアクセストークンを返す。期限が近ければ取り直す。未ログインなら null
    async token() {
      if (!session) return null;
      if (Date.now() >= session.expires_at - MARGIN_MS) await refresh();
      return session ? session.access_token : null;
    },

    signOut() {
      const t = session && session.access_token;
      save(null);
      // サーバー側の失効は待たなくてよい（手元のトークンを捨てれば使えなくなる）
      if (t) {
        fetch(`${ENDPOINT}/logout`, {
          method: 'POST',
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${t}` },
        }).catch(() => {});
      }
    },
  };
})();
