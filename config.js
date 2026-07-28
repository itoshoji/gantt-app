/*
 * Supabase の接続情報。
 *
 * publishable key は「フロントに置く前提」のキーなので、リポジトリに書いても
 * デプロイ後にブラウザから見えても想定どおりの使い方。
 * **守っているのはこのキーの秘匿ではなく、DB側の RLS（ログインした人だけ読み書き可）。**
 * したがって RLS を「全員可」に戻すと即座に穴が開く。
 *
 * service_role / secret キーは絶対にここへ書かないこと。
 */
const SUPABASE_URL = 'https://gnokupdporpcvbivvibh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ai4b7Z97fEVYvltDZrIyYQ_Nx71xIFw';

/*
 * 利用者は本人ひとりなので、メールアドレスはアプリ側で固定し、
 * 画面ではパスワードだけを聞く（入力の手間を最小にするため）。
 * このアドレスは識別子であって秘密ではない。実在しない example.com を使う
 * （IANAが説明用に予約している領域なので、誰かの本物の受信箱になることがない）。
 * 秘密はパスワードのほうだけ。
 */
const APP_LOGIN_EMAIL = 'owner@example.com';
