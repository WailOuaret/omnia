/**
 * Bottom captioned strip mirroring the teacher's CIKM mockup.
 *
 * Three labeled circles (A / B / C) describe what the audience is looking at
 * in the screenshot, so reviewers can read the figure without needing to use
 * the live system. Pure presentational component — no state.
 */
const ITEMS = [
  {
    label: "A",
    title: "Graph Visualization",
    description:
      "Interactive view of the knowledge graph. Nodes are entities, edges are relations. Green edges are validated, orange dashed edges are candidate triples.",
    tone: "bg-blue-100 text-blue-800",
  },
  {
    label: "B",
    title: "Candidate Panel",
    description:
      "List of candidate triples ranked by the combined score (structural + LLM). Users can sort, search, and select candidates to inspect.",
    tone: "bg-violet-100 text-violet-800",
  },
  {
    label: "C",
    title: "Explanation & Validation Panel",
    description:
      "Details of the selected candidate: scores, LLM verdict, natural language explanation, evidence, and actions to accept or reject the triple.",
    tone: "bg-emerald-100 text-emerald-800",
  },
];

export function DemoFooterCaptions() {
  return (
    <footer
      data-testid="demo-footer-captions"
      className="grid gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm md:grid-cols-3"
      aria-label="Demo figure captions"
    >
      {ITEMS.map((item) => (
        <article key={item.label} className="flex gap-3">
          <span
            aria-hidden
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${item.tone}`}
          >
            {item.label}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">{item.title}</p>
            <p className="mt-1 text-[11px] leading-snug text-slate-600">{item.description}</p>
          </div>
        </article>
      ))}
    </footer>
  );
}
