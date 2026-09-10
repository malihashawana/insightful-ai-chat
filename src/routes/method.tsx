import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/method")({
  head: () => ({
    meta: [
      { title: "Methodology — Grounded Legal RAG with Automatic Answer Verification" },
      {
        name: "description",
        content:
          "Pipeline design, retrieval mathematics, prompt constraints, citation checking and evidence support scoring behind the Bangladesh legal RAG system.",
      },
      { property: "og:title", content: "Methodology — Grounded Legal RAG" },
      {
        property: "og:description",
        content:
          "How the corpus, retrievers, constrained generation and two-stage verification layer fit together, with defence talking points.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MethodPage,
});

function Section({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel p-5">
      <span className="rule-label">Stage {n}</span>
      <h2 className="mb-2 mt-1 font-display text-lg font-semibold">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-foreground/85">{children}</div>
    </section>
  );
}

function MethodPage() {
  return (
    <AppShell>
      <header className="mb-6">
        <span className="rule-label">Defence documentation</span>
        <h1 className="mt-2 text-3xl font-semibold">Methodology and design rationale</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          The system answers Bangladeshi legal questions only from retrieved statutory text, and
          treats every generated answer as untrusted until it passes two independent checks.
        </p>
      </header>

      <div className="panel mb-6 overflow-x-auto p-5">
        <span className="rule-label">System architecture</span>
        <pre className="mt-3 whitespace-pre font-mono text-xs leading-5 text-foreground/80">{`  question (Bangla / English)
         |
         v
  +--------------------------+        +--------------------------+
  |  TF-IDF retriever        |   or   |  Dense retriever         |
  |  unigram+bigram, sublin. |        |  normalised embeddings   |
  |  tf, L2, cosine          |        |  inner product = cosine  |
  +--------------------------+        +--------------------------+
         |                                      |
         +----------------+---------------------+
                          v
              top-K statutory sections (evidence)
                          |
                          v
              constrained generation prompt
              (no invention, cite or refuse)
                          |
                          v
                  candidate answer
                          |
         +----------------+---------------------+
         v                                      v
  citation check                        evidence support
  (sections cited must                  cos(answer, evidence)
   appear in retrieved set)             >= 0.65 threshold
         |                                      |
         +----------------+---------------------+
                          v
                  VERIFIED  /  FLAGGED`}</pre>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section n="1" title="Corpus construction">
          <p>
            The QA dataset repeats the same statutory text across many questions. Sections are
            deduplicated on Act, section number and section text, and anything shorter than a
            meaningful statutory passage is dropped. This produces 1,614 unique documents, so
            retrieval ranks distinct law rather than duplicates of the same provision.
          </p>
          <p>
            Questions are split deterministically 80/20 into a development set and a held-out test
            set, so evaluation never scores questions the system was tuned on.
          </p>
        </Section>

        <Section n="2" title="Lexical baseline (TF-IDF)">
          <p>
            A Unicode-aware tokenizer handles Bangla and Latin scripts. Term frequency is sublinear,
            <span className="font-mono"> 1 + log(tf)</span>; inverse document frequency is smoothed,
            <span className="font-mono"> log((1+n)/(1+df)) + 1</span>; unigrams and bigrams are both
            indexed and vectors are L2-normalised, so the dot product is exactly cosine similarity.
          </p>
          <p>
            This is the honest baseline: it is strong when the question reuses statutory wording and
            it collapses when a Bangla question asks about an English section, or vice versa.
          </p>
        </Section>

        <Section n="3" title="Dense semantic retrieval">
          <p>
            Every statutory section is embedded once and stored as a vector in the database.
            Question embeddings are compared by inner product over normalised vectors — the same
            mathematics as the FAISS <span className="font-mono">IndexFlatIP</span> index in the
            research notebook, with asymmetric query/passage prefixing preserved.
          </p>
          <p className="rounded-md border border-seal/40 bg-seal/5 p-3 text-xs">
            <strong>Disclosure for the defence:</strong> the notebook used{" "}
            <span className="font-mono">intfloat/multilingual-e5-base</span> (768-dim) with a FAISS
            flat inner-product index. Python and FAISS cannot run inside a web runtime, so this
            deployment uses a hosted multilingual embedding model with a vector index in the
            database. The retrieval mathematics, normalisation, prefixing and evaluation protocol
            are unchanged; the absolute similarity values differ because the encoder differs.
          </p>
        </Section>

        <Section n="4" title="Constrained generation">
          <p>
            The generator receives only the retrieved sections and is instructed never to invent a
            rule, deadline, penalty, section number or Act; to answer in the language of the
            question; to refuse when the evidence is insufficient; and to emit citations in a fixed
            machine-checkable format. Limitation periods must never be guessed — the single most
            dangerous hallucination in legal advice.
          </p>
        </Section>

        <Section n="5" title="Verification layer">
          <p>
            <strong>Citation check:</strong> section and article references are extracted from the
            answer in both English and Bangla, Bengali numerals are normalised to Latin digits, and
            each reference must correspond to a section actually present in the retrieved evidence.
          </p>
          <p>
            <strong>Evidence support:</strong> the answer and the concatenated evidence are embedded
            and compared by cosine similarity; a score below <span className="font-mono">0.65</span>{" "}
            means the answer drifted away from its sources.
          </p>
          <p>
            An answer is <span className="font-medium text-verified">VERIFIED</span> only when both
            checks pass; otherwise it is{" "}
            <span className="font-medium text-flagged">FLAGGED</span> and shown with its failure
            reason rather than hidden.
          </p>
        </Section>

        <Section n="6" title="Limitations and future work">
          <p>
            Recall@5 near 0.61 means roughly two in five questions do not retrieve their gold
            section — a generation ceiling no prompt can fix. Hybrid lexical-plus-dense fusion,
            reranking, and section-aware chunking are the natural next steps.
          </p>
          <p>
            The support score measures semantic proximity, not legal correctness: a fluent answer
            paraphrasing the wrong section can still score highly, which is exactly why the citation
            check is a separate and independent gate.
          </p>
          <p>Output is a research artefact for academic evaluation, not legal advice.</p>
        </Section>
      </div>

      <section className="panel mt-6 p-5">
        <span className="rule-label">Talking points</span>
        <h2 className="mb-3 mt-1 font-display text-lg font-semibold">Likely defence questions</h2>
        <ul className="space-y-2 text-sm leading-relaxed text-foreground/85">
          <li>
            <strong>Why not just fine-tune a model?</strong> Statutes change and hallucinated law is
            unacceptable. Retrieval keeps the answer attached to a citable source and lets the
            corpus be updated without retraining.
          </li>
          <li>
            <strong>Why does dense retrieval beat TF-IDF?</strong> The dataset is bilingual. Lexical
            overlap fails across scripts; a multilingual embedding space places a Bangla question
            near its English statutory section.
          </li>
          <li>
            <strong>Is the support threshold arbitrary?</strong> 0.65 was set from observed score
            distributions; the panel exposes the raw score so a grader can judge the boundary rather
            than trust a binary verdict.
          </li>
          <li>
            <strong>What happens when retrieval fails?</strong> The generator is instructed to state
            that the evidence is insufficient, and the verification layer flags the answer instead of
            presenting it as authoritative.
          </li>
        </ul>
      </section>
    </AppShell>
  );
}
