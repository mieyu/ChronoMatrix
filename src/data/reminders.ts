const SENT_REMINDER_KEYS_STORAGE_KEY = "chronomatrix.sent-reminder-keys";

export function listSentReminderKeys(): Set<string> {
  return new Set(readSentReminderKeys());
}

export function markReminderKeysSent(keys: string[]): void {
  if (keys.length === 0) {
    return;
  }

  const merged = new Set([...readSentReminderKeys(), ...keys]);
  writeSentReminderKeys([...merged].sort());
}

function readSentReminderKeys(): string[] {
  const raw = localStorage.getItem(SENT_REMINDER_KEYS_STORAGE_KEY);

  if (!raw) {
    return [];
  }

  const parsed = JSON.parse(raw);

  return Array.isArray(parsed)
    ? parsed.filter((value): value is string => typeof value === "string")
    : [];
}

function writeSentReminderKeys(keys: string[]): void {
  localStorage.setItem(SENT_REMINDER_KEYS_STORAGE_KEY, JSON.stringify(keys));
}
