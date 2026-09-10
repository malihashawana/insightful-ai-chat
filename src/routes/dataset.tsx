import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppShell } from "@/components/AppShell";
import { getDatasetStats } from "@/lib/rag.functions";

const statsQuery = queryOptions({
  queryKey: ["dataset-stats"],
  queryFn: () => getDatasetStats(),
  staleTime: 1000 * 60 * 10,
});

export const Route = createFileRoute("/dataset")({
  head: () => ({
    meta: [
      { title: "Dataset — Bangladesh Legal QA Corpus Statistics" },
      {
        name: "description",
        content:
          "Exploratory analysis of the 2,165-record bilingual Bangladesh legal QA dataset: language balance, Acts covered, question types and the deduplicated statutory corpus.",
      },
      { property: "og:title", content: "Dataset — Bangladesh Legal QA Corpus" },
      {
        property: "og:description",
        content:
          "Language balance, Act coverage, question types and corpus construction for the Bangladesh legal QA dataset.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(statsQuery),
  component: DatasetPage,
});

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="panel p-4">
      <span className="rule-label">{label}</span>
      <p className="mt-1 font-display text-3xl font-semibold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function DatasetPage() {
  const { data } = useSuspenseQuery(statsQuery);

  return (
    <AppShell>
      <header className="mb-6">
        <span className="rule-label">Exploratory data analysis</span>
        <h1 className="mt-2 text-3xl font-semibold">The corpus behind the system</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          A bilingual question–answer dataset over Bangladeshi Acts. Questions are split
          deterministically into development and held-out test sets, and the statutory sections are
          deduplicated into a single retrieval corpus so no section is indexed twice.
        </p>
      </header>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="QA records" value={data.totalQa.toLocaleString()} />
        <Stat
          label="Train / test"
          value={`${data.trainQa.toLocaleString()} / ${data.testQa.toLocaleString()}`}
          hint="80 / 20 deterministic split"
        />
        <Stat
          label="Corpus sections"
          value={data.corpusDocs.toLocaleString()}
          hint="Deduplicated statutory documents"
        />
        <Stat
          label="TF-IDF features"
          value={data.tfidfFeatures.toLocaleString()}
          hint="Unigrams + bigrams"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="panel p-5">
          <h2 className="mb-3 font-display text-lg font-semibold">Language balance</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.languages}
                  dataKey="count"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={95}
                  paddingAngle={2}
                  label={(e: { name?: string; count?: number }) => `${e.name}: ${e.count}`}
                >
                  {data.languages.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <p className="text-sm text-muted-foreground">
            Roughly balanced Bangla and English coverage — the reason a multilingual embedding model
            is essential and a purely lexical retriever underperforms.
          </p>
        </section>

        <section className="panel p-5">
          <h2 className="mb-3 font-display text-lg font-semibold">Acts covered</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.acts.slice(0, 9)}
                layout="vertical"
                margin={{ left: 8, right: 16 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={130}
                  tick={{ fontSize: 10 }}
                  stroke="var(--muted-foreground)"
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" fill="var(--chart-1)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="panel p-5">
          <h2 className="mb-3 font-display text-lg font-semibold">Question types</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.questionTypes.slice(0, 8)} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="panel p-5">
          <h2 className="mb-3 font-display text-lg font-semibold">Text length statistics</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="rule-label border-b border-border">
                <th className="py-2 text-left">Field</th>
                <th className="py-2 text-right">Mean words</th>
                <th className="py-2 text-right">Min</th>
                <th className="py-2 text-right">Max</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              <tr className="border-b border-border/60">
                <td className="py-2 font-sans">Question</td>
                <td className="py-2 text-right">{data.questionWordStats.mean}</td>
                <td className="py-2 text-right">{data.questionWordStats.min}</td>
                <td className="py-2 text-right">{data.questionWordStats.max}</td>
              </tr>
              <tr>
                <td className="py-2 font-sans">Answer</td>
                <td className="py-2 text-right">{data.answerWordStats.mean}</td>
                <td className="py-2 text-right">{data.answerWordStats.min}</td>
                <td className="py-2 text-right">{data.answerWordStats.max}</td>
              </tr>
            </tbody>
          </table>

          <h3 className="mb-2 mt-5 font-display text-base font-semibold">
            Most frequently questioned sections
          </h3>
          <div className="flex flex-wrap gap-2">
            {data.topSections.map((s) => (
              <span
                key={s.name}
                className="rounded-full border border-border bg-secondary/50 px-3 py-1 text-xs"
              >
                {s.name} <span className="font-mono text-muted-foreground">×{s.count}</span>
              </span>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
