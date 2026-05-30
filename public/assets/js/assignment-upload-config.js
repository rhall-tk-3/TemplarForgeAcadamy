/**
 * assignment-upload-config.js
 * Authoritative program/lesson/assignment configuration for the paper submission system.
 * Consumed by academy-paper-upload.js.
 *
 * Shape:
 *   window.ACADEMY_ASSIGNMENT_CONFIG[programSlug] = {
 *     title:   string,
 *     lessons: [{ lessonNumber, lessonTitle, assignmentTitle, paperRequired }]
 *   }
 */

window.ACADEMY_ASSIGNMENT_CONFIG = {
  "knight-aspirant": {
    title: "Knight Aspirant Program",
    lessons: [
      { lessonNumber: 1, lessonTitle: "Week 1", assignmentTitle: "Written response / reflection", paperRequired: true },
      { lessonNumber: 2, lessonTitle: "Week 2", assignmentTitle: "Written response / reflection", paperRequired: true },
      { lessonNumber: 3, lessonTitle: "Week 3", assignmentTitle: "Written response / reflection", paperRequired: true },
      { lessonNumber: 4, lessonTitle: "Week 4", assignmentTitle: "Written response / reflection", paperRequired: true },
      { lessonNumber: 5, lessonTitle: "Week 5", assignmentTitle: "Written response / reflection", paperRequired: true },
      { lessonNumber: 6, lessonTitle: "Week 6", assignmentTitle: "Written response / reflection", paperRequired: true },
      { lessonNumber: 7, lessonTitle: "Week 7", assignmentTitle: "Written response / reflection", paperRequired: true },
      { lessonNumber: 8, lessonTitle: "Week 8", assignmentTitle: "Final written review / paper", paperRequired: true }
    ]
  },

  "knight": {
    title: "Knight Program",
    lessons: [
      { lessonNumber: 1, lessonTitle: "Leadership Under Christ",                  assignmentTitle: "Week 1 reflection paper",          paperRequired: true },
      { lessonNumber: 2, lessonTitle: "Leadership Inside KTKC",                   assignmentTitle: "Week 2 written response",           paperRequired: true },
      { lessonNumber: 3, lessonTitle: "Christian Witness in Modern Society",       assignmentTitle: "Week 3 self-examination paper",     paperRequired: true },
      { lessonNumber: 4, lessonTitle: "Day of Service and Leadership in Action",   assignmentTitle: "Week 4 service reflection / AAR",  paperRequired: true }
    ]
  },

  "knight-lieutenant": {
    title: "Knight Lieutenant Program",
    lessons: [
      { lessonNumber:  1, lessonTitle: "The Call to Office",                              assignmentTitle: "Motive reflection paper",                     paperRequired: true },
      { lessonNumber:  2, lessonTitle: "Origins of the Knights Templar",                  assignmentTitle: "Templar origins summary / presentation notes", paperRequired: true },
      { lessonNumber:  3, lessonTitle: "The Templar Chain of Command",                    assignmentTitle: "Chain-of-command chart",                      paperRequired: true },
      { lessonNumber:  4, lessonTitle: "The Under Marshal and the Lieutenant Model",      assignmentTitle: "Under Marshal comparison paper",              paperRequired: true },
      { lessonNumber:  5, lessonTitle: "The Rule: Obedience and Mission",                 assignmentTitle: "Rule reflection on obedience",                paperRequired: true },
      { lessonNumber:  6, lessonTitle: "The Rule: Humility, Speech, and Bearing",         assignmentTitle: "Speech and bearing self-log",                 paperRequired: true },
      { lessonNumber:  7, lessonTitle: "Care of Brothers and Fraternal Responsibility",   assignmentTitle: "Brother-care interview reflection",           paperRequired: true },
      { lessonNumber:  8, lessonTitle: "Readiness, Stewardship, and Reliability",         assignmentTitle: "Readiness checklist",                        paperRequired: true },
      { lessonNumber:  9, lessonTitle: "Leading a Small Team",                            assignmentTitle: "Small-team practicum and AAR",                paperRequired: true },
      { lessonNumber: 10, lessonTitle: "Correction, Conflict, and Discipline",            assignmentTitle: "Conflict case-study paper",                   paperRequired: true },
      { lessonNumber: 11, lessonTitle: "Lieutenant as Mentor and Example",                assignmentTitle: "Mentoring report",                           paperRequired: true },
      { lessonNumber: 12, lessonTitle: "Capstone Preparation and Officer Review",         assignmentTitle: "Final portfolio",                            paperRequired: true }
    ]
  },

  "knight-captain": {
    title: "Knight Captain Program",
    lessons: [
      { lessonNumber:  1, lessonTitle: "The Burden of Local Command",                             assignmentTitle: "Reflection on burden of local command",          paperRequired: true },
      { lessonNumber:  2, lessonTitle: "The Medieval Commandery",                                 assignmentTitle: "Templar commandery summary / presentation",       paperRequired: true },
      { lessonNumber:  3, lessonTitle: "The Office of Commander / Preceptor",                     assignmentTitle: "Commander / Preceptor comparison paper",          paperRequired: true },
      { lessonNumber:  4, lessonTitle: "Mission, Standards, and Local Identity",                  assignmentTitle: "Local mission and standards statement",           paperRequired: true },
      { lessonNumber:  5, lessonTitle: "Administration and Provisions",                           assignmentTitle: "One-month operations plan",                       paperRequired: true },
      { lessonNumber:  6, lessonTitle: "Authority, Delegation, and Accountability",               assignmentTitle: "Delegation map",                                 paperRequired: true },
      { lessonNumber:  7, lessonTitle: "The Rule: Humility, Speech, and Order",                   assignmentTitle: "Command-presence self-log",                      paperRequired: true },
      { lessonNumber:  8, lessonTitle: "Care of Brothers and Pastoral Stewardship",               assignmentTitle: "Pastoral check-in reflection",                   paperRequired: true },
      { lessonNumber:  9, lessonTitle: "Training Lieutenants and Building Future Officers",       assignmentTitle: "Mentoring outline for a Lieutenant",             paperRequired: true },
      { lessonNumber: 10, lessonTitle: "Conflict, Discipline, and Restoration",                   assignmentTitle: "Conflict case-study paper",                      paperRequired: true },
      { lessonNumber: 11, lessonTitle: "Local Command Practicum",                                  assignmentTitle: "Local-command practicum and AAR",                paperRequired: true },
      { lessonNumber: 12, lessonTitle: "Capstone Preparation and Captain's Board Review",         assignmentTitle: "Final portfolio",                                paperRequired: true }
    ]
  },

  "knight-major": {
    title: "Knight Major Program",
    lessons: [
      { lessonNumber:  1, lessonTitle: "The Burden of Wider Oversight",                                    assignmentTitle: "Reflection on wider oversight",                      paperRequired: true },
      { lessonNumber:  2, lessonTitle: "The Provincial Structure of the Templars",                         assignmentTitle: "Templar provincial structure presentation",          paperRequired: true },
      { lessonNumber:  3, lessonTitle: "The Office of Provincial Master / Grand Prior",                    assignmentTitle: "Provincial Master comparison paper",                 paperRequired: true },
      { lessonNumber:  4, lessonTitle: "Mission Alignment Across Multiple Bodies",                         assignmentTitle: "Regional alignment statement",                       paperRequired: true },
      { lessonNumber:  5, lessonTitle: "Inspection, Accountability, and Standards",                        assignmentTitle: "Local-body assessment template",                     paperRequired: true },
      { lessonNumber:  6, lessonTitle: "Recruitment, Growth, and Officer Pipeline",                        assignmentTitle: "Regional growth and officer-development plan",        paperRequired: true },
      { lessonNumber:  7, lessonTitle: "Resource Stewardship and Regional Planning",                       assignmentTitle: "Regional support and priority map",                  paperRequired: true },
      { lessonNumber:  8, lessonTitle: "Training Captains and Strengthening Local Command",                assignmentTitle: "Structured Captain leadership review",               paperRequired: true },
      { lessonNumber:  9, lessonTitle: "Communication, Coordination, and Order",                           assignmentTitle: "Regional communication protocol",                    paperRequired: true },
      { lessonNumber: 10, lessonTitle: "Correction, Intervention, and Restoration at the Regional Level", assignmentTitle: "Regional oversight case-study paper",                paperRequired: true },
      { lessonNumber: 11, lessonTitle: "Regional Oversight Practicum",                                     assignmentTitle: "Regional practicum and AAR",                         paperRequired: true },
      { lessonNumber: 12, lessonTitle: "Capstone Preparation and Major's Board Review",                    assignmentTitle: "Final portfolio",                                    paperRequired: true }
    ]
  },

  "knight-commander": {
    title: "Knight Commander Program",
    lessons: [
      { lessonNumber:  1, lessonTitle: "The Burden of Senior Command",                                        assignmentTitle: "Reflection on burden of senior command",       paperRequired: true },
      { lessonNumber:  2, lessonTitle: "Senior Command in the Knights Templar",                               assignmentTitle: "Senior Templar command presentation",           paperRequired: true },
      { lessonNumber:  3, lessonTitle: "The Offices of Marshal and Seneschal",                                assignmentTitle: "Marshal / Seneschal comparison paper",          paperRequired: true },
      { lessonNumber:  4, lessonTitle: "Doctrine, Mission, and Institutional Identity",                       assignmentTitle: "Institutional doctrine statement",              paperRequired: true },
      { lessonNumber:  5, lessonTitle: "Authority, Judgment, and Command Presence",                           assignmentTitle: "Command-presence self-assessment",              paperRequired: true },
      { lessonNumber:  6, lessonTitle: "Senior Officer Alignment and Direction",                              assignmentTitle: "Senior-officer alignment plan",                 paperRequired: true },
      { lessonNumber:  7, lessonTitle: "Crisis Leadership and Difficult Decisions",                           assignmentTitle: "Crisis case-study paper",                       paperRequired: true },
      { lessonNumber:  8, lessonTitle: "Succession, Appointments, and Officer Formation",                     assignmentTitle: "Succession and officer-development map",        paperRequired: true },
      { lessonNumber:  9, lessonTitle: "Discipline, Correction, and Justice at the Highest Officer Level",   assignmentTitle: "Corrective-action framework",                   paperRequired: true },
      { lessonNumber: 10, lessonTitle: "Stewardship of Culture, Communication, and Morale",                  assignmentTitle: "Communication and morale protocol",             paperRequired: true },
      { lessonNumber: 11, lessonTitle: "Senior Command Practicum",                                            assignmentTitle: "Senior command practicum and AAR",              paperRequired: true },
      { lessonNumber: 12, lessonTitle: "Capstone Preparation and Commander's Board Review",                   assignmentTitle: "Final portfolio",                               paperRequired: true }
    ]
  }
};
