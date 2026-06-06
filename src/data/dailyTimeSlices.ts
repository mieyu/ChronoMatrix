import Database from "@tauri-apps/plugin-sql";
import {
  createDailyTimeSliceFromSelection,
  sortDailyTimeSlices,
  type DailyTimeSlice,
} from "@/domain/dailyTimeSlices";

const DATABASE_URL = "sqlite:chronomatrix.db";
const LOCAL_STORAGE_KEY = "chronomatrix.daily-time-slices";

interface DailyTimeSliceRow {
  id: string;
  date: string;
  title: string;
  start_minute: number;
  end_minute: number;
  created_at: string;
  updated_at: string;
}

let databasePromise: Promise<Database> | null = null;

export async function listDailyTimeSlices(
  date: string,
): Promise<DailyTimeSlice[]> {
  if (!isTauriRuntime()) {
    return sortDailyTimeSlices(
      readLocalSlices().filter((slice) => slice.date === date),
    );
  }

  const db = await getDatabase();
  const rows = await db.select<DailyTimeSliceRow[]>(
    `SELECT id, date, title, start_minute, end_minute, created_at, updated_at
       FROM daily_time_slices
      WHERE date = ?
      ORDER BY start_minute ASC, end_minute ASC, created_at ASC`,
    [date],
  );

  return rows.map(fromRow);
}

export async function listDailyTimeSliceDates(): Promise<string[]> {
  if (!isTauriRuntime()) {
    return Array.from(new Set(readLocalSlices().map((slice) => slice.date))).sort(
      (a, b) => b.localeCompare(a),
    );
  }

  const db = await getDatabase();
  const rows = await db.select<{ date: string }[]>(
    `SELECT DISTINCT date
       FROM daily_time_slices
      ORDER BY date DESC`,
  );

  return rows.map((row) => row.date);
}

export async function createDailyTimeSlice({
  date,
  firstMinute,
  secondMinute,
  title,
}: {
  date: string;
  firstMinute: number;
  secondMinute: number;
  title: string;
}): Promise<DailyTimeSlice> {
  const slice = createDailyTimeSliceFromSelection({
    date,
    firstMinute,
    secondMinute,
    title,
  });

  if (!isTauriRuntime()) {
    writeLocalSlices([...readLocalSlices(), slice]);
    return slice;
  }

  const db = await getDatabase();
  await db.execute(
    `INSERT INTO daily_time_slices (
        id, date, title, start_minute, end_minute, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      slice.id,
      slice.date,
      slice.title,
      slice.startMinute,
      slice.endMinute,
      slice.createdAt,
      slice.updatedAt,
    ],
  );

  return slice;
}

export async function updateDailyTimeSliceTitle(
  id: string,
  title: string,
): Promise<DailyTimeSlice> {
  const now = new Date().toISOString();

  if (!isTauriRuntime()) {
    let updated: DailyTimeSlice | null = null;
    writeLocalSlices(
      readLocalSlices().map((slice) => {
        if (slice.id !== id) {
          return slice;
        }

        updated = {
          ...slice,
          title: title.trim(),
          updatedAt: now,
        };
        return updated;
      }),
    );

    if (!updated) {
      throw new Error(`Daily time slice not found: ${id}`);
    }

    return updated;
  }

  const db = await getDatabase();
  await db.execute(
    `UPDATE daily_time_slices
        SET title = ?,
            updated_at = ?
      WHERE id = ?`,
    [title.trim(), now, id],
  );

  const rows = await db.select<DailyTimeSliceRow[]>(
    `SELECT id, date, title, start_minute, end_minute, created_at, updated_at
       FROM daily_time_slices
      WHERE id = ?`,
    [id],
  );

  if (!rows[0]) {
    throw new Error(`Daily time slice not found: ${id}`);
  }

  return fromRow(rows[0]);
}

export async function deleteDailyTimeSlice(id: string): Promise<void> {
  if (!isTauriRuntime()) {
    writeLocalSlices(readLocalSlices().filter((slice) => slice.id !== id));
    return;
  }

  const db = await getDatabase();
  await db.execute("DELETE FROM daily_time_slices WHERE id = ?", [id]);
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

function fromRow(row: DailyTimeSliceRow): DailyTimeSlice {
  return {
    id: row.id,
    date: row.date,
    title: row.title,
    startMinute: row.start_minute,
    endMinute: row.end_minute,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function readLocalSlices(): DailyTimeSlice[] {
  const raw = localStorage.getItem(LOCAL_STORAGE_KEY);

  if (!raw) {
    return [];
  }

  return JSON.parse(raw) as DailyTimeSlice[];
}

function writeLocalSlices(slices: DailyTimeSlice[]): void {
  localStorage.setItem(
    LOCAL_STORAGE_KEY,
    JSON.stringify(sortDailyTimeSlices(slices)),
  );
}
