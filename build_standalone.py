#!/usr/bin/env python3
"""CSS/JS を index.html に埋め込んで、1枚だけで動くHTMLを作る。

会社PCのようにURLで開けない環境向け。ファイルを1つ落として
ダブルクリックするだけで使えるようにするのが目的。

    python3 build_standalone.py [出力先]

Node.js もビルドツールも使わない（このMacに入っていないため）。
"""
import re
import sys
from pathlib import Path

HERE = Path(__file__).parent


def inline(text: str) -> str:
    """HTML内に <script> で埋め込んでも壊れないようにする。

    JSの中に </script> という並びがあると、そこでタグが閉じたと解釈されて
    しまうため、途中に \\ を挟んで無害化する（JSの意味は変わらない）。
    """
    return text.replace("</script", "<\\/script")


def build() -> str:
    html = (HERE / "index.html").read_text(encoding="utf-8")

    # <link rel="stylesheet" href="styles.css"> を中身に置き換える
    css = (HERE / "styles.css").read_text(encoding="utf-8")
    html = re.sub(
        r'<link rel="stylesheet" href="styles\.css">',
        "<style>\n" + css + "\n</style>",
        html,
    )

    # <script src="..."> を順番どおりに中身へ置き換える
    def replace_script(m: "re.Match[str]") -> str:
        name = m.group(1)
        js = (HERE / name).read_text(encoding="utf-8")
        return f"<script>\n/* ===== {name} ===== */\n{inline(js)}\n</script>"

    html, n = re.subn(r'<script src="([^"]+)"></script>', replace_script, html)
    if n == 0:
        raise SystemExit("スクリプトタグが見つかりませんでした。index.html の書き方を確認してください")

    if "src=" in html or 'href="styles' in html:
        raise SystemExit("埋め込めていないファイルが残っています")

    return html


if __name__ == "__main__":
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "standalone.html"
    result = build()
    out.write_text(result, encoding="utf-8")
    print(f"{out} を作成しました（{len(result.encode('utf-8')):,} バイト）")
