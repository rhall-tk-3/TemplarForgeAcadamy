const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(__dirname, '..', 'database', 'migrations');
const files = fs.readdirSync(migrationsDir).sort();

console.log('Available migrations:');
for (const file of files) {
  if (file.endsWith('.sql')) {
    console.log(`  ${file}`);
  }
}
