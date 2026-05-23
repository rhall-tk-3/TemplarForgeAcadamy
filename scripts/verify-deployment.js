const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const required = [
  'package.json',
  'server.js',
  'public/index.html',
  'public/app.js',
  'public/programs',
  'public/resources/core-documents/18-Curriculum-Handbook.pdf',
  'public/resources/schoolmaster-forms/26-Fillable-Attendance-Sheets.pdf',
  'src/config/curriculum/index.json',
  'src/config/repositoryResources.json',
  'src/controllers/curriculumController.js',
  'src/controllers/repositoryResourceController.js',
  'src/services/curriculumService.js',
  'src/services/repositoryResourceService.js',
  'database/schema.sql',
  'database/migrations/001_create_curriculum_tables.sql',
  'database/migrations/002_seed_curriculum_programs.sql',
  'database/migrations/003_create_shared_resource_tables.sql',
  'database/migrations/004_seed_shared_resources.sql'
];

const missing = required.filter((rel) => !fs.existsSync(path.join(root, rel)));
if (missing.length) {
  console.error('Missing required deployment files:');
  for (const item of missing) console.error(`- ${item}`);
  process.exit(1);
}

const programsDir = path.join(root, 'public', 'programs');
const programs = fs.readdirSync(programsDir).filter((name) => !name.startsWith('.'));
console.log('Deployment verification passed.');
console.log(`Program folders: ${programs.length}`);
console.log(programs.join(', '));
