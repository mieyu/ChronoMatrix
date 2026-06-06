import Database from "@tauri-apps/plugin-sql";
import { normalizeImportanceScore } from "@/domain/importance";
import type { Plan, StoredPlanStatus } from "@/domain/plan";

const DATABASE_URL = "sqlite:chronomatrix.db";
const LOCAL_STORAGE_KEY = "chronomatrix.plans";

interface PlanRow {
  id: string;
  title: string;
  description: string;
  importance_score: number;
  start_at: string | null;
  end_at: string | null;
  stored_status: StoredPlanStatus;
  category_id: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  archived_at: string | null;
}

export interface PlanDraft {
  title: string;
  description: string;
  importanceScore: number;
  startAt: string | null;
  endAt: string | null;
  storedStatus: StoredPlanStatus;
  categoryId: string | null;
}

let databasePromise: Promise<Database> | null = null;

export async function listPlans(): Promise<Plan[]> {
  if (!isTauriRuntime()) {
    return readLocalPlans();
  }

  const db = await getDatabase();
  const rows = await db.select<PlanRow[]>(
    `SELECT id, title, description, importance_score, start_at, end_at,
            stored_status, category_id, created_at, updated_at, completed_at, archived_at
       FROM plans
      ORDER BY COALESCE(end_at, start_at, updated_at) ASC`,
  );

  return rows.map(fromRow);
}

export async function createPlan(draft: PlanDraft): Promise<Plan> {
  const now = new Date().toISOString();
  const plan: Plan = {
    id: crypto.randomUUID(),
    title: draft.title.trim(),
    description: draft.description.trim(),
    importanceScore: normalizeImportanceScore(draft.importanceScore),
    startAt: draft.startAt,
    endAt: draft.endAt,
    storedStatus: draft.storedStatus,
    categoryId: draft.categoryId,
    createdAt: now,
    updatedAt: now,
    completedAt: draft.storedStatus === "completed" ? now : null,
    archivedAt: draft.storedStatus === "archived" ? now : null,
  };

  if (!isTauriRuntime()) {
    writeLocalPlans([...readLocalPlans(), plan]);
    return plan;
  }

  const db = await getDatabase();
  await db.execute(
    `INSERT INTO plans (
        id, title, description, importance_score, start_at, end_at, stored_status,
        category_id, created_at, updated_at, completed_at, archived_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      plan.id,
      plan.title,
      plan.description,
      plan.importanceScore,
      plan.startAt,
      plan.endAt,
      plan.storedStatus,
      plan.categoryId,
      plan.createdAt,
      plan.updatedAt,
      plan.completedAt,
      plan.archivedAt,
    ],
  );

  return plan;
}

export async function updatePlan(id: string, draft: PlanDraft): Promise<void> {
  const now = new Date().toISOString();
  const completedAt = draft.storedStatus === "completed" ? now : null;
  const archivedAt = draft.storedStatus === "archived" ? now : null;

  if (!isTauriRuntime()) {
    writeLocalPlans(
      readLocalPlans().map((plan) =>
        plan.id === id
          ? {
              ...plan,
              ...draft,
              title: draft.title.trim(),
              description: draft.description.trim(),
              importanceScore: normalizeImportanceScore(draft.importanceScore),
              updatedAt: now,
              completedAt,
              archivedAt,
            }
          : plan,
      ),
    );
    return;
  }

  const db = await getDatabase();
  await db.execute(
    `UPDATE plans
        SET title = ?,
            description = ?,
            importance_score = ?,
            start_at = ?,
            end_at = ?,
            stored_status = ?,
            category_id = ?,
            updated_at = ?,
            completed_at = ?,
            archived_at = ?
      WHERE id = ?`,
    [
      draft.title.trim(),
      draft.description.trim(),
      normalizeImportanceScore(draft.importanceScore),
      draft.startAt,
      draft.endAt,
      draft.storedStatus,
      draft.categoryId,
      now,
      completedAt,
      archivedAt,
      id,
    ],
  );
}

export async function completePlan(id: string): Promise<void> {
  const now = new Date().toISOString();

  if (!isTauriRuntime()) {
    writeLocalPlans(
      readLocalPlans().map((plan) =>
        plan.id === id
          ? {
              ...plan,
              storedStatus: "completed",
              completedAt: now,
              updatedAt: now,
            }
          : plan,
      ),
    );
    return;
  }

  const db = await getDatabase();
  await db.execute(
    `UPDATE plans
        SET stored_status = 'completed',
            completed_at = ?,
            updated_at = ?
      WHERE id = ?`,
    [now, now, id],
  );
}

export async function deletePlan(id: string): Promise<void> {
  if (!isTauriRuntime()) {
    writeLocalPlans(readLocalPlans().filter((plan) => plan.id !== id));
    return;
  }

  const db = await getDatabase();
  await db.execute("DELETE FROM plans WHERE id = ?", [id]);
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

function fromRow(row: PlanRow): Plan {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    importanceScore: normalizeImportanceScore(row.importance_score),
    startAt: row.start_at,
    endAt: row.end_at,
    storedStatus: row.stored_status,
    categoryId: row.category_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    archivedAt: row.archived_at,
  };
}

function readLocalPlans(): Plan[] {
  const raw = localStorage.getItem(LOCAL_STORAGE_KEY);

  if (!raw) {
    return [];
  }

  const plans = (JSON.parse(raw) as Plan[]).map(normalizePlan);
  writeLocalPlans(plans);
  return plans;
}

function writeLocalPlans(plans: Plan[]): void {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(plans.map(normalizePlan)));
}

function normalizePlan(plan: Plan): Plan {
  return {
    ...plan,
    importanceScore: normalizeImportanceScore(plan.importanceScore),
  };
}
