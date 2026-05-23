BEGIN;

INSERT INTO shared_resource_sections (id, section_key, title, description) VALUES
  (1, 'core-documents', 'Core Program Documents', 'Primary handbook and assessment documents used to orient the KTKC school programs.'),
  (2, 'schoolmaster-forms', 'Fillable Schoolmaster Forms', 'Operational forms for attendance, oral review, advancement, and final evaluations.');

INSERT INTO shared_resources (section_id, slug, title, resource_type, resource_path) VALUES
  (1, 'curriculum-handbook', 'Curriculum Handbook', 'pdf', '/resources/core-documents/18-Curriculum-Handbook.pdf'),
  (1, 'weekly-lesson-plan-packet', 'Weekly Lesson Plan Packet', 'pdf', '/resources/core-documents/19-Weekly-Lesson-Plan-Packet.pdf'),
  (1, 'promotion-and-assessment-guide', 'Promotion and Assessment Guide', 'pdf', '/resources/core-documents/20-Promotion-and-Assessment-Guide.pdf'),
  (2, 'attendance-sheets', 'Fillable Attendance Sheets', 'pdf', '/resources/schoolmaster-forms/26-Fillable-Attendance-Sheets.pdf'),
  (2, 'oral-review-rubrics', 'Fillable Oral Review Rubrics', 'pdf', '/resources/schoolmaster-forms/27-Fillable-Oral-Review-Rubrics.pdf'),
  (2, 'advancement-checklists', 'Fillable Advancement Checklists', 'pdf', '/resources/schoolmaster-forms/28-Fillable-Advancement-Checklists.pdf'),
  (2, 'final-evaluation-forms', 'Fillable Final Evaluation Forms', 'pdf', '/resources/schoolmaster-forms/29-Fillable-Final-Evaluation-Forms.pdf');

COMMIT;
