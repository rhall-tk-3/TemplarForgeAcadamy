/**
 * assessmentService.js
 * Loads per-program test questions, answer keys, discussion questions,
 * and required reading data from src/config/assessments/{slug}/
 */
const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, '../config/assessments');

function getAssessmentPath(slug, ...parts) {
  return path.join(BASE, slug, ...parts);
}

function loadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return null;
  }
}

/**
 * Get required reading data (week focus, key terms, memory targets)
 */
function getRequiredReading(slug) {
  return loadJson(getAssessmentPath(slug, 'required_reading.json'));
}

/**
 * Get weekly multiple-choice test (5 questions)
 */
function getWeekTest(slug, weekNum) {
  const file = `week_${String(weekNum).padStart(2, '0')}_multiple_choice.json`;
  return loadJson(getAssessmentPath(slug, 'tests', file));
}

/**
 * Get weekly answer key
 */
function getWeekAnswerKey(slug, weekNum) {
  const file = `week_${String(weekNum).padStart(2, '0')}_answer_key.json`;
  return loadJson(getAssessmentPath(slug, 'answer_keys', file));
}

/**
 * Get weekly discussion questions
 */
function getWeekDiscussion(slug, weekNum) {
  const file = `week_${String(weekNum).padStart(2, '0')}_discussion_questions.json`;
  return loadJson(getAssessmentPath(slug, 'discussion', file));
}

/**
 * Get combined assessment (all weeks)
 */
function getCombinedAssessment(slug) {
  return loadJson(getAssessmentPath(slug, 'combined_assessment.json'));
}

/**
 * List available programs (slugs that have assessment data)
 */
function getAvailableSlugs() {
  try {
    return fs.readdirSync(BASE).filter(d =>
      fs.statSync(path.join(BASE, d)).isDirectory()
    );
  } catch (e) {
    return [];
  }
}

module.exports = {
  getRequiredReading,
  getWeekTest,
  getWeekAnswerKey,
  getWeekDiscussion,
  getCombinedAssessment,
  getAvailableSlugs,
};
