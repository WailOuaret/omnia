import { useState } from "react";
import {
  CLUSTER_HEADS,
  DEMO_RAW_LLM_SNIPPET,
  DEMO_RAW_PROMPT_SNIPPET,
  EVIDENCE_BULLETS,
  LLM_EXPLANATION_BOX,
  MAIN_EXAMPLE_NOTE,
  PAPER_DEMO_FOLLOWUP_QA,
  PROPAGATION_FROM,
  PROPAGATION_TO,
  SOURCE_F1,
  SOURCE_F2,
  SOURCE_F3,
} from "./paperDemoScenario";
import type { PaperDemoCandidate, PaperDemoStep, UserRefinementDecision } from "./paperDemoTypes";

function systemRecommendationLabel(c: PaperDemoCandidate): string {
  if (c.id === "c1") return "accept";
  if (c.status === "accepted") return "accept";
  if (c.status === "rejected") return "reject";
  return "review";
}

function curatorDecisionLabel(isMain: boolean, userDecision: UserRefinementDecision): string {
  if (!isMain) return "—";
  if (userDecision === "accepted") return "accepted";
  if (userDecision === "rejected") return "rejected";
  return "pending";
}

interface PaperExplanationPanelProps {
  candidate: PaperDemoCandidate | undefined;
  activeStep: PaperDemoStep;
  userDecision: UserRefinementDecision;
  onUserDecision: (decision: "accepted" | "rejected") => void;
  comment: string;
  onCommentChange: (value: string) => void;
  onReturnToMain: () => void;
  onResetMainValidation: () => void;
  screenshotMode?: boolean;
}

function SignalMeter({ label, value }: { label: string; value: number }) {
  const pct = Math.round(Math.min(100, Math.max(0, value * 100)));
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-[10px] text-slate-600">
        <span>{label}</span>
        <span className="font-mono font-medium tabular-nums text-slate-800">{pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-slate-700 transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function DetailRow({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div className="flex justify-between gap-2 text-[13px] leading-snug">
      <span className="text-slate-600">{label}</span>
      <span
        className={`text-right font-medium tabular-nums ${emphasize ? "text-emerald-700" : "text-slate-900"}`}
      >
        {value}
      </span>
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
}: PaperExplanationPanelProps) {
  const isMain = candidate?.id === "c1";
  const [openFollowupId, setOpenFollowupId] = useState<string | null>(null);

  return (
    <aside
      id="paper-demo-explanation-section"
      className="flex min-h-0 min-w-0 flex-col bg-white"
      aria-labelledby="paper-explanation-heading"
      data-testid="paper-explanation-panel"
    >
      <div className="shrink-0 border-b border-slate-200 px-3 py-2">
        <h2 id="paper-explanation-heading" className="text-[15px] font-semibold tracking-tight text-slate-900">
          Explanation &amp; Validation
        </h2>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
        {!candidate ? (
          <p className="text-[13px] text-slate-600">Select a candidate from the list.</p>
        ) : (
          <>
            <section aria-labelledby="sec-selected">
              <h3 id="sec-selected" className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                Selected Candidate
              </h3>
              <p
                className="mt-1 text-[14px] font-semibold leading-snug text-slate-900"
                data-testid="paper-explanation-triple"
              >
                {candidate.head} <span className="text-blue-800">{candidate.relation}</span> → {candidate.tail}
              </p>
            </section>

            {!isMain ? (
              <div
                className="mt-3 border border-amber-300/80 bg-amber-50/60 px-2.5 py-2"
                data-testid="paper-main-example-banner"
              >
                <p className="text-[12px] leading-snug text-amber-950">{MAIN_EXAMPLE_NOTE}</p>
                <button
                  type="button"
                  onClick={onReturnToMain}
                  className="mt-2 rounded-md border border-amber-700/40 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-amber-950 hover:bg-amber-50"
                  data-testid="paper-return-main-example"
                >
                  Return to main OMNIA example
                </button>
              </div>
            ) : null}

            <section className="mt-4 border-t border-slate-200 pt-3" aria-labelledby="sec-signals">
              <h3 id="sec-signals" className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                Structural vs semantic signal
              </h3>
              <div className="mt-2 space-y-2 border border-slate-200 bg-white p-2">
                <SignalMeter label="Structural (embedding ranker)" value={candidate.structuralScore} />
                <SignalMeter label="LLM validation score" value={candidate.llmScore} />
                <p className="text-[10px] leading-snug text-slate-500">
                  OMNIA combines both; the curator can override either in the human-in-the-loop step.
                </p>
              </div>
            </section>

            <section className="mt-4 border-t border-slate-200 pt-3" aria-labelledby="sec-scores">
              <h3 id="sec-scores" className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                Candidate Scores
              </h3>
              <div className="mt-2 space-y-1 border border-slate-200 bg-slate-50/50 p-2">
                <DetailRow emphasize label="Structural Score:" value={candidate.structuralScore.toFixed(2)} />
                <DetailRow label="TransE Distance:" value={candidate.transeDistance.toFixed(2)} />
                <DetailRow label="Threshold tau:" value={candidate.threshold.toFixed(2)} />
                <DetailRow emphasize label="LLM Score:" value={candidate.llmScore.toFixed(2)} />
                <DetailRow emphasize label="Combined Score:" value={candidate.combinedScore.toFixed(2)} />
                <DetailRow emphasize label="LLM verdict:" value={candidate.llmVerdict} />
                <DetailRow
                  emphasize={isMain}
                  label="System recommendation:"
                  value={systemRecommendationLabel(candidate)}
                />
                <DetailRow
                  emphasize={isMain && userDecision === "accepted"}
                  label="Curator decision:"
                  value={curatorDecisionLabel(isMain, userDecision)}
                />
                <DetailRow label="Relation Type:" value={candidate.relationType} />
                <DetailRow label="Subject Type:" value={candidate.subjectType} />
                <DetailRow label="Object Type:" value={candidate.objectType} />
              </div>
            </section>

            {isMain ? (
              <>
                <section className="mt-4 border-t border-slate-200 pt-3" aria-labelledby="sec-why">
                  <h3 id="sec-why" className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                    Why OMNIA generated it
                  </h3>
                  <div className="mt-2 space-y-1.5 text-[13px] leading-relaxed text-slate-800">
                    <p>
                      <span className="font-medium text-slate-900">Shared key:</span> (inhibits, 2019-ncov)
                    </p>
                    <p>
                      <span className="font-medium text-slate-900">Cluster heads:</span> {CLUSTER_HEADS.join(", ")}
                    </p>
                    <p>
                      <span className="font-medium text-slate-900">Propagation</span>
                      <br />
                      <span className="font-mono text-[12px] text-slate-700">from {PROPAGATION_FROM}</span>
                      <br />
                      <span className="font-mono text-[12px] text-slate-700">to {PROPAGATION_TO}</span>
                    </p>
                  </div>
                </section>

                <section className="mt-4 border-t border-slate-200 pt-3" aria-labelledby="sec-llm">
                  <h3 id="sec-llm" className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                    LLM Explanation
                  </h3>
                  <div className="relative mt-2 border border-emerald-800/20 bg-emerald-50/50 p-2.5 pr-[7.5rem] text-[13px] leading-relaxed text-emerald-950">
                    <span
                      className="absolute right-2 top-2 max-w-[6.75rem] truncate rounded-full border border-emerald-600/35 bg-white px-2 py-0.5 text-center text-[11px] font-semibold leading-tight text-emerald-800"
                      title={candidate.llmVerdict}
                    >
                      {candidate.llmVerdict}
                    </span>
                    {LLM_EXPLANATION_BOX}
                  </div>
                  {activeStep === "llm" ? (
                    <p className="mt-2 text-[13px] leading-snug text-slate-800">
                      <span className="font-medium text-slate-900">LLM/RAG</span> validates candidate{" "}
                      <span className="font-mono text-[12px]">c1</span> (missing triple t4) using retrieved KG context;
                      parsed LLM score matches the panel above.
                    </p>
                  ) : null}
                </section>

                <section className="mt-4 border-t border-slate-200 pt-3" aria-labelledby="sec-evidence">
                  <h3 id="sec-evidence" className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                    Supporting Evidence
                  </h3>
                  <ul className="mt-2 list-inside list-disc space-y-1 text-[13px] text-slate-800">
                    {EVIDENCE_BULLETS.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </section>

                <details className="mt-4 border border-slate-200 bg-white">
                  <summary className="cursor-pointer select-none px-2 py-2 text-[12px] font-semibold text-slate-800">
                    Source statements (f1–f3)
                  </summary>
                  <ul className="space-y-2 border-t border-slate-100 px-2 py-2 text-[12px] italic leading-snug text-slate-600">
                    <li>f1 = “{SOURCE_F1}”</li>
                    <li>f2 = “{SOURCE_F2}”</li>
                    <li>f3 = “{SOURCE_F3}”</li>
                  </ul>
                </details>

                <details className="mt-2 border border-slate-200 bg-white">
                  <summary className="cursor-pointer select-none px-2 py-2 text-[12px] font-semibold text-slate-800">
                    Raw prompt
                  </summary>
                  <pre className="whitespace-pre-wrap border-t border-slate-100 px-2 py-2 font-mono text-[11px] leading-snug text-slate-700">
                    {DEMO_RAW_PROMPT_SNIPPET}
                  </pre>
                </details>

                <details className="mt-2 border border-slate-200 bg-white">
                  <summary className="cursor-pointer select-none px-2 py-2 text-[12px] font-semibold text-slate-800">
                    Raw LLM response
                  </summary>
                  <pre className="whitespace-pre-wrap border-t border-slate-100 px-2 py-2 font-mono text-[11px] leading-snug text-slate-700">
                    {DEMO_RAW_LLM_SNIPPET}
                  </pre>
                </details>

                {(activeStep === "llm" || activeStep === "filtering" || activeStep === "after") && !screenshotMode ? (
                  <section className="mt-4 border-t border-slate-200 pt-3" aria-labelledby="sec-followup">
                    <h3 id="sec-followup" className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                      Follow-up exploration (offline)
                    </h3>
                    <p className="mt-1 text-[11px] leading-snug text-slate-500">
                      Tap a question to reveal a curator-focused answer — extends validation beyond accept/reject.
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {PAPER_DEMO_FOLLOWUP_QA.map((item) => {
                        const open = openFollowupId === item.id;
                        return (
                          <li key={item.id} className="overflow-hidden rounded-md border border-slate-200 bg-slate-50/80">
                            <button
                              type="button"
                              className="flex w-full items-start justify-between gap-2 px-2 py-2 text-left text-[12px] font-medium text-slate-900 hover:bg-slate-100"
                              aria-expanded={open}
                              onClick={() => setOpenFollowupId(open ? null : item.id)}
                            >
                              <span>{item.question}</span>
                              <span className="shrink-0 tabular-nums text-slate-400">{open ? "−" : "+"}</span>
                            </button>
                            {open ? (
                              <p className="border-t border-slate-200 bg-white px-2 py-2 text-[12px] leading-relaxed text-slate-700">
                                {item.answer}
                              </p>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ) : null}
              </>
            ) : (
              <p className="mt-3 text-[12px] leading-relaxed text-slate-600">
                Narration for each pipeline stage in the graph refers to the main example candidate c1; scores above are
                for the row you selected.
              </p>
            )}

            <section className="mt-4 border-t border-slate-200 pt-3" aria-labelledby="sec-decision">
              <h3 id="sec-decision" className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                Your Decision
              </h3>
              {!isMain ? (
                <p className="mt-2 text-[12px] leading-snug text-slate-700">
                  Validation actions are available for the main COVID running example only.
                </p>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  data-testid="paper-accept-btn"
                  disabled={!isMain}
                  onClick={() => {
                    if (!isMain) return;
                    onUserDecision("accepted");
                  }}
                  className="rounded-md bg-emerald-700 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Accept
                </button>
                <button
                  type="button"
                  data-testid="paper-reject-btn"
                  disabled={!isMain}
                  onClick={() => {
                    if (!isMain) return;
                    onUserDecision("rejected");
                  }}
                  className="rounded-md bg-red-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Reject
                </button>
              </div>
              {userDecision === "accepted" ? (
                <p
                  className="mt-2 text-[12px] leading-snug text-emerald-900"
                  data-testid="paper-accept-confirmation"
                >
                  Accepted: t4 has been integrated into the completed KG.
                </p>
              ) : null}
              {userDecision === "rejected" ? (
                <p className="mt-2 text-[12px] leading-snug text-slate-700" data-testid="paper-reject-confirmation">
                  Rejected: this candidate will not be integrated into the completed KG.
                </p>
              ) : null}
              {!screenshotMode ? (
                <>
                  <label className="mt-2 block text-[11px] text-slate-600" htmlFor="paper-user-comment">
                    Comment (optional)
                  </label>
                  <textarea
                    id="paper-user-comment"
                    value={comment}
                    onChange={(e) => onCommentChange(e.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[12px] text-slate-800"
                    placeholder="Add a note for your decision…"
                  />
                </>
              ) : null}
              {isMain && userDecision !== null && !screenshotMode ? (
                <button
                  type="button"
                  onClick={onResetMainValidation}
                  className="mt-3 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-[12px] font-semibold text-slate-800 hover:bg-slate-50"
                  data-testid="paper-reset-validation-btn"
                >
                  Reset decision &amp; return to LLM stage
                </button>
              ) : null}
            </section>

            {!screenshotMode ? (
              <section className="mt-4 border-t border-slate-200 pt-3" aria-labelledby="sec-actions">
                <h3 id="sec-actions" className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  Live system
                </h3>
                <p className="mt-1 text-[11px] leading-snug text-slate-600">
                  For interactive LLM queries on benchmark sessions, open the full workbench (rail icon or{" "}
                  <span className="font-medium text-slate-800">/demo</span>).
                </p>
              </section>
            ) : null}
          </>
        )}
      </div>
    </aside>
  );
}
