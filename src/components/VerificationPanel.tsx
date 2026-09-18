import { BadgeCheck, TriangleAlert } from "lucide-react";
import type { Verification } from "@/lib/rag.functions";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/70 py-2 last:border-0">
      <span className="rule-label">{label}</span>
      <span className="text-right font-mono text-xs text-foreground/85">{value}</span>
    </div>
  );
}

export function VerificationPanel({ verification }: { verification: Verification }) {
  const verified = verification.status === "VERIFIED";
  const pct = Math.max(0, Math.min(1, verification.supportScore)) * 100;
  const decisionReasons = [
    verification.citationFound
      ? "The answer contains an identifiable section or article reference."
      : "No machine-readable section or article reference was found in the answer.",
    verification.citationValid
      ? "At least one cited provision matches the retrieved evidence."
      : "The cited provision could not be matched to the retrieved evidence.",
    verification.supportValid
      ? `Semantic support ${verification.supportScore.toFixed(4)} meets the ${verification.threshold.toFixed(2)} threshold.`
      : `Semantic support ${verification.supportScore.toFixed(4)} is below the ${verification.threshold.toFixed(2)} threshold.`,
  ];

  return (
    <div className="panel overflow-hidden">
      <div
        className={`flex items-center gap-2.5 px-4 py-3 ${
          verified ? "bg-verified text-verified-foreground" : "bg-flagged text-flagged-foreground"
        }`}
      >
        {verified ? <BadgeCheck className="size-5" /> : <TriangleAlert className="size-5" />}
        <div>
          <p className="font-display text-sm font-semibold">
            {verified ? "Verified answer" : "Flagged for review"}
          </p>
          <p className="text-xs opacity-90">
            {verified
              ? "Citations match the retrieved statute and the answer is semantically supported."
              : "A citation or the evidence support check did not pass."}
          </p>
        </div>
      </div>

      <div className="px-4 py-3">
        <div className="mb-4 border-b border-border pb-3">
          <span className="rule-label">Why this verdict</span>
          <ol className="mt-2 space-y-1.5 text-sm leading-relaxed text-foreground/85">
            {decisionReasons.map((reason, index) => (
              <li key={reason} className="flex gap-2">
                <span className="font-mono text-xs text-muted-foreground">{index + 1}.</span>
                <span>{reason}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="mb-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="rule-label">Evidence support</span>
            <span className="font-mono text-xs">
              {verification.supportScore.toFixed(4)} / threshold {verification.threshold}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className={`h-full rounded-full ${verification.supportValid ? "bg-verified" : "bg-flagged"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <Row label="Citation found" value={verification.citationFound ? "yes" : "no"} />
        <Row label="Citation valid" value={verification.citationValid ? "yes" : "no"} />
        <Row
          label="Cited sections"
          value={verification.citedSections.join(", ") || "—"}
        />
        <Row
          label="Matched citations"
          value={verification.validCitations.join(", ") || "—"}
        />
        <Row
          label="Retrieved sections"
          value={verification.retrievedSections.join(" · ") || "—"}
        />
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          This verdict measures traceability to the retrieved text, not whether a court would adopt
          the interpretation. A verified answer can still require expert legal review.
        </p>
      </div>
    </div>
  );
}
