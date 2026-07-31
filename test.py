#!/usr/bin/env python3
"""テストをまとめて走らせる。

    python3 test.py

このMacには Node.js が入っていないので、macOS標準の JavaScriptCore を使う。
テストは tests/ の中の .js ファイル。app.js から実物のコードを切り出して動かすので、
テストと実装がズレない（テスト側にコードを写して置いておく形にしないこと）。

改良したあと、ドライブに版を出す前にこれを通す。
"""

import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
JSC = Path(
    "/System/Library/Frameworks/JavaScriptCore.framework"
    "/Versions/A/Helpers/jsc"
)

# 走らせる順と、画面に出す名前。
# 構文チェックが落ちたら、あとは見るまでもないので先頭に置く。
# ⚠ ファイル名は英数字にすること。jsc は日本語のファイル名を開けない
ORDER = {
    "syntax.js": "構文チェック",
    "detail-view.js": "詳細ビュー",
    "colors.js": "色",
    "drag.js": "中タスクのドラッグ",
}


def main() -> int:
    if not JSC.exists():
        print(f"JavaScriptCore が見つかりません: {JSC}")
        return 1

    files = [HERE / "tests" / name for name in ORDER]
    # ORDER に書き漏らしたものも拾う（テストを足したのに走らない、を防ぐ）
    for path in sorted((HERE / "tests").glob("*.js")):
        if path not in files:
            files.append(path)

    failed = []
    for path in files:
        label = ORDER.get(path.name, path.stem)
        if not path.exists():
            print(f"✗ {label} … ファイルがありません")
            failed.append(path.name)
            continue

        # テストの中の readFile('app.js') が効くよう、リポジトリの直下で走らせる
        run = subprocess.run(
            [str(JSC), f"tests/{path.name}"],
            cwd=HERE,
            capture_output=True,
            text=True,
        )
        out = (run.stdout + run.stderr).strip()
        ok = run.returncode == 0 and "NG" not in out and "失敗" not in out

        print(f"{'✓' if ok else '✗'} {label}")
        for line in out.splitlines():
            print(f"    {line}")
        if not ok:
            failed.append(path.name)

    print()
    if failed:
        print("通らなかったもの: " + ", ".join(failed))
        return 1
    print("全部通りました。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
