import { beforeEach, describe, expect, test, vi } from "vitest";
import { listSentReminderKeys, markReminderKeysSent } from "./reminders";

const storage = new Map<string, string>();

beforeEach(() => {
  storage.clear();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
});

describe("reminder sent-key storage", () => {
  test("returns an empty set when nothing has been stored", () => {
    expect(listSentReminderKeys()).toEqual(new Set());
  });

  test("stores and reads sent reminder keys", () => {
    markReminderKeysSent(["plan-1:due_soon:2026-06-06T10:00:00.000Z"]);

    expect(listSentReminderKeys()).toEqual(
      new Set(["plan-1:due_soon:2026-06-06T10:00:00.000Z"]),
    );
  });

  test("merges new keys without duplicating existing keys", () => {
    markReminderKeysSent([
      "plan-1:due_soon:2026-06-06T10:00:00.000Z",
      "plan-2:expired:2026-06-06T09:00:00.000Z",
    ]);
    markReminderKeysSent([
      "plan-1:due_soon:2026-06-06T10:00:00.000Z",
      "plan-3:expired:2026-06-06T08:00:00.000Z",
    ]);

    expect([...listSentReminderKeys()].sort()).toEqual([
      "plan-1:due_soon:2026-06-06T10:00:00.000Z",
      "plan-2:expired:2026-06-06T09:00:00.000Z",
      "plan-3:expired:2026-06-06T08:00:00.000Z",
    ]);
  });
});
