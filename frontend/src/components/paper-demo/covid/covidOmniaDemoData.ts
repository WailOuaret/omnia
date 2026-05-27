export type CovidEntityId =
  | "remdesivir"
  | "chloroquine"
  | "favipiravir"
  | "sarskov2"
  | "ncov"
  | "mers"
  | "fda";

export type CovidEntityType = "drug" | "virus" | "org";

export const COVID_ENT: Record<
  CovidEntityId,
  { label: string; type: CovidEntityType }
> = {
  remdesivir: { label: "Remdesivir", type: "drug" },
  chloroquine: { label: "Chloroquine", type: "drug" },
  favipiravir: { label: "Favipiravir", type: "drug" },
  sarskov2: { label: "SARS-CoV-2", type: "virus" },
  ncov: { label: "2019-nCoV", type: "virus" },
  mers: { label: "MERS", type: "virus" },
  fda: { label: "FDA", type: "org" },
};

export const COVID_TYPE_STYLE: Record<
  CovidEntityType,
  { bg: string; border: string; text: string }
> = {
  drug: { bg: "#E1F5EE", border: "#1D9E75", text: "#085041" },
  virus: { bg: "#FAECE7", border: "#D85A30", text: "#4A1B0C" },
  org: { bg: "#EEEDFE", border: "#534AB7", text: "#26215C" },
};

export const COVID_POS: Record<CovidEntityId, { x: number; y: number }> = {
  remdesivir: { x: 110, y: 70 },
  chloroquine: { x: 110, y: 165 },
  favipiravir: { x: 110, y: 255 },
  sarskov2: { x: 390, y: 100 },
  ncov: { x: 450, y: 210 },
  mers: { x: 545, y: 70 },
  fda: { x: 390, y: 22 },
};

export const COVID_ORIG_TRIPLES = [
  { h: "remdesivir" as const, r: "treats", t: "sarskov2" as const },
  { h: "remdesivir" as const, r: "inhibits", t: "ncov" as const },
  { h: "chloroquine" as const, r: "inhibits", t: "ncov" as const },
  { h: "favipiravir" as const, r: "inhibits", t: "ncov" as const },
  { h: "chloroquine" as const, r: "prevents", t: "sarskov2" as const },
  { h: "fda" as const, r: "approves", t: "chloroquine" as const },
  { h: "remdesivir" as const, r: "affects", t: "mers" as const },
];

export const COVID_MISSING_TRIPLES = [
  { h: "chloroquine" as const, r: "treats", t: "sarskov2" as const },
  { h: "favipiravir" as const, r: "treats", t: "sarskov2" as const },
];

export const COVID_CANDIDATES = [
  {
    h: "chloroquine" as const,
    r: "treats",
    t: "sarskov2" as const,
    score: 0.82,
    llm: true,
    tag: "missing" as const,
  },
  {
    h: "favipiravir" as const,
    r: "treats",
    t: "sarskov2" as const,
    score: 0.79,
    llm: true,
    tag: "missing" as const,
  },
  {
    h: "favipiravir" as const,
    r: "prevents",
    t: "sarskov2" as const,
    score: 0.62,
    llm: false,
    tag: "borderline" as const,
  },
  {
    h: "remdesivir" as const,
    r: "prevents",
    t: "sarskov2" as const,
    score: 0.55,
    llm: false,
    tag: "borderline" as const,
  },
  {
    h: "chloroquine" as const,
    r: "affects",
    t: "mers" as const,
    score: 0.31,
    llm: false,
    tag: "incorrect" as const,
  },
  {
    h: "favipiravir" as const,
    r: "affects",
    t: "mers" as const,
    score: 0.29,
    llm: false,
    tag: "incorrect" as const,
  },
];

export const COVID_THRESHOLD = 0.65;

export const COVID_CLUSTER_MEMBERS: CovidEntityId[] = ["remdesivir", "chloroquine", "favipiravir"];
