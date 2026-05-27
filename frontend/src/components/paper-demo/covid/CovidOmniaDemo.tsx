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

export type CovidOmniaStepId =
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
    green: { bg: "#E1F5EE", text: "#085041", border: "#1D9E75" },
    amber: { bg: "#FAEEDA", text: "#412402", border: "#BA7517" },
    red: { bg: "#FCEBEB", text: "#501313", border: "#A32D2D" },
    blue: { bg: "#E6F1FB", text: "#042C53", border: "#185FA5" },
    purple: { bg: "#EEEDFE", text: "#26215C", border: "#534AB7" },
    gray: { bg: "#F1EFE8", text: "#2C2C2A", border: "#888780" },
  };
  const c = colors[color] || colors.gray;
  return (
    <span
      style={{
        background: c.bg,
        color: c.text,
        border: `0.5px solid ${c.border}`,
        borderRadius: 4,
        padding: "2px 8px",
        fontSize: 11,
        fontWeight: 500,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function Stat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div
      style={{
        background: "var(--color-background-secondary, #f8fafc)",
        borderRadius: 8,
        padding: "10px 16px",
        textAlign: "center",
        border: "0.5px solid var(--color-border-tertiary, #e2e8f0)",
      }}
    >
      <div
        style={{
          fontSize: 22,
          fontWeight: 500,
          color: color || "var(--color-text-primary, #0f172a)",
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 12,
          color: "var(--color-text-secondary, #64748b)",
          marginTop: 2,
        }}
      >
        {label}
      </div>
    </div>
  );
}

function EntityPill({ id }: { id: CovidEntityId }) {
  const ent = COVID_ENT[id];
  const s = COVID_TYPE_STYLE[ent.type];
  return (
    <span
      style={{
        background: s.bg,
        color: s.text,
        border: `0.5px solid ${s.border}`,
        borderRadius: 4,
        padding: "1px 7px",
        fontSize: 11,
        fontWeight: 500,
      }}
    >
      {ent.label}
    </span>
  );
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = score >= COVID_THRESHOLD ? "#1D9E75" : score >= 0.5 ? "#BA7517" : "#D85A30";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, width: 160 }}>
      <div
        style={{
          flex: 1,
          height: 6,
          background: "var(--color-background-secondary, #f1f5f9)",
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 11, color, fontWeight: 500, minWidth: 32 }}>{pct}%</span>
    </div>
  );
}

function TripleRow({
  h,
  r,
  t,
  score,
  highlight,
}: {
  h: CovidEntityId;
  r: string;
  t: CovidEntityId;
  score?: number;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 8px",
        borderRadius: 6,
        background: highlight ? "#FAEEDA" : "var(--color-background-secondary, #f8fafc)",
        border: `0.5px solid ${highlight ? "#BA7517" : "var(--color-border-tertiary, #e2e8f0)"}`,
      }}
    >
      <EntityPill id={h} />
      <span
        style={{
          fontSize: 11,
          color: "var(--color-text-secondary, #64748b)",
          fontFamily: "ui-monospace, monospace",
        }}
      >
        {r}
      </span>
      <EntityPill id={t} />
      {score !== undefined ? (
        <span
          style={{
            marginLeft: "auto",
            fontSize: 11,
            color: score >= COVID_THRESHOLD ? "#0F6E56" : "#993C1D",
            fontWeight: 500,
          }}
        >
          {score.toFixed(2)}
        </span>
      ) : null}
    </div>
  );
}

function Step1() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 220px", gap: 20 }}>
      <div>
        <p
          style={{
            fontSize: 13,
            color: "var(--color-text-secondary, #64748b)",
            marginBottom: 12,
          }}
        >
          The original knowledge graph contains entities and relations extracted from COVID-19
          research texts. Some facts entailed in the source text were not extracted — these are{" "}
          <strong>missing triples</strong>.
        </p>
        <div
          style={{
            background: "var(--color-background-secondary, #f8fafc)",
            borderRadius: 10,
            padding: "12px 16px",
            border: "0.5px solid var(--color-border-tertiary, #e2e8f0)",
          }}
        >
          <CovidOmniaGraph />
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
          {(
            [
              ["drug", "Drug"],
              ["virus", "Virus"],
              ["org", "Organization"],
            ] as const
          ).map(([k, l]) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: COVID_TYPE_STYLE[k].bg,
                  border: `1px solid ${COVID_TYPE_STYLE[k].border}`,
                }}
              />
              <span style={{ fontSize: 11, color: "var(--color-text-secondary, #64748b)" }}>{l}</span>
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 18, height: 0, borderBottom: "1.5px dashed #BA7517" }} />
            <span style={{ fontSize: 11, color: "#BA7517" }}>Missing triple (not yet found)</span>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Stat label="entities" value={7} />
        <Stat label="relations" value={6} />
        <Stat label="triples" value={7} />
        <Stat label="missing triples" value="2" color="#D85A30" />
        <div
          style={{
            borderRadius: 8,
            padding: "10px 12px",
            fontSize: 12,
            lineHeight: 1.6,
            background: "#FAEEDA",
            border: "0.5px solid #BA7517",
            color: "#633806",
          }}
        >
          <strong>Goal:</strong> Find the 2 triples that exist in the source text but were never
          extracted by the LLM.
        </div>
      </div>
    </div>
  );
}

function Step2() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 240px", gap: 20 }}>
      <div>
        <p
          style={{
            fontSize: 13,
            color: "var(--color-text-secondary, #64748b)",
            marginBottom: 12,
          }}
        >
          Entities that share the same <em>(relation, tail)</em> pair are likely semantically related.
          We group them into clusters. Each cluster becomes a seed for candidate triple generation.
        </p>
        <div
          style={{
            background: "var(--color-background-secondary, #f8fafc)",
            borderRadius: 10,
            padding: "12px 16px",
            border: "0.5px solid var(--color-border-tertiary, #e2e8f0)",
          }}
        >
          <CovidOmniaGraph
            triples={COVID_ORIG_TRIPLES}
            clusterBox
            highlight={[...COVID_CLUSTER_MEMBERS, "ncov"]}
          />
        </div>
        <div style={{ fontSize: 11, color: "var(--color-text-secondary, #64748b)", marginTop: 6 }}>
          Dashed green box = Cluster C₁. All three drugs connect to 2019-nCoV via &quot;inhibits&quot;.
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontWeight: 500, fontSize: 13 }}>Cluster C₁</div>
        <div
          style={{
            borderRadius: 8,
            border: "1.5px solid #1D9E75",
            background: "#E1F5EE",
            padding: "10px 12px",
          }}
        >
          <div style={{ fontSize: 11, color: "#085041", marginBottom: 6, fontWeight: 500 }}>
            Shared pattern
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <span
              style={{
                fontSize: 11,
                fontFamily: "ui-monospace, monospace",
                background: "#fff",
                border: "0.5px solid #1D9E75",
                borderRadius: 4,
                padding: "2px 6px",
                color: "#085041",
              }}
            >
              inhibits
            </span>
            <span style={{ fontSize: 11, color: "#085041" }}>→</span>
            <EntityPill id="ncov" />
          </div>
          <div style={{ fontSize: 11, color: "#085041", marginBottom: 4, fontWeight: 500 }}>Members</div>
          {COVID_CLUSTER_MEMBERS.map((id) => (
            <div key={id} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#1D9E75",
                  display: "inline-block",
                }}
              />
              <EntityPill id={id} />
            </div>
          ))}
        </div>
        <div
          style={{
            borderRadius: 8,
            padding: "10px 12px",
            fontSize: 12,
            lineHeight: 1.6,
            background: "var(--color-background-secondary, #f8fafc)",
            border: "0.5px solid var(--color-border-tertiary, #e2e8f0)",
            color: "var(--color-text-secondary, #64748b)",
          }}
        >
          Algorithm: for each triple (h, r, t), use <code>(r, t)</code> as the cluster key and group
          all matching head entities h.
        </div>
      </div>
    </div>
  );
}

function Step3() {
  const pairs = [
    { r: "treats", t: "sarskov2" as const, from: "Remdesivir" },
    { r: "inhibits", t: "ncov" as const, from: "all (shared)" },
    { r: "affects", t: "mers" as const, from: "Remdesivir" },
    { r: "prevents", t: "sarskov2" as const, from: "Chloroquine" },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
      <div>
        <p
          style={{
            fontSize: 13,
            color: "var(--color-text-secondary, #64748b)",
            marginBottom: 10,
          }}
        >
          For each cluster, we take <em>every member × every (relation, tail) pair</em> in that cluster
          and generate new candidate triples. Triples already in the KG are skipped.
        </p>
        <div style={{ fontWeight: 500, fontSize: 12, marginBottom: 6 }}>
          Cluster C₁ — relation-tail pairs available
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 14 }}>
          {pairs.map((p, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "5px 10px",
                background: "var(--color-background-secondary, #f8fafc)",
                borderRadius: 6,
                border: "0.5px solid var(--color-border-tertiary, #e2e8f0)",
              }}
            >
              <span
                style={{
                  fontFamily: "ui-monospace, monospace",
                  fontSize: 11,
                  color: "var(--color-text-primary, #0f172a)",
                }}
              >
                {p.r}
              </span>
              <span style={{ fontSize: 11, color: "var(--color-text-secondary, #64748b)" }}>→</span>
              <EntityPill id={p.t} />
              <span
                style={{
                  marginLeft: "auto",
                  fontSize: 10,
                  color: "var(--color-text-tertiary, #94a3b8)",
                }}
              >
                from {p.from}
              </span>
            </div>
          ))}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "var(--color-text-secondary, #64748b)",
            padding: "8px 10px",
            background: "var(--color-background-secondary, #f8fafc)",
            borderRadius: 6,
            border: "0.5px solid var(--color-border-tertiary, #e2e8f0)",
          }}
        >
          3 members × 4 pairs = <strong>12 combinations</strong> — minus 7 that already exist ={" "}
          <strong style={{ color: "#BA7517" }}>5 new candidates</strong>
        </div>
      </div>
      <div>
        <div style={{ fontWeight: 500, fontSize: 12, marginBottom: 6 }}>Generated candidates</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {COVID_CANDIDATES.map((c, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 10px",
                borderRadius: 6,
                background: c.tag === "missing" ? "#FAEEDA" : "var(--color-background-secondary, #f8fafc)",
                border: `0.5px solid ${c.tag === "missing" ? "#BA7517" : "var(--color-border-tertiary, #e2e8f0)"}`,
              }}
            >
              <EntityPill id={c.h} />
              <span
                style={{
                  fontFamily: "ui-monospace, monospace",
                  fontSize: 11,
                  color: "var(--color-text-secondary, #64748b)",
                }}
              >
                {c.r}
              </span>
              <EntityPill id={c.t} />
              {c.tag === "missing" ? (
                <span style={{ marginLeft: "auto" }}>
                  <Badge color="amber">⭐ missing triple</Badge>
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Step4() {
  const kept = COVID_CANDIDATES.filter((c) => c.score >= COVID_THRESHOLD);
  const removed = COVID_CANDIDATES.filter((c) => c.score < COVID_THRESHOLD);

  return (
    <div>
      <p
        style={{
          fontSize: 13,
          color: "var(--color-text-secondary, #64748b)",
          marginBottom: 12,
        }}
      >
        A <strong>TransE embedding model</strong> is trained on the original KG. Each candidate is
        scored: lower distance = more plausible. Candidates below the threshold are discarded before
        the expensive LLM step.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <div style={{ fontWeight: 500, fontSize: 12, marginBottom: 8 }}>All candidates — embedding scores</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[...COVID_CANDIDATES]
              .sort((a, b) => b.score - a.score)
              .map((c, i) => (
                <div
                  key={i}
                  style={{
                    padding: "7px 10px",
                    borderRadius: 6,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background:
                      c.score >= COVID_THRESHOLD
                        ? "var(--color-background-secondary, #f8fafc)"
                        : "#FCEBEB",
                    border: `0.5px solid ${c.score >= COVID_THRESHOLD ? "var(--color-border-tertiary, #e2e8f0)" : "#F09595"}`,
                    opacity: c.score < COVID_THRESHOLD ? 0.7 : 1,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--color-text-primary, #0f172a)",
                        marginBottom: 3,
                      }}
                    >
                      <strong>{COVID_ENT[c.h].label}</strong>
                      <span
                        style={{
                          color: "var(--color-text-secondary, #64748b)",
                          fontFamily: "ui-monospace, monospace",
                          margin: "0 4px",
                        }}
                      >
                        {c.r}
                      </span>
                      <strong>{COVID_ENT[c.t].label}</strong>
                    </div>
                    <ScoreBar score={c.score} />
                  </div>
                  {c.score >= COVID_THRESHOLD ? (
                    <Check style={{ color: "#1D9E75", width: 16, height: 16 }} aria-hidden />
                  ) : (
                    <X style={{ color: "#A32D2D", width: 16, height: 16 }} aria-hidden />
                  )}
                </div>
              ))}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div
            style={{
              borderRadius: 8,
              padding: "10px 14px",
              background: "var(--color-background-secondary, #f8fafc)",
              border: "0.5px solid var(--color-border-tertiary, #e2e8f0)",
            }}
          >
            <div style={{ fontSize: 11, color: "var(--color-text-secondary, #64748b)", marginBottom: 2 }}>
              Threshold
            </div>
            <div style={{ fontSize: 18, fontWeight: 500 }}>{COVID_THRESHOLD.toFixed(2)}</div>
            <div style={{ fontSize: 11, color: "var(--color-text-tertiary, #94a3b8)" }}>
              scores above this pass to LLM
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Stat label="passed" value={kept.length} color="#1D9E75" />
            <Stat label="removed" value={removed.length} color="#D85A30" />
          </div>
          <div
            style={{
              borderRadius: 8,
              padding: "10px 12px",
              fontSize: 12,
              lineHeight: 1.65,
              background: "#E1F5EE",
              border: "0.5px solid #1D9E75",
              color: "#085041",
            }}
          >
            <strong>Why filter first?</strong> LLM calls are expensive. Embedding-based filtering
            removes clearly incorrect triples, reducing LLM calls by ~
            {Math.round((removed.length / COVID_CANDIDATES.length) * 100)}% while retaining all
            plausible candidates.
          </div>
          <div style={{ fontWeight: 500, fontSize: 12, marginBottom: 4 }}>Passed to LLM →</div>
          {kept.map((c, i) => (
            <TripleRow key={i} h={c.h} r={c.r} t={c.t} score={c.score} highlight={c.tag === "missing"} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Step5() {
  const [mode, setMode] = useState<"zero" | "context" | "rag">("rag");
  const kept = COVID_CANDIDATES.filter((c) => c.score >= COVID_THRESHOLD);
  const prompts = {
    zero: "Is the following triple correct?\nTriple: {head} {relation} {tail}\nAnswer: True or False.",
    context:
      "Given these related triples from the KG:\n- Remdesivir treats SARS-CoV-2\n- Chloroquine inhibits 2019-nCoV\n\nIs this triple correct?\nTriple: {head} {relation} {tail}\nAnswer: True or False.",
    rag: "Retrieved similar triples:\n- Remdesivir treats SARS-CoV-2\n- Chloroquine prevents SARS-CoV-2\n- Favipiravir inhibits 2019-nCoV\n\nBased on this context, is the following triple semantically correct?\nTriple: {head} {relation} {tail}\nAnswer: True or False.",
  };
  const f1 = { zero: "0.68", context: "0.69", rag: "0.91" };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
      <div>
        <p
          style={{
            fontSize: 13,
            color: "var(--color-text-secondary, #64748b)",
            marginBottom: 10,
          }}
        >
          An LLM (Mistral-7B) acts as a <strong>judge</strong>, classifying each filtered candidate
          as True or False. Three prompting strategies are supported — RAG consistently achieves the
          best results.
        </p>
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
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
              onClick={() => setMode(k)}
              style={{
                padding: "4px 12px",
                borderRadius: 6,
                fontSize: 12,
                background:
                  mode === k
                    ? "var(--color-text-primary, #0f172a)"
                    : "var(--color-background-secondary, #f8fafc)",
                color:
                  mode === k
                    ? "var(--color-background-primary, #fff)"
                    : "var(--color-text-secondary, #64748b)",
                border:
                  mode === k ? "none" : "0.5px solid var(--color-border-secondary, #cbd5e1)",
                cursor: "pointer",
              }}
            >
              {l}
            </button>
          ))}
        </div>
        <div
          style={{
            background: "var(--color-background-secondary, #f8fafc)",
            borderRadius: 8,
            border: "0.5px solid var(--color-border-tertiary, #e2e8f0)",
            padding: "12px 14px",
            marginBottom: 10,
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "var(--color-text-secondary, #64748b)",
              marginBottom: 6,
            }}
          >
            Prompt template
          </div>
          <pre
            style={{
              fontSize: 11,
              margin: 0,
              lineHeight: 1.7,
              whiteSpace: "pre-wrap",
              color: "var(--color-text-primary, #0f172a)",
              fontFamily: "ui-monospace, monospace",
            }}
          >
            {prompts[mode]
              .replace("{head}", "Chloroquine")
              .replace("{relation}", "treats")
              .replace("{tail}", "SARS-CoV-2")}
          </pre>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            borderRadius: 8,
            background: "#E1F5EE",
            border: "0.5px solid #1D9E75",
          }}
        >
          <span style={{ fontSize: 12, color: "#085041" }}>
            LLM response: <strong>True</strong> — Chloroquine treats SARS-CoV-2 is semantically
            valid.
          </span>
        </div>
        <div
          style={{
            marginTop: 10,
            padding: "8px 12px",
            borderRadius: 8,
            background: "var(--color-background-secondary, #f8fafc)",
            border: "0.5px solid var(--color-border-tertiary, #e2e8f0)",
          }}
        >
          <div style={{ fontSize: 11, color: "var(--color-text-secondary, #64748b)" }}>
            F1-score (CoDEx-M)
          </div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 500,
              color: mode === "rag" ? "#1D9E75" : "var(--color-text-primary, #0f172a)",
            }}
          >
            {f1[mode]}
          </div>
        </div>
      </div>
      <div>
        <div style={{ fontWeight: 500, fontSize: 12, marginBottom: 8 }}>Validation results</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {kept.map((c, i) => (
            <div
              key={i}
              style={{
                padding: "8px 10px",
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: c.llm ? "#E1F5EE" : "#FCEBEB",
                border: `0.5px solid ${c.llm ? "#1D9E75" : "#F09595"}`,
              }}
            >
              <div style={{ flex: 1, fontSize: 11 }}>
                <strong>{COVID_ENT[c.h].label}</strong>
                <span
                  style={{
                    fontFamily: "ui-monospace, monospace",
                    color: "var(--color-text-secondary, #64748b)",
                    margin: "0 4px",
                  }}
                >
                  {c.r}
                </span>
                <strong>{COVID_ENT[c.t].label}</strong>
              </div>
              <Badge color={c.llm ? "green" : "red"}>{c.llm ? "✓ True" : "✗ False"}</Badge>
            </div>
          ))}
        </div>
        <div
          style={{
            marginTop: 12,
            padding: "10px 12px",
            borderRadius: 8,
            fontSize: 12,
            lineHeight: 1.65,
            background: "#FAEEDA",
            border: "0.5px solid #BA7517",
            color: "#633806",
          }}
        >
          <strong>Sentence vs. triple format:</strong> Converting triples to natural language
          sentences before prompting improves F1 by ~5% on most datasets. Both modes are supported.
        </div>
      </div>
    </div>
  );
}

function Step6() {
  const [choices, setChoices] = useState<Record<number, "accept" | "reject" | null>>({});
  const kept = COVID_CANDIDATES.filter((c) => c.score >= COVID_THRESHOLD);
  const choose = (i: number, v: "accept" | "reject") =>
    setChoices((prev) => ({ ...prev, [i]: prev[i] === v ? null : v }));
  const accepted = kept.filter((_, i) => choices[i] === "accept");

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 220px", gap: 20 }}>
      <div>
        <p
          style={{
            fontSize: 13,
            color: "var(--color-text-secondary, #64748b)",
            marginBottom: 12,
          }}
        >
          LLM-validated candidates are presented for human review. Accept confirmed triples, reject
          incorrect ones, or mark uncertain for later review. Accepted triples are added to the KG.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {kept.map((c, i) => (
            <div
              key={i}
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                gap: 10,
                background:
                  choices[i] === "accept"
                    ? "#E1F5EE"
                    : choices[i] === "reject"
                      ? "#FCEBEB"
                      : "var(--color-background-secondary, #f8fafc)",
                border: `0.5px solid ${
                  choices[i] === "accept"
                    ? "#1D9E75"
                    : choices[i] === "reject"
                      ? "#F09595"
                      : "var(--color-border-tertiary, #e2e8f0)"
                }`,
                transition: "all 0.15s",
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, marginBottom: 2 }}>
                  <EntityPill id={c.h} />
                  <span
                    style={{
                      fontFamily: "ui-monospace, monospace",
                      fontSize: 11,
                      color: "var(--color-text-secondary, #64748b)",
                      margin: "0 6px",
                    }}
                  >
                    {c.r}
                  </span>
                  <EntityPill id={c.t} />
                </div>
                <div style={{ fontSize: 11, color: "var(--color-text-secondary, #64748b)" }}>
                  LLM: <Badge color={c.llm ? "green" : "red"}>{c.llm ? "True" : "False"}</Badge>
                  &nbsp; Score: <strong>{c.score.toFixed(2)}</strong>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  onClick={() => choose(i, "accept")}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 6,
                    fontSize: 11,
                    cursor: "pointer",
                    background: choices[i] === "accept" ? "#1D9E75" : "var(--color-background-primary, #fff)",
                    color: choices[i] === "accept" ? "#fff" : "#1D9E75",
                    border: `0.5px solid ${choices[i] === "accept" ? "#1D9E75" : "#9FE1CB"}`,
                  }}
                >
                  Accept
                </button>
                <button
                  type="button"
                  onClick={() => choose(i, "reject")}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 6,
                    fontSize: 11,
                    cursor: "pointer",
                    background: choices[i] === "reject" ? "#A32D2D" : "var(--color-background-primary, #fff)",
                    color: choices[i] === "reject" ? "#fff" : "#A32D2D",
                    border: `0.5px solid ${choices[i] === "reject" ? "#A32D2D" : "#F0AAAA"}`,
                  }}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Stat label="reviewed" value={Object.keys(choices).length} />
        <Stat label="accepted" value={accepted.length} color="#1D9E75" />
        <Stat
          label="rejected"
          value={Object.values(choices).filter((v) => v === "reject").length}
          color="#D85A30"
        />
        {accepted.length > 0 ? (
          <div
            style={{
              borderRadius: 8,
              padding: "10px 12px",
              background: "#E1F5EE",
              border: "0.5px solid #1D9E75",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 500, color: "#085041", marginBottom: 6 }}>
              Will be added to KG
            </div>
            {accepted.map((c, i) => (
              <div key={i} style={{ fontSize: 11, color: "#085041", marginBottom: 3 }}>
                ✓ {COVID_ENT[c.h].label}{" "}
                <span style={{ fontFamily: "ui-monospace, monospace" }}>{c.r}</span>{" "}
                {COVID_ENT[c.t].label}
              </div>
            ))}
          </div>
        ) : null}
        {Object.keys(choices).length === 0 ? (
          <div
            style={{
              fontSize: 12,
              color: "var(--color-text-tertiary, #94a3b8)",
              textAlign: "center",
              marginTop: 8,
            }}
          >
            Click Accept or Reject above to review candidates
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StepResult() {
  const added = COVID_MISSING_TRIPLES;
  const kept = COVID_CANDIDATES.filter((c) => c.score >= COVID_THRESHOLD);

  return (
    <div>
      <p
        style={{
          fontSize: 13,
          color: "var(--color-text-secondary, #64748b)",
          marginBottom: 14,
        }}
      >
        After completing the OMNIA loop, accepted triples are added to the knowledge graph. The
        graph is now more complete and consistent with the source text.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div>
          <div
            style={{
              fontWeight: 500,
              fontSize: 12,
              marginBottom: 6,
              color: "var(--color-text-secondary, #64748b)",
            }}
          >
            Before — 7 triples
          </div>
          <div
            style={{
              background: "var(--color-background-secondary, #f8fafc)",
              borderRadius: 10,
              padding: "12px",
              border: "0.5px solid var(--color-border-tertiary, #e2e8f0)",
              opacity: 0.7,
            }}
          >
            <CovidOmniaGraph />
          </div>
        </div>
        <div>
          <div style={{ fontWeight: 500, fontSize: 12, marginBottom: 6, color: "#0F6E56" }}>
            After — 9 triples (+2 recovered)
          </div>
          <div
            style={{
              background: "var(--color-background-secondary, #f8fafc)",
              borderRadius: 10,
              padding: "12px",
              border: "1.5px solid #1D9E75",
            }}
          >
            <CovidOmniaGraph triples={COVID_ORIG_TRIPLES} missing={added} />
          </div>
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 10,
          marginTop: 14,
        }}
      >
        <Stat label="original triples" value={7} />
        <Stat label="candidates generated" value={COVID_CANDIDATES.length} />
        <Stat label="passed filtering" value={kept.length} />
        <Stat label="triples recovered" value={2} color="#1D9E75" />
      </div>
      <div
        style={{
          marginTop: 14,
          padding: "12px 16px",
          borderRadius: 8,
          background: "#E1F5EE",
          border: "0.5px solid #1D9E75",
        }}
      >
        <div style={{ fontWeight: 500, fontSize: 13, color: "#085041", marginBottom: 6 }}>
          Recovered missing triples
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {added.map((tr, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 10px",
                borderRadius: 6,
                background: "#fff",
                border: "0.5px solid #1D9E75",
              }}
            >
              <EntityPill id={tr.h} />
              <span
                style={{
                  fontFamily: "ui-monospace, monospace",
                  fontSize: 11,
                  color: "var(--color-text-secondary, #64748b)",
                }}
              >
                {tr.r}
              </span>
              <EntityPill id={tr.t} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const STEP_COMPONENTS: Record<
  Exclude<CovidOmniaStepId, "completed">,
  () => React.ReactNode
> = {
  kg: Step1,
  clustering: Step2,
  candidates: Step3,
  filtering: Step4,
  llm: Step5,
  feedback: Step6,
};

const STEP_ORDER: CovidOmniaStepId[] = [
  "kg",
  "clustering",
  "candidates",
  "filtering",
  "llm",
  "feedback",
  "completed",
];

const STEP_LABELS: Record<CovidOmniaStepId, { title: string; sub: string }> = {
  kg: { title: "Knowledge Graph", sub: "Explore the graph" },
  clustering: { title: "Clustering", sub: "Group similar entities" },
  candidates: { title: "Candidate Generation", sub: "Propose new triples" },
  filtering: { title: "Structural Filtering", sub: "Remove unlikely ones" },
  llm: { title: "Semantic Validation", sub: "LLM validates each" },
  feedback: { title: "User Feedback", sub: "You review & decide" },
  completed: { title: "Completed Knowledge Graph", sub: "Before and after comparison" },
};

/** Full teacher-friendly COVID-19 OMNIA walkthrough (from reference JSX). */
export function CovidOmniaDemo({
  step,
  embedded = false,
}: {
  step: CovidOmniaStepId;
  /** When true, omit outer chrome — used inside PaperDemoPage center panel. */
  embedded?: boolean;
}) {
  const isResult = step === "completed";
  const Content = isResult ? StepResult : STEP_COMPONENTS[step];
  const meta = STEP_LABELS[step];

  const body = (
    <>
      {!embedded ? (
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginBottom: 20,
            paddingBottom: 14,
            borderBottom: "0.5px solid var(--color-border-tertiary, #e2e8f0)",
          }}
        >
          <div>
            <div style={{ fontSize: 20, fontWeight: 500 }}>OMNIA</div>
            <div style={{ fontSize: 12, color: "var(--color-text-secondary, #64748b)" }}>
              Knowledge graph completion · COVID-19 example
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Badge color="blue">CoDEx-M dataset</Badge>
            <Badge color="purple">RAG · Mistral-7B</Badge>
          </div>
        </div>
      ) : null}

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div
          style={{
            width: 3,
            height: 22,
            borderRadius: 2,
            background: isResult ? "#1D9E75" : "var(--color-text-primary, #0f172a)",
          }}
        />
        <div>
          <div style={{ fontSize: 16, fontWeight: 500 }}>{meta.title}</div>
          <div style={{ fontSize: 12, color: "var(--color-text-secondary, #64748b)" }}>
            {isResult
              ? meta.sub
              : `Step ${STEP_ORDER.indexOf(step) + 1} of 6 — ${meta.sub}`}
          </div>
        </div>
      </div>

      <Content />
    </>
  );

  if (embedded) {
    return (
      <div
        className="rounded-xl border border-slate-200 bg-white p-4"
        data-testid="covid-omnia-demo"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div>
            <p className="text-sm font-medium text-slate-900">COVID-19 guided example</p>
            <p className="text-xs text-slate-600">Static walkthrough — not backend-loaded</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge color="amber">COVID-Fact</Badge>
            <Badge color="purple">RAG · Mistral-7B</Badge>
          </div>
        </div>
        {body}
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "inherit", maxWidth: 880, margin: "0 auto", padding: "0 0 2rem" }}>
      {body}
    </div>
  );
}
