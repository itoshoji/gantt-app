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
    3. つかいかた.txt を版番号を書き換えて一緒に置く

**GitHubへのpushはしない。** 本人が実際に触って感触を確かめてから、
`--push` を付けて走らせるか `git push` する（2026-07-29 本人の指示）。
本人は起動を全部Googleドライブから行うので、ここまでが「改良1回分」の1セット。
"""
import argparse
import datetime
import re
import subprocess
import sys
from pathlib import Path

import build_standalone

HERE = Path(__file__).parent

# Googleドライブの同期フォルダ。ここに置くと自動でクラウドへ上がる。
# テストしたいときは GANTT_DRIVE_DIR で差し替えられる。
DRIVE = (
    Path.home()
    / "Library/CloudStorage/GoogleDrive-dear.crown@gmail.com"
    / "マイドライブ/スケジュール管理アプリ"
)

USAGE_TEMPLATE = """スケジュール管理アプリ v{n}

【使い方】
1. 「スケジュール管理_v{n}.html」をパソコンにダウンロードする
2. ダウンロードしたファイルをダブルクリックする
3. パスワードを入力する（この端末では次回から聞かれません）

【メモ】
・必要なファイルはこの1つだけです。他のファイルは要りません。
・予定のデータはインターネット上（Supabase）に保存されます。
  このファイルは「入り口」なので、どの端末から開いても同じ予定が出ます。
・ファイルが古くなっても予定は消えません。新しい版に差し替えるだけでOKです。

【新しい版が出たら】
v{next}、v{next2}…と新しいフォルダが増えます。中の新しいHTMLを
ダウンロードし直してください。古い版は消して構いません。

作成日: {date}
"""


def git(*args: str, capture: bool = False) -> str:
    """gitを呼ぶ。失敗したらそこで止める。"""
    r = subprocess.run(
        ["git", *args], cwd=HERE, text=True,
        capture_output=capture, check=True,
    )
    return (r.stdout or "").strip() if capture else ""


def next_version(drive: Path) -> int:
    """ドライブにある vN のうち一番大きい番号の次を返す。"""
    used = [
        int(m.group(1))
        for p in drive.glob("v*")
        if p.is_dir() and (m := re.fullmatch(r"v(\d+)", p.name))
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

    drive = args.drive or DRIVE
    if not drive.is_dir():
        sys.exit(f"ドライブの同期フォルダが見つかりません: {drive}")

    n = args.version or next_version(drive)
    out_dir = drive / f"v{n}"
    if out_dir.exists():
        sys.exit(f"v{n} はもうあります。同じ版を上書きしない方針なので、番号を変えてください。")

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

    # 2. 1ファイル版を作って置く
    html = build_standalone.build()
    out_dir.mkdir()
    html_path = out_dir / f"スケジュール管理_v{n}.html"
    html_path.write_text(html, encoding="utf-8")
    print(f"{html_path} を作成しました（{len(html.encode('utf-8')):,} バイト）")

    # 3. つかいかた.txt
    (out_dir / "つかいかた.txt").write_text(
        USAGE_TEMPLATE.format(
            n=n, next=n + 1, next2=n + 2,
            date=datetime.date.today().strftime("%Y-%m-%d"),
        ),
        encoding="utf-8",
    )
    print(f"{out_dir / 'つかいかた.txt'} を作成しました")

    # 4. GitHubへ。既定ではやらない（本人が触って良ければ、が手順）
    if args.push and not args.no_git:
        git("push")
        print("GitHubへpushしました")

    print(f"\n完了。ドライブの v{n} フォルダから開いてください。")
    print("（同期に少し時間がかかることがあります）")
    if not args.push and not args.no_git:
        print("GitHubへのバックアップはまだです。良さそうなら git push してください。")


if __name__ == "__main__":
    main()
