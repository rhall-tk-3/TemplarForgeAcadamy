/**
 * lessonService.js
 *
 * Loads per-program lesson content from
 *   src/config/curriculum/lessons/{slug}.json
 *
 * Each file has the shape:
 *   { slug, title, description, weeks: [ { week, title, objectives[], lesson,
 *       keyTerms: [{ term, definition }], examQuestions: [{ question, type }] } ] }
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const LESSONS_DIR = path.join(__dirname, '..', 'config', 'curriculum', 'lessons');

/**
 * Load and return the full lesson program file for a given slug.
 * Returns null when the file does not exist.
 * @param {string} slug
 * @returns {object|null}
 */
function getLessonProgram(slug) {
  if (!slug) return null;
  const filePath = path.join(LESSONS_DIR, `${slug}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.error(`[lessonService] Failed to parse ${slug}.json:`, err.message);
    return null;
  }
}

/**
 * Return the lesson object for a specific week within a program.
 * Returns null when the program or week does not exist.
 * @param {string} slug   — program slug (e.g. 'squire')
 * @param {number|string} week — 1-based week number
 * @returns {object|null}
 */
function getLessonForWeek(slug, week) {
  const program = getLessonProgram(slug);
  if (!program) return null;
  return program.weeks.find(w => w.week === Number(week)) || null;
}

module.exports = { getLessonProgram, getLessonForWeek };
