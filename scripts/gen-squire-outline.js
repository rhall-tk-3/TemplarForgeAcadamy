#!/usr/bin/env node
'use strict';
const fs   = require('fs');
const path = require('path');

const json = JSON.parse(fs.readFileSync(
  path.join(__dirname, '../src/config/curriculum/lessons/squire.json'), 'utf8'));

function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

let weeksHTML = '';
json.weeks.forEach(w => {
  const terms = w.keyTerms.map(t =>
    `<li><strong>${esc(t.term)}</strong> \u2014 ${esc(t.definition)}</li>`
  ).join('\n            ');
  const objectives = w.objectives.map(o => `<li>${esc(o)}</li>`).join('\n            ');
  const exams = w.examQuestions.map(q =>
    `<li><span class="q-type ${q.type}">${q.type.toUpperCase()}</span> ${esc(q.question)}</li>`
  ).join('\n            ');

  weeksHTML += `
  <section class="week" id="week${w.week}">
    <div class="week-header">
      <span class="week-num">Week ${w.week}</span>
      <h2>${esc(w.title)}</h2>
    </div>
    <div class="week-body">
      <div class="block">
        <h3>&#10013; Objectives</h3>
        <ul class="obj-list">
            ${objectives}
        </ul>
      </div>
      <div class="block lesson-block">
        <h3>&#10022; Lesson</h3>
        <p>${esc(w.lesson)}</p>
      </div>
      <div class="block">
        <h3>&#9876; Key Terms</h3>
        <ul class="term-list">
            ${terms}
        </ul>
      </div>
      <div class="block">
        <h3>&#128220; Exam Questions</h3>
        <ul class="exam-list">
            ${exams}
        </ul>
      </div>
    </div>
  </section>`;
});

const allSections = weeksHTML.split('</section>').filter(s => s.trim());
// Squire: weeks 1-4 history/structure, 5-8 life/crisis/suppression/review
const part1 = allSections.slice(0,4).join('</section>') + '</section>';
const part2 = allSections.slice(4).join('</section>') + '</section>';

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Squire School Program &mdash; Weekly Lesson Outline</title>
  <style>
  @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Crimson+Text:ital,wght@0,400;0,600;1,400&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #0a0804;
    color: #e0cc98;
    font-family: 'Crimson Text', serif;
    font-size: 1.05rem;
    padding: 40px 24px 80px;
  }
  .wrap { max-width: 820px; margin: 0 auto; }
  .back {
    display: inline-block;
    font-family: 'Cinzel', serif;
    font-size: 0.78rem;
    color: #b8960c;
    text-decoration: none;
    border: 1px solid rgba(184,150,12,0.4);
    border-radius: 4px;
    padding: 6px 14px;
    margin-bottom: 28px;
    letter-spacing: 0.05em;
  }
  .back:hover { background: rgba(184,150,12,0.12); color: #e8c040; }
  .doc-header { margin-bottom: 40px; border-bottom: 1px solid rgba(184,150,12,0.25); padding-bottom: 24px; }
  .doc-header h1 {
    font-family: 'Cinzel', serif;
    font-size: 1.8rem;
    font-weight: 700;
    color: #e8c040;
    letter-spacing: 0.06em;
    margin-bottom: 8px;
  }
  .doc-header .subtitle {
    font-family: 'Cinzel', serif;
    font-size: 0.85rem;
    color: #b8960c;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .doc-header .desc {
    margin-top: 14px;
    color: #c8b87a;
    font-size: 1rem;
    font-style: italic;
    line-height: 1.6;
  }
  .toc {
    background: rgba(232,192,64,0.05);
    border: 1px solid rgba(232,192,64,0.15);
    border-radius: 6px;
    padding: 20px 24px;
    margin-bottom: 40px;
  }
  .toc h3 {
    font-family: 'Cinzel', serif;
    font-size: 0.82rem;
    color: #b8960c;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    margin-bottom: 12px;
  }
  .toc ol { padding-left: 20px; }
  .toc li { margin-bottom: 5px; }
  .toc a {
    color: #c9a84c;
    text-decoration: none;
    font-family: 'Cinzel', serif;
    font-size: 0.83rem;
    letter-spacing: 0.03em;
  }
  .toc a:hover { color: #e8c040; text-decoration: underline; }
  .week {
    margin-bottom: 50px;
    border: 1px solid rgba(232,192,64,0.18);
    border-radius: 8px;
    overflow: hidden;
    background: rgba(232,192,64,0.02);
  }
  .week-header {
    background: rgba(232,192,64,0.08);
    border-bottom: 1px solid rgba(232,192,64,0.2);
    padding: 16px 24px;
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .week-num {
    font-family: 'Cinzel', serif;
    font-size: 0.75rem;
    color: #b8960c;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    white-space: nowrap;
    border: 1px solid rgba(184,150,12,0.35);
    border-radius: 4px;
    padding: 3px 10px;
  }
  .week-header h2 {
    font-family: 'Cinzel', serif;
    font-size: 1.1rem;
    color: #e8c040;
    font-weight: 600;
    letter-spacing: 0.04em;
  }
  .week-body { padding: 24px; }
  .block { margin-bottom: 22px; }
  .block:last-child { margin-bottom: 0; }
  .block h3 {
    font-family: 'Cinzel', serif;
    font-size: 0.82rem;
    color: #b8960c;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: 10px;
    border-bottom: 1px solid rgba(184,150,12,0.2);
    padding-bottom: 6px;
  }
  .obj-list, .term-list, .exam-list { padding-left: 18px; }
  .obj-list li, .exam-list li { margin-bottom: 6px; line-height: 1.55; color: #d8c48a; }
  .term-list li { margin-bottom: 8px; line-height: 1.55; color: #d8c48a; }
  .term-list strong { color: #e8c040; font-style: normal; font-weight: 600; }
  .lesson-block p { line-height: 1.75; color: #d4be88; font-size: 1.02rem; }
  .q-type {
    display: inline-block;
    font-family: 'Cinzel', serif;
    font-size: 0.68rem;
    letter-spacing: 0.07em;
    padding: 2px 7px;
    border-radius: 3px;
    margin-right: 7px;
    vertical-align: middle;
  }
  .q-type.short { background: rgba(184,150,12,0.18); color: #c9a84c; border: 1px solid rgba(184,150,12,0.3); }
  .q-type.essay { background: rgba(100,150,255,0.1); color: #8fb4e8; border: 1px solid rgba(100,150,255,0.25); }
  .section-divider {
    text-align: center;
    margin: 50px 0 40px;
    padding: 20px;
    border: 1px solid rgba(232,192,64,0.2);
    border-radius: 6px;
    background: rgba(232,192,64,0.04);
  }
  .section-divider h2 {
    font-family: 'Cinzel', serif;
    font-size: 1rem;
    color: #e8c040;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .section-divider p { font-size: 0.9rem; color: #b8960c; margin-top: 8px; font-style: italic; }
  </style>
</head>
<body>
<div class="wrap">
  <a class="back" href="/member">&larr; Dashboard</a>

  <div class="doc-header">
    <h1>&#10013; Squire School Program</h1>
    <div class="subtitle">Knights Templar of the Kingdom of Christ &mdash; Weekly Lesson Outline</div>
    <p class="desc">${esc(json.description)}</p>
  </div>

  <div class="toc">
    <h3>Table of Contents</h3>
    <ol>
      <li><a href="#week1">Week 1 &mdash; Origins and Virtues</a></li>
      <li><a href="#week2">Week 2 &mdash; Founding People and Places</a></li>
      <li><a href="#week3">Week 3 &mdash; Approval and Mission</a></li>
      <li><a href="#week4">Week 4 &mdash; Structure and Daily Life</a></li>
      <li><a href="#week5">Week 5 &mdash; Life of the Order</a></li>
      <li><a href="#week6">Week 6 &mdash; Power and Crisis</a></li>
      <li><a href="#week7">Week 7 &mdash; Suppression and Courage</a></li>
      <li><a href="#week8">Week 8 &mdash; Review and Board Preparation</a></li>
    </ol>
  </div>

  <div class="section-divider">
    <h2>&#10013; Part I &mdash; Origins, Founding &amp; Structure</h2>
    <p>Weeks 1&ndash;4: First Crusade, founding figures, formal recognition, and the Order's organization</p>
  </div>

${part1}

  <div class="section-divider">
    <h2>&#10013; Part II &mdash; Life, Crisis, Suppression &amp; Review</h2>
    <p>Weeks 5&ndash;8: Daily life, the fall of Acre, the arrests of 1307, and promotion readiness</p>
  </div>

${part2}

</div>
</body>
</html>`;

const outPath = path.join(__dirname, '../public/documents/outlines/squire.html');
fs.writeFileSync(outPath, html, 'utf8');
console.log('Written:', outPath, fs.statSync(outPath).size, 'bytes');
