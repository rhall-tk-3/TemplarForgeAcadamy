#!/usr/bin/env python3
import urllib.request, json, os

token = os.environ.get('GITHUB_TOKEN', '')
owner = 'rhall-tk-3'
repo  = 'TemplarForgeAcadamy'
pr    = 1

body = (
    "## Session 5 — Program-Aware Document Library (`9c4f08b`)\n\n"
    "Replaced the generic shared document section on the member dashboard with a fully "
    "program-specific document library. Documents shown adapt dynamically based on the "
    "member's current assigned program and their completed program history.\n\n"
    "### What Was Built\n\n"
    "**Handbook Files** (`public/documents/handbooks/`)\n"
    "- 11 Curriculum Handbook .docx files at `/documents/handbooks/{slug}.docx`:\n"
    "  squire, levie, corporal, sergeant, sfc, knight-aspirant, knight, lieutenant, captain, major, commander\n"
    "- `promotion-manual.docx` — KTKC Promotion Manual & By-Laws (740KB, permanent at every level)\n"
    "- All files are final user-uploaded versions, validated with python-docx\n\n"
    "**Lesson Outline HTML Pages** (`public/documents/outlines/`)\n"
    "- 11 outline HTML pages at `/documents/outlines/{slug}.html`\n"
    "- Generated from `src/config/curriculum/lessons/{slug}.json` — week number, title, objectives only\n"
    "- No exam questions or answer keys included; gothic dark styled, print-friendly\n"
    "- Replaced on progression (only current program's outline shown at any time)\n\n"
    "**`src/config/repositoryResources.json`** — Completely rewritten\n"
    "- `programOrder[]` — canonical 11-slug progression sequence\n"
    "- `programDocuments{}` — per-slug handbook + outline title/path pairs\n"
    "- `permanentDocuments{}` — promotion manual always shown\n\n"
    "**`src/services/repositoryResourceService.js`** — Completely rewritten\n"
    "- `getDocumentsForProgram(currentSlug, completedSlugs)` returns 3 sections:\n"
    "  - `current-program`: current handbook + lesson outline (replaced on progression)\n"
    "  - `previous-handbooks`: all past handbooks cumulative (never removed after completion)\n"
    "  - `promotion-manual`: permanent link at every program level\n\n"
    "**`src/controllers/repositoryResourceController.js`** — Updated\n"
    "- Added `GET /api/resources/for-program` endpoint\n"
    "- Reads `assignedProgram` + `programHistory` from session user\n"
    "- Returns personalised document sections\n\n"
    "**`public/member-dashboard.html`** — Updated\n"
    "- `fetch('/api/resources')` changed to `fetch('/api/resources/for-program')`\n"
    "- `renderResources()` rebuilt with rich card UI: View/Download labels, icons, hover effects\n"
    "- Section heading updated to 'Program Documents & Resources'\n"
    "- Unassigned members see: 'Documents will appear here once you are assigned a program.'\n\n"
    "### Document Logic Rules\n"
    "| Condition | Documents shown |\n"
    "|---|---|\n"
    "| No program assigned | Promotion Manual only |\n"
    "| Squire (first program) | Squire Handbook + Squire Outline + Promotion Manual |\n"
    "| SFC (5th, 4 completed) | SFC Handbook + SFC Outline + Squire-Sergeant handbooks + Promotion Manual |\n"
    "| Commander (last, 10 completed) | Commander Handbook + Commander Outline + 10 previous handbooks + Promotion Manual |\n\n"
    "### Smoke Tests — All Passed\n"
    "- T1 (unassigned): sections = [promotion-manual] PASS\n"
    "- T2 (squire): sections = [current-program, promotion-manual], correct titles PASS\n"
    "- T3 (knight-aspirant, 5 complete): 3 sections, 5 previous handbooks PASS\n"
    "- T4 (commander, 10 complete): 2 + 10 + 1 items PASS\n"
    "- Server start: Schoolmaster account ready, HTTP 200 PASS\n"
)

data = json.dumps({'body': body}).encode()
url  = f'https://api.github.com/repos/{owner}/{repo}/issues/{pr}/comments'
req  = urllib.request.Request(url, data=data, method='POST')
req.add_header('Authorization', f'token {token}')
req.add_header('Content-Type',  'application/json')
req.add_header('Accept',        'application/vnd.github.v3+json')

with urllib.request.urlopen(req) as resp:
    result = json.loads(resp.read())
    print('Comment ID:', result['id'])
    print('URL:', result['html_url'])
