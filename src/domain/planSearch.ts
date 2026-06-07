import { deriveEffectiveStatus, type Plan } from "./plan";

export interface PlanSearchResult {
  plan: Plan;
}

/** Normalize a string for case-insensitive, whitespace-tolerant matching. */
function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Filter plans by a free-text query. The query is split into terms; every term
 * must appear in the plan title or description (AND semantics). An empty query
 * returns no results so the search surface stays quiet until the user types.
 */
export function searchPlans(plans: Plan[], query: string): Plan[] {
  const terms = normalize(query)
    .split(/\s+/)
    .filter((term) => term.length > 0);

  if (terms.length === 0) {
    return [];
  }

  return plans.filter((plan) => {
    const haystack = `${plan.title}\n${plan.description}`.toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}

/**
 * Order search results so the most actionable plans surface first:
 * expired, then in-progress, then by importance, then by title.
 */
export function sortSearchResults(plans: Plan[], now: Date): Plan[] {
  const rank: Record<string, number> = {
    expired: 0,
    in_progress: 1,
    not_started: 2,
    completed: 3,
    archived: 4,
  };

  return [...plans].sort((a, b) => {
    const statusDelta =
      rank[deriveEffectiveStatus(a, now)] - rank[deriveEffectiveStatus(b, now)];
    if (statusDelta !== 0) {
      return statusDelta;
    }

    if (b.importanceScore !== a.importanceScore) {
      return b.importanceScore - a.importanceScore;
    }

    return a.title.localeCompare(b.title);
  });
}
