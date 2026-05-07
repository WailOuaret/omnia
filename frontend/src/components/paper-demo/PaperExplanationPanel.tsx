import { useEffect, useMemo, useState } from "react";
import { CANDIDATE_GENERATION_MATRIX, F1_RESULTS, formatFilterDecision, LLM_STRATEGIES, ORIGINAL_TRIPLES, RAG_OPTIMAL_TOPK, SOURCE_FACTS } from "./paperDemoScenario";
import { PaperStepDetailPanel } from "./PaperStepDetailPanel";
import type {
  PaperDemoCandidate,
  PaperDemoStep,
  UserRefinementDecision,
  ValidationStage,
} from "./paperDemoTypes";

interface PaperExplanationPanelProps {
  candidate: PaperDemoCandidate | undefined;
  activeStep: PaperDemoStep;
  userDecision: UserRefinementDecision;
  onUserDecision: (decision: "accepted" | "rejected" | "uncertain") => void;
  comment: string;
  onCommentChange: (value: string) => void;
  onReturnToMain: () => void;
  onResetMainValidation: () => void;
  screenshotMode?: boolean;
  onHighlightEdge?: (edgeId: string | null) => void;
  onHighlightNode?: (nodeLabel: string | null) => void;
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const color = value >= 0.7 ? "#16a34a" : value >= 0.4 ? "#d97706" : "#dc2626";
  return (
    <div>
      <div className="flex justify-between text-[12px]">
        <span>{label}</span>
        <span className="font-mono">{value.toFixed(2)}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-200">
        <div
          className="h-2 rounded-full transition-all duration-500"
          style={{ width: `${value * 100}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function TransEBar({ distance, threshold }: { distance: number; threshold: number }) {
  const max = 1.5;
  const distPct = Math.min(distance / max, 1) * 100;
  const threshPct = Math.min(threshold / max, 1) * 100;
  return (
    <div className="relative h-2 w-full rounded-full bg-slate-200">
      <div className="absolute h-2 rounded-full bg-blue-500" style={{ width: `${distPct}%` }} />
      <div
        className="absolute top-[-4px] h-4 w-0.5 bg-red-500"
        style={{ left: `${threshPct}%` }}
        title={`Threshold tau = ${threshold}`}
      />
    </div>
  );
}

export function PaperExplanationPanel({
  candidate,
  activeStep,
  userDecision,
  onUserDecision,
  comment,
  onCommentChange,
  onReturnToMain,
  onResetMainValidation,
  screenshotMode,
  onHighlightEdge,
  onHighlightNode,
}: PaperExplanationPanelProps) {
  const [validationStage, setValidationStage] = useState<ValidationStage>("structural");
  const [selectedStrategy, setSelectedStrategy] = useState<"zero-shot" | "in-context" | "RAG">("RAG");
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [strategyCompareOpen, setStrategyCompareOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [semanticOpened, setSemanticOpened] = useState(false);
  const [judgement, setJudgement] = useState<"supports" | "contradicts" | "not_enough" | null>(null);
  const [qualityCheck, setQualityCheck] = useState("");
  const [structuralVisited, setStructuralVisited] = useState(false);
  const [correctionDraft, setCorrectionDraft] = useState({ head: "", relation: "", tail: "", note: "" });

  const canShowSemantic = activeStep === "llm" || activeStep === "human" || activeStep === "after";
  const canShowDecision = activeStep === "llm" || activeStep === "human" || activeStep === "after";
  const transEPassed = candidate ? candidate.transEDistance < candidate.transEThreshold : false;
  const needsCorrection = ["Incorrect relation", "Incorrect head entity", "Incorrect tail entity", "Incorrect whole triple"].includes(qualityCheck);
  const correctionCompleteIfRequired = !needsCorrection || Boolean(correctionDraft.head || correctionDraft.relation || correctionDraft.tail || correctionDraft.note);
  const canDecide = Boolean(judgement && qualityCheck && semanticOpened && structuralVisited && correctionCompleteIfRequired);
  const strategyData = candidate?.llmByStrategy ?? (candidate ? LLM_STRATEGIES[candidate.id as keyof typeof LLM_STRATEGIES] : undefined);
  const selectedStrategyData = strategyData?.[selectedStrategy] as
    | { verdict: "TRUE" | "FALSE" | "UNCERTAIN"; confidence: number; context: readonly string[]; explanation?: string }
    | undefined;

  const stageLabel = useMemo(() => {
    if (validationStage === "structural") return 1;
    if (validationStage === "semantic") return 2;
    return 3;
  }, [validationStage]);

  async function handleDecision(decision: "accepted" | "rejected" | "uncertain") {
    setIsSubmitting(true);
    await new Promise((r) => setTimeout(r, 700));
    setIsSubmitting(false);
    setValidationStage("summary");
    onUserDecision(decision);
  }

  useEffect(() => {
    setValidationStage("structural");
    setSelectedStrategy("RAG");
    setPromptExpanded(false);
    setStrategyCompareOpen(false);
    setSemanticOpened(false);
    setJudgement(null);
    setQualityCheck("");
    setStructuralVisited(false);
    setCorrectionDraft({ head: "", relation: "", tail: "", note: "" });
  }, [candidate?.id]);

  useEffect(() => {
    if (activeStep === "llm" && validationStage === "structural") {
      setValidationStage("semantic");
      setSemanticOpened(true);
      // Deep-linking directly to LLM stage should still count as having shown
      // structural evidence, otherwise curator decision remains blocked.
      setStructuralVisited(true);
    }
    if (activeStep === "human") {
      setValidationStage("decision");
    }
  }, [activeStep, validationStage]);

  return (
    <aside
      id="paper-demo-explanation-section"
      className="flex min-h-0 min-w-0 flex-col bg-white"
      aria-labelledby="paper-explanation-heading"
      data-testid="paper-explanation-panel"
    >
      <div className="shrink-0 border-b border-slate-200 px-3 py-2">
        <h2 id="paper-explanation-heading" className="text-[15px] font-semibold tracking-tight text-slate-900">
          Curator review
        </h2>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
        {!candidate ? (
          <p className="text-[13px] text-slate-600">Select a candidate from the list.</p>
        ) : (
          <>
            <PaperStepDetailPanel step={activeStep} candidate={candidate} />
            <section className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[15px] font-semibold text-slate-900" data-testid="paper-explanation-triple">
                  {candidate.head} <span className="text-blue-700">→ {candidate.relation} →</span> {candidate.tail}
                </p>
                <span
                  className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                    userDecision === "accepted"
                      ? "bg-emerald-100 text-emerald-700"
                      : userDecision === "rejected"
                        ? "bg-red-100 text-red-700"
                        : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {userDecision ?? "pending"}
                </span>
              </div>
            </section>

            <section className="mt-3">
              <div className="flex items-center gap-2 text-[12px]">
                <span className={stageLabel >= 1 ? "font-semibold text-blue-700" : "text-slate-400"}>1 Structural</span>
                <span className="text-slate-400">→</span>
                <span className={stageLabel >= 2 ? "font-semibold text-blue-700" : "text-slate-400"}>2 Semantic</span>
                <span className="text-slate-400">→</span>
                <span className={stageLabel >= 3 ? "font-semibold text-blue-700" : "text-slate-400"}>3 Your Decision</span>
              </div>
            </section>

            {(activeStep === "cluster" || activeStep === "generation" || activeStep === "filtering" || activeStep === "llm" || activeStep === "human" || activeStep === "after") ? (
              <section className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <h3 className="text-[13px] font-semibold">Structural Evidence</h3>
                <div className="mt-2">
                  <ScoreBar label="Structural score" value={candidate.structuralScore} />
                </div>
                <div className="mt-3 space-y-1">
                  <span className="text-[12px]">TransE distance: {candidate.transEDistance.toFixed(2)}</span>
                  <TransEBar distance={candidate.transEDistance} threshold={candidate.transEThreshold} />
                  <span className={transEPassed ? "text-[12px] text-emerald-700" : "text-[12px] text-red-700"}>{formatFilterDecision(candidate)}</span>
                </div>
                <button
                  onClick={() => onHighlightEdge?.("t2")}
                  className="mt-2 rounded bg-blue-100 px-2 py-1 text-[12px] text-blue-800"
                >
                  Cluster key: {candidate.clusterKey}
                </button>
                <div className="mt-2 flex flex-wrap gap-2">
                  {candidate.clusterHeads.map((head) => (
                    <button
                      key={head}
                      onMouseEnter={() => onHighlightNode?.(head)}
                      onMouseLeave={() => onHighlightNode?.(null)}
                      className="rounded border border-slate-300 px-2 py-0.5 text-[12px]"
                    >
                      {head}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => {
                    setValidationStage("semantic");
                    setSemanticOpened(true);
                    setStructuralVisited(true);
                  }}
                  className="mt-3 rounded bg-slate-900 px-3 py-1.5 text-[12px] font-semibold text-white"
                >
                  ▶ Proceed to Semantic Validation
                </button>
              </section>
            ) : null}

            {activeStep === "generation" ? (
              <section className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                <h3 className="text-[12px] font-semibold tracking-wide text-slate-900">Candidate-generation matrix</h3>
                <p className="mt-1 text-[11px] text-slate-500">Head entities combined with relation-tail pairs to form candidate triples.</p>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[460px] table-fixed text-[11px] text-slate-700 sm:text-[12px]">
                    <colgroup>
                      <col className="w-[28%]" />
                      <col className="w-[30%]" />
                      <col className="w-[42%]" />
                    </colgroup>
                    <thead>
                      <tr className="border-y border-slate-200 bg-slate-50 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-[11px]">
                        <th className="px-2 py-2">Head</th>
                        <th className="px-2 py-2">Relation-tail pair</th>
                        <th className="px-2 py-2">Generated candidate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {CANDIDATE_GENERATION_MATRIX.map((r) => (
                        <tr key={r.id} className="align-top">
                          <td className="px-2 py-2.5 font-medium text-slate-800">
                            <span className="block truncate" title={r.head}>{r.head}</span>
                          </td>
                          <td className="px-2 py-2.5">
                            <span className="block truncate text-slate-700" title={r.pair}>{r.pair}</span>
                          </td>
                          <td className="px-2 py-2.5">
                            <button
                              className="block w-full truncate text-left font-medium text-blue-700 underline decoration-blue-300 underline-offset-2 hover:text-blue-800"
                              onMouseEnter={() => onHighlightEdge?.(r.id)}
                              onMouseLeave={() => onHighlightEdge?.(null)}
                              title={r.generated}
                            >
                              {r.generated}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}

            {canShowSemantic && validationStage !== "structural" ? (
              <section className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                <h3 className="text-[13px] font-semibold">LLM Semantic Validation</h3>
                <div className="mt-2 flex gap-1 border-b border-slate-200 pb-2">
                  {(["zero-shot", "in-context", "RAG"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setSelectedStrategy(s)}
                      className={`rounded px-2 py-1 text-[12px] ${selectedStrategy === s ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}
                    >
                      {s}{" "}
                      {s === "RAG" ? (
                        <span className="ml-1 rounded bg-emerald-100 px-1 text-[10px] text-emerald-700">★ Best</span>
                      ) : null}
                    </button>
                  ))}
                </div>
                {selectedStrategy === "RAG" ? (
                  <div className="mt-2">
                    <div className="text-[12px] font-semibold text-slate-700">RAG evidence bundle</div>
                    <div className="text-[11px] text-slate-600">Selected retrieval setting: top-k = {candidate.ragTopK}. Context changes by candidate and strategy.</div>
                    <div className="mt-1 rounded border border-slate-200 p-2">
                      {(strategyData?.RAG.context ?? candidate.ragContext.map((t) => t.id)).map((ctxId: string) => {
                        const t = candidate.ragContext.find((x) => x.id === ctxId);
                        if (!t) {
                          const triple = ORIGINAL_TRIPLES.find((ot) => ot.id === ctxId);
                          return (
                            <button key={ctxId} onClick={() => onHighlightEdge?.(ctxId)} className="mb-1 flex w-full items-center gap-2 rounded px-1 py-1 text-left text-[12px] hover:bg-slate-50">
                              <span className="font-mono text-[11px] text-slate-500">{ctxId}</span>
                              <span>
                                {triple
                                  ? `${triple.head} → ${triple.relation} → ${triple.tail}`
                                  : SOURCE_FACTS[ctxId as keyof typeof SOURCE_FACTS] ?? SOURCE_FACTS.f2}
                              </span>
                            </button>
                          );
                        }
                        return (
                        <button
                          key={t.id}
                          onClick={() => onHighlightEdge?.(t.id)}
                          onMouseLeave={() => onHighlightEdge?.(null)}
                          className="mb-1 flex w-full items-center gap-2 rounded px-1 py-1 text-left text-[12px] hover:bg-slate-50"
                        >
                          <span className="font-mono text-[11px] text-slate-500">{t.id}</span>
                          <span>{t.head}</span>
                          <span className="text-blue-700">→ {t.relation} →</span>
                          <span>{t.tail}</span>
                        </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 rounded border border-slate-200 bg-slate-50 p-2 text-[12px] text-slate-700">
                    {selectedStrategy === "zero-shot"
                      ? "Zero-shot: candidate only, no retrieval context."
                      : "In-context: show similar triples sharing head/relation/tail patterns (t1, t2, t3)."}
                  </div>
                )}
                <div
                  className={`mt-2 inline-flex rounded px-2 py-1 text-[12px] font-semibold ${
                    (strategyData?.[selectedStrategy].verdict ?? candidate.llmVerdict) === "TRUE" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                  }`}
                >
                  {(selectedStrategyData?.verdict ?? candidate.llmVerdict) === "TRUE" ? "✓" : "✗"} {selectedStrategyData?.verdict ?? candidate.llmVerdict}
                  <span className="ml-2 opacity-80">confidence: {(((selectedStrategyData?.confidence) ?? candidate.llmConfidence) * 100).toFixed(0)}%</span>
                </div>
                {selectedStrategyData?.explanation ? (
                  <p className="mt-2 text-[12px] text-slate-700">{selectedStrategyData.explanation}</p>
                ) : null}
                <div className="mt-2 rounded border-l-4 border-blue-300 bg-blue-50 px-3 py-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-blue-600">Sentence-based input</div>
                  <div className="mt-1 text-[13px] italic text-slate-800">"{candidate.sentenceText}"</div>
                  <div className="mt-1 text-[11px] text-slate-500">Explicit prompt template · 100% correct transformations on the 500-candidate CoDEx-M check</div>
                  <div className="mt-1 text-[11px] text-emerald-700">
                    Optimal RAG top-k range {RAG_OPTIMAL_TOPK.min}-{RAG_OPTIMAL_TOPK.max} (peak at {RAG_OPTIMAL_TOPK.best})
                  </div>
                </div>
                {candidate.rawPrompt ? (
                  <div className="mt-2">
                    <button
                      onClick={() => setPromptExpanded((v) => !v)}
                      className="text-[12px] text-slate-600"
                    >
                      ▾ View raw prompt
                    </button>
                    {promptExpanded ? (
                      <pre className="mt-1 whitespace-pre-wrap rounded bg-slate-900 p-2 text-[11px] text-emerald-300">
                        {candidate.rawPrompt}
                      </pre>
                    ) : null}
                  </div>
                ) : null}
                <button
                  onClick={() => setStrategyCompareOpen((v) => !v)}
                  className="mt-2 text-[12px] text-blue-600 underline"
                >
                  Compare headline F1s (Table IV) →
                </button>
                {strategyCompareOpen ? (
                  <div className="mt-2 rounded border border-slate-200 bg-slate-50 p-2 text-[12px]">
                    <div>FB15K-237: OMNIA {F1_RESULTS.fb15k237.omnia} vs {F1_RESULTS.fb15k237.baselineName} {F1_RESULTS.fb15k237.baseline}</div>
                    <div>CoDEx-M: OMNIA {F1_RESULTS.codexM.omnia} vs {F1_RESULTS.codexM.baselineName} {F1_RESULTS.codexM.baseline}</div>
                    <div>WN18RR: OMNIA {F1_RESULTS.wn18rr.omnia} vs {F1_RESULTS.wn18rr.baselineName} {F1_RESULTS.wn18rr.baseline}</div>
                  </div>
                ) : null}
                <div className="mt-2">
                  <div className="text-[12px] font-semibold text-slate-700">Evidence judgement</div>
                  <div className="mt-1 flex gap-2">
                    <button onClick={() => setJudgement("supports")} className={`rounded border px-2 py-1 text-[12px] ${judgement === "supports" ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-slate-300"}`}>Supports</button>
                    <button onClick={() => setJudgement("contradicts")} className={`rounded border px-2 py-1 text-[12px] ${judgement === "contradicts" ? "border-red-600 bg-red-50 text-red-700" : "border-slate-300"}`}>Contradicts</button>
                    <button onClick={() => setJudgement("not_enough")} className={`rounded border px-2 py-1 text-[12px] ${judgement === "not_enough" ? "border-amber-600 bg-amber-50 text-amber-700" : "border-slate-300"}`}>Not enough evidence</button>
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-[12px] font-semibold text-slate-700">Human Quality Check</div>
                  <div className="mt-1 grid grid-cols-1 gap-1 text-[12px]">
                    {[
                      "Correct triple",
                      "Incorrect relation",
                      "Incorrect head entity",
                      "Incorrect tail entity",
                      "Incorrect whole triple",
                      "Missing but supported by source",
                      "Missing entity / incomplete extraction",
                      "Not enough evidence",
                    ].map((label) => (
                      <label key={label} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`quality-check-${candidate.id}`}
                          checked={qualityCheck === label}
                          onChange={() => setQualityCheck(label)}
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                {needsCorrection ? (
                  <div className="mt-2 grid grid-cols-1 gap-2 text-[12px]">
                    <input value={correctionDraft.head} onChange={(e) => setCorrectionDraft((v) => ({ ...v, head: e.target.value }))} placeholder="Corrected head" className="rounded border border-slate-300 px-2 py-1" />
                    <input value={correctionDraft.relation} onChange={(e) => setCorrectionDraft((v) => ({ ...v, relation: e.target.value }))} placeholder="Corrected relation" className="rounded border border-slate-300 px-2 py-1" />
                    <input value={correctionDraft.tail} onChange={(e) => setCorrectionDraft((v) => ({ ...v, tail: e.target.value }))} placeholder="Corrected tail" className="rounded border border-slate-300 px-2 py-1" />
                    <textarea value={correctionDraft.note} onChange={(e) => setCorrectionDraft((v) => ({ ...v, note: e.target.value }))} placeholder="Correction note" rows={2} className="rounded border border-slate-300 px-2 py-1" />
                  </div>
                ) : null}
                <button
                  onClick={() => setValidationStage("decision")}
                  disabled={!semanticOpened || !qualityCheck || !judgement || !correctionCompleteIfRequired}
                  className="mt-3 rounded bg-slate-900 px-3 py-1.5 text-[12px] font-semibold text-white"
                >
                  ▶ Proceed to Your Decision
                </button>
                <div className="mt-2 rounded border border-slate-200 bg-slate-50 p-2 text-[11px]">
                  <div className="mb-1 font-semibold text-slate-700">Required before decision</div>
                  <div className="space-y-0.5 text-slate-600">
                    <div>{structuralVisited ? "✓" : "○"} Structural evidence inspected</div>
                    <div>{semanticOpened ? "✓" : "○"} Semantic/RAG evidence inspected</div>
                    <div>{judgement ? "✓" : "○"} Evidence judgement selected</div>
                    <div>{qualityCheck ? "✓" : "○"} Quality category selected</div>
                    <div>{needsCorrection ? (correctionCompleteIfRequired ? "✓ Correction provided if needed" : "○ Correction provided if needed") : "✓ Correction not required for this category"}</div>
                  </div>
                </div>
              </section>
            ) : null}

            {canShowDecision && validationStage === "decision" ? (
              <section className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                <h3 className="font-semibold">Your validation decision</h3>
                <div className="mt-1 flex gap-4 text-[12px]">
                  <span>
                    Structural: <strong>{(candidate.structuralScore * 100).toFixed(0)}%</strong>
                  </span>
                  <span>
                    LLM: <strong className="text-emerald-700">{candidate.llmVerdict}</strong>
                  </span>
                </div>
                {!screenshotMode ? (
                  <>
                    <label htmlFor="curator-note" className="mt-2 block text-[12px] text-slate-600">
                      Optional note:
                    </label>
                    <textarea
                      id="curator-note"
                      value={comment}
                      onChange={(e) => onCommentChange(e.target.value)}
                      placeholder="Add a reason or comment..."
                      rows={2}
                      className="w-full rounded border border-slate-300 px-2 py-1.5 text-[13px]"
                    />
                  </>
                ) : null}
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => void handleDecision("accepted")}
                    disabled={isSubmitting || !canDecide}
                    className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-emerald-700"
                  >
                    {isSubmitting ? "..." : "✓ Accept triple"}
                  </button>
                  <button
                    onClick={() => void handleDecision("rejected")}
                    disabled={isSubmitting || !canDecide}
                    className="flex-1 rounded-lg border border-red-300 bg-white px-4 py-2.5 text-[13px] font-semibold text-red-700 hover:bg-red-50"
                  >
                    ✗ Reject triple
                  </button>
                  <button
                    onClick={() => void handleDecision("uncertain")}
                    disabled={isSubmitting || !canDecide}
                    className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    ? Mark uncertain
                  </button>
                </div>
              </section>
            ) : null}

            {(validationStage === "summary" || (activeStep === "after" && userDecision !== null)) ? (
              <section className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="font-semibold text-slate-900">Pipeline summary for {candidate.id}</div>
                <table className="mt-2 w-full text-[12px]">
                  <tbody>
                    <tr>
                      <td className="pr-3 text-slate-500">Candidate</td>
                      <td>{candidate.head} → {candidate.relation} → {candidate.tail}</td>
                    </tr>
                    <tr>
                      <td className="pr-3 text-slate-500">Cluster</td>
                      <td>{candidate.clusterKey} ({candidate.clusterHeads.length} heads)</td>
                    </tr>
                    <tr>
                      <td className="pr-3 text-slate-500">TransE</td>
                      <td>
                        distance {candidate.transEDistance} {transEPassed ? "<" : ">"} tau {candidate.transEThreshold} →{" "}
                        {transEPassed ? "PASSED" : "FILTERED OUT"}
                      </td>
                    </tr>
                    <tr>
                      <td className="pr-3 text-slate-500">LLM/RAG</td>
                      <td>
                        {candidate.llmVerdict} (confidence {(candidate.llmConfidence * 100).toFixed(0)}%, top-k={candidate.ragTopK})
                      </td>
                    </tr>
                    <tr>
                      <td className="pr-3 text-slate-500">Decision</td>
                      <td className={userDecision === "accepted" ? "font-bold text-emerald-700" : userDecision === "rejected" ? "font-bold text-red-700" : "font-bold text-slate-700"}>
                        {userDecision === "accepted" ? "✓ ACCEPTED" : userDecision === "rejected" ? "✗ REJECTED" : "? UNCERTAIN"}
                      </td>
                    </tr>
                    <tr>
                      <td className="pr-3 text-slate-500">Decision log</td>
                      <td>{userDecision === "accepted" ? "KG updated, +1 triple." : "KG unchanged, +0 triples."}</td>
                    </tr>
                  </tbody>
                </table>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => document.getElementById("paper-demo-graph-section")?.scrollIntoView({ behavior: "smooth" })}
                    className="rounded border border-slate-300 bg-white px-2 py-1 text-[12px]"
                  >
                    View in graph
                  </button>
                  <button onClick={onReturnToMain} className="rounded border border-slate-300 bg-white px-2 py-1 text-[12px]">
                    Next candidate →
                  </button>
                  <button onClick={onResetMainValidation} className="rounded border border-slate-300 bg-white px-2 py-1 text-[12px]">
                    ↺ Reset
                  </button>
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>
    </aside>
  );
}
