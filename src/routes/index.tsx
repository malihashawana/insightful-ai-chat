import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { SourceCard } from "@/components/SourceCard";
import { VerificationPanel } from "@/components/VerificationPanel";
import {
  askLegalQuestion,
  getSampleQuestions,
  type AskResult,
  type RetrievalMethod,
} from "@/lib/rag.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bangladesh Legal RAG Assistant — Verified Statutory Answers" },
      {
        name: "description",
        content:
          "Bilingual retrieval-augmented legal QA over Bangladeshi statutes, with dense and TF-IDF retrieval and automatic citation and evidence verification.",
      },
      { property: "og:title", content: "Bangladesh Legal RAG Assistant" },
      {
        property: "og:description",
        content:
          "Ask legal questions in Bangla or English and get answers grounded in retrieved statutory text, with citation and support verification.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AssistantPage,
});

interface Turn {
  id: number;
  question: string;
  result?: AskResult;
  error?: string;
}

function AssistantPage() {
  const ask = useServerFn(askLegalQuestion);
  const samples = useQuery({
    queryKey: ["samples"],
    queryFn: () => getSampleQuestions(),
    staleTime: Infinity,
  });

  const [input, setInput] = useState("");
  const [method, setMethod] = useState<RetrievalMethod>("dense");
  const [topK, setTopK] = useState(3);
  const [turns, setTurns] = useState<Turn[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const mutation = useMutation({
    mutationFn: (question: string) => ask({ data: { question, topK, method } }),
    onSuccess: (result) =>
      setTurns((prev) =>
        prev.map((t) => (t.question === result.question && !t.result ? { ...t, result } : t)),
      ),
    onError: (error: Error) =>
      setTurns((prev) =>
        prev.map((t, i) =>
          i === prev.length - 1 ? { ...t, error: error.message || "Request failed" } : t,
        ),
      ),
  });

  useEffect(() => {
    textareaRef.current?.focus();
  }, [mutation.isPending]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, mutation.isPending]);

  function submit(question: string) {
    const trimmed = question.trim();
    if (!trimmed || mutation.isPending) return;
    setTurns((prev) => [...prev, { id: Date.now(), question: trimmed }]);
    setInput("");
    mutation.mutate(trimmed);
  }

  return (
    <AppShell>
      <div className="grid gap-8 lg:grid-cols-[1fr_18rem]">
        <div>
          <header className="mb-6">
            <span className="rule-label">Retrieval-augmented legal question answering</span>
            <h1 className="mt-2 text-3xl font-semibold">
              Ask a Bangladeshi legal question — in Bangla or English
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Every answer is generated strictly from statutory sections retrieved out of a
              1,614-section corpus, then checked automatically for citation validity and evidence
              support before it is shown to you.
            </p>
          </header>

          {turns.length === 0 && (
            <div className="panel mb-6 p-5">
              <span className="rule-label">Try a question from the held-out test split</span>
              <div className="mt-3 flex flex-col gap-2">
                {(samples.data ?? []).map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => submit(s.question)}
                    className="rounded-md border border-border bg-secondary/40 px-3 py-2 text-left text-sm transition-colors hover:border-seal/60 hover:bg-secondary"
                  >
                    <span className="line-clamp-2">{s.question}</span>
                    <span className="rule-label mt-1 block">
                      {s.language} · gold: {s.section || "—"}
                    </span>
                  </button>
                ))}
                {samples.isLoading && (
                  <p className="text-sm text-muted-foreground">Loading example questions…</p>
                )}
              </div>
            </div>
          )}

          <div className="space-y-8">
            {turns.map((turn) => (
              <article key={turn.id} className="space-y-4">
                <div className="flex justify-end">
                  <p className="max-w-2xl rounded-lg rounded-br-sm bg-primary px-4 py-2.5 text-sm leading-relaxed text-primary-foreground">
                    {turn.question}
                  </p>
                </div>

                {turn.error && (
                  <p className="panel border-destructive/40 p-4 text-sm text-destructive">
                    {turn.error}
                  </p>
                )}

                {turn.result && (
                  <div className="space-y-4">
                    <div className="panel p-5">
                      <div className="mb-3 flex flex-wrap items-center gap-3">
                        <span className="rule-label">Generated answer</span>
                        <span className="rounded bg-secondary px-2 py-0.5 font-mono text-[11px]">
                          {turn.result.method === "dense" ? "dense retrieval" : "TF-IDF retrieval"} ·
                          top-{turn.result.topK} · {(turn.result.latencyMs / 1000).toFixed(1)}s
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap text-[15px] leading-7">
                        {turn.result.answer}
                      </p>
                    </div>

                    <VerificationPanel verification={turn.result.verification} />

                    <div>
                      <span className="rule-label">
                        Statutory evidence used ({turn.result.retrieved.length} sources)
                      </span>
                      <div className="mt-3 grid gap-3">
                        {turn.result.retrieved.map((doc) => (
                          <SourceCard key={doc.doc_id} doc={doc} tone="seal" />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </article>
            ))}

            {mutation.isPending && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Retrieving statutes, generating and verifying the answer…
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form
            className="panel sticky bottom-4 mt-8 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              submit(input);
            }}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit(input);
                }
              }}
              rows={2}
              placeholder="যেমন: জমি দখল করে নিলে আমি কী আইনগত ব্যবস্থা নিতে পারি?"
              className="w-full resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground/70"
            />
            <div className="flex items-center justify-end pt-1">
              <button
                type="submit"
                disabled={mutation.isPending || !input.trim()}
                className="inline-flex size-9 items-center justify-center rounded-md bg-seal text-seal-foreground transition-opacity disabled:opacity-40"
                aria-label="Send question"
              >
                {mutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
              </button>
            </div>
          </form>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="panel p-4">
            <span className="rule-label">Retriever</span>
            <div className="mt-2 grid gap-2">
              {(
                [
                  ["dense", "Dense (multilingual embeddings)"],
                  ["tfidf", "TF-IDF (lexical baseline)"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMethod(value)}
                  className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                    method === value
                      ? "border-seal bg-seal/10 font-medium"
                      : "border-border hover:bg-secondary"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="panel p-4">
            <div className="flex items-center justify-between">
              <span className="rule-label">Top-K evidence</span>
              <span className="font-mono text-sm">{topK}</span>
            </div>
            <input
              type="range"
              min={1}
              max={5}
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
              className="mt-3 w-full accent-[var(--seal)]"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              The number of statutory sections passed to the generator as evidence.
            </p>
          </div>

          <div className="panel p-4">
            <span className="rule-label">Pipeline</span>
            <ol className="mt-2 space-y-1.5 text-sm text-muted-foreground">
              <li>1. Retrieve statutory sections</li>
              <li>2. Build grounded prompt</li>
              <li>3. Generate constrained answer</li>
              <li>4. Verify citations</li>
              <li>5. Score evidence support</li>
            </ol>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
