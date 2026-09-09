/**
 * TF-IDF lexical baseline — a TypeScript port of the notebook's
 * `TfidfVectorizer(max_features=30000, ngram_range=(1,2), sublinear_tf=True)`
 * followed by cosine similarity ranking.
 *
 * Matches scikit-learn's behaviour:
 *  - sublinear term frequency: tf -> 1 + log(tf)
 *  - smoothed idf: ln((1 + n) / (1 + df)) + 1
 *  - L2 normalised document vectors, cosine similarity scoring
 * Tokenisation is Unicode aware so Bangla and English are handled the same way.
 */

const TOKEN_RE = /[\p{L}\p{N}]+/gu;

export function tokenize(text: string): string[] {
  const lowered = text.toLowerCase();
  const unigrams = lowered.match(TOKEN_RE) ?? [];
  const grams: string[] = [...unigrams];
  for (let i = 0; i + 1 < unigrams.length; i++) {
    grams.push(`${unigrams[i]} ${unigrams[i + 1]}`);
  }
  return grams;
}

export type SparseVector = Map<number, number>;

export interface TfidfIndex {
  vocabulary: Map<string, number>;
  idf: Float64Array;
  docVectors: SparseVector[];
  nDocs: number;
  nFeatures: number;
}

export function buildTfidfIndex(documents: string[], maxFeatures = 30000): TfidfIndex {
  const docTokens = documents.map(tokenize);

  // document frequency
  const df = new Map<string, number>();
  for (const tokens of docTokens) {
    for (const term of new Set(tokens)) {
      df.set(term, (df.get(term) ?? 0) + 1);
    }
  }

  // keep the most frequent `maxFeatures` terms, like sklearn's max_features
  const kept = [...df.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxFeatures);

  const vocabulary = new Map<string, number>();
  const idf = new Float64Array(kept.length);
  const nDocs = documents.length;

  kept.forEach(([term, freq], i) => {
    vocabulary.set(term, i);
    idf[i] = Math.log((1 + nDocs) / (1 + freq)) + 1;
  });

  const docVectors = docTokens.map((tokens) => vectorize(tokens, vocabulary, idf));

  return { vocabulary, idf, docVectors, nDocs, nFeatures: kept.length };
}

function vectorize(
  tokens: string[],
  vocabulary: Map<string, number>,
  idf: Float64Array,
): SparseVector {
  const counts = new Map<number, number>();
  for (const term of tokens) {
    const idx = vocabulary.get(term);
    if (idx === undefined) continue;
    counts.set(idx, (counts.get(idx) ?? 0) + 1);
  }

  const vec: SparseVector = new Map();
  let norm = 0;
  for (const [idx, tf] of counts) {
    const weight = (1 + Math.log(tf)) * idf[idx];
    vec.set(idx, weight);
    norm += weight * weight;
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (const [idx, weight] of vec) vec.set(idx, weight / norm);
  }
  return vec;
}

export function transformQuery(index: TfidfIndex, query: string): SparseVector {
  return vectorize(tokenize(query), index.vocabulary, index.idf);
}

export function cosineSparse(a: SparseVector, b: SparseVector): number {
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [idx, weight] of small) {
    const other = large.get(idx);
    if (other !== undefined) dot += weight * other;
  }
  return dot;
}

/** Rank documents for a query, returning [documentIndex, score] pairs. */
export function tfidfRank(index: TfidfIndex, query: string, topK: number): Array<[number, number]> {
  const q = transformQuery(index, query);
  const scored: Array<[number, number]> = [];
  for (let i = 0; i < index.docVectors.length; i++) {
    const score = cosineSparse(q, index.docVectors[i]);
    if (score > 0) scored.push([i, score]);
  }
  scored.sort((a, b) => b[1] - a[1]);
  return scored.slice(0, topK);
}
