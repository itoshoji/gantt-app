/*
 * Supabase の接続情報。
 *
 * publishable key は「フロントに置く前提」のキーなので、リポジトリに書いても
 * デプロイ後にブラウザから見えても、キーとしては想定通りの使い方。
 *
 * ただし現状はDB側(RLS)が「全員読み書き可」なので、**このURLとキーを知った人は
 * 予定を読み書きできる**。本人の判断でこの形にしている（手軽さ優先）。
 * 気が変わったらログインを入れる。
 *
 * service_role / secret キーは絶対にここへ書かないこと。
 */
const SUPABASE_URL = 'https://gnokupdporpcvbivvibh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ai4b7Z97fEVYvltDZrIyYQ_Nx71xIFw';
