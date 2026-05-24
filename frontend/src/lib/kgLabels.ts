const RAW_ID_PATTERNS = [/^Q\d+$/i, /^P\d+$/i];

const RELATION_LABELS: Record<string, string> = {
  P17: "country",
  P19: "place of birth",
  P20: "place of death",
  P26: "spouse",
  P27: "country of citizenship",
  P30: "continent",
  P40: "child",
  P69: "educated at",
  P101: "field of work",
  P102: "member of political party",
  P106: "occupation",
  P108: "employer",
  P119: "place of burial",
  P1303: "instrument",
  P136: "genre",
  P140: "religion",
  P161: "cast member",
  P172: "ethnic group",
  P264: "record label",
  P463: "member of",
  P495: "country of origin",
  P509: "cause of death",
  P530: "diplomatic relation",
  P551: "residence",
  P737: "influenced by",
  P840: "narrative location",
  P1050: "medical condition",
  P1412: "languages spoken",
};

export interface KgLabelParts {
  primary: string;
  secondary: string;
  isRawId: boolean;
  kind: "entity" | "relation" | "value";
}

export function isRawKgId(value: string | null | undefined): boolean {
  const text = (value ?? "").trim();
  return RAW_ID_PATTERNS.some((pattern) => pattern.test(text));
}

export function formatKgLabelParts(
  id: string | null | undefined,
  label?: string | null,
  kind: "entity" | "relation" | "value" = "entity",
): KgLabelParts {
  const raw = (id ?? "").trim() || "unknown";
  const trimmedLabel = (label ?? "").trim();
  const fallbackRelation = kind === "relation" ? RELATION_LABELS[raw] : undefined;
  const readable = trimmedLabel && trimmedLabel !== raw ? trimmedLabel : fallbackRelation;
  const rawId = isRawKgId(raw);

  return {
    primary: readable ?? raw,
    secondary: readable ? raw : rawId ? "Label unavailable" : raw,
    isRawId: rawId && !readable,
    kind,
  };
}

export function formatKgInline(id: string | null | undefined, label?: string | null, kind: "entity" | "relation" | "value" = "entity") {
  const parts = formatKgLabelParts(id, label, kind);
  return parts.secondary && parts.secondary !== parts.primary
    ? `${parts.primary} (${parts.secondary})`
    : parts.primary;
}
