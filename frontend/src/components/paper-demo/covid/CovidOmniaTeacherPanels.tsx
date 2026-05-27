import { useState } from "react";
import { Check, X } from "lucide-react";
import { CovidOmniaGraph } from "./CovidOmniaGraph";
import {
  COVID_CANDIDATES,
  COVID_CLUSTER_MEMBERS,
  COVID_ENT,
  COVID_MISSING_TRIPLES,
  COVID_ORIG_TRIPLES,
  COVID_THRESHOLD,
  COVID_TYPE_STYLE,
  type CovidEntityId,
} from "./covidOmniaDemoData";

type PaperStepId =
  | "kg"
  | "clustering"
  | "candidates"
  | "filtering"
  | "llm"
  | "feedback"
  | "completed";

function Badge({
  children,
  color,
}: {
  children: React.ReactNode;
  color: "green" | "amber" | "red" | "blue" | "purple" | "gray";
}) {
  const colors = {
    green: "bg-emerald-50 text-emerald-900 ring-emerald-300",
    amber: "bg-amber-50 text-amber-950 ring-amber-300",
    red: "bg-rose-50 text-rose-950 ring-rose-300",
    blue: "bg-sky-50 text-sky-950 ring-sky-300",
    purple: "bg-violet-50 text-violet-950 ring-violet-300",
    gray: "bg-slate-100 text-slate-800 ring-slate-300",
  };
  return (
    <span className={`inline-flex rounded px-2 py-0.5 text-[11px] font-medium ring-1 ${colors[color]}`}>
      {children}
    </span>
  );
}

function Stat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-center">
      <div className={`text-xl font-semibold ${color ?? "text-slate-900"}`}>{value}</div>
      <div className="mt-0.5 text-xs text-slate-600">{label}</div>
    </div>
  );
}

function EntityPill({ id }: { id: CovidEntityId }) {
  const ent = COVID_ENT[id];
  const s = COVID_TYPE_STYLE[ent.type];
  return (
    <span
      className="rounded px-1.5 py-0.5 text-[11px] font-medium ring-1"
      style={{ background: s.bg, color: s.text, borderColor: s.border }}
    >
      {ent.label}
    </span>
  );
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = score >= COVID_THRESHOLD ? "#1D9E75" : score >= 0.5 ? "#BA7517" : "#D85A30";
  return (
    <div className="flex w-full max-w-[160px] items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="min-w-[32px] text-[11px] font-medium" style={{ color }}>
        {pct}%
      </span>
    </div>
  );
}

export function CovidOmniaGraphStage({ step }: { step: PaperStepId }) {
  if (step === "kg") {
    return <CovidOmniaGraph />;
  }

  if (step === "clustering") {
    return (
      <CovidOmniaGraph
        triples={COVID_ORIG_TRIPLES}
        clusterBox
        highlight={[...COVID_CLUSTER_MEMBERS, "ncov"]}
      />
    );
  }

  if (step === "candidates") {
    return (
      <CovidOmniaGraph
        triples={COVID_ORIG_TRIPLES}
        missing={COVID_MISSING_TRIPLES}
        clusterBox
        highlight={[...COVID_CLUSTER_MEMBERS, "ncov", "sarskov2"]}
      />
    );
  }

  if (step === "completed") {
    return (
      <CovidOmniaGraph triples={COVID_ORIG_TRIPLES} missing={COVID_MISSING_TRIPLES} />
    );
  }

  return (
    <CovidOmniaGraph
      triples={COVID_ORIG_TRIPLES}
      highlight={["chloroquine", "sarskov2"]}
    />
  );
}

export function CovidOmniaStepExplanation({ step }: { step: PaperStepId }) {
  const [llmMode, setLlmMode] = useState<"zero" | "context" | "rag">("rag");
  const kept = COVID_CANDIDATES.filter((c) => c.score >= COVID_THRESHOLD);
  const removed = COVID_CANDIDATES.filter((c) => c.score < COVID_THRESHOLD);

  if (step === "kg") {
    return (
      <div className="space-y-3">
        <p className="text-xs leading-relaxed text-slate-700">
          The original knowledge graph contains entities and relations extracted from COVID-19 research
          texts. Some facts entailed in the source text were not extracted — these are{" "}
          <strong>missing triples</strong>.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="entities" value={7} />
          <Stat label="relations" value={6} />
          <Stat label="triples" value={7} />
          <Stat label="missing triples" value={2} color="text-rose-700" />
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          <strong>Goal:</strong> Find the 2 triples that exist in the source text but were never
          extracted by the LLM.
        </div>
      </div>
    );
  }

  if (step === "clustering") {
    return (
      <div className="space-y-3">
        <p className="text-xs leading-relaxed text-slate-700">
          OMNIA groups entities when they share the same relation → tail pattern. These grouped
          entities may share other missing relations.
        </p>
        <div className="rounded-lg border-2 border-emerald-400 bg-emerald-50 p-3">
          <p className="text-xs font-semibold text-emerald-900">Cluster C₁ — shared pattern</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded bg-white px-2 py-0.5 font-mono ring-1 ring-emerald-400 text-emerald-900">
              inhibits
            </span>
            <span className="text-emerald-800">→</span>
            <EntityPill id="ncov" />
          </div>
          <p className="mt-3 text-[11px] font-semibold text-emerald-900">Members</p>
          <ul className="mt-1 space-y-1">
            {COVID_CLUSTER_MEMBERS.map((id) => (
              <li key={id} className="flex items-center gap-2 text-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                <EntityPill id={id} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  if (step === "candidates") {
    return (
      <div className="space-y-3">
        <p className="text-xs text-slate-700">
          OMNIA proposes missing triples because similar entities in the selected group share the same
          relation → tail pattern.
        </p>
        <div className="space-y-1.5">
          {COVID_CANDIDATES.map((c, i) => (
            <div
              key={i}
              className={`flex flex-wrap items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs ${
                c.tag === "missing" ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"
              }`}
            >
              <EntityPill id={c.h} />
              <span className="font-mono text-slate-600">{c.r}</span>
              <EntityPill id={c.t} />
              {c.tag === "missing" ? (
                <span className="ml-auto">
                  <Badge color="amber">missing triple</Badge>
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (step === "filtering") {
    return (
      <div className="space-y-3">
        <p className="text-xs text-slate-700">
          OMNIA scores each proposed triple by how well it fits the graph structure. Candidates that
          score too poorly are discarded here, before the LLM runs.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="passed" value={kept.length} color="text-emerald-700" />
          <Stat label="removed" value={removed.length} color="text-rose-700" />
        </div>
        <div className="max-h-48 space-y-1.5 overflow-auto">
          {[...COVID_CANDIDATES]
            .sort((a, b) => b.score - a.score)
            .map((c, i) => (
              <div
                key={i}
                className={`rounded-md border px-2 py-1.5 ${
                  c.score >= COVID_THRESHOLD ? "border-slate-200 bg-white" : "border-rose-200 bg-rose-50/80"
                }`}
              >
                <p className="text-[11px] text-slate-800">
                  <EntityPill id={c.h} />{" "}
                  <span className="font-mono text-slate-500">{c.r}</span>{" "}
                  <EntityPill id={c.t} />
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <ScoreBar score={c.score} />
                  {c.score >= COVID_THRESHOLD ? (
                    <Check className="h-4 w-4 text-emerald-600" aria-hidden />
                  ) : (
                    <X className="h-4 w-4 text-rose-600" aria-hidden />
                  )}
                </div>
              </div>
            ))}
        </div>
      </div>
    );
  }

  if (step === "llm") {
    const prompts = {
      zero: "Is the following triple correct?\nTriple: Chloroquine treats SARS-CoV-2\nAnswer: True or False.",
      context:
        "Given related triples from the KG, is this triple correct?\nTriple: Chloroquine treats SARS-CoV-2",
      rag: "Retrieved similar triples suggest antiviral patterns.\nIs Chloroquine treats SARS-CoV-2 semantically correct?",
    };
    const f1 = { zero: "0.68", context: "0.69", rag: "0.91" };
    return (
      <div className="space-y-3">
        <p className="text-xs text-slate-700">
          An LLM classifies each filtered candidate. RAG prompting works best on this example.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["zero", "Zero-shot"],
              ["context", "In-context"],
              ["rag", "RAG"],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => setLlmMode(k)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium ${
                llmMode === k ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-700"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
        <pre className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-2 font-mono text-[10px] text-slate-800">
          {prompts[llmMode]}
        </pre>
        <div className="space-y-1.5">
          {kept.map((c, i) => (
            <div
              key={i}
              className={`flex items-center justify-between rounded-md border px-2 py-1.5 text-xs ${
                c.llm ? "border-emerald-300 bg-emerald-50" : "border-rose-300 bg-rose-50"
              }`}
            >
              <span>
                <EntityPill id={c.h} /> {c.r} <EntityPill id={c.t} />
              </span>
              <Badge color={c.llm ? "green" : "red"}>{c.llm ? "True" : "False"}</Badge>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-600">
          F1 on CoDEx-M with {llmMode}:{" "}
          <strong className={llmMode === "rag" ? "text-emerald-700" : ""}>{f1[llmMode]}</strong>
        </p>
      </div>
    );
  }

  if (step === "feedback") {
    return <CovidFeedbackExplanation kept={kept} />;
  }

  if (step === "completed") {
    return (
      <div className="space-y-3">
        <p className="text-xs text-slate-700">
          Accepted triples are added to the knowledge graph. The graph becomes more complete.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="triples recovered" value={2} color="text-emerald-700" />
          <Stat label="passed filtering" value={kept.length} />
        </div>
      </div>
    );
  }

  return (
    <p className="text-xs text-slate-600">
      Review LLM-validated candidates and decide which triples to add to the knowledge graph.
    </p>
  );
}

type CovidChoice = "accept" | "reject";

function CovidFeedbackExplanation({
  kept,
}: {
  kept: typeof COVID_CANDIDATES;
}) {
  const [choices, setChoices] = useState<Record<number, CovidChoice | null>>({});
  const choose = (i: number, v: CovidChoice) =>
    setChoices((prev) => ({ ...prev, [i]: prev[i] === v ? null : v }));
  const accepted = kept.filter((_, i) => choices[i] === "accept");
  const rejected = Object.values(choices).filter((v) => v === "reject").length;
  const reviewed = Object.keys(choices).length;

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-slate-700">
        LLM-validated candidates are presented for human review. Accept confirmed triples or reject
        incorrect ones. Accepted triples are added to the KG.
      </p>
      <div className="space-y-2">
        {kept.map((c, i) => {
          const choice = choices[i];
          const rowClass =
            choice === "accept"
              ? "border-emerald-300 bg-emerald-50"
              : choice === "reject"
                ? "border-rose-300 bg-rose-50"
                : "border-slate-200 bg-white";
          return (
            <div
              key={i}
              className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 transition-colors ${rowClass}`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <EntityPill id={c.h} />
                  <span className="font-mono text-slate-600">{c.r}</span>
                  <EntityPill id={c.t} />
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                  LLM: <Badge color={c.llm ? "green" : "red"}>{c.llm ? "True" : "False"}</Badge>
                  Score: <strong>{c.score.toFixed(2)}</strong>
                </div>
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => choose(i, "accept")}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-medium ring-1 transition-colors ${
                    choice === "accept"
                      ? "bg-emerald-600 text-white ring-emerald-600"
                      : "bg-white text-emerald-700 ring-emerald-300 hover:bg-emerald-50"
                  }`}
                >
                  Accept
                </button>
                <button
                  type="button"
                  onClick={() => choose(i, "reject")}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-medium ring-1 transition-colors ${
                    choice === "reject"
                      ? "bg-rose-700 text-white ring-rose-700"
                      : "bg-white text-rose-700 ring-rose-300 hover:bg-rose-50"
                  }`}
                >
                  Reject
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="reviewed" value={reviewed} />
        <Stat label="accepted" value={accepted.length} color="text-emerald-700" />
        <Stat label="rejected" value={rejected} color="text-rose-700" />
      </div>
      {accepted.length > 0 ? (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2">
          <p className="text-[11px] font-semibold text-emerald-900">Will be added to KG</p>
          <ul className="mt-1 space-y-0.5 text-[11px] text-emerald-900">
            {accepted.map((c, i) => (
              <li key={i}>
                ✓ {COVID_ENT[c.h].label}{" "}
                <span className="font-mono">{c.r}</span> {COVID_ENT[c.t].label}
              </li>
            ))}
          </ul>
        </div>
      ) : reviewed === 0 ? (
        <p className="text-center text-xs text-slate-500">
          Click Accept or Reject above to review candidates
        </p>
      ) : null}
    </div>
  );
}
