'use strict';

const fs   = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '..', 'config', 'repositoryResources.json');

function readResourceConfig() {
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function getRepositoryResources() {
  return readResourceConfig();
}

/**
 * Build the document list for a member's current program state.
 *
 * Rules:
 *  - "Current documents" section:
 *      • Current program's Curriculum Handbook  (labeled "(Current Program) Curriculum Handbook")
 *      • Current program's Weekly Lesson Outline (replace on every progression)
 *  - "Previous Handbooks" section (cumulative — all programs before current in order):
 *      • Each past handbook stays accessible forever (up through knight-commander)
 *  - "Promotion & By-Laws" section (permanent, same link at every level):
 *      • KTKC Promotion Manual & By-Laws
 *
 * @param {string|null} currentSlug   — user's assignedProgram slug (null = unassigned)
 * @param {string[]}    completedSlugs — slugs of completed programs
 * @returns {{ sections: Array }}
 */
function getDocumentsForProgram(currentSlug, completedSlugs = []) {
  const config  = readResourceConfig();
  const order   = config.programOrder;    // canonical slug order
  const progDocs = config.programDocuments;
  const perm    = config.permanentDocuments;

  const sections = [];

  // ── 1. Current Program Documents ──────────────────────────
  if (currentSlug && progDocs[currentSlug]) {
    const doc = progDocs[currentSlug];
    sections.push({
      key:         'current-program',
      title:       '✠ Current Program Documents',
      description: 'Your active curriculum handbook and weekly lesson outline.',
      items: [
        {
          title: doc.handbookTitle,
          path:  doc.handbookPath,
          type:  'docx',
          icon:  '📖'
        },
        {
          title: doc.outlineTitle,
          path:  doc.outlinePath,
          type:  'html',
          icon:  '📋'
        }
      ]
    });
  }

  // ── 2. Previous Handbooks (cumulative) ────────────────────
  // Include every program that appears before currentSlug in the order array,
  // AND any explicitly completed programs (in case order doesn't match exactly).
  const currentIdx = currentSlug ? order.indexOf(currentSlug) : -1;

  const pastSlugs = order.filter((slug, idx) => {
    // Include if it precedes the current program, OR is in completedSlugs
    const isCompleted = completedSlugs.includes(slug);
    const isBefore    = currentIdx > 0 && idx < currentIdx;
    return (isCompleted || isBefore) && slug !== currentSlug;
  });

  // Deduplicate (keep order)
  const seenPast = new Set();
  const pastItems = [];
  for (const slug of pastSlugs) {
    if (seenPast.has(slug) || !progDocs[slug]) continue;
    seenPast.add(slug);
    pastItems.push({
      title: progDocs[slug].handbookTitle,
      path:  progDocs[slug].handbookPath,
      type:  'docx',
      icon:  '📘'
    });
  }

  if (pastItems.length > 0) {
    sections.push({
      key:         'previous-handbooks',
      title:       '📚 Previous Curriculum Handbooks',
      description: 'Reference handbooks from programs you have already progressed through.',
      items: pastItems
    });
  }

  // ── 3. Permanent — Promotion Manual (always shown) ────────
  sections.push({
    key:         'promotion-manual',
    title:       '⚖ Promotion Guidelines & By-Laws',
    description: perm.promotionManual.note,
    items: [
      {
        title: perm.promotionManual.title,
        path:  perm.promotionManual.path,
        type:  'docx',
        icon:  '⚖'
      }
    ]
  });

  return { sections };
}

module.exports = {
  readResourceConfig,
  getRepositoryResources,
  getDocumentsForProgram
};
