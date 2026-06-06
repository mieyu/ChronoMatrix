import { describe, expect, test } from "vitest";
import {
  defaultImportanceScore,
  importantScoreThreshold,
  normalizeImportanceScore,
} from "./importance";

describe("normalizeImportanceScore", () => {
  test("keeps existing ten-point scores unchanged", () => {
    expect(normalizeImportanceScore(0)).toBe(0);
    expect(normalizeImportanceScore(6)).toBe(6);
    expect(normalizeImportanceScore(10)).toBe(10);
  });

  test("maps legacy percent scores to ten-point scores", () => {
    expect(normalizeImportanceScore(65)).toBe(7);
    expect(normalizeImportanceScore(84)).toBe(8);
    expect(normalizeImportanceScore(100)).toBe(10);
  });

  test("clamps invalid values into the ten-point range", () => {
    expect(normalizeImportanceScore(-8)).toBe(0);
    expect(normalizeImportanceScore(127)).toBe(10);
    expect(normalizeImportanceScore(Number.NaN)).toBe(defaultImportanceScore);
  });
});

describe("ten-point defaults", () => {
  test("uses a six-point important threshold and seven-point default", () => {
    expect(importantScoreThreshold).toBe(6);
    expect(defaultImportanceScore).toBe(7);
  });
});
