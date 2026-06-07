// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use tauri::{
    menu::{CheckMenuItem, Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WindowEvent,
};
use tauri_plugin_autostart::{ManagerExt, MacosLauncher};
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
        Migration {
            version: 4,
            description: "create_daily_time_slices",
            sql: r#"
            CREATE TABLE IF NOT EXISTS daily_time_slices (
                id TEXT PRIMARY KEY,
                date TEXT NOT NULL CHECK (date GLOB '????-??-??'),
                title TEXT NOT NULL DEFAULT '',
                start_minute INTEGER NOT NULL CHECK (start_minute >= 0 AND start_minute < 1440),
                end_minute INTEGER NOT NULL CHECK (end_minute > start_minute AND end_minute <= 1440),
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_daily_time_slices_date
                ON daily_time_slices(date, start_minute, end_minute);
        "#,
            kind: MigrationKind::Up,
        },
    ]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--hidden"]),
        ))
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(DATABASE_URL, migrations())
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet])
        .setup(|app| {
            let handle = app.handle();

            // Tray menu: show window, toggle autostart, quit.
            let show_item =
                MenuItem::with_id(app, "show", "显示主窗口", true, None::<&str>)?;
            let autostart_enabled = handle.autolaunch().is_enabled().unwrap_or(false);
            let autostart_item = CheckMenuItem::with_id(
                app,
                "autostart",
                "开机自启（后台提醒）",
                true,
                autostart_enabled,
                None::<&str>,
            )?;
            let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &autostart_item, &quit_item])?;

            let autostart_item_for_events = autostart_item.clone();
            TrayIconBuilder::with_id("main-tray")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("时矩 ChronoMatrix")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(move |app, event| match event.id.as_ref() {
                    "show" => show_main_window(app),
                    "quit" => app.exit(0),
                    "autostart" => {
                        let manager = app.autolaunch();
                        let enabled = manager.is_enabled().unwrap_or(false);
                        let result = if enabled {
                            manager.disable()
                        } else {
                            manager.enable()
                        };

                        if let Err(error) = result {
                            eprintln!("Failed to toggle autostart: {error}");
                        }

                        let now_enabled = manager.is_enabled().unwrap_or(enabled);
                        let _ = autostart_item_for_events.set_checked(now_enabled);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main_window(tray.app_handle());
                    }
                })
                .build(app)?;

            // When launched at login via autostart, start hidden in the tray.
            if std::env::args().any(|arg| arg == "--hidden") {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
                #[cfg(target_os = "macos")]
                let _ = handle.set_activation_policy(tauri::ActivationPolicy::Accessory);
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            // Closing the window hides it to the tray instead of quitting, so
            // the reminder loop keeps running in the background.
            if let WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                // Drop the Dock icon so only the menu bar tray remains.
                #[cfg(target_os = "macos")]
                let _ = window
                    .app_handle()
                    .set_activation_policy(tauri::ActivationPolicy::Accessory);
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn show_main_window(app: &tauri::AppHandle) {
    // Restore the Dock icon when the window comes back.
    #[cfg(target_os = "macos")]
    let _ = app.set_activation_policy(tauri::ActivationPolicy::Regular);

    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}
