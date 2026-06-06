export interface DailyNotebookEntry {
  date: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export function getDailyNotebookDateKey(date = new Date()): string {
  return [
    date.getFullYear(),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate()),
  ].join("-");
}

export function createEmptyDailyNotebookEntry(
  date: string,
  nowIso = new Date().toISOString(),
): DailyNotebookEntry {
  return {
    date,
    body: "",
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

export function sortDailyNotebookHistory(
  entries: DailyNotebookEntry[],
): DailyNotebookEntry[] {
  return [...entries].sort((a, b) => b.date.localeCompare(a.date));
}

function padDatePart(value: number): string {
  return String(value).padStart(2, "0");
}
