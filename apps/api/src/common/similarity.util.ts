export function calcJaccardSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 0;

  const setA = new Set(a.map((s) => s.toLowerCase()));
  const setB = new Set(b.map((s) => s.toLowerCase()));

  let intersectionSize = 0;
  for (const item of setA) {
    if (setB.has(item)) intersectionSize++;
  }

  const unionSize = setA.size + setB.size - intersectionSize;
  return unionSize === 0 ? 0 : intersectionSize / unionSize;
}

export function extractKeywords(keywords: string[], fallbackText: string): string[] {
  if (keywords.length > 0) return keywords;
  return fallbackText.split(/\s+/).filter((w) => w.length >= 2);
}

export const DUPLICATE_PERIOD_DAYS: Record<string, number> = {
  '식품': 7,
  '뷰티': 14,
};

export const DEFAULT_DUPLICATE_DAYS = 30;

export function getDuplicatePeriodDays(category: string): number {
  return DUPLICATE_PERIOD_DAYS[category] ?? DEFAULT_DUPLICATE_DAYS;
}
