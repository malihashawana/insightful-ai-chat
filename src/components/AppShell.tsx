import { Link } from "@tanstack/react-router";
import { Scale } from "lucide-react";
import type { ReactNode } from "react";

const NAV = [
  { to: "/", label: "Assistant" },
  { to: "/retrieval", label: "Retrieval Lab" },
  { to: "/evaluation", label: "Evaluation" },
  { to: "/dataset", label: "Dataset" },
  { to: "/method", label: "Methodology" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Scale className="size-4.5" />
            </span>
            <span className="leading-tight">
              <span className="block font-display text-base font-semibold">
                Bangladesh Legal RAG
              </span>
              <span className="rule-label">Retrieval · Generation · Verification</span>
            </span>
          </Link>

          <nav className="flex flex-wrap items-center gap-1 text-sm">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.to === "/" }}
                className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground data-[status=active]:bg-secondary data-[status=active]:font-medium data-[status=active]:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>

      <footer className="mx-auto max-w-6xl px-5 pb-10 pt-4">
        <p className="text-xs text-muted-foreground">
          Research prototype for academic evaluation. Retrieved statutory text is reproduced from the
          Bangladesh Legal QA dataset and is not legal advice.
        </p>
      </footer>
    </div>
  );
}
