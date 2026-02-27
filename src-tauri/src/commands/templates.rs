use std::collections::HashMap;
use std::path::PathBuf;
use crate::error::AppError;

/// Returns a map of template_name -> bundled template content.
fn bundled_templates() -> HashMap<&'static str, &'static str> {
    let mut m = HashMap::new();

    // Core brainstorms
    m.insert("brainstorm-project", include_str!("../../defaults/templates/brainstorm-project.md"));
    m.insert("brainstorm-book", include_str!("../../defaults/templates/brainstorm-book.md"));
    m.insert("brainstorm-character", include_str!("../../defaults/templates/brainstorm-character.md"));

    // World category brainstorms
    m.insert("world-generic", include_str!("../../defaults/templates/world-generic.md"));
    m.insert("world-locations", include_str!("../../defaults/templates/world-locations.md"));
    m.insert("world-items", include_str!("../../defaults/templates/world-items.md"));
    m.insert("world-history", include_str!("../../defaults/templates/world-history.md"));
    m.insert("world-factions", include_str!("../../defaults/templates/world-factions.md"));
    m.insert("world-culture", include_str!("../../defaults/templates/world-culture.md"));
    m.insert("world-rules", include_str!("../../defaults/templates/world-rules.md"));
    m.insert("world-technology", include_str!("../../defaults/templates/world-technology.md"));
    m.insert("world-magic-systems", include_str!("../../defaults/templates/world-magic-systems.md"));
    m.insert("world-religion", include_str!("../../defaults/templates/world-religion.md"));
    m.insert("world-government", include_str!("../../defaults/templates/world-government.md"));
    m.insert("world-economy", include_str!("../../defaults/templates/world-economy.md"));
    m.insert("world-flora-fauna", include_str!("../../defaults/templates/world-flora-fauna.md"));
    m.insert("world-languages", include_str!("../../defaults/templates/world-languages.md"));
    m.insert("world-mythology", include_str!("../../defaults/templates/world-mythology.md"));
    m.insert("world-geography", include_str!("../../defaults/templates/world-geography.md"));
    m.insert("world-medicine", include_str!("../../defaults/templates/world-medicine.md"));
    m.insert("world-arts", include_str!("../../defaults/templates/world-arts.md"));
    m.insert("world-food", include_str!("../../defaults/templates/world-food.md"));
    m.insert("world-calendar", include_str!("../../defaults/templates/world-calendar.md"));
    m.insert("world-transportation", include_str!("../../defaults/templates/world-transportation.md"));

    // Phase 1 Seed elements
    m.insert("seed-premise", include_str!("../../defaults/templates/seed-premise.md"));
    m.insert("seed-theme", include_str!("../../defaults/templates/seed-theme.md"));
    m.insert("seed-protagonist", include_str!("../../defaults/templates/seed-protagonist.md"));
    m.insert("seed-central-conflict", include_str!("../../defaults/templates/seed-central-conflict.md"));
    m.insert("seed-story-world", include_str!("../../defaults/templates/seed-story-world.md"));
    m.insert("seed-emotional-promise", include_str!("../../defaults/templates/seed-emotional-promise.md"));

    // Phase 2 Root beats (21)
    m.insert("beat-01-opening-image", include_str!("../../defaults/templates/beat-01-opening-image.md"));
    m.insert("beat-02-daily-life", include_str!("../../defaults/templates/beat-02-daily-life.md"));
    m.insert("beat-03-inciting-incident", include_str!("../../defaults/templates/beat-03-inciting-incident.md"));
    m.insert("beat-04-reluctance-moment", include_str!("../../defaults/templates/beat-04-reluctance-moment.md"));
    m.insert("beat-05-point-of-departure", include_str!("../../defaults/templates/beat-05-point-of-departure.md"));
    m.insert("beat-06-first-challenge", include_str!("../../defaults/templates/beat-06-first-challenge.md"));
    m.insert("beat-07-end-of-known-world", include_str!("../../defaults/templates/beat-07-end-of-known-world.md"));
    m.insert("beat-08-new-reality", include_str!("../../defaults/templates/beat-08-new-reality.md"));
    m.insert("beat-09-initial-progress", include_str!("../../defaults/templates/beat-09-initial-progress.md"));
    m.insert("beat-10-strengthening-allies", include_str!("../../defaults/templates/beat-10-strengthening-allies.md"));
    m.insert("beat-11-midpoint-shift", include_str!("../../defaults/templates/beat-11-midpoint-shift.md"));
    m.insert("beat-12-growing-opposition", include_str!("../../defaults/templates/beat-12-growing-opposition.md"));
    m.insert("beat-13-moment-of-doubt", include_str!("../../defaults/templates/beat-13-moment-of-doubt.md"));
    m.insert("beat-14-renewed-determination", include_str!("../../defaults/templates/beat-14-renewed-determination.md"));
    m.insert("beat-15-ultimate-challenge", include_str!("../../defaults/templates/beat-15-ultimate-challenge.md"));
    m.insert("beat-16-darkest-moment", include_str!("../../defaults/templates/beat-16-darkest-moment.md"));
    m.insert("beat-17-final-decision", include_str!("../../defaults/templates/beat-17-final-decision.md"));
    m.insert("beat-18-climactic-confrontation", include_str!("../../defaults/templates/beat-18-climactic-confrontation.md"));
    m.insert("beat-19-resolution", include_str!("../../defaults/templates/beat-19-resolution.md"));
    m.insert("beat-20-new-equilibrium", include_str!("../../defaults/templates/beat-20-new-equilibrium.md"));
    m.insert("beat-21-closing-image", include_str!("../../defaults/templates/beat-21-closing-image.md"));

    // Phase 3 Sprout journey stages (8)
    m.insert("stage-1-comfort-zone", include_str!("../../defaults/templates/stage-1-comfort-zone.md"));
    m.insert("stage-2-desire-emerges", include_str!("../../defaults/templates/stage-2-desire-emerges.md"));
    m.insert("stage-3-crossing-threshold", include_str!("../../defaults/templates/stage-3-crossing-threshold.md"));
    m.insert("stage-4-trial-and-error", include_str!("../../defaults/templates/stage-4-trial-and-error.md"));
    m.insert("stage-5-moment-of-truth", include_str!("../../defaults/templates/stage-5-moment-of-truth.md"));
    m.insert("stage-6-supreme-ordeal", include_str!("../../defaults/templates/stage-6-supreme-ordeal.md"));
    m.insert("stage-7-transformation", include_str!("../../defaults/templates/stage-7-transformation.md"));
    m.insert("stage-8-return-integration", include_str!("../../defaults/templates/stage-8-return-integration.md"));

    // Front matter
    m.insert("front-matter-title-page", include_str!("../../defaults/templates/front-matter-title-page.md"));
    m.insert("front-matter-copyright", include_str!("../../defaults/templates/front-matter-copyright.md"));
    m.insert("front-matter-dedication", include_str!("../../defaults/templates/front-matter-dedication.md"));
    m.insert("front-matter-epigraph", include_str!("../../defaults/templates/front-matter-epigraph.md"));
    m.insert("front-matter-acknowledgments", include_str!("../../defaults/templates/front-matter-acknowledgments.md"));
    m.insert("front-matter-foreword", include_str!("../../defaults/templates/front-matter-foreword.md"));
    m.insert("front-matter-preface", include_str!("../../defaults/templates/front-matter-preface.md"));
    m.insert("front-matter-prologue", include_str!("../../defaults/templates/front-matter-prologue.md"));

    // Back matter
    m.insert("back-matter-epilogue", include_str!("../../defaults/templates/back-matter-epilogue.md"));
    m.insert("back-matter-afterword", include_str!("../../defaults/templates/back-matter-afterword.md"));
    m.insert("back-matter-acknowledgments", include_str!("../../defaults/templates/back-matter-acknowledgments.md"));
    m.insert("back-matter-about-the-author", include_str!("../../defaults/templates/back-matter-about-the-author.md"));
    m.insert("back-matter-glossary", include_str!("../../defaults/templates/back-matter-glossary.md"));

    // Scene templates
    m.insert("scene-outline", include_str!("../../defaults/templates/scene-outline.md"));
    m.insert("scene-draft", include_str!("../../defaults/templates/scene-draft.md"));

    m
}

/// Load a template by name with variable substitution.
/// Checks `.saipling/templates/{name}.md` in the project first, falls back to bundled.
#[tauri::command]
pub fn load_template(
    project_dir: PathBuf,
    template_name: String,
    variables: HashMap<String, String>,
) -> Result<String, AppError> {
    // Check project override first
    let override_path = project_dir
        .join(".saipling")
        .join("templates")
        .join(format!("{}.md", template_name));

    let body = if override_path.exists() {
        std::fs::read_to_string(&override_path)?
    } else {
        let templates = bundled_templates();
        templates
            .get(template_name.as_str())
            .ok_or_else(|| AppError::Config(format!("Unknown template: {}", template_name)))?
            .to_string()
    };

    // Replace {{variable}} placeholders
    let mut result = body;
    for (key, value) in &variables {
        result = result.replace(&format!("{{{{{}}}}}", key), value);
    }

    Ok(result)
}

/// List all available template names (for debugging / UI).
#[tauri::command]
pub fn list_templates() -> Vec<String> {
    let templates = bundled_templates();
    let mut names: Vec<String> = templates.keys().map(|k| k.to_string()).collect();
    names.sort();
    names
}
