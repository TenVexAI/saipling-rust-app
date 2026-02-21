mod error;
mod commands;
mod context;
mod agent;
mod watcher;

use commands::{
    project, book, filesystem, draft, attachment, chapter, matter, agent as agent_cmd, config, export,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            // Project management
            project::create_project,
            project::open_project,
            project::get_recent_projects,
            project::get_project_metadata,
            project::update_project_metadata,
            project::delete_project,
            // Book management
            book::create_book,
            book::get_book_metadata,
            book::update_book_metadata,
            book::reorder_books,
            // File system
            filesystem::reveal_in_explorer,
            filesystem::read_file,
            filesystem::write_file,
            filesystem::create_from_template,
            filesystem::list_directory,
            filesystem::create_directory,
            filesystem::rename_entry,
            filesystem::delete_entry,
            filesystem::move_entry,
            filesystem::get_word_count,
            filesystem::get_book_word_count,
            // Draft management
            draft::save_draft,
            draft::list_drafts,
            draft::restore_draft,
            // Attachments
            attachment::add_attachment,
            attachment::list_attachments,
            attachment::remove_attachment,
            // Chapter & Scene management
            chapter::create_chapter,
            chapter::create_scene,
            chapter::reorder_chapters,
            chapter::reorder_scenes,
            chapter::move_scene,
            // Front & Back matter
            matter::create_front_matter,
            matter::create_back_matter,
            matter::remove_front_matter,
            matter::remove_back_matter,
            matter::list_front_matter,
            matter::list_back_matter,
            // Agent / Claude API
            agent_cmd::agent_plan,
            agent_cmd::agent_execute,
            agent_cmd::agent_quick,
            agent_cmd::agent_cancel,
            agent_cmd::estimate_context_tokens,
            agent_cmd::list_available_skills,
            // Configuration
            config::get_config,
            config::update_config,
            config::set_api_key,
            config::validate_api_key,
            // Export
            export::export_book,
            // File watcher
            project::start_file_watcher,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
