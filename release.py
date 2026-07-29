#!/usr/bin/env python3
"""節目ごとに「版」を出す。

    python3 release.py                  # 版番号は自動（今ある最大 + 1）
    python3 release.py 3                # 版番号を指定する
    python3 release.py -m "色を直した"   # コミットメッセージを付ける
    python3 release.py --push           # GitHubへのバックアップまでやる
    python3 release.py --no-git         # gitは触らず、ファイルだけ作る

やること:

    1. 未コミットの変更があればコミットする（＝PCに保存）
    2. 1ファイル版をビルドして、Googleドライブの同期フォルダ vN/ に置く

置くのは **同期フォルダの直下にHTML 1つだけ**。以前は vN フォルダを作り
つかいかた.txt も添えていたが、どちらも不要なのでやめた（2026-07-29）。
版はファイル名の番号で見分ける。

**GitHubへのpushはしない。** 本人が実際に触って感触を確かめてから、
`--push` を付けて走らせるか `git push` する（2026-07-29 本人の指示）。
本人は起動を全部Googleドライブから行うので、ここまでが「改良1回分」の1セット。
"""
import argparse
import re
import subprocess
import sys
from pathlib import Path

import build_standalone

HERE = Path(__file__).parent

# Googleドライブの同期フォルダ。ここに置くと自動でクラウドへ上がる。
# フォルダ名にGoogleアカウントのメールアドレスが入るが、このリポジトリはPublicなので
# 直書きせずに探す。動作確認したいときは --drive で差し替えられる。
DRIVE_SUBPATH = "マイドライブ/スケジュール管理アプリ"


def find_drive() -> "Path | None":
    """Googleドライブの同期フォルダを探す。見つからなければ None。"""
    base = Path.home() / "Library/CloudStorage"
    for account in sorted(base.glob("GoogleDrive-*")):
        d = account / DRIVE_SUBPATH
        if d.is_dir():
            return d
    return None

def git(*args: str, capture: bool = False) -> str:
    """gitを呼ぶ。失敗したらそこで止める。"""
    r = subprocess.run(
        ["git", *args], cwd=HERE, text=True,
        capture_output=capture, check=True,
    )
    return (r.stdout or "").strip() if capture else ""


NAME = "スケジュール管理_v{n}.html"


def next_version(drive: Path) -> int:
    """ドライブにあるHTMLのうち一番大きい版番号の次を返す。"""
    used = [
        int(m.group(1))
        for p in drive.glob("スケジュール管理_v*.html")
        if (m := re.fullmatch(r"スケジュール管理_v(\d+)\.html", p.name))
    ]
    return max(used, default=0) + 1


def main() -> None:
    ap = argparse.ArgumentParser(description="1ファイル版をドライブに出して、GitHubへpushする")
    ap.add_argument("version", nargs="?", type=int, help="版番号（省略すると自動）")
    ap.add_argument("-m", "--message", default="", help="コミットメッセージ")
    ap.add_argument("--push", action="store_true", help="GitHubへpushもする（感触を確かめてから）")
    ap.add_argument("--no-git", action="store_true", help="gitを触らない")
    ap.add_argument("--drive", type=Path, default=None, help="出力先の親フォルダ（動作確認用）")
    args = ap.parse_args()

    drive = args.drive or find_drive()
    if drive is None:
        sys.exit(
            "Googleドライブの同期フォルダが見つかりません。\n"
            f"~/Library/CloudStorage/GoogleDrive-<アカウント>/{DRIVE_SUBPATH} を確認してください。"
        )
    if not drive.is_dir():
        sys.exit(f"フォルダがありません: {drive}")

    n = args.version or next_version(drive)
    html_path = drive / NAME.format(n=n)
    if html_path.exists():
        sys.exit(f"{html_path.name} はもうあります。同じ版を上書きしない方針なので、番号を変えてください。")

    # 1. 先にコミットする。こうすると、置いたHTMLと GitHub の中身が必ず一致する。
    if not args.no_git:
        dirty = git("status", "--porcelain", capture=True)
        if dirty:
            msg = args.message or f"v{n} を出す"
            git("add", "-A")
            git("commit", "-m", f"{msg}")
            print(f"コミットしました: {msg}")
        else:
            print("未コミットの変更はありません")

    # 2. 1ファイル版を作って置く（フォルダは作らず、同期フォルダに直接置く）
    html = build_standalone.build()
    html_path.write_text(html, encoding="utf-8")
    print(f"{html_path} を作成しました（{len(html.encode('utf-8')):,} バイト）")

    # 3. GitHubへ。既定ではやらない（本人が触って良ければ、が手順）
    if args.push and not args.no_git:
        git("push")
        print("GitHubへpushしました")

    print(f"\n完了。ドライブの {html_path.name} を開いてください。")
    print("（同期に少し時間がかかることがあります）")
    if not args.push and not args.no_git:
        print("GitHubへのバックアップはまだです。良さそうなら git push してください。")


if __name__ == "__main__":
    main()
