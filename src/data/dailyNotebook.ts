import Database from "@tauri-apps/plugin-sql";
import {
  createEmptyDailyNotebookEntry,
  sortDailyNotebookHistory,
  type DailyNotebookEntry,
} from "@/domain/dailyNotebook";

const DATABASE_URL = "sqlite:chronomatrix.db";
const LOCAL_STORAGE_KEY = "chronomatrix.daily-notebooks";

interface DailyNotebookRow {
  date: string;
  body: string;
  created_at: string;
  updated_at: string;
}

let databasePromise: Promise<Database> | null = null;

export async function listDailyNotebookEntries(): Promise<DailyNotebookEntry[]> {
  if (!isTauriRuntime()) {
    return sortDailyNotebookHistory(readLocalEntries());
  }

  const db = await getDatabase();
  const rows = await db.select<DailyNotebookRow[]>(
    `SELECT date, body, created_at, updated_at
       FROM daily_notebooks
      ORDER BY date DESC`,
  );

  return rows.map(fromRow);
}

export async function getDailyNotebookEntry(
  date: string,
): Promise<DailyNotebookEntry> {
  if (!isTauriRuntime()) {
    return (
      readLocalEntries().find((entry) => entry.date === date) ??
      createEmptyDailyNotebookEntry(date)
    );
  }

  const db = await getDatabase();
  const rows = await db.select<DailyNotebookRow[]>(
    `SELECT date, body, created_at, updated_at
       FROM daily_notebooks
      WHERE date = ?`,
    [date],
  );

  return rows[0] ? fromRow(rows[0]) : createEmptyDailyNotebookEntry(date);
}

export async function saveDailyNotebookEntry(
  date: string,
  body: string,
): Promise<DailyNotebookEntry> {
  const now = new Date().toISOString();

  if (!isTauriRuntime()) {
    const entries = readLocalEntries();
    const existing = entries.find((entry) => entry.date === date);
    const entry: DailyNotebookEntry = {
      date,
      body,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    writeLocalEntries([
      ...entries.filter((item) => item.date !== date),
      entry,
    ]);
    return entry;
  }

  const db = await getDatabase();
  const existing = await getDailyNotebookEntry(date);
  await db.execute(
    `INSERT INTO daily_notebooks (date, body, created_at, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(date) DO UPDATE SET
        body = excluded.body,
        updated_at = excluded.updated_at`,
    [date, body, existing.createdAt, now],
  );

  return {
    date,
    body,
    createdAt: existing.createdAt,
    updatedAt: now,
  };
}

function getDatabase(): Promise<Database> {
  databasePromise ??= Database.load(DATABASE_URL);
  return databasePromise;
}

function isTauriRuntime(): boolean {
  return (
    typeof window !== "undefined" &&
    "__TAURI_INTERNALS__" in (window as Window & { __TAURI_INTERNALS__?: unknown })
  );
}

function fromRow(row: DailyNotebookRow): DailyNotebookEntry {
  return {
    date: row.date,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function readLocalEntries(): DailyNotebookEntry[] {
  const raw = localStorage.getItem(LOCAL_STORAGE_KEY);

  if (!raw) {
    return [];
  }

  return JSON.parse(raw) as DailyNotebookEntry[];
}

function writeLocalEntries(entries: DailyNotebookEntry[]): void {
  localStorage.setItem(
    LOCAL_STORAGE_KEY,
    JSON.stringify(sortDailyNotebookHistory(entries)),
  );
}
