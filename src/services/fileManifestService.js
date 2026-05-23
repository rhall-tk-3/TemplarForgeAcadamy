const fs = require('fs');
const path = require('path');

const publicRoot = path.join(__dirname, '..', '..', 'public', 'programs');

function walk(dir, baseDir = dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return walk(fullPath, baseDir);
    }
    return [path.relative(baseDir, fullPath).replaceAll('\\', '/')];
  });
}

function isCompatibilityAlias(programDir, relativeFile) {
  if (!(relativeFile === 'site/weeks/index.html' || relativeFile === 'site/schoolmaster/index.html')) {
    return false;
  }

  const fullPath = path.join(programDir, relativeFile);
  if (!fs.existsSync(fullPath)) return false;
  const contents = fs.readFileSync(fullPath, 'utf8');
  return contents.includes('Compatibility Redirect');
}

function buildProgramManifest(slug) {
  const programDir = path.join(publicRoot, slug);
  const files = walk(programDir);
  const groups = {
    sitePages: files.filter((file) => file.startsWith('site/') && file.endsWith('.html')),
    resourceFiles: files.filter((file) => file.startsWith('resources/') || file.includes('/downloads/')),
    assets: files.filter((file) => /\.(css|svg|png|jpg|jpeg|gif|webp|ico)$/i.test(file)),
    aliasPages: files.filter((file) => isCompatibilityAlias(programDir, file))
  };

  return {
    slug,
    counts: {
      totalFiles: files.length,
      sitePages: groups.sitePages.length,
      resourceFiles: groups.resourceFiles.length,
      assets: groups.assets.length,
      aliasPages: groups.aliasPages.length
    },
    hasAliasPages: groups.aliasPages.length > 0,
    groups,
    files
  };
}

module.exports = {
  buildProgramManifest
};
