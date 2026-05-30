#!/usr/bin/env python3
"""
Generate static HTML viewer pages from Markdown content files.
Uses the same dark cinematic CSS template as gen_html_viewers.py.
Handles YAML front matter, headings, bullets, numbered lists, bold, italic,
inline links, pipe tables, and the ## Reference Images section.
"""

import os, re, html as htmllib

# ── Shared CSS (identical to gen_html_viewers.py) ──────────────────────────
SHARED_CSS = """
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Crimson+Text:ital,wght@0,400;0,600;1,400&display=swap');
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
/* ── Pipe table ── */
.md-table {
  width: 100%; border-collapse: collapse;
  margin: 16px 0 24px; font-size: 0.97rem;
}
.md-table th, .md-table td {
  padding: 8px 14px; text-align: left;
  border: 1px solid rgba(180,140,60,0.25);
  color: #c8b880; line-height: 1.6;
}
.md-table th {
  background: rgba(180,140,60,0.10);
  font-family: 'Cinzel', serif; font-size: 0.78rem;
  letter-spacing: 0.07em; color: #c8a020; font-weight: 600;
}
.md-table tr:nth-child(even) td {
  background: rgba(255,255,255,0.02);
}
/* ── Reference Images ── */
.ref-images {
  display: flex; flex-wrap: wrap; gap: 24px;
  margin: 16px 0 32px;
}
.ref-images figure {
  flex: 1 1 220px; max-width: 280px;
  display: flex; flex-direction: column; align-items: center; gap: 8px;
}
.ref-images figure img {
  width: 100%; border-radius: 4px;
  border: 1px solid rgba(180,140,60,0.3);
  object-fit: cover; max-height: 200px;
}
.ref-images figure figcaption {
  font-size: 0.78rem; color: #8a7040; font-style: italic;
  text-align: center; line-height: 1.4;
}
@media (max-width: 540px) {
  .ref-images figure { max-width: 100%; }
}
@media print {
  body { background:#fff; color:#111; padding:20px; }
  .doc-title { color:#111; }
  .doc-kicker, .doc-sub { color:#666; }
  h2.section-h { color:#333; border-color:#ccc; }
  h3.section-sh { color:#555; }
  p.body-p { color:#222; }
  ul.list-ul li, ol.list-ol li { color:#333; }
  .md-table th, .md-table td { color:#333; border-color:#ccc; }
  .md-table th { background:#eee; }
  .ref-images figure img { border-color:#ccc; }
  .ref-images figure figcaption { color:#555; }
}
"""

HTML_TEMPLATE = """\
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>{title}</title>
  <style>{css}</style>
</head>
<body>
<div class="wrap">
  <div class="doc-header">
    <div class="doc-kicker">&#10013; Knights Templar of the Kingdom of Christ &middot; Templar Forge Academy</div>
    <div class="doc-title">{heading}</div>
    <div class="doc-sub">{subtitle}</div>
  </div>
  {body}
</div>
</body>
</html>
"""

# ── Inline renderer ─────────────────────────────────────────────────────────

def render_inline(text):
    """Convert inline Markdown (bold, italic, links) to HTML. Input is raw text."""
    # 1. Links: [text](url)  — process before escaping so URLs aren't mangled
    LINK_PH = '\x00LINK{}\x00'
    links = []
    def link_sub(m):
        link_text = m.group(1)
        url = m.group(2)
        idx = len(links)
        links.append((link_text, url))
        return LINK_PH.format(idx)
    text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', link_sub, text)

    # 2. Escape HTML
    text = htmllib.escape(text)

    # 3. Restore links as <a> tags
    for i, (link_text, url) in enumerate(links):
        ph = htmllib.escape(LINK_PH.format(i))
        anchor = f'<a class="inline-link" href="{htmllib.escape(url)}" target="_blank">{htmllib.escape(link_text)}</a>'
        text = text.replace(ph, anchor)

    # 4. Bold: **text**  (after escaping so ** isn't mangled)
    text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)

    # 5. Italic: *text* — single asterisk, not part of **bold**
    #    Use negative lookbehind/lookahead to avoid double-asterisk runs
    text = re.sub(r'(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)', r'<em>\1</em>', text)

    return text


# ── Front-matter parser ─────────────────────────────────────────────────────

def parse_front_matter(content):
    """Extract YAML front matter dict and remaining body text."""
    meta = {}
    body = content
    if content.startswith('---'):
        end = content.find('\n---', 3)
        if end != -1:
            fm_text = content[3:end].strip()
            body = content[end+4:].lstrip('\n')
            for line in fm_text.splitlines():
                if ':' in line:
                    k, _, v = line.partition(':')
                    meta[k.strip()] = v.strip().strip('"\'')
    return meta, body


# ── Pipe table renderer ─────────────────────────────────────────────────────

def is_table_line(ln):
    """Return True if this line looks like a pipe-table row."""
    stripped = ln.strip()
    return stripped.startswith('|') and stripped.endswith('|')

def is_separator_line(ln):
    """Return True if this is a pipe-table separator line (|---|---|)."""
    stripped = ln.strip()
    return is_table_line(ln) and re.match(r'^[|\s\-:]+$', stripped)

def parse_table_cells(ln):
    """Split a pipe-table row into cell strings."""
    stripped = ln.strip()
    # Remove leading/trailing pipes then split
    inner = stripped[1:-1]
    return [c.strip() for c in inner.split('|')]

def render_table(lines):
    """Convert a list of pipe-table lines into an HTML table string."""
    rows = []
    is_header_row = True
    for ln in lines:
        if is_separator_line(ln):
            continue  # skip separator
        cells = parse_table_cells(ln)
        rows.append((is_header_row, cells))
        is_header_row = False  # first non-separator row is header

    html_parts = ['<table class="md-table">']
    for is_header, cells in rows:
        tag = 'th' if is_header else 'td'
        html_parts.append('<tr>')
        for cell in cells:
            html_parts.append(f'<{tag}>{render_inline(cell)}</{tag}>')
        html_parts.append('</tr>')
    html_parts.append('</table>')
    return '\n'.join(html_parts)


# ── Reference Images renderer ───────────────────────────────────────────────

def render_ref_images(bullet_lines):
    """
    Convert a list of '- [caption](url)' lines into a .ref-images figure block.
    """
    parts = ['<div class="ref-images">']
    for ln in bullet_lines:
        stripped = ln.strip()
        if stripped.startswith('- '):
            item = stripped[2:].strip()
        else:
            item = stripped
        # Extract [caption](url)
        m = re.match(r'\[([^\]]+)\]\(([^)]+)\)', item)
        if m:
            caption = htmllib.escape(m.group(1))
            url = htmllib.escape(m.group(2))
            parts.append(
                f'<figure>'
                f'<img src="{url}" alt="{caption}" loading="lazy"/>'
                f'<figcaption>{caption}</figcaption>'
                f'</figure>'
            )
    parts.append('</div>')
    return '\n'.join(parts)


# ── Markdown-to-HTML body converter ─────────────────────────────────────────

def md_to_html(md_body):
    """
    Convert Markdown body to HTML using the shared CSS classes.
    Handles: # H1 (skipped — goes in header), ## H2, ### H3,
             - bullets, 1. numbered, **bold**, *italic*, [link](url),
             pipe tables, ## Reference Images section, paragraphs.
    """
    lines = md_body.splitlines()
    parts = []
    i = 0

    # Detect whether the ## Source / ## Sources section is last
    source_section_idx = None
    for j, ln in enumerate(lines):
        if re.match(r'^##\s+(Source|Sources)\s*$', ln.strip(), re.I):
            source_section_idx = j

    # Detect ## Reference Images section index
    ref_images_section_idx = None
    for j, ln in enumerate(lines):
        if re.match(r'^##\s+Reference Images\s*$', ln.strip(), re.I):
            ref_images_section_idx = j

    while i < len(lines):
        ln = lines[i]
        stripped = ln.strip()

        # Skip blank lines
        if not stripped:
            i += 1
            continue

        # Horizontal rule ---
        if re.match(r'^---+\s*$', stripped):
            i += 1
            continue

        # H1 — skip (already in doc-header)
        if stripped.startswith('# ') and not stripped.startswith('## '):
            i += 1
            continue

        # H2 section heading
        if re.match(r'^##\s+', stripped):
            heading_text = re.sub(r'^##\s+', '', stripped)

            # ── Reference Images special handler ──
            if re.match(r'^Reference Images\s*$', heading_text, re.I) and i == ref_images_section_idx:
                parts.append(f'<h2 class="section-h">{render_inline(heading_text)}</h2>')
                i += 1
                # Skip blank lines between heading and bullet list
                while i < len(lines) and not lines[i].strip():
                    i += 1
                # Collect following bullet lines (may be separated by blanks)
                bullet_lines = []
                while i < len(lines):
                    sln = lines[i].strip()
                    if re.match(r'^-\s+', sln):
                        bullet_lines.append(sln)
                        i += 1
                    elif not sln:
                        i += 1
                        # Keep collecting if next non-blank is also a bullet
                        j = i
                        while j < len(lines) and not lines[j].strip():
                            j += 1
                        if j < len(lines) and re.match(r'^-\s+', lines[j].strip()):
                            continue  # keep going
                        break
                    else:
                        break
                if bullet_lines:
                    parts.append(render_ref_images(bullet_lines))
                continue

            # ── Source / Sources special handler ──
            is_source = re.match(r'^(Source|Sources)\s*$', heading_text, re.I)
            tag_open = f'<h2 class="section-h">{render_inline(heading_text)}</h2>'
            if is_source and i == source_section_idx:
                parts.append('<div class="source-block">')
                parts.append(tag_open)
                i += 1
                while i < len(lines):
                    sln = lines[i].strip()
                    if sln.startswith('- '):
                        bullet_text = sln[2:].strip()
                        parts.append(f'<p class="body-p">{render_inline(bullet_text)}</p>')
                    elif sln:
                        parts.append(f'<p class="body-p">{render_inline(sln)}</p>')
                    i += 1
                parts.append('</div>')
                continue
            else:
                parts.append(tag_open)
                i += 1
                continue

        # H3 sub-heading
        if re.match(r'^###\s+', stripped):
            heading_text = re.sub(r'^###\s+', '', stripped)
            parts.append(f'<h3 class="section-sh">{render_inline(heading_text)}</h3>')
            i += 1
            continue

        # Pipe table — collect consecutive table lines
        if is_table_line(stripped):
            table_lines = []
            while i < len(lines):
                sln = lines[i].strip()
                if is_table_line(sln):
                    table_lines.append(lines[i])
                    i += 1
                elif not sln:
                    i += 1
                    break
                else:
                    break
            if table_lines:
                parts.append(render_table(table_lines))
            continue

        # Unordered list: collect consecutive - lines
        if re.match(r'^-\s+', stripped):
            items = []
            while i < len(lines):
                sln = lines[i].strip()
                if re.match(r'^-\s+', sln):
                    items.append(render_inline(sln[2:].strip()))
                    i += 1
                elif not sln:
                    i += 1
                    break
                else:
                    break
            li_html = ''.join(f'<li>{it}</li>' for it in items)
            parts.append(f'<ul class="list-ul">{li_html}</ul>')
            continue

        # Ordered list: collect consecutive N. lines
        if re.match(r'^\d+\.\s+', stripped):
            items = []
            while i < len(lines):
                sln = lines[i].strip()
                m = re.match(r'^\d+\.\s+(.*)', sln)
                if m:
                    items.append(render_inline(m.group(1)))
                    i += 1
                elif not sln:
                    i += 1
                    break
                else:
                    break
            li_html = ''.join(f'<li>{it}</li>' for it in items)
            parts.append(f'<ol class="list-ol">{li_html}</ol>')
            continue

        # Regular paragraph — accumulate until blank line
        para_lines = []
        while i < len(lines):
            sln = lines[i].strip()
            if not sln:
                i += 1
                break
            if re.match(r'^#{1,3}\s', sln) or re.match(r'^[-\d]', sln) or is_table_line(sln):
                break
            para_lines.append(sln)
            i += 1
        if para_lines:
            para_text = ' '.join(para_lines)
            parts.append(f'<p class="body-p">{render_inline(para_text)}</p>')

    return '\n'.join(parts)


# ── File list: (md_path, html_out_path) ─────────────────────────────────────

DOCUMENTS = [
    # Corporal weekly history required reading guides — weeks 1-4
    ('content/corporal/week-1-history-required-reading.md',
     'public/documents/view/corporal-week-1-history.html'),
    ('content/corporal/week-2-history-required-reading.md',
     'public/documents/view/corporal-week-2-history.html'),
    ('content/corporal/week-3-history-required-reading.md',
     'public/documents/view/corporal-week-3-history.html'),
    ('content/corporal/week-4-history-required-reading.md',
     'public/documents/view/corporal-week-4-history.html'),
    # Sergeant program required reading hub
    ('content/academy/sergeant-program-required-reading-hub.md',
     'public/documents/view/sergeant-required-reading-hub.html'),
    # Sergeant First Class program required reading hub
    ('content/academy/sergeant-first-class-program-required-reading-hub.md',
     'public/documents/view/sfc-required-reading-hub.html'),
    # Knight Aspirant program required reading hub
    ('content/academy/knight-aspirant-program-required-reading-hub.md',
     'public/documents/view/knight-aspirant-required-reading-hub.html'),
]


# ── Generator ───────────────────────────────────────────────────────────────

def generate_viewer(md_path, out_path):
    with open(md_path, encoding='utf-8') as f:
        raw = f.read()

    meta, body = parse_front_matter(raw)

    title    = meta.get('title', 'Program Document')
    program  = meta.get('program', '')
    track    = meta.get('track', '')
    week_num = meta.get('week', '')

    # Build doc-header content based on available metadata
    if week_num:
        heading  = f'{program} Program — Week {week_num} {track} Required Reading'
        subtitle = f'Templar Forge Academy — Weekly Formation Guide'
    else:
        # Hub / non-week page: use title as heading
        heading  = title
        subtitle = f'Templar Forge Academy — {program} Program' if program else 'Templar Forge Academy'

    body_html = md_to_html(body)

    page_html = HTML_TEMPLATE.format(
        title=htmllib.escape(title),
        css=SHARED_CSS,
        heading=htmllib.escape(heading),
        subtitle=htmllib.escape(subtitle),
        body=body_html,
    )

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(page_html)
    print(f'  ✓ {out_path}')


if __name__ == '__main__':
    print('Generating Markdown viewer pages...')
    count = 0
    for md_path, out_path in DOCUMENTS:
        if not os.path.exists(md_path):
            print(f'  SKIP (not found): {md_path}')
            continue
        try:
            generate_viewer(md_path, out_path)
            count += 1
        except Exception as e:
            import traceback
            print(f'  ERROR {md_path}: {e}')
            traceback.print_exc()

    print(f'\nDone. Generated {count} HTML viewer pages.')
