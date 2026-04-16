// Prevents additional console window on Windows in release, DO NOT REMOVE!!

use tauri::{Emitter, Manager};

#[tauri::command]
fn get_startup_args() -> Vec<String> {
    std::env::args()
        .skip(1)
        .filter(|a| !a.starts_with('-'))
        .collect()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // single-instance は必ずプラグインリストの先頭に置く
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            // argv[0] は実行ファイルパス自身なのでスキップ。
            // '-' 始まりのフラグも除外し、ファイルパスのみを抽出する。
            let file_paths: Vec<String> = argv
                .iter()
                .skip(1)
                .filter(|a| !a.starts_with('-'))
                .cloned()
                .collect();

            // 既存ウィンドウをフロントに出す
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }

            // ファイルパスがある場合のみフロントエンドにイベントを emit する
            if !file_paths.is_empty() {
                let _ = app.emit("single-instance", file_paths);
            }
        }))
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![get_startup_args])
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_icon(tauri::include_image!("icons/icon.png"));
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
