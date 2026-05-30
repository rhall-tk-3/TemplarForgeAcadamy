#!/usr/bin/env python3
"""
Generate static HTML viewer pages for all program documents.
Converts real .docx files into styled, readable HTML pages served directly.
"""

import zipfile, xml.etree.ElementTree as ET, json, os, html as htmllib

W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'

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
@media print {
  body { background:#fff; color:#111; padding:20px; }
  .doc-title { color:#111; }
  .doc-kicker, .doc-sub { color:#666; }
  h2.section-h { color:#333; border-color:#ccc; }
  h3.section-sh { color:#555; }
  p.body-p { color:#222; }
  ul.list-ul li { color:#333; }
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

def extract_paras(docx_path):
    """Returns list of (text, style_name) from a real .docx file."""
    with zipfile.ZipFile(docx_path) as z:
        with z.open('word/document.xml') as f:
            root = ET.parse(f).getroot()
    result = []
    for para in root.iter(f'{{{W}}}p'):
        pPr = para.find(f'{{{W}}}pPr')
        style_name = 'Normal'
        if pPr is not None:
            pStyle = pPr.find(f'{{{W}}}pStyle')
            if pStyle is not None:
                style_name = pStyle.get(f'{{{W}}}val', 'Normal')
        runs = para.findall(f'.//{{{W}}}r')
        full_text = ''.join(
            t.text or '' for r in runs for t in r.findall(f'{{{W}}}t')
        )
        text = full_text.strip()
        if text:
            result.append((text, style_name))
    return result

def paras_to_html(paras, skip_count=0):
    """Convert extracted paragraphs to styled HTML, skipping the first skip_count."""
    parts = []
    i = skip_count
    while i < len(paras):
        text, style = paras[i]
        esc = htmllib.escape(text)
        slo = style.lower()

        if 'heading1' in slo or style == 'Title':
            parts.append(f'<h2 class="section-h">{esc}</h2>')
            i += 1
        elif 'heading2' in slo:
            parts.append(f'<h3 class="section-sh">{esc}</h3>')
            i += 1
        elif 'heading3' in slo or 'heading4' in slo:
            parts.append(f'<h3 class="section-sh">{esc}</h3>')
            i += 1
        elif 'list' in slo:
            items = []
            while i < len(paras) and 'list' in paras[i][1].lower():
                items.append(htmllib.escape(paras[i][0]))
                i += 1
            items_html = ''.join(f'<li>{it}</li>' for it in items)
            parts.append(f'<ul class="list-ul">{items_html}</ul>')
        else:
            # Normal paragraph — check if it looks like a heading (short, ALL CAPS or Title Case with no period)
            parts.append(f'<p class="body-p">{esc}</p>')
            i += 1
    return '\n'.join(parts)

def is_real_docx(path):
    try:
        with open(path, 'rb') as f:
            return f.read(4) == b'PK\x03\x04'
    except:
        return False

def generate_viewer(docx_path, out_path, page_title, heading_override=None,
                    subtitle_override=None, skip_paras=0):
    """
    Generate a single HTML viewer page from a docx file.
    heading_override / subtitle_override: explicit strings to use in the header.
    skip_paras: number of leading paragraphs to skip (title lines already in header).
    """
    paras = extract_paras(docx_path)

    # Auto-detect heading and subtitle if not overridden
    heading = heading_override
    subtitle = subtitle_override
    body_start = skip_paras

    if heading is None:
        # Scan first few paragraphs for title-like content
        for i, (text, style) in enumerate(paras[:5]):
            slo = style.lower()
            if 'heading1' in slo or 'title' in slo:
                heading = text
                body_start = max(body_start, i + 1)
                break
            # Fallback: first Normal paragraph if short enough
            if style == 'Normal' and len(text) < 80 and i == 0:
                heading = text
                body_start = max(body_start, i + 1)
                break
        if heading is None:
            heading = page_title

    if subtitle is None:
        for i, (text, style) in enumerate(paras):
            if i <= body_start:
                continue
            slo = style.lower()
            if 'heading2' in slo or ('normal' in slo and len(text) < 80):
                subtitle = text
                body_start = max(body_start, i + 1)
                break
        if subtitle is None:
            subtitle = 'Program Document — Templar Forge Academy'

    body_html = paras_to_html(paras, skip_count=body_start)

    page_html = HTML_TEMPLATE.format(
        title=htmllib.escape(page_title),
        css=SHARED_CSS,
        heading=htmllib.escape(heading),
        subtitle=htmllib.escape(subtitle),
        body=body_html,
    )
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'w', encoding='utf-8') as fh:
        fh.write(page_html)
    print(f'  ✓ {out_path}')


# ── Document list ─────────────────────────────────────────────────────────────
# (docx_source, html_output, page_title, heading_override, subtitle_override, skip_paras)
DOCUMENTS = [
    # Program Handbooks
    ('public/documents/handbooks/squire.docx',
     'public/documents/view/squire-handbook.html',
     'Squire Program Handbook',
     'Squire Program Handbook', 'Templar Forge Academy — 8-Week Formation Program', 2),

    ('public/documents/handbooks/levie.docx',
     'public/documents/view/levie-handbook.html',
     'Levie Program Handbook',
     'Levie Program Handbook', 'Templar Forge Academy — Introductory Formation Program', 2),

    ('public/documents/handbooks/corporal.docx',
     'public/documents/view/corporal-handbook.html',
     'Corporal Program Handbook',
     'Corporal Program Handbook', 'Templar Forge Academy — 8-Week Formation Program', 2),

    ('public/documents/handbooks/sergeant.docx',
     'public/documents/view/sergeant-handbook.html',
     'Sergeant Program Handbook',
     'Sergeant Program Handbook', 'Templar Forge Academy — 8-Week Formation Program', 2),

    ('public/documents/handbooks/sfc.docx',
     'public/documents/view/sfc-handbook.html',
     'Sergeant First Class Handbook',
     'Sergeant First Class Handbook', 'Templar Forge Academy — 8-Week Formation Program', 2),

    ('public/documents/handbooks/knight-aspirant.docx',
     'public/documents/view/knight-aspirant-handbook.html',
     'Knight Aspirant Program Handbook',
     'Knight Aspirant Program Handbook', 'Templar Forge Academy — 8-Week Formation Program', 2),

    ('public/documents/handbooks/knight.docx',
     'public/documents/view/knight-handbook.html',
     'Knight Program Handbook',
     'Knight Program Handbook', 'Templar Forge Academy — 8-Week Formation Program', 2),

    ('public/documents/handbooks/lieutenant.docx',
     'public/documents/view/lieutenant-handbook.html',
     'Knight Lieutenant Handbook',
     'Knight Lieutenant Handbook', 'Templar Forge Academy — Officer Formation Level I', 2),

    ('public/documents/handbooks/captain.docx',
     'public/documents/view/captain-handbook.html',
     'Knight Captain Handbook',
     'Knight Captain Handbook', 'Templar Forge Academy — Officer Formation Level III', 2),

    ('public/documents/handbooks/major.docx',
     'public/documents/view/major-handbook.html',
     'Knight Major Handbook',
     'Knight Major Handbook', 'Templar Forge Academy — Officer Formation Level IV', 2),

    ('public/documents/handbooks/commander.docx',
     'public/documents/view/commander-handbook.html',
     'Knight Commander Handbook',
     'Knight Commander Handbook', 'Templar Forge Academy — Officer Formation Level V', 2),

    # Shared documents
    ('public/documents/shared/ktkc-rules-and-statutes.docx',
     'public/documents/view/ktkc-rules-and-statutes.html',
     'KTKC Rules and Statutes',
     'KTKC Temple Rules and Statutes',
     'Knights Templar of the Kingdom of Christ', 0),

    ('public/documents/shared/promotion-manual.docx',
     'public/documents/view/promotion-manual.html',
     'KTKC Promotion Manual & By-Laws',
     'Promotion Manual and By-Laws',
     'Knights Templar of the Kingdom of Christ', 2),
]

os.makedirs('public/documents/view', exist_ok=True)
count = 0
for entry in DOCUMENTS:
    docx_path, out_path, page_title = entry[0], entry[1], entry[2]
    heading_ov   = entry[3] if len(entry) > 3 else None
    subtitle_ov  = entry[4] if len(entry) > 4 else None
    skip         = entry[5] if len(entry) > 5 else 0

    if not os.path.exists(docx_path):
        print(f'  SKIP (not found): {docx_path}')
        continue
    if not is_real_docx(docx_path):
        print(f'  SKIP (not real docx): {docx_path}')
        continue
    try:
        generate_viewer(docx_path, out_path, page_title, heading_ov, subtitle_ov, skip)
        count += 1
    except Exception as e:
        print(f'  ERROR {docx_path}: {e}')

print(f'\nDone. Generated {count} HTML viewer pages in public/documents/view/')
