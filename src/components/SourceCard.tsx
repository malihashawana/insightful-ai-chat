import { useState } from "react";
import { ChevronDown } from "lucide-react";

export interface SourceDoc {
  doc_id: number;
  rank: number;
  score: number;
  act: string;
  section: string;
  text: string;
}

export function SourceCard({
  doc,
  tone = "primary",
  highlight = false,
}: {
  doc: SourceDoc;
  tone?: "primary" | "seal";
  highlight?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const preview = doc.text.length > 260 ? `${doc.text.slice(0, 260)}…` : doc.text;

  return (
    <div
      className={`panel p-4 ${highlight ? "ring-1 ring-seal/50" : ""}`}
      data-doc-id={doc.doc_id}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="rule-label">Rank {doc.rank}</span>
          <h4 className="mt-1 font-display text-base font-semibold">{doc.act || "Unknown Act"}</h4>
          <p className="text-sm text-muted-foreground">{doc.section || "Unspecified section"}</p>
        </div>
        <span
          className={`shrink-0 rounded-md px-2 py-1 font-mono text-xs ${
            tone === "seal" ? "bg-seal/15 text-seal" : "bg-primary/10 text-primary"
          }`}
        >
          {doc.score.toFixed(4)}
        </span>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-foreground/85">
        {open ? doc.text : preview}
      </p>

      {doc.text.length > 260 && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-seal hover:underline"
        >
          {open ? "Show less" : "Read full statutory text"}
          <ChevronDown className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      )}
    </div>
  );
}
