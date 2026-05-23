BEGIN;

INSERT OR IGNORE INTO curriculum_programs (id, slug, title, phase, site_entry, audience, duration_weeks, program_type) VALUES
  (1,  'levie',          'Levie School Program',                    'Foundational rank',          'programs/levie/site/index.html',          'Adult', 8,  'foundational'),
  (2,  'squire',         'Squire School Program',                   'Foundational rank',          'programs/squire/site/index.html',         'Youth', 8,  'foundational'),
  (3,  'corporal',       'Corporal School Program',                 'Rank advancement',           'programs/corporal/site/index.html',       'Adult', 8,  'rank-advancement'),
  (4,  'sergeant',       'Sergeant School Program',                 'Rank advancement',           'programs/sergeant/site/index.html',       'Adult', 8,  'rank-advancement'),
  (5,  'sfc',            'Sergeant First Class School Program',     'Rank advancement',           'programs/sfc/site/index.html',            'Adult', 8,  'rank-advancement'),
  (6,  'knight-aspirant','Knight Aspirant School Program',          'Knight preparation',         'programs/knight-aspirant/site/index.html','Adult', 8,  'knight-preparation'),
  (7,  'knight',         'Knight School Program',                   'Knight formation',           'programs/knight/site/index.html',         'Adult', 4,  'knight-formation'),
  (8,  'lieutenant',     'Lieutenant School Program',               'Officer Formation Level I',  'programs/lieutenant/site/index.html',     'Adult', 12, 'officer-formation'),
  (9,  'captain',        'Captain School Program',                  'Officer Formation Level II', 'programs/captain/site/index.html',        'Adult', 12, 'officer-formation'),
  (10, 'major',          'Major School Program',                    'Officer Formation Level III','programs/major/site/index.html',          'Adult', 12, 'officer-formation'),
  (11, 'commander',      'Commander School Program',                'Officer Formation Level IV', 'programs/commander/site/index.html',      'Adult', 12, 'officer-formation');

COMMIT;
