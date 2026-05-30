#!/usr/bin/env python3
"""
gen_history_viewers.py
Reads markdown files from content/<program>/ and generates static HTML viewer pages
in public/documents/view/ using the dark cinematic template.

Markdown format supported:
  ---
  title: "..."
  week: N
  track: "History"
  program: "Corporal"
  sourceTitle: "..."
  sourceUrl: "..."
  supplementalSourceTitle: "..."   (optional)
  supplementalSourceUrl: "..."     (optional)
  ---

  # Week N - ...

  ## Section Heading
  Paragraph text...

  - bullet item
  - bullet item

  1. numbered item
  2. numbered item

  **bold phrase**
  [link text](url)
"""

import os
import re
import glob
import html as html_mod
from pathlib import Path

# ─── CSS / HTML TEMPLATE ──────────────────────────────────────────────────────

SHARED_CSS = """@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Crimson+Text:ital,wght@0,400;0,600;1,400&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  background: #0a0804;
  color: #e0cc98;
  font-family: 'Crimson Text', serif;
  font-size: 1.05rem;
  line-height: 1.75;
  padding: 40px 24px 80px;
}
.wrap { max-width: 820px; margin: 0 auto; }
.back {
  display: inline-flex; align-items: center; gap: 6px;
  font-family: 'Cinzel', serif; font-size: 0.78rem;
  color: #b8960c; text-decoration: none;
  border: 1px solid rgba(184,150,12,0.4);
  border-radius: 4px; padding: 6px 14px;
  margin-bottom: 32px; letter-spacing: 0.05em;
  transition: background 0.18s, color 0.18s;
}
.back:hover { background: rgba(184,150,12,0.12); color: #e8c040; }
.doc-header {
  border-bottom: 1px solid rgba(180,140,60,0.3);
  padding-bottom: 22px; margin-bottom: 36px;
}
.doc-kicker {
  font-family: 'Cinzel', serif; font-size: 0.68rem;
  letter-spacing: 0.16em; text-transform: uppercase;
  color: #6a5020; margin-bottom: 10px;
}
.doc-title {
  font-family: 'Cinzel', serif; font-size: 1.65rem;
  font-weight: 700; color: #e8c850; line-height: 1.25; margin-bottom: 4px;
}
.doc-sub {
  font-size: 0.88rem; color: #8a7040; font-style: italic;
}
h2.section-h {
  font-family: 'Cinzel', serif; font-size: 1.05rem; font-weight: 700;
  color: #c8a020; letter-spacing: 0.06em; margin: 36px 0 10px;
  padding-bottom: 6px; border-bottom: 1px solid rgba(200,160,32,0.2);
}
h3.section-sh {
  font-family: 'Cinzel', serif; font-size: 0.88rem; font-weight: 600;
  color: #b89040; letter-spacing: 0.05em; margin: 24px 0 8px;
}
p.body-p {
  color: #d0bc88; margin-bottom: 14px; line-height: 1.8;
}
ul.list-ul {
  margin: 0 0 14px 0; padding-left: 0; list-style: none;
  display: flex; flex-direction: column; gap: 6px;
}
ul.list-ul li {
  display: flex; gap: 10px; align-items: flex-start;
  color: #c8b880; line-height: 1.65; font-size: 1rem;
}
ul.list-ul li::before {
  content: '\\2726'; color: #c8a020; font-size: 0.62rem;
  flex-shrink: 0; margin-top: 7px;
}
ol.list-ol {
  margin: 0 0 14px 0; padding-left: 0; list-style: none;
  display: flex; flex-direction: column; gap: 6px;
  counter-reset: ol-counter;
}
ol.list-ol li {
  display: flex; gap: 10px; align-items: flex-start;
  color: #c8b880; line-height: 1.65; font-size: 1rem;
  counter-increment: ol-counter;
}
ol.list-ol li::before {
  content: counter(ol-counter) ".";
  color: #c8a020; font-family: 'Cinzel', serif; font-size: 0.78rem;
  flex-shrink: 0; margin-top: 4px; min-width: 20px;
}
a.inline-link {
  color: #c8a020; text-decoration: underline;
  text-underline-offset: 2px;
}
a.inline-link:hover { color: #e8c040; }
.source-block {
  margin-top: 48px; padding-top: 20px;
  border-top: 1px solid rgba(180,140,60,0.2);
}
.source-block h2.section-h { margin-top: 0; }
@media print {
  body { background:#fff; color:#111; padding:20px; }
  .back { display:none; }
  .doc-title { color:#111; }
  .doc-kicker, .doc-sub { color:#666; }
  h2.section-h { color:#333; border-color:#ccc; }
  h3.section-sh { color:#555; }
  p.body-p { color:#222; }
  ul.list-ul li, ol.list-ol li { color:#333; }
}"""

HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>{page_title}</title>
  <style>
{css}
</style>
</head>
<body>
<div class="wrap">
  <a class="back" href="/member">← Dashboard</a>
  <div class="doc-header">
    <div class="doc-kicker">&#10013; Knights Templar of the Kingdom of Christ &middot; Templar Forge Academy</div>
    <div class="doc-title">{display_title}</div>
    <div class="doc-sub">Templar Forge Academy — Weekly Formation Guide</div>
  </div>
{body}
</div>
</body>
</html>"""


# ─── MARKDOWN PARSER ─────────────────────────────────────────────────────────

def parse_frontmatter(text):
    """Extract YAML frontmatter dict and body text."""
    meta = {}
    body = text
    if text.startswith('---'):
        end = text.find('\n---', 3)
        if end != -1:
            fm_text = text[3:end].strip()
            body = text[end+4:].strip()
            for line in fm_text.splitlines():
                if ':' in line:
                    k, _, v = line.partition(':')
                    meta[k.strip()] = v.strip().strip('"\'')
    return meta, body


def inline_markup(text):
    """Convert inline markdown to HTML: **bold**, [text](url)."""
    # Links first
    text = re.sub(
        r'\[([^\]]+)\]\(([^)]+)\)',
        lambda m: f'<a class="inline-link" href="{m.group(2)}" target="_blank">{html_mod.escape(m.group(1))}</a>',
        text
    )
    # Bold: **text**
    text = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', text)
    # Em dash fix
    text = text.replace(' — ', ' — ')
    return text


def md_to_html_body(body_text):
    """
    Convert markdown body to HTML fragment.
    Handles: # h1 (ignored/title), ## h2 → section-h, ### h3 → section-sh,
    - bullet lists → ul.list-ul, 1. ordered → ol.list-ol,
    paragraphs → p.body-p, blank lines as separators.
    Source sections get wrapped in .source-block.
    """
    lines = body_text.splitlines()
    html_parts = []
    i = 0
    in_ul = False
    in_ol = False
    in_source_block = False

    def close_list():
        nonlocal in_ul, in_ol
        if in_ul:
            html_parts.append('</ul>')
            in_ul = False
        if in_ol:
            html_parts.append('</ol>')
            in_ol = False

    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        # Skip the H1 title line (already in doc-header)
        if stripped.startswith('# ') and not stripped.startswith('## '):
            i += 1
            continue

        # H2 section heading
        if stripped.startswith('## '):
            close_list()
            heading_text = stripped[3:].strip()
            escaped = html_mod.escape(heading_text)

            # Detect source sections — wrap in source-block div
            if heading_text.lower() in ('source', 'sources'):
                if not in_source_block:
                    html_parts.append('<div class="source-block">')
                    in_source_block = True
                html_parts.append(f'<h2 class="section-h">{escaped}</h2>')
            else:
                if in_source_block:
                    html_parts.append('</div>')
                    in_source_block = False
                html_parts.append(f'<h2 class="section-h">{escaped}</h2>')
            i += 1
            continue

        # H3 subheading
        if stripped.startswith('### '):
            close_list()
            heading_text = stripped[4:].strip()
            html_parts.append(f'<h3 class="section-sh">{html_mod.escape(heading_text)}</h3>')
            i += 1
            continue

        # Unordered list item
        if stripped.startswith('- ') or stripped.startswith('* '):
            if in_ol:
                close_list()
            if not in_ul:
                html_parts.append('<ul class="list-ul">')
                in_ul = True
            item_text = stripped[2:].strip()
            html_parts.append(f'<li>{inline_markup(html_mod.escape(item_text))}</li>')
            i += 1
            continue

        # Ordered list item: "1. text" or "N. text"
        ol_match = re.match(r'^\d+\.\s+(.+)$', stripped)
        if ol_match:
            if in_ul:
                close_list()
            if not in_ol:
                html_parts.append('<ol class="list-ol">')
                in_ol = True
            item_text = ol_match.group(1).strip()
            html_parts.append(f'<li>{inline_markup(html_mod.escape(item_text))}</li>')
            i += 1
            continue

        # Blank line — close any open list
        if stripped == '':
            close_list()
            i += 1
            continue

        # Regular paragraph line — collect multi-line paragraphs
        close_list()
        para_lines = []
        while i < len(lines) and lines[i].strip() != '' and not lines[i].strip().startswith('#') and not lines[i].strip().startswith('- ') and not lines[i].strip().startswith('* ') and not re.match(r'^\d+\.\s', lines[i].strip()):
            para_lines.append(lines[i].strip())
            i += 1
        para_text = ' '.join(para_lines)
        html_parts.append(f'<p class="body-p">{inline_markup(html_mod.escape(para_text))}</p>')
        continue

    close_list()
    if in_source_block:
        html_parts.append('</div>')

    return '\n'.join(html_parts)


# ─── FILE GENERATION ─────────────────────────────────────────────────────────

def generate_from_markdown(md_path, out_path):
    """Read a markdown file and write the HTML viewer page."""
    with open(md_path, encoding='utf-8') as f:
        text = f.read()

    meta, body = parse_frontmatter(text)

    title = meta.get('title', Path(md_path).stem)
    program = meta.get('program', 'Templar Forge Academy')
    week_num = meta.get('week', '')
    track = meta.get('track', '')

    # Display title: "Corporal Program — Week 1 History Required Reading"
    display_title = title.replace(' - ', ' — ')

    body_html = md_to_html_body(body)

    html = HTML_TEMPLATE.format(
        page_title=title,
        display_title=html_mod.escape(display_title),
        css=SHARED_CSS,
        body=body_html,
    )

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(html)

    return title


# ─── MAIN ────────────────────────────────────────────────────────────────────

def main():
    base_dir = Path(__file__).parent.parent  # webapp/
    content_root = base_dir / 'content'
    out_root = base_dir / 'public' / 'documents' / 'view'

    # Map: content/<program>/week-N-history-required-reading.md
    #   → public/documents/view/<program>-week-N-history.html
    md_files = sorted(content_root.glob('**/*.md'))
    if not md_files:
        print('No markdown files found under content/')
        return

    generated = []
    for md_path in md_files:
        # Determine program slug from parent directory name
        program_dir = md_path.parent.name  # e.g. "corporal"

        # Parse filename to get output name
        # week-1-history-required-reading.md → corporal-week-1-history.html
        stem = md_path.stem  # "week-1-history-required-reading"
        # Strip trailing "-required-reading" if present
        stem = re.sub(r'-required-reading$', '', stem)
        out_name = f'{program_dir}-{stem}.html'
        out_path = out_root / out_name

        title = generate_from_markdown(str(md_path), str(out_path))
        generated.append((str(md_path.relative_to(base_dir)), str(out_path.relative_to(base_dir)), title))
        print(f'  ✓ {out_path.relative_to(base_dir)}')

    print(f'\nGenerated {len(generated)} files.')


if __name__ == '__main__':
    main()
