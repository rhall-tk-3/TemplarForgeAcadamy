type ReadingListItem = {
  id?: string;
  title?: string;
  label?: string;
  href?: string;
  url?: string;
  category?: string;
  kind?: string;
  required?: boolean;
  description?: string;
  [key: string]: unknown;
};

type HubLike = {
  slug?: string;
  id?: string;
  key?: string;
  program?: string;
  title?: string;
  readingList?: ReadingListItem[];
  [key: string]: unknown;
};

export const PROGRAM_HANDBOOKS = {
  levie: {
    title: "Levie School Handbook for Templar Forge Academy",
    url: "https://www.genspark.ai/api/files/s/OEP77yyr",
  },
  squire: {
    title: "Squire School Handbook of the Templar Forge Academy",
    url: "https://www.genspark.ai/api/files/s/IPsI28C4",
  },
  corporal: {
    title: "Corporal Program Handbook for Templar Forge Academy",
    url: "https://www.genspark.ai/api/files/s/TDu3Zx3x",
  },
  sergeant: {
    title: "Sergeant Program Handbook for Templar Forge Academy",
    url: "https://www.genspark.ai/api/files/s/8LLLDTDV",
  },
  "sergeant-first-class": {
    title: "Sergeant First Class Handbookfor Templar Forge Academy",
    url: "https://www.genspark.ai/api/files/s/GubnIacR",
  },
  "knight-aspirant": {
    title: "Knight Aspirant Program Handbook for Templar Forge Academy",
    url: "https://www.genspark.ai/api/files/s/brgUCcLc",
  },
  knight: {
    title: "Knight Program Handbook for Templar Forge Academy",
    url: "https://www.genspark.ai/api/files/s/n2VvvRJw",
  },
  "knight-lieutenant": {
    title: "Knight Lieutenant Handbook for Templar Forge Academy",
    url: "https://www.genspark.ai/api/files/s/vx08oX96",
  },
  "knight-captain": {
    title: "Knight Captain Handbook for Templar Forge Academy",
    url: "https://www.genspark.ai/api/files/s/pctp1yfN",
  },
  "knight-major": {
    title: "Knight Major Handbook for Templar Forge Academy",
    url: "https://www.genspark.ai/api/files/s/sGEOMP32",
  },
  "knight-commander": {
    title: "Knight Commander Handbook for Templar Forge Academy",
    url: "https://www.genspark.ai/api/files/s/8rLFZUuC",
  },
} as const;

type ProgramKey = keyof typeof PROGRAM_HANDBOOKS;

const PROGRAM_KEY_ALIASES: Record<ProgramKey, string[]> = {
  levie: [
    "levie",
    "levie-school",
    "levie_school",
    "levie program",
  ],
  squire: [
    "squire",
    "squire-school",
    "squire_school",
    "squire program",
  ],
  corporal: ["corporal", "corporal-program", "corporal_program"],
  sergeant: ["sergeant", "sergeant-program", "sergeant_program"],
  "sergeant-first-class": [
    "sergeant first class",
    "sergeant-first-class",
    "sergeant_first_class",
    "sfc",
  ],
  "knight-aspirant": [
    "knight aspirant",
    "knight-aspirant",
    "knight_aspirant",
    "aspirant",
  ],
  knight: ["knight", "knight-program", "knight_program"],
  "knight-lieutenant": [
    "knight lieutenant",
    "knight-lieutenant",
    "knight_lieutenant",
    "lieutenant",
  ],
  "knight-captain": [
    "knight captain",
    "knight-captain",
    "knight_captain",
    "captain",
  ],
  "knight-major": [
    "knight major",
    "knight-major",
    "knight_major",
    "major",
  ],
  "knight-commander": [
    "knight commander",
    "knight-commander",
    "knight_commander",
    "commander",
  ],
};

const PROGRAM_TITLE_MATCHES: Record<ProgramKey, string[]> = {
  levie: [
    "levie school handbook",
    "levie program handbook",
  ],
  squire: [
    "squire school handbook",
    "squire program handbook",
  ],
  corporal: [
    "corporal program handbook",
    "corporal handbook",
  ],
  sergeant: [
    "sergeant program handbook",
    "sergeant handbook",
  ],
  "sergeant-first-class": [
    "sergeant first class handbook",
  ],
  "knight-aspirant": [
    "knight aspirant program handbook",
    "knight aspirant handbook",
  ],
  knight: [
    "knight program handbook",
  ],
  "knight-lieutenant": [
    "knight lieutenant handbook",
  ],
  "knight-captain": [
    "knight captain handbook",
  ],
  "knight-major": [
    "knight major handbook",
  ],
  "knight-commander": [
    "knight commander handbook",
  ],
};

function normalize(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[_\s]+/g, " ")
    .replace(/-+/g, "-");
}

function resolveProgramKey(value: unknown): ProgramKey | null {
  const raw = normalize(value);

  for (const [programKey, aliases] of Object.entries(PROGRAM_KEY_ALIASES) as [
    ProgramKey,
    string[]
  ][]) {
    if (
      raw === normalize(programKey) ||
      aliases.some((alias) => raw === normalize(alias)) ||
      aliases.some((alias) => raw.includes(normalize(alias)))
    ) {
      return programKey;
    }
  }

  return null;
}

function getHubProgramKey(hub: HubLike): ProgramKey | null {
  return (
    resolveProgramKey(hub.slug) ??
    resolveProgramKey(hub.id) ??
    resolveProgramKey(hub.key) ??
    resolveProgramKey(hub.program) ??
    resolveProgramKey(hub.title)
  );
}

function getItemTitle(item: ReadingListItem): string {
  return normalize(item.title ?? item.label);
}

function getItemHref(item: ReadingListItem): string {
  return normalize(item.href ?? item.url);
}

function isSameProgramHandbook(
  item: ReadingListItem,
  programKey: ProgramKey
): boolean {
  const title = getItemTitle(item);
  const href = getItemHref(item);
  const category = normalize(item.category);
  const kind = normalize(item.kind);
  const handbookUrl = normalize(PROGRAM_HANDBOOKS[programKey].url);

  const explicitHandbookMarker =
    category === "program handbook" || kind === "program-handbook";

  const titleLooksLikeProgramHandbook =
    title.includes("handbook") &&
    PROGRAM_TITLE_MATCHES[programKey].some((candidate) =>
      title.includes(normalize(candidate))
    );

  return explicitHandbookMarker || titleLooksLikeProgramHandbook || href === handbookUrl;
}

function buildProgramHandbookItem(programKey: ProgramKey): ReadingListItem {
  const handbook = PROGRAM_HANDBOOKS[programKey];

  return {
    id: `${programKey}-program-handbook`,
    title: handbook.title,
    label: handbook.title,
    href: handbook.url,
    url: handbook.url,
    category: "Program Handbook",
    kind: "program-handbook",
    required: true,
    description: "Required program handbook",
  };
}

export function withProgramHandbook<T extends HubLike>(hub: T): T {
  const programKey = getHubProgramKey(hub);

  if (!programKey) {
    return hub;
  }

  const currentReadingList = Array.isArray(hub.readingList) ? hub.readingList : [];
  const cleanedReadingList = currentReadingList.filter(
    (item) => !isSameProgramHandbook(item, programKey)
  );

  const handbookItem = buildProgramHandbookItem(programKey);

  return {
    ...hub,
    readingList: [handbookItem, ...cleanedReadingList],
  };
}
