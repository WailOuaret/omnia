const RAW_ID_PATTERNS = [/^Q\d+$/i, /^P\d+$/i, /^\/[a-z]\/[a-z0-9_]+$/i];

function lastPathSegment(value: string): string {
  const parts = value.split("/").filter(Boolean);
  const last = parts[parts.length - 1] ?? value;
  return last.replace(/_/g, " ");
}

function isSynsetId(value: string): boolean {
  return /^[a-z_]+\.[a-z]\.\d+$/i.test(value);
}

function isFreebaseEntityId(value: string): boolean {
  return /^\/[a-z]\/[a-z0-9_]+$/i.test(value);
}

function isRelationPath(value: string): boolean {
  return value.startsWith("/") && value.includes("/");
}

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

  let readable = trimmedLabel && trimmedLabel !== raw ? trimmedLabel : fallbackRelation;
  if (!readable || readable === raw) {
    if (isFreebaseEntityId(raw)) {
      readable = raw.slice(3);
    } else if (isRelationPath(raw)) {
      readable = lastPathSegment(raw);
    } else if (isSynsetId(raw)) {
      readable = raw;
    }
  }

  const rawId = isRawKgId(raw) || isFreebaseEntityId(raw) || (isRelationPath(raw) && kind === "relation");

  return {
    primary: readable ?? raw,
    secondary: readable && readable !== raw ? raw : raw,
    isRawId: rawId && (!trimmedLabel || trimmedLabel === raw),
    kind,
  };
}

/** Inspector-only hint when no human-readable label exists. */
export function missingLabelHint(): string {
  return "Label unavailable";
}

export function formatKgInline(id: string | null | undefined, label?: string | null, kind: "entity" | "relation" | "value" = "entity") {
  const parts = formatKgLabelParts(id, label, kind);
  if (parts.secondary && parts.secondary !== parts.primary && parts.isRawId) {
    return parts.primary;
  }
  return parts.secondary && parts.secondary !== parts.primary
    ? `${parts.primary} (${parts.secondary})`
    : parts.primary;
}

/** Short relation label for edge rendering; full path stays in tooltip. */
export function truncateRelationLabel(label: string, maxLen = 22): string {
  const trimmed = label.trim();
  if (trimmed.length <= maxLen) return trimmed;
  if (trimmed.startsWith("/") && trimmed.includes("/")) {
    const parts = trimmed.split("/").filter(Boolean);
    const last = parts[parts.length - 1]?.replace(/_/g, " ") ?? trimmed;
    return last.length <= maxLen ? last : `${last.slice(0, maxLen - 1)}…`;
  }
  return `${trimmed.slice(0, maxLen - 1)}…`;
}
