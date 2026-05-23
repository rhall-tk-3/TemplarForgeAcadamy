BEGIN;

CREATE TABLE IF NOT EXISTS curriculum_programs (
  id INTEGER PRIMARY KEY,
  slug VARCHAR(100) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  phase VARCHAR(255) NOT NULL,
  site_entry VARCHAR(255) NOT NULL,
  audience VARCHAR(100),
  duration_weeks INTEGER,
  program_type VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS curriculum_resources (
  id INTEGER PRIMARY KEY,
  program_id INTEGER NOT NULL,
  resource_path VARCHAR(500) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (program_id) REFERENCES curriculum_programs(id)
);

CREATE INDEX IF NOT EXISTS idx_curriculum_programs_slug ON curriculum_programs(slug);
CREATE INDEX IF NOT EXISTS idx_curriculum_resources_program_id ON curriculum_resources(program_id);

COMMIT;
