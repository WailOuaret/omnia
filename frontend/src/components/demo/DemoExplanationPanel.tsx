import { useEffect, useState, type ReactNode } from "react";
import clsx from "clsx";
import { ArrowRight, MessageSquare } from "lucide-react";
import type { CandidateRecord } from "../../types";
import {
  combinedScore,
  llmScore,
  llmVerdict,
  structuralScore,
  type LlmVerdict,
} from "./demoScoring";

function CardSection({
  label,
  children,
  testId,
}: {
  label: string;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <section
      data-testid={testId}
      className="rounded-xl border border-slate-100 bg-white p-3 shadow-inner"
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function fmtScore(value: number | undefined): string {
  return value === undefined ? "—" : value.toFixed(2);
}

function VerdictBadge({ verdict }: { verdict: LlmVerdict }) {
  const tone =
    verdict === "Likely true"
      ? "bg-emerald-100 text-emerald-900 ring-emerald-300"
      : verdict === "Likely false"
        ? "bg-rose-100 text-rose-900 ring-rose-300"
        : verdict === "Uncertain"
          ? "bg-amber-100 text-amber-900 ring-amber-300"
          : "bg-slate-100 text-slate-700 ring-slate-300";
  return (
    <span
      data-testid="demo-explanation-verdict"
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1",
        tone,
      )}
    >
      {verdict}
    </span>
  );
}

interface DemoExplanationPanelProps {
  candidate: CandidateRecord | null;
  onAccept: (comment?: string) => void;
  onReject: (comment?: string) => void;
  busy?: boolean;
  mockHint?: boolean;
}

export function DemoExplanationPanel({
  candidate,
  onAccept,
  onReject,
  busy,
  mockHint,
}: DemoExplanationPanelProps) {
  const [comment, setComment] = useState("");
  const [followUp, setFollowUp] = useState("");
  const candidateKey = candidate
    ? `${candidate.Head}\u0000${candidate.Relation}\u0000${candidate.Tail}`
    : null;

  useEffect(() => {
    setComment("");
    setFollowUp("");
  }, [candidateKey]);

  if (!candidate) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-600">
        Select any candidate triple to populate the clustering, filtering, and LLM narration cards
        aligned with your teacher checklist.
      </div>
    );
  }

  const verdict = llmVerdict(candidate);
  const sScore = structuralScore(candidate);
  const lScore = llmScore(candidate);
  const cScore = combinedScore(candidate);
  const evidence = (candidate.retrieved_context ?? []).filter(Boolean);

  return (
    <div data-testid="demo-explanation-panel" className="space-y-3">
      {mockHint ? (
        <p className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
          Offline / mock reasoning — results cached for auditorium fallback.
        </p>
      ) : null}

      <CardSection label="Selected Candidate" testId="demo-explanation-candidate">
        <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-slate-900">
          <span>{candidate.DisplayHead ?? candidate.Head}</span>
          <span className="rounded bg-blue-50 px-1.5 py-0.5 font-mono text-[11px] text-blue-700">
            {candidate.DisplayRelation ?? candidate.Relation}
          </span>
          <ArrowRight className="h-3 w-3 text-slate-400" aria-hidden />
          <span>{candidate.DisplayTail ?? candidate.Tail}</span>
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-700">
          <div className="flex justify-between">
            <dt className="text-slate-500">Relation Type</dt>
            <dd className="font-mono font-semibold">{candidate.DisplayRelation ?? candidate.Relation}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Subject</dt>
            <dd className="truncate font-semibold">{candidate.DisplayHead ?? candidate.Head}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Object</dt>
            <dd className="truncate font-semibold">{candidate.DisplayTail ?? candidate.Tail}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Structural</dt>
            <dd className="font-mono font-semibold">{fmtScore(sScore)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">LLM Score</dt>
            <dd className="font-mono font-semibold">{fmtScore(lScore)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Combined</dt>
            <dd
              data-testid="demo-explanation-combined-score"
              className="font-mono font-semibold text-emerald-800"
            >
              {fmtScore(cScore)}
            </dd>
          </div>
        </dl>
        {candidate.sentence_text ? (
          <p className="mt-3 text-xs italic text-slate-600">"{candidate.sentence_text}"</p>
        ) : null}
      </CardSection>

      <CardSection label="LLM Explanation" testId="demo-explanation-llm">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[11px] font-semibold text-slate-500">Verdict</p>
          <VerdictBadge verdict={verdict} />
        </div>
        <div className="mt-2 rounded-md border border-emerald-100 bg-emerald-50/60 p-2 text-[12px] leading-snug text-emerald-900">
          {candidate.rationale ?? candidate.raw_response ?? "No natural-language explanation captured for this candidate."}
        </div>
        <dl className="mt-3 grid gap-1 text-xs text-slate-700">
          <div className="flex justify-between">
            <dt className="text-slate-500">Decision</dt>
            <dd
              data-testid="demo-explanation-decision"
              className="font-semibold text-slate-900"
            >
              {candidate.decision ?? "pending"}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Parsed score</dt>
            <dd className="font-mono text-slate-900">{candidate.parsed_score ?? "—"}</dd>
          </div>
        </dl>
      </CardSection>

      <CardSection label="Supporting Evidence (retrieved)" testId="demo-explanation-evidence">
        {evidence.length ? (
          <ul className="space-y-1.5 text-[12px] text-slate-700">
            {evidence.slice(0, 5).map((entry, idx) => (
              <li key={idx} className="rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5">
                <span className="line-clamp-3 whitespace-pre-wrap break-words">{entry}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-slate-500">No retrieved context attached to this candidate yet.</p>
        )}
      </CardSection>

      <CardSection label="Your Decision" testId="demo-explanation-decision-card">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onAccept(comment.trim() || undefined)}
            data-testid="demo-explanation-accept"
            className={clsx(
              "rounded-md px-3 py-1.5 text-xs font-semibold shadow-sm transition",
              busy ? "cursor-not-allowed bg-slate-200 text-slate-500" : "bg-emerald-600 text-white hover:bg-emerald-700",
            )}
            aria-label="Accept suggested triple into completed graph"
          >
            ✓ Accept
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onReject(comment.trim() || undefined)}
            data-testid="demo-explanation-reject"
            className={clsx(
              "rounded-md px-3 py-1.5 text-xs font-semibold transition",
              busy
                ? "cursor-not-allowed bg-slate-100 text-slate-400"
                : "bg-rose-600 text-white hover:bg-rose-700",
            )}
            aria-label="Reject suggested triple"
          >
            ✗ Reject
          </button>
        </div>
        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          rows={2}
          placeholder="Add a comment (optional)…"
          aria-label="Decision comment"
          data-testid="demo-explanation-comment"
          className="mt-2 w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </CardSection>

      <CardSection label="Actions" testId="demo-explanation-actions">
        <label className="block text-[11px] font-semibold text-slate-600">
          Ask LLM a follow-up question
        </label>
        <div className="mt-1.5 flex gap-2">
          <input
            type="text"
            value={followUp}
            onChange={(event) => setFollowUp(event.target.value)}
            placeholder="Why do you think this is true?"
            aria-label="LLM follow-up question"
            className="flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="button"
            disabled
            title="Wired to the offline OMNIA log; queries appear on next pipeline run."
            data-testid="demo-explanation-followup"
            className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700"
          >
            <MessageSquare className="h-3 w-3" />
            Ask
          </button>
        </div>
      </CardSection>
    </div>
  );
}
