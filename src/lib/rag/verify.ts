/**
 * Answer verification — direct port of notebook PART P/Q/R:
 * citation extraction, citation validation against retrieved evidence,
 * and an embedding based semantic support score with a 0.65 threshold.
 */

const BENGALI_DIGITS = "০১২৩৪৫৬৭৮৯";

export function toEnglishDigits(text: string): string {
  return text.replace(/[০-৯]/g, (d) => String(BENGALI_DIGITS.indexOf(d)));
}

export function normalizeCitation(text: string): string {
  let out = toEnglishDigits(String(text).toLowerCase().trim());
  out = out.replace(/[^a-z0-9]+/g, " ").trim();
  return out;
}

/** Extract cited section / article numbers from an answer (English + Bangla). */
export function extractCitations(text: string): string[] {
  const citations: string[] = [];

  for (const m of text.matchAll(/(?:section|sec\.?)\s*([0-9]+[A-Za-z]?)/gi)) {
    citations.push(m[1]!);
  }
  for (const m of text.matchAll(/sections\s*([0-9A-Za-z]+)\s*(?:&|and|,)\s*([0-9A-Za-z]+)/gi)) {
    citations.push(m[1]!, m[2]!);
  }
  for (const m of text.matchAll(/schedule\s*(?:i|[0-9]+)\s*article\s*([0-9]+[A-Za-z]?)/gi)) {
    citations.push(`Article ${m[1]!}`);
  }
  for (const m of text.matchAll(/article\s*([0-9]+[A-Za-z]?)/gi)) {
    citations.push(`Article ${m[1]!}`);
  }
  for (const m of text.matchAll(/ধারা\s*([০-৯0-9]+[ক-হ]?)/g)) {
    citations.push(toEnglishDigits(m[1]!));
  }
  for (const m of text.matchAll(/অনুচ্ছেদ\s*([০-৯0-9]+)/g)) {
    citations.push(`Article ${toEnglishDigits(m[1]!)}`);
  }

  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const c of citations) {
    const key = normalizeCitation(c);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    cleaned.push(c.trim());
  }
  return cleaned;
}

export function citationMatches(cited: string, retrieved: string): boolean {
  const citedNorm = normalizeCitation(cited);
  const retrievedNorm = normalizeCitation(retrieved);
  if (!citedNorm || !retrievedNorm) return false;
  if (citedNorm === retrievedNorm) return true;

  const citedNumbers = citedNorm.match(/\d+/g);
  const retrievedNumbers = retrievedNorm.match(/\d+/g);
  if (citedNumbers && retrievedNumbers) {
    if (citedNumbers[citedNumbers.length - 1]! === retrievedNumbers[retrievedNumbers.length - 1]!) {
      if (retrievedNorm.includes("section") || retrievedNorm.includes("article")) return true;
    }
  }
  return false;
}

export interface CitationResult {
  citationFound: boolean;
  citationValid: boolean;
  citedSections: string[];
  validCitations: string[];
  retrievedSections: string[];
}

export function verifyCitations(
  answer: string,
  retrieved: Array<{ section: string }>,
): CitationResult {
  const citedSections = extractCitations(answer);
  const retrievedSections = retrieved.map((r) => String(r.section).trim()).filter(Boolean);

  const validCitations = citedSections.filter((cited) =>
    retrievedSections.some((r) => citationMatches(cited, r)),
  );

  return {
    citationFound: citedSections.length > 0,
    citationValid: citedSections.length > 0 && validCitations.length > 0,
    citedSections,
    validCitations,
    retrievedSections,
  };
}

/** Normalise a section label for Recall@K gold matching (notebook PART I1/I2). */
export function normalizeSection(value: string): string {
  return toEnglishDigits(String(value).toLowerCase()).replace(/[^0-9a-z]/g, "");
}

export function sectionMatch(retrievedSection: string, goldSection: string): boolean {
  const retrieved = normalizeSection(retrievedSection);
  const gold = normalizeSection(goldSection);
  if (!retrieved || !gold) return false;
  return retrieved === gold || gold.includes(retrieved) || retrieved.includes(gold);
}

export const SUPPORT_THRESHOLD = 0.65;
