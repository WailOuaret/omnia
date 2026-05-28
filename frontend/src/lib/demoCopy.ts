/** Plain-language copy normalizers for the paper demo (no internal pipeline jargon). */

export function normalizeDemoCopy(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;

  if (/already present in the known graph/i.test(trimmed)) {
    return "This triple already exists in the original knowledge graph.";
  }

  if (/relation-tail propagation path/i.test(trimmed)) {
    return "This triple already exists in the original knowledge graph.";
  }

  if (/relation-tail pair appears in the same cluster context/i.test(trimmed)) {
    return "Proposed because similar entities in this group share the same relation → tail pattern.";
  }

  if (/share P\d+ ->/i.test(trimmed) || /share.*relation-tail/i.test(trimmed)) {
    return "Proposed because other entities in this cluster share the same relation → tail pattern.";
  }

  return trimmed;
}

export function filteringUnavailableMessage(prepared = true): string {
  return prepared
    ? "Structural filtering scores are not shown in this prepared scenario."
    : "Structural filtering scores are not shown in this online sample.";
}

export function llmUnavailableMessage(prepared = true): string {
  return prepared
    ? "LLM validation results are not shown in this prepared scenario."
    : "LLM/RAG evidence is not included in this online sample yet.";
}

export function formatInspectorValue(
  value: string | number | null | undefined,
  emptyLabel = "Not yet evaluated",
): string {
  if (value === null || value === undefined) return emptyLabel;
  const text = String(value).trim();
  if (!text || text.toLowerCase() === "n/a") return emptyLabel;
  return text;
}
