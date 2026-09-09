/**
 * Corpus access + cached TF-IDF index (server only).
 */
import { buildTfidfIndex, tfidfRank, type TfidfIndex } from "./tfidf";

export interface CorpusDoc {
  doc_id: number;
  act: string;
  section: string;
  section_text: string;
}

export interface RetrievedDoc {
  doc_id: number;
  rank: number;
  score: number;
  act: string;
  section: string;
  text: string;
}

let corpusCache: CorpusDoc[] | null = null;
let indexCache: TfidfIndex | null = null;

export async function loadCorpus(): Promise<CorpusDoc[]> {
  if (corpusCache) return corpusCache;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const docs: CorpusDoc[] = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseAdmin
      .from("legal_sections")
      .select("doc_id, act, section, section_text")
      .order("doc_id", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    docs.push(...data);
    if (data.length < pageSize) break;
  }

  corpusCache = docs;
  return docs;
}

export async function getTfidfIndex(): Promise<{ index: TfidfIndex; docs: CorpusDoc[] }> {
  const docs = await loadCorpus();
  if (!indexCache) {
    indexCache = buildTfidfIndex(docs.map((d) => d.section_text));
  }
  return { index: indexCache, docs };
}

export async function tfidfRetrieve(query: string, topK: number): Promise<RetrievedDoc[]> {
  const { index, docs } = await getTfidfIndex();
  return tfidfRank(index, query, topK).map(([docIndex, score], i) => {
    const doc = docs[docIndex]!;
    return {
      doc_id: doc.doc_id,
      rank: i + 1,
      score,
      act: doc.act,
      section: doc.section,
      text: doc.section_text,
    };
  });
}

export async function denseRetrieve(query: string, topK: number): Promise<RetrievedDoc[]> {
  const { embedTexts } = await import("./ai.server");
  const [vector] = await embedTexts([query], "query");
  return denseRetrieveWithVector(vector!, topK);
}

export async function denseRetrieveWithVector(
  vector: number[],
  topK: number,
): Promise<RetrievedDoc[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("match_legal_sections", {
    query_embedding: JSON.stringify(vector),
    match_count: topK,
  });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row, i) => ({
    doc_id: row.doc_id,
    rank: i + 1,
    score: row.score,
    act: row.act,
    section: row.section,
    text: row.section_text,
  }));
}

export interface TfidfStats {
  documents: number;
  features: number;
}

export async function tfidfStats(): Promise<TfidfStats> {
  const { index, docs } = await getTfidfIndex();
  return { documents: docs.length, features: index.nFeatures };
}
