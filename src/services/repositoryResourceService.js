const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '..', 'config', 'repositoryResources.json');

function readResourceConfig() {
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function getRepositoryResources() {
  const config = readResourceConfig();
  return {
    ...config,
    totalItems: config.sections.reduce((sum, section) => sum + section.items.length, 0)
  };
}

function getResourceSection(sectionKey) {
  return getRepositoryResources().sections.find((section) => section.key === sectionKey) || null;
}

module.exports = {
  readResourceConfig,
  getRepositoryResources,
  getResourceSection
};
