// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use tauri_plugin_sql::{Migration, MigrationKind};

const DATABASE_URL: &str = "sqlite:chronomatrix.db";

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "create_chronomatrix_core_tables",
            sql: r#"
            PRAGMA foreign_keys = ON;

            CREATE TABLE IF NOT EXISTS plans (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                importance_score INTEGER NOT NULL DEFAULT 50 CHECK (importance_score >= 0 AND importance_score <= 100),
                start_at TEXT,
                end_at TEXT,
                stored_status TEXT NOT NULL DEFAULT 'not_started'
                    CHECK (stored_status IN ('not_started', 'in_progress', 'completed', 'archived')),
                category_id TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                completed_at TEXT,
                archived_at TEXT
            );

            CREATE TABLE IF NOT EXISTS tags (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                color TEXT NOT NULL DEFAULT '#6b7280',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS plan_tags (
                plan_id TEXT NOT NULL,
                tag_id TEXT NOT NULL,
                PRIMARY KEY (plan_id, tag_id),
                FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE,
                FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_plans_start_at ON plans(start_at);
            CREATE INDEX IF NOT EXISTS idx_plans_end_at ON plans(end_at);
            CREATE INDEX IF NOT EXISTS idx_plans_status ON plans(stored_status);
            CREATE INDEX IF NOT EXISTS idx_plans_importance ON plans(importance_score);
        "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "convert_importance_score_to_ten_point_scale",
            sql: r#"
            PRAGMA foreign_keys = OFF;

            CREATE TABLE plans_v2 (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                importance_score INTEGER NOT NULL DEFAULT 7 CHECK (importance_score >= 0 AND importance_score <= 10),
                start_at TEXT,
                end_at TEXT,
                stored_status TEXT NOT NULL DEFAULT 'not_started'
                    CHECK (stored_status IN ('not_started', 'in_progress', 'completed', 'archived')),
                category_id TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                completed_at TEXT,
                archived_at TEXT
            );

            INSERT INTO plans_v2 (
                id, title, description, importance_score, start_at, end_at, stored_status,
                category_id, created_at, updated_at, completed_at, archived_at
            )
            SELECT
                id,
                title,
                description,
                CASE
                    WHEN importance_score > 10 THEN
                        MIN(MAX(CAST(ROUND(importance_score / 10.0) AS INTEGER), 0), 10)
                    ELSE
                        MIN(MAX(importance_score, 0), 10)
                END,
                start_at,
                end_at,
                stored_status,
                category_id,
                created_at,
                updated_at,
                completed_at,
                archived_at
            FROM plans;

            DROP TABLE plans;
            ALTER TABLE plans_v2 RENAME TO plans;

            CREATE INDEX IF NOT EXISTS idx_plans_start_at ON plans(start_at);
            CREATE INDEX IF NOT EXISTS idx_plans_end_at ON plans(end_at);
            CREATE INDEX IF NOT EXISTS idx_plans_status ON plans(stored_status);
            CREATE INDEX IF NOT EXISTS idx_plans_importance ON plans(importance_score);

            PRAGMA foreign_keys = ON;
        "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "create_daily_notebooks",
            sql: r#"
            CREATE TABLE IF NOT EXISTS daily_notebooks (
                date TEXT PRIMARY KEY CHECK (date GLOB '????-??-??'),
                body TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_daily_notebooks_updated_at
                ON daily_notebooks(updated_at);
        "#,
            kind: MigrationKind::Up,
        },
    ]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(DATABASE_URL, migrations())
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
