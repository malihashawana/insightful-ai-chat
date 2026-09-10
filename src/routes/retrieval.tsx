import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2 } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { SourceCard } from "@/components/SourceCard";
import { compareRetrieval } from "@/lib/rag.functions";

export const Route = createFileRoute("/retrieval")({
  head: () => ({
    meta: [
      { title: "Retrieval Lab — TF-IDF vs Dense Retrieval on Bangladeshi Statutes" },
      {
        name: "description",
        content:
          "Run the same legal query through the lexical TF-IDF baseline and dense multilingual embedding retrieval, and compare ranked statutory sections side by side.",
      },
      { property: "og:title", content: "Retrieval Lab — TF-IDF vs Dense Retrieval" },
      {
        property: "og:description",
        content:
          "Side-by-side comparison of lexical and semantic retrieval over a 1,614-section Bangladeshi statutory corpus.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RetrievalLab,
});

const EXAMPLES = [
  "What is the punishment for criminal breach of trust?",
  "ভূমি রেজিস্ট্রেশনের জন্য কী কী দলিল প্রয়োজন?",
  "How long do I have to file an appeal?",
];

function RetrievalLab() {
  const compare = useServerFn(compareRetrieval);
  const [query, setQuery] = useState(EXAMPLES[0]!);
  const [topK, setTopK] = useState(5);

  const mutation = useMutation({
    mutationFn: (q: string) => compare({ data: { question: q, topK } }),
  });

  return (
    <AppShell>
      <header className="mb-6">
        <span className="rule-label">Experiment 1 — retrieval comparison</span>
        <h1 className="mt-2 text-3xl font-semibold">Lexical vs semantic retrieval</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          TF-IDF matches surface word overlap (unigrams and bigrams, sublinear term frequency,
          cosine similarity on L2-normalised sparse vectors). Dense retrieval matches meaning across
          Bangla and English using normalised multilingual embeddings with inner-product search.
          Scores are cosine similarities in both panels, so they are directly comparable.
        </p>
      </header>

      <form
        className="panel mb-6 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim()) mutation.mutate(query.trim());
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter a legal query in Bangla or English"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-seal"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <span className="rule-label">Top-K</span>
            <input
              type="range"
              min={1}
              max={8}
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
              className="accent-[var(--seal)]"
            />
            <span className="font-mono text-sm">{topK}</span>
          </label>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="ml-auto inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            Run comparison
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setQuery(ex)}
              className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:border-seal hover:text-foreground"
            >
              {ex}
            </button>
          ))}
        </div>
      </form>

      {mutation.isError && (
        <p className="panel border-destructive/40 p-4 text-sm text-destructive">
          {(mutation.error as Error).message}
        </p>
      )}

      {mutation.data && (
        <>
          <div className="panel mb-6 flex flex-wrap items-center gap-6 p-4">
            <div>
              <span className="rule-label">Result overlap</span>
              <p className="font-display text-2xl font-semibold">
                {mutation.data.overlap} / {mutation.data.topK}
              </p>
            </div>
            <p className="max-w-xl text-sm text-muted-foreground">
              Sections returned by both retrievers. Low overlap shows the two methods surface
              genuinely different evidence — the core argument for preferring semantic retrieval on
              a bilingual statutory corpus.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <section>
              <h2 className="mb-3 font-display text-lg font-semibold">TF-IDF baseline</h2>
              <div className="grid gap-3">
                {mutation.data.tfidf.map((doc) => (
                  <SourceCard key={`t-${doc.doc_id}`} doc={doc} />
                ))}
              </div>
            </section>
            <section>
              <h2 className="mb-3 font-display text-lg font-semibold">Dense retrieval</h2>
              <div className="grid gap-3">
                {mutation.data.dense.map((doc) => (
                  <SourceCard
                    key={`d-${doc.doc_id}`}
                    doc={doc}
                    tone="seal"
                    highlight={mutation.data!.tfidf.some((t) => t.doc_id === doc.doc_id)}
                  />
                ))}
              </div>
            </section>
          </div>
        </>
      )}
    </AppShell>
  );
}
