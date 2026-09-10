import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppShell } from "@/components/AppShell";
import { runRetrievalEvaluation } from "@/lib/rag.functions";

export const Route = createFileRoute("/evaluation")({
  head: () => ({
    meta: [
      { title: "Evaluation — Recall@K for TF-IDF and Dense Legal Retrieval" },
      {
        name: "description",
        content:
          "Recall@1, Recall@3 and Recall@5 results comparing TF-IDF and dense retrieval on held-out Bangladeshi legal questions, reproducible live in the browser.",
      },
      { property: "og:title", content: "Evaluation — Recall@K for Legal Retrieval" },
      {
        property: "og:description",
        content:
          "Reported notebook benchmarks and a live reproducible Recall@K evaluation of the legal retrieval pipeline.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EvaluationPage,
});

const NOTEBOOK = [
  { k: "Recall@1", tfidf: 0.31, dense: 0.39 },
  { k: "Recall@3", tfidf: 0.44, dense: 0.56 },
  { k: "Recall@5", tfidf: 0.48, dense: 0.61 },
];

function Chart({ data }: { data: Array<{ k: string; tfidf: number; dense: number }> }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="k" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
          <YAxis domain={[0, 1]} tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
          <Tooltip
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="tfidf" name="TF-IDF" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="dense" name="Dense" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function EvaluationPage() {
  const runEval = useServerFn(runRetrievalEvaluation);
  const [sampleSize, setSampleSize] = useState(20);

  const mutation = useMutation({
    mutationFn: () => runEval({ data: { sampleSize } }),
  });

  const liveData = mutation.data?.rows.map((r) => ({
    k: `Recall@${r.topK}`,
    tfidf: r.tfidfRecall,
    dense: r.denseRecall,
  }));

  return (
    <AppShell>
      <header className="mb-6">
        <span className="rule-label">Experiment 2 — retrieval quality</span>
        <h1 className="mt-2 text-3xl font-semibold">Recall@K evaluation</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          A retrieval is counted as a hit when the gold statutory section of a held-out question
          appears in the top-K retrieved sections, after normalising section numbers (including
          Bengali numerals). Dense retrieval wins at every cut-off.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="panel p-5">
          <span className="rule-label">Reported results — 100 sampled questions</span>
          <h2 className="mb-3 mt-1 font-display text-lg font-semibold">Notebook benchmark</h2>
          <Chart data={NOTEBOOK} />
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="rule-label border-b border-border">
                <th className="py-2 text-left">Metric</th>
                <th className="py-2 text-right">TF-IDF</th>
                <th className="py-2 text-right">Dense</th>
                <th className="py-2 text-right">Gain</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {NOTEBOOK.map((r) => (
                <tr key={r.k} className="border-b border-border/60 last:border-0">
                  <td className="py-2 font-sans">{r.k}</td>
                  <td className="py-2 text-right">{r.tfidf.toFixed(2)}</td>
                  <td className="py-2 text-right">{r.dense.toFixed(2)}</td>
                  <td className="py-2 text-right text-verified">
                    +{((r.dense - r.tfidf) * 100).toFixed(0)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="panel p-5">
          <span className="rule-label">Live reproduction — runs against this deployment</span>
          <h2 className="mb-3 mt-1 font-display text-lg font-semibold">Run the evaluation now</h2>

          <div className="mb-4 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <span className="rule-label">Sample size</span>
              <input
                type="range"
                min={5}
                max={40}
                step={5}
                value={sampleSize}
                onChange={(e) => setSampleSize(Number(e.target.value))}
                className="accent-[var(--seal)]"
              />
              <span className="font-mono text-sm">{sampleSize}</span>
            </label>
            <button
              type="button"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="ml-auto inline-flex items-center gap-2 rounded-md bg-seal px-4 py-2 text-sm font-medium text-seal-foreground disabled:opacity-50"
            >
              {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Run evaluation
            </button>
          </div>

          {mutation.isPending && (
            <p className="text-sm text-muted-foreground">
              Embedding {sampleSize} held-out questions and scoring both retrievers…
            </p>
          )}
          {mutation.isError && (
            <p className="text-sm text-destructive">{(mutation.error as Error).message}</p>
          )}

          {liveData ? (
            <>
              <Chart data={liveData} />
              <p className="mt-3 text-xs text-muted-foreground">
                {mutation.data!.sampleSize} test questions ·{" "}
                {(mutation.data!.durationMs / 1000).toFixed(1)}s · saved to the evaluation log.
              </p>
            </>
          ) : (
            !mutation.isPending && (
              <p className="text-sm text-muted-foreground">
                Press run to reproduce the experiment live during the defence. Results are stored so
                they can be cited afterwards.
              </p>
            )
          )}
        </section>
      </div>

      <section className="panel mt-6 p-5">
        <span className="rule-label">Experiment 3 — verification under varying evidence</span>
        <h2 className="mb-3 mt-1 font-display text-lg font-semibold">Top-K ablation on answers</h2>
        <p className="mb-4 max-w-3xl text-sm text-muted-foreground">
          Recorded behaviour of the full generate-and-verify pipeline on one representative
          question. More evidence is not automatically better: the highest support score occurred at
          K=1, yet the answer was flagged because its citation did not match the retrieved section.
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="rule-label border-b border-border">
              <th className="py-2 text-left">Top-K</th>
              <th className="py-2 text-right">Citation valid</th>
              <th className="py-2 text-right">Support score</th>
              <th className="py-2 text-right">Verdict</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {[
              { k: 1, valid: false, support: 0.8829 },
              { k: 3, valid: true, support: 0.8429 },
              { k: 5, valid: false, support: 0.8317 },
            ].map((r) => (
              <tr key={r.k} className="border-b border-border/60 last:border-0">
                <td className="py-2">K={r.k}</td>
                <td className="py-2 text-right">{r.valid ? "yes" : "no"}</td>
                <td className="py-2 text-right">{r.support.toFixed(4)}</td>
                <td className="py-2 text-right">
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${
                      r.valid
                        ? "bg-verified text-verified-foreground"
                        : "bg-flagged text-flagged-foreground"
                    }`}
                  >
                    {r.valid ? "VERIFIED" : "FLAGGED"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </AppShell>
  );
}
