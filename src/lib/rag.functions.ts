import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  denseRetrieve,
  tfidfRetrieve,
  tfidfStats,
  type RetrievedDoc,
} from "./rag/corpus.server";
import {
  SUPPORT_THRESHOLD,
  sectionMatch,
  verifyCitations,
  type CitationResult,
} from "./rag/verify";

export type RetrievalMethod = "tfidf" | "dense";

export interface Verification extends CitationResult {
  status: "VERIFIED" | "FLAGGED";
  supportScore: number;
  supportValid: boolean;
  threshold: number;
}

export interface AskResult {
  question: string;
  answer: string;
  method: RetrievalMethod;
  topK: number;
  retrieved: RetrievedDoc[];
  verification: Verification;
  latencyMs: number;
}

/** PART L — build the statutory evidence block. */
function buildContext(retrieved: RetrievedDoc[]): string {
  return retrieved
    .map(
      (r, i) => `
SOURCE ${i + 1}

ACT:
${r.act}

SECTION:
${r.section}

STATUTORY TEXT:
${r.text}
`,
    )
    .join("\n");
}

/** PART M — the grounded legal RAG prompt. */
export function createLegalPrompt(question: string, retrieved: RetrievedDoc[]): string {
  return `
You are a careful Bangladesh legal QA assistant.

Answer the user's question ONLY using the statutory
evidence provided below.

IMPORTANT RULES:

1. Do NOT invent any legal rule, deadline, penalty,
   section number, Act name, or factual statement.

2. Every important legal statement must be supported
   by the provided evidence.

3. If the evidence does not clearly establish an answer,
   say:
   "The provided evidence is insufficient to determine this."

4. NEVER guess a limitation period.

5. If a limitation period is mentioned in the evidence,
   reproduce it carefully and only if it is clearly
   supported by the source.

6. ALWAYS provide the legal source at the end.

7. Use EXACTLY this citation format:

Citation: Act Name | Section: Section Number

8. If more than one source is used, list each citation
   on a separate line.

9. Answer in the same language as the question.

10. Keep the answer concise and factual.

QUESTION:
${question}

STATUTORY EVIDENCE:
${buildContext(retrieved)}

Now produce the answer.

ANSWER:
`;
}

const askSchema = z.object({
  question: z.string().min(3).max(2000),
  topK: z.number().int().min(1).max(8).default(3),
  method: z.enum(["tfidf", "dense"]).default("dense"),
});

export const askLegalQuestion = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => askSchema.parse(input))
  .handler(async ({ data }): Promise<AskResult> => {
    const started = Date.now();
    const { chatComplete, embedTexts, cosine } = await import("./rag/ai.server");

    const retrieved =
      data.method === "tfidf"
        ? await tfidfRetrieve(data.question, data.topK)
        : await denseRetrieve(data.question, data.topK);

    if (retrieved.length === 0) {
      return {
        question: data.question,
        answer: "No statutory evidence could be retrieved for this question.",
        method: data.method,
        topK: data.topK,
        retrieved: [],
        verification: {
          status: "FLAGGED",
          supportScore: 0,
          supportValid: false,
          threshold: SUPPORT_THRESHOLD,
          citationFound: false,
          citationValid: false,
          citedSections: [],
          validCitations: [],
          retrievedSections: [],
        },
        latencyMs: Date.now() - started,
      };
    }

    const answer = await chatComplete(createLegalPrompt(data.question, retrieved));

    // PART P — citation verification
    const citation = verifyCitations(answer, retrieved);

    // PART Q — semantic support score between the answer and the evidence
    const evidence = retrieved.map((r) => r.text).join(" ");
    const [answerVec, evidenceVec] = await embedTexts([answer, evidence], "passage");
    const supportScore = answerVec && evidenceVec ? cosine(answerVec, evidenceVec) : 0;
    const supportValid = supportScore >= SUPPORT_THRESHOLD;

    return {
      question: data.question,
      answer,
      method: data.method,
      topK: data.topK,
      retrieved,
      verification: {
        ...citation,
        status: citation.citationValid && supportValid ? "VERIFIED" : "FLAGGED",
        supportScore: Number(supportScore.toFixed(4)),
        supportValid,
        threshold: SUPPORT_THRESHOLD,
      },
      latencyMs: Date.now() - started,
    };
  });

const compareSchema = z.object({
  question: z.string().min(3).max(2000),
  topK: z.number().int().min(1).max(8).default(5),
});

export interface CompareResult {
  question: string;
  topK: number;
  tfidf: RetrievedDoc[];
  dense: RetrievedDoc[];
  overlap: number;
}

export const compareRetrieval = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => compareSchema.parse(input))
  .handler(async ({ data }): Promise<CompareResult> => {
    const [tfidf, dense] = await Promise.all([
      tfidfRetrieve(data.question, data.topK),
      denseRetrieve(data.question, data.topK),
    ]);

    const denseIds = new Set(dense.map((d) => d.doc_id));
    const overlap = tfidf.filter((t) => denseIds.has(t.doc_id)).length;

    return { question: data.question, topK: data.topK, tfidf, dense, overlap };
  });

export interface EvalRow {
  topK: number;
  tfidfRecall: number;
  denseRecall: number;
}

export interface EvalResult {
  sampleSize: number;
  rows: EvalRow[];
  durationMs: number;
}

const evalSchema = z.object({
  sampleSize: z.number().int().min(5).max(60).default(20),
});

export const runRetrievalEvaluation = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => evalSchema.parse(input))
  .handler(async ({ data }): Promise<EvalResult> => {
    const started = Date.now();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { embedTexts } = await import("./rag/ai.server");
    const { denseRetrieveWithVector } = await import("./rag/corpus.server");

    const { data: rows, error } = await supabaseAdmin
      .from("qa_pairs")
      .select("question, section")
      .eq("split", "test")
      .neq("section", "")
      .limit(400);

    if (error) throw new Error(error.message);

    const pool = (rows ?? []).filter((r) => r.section.trim().length > 0);
    // deterministic sample so results are reproducible during the defence
    const sample = pool.slice(0, data.sampleSize);
    const ks = [1, 3, 5];
    const maxK = 5;

    const hits: Record<number, { tfidf: number; dense: number }> = {
      1: { tfidf: 0, dense: 0 },
      3: { tfidf: 0, dense: 0 },
      5: { tfidf: 0, dense: 0 },
    };

    for (const row of sample) {
      const tfidfTop = await tfidfRetrieve(row.question, maxK);
      const [vector] = await embedTexts([row.question], "query");
      const denseTop = await denseRetrieveWithVector(vector!, maxK);

      for (const k of ks) {
        if (tfidfTop.slice(0, k).some((r) => sectionMatch(r.section, row.section))) {
          hits[k]!.tfidf += 1;
        }
        if (denseTop.slice(0, k).some((r) => sectionMatch(r.section, row.section))) {
          hits[k]!.dense += 1;
        }
      }
    }

    const total = sample.length || 1;
    const resultRows: EvalRow[] = ks.map((k) => ({
      topK: k,
      tfidfRecall: Number((hits[k]!.tfidf / total).toFixed(4)),
      denseRecall: Number((hits[k]!.dense / total).toFixed(4)),
    }));

    await supabaseAdmin.from("eval_runs").insert({
      label: "live retrieval evaluation",
      sample_size: sample.length,
      results: resultRows,
    });

    return { sampleSize: sample.length, rows: resultRows, durationMs: Date.now() - started };
  });

export interface DatasetStats {
  totalQa: number;
  trainQa: number;
  testQa: number;
  corpusDocs: number;
  tfidfFeatures: number;
  languages: Array<{ name: string; count: number }>;
  acts: Array<{ name: string; count: number }>;
  questionTypes: Array<{ name: string; count: number }>;
  topSections: Array<{ name: string; count: number }>;
  questionWordStats: { mean: number; min: number; max: number };
  answerWordStats: { mean: number; min: number; max: number };
}

function tally(values: string[], limit?: number): Array<{ name: string; count: number }> {
  const counts = new Map<string, number>();
  for (const v of values) {
    const key = v && v.trim() ? v.trim() : "Unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const sorted = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));
  return limit ? sorted.slice(0, limit) : sorted;
}

export const getDatasetStats = createServerFn({ method: "GET" }).handler(
  async (): Promise<DatasetStats> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const all: Array<{
      language: string;
      act: string;
      section: string;
      question_type: string;
      split: string;
      question_words: number;
      answer_words: number;
    }> = [];

    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabaseAdmin
        .from("qa_pairs")
        .select("language, act, section, question_type, split, question_words, answer_words")
        .range(from, from + pageSize - 1);
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) break;
      all.push(...data);
      if (data.length < pageSize) break;
    }

    const stats = await tfidfStats();

    const mean = (nums: number[]) =>
      nums.length ? Number((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1)) : 0;

    const qWords = all.map((r) => r.question_words);
    const aWords = all.map((r) => r.answer_words);

    return {
      totalQa: all.length,
      trainQa: all.filter((r) => r.split === "train").length,
      testQa: all.filter((r) => r.split === "test").length,
      corpusDocs: stats.documents,
      tfidfFeatures: stats.features,
      languages: tally(all.map((r) => r.language)),
      acts: tally(all.map((r) => r.act)),
      questionTypes: tally(all.map((r) => r.question_type)),
      topSections: tally(all.map((r) => r.section), 15),
      questionWordStats: {
        mean: mean(qWords),
        min: Math.min(...qWords, 0),
        max: Math.max(...qWords, 0),
      },
      answerWordStats: {
        mean: mean(aWords),
        min: Math.min(...aWords, 0),
        max: Math.max(...aWords, 0),
      },
    };
  },
);

export interface SampleQuestion {
  question: string;
  act: string;
  section: string;
  language: string;
}

export const getSampleQuestions = createServerFn({ method: "GET" }).handler(
  async (): Promise<SampleQuestion[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("qa_pairs")
      .select("question, act, section, language")
      .eq("split", "test")
      .limit(120);

    if (error) throw new Error(error.message);

    const rows = data ?? [];
    const bangla = rows.filter((r) => r.language === "Bangla").slice(0, 3);
    const english = rows.filter((r) => r.language === "English").slice(0, 3);
    return [...bangla, ...english];
  },
);
