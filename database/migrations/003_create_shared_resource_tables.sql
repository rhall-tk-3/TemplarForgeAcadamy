BEGIN;

CREATE TABLE IF NOT EXISTS shared_resource_sections (
  id INTEGER PRIMARY KEY,
  section_key VARCHAR(100) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shared_resources (
  id INTEGER PRIMARY KEY,
  section_id INTEGER NOT NULL,
  slug VARCHAR(120) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_path VARCHAR(500) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (section_id) REFERENCES shared_resource_sections(id)
);

CREATE INDEX IF NOT EXISTS idx_shared_resource_sections_key ON shared_resource_sections(section_key);
CREATE INDEX IF NOT EXISTS idx_shared_resources_section_id ON shared_resources(section_id);
CREATE INDEX IF NOT EXISTS idx_shared_resources_slug ON shared_resources(slug);

COMMIT;
