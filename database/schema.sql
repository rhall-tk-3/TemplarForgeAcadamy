CREATE TABLE curriculum_programs (
  id INTEGER PRIMARY KEY,
  slug VARCHAR(100) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  phase VARCHAR(255) NOT NULL,
  site_entry VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE curriculum_resources (
  id INTEGER PRIMARY KEY,
  program_id INTEGER NOT NULL,
  resource_path VARCHAR(500) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (program_id) REFERENCES curriculum_programs(id)
);

CREATE TABLE shared_resource_sections (
  id INTEGER PRIMARY KEY,
  section_key VARCHAR(100) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE shared_resources (
  id INTEGER PRIMARY KEY,
  section_id INTEGER NOT NULL,
  slug VARCHAR(120) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_path VARCHAR(500) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (section_id) REFERENCES shared_resource_sections(id)
);
