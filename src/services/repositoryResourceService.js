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
          type:  'html',
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
      type:  'html',
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

  // ── 2b. Program Source Documents (program-specific extra materials) ──
  const sourceDocs = config.programSourceDocuments;
  if (currentSlug && sourceDocs && sourceDocs[currentSlug] && sourceDocs[currentSlug].length > 0) {
    const slugLabel = currentSlug.charAt(0).toUpperCase() + currentSlug.slice(1);
    sections.push({
      key:         'program-source-docs',
      title:       `\u2726 ${slugLabel} Program Source Documents`,
      description: `Primary reference documents for the ${slugLabel} School Program — reading list, lesson plan, statutes, and printable logs.`,
      items: sourceDocs[currentSlug]
    });
  }

  // ── 3. Permanent — Promotion Manual + Reading Log (always shown) ──
  sections.push({
    key:         'promotion-manual',
    title:       '⚖ Promotion Guidelines & Logs',
    description: 'Standing resources available at every level of progression.',
    items: [
      {
        title: perm.promotionManual.title,
        path:  perm.promotionManual.path,
        type:  'html',
        icon:  '⚖'
      },
      {
        title: 'My Reading Log',
        path:  '/reading-log',
        type:  'html',
        icon:  '📖'
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
