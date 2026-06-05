import { describe, expect, test } from "vitest";
import {
  buildDateShortcutOptions,
  endDateShortcuts,
  resolveDateShortcutValue,
  startDateShortcuts,
} from "./dateShortcuts";

describe("resolveDateShortcutValue", () => {
  test("formats now at the current local minute", () => {
    expect(
      resolveDateShortcutValue("now", new Date(2026, 5, 5, 10, 37, 45, 999)),
    ).toBe("2026-06-05T10:37");
  });

  test("sets today and tomorrow morning shortcuts", () => {
    const now = new Date(2026, 5, 5, 10, 30);

    expect(resolveDateShortcutValue("today-morning", now)).toBe(
      "2026-06-05T09:00",
    );
    expect(resolveDateShortcutValue("tomorrow-morning", now)).toBe(
      "2026-06-06T09:00",
    );
  });

  test("sets today and tomorrow evening shortcuts", () => {
    const now = new Date(2026, 5, 5, 10, 30);

    expect(resolveDateShortcutValue("today-evening", now)).toBe(
      "2026-06-05T18:00",
    );
    expect(resolveDateShortcutValue("tomorrow-evening", now)).toBe(
      "2026-06-06T18:00",
    );
  });

  test("uses Friday in the current week before or on Friday", () => {
    expect(
      resolveDateShortcutValue(
        "this-friday-evening",
        new Date(2026, 5, 3, 12, 0),
      ),
    ).toBe("2026-06-05T18:00");

    expect(
      resolveDateShortcutValue(
        "this-friday-evening",
        new Date(2026, 5, 5, 20, 0),
      ),
    ).toBe("2026-06-05T18:00");
  });

  test("uses the following Friday after Friday has passed", () => {
    expect(
      resolveDateShortcutValue(
        "this-friday-evening",
        new Date(2026, 5, 6, 12, 0),
      ),
    ).toBe("2026-06-12T18:00");
  });

  test("uses Monday after the current week for next Monday", () => {
    expect(
      resolveDateShortcutValue(
        "next-monday-evening",
        new Date(2026, 5, 5, 10, 30),
      ),
    ).toBe("2026-06-08T18:00");

    expect(
      resolveDateShortcutValue(
        "next-monday-evening",
        new Date(2026, 5, 7, 10, 30),
      ),
    ).toBe("2026-06-08T18:00");
  });
});

describe("buildDateShortcutOptions", () => {
  test("resolves labels and values for start shortcuts", () => {
    const options = buildDateShortcutOptions(
      startDateShortcuts,
      new Date(2026, 5, 5, 10, 37),
    );

    expect(options).toEqual([
      { id: "now", label: "现在", value: "2026-06-05T10:37" },
      { id: "today-morning", label: "今天 09:00", value: "2026-06-05T09:00" },
      { id: "tomorrow-morning", label: "明天 09:00", value: "2026-06-06T09:00" },
    ]);
  });

  test("resolves labels and values for end shortcuts", () => {
    const options = buildDateShortcutOptions(
      endDateShortcuts,
      new Date(2026, 5, 6, 10, 37),
    );

    expect(options).toEqual([
      { id: "today-evening", label: "今天 18:00", value: "2026-06-06T18:00" },
      { id: "tomorrow-evening", label: "明天 18:00", value: "2026-06-07T18:00" },
      {
        id: "this-friday-evening",
        label: "本周五 18:00",
        value: "2026-06-12T18:00",
      },
      {
        id: "next-monday-evening",
        label: "下周一 18:00",
        value: "2026-06-08T18:00",
      },
    ]);
  });
});
