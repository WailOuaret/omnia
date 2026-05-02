import type { ReactNode } from "react";

function CaptionCol({ letter, title, children }: { letter: string; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 border-t border-slate-200 bg-white px-3 py-3 first:border-t-0 md:border-t-0 md:border-l md:first:border-l-0">
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-700 text-[13px] font-bold text-white shadow-sm"
        aria-hidden
      >
        {letter}
      </div>
      <div className="min-w-0">
        <div className="text-[13px] font-bold leading-snug text-blue-800">{title}</div>
        <p className="mt-1.5 text-[12px] leading-snug text-slate-600">{children}</p>
      </div>
    </div>
  );
}

export function PaperFigureCaptions() {
  return (
    <footer
      className="border-t border-slate-300 bg-white text-slate-900 shadow-[0_-1px_0_rgba(15,23,42,0.06)]"
      data-testid="paper-figure-captions"
      aria-label="Figure captions"
    >
      <div className="mx-auto grid max-w-[1600px] md:grid-cols-3">
        <CaptionCol letter="A" title="Graph Visualization">
          Interactive view of the knowledge graph. Nodes are entities and edges are relations. Solid edges are original
          or accepted facts; dashed orange edges are candidate missing triples (paper running example: COVID-19 KG).
        </CaptionCol>
        <CaptionCol letter="B" title="Candidate Panel">
          Ranked candidate triples from OMNIA (see CIKM demo: candidate discovery). Search, sort, and select rows to keep
          the graph and explanation panels synchronized.
        </CaptionCol>
        <CaptionCol letter="C" title="Explanation & Validation Panel">
          Embedding scores, TransE filtering, LLM explanation, and evidence — interactive validation as in the OMNIA
          pipeline (Ouaret &amp; Sahri; hybrid structural + semantic reasoning).
        </CaptionCol>
      </div>
    </footer>
  );
}
