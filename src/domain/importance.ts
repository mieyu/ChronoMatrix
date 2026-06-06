export const minImportanceScore = 0;
export const maxImportanceScore = 10;
export const defaultImportanceScore = 7;
export const importantScoreThreshold = 6;

export function normalizeImportanceScore(score: number): number {
  if (!Number.isFinite(score)) {
    return defaultImportanceScore;
  }

  const tenPointScore = score > maxImportanceScore ? score / 10 : score;

  return clamp(Math.round(tenPointScore), minImportanceScore, maxImportanceScore);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
