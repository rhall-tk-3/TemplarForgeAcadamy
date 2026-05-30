import { withProgramHandbook } from "./programHandbooks";

// ---------------------------------------------------------------------------
// RAW hub definitions — one entry per program.
// `readingList` is intentionally empty here; the canonical handbook for each
// program is injected automatically by `withProgramHandbook` via the slug.
// Additional per-program reading items can be added inline as needed.
// ---------------------------------------------------------------------------

const RAW_SCHOOL_PROGRAM_HUBS = [
  {
    slug: "squire",
    title: "Squire School Program",
    audience: "Youth",
    phase: "Foundational rank",
    programType: "foundational",
    durationWeeks: 8,
    readingList: [],
  },
  {
    slug: "levie",
    title: "Levie School Program",
    audience: "Adult",
    phase: "Foundational rank",
    programType: "foundational",
    durationWeeks: 8,
    readingList: [],
  },
  {
    slug: "corporal",
    title: "Corporal School Program",
    audience: "Adult",
    phase: "Rank advancement",
    programType: "rank-advancement",
    durationWeeks: 8,
    readingList: [],
  },
  {
    slug: "sergeant",
    title: "Sergeant School Program",
    audience: "Adult",
    phase: "Rank advancement",
    programType: "rank-advancement",
    durationWeeks: 8,
    readingList: [],
  },
  {
    // slug "sfc" resolves to the "sergeant-first-class" handbook key via
    // PROGRAM_KEY_ALIASES (alias "sfc" is listed there).
    slug: "sfc",
    title: "Sergeant First Class School Program",
    audience: "Adult",
    phase: "Rank advancement",
    programType: "rank-advancement",
    durationWeeks: 8,
    readingList: [],
  },
  {
    slug: "knight-aspirant",
    title: "Knight Aspirant School Program",
    audience: "Adult",
    phase: "Knight preparation",
    programType: "knight-preparation",
    durationWeeks: 8,
    readingList: [],
  },
  {
    slug: "knight",
    title: "Knight School Program",
    audience: "Adult",
    phase: "Knight formation",
    programType: "knight-formation",
    durationWeeks: 4,
    readingList: [],
  },
  {
    // slug "lieutenant" resolves to the "knight-lieutenant" handbook key via
    // PROGRAM_KEY_ALIASES (alias "lieutenant" is listed there).
    slug: "lieutenant",
    title: "Lieutenant School Program",
    audience: "Adult",
    phase: "Officer Formation Level I",
    programType: "officer-formation",
    durationWeeks: 12,
    readingList: [],
  },
  {
    // slug "captain" resolves to the "knight-captain" handbook key via
    // PROGRAM_KEY_ALIASES (alias "captain" is listed there).
    slug: "captain",
    title: "Captain School Program",
    audience: "Adult",
    phase: "Officer Formation Level II",
    programType: "officer-formation",
    durationWeeks: 12,
    readingList: [],
  },
  {
    // slug "major" resolves to the "knight-major" handbook key via
    // PROGRAM_KEY_ALIASES (alias "major" is listed there).
    slug: "major",
    title: "Major School Program",
    audience: "Adult",
    phase: "Officer Formation Level III",
    programType: "officer-formation",
    durationWeeks: 12,
    readingList: [],
  },
  {
    // slug "commander" resolves to the "knight-commander" handbook key via
    // PROGRAM_KEY_ALIASES (alias "commander" is listed there).
    slug: "commander",
    title: "Commander School Program",
    audience: "Adult",
    phase: "Officer Formation Level IV",
    programType: "officer-formation",
    durationWeeks: 12,
    readingList: [],
  },
];

// ---------------------------------------------------------------------------
// Public export — each hub has its program handbook injected at index [0] of
// readingList, with any pre-existing duplicate handbook entry removed so
// there is never more than one handbook item per hub.
// ---------------------------------------------------------------------------

export const SCHOOL_PROGRAM_HUBS = RAW_SCHOOL_PROGRAM_HUBS.map(withProgramHandbook);
