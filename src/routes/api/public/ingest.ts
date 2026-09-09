/**
 * One-time data-loading endpoint used to populate the legal corpus, the QA
 * dataset and the dense embeddings. Protected by a server-side token.
 */
import { createFileRoute } from "@tanstack/react-router";
import { embedTexts } from "@/lib/rag/ai.server";

interface SectionRow {
  doc_id: number;
  act: string;
  section: string;
  section_text: string;
  n_words: number;
}

interface QaRow {
  row_id: number;
  question: string;
  answer: string;
  act: string;
  section: string;
  language: string;
  question_type: string;
  difficulty: string;
  split: string;
  question_words: number;
  answer_words: number;
}

interface Body {
  token?: string;
  phase?: "sections" | "qa" | "embed";
  sections?: SectionRow[];
  qa?: QaRow[];
  limit?: number;
}

export const Route = createFileRoute("/api/public/ingest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as Body;
        const expected = process.env["INGEST_TOKEN"];

        if (!expected || body.token !== expected) {
          return Response.json({ error: "unauthorized" }, { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        if (body.phase === "sections" && body.sections?.length) {
          const { error } = await supabaseAdmin
            .from("legal_sections")
            .upsert(body.sections, { onConflict: "doc_id" });
          if (error) return Response.json({ error: error.message }, { status: 500 });
          return Response.json({ inserted: body.sections.length });
        }

        if (body.phase === "qa" && body.qa?.length) {
          const { error } = await supabaseAdmin
            .from("qa_pairs")
            .upsert(body.qa, { onConflict: "row_id" });
          if (error) return Response.json({ error: error.message }, { status: 500 });
          return Response.json({ inserted: body.qa.length });
        }

        if (body.phase === "embed") {
          const limit = Math.min(body.limit ?? 32, 64);
          const { data, error } = await supabaseAdmin
            .from("legal_sections")
            .select("doc_id, section_text")
            .is("embedding", null)
            .order("doc_id", { ascending: true })
            .limit(limit);

          if (error) return Response.json({ error: error.message }, { status: 500 });
          if (!data || data.length === 0) return Response.json({ embedded: 0, remaining: 0 });

          const vectors = await embedTexts(
            data.map((row) => row.section_text),
            "passage",
          );

          for (let i = 0; i < data.length; i++) {
            const { error: updateError } = await supabaseAdmin
              .from("legal_sections")
              .update({ embedding: JSON.stringify(vectors[i]) })
              .eq("doc_id", data[i]!.doc_id);
            if (updateError) {
              return Response.json({ error: updateError.message }, { status: 500 });
            }
          }

          const { count } = await supabaseAdmin
            .from("legal_sections")
            .select("doc_id", { count: "exact", head: true })
            .is("embedding", null);

          return Response.json({ embedded: data.length, remaining: count ?? 0 });
        }

        return Response.json({ error: "nothing to do" }, { status: 400 });
      },
    },
  },
});
