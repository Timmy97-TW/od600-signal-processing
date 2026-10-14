#!/usr/bin/env python3
"""Build index.html from src/index.src.html.

The source uses {{中文||English}} for every bilingual string; this expands each
into a pair of spans that the language toggle shows or hides, and inlines
data/site_data.json so the page is a single file.
"""
import pathlib
import re

root = pathlib.Path(__file__).parent
src = (root / "src" / "index.src.html").read_text(encoding="utf-8")
refs = (root / "src" / "references.html").read_text(encoding="utf-8")
data = (root / "data" / "site_data.json").read_text(encoding="utf-8")

src = src.replace("<!--REFS-->", refs)
src = src.replace("<!--ASSAY-->", (root / "src" / "assay.src.html").read_text(encoding="utf-8"))
src = src.replace("<!--RESULTS-->", (root / "src" / "results.src.html").read_text(encoding="utf-8"))
html = re.sub(r"\{\{(.*?)\|\|(.*?)\}\}",
              lambda m: f'<span class="zh">{m.group(1)}</span><span class="en">{m.group(2)}</span>',
              src, flags=re.S)
html = html.replace("/*SITE_DATA*/null", data)
html = html.replace("/*RES_DATA*/null", (root / "data" / "results_1010.json").read_text(encoding="utf-8"))
(root / "index.html").write_text(html, encoding="utf-8")
print("index.html", len(html) // 1024, "KB,", html.count('class="zh"'), "bilingual strings")
