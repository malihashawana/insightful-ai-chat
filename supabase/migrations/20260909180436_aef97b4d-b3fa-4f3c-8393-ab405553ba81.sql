CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE public.legal_sections (
  id BIGSERIAL PRIMARY KEY,
  doc_id INTEGER NOT NULL UNIQUE,
  act TEXT NOT NULL DEFAULT '',
  section TEXT NOT NULL DEFAULT '',
  section_text TEXT NOT NULL,
  n_words INTEGER NOT NULL DEFAULT 0,
  embedding halfvec(3072),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.legal_sections TO anon, authenticated;
GRANT ALL ON public.legal_sections TO service_role;
ALTER TABLE public.legal_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "legal_sections public read" ON public.legal_sections FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.qa_pairs (
  id BIGSERIAL PRIMARY KEY,
  row_id INTEGER NOT NULL UNIQUE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL DEFAULT '',
  act TEXT NOT NULL DEFAULT '',
  section TEXT NOT NULL DEFAULT '',
  language TEXT NOT NULL DEFAULT 'Unknown',
  question_type TEXT NOT NULL DEFAULT 'Unknown',
  difficulty TEXT NOT NULL DEFAULT 'Unknown',
  split TEXT NOT NULL DEFAULT 'train',
  question_words INTEGER NOT NULL DEFAULT 0,
  answer_words INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.qa_pairs TO anon, authenticated;
GRANT ALL ON public.qa_pairs TO service_role;
ALTER TABLE public.qa_pairs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qa_pairs public read" ON public.qa_pairs FOR SELECT TO anon, authenticated USING (true);

CREATE INDEX qa_pairs_split_idx ON public.qa_pairs (split);
CREATE INDEX legal_sections_act_idx ON public.legal_sections (act);

CREATE TABLE public.eval_runs (
  id BIGSERIAL PRIMARY KEY,
  label TEXT NOT NULL DEFAULT 'live run',
  sample_size INTEGER NOT NULL DEFAULT 0,
  results JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.eval_runs TO anon, authenticated;
GRANT ALL ON public.eval_runs TO service_role;
ALTER TABLE public.eval_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "eval_runs public read" ON public.eval_runs FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.match_legal_sections(query_embedding halfvec(3072), match_count INTEGER DEFAULT 5)
RETURNS TABLE (doc_id INTEGER, act TEXT, section TEXT, section_text TEXT, score DOUBLE PRECISION)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT ls.doc_id, ls.act, ls.section, ls.section_text,
         1 - (ls.embedding <=> query_embedding) AS score
  FROM public.legal_sections ls
  WHERE ls.embedding IS NOT NULL
  ORDER BY ls.embedding <=> query_embedding
  LIMIT GREATEST(match_count, 1);
$$;

GRANT EXECUTE ON FUNCTION public.match_legal_sections(halfvec(3072), INTEGER) TO anon, authenticated, service_role;