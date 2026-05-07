export function PaperFigureCaptions() {
  return (
    <div className="border-t border-slate-200 bg-white px-4 py-3 text-[11px] text-slate-500" data-testid="paper-figure-captions">
      <p>
        <strong>Fig. 1.1</strong> — Example of a missing triple in an LLM-generated KG.
      </p>
      <p>
        <strong>Fig. 1.2</strong> — Clustering-based candidate generation: remdesivir and chloroquine co-cluster on (inhibits, 2019-ncov).
      </p>
      <p>
        <strong>Fig. 1.3</strong> — OMNIA pipeline overview: clustering → embedding filter → LLM validation → completed KG.
      </p>
    </div>
  );
}
