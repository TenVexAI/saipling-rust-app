# sAIpling — Technical Specification Document

**Version**: 1.1.0
**Date**: February 19, 2026
**Platform**: Tauri v2 (Windows) + React/Vite + Rust Backend

---

> **NOTE TO DEVELOPER (Claude in Windsurf)**: This specification describes a complete, functional desktop application. Implement all features described herein with full functionality. No placeholder components, stub functions, or "coming soon" sections should remain in the final product. Every command, every UI panel, every skill, and every file operation described here should work end-to-end. If a section describes a feature, build it. If you encounter ambiguity, make a reasonable implementation decision consistent with the rest of the spec and note it in a comment.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Developer Setup Instructions](#2-developer-setup-instructions)
3. [Architecture](#3-architecture)
4. [File System Schema](#4-file-system-schema)
5. [Sapling Phase State Machine](#5-sapling-phase-state-machine)
6. [AI Agent System](#6-ai-agent-system)
7. [Claude Skills](#7-claude-skills)
8. [User Flow](#8-user-flow)
9. [Rust Backend Commands](#9-rust-backend-commands)
10. [UI Layout & Theme System](#10-ui-layout--theme-system)
11. [Editor (TipTap)](#11-editor-tiptap)
12. [Export System](#12-export-system)
13. [Technical Stack](#13-technical-stack)

---

## 1. Project Overview

### 1.1 What Is sAIpling?

sAIpling is a desktop novel-writing application that implements the Sapling Story Structure Framework — a five-phase methodology for developing a story from initial concept to finished prose. The app provides a graphical interface for collaborating with Claude (via the Anthropic API) through each phase, with specialized AI "skills" that provide phase-appropriate guidance, consistency checking, and writing assistance.

The app is designed so that the user can be as involved or as hands-off as they want. With very little user input — just some brainstorming ideas and high-level creative direction — the AI can walk the user through every phase of the Sapling Method, generating recommendations at each step that the user approves, edits, or sends back for revision. The AI can effectively write an entire book or series this way. Alternatively, the user can write large portions themselves, using the AI only for specific assistance. The system supports the full spectrum from "AI does most of the work" to "I write everything, AI just checks consistency."

### 1.2 Core Principles

- **The user controls the level of involvement.** The AI can generate complete deliverables for any phase — story foundations, beat outlines, character sheets, scene outlines, prose — but nothing is ever auto-applied. The user reviews, approves, edits, or rejects every AI output before it touches the filesystem.
- **Files are real and human-readable.** All story data lives as `.md` files with YAML frontmatter on the user's filesystem. Projects are git-friendly and editable in VS Code or any text editor.
- **The AI recommends before it works.** For substantive tasks, the AI first proposes what context to load, which skills to use, and what approach to take. The user can approve, edit the plan, or override before the AI executes. Small inline actions (rewrite a sentence, suggest a synonym) can skip this step based on user settings.
- **Context is king.** Each AI interaction is powered by a Context Assembler that loads exactly the right combination of story files. The AI can use full documents or intelligent summaries depending on relevance and token budget.
- **Structure before prose.** The five-phase progression ensures coherence is established at the highest level (premise, theme) before complexity is added (scenes, paragraphs).
- **Every project is a series.** A standalone novel is a series with one book. The data model supports multi-book series natively.

### 1.3 Target Platform

- Windows 10/11 desktop application
- Tauri v2 with WebView2 (Chromium-based, ships with Windows)
- User provides their own Anthropic API key

---

## 2. Developer Setup Instructions

These instructions are for the human developer setting up the initial repository before beginning development in Windsurf.

### 2.1 Prerequisites

Install the following on your Windows machine:

- **Rust toolchain**: Install via [rustup](https://rustup.rs/). Run `rustup default stable`.
- **Node.js 20+**: Install from [nodejs.org](https://nodejs.org/).
- **pnpm**: Install globally with `npm install -g pnpm`.
- **Visual Studio Build Tools**: Required by Tauri for Windows. Install "Desktop development with C++" workload from [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/).
- **WebView2**: Ships with Windows 10/11. If missing, install from [Microsoft](https://developer.microsoft.com/en-us/microsoft-edge/webview2/).
- **Pandoc** (optional, for export): Install from [pandoc.org](https://pandoc.org/installing.html). Add to PATH.

### 2.2 Create the GitHub Repository

```bash
# Create the repository on GitHub
# Clone it locally
cd saipling-rust-app

# Initialize the Tauri + React + Vite project
pnpm create tauri-app . --template react-ts
# When prompted:
#   Package manager: pnpm
#   UI template: React
#   UI flavor: TypeScript

# Install additional frontend dependencies
pnpm add zustand lucide-react @tiptap/react @tiptap/starter-kit @tiptap/extension-placeholder @tiptap/extension-character-count @tiptap/pm react-markdown remark-gfm remark-frontmatter
pnpm add -D tailwindcss @tailwindcss/typography postcss autoprefixer @types/node

# Initialize Tailwind
npx tailwindcss init -p

# Add Rust dependencies to src-tauri/Cargo.toml:
# [dependencies]
# serde = { version = "1", features = ["derive"] }
# serde_json = "1"
# serde_yaml = "0.9"
# reqwest = { version = "0.12", features = ["stream", "json"] }
# tokio = { version = "1", features = ["full"] }
# notify = "6"
# futures-util = "0.3"
# tauri = { version = "2", features = [] }
# tauri-plugin-store = "2"
# tauri-plugin-dialog = "2"
# tauri-plugin-fs = "2"
# uuid = { version = "1", features = ["v4"] }
# chrono = { version = "0.4", features = ["serde"] }
# toml = "0.8"
# tiktoken-rs = "0.6"
```

### 2.3 Adding Your App Logo

Place your logo files in the following locations:

```
src-tauri/
├── icons/
│   ├── icon.ico          # Your .ico file (used for Windows taskbar/title bar)
│   ├── icon.png          # Your .png file (used for various UI contexts)
│   ├── 32x32.png         # 32x32 version
│   ├── 128x128.png       # 128x128 version
│   ├── 128x128@2x.png    # 256x256 version (named this way for Tauri)
│   └── Square150x150Logo.png  # Windows tile icon
```

Tauri uses these icons automatically based on `tauri.conf.json`. The default config generated by `create tauri-app` already references the `icons/` directory. Simply replace the placeholder icons with your own files at the sizes listed above.

To also use the logo within the app UI (e.g., in the sidebar or title area), copy your `icon.png` to:

```
src/assets/logo.png
```

Then reference it in React components:

```tsx
import logo from '@/assets/logo.png';
// <img src={logo} alt="sAIpling" className="w-8 h-8" />
```

### 2.4 Initial File Structure to Create

After scaffolding, adjust the project structure to match section 13.5 of this spec. The key directories to ensure exist:

```
saipling-rust-app/
├── src/                    # React frontend (created by scaffold)
├── src-tauri/              # Rust backend (created by scaffold)
│   ├── src/
│   │   ├── commands/       # Create this directory
│   │   ├── context/        # Create this directory
│   │   └── ...
│   └── skills/             # Create this directory (for TOML skill definitions)
├── public/
│   └── fonts/              # Create this directory (for Inter and Lora font files)
└── ...
```

### 2.5 Font Setup

Download and place these font files in `public/fonts/`:

- **Inter**: Download from [Google Fonts](https://fonts.google.com/specimen/Inter). Place `Inter-VariableFont.woff2` (or individual weights: 400, 500, 600, 700).
- **Lora**: Download from [Google Fonts](https://fonts.google.com/specimen/Lora). Place `Lora-VariableFont.woff2` (or individual weights: 400, 500, 600, 700 plus italics).

### 2.6 Running the App

```bash
# Development mode (hot reload for frontend, rebuilds Rust on change)
pnpm tauri dev

# Production build (creates Windows installer in src-tauri/target/release/bundle/)
pnpm tauri build
```

---

## 3. Architecture

### 3.1 High-Level Architecture

```
┌──────────────────────────────────────────────────────┐
│              Tauri WebView (React + Vite)             │
│                                                       │
│  ┌───────────┐ ┌──────────────┐ ┌─────────────────┐  │
│  │ Project    │ │ Phase        │ │ AI Chat /       │  │
│  │ Explorer   │ │ Workflow     │ │ Agent Panel     │  │
│  │ (sidebar)  │ │ Panel        │ │                 │  │
│  └───────────┘ └──────────────┘ └─────────────────┘  │
│  ┌──────────────────────────────────────────────────┐ │
│  │           TipTap Editor / Document Viewer         │ │
│  └──────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────┐ │
│  │           Phase Progress Bar                      │ │
│  └──────────────────────────────────────────────────┘ │
└───────────────────────┬──────────────────────────────┘
                        │ Tauri IPC (invoke / events)
┌───────────────────────┴──────────────────────────────┐
│                Rust Backend (Tauri Core)               │
│                                                       │
│  ┌──────────────┐ ┌─────────────┐ ┌───────────────┐  │
│  │ FileSystem    │ │ Claude API  │ │ Context       │  │
│  │ Manager       │ │ Client      │ │ Assembler     │  │
│  └──────────────┘ └─────────────┘ └───────────────┘  │
│  ┌──────────────┐ ┌─────────────┐ ┌───────────────┐  │
│  │ Project       │ │ File        │ │ Export        │  │
│  │ Manager       │ │ Watcher     │ │ Engine        │  │
│  └──────────────┘ └─────────────┘ └───────────────┘  │
│  ┌──────────────────────────────────────────────────┐ │
│  │              Agent Orchestrator                    │ │
│  │  (plans tasks, manages parallel execution,        │ │
│  │   assembles context, routes to skills)            │ │
│  └──────────────────────────────────────────────────┘ │
└───────────────────────┬──────────────────────────────┘
                        │ std::fs
             ┌──────────┴──────────┐
             │  ~/Documents/sAIpling/
             │  └── my-series/
             │      ├── project.json
             │      ├── series/
             │      ├── world/
             │      ├── characters/
             │      └── books/
             └─────────────────────┘
```

### 3.2 Component Responsibilities

| Component | Location | Responsibility |
|-----------|----------|----------------|
| **FileSystem Manager** | Rust | CRUD operations on .md files, directory management, draft versioning |
| **Project Manager** | Rust | Project creation, loading, metadata management, phase tracking |
| **Claude API Client** | Rust | Anthropic API calls with streaming, API key management |
| **Context Assembler** | Rust | Determines which files to load, generates summaries, manages token budgets |
| **Agent Orchestrator** | Rust | Plans multi-step AI tasks, manages parallel execution, generates recommendations for user approval |
| **File Watcher** | Rust | Monitors project directory for external changes (e.g., edits in VS Code), emits events to frontend |
| **Export Engine** | Rust | Converts project to PDF, DOCX, ePub via Pandoc |
| **Project Explorer** | React | Tree view of project files, navigation |
| **Phase Workflow Panel** | React | Guided UI for each Sapling phase |
| **AI Chat / Agent Panel** | React | Conversational interface with Claude, shows agent plans and recommendations |
| **TipTap Editor** | React | Markdown editing with rich preview, inline AI actions |
| **Phase Progress Bar** | React | Visual indicator of Sapling phase completion |

### 3.3 Data Flow for AI Interactions

This is the core interaction pattern. There are two flows depending on the user's setting for the current task size.

#### Flow A: Recommend-Then-Execute (Default for Substantive Tasks)

```
User triggers an AI action (e.g., "Help me develop Chapter 3 scenes")
    │
    ▼
Frontend sends intent to Rust:
    invoke('agent_plan', {
        intent: "develop_scenes",
        scope: { book: "book-01", chapter: "ch-03" },
        message: "Help me break Chapter 3 into scenes...",
    })
    │
    ▼
Rust Agent Orchestrator:
    1. Analyzes intent → determines skill(s) needed
    2. Determines context files needed
    3. For each file, decides: include full content or generate summary
    4. Estimates token count and cost
    5. Returns a PLAN to the frontend (does NOT execute yet):
       {
         "plan_id": "abc-123",
         "skills": ["scene_architect"],
         "model": "claude-sonnet-4-5-20250929",
         "context_files": [
           { "path": "series/foundation.md", "mode": "summary", "tokens_est": 200 },
           { "path": "books/book-01/foundation/story-foundation.md", "mode": "full", "tokens_est": 800 },
           { "path": "books/book-01/structure/beat-outline.md", "mode": "full", "tokens_est": 2400 },
           { "path": "characters/marcus-cole.md", "mode": "summary", "tokens_est": 300 },
         ],
         "total_tokens_est": 8500,
         "estimated_cost": "$0.02",
         "approach": "I'll analyze your beat outline for Chapter 3's beats and
                      suggest a scene breakdown with Action/Reaction alternation..."
       }
    │
    ▼
Frontend displays the plan in the Agent Panel:
    - Shows which skills will be used
    - Shows which files will be read (with full/summary indicators)
    - Shows estimated tokens and cost
    - Shows the AI's proposed approach
    - User can: [✓ Approve] [✏️ Edit Plan] [✕ Cancel]
    │
    ▼
User approves (or edits and then approves)
    │
    ▼
Frontend sends: invoke('agent_execute', { plan_id: "abc-123" })
    │
    ▼
Rust Agent Orchestrator:
    1. Loads context files (full or summarized as specified)
    2. Assembles system prompt from skill definition
    3. Calls Claude API (streaming)
    4. Emits response chunks to frontend via Tauri events
    │
    ▼
Frontend receives streamed response and renders it in the chat panel
    │
    ▼
If the response contains actionable output (e.g., scene outlines, character
updates, prose), the frontend renders it with action buttons:
    [📄 Apply to scene-01/outline.md] [✏️ Edit First] [✕ Discard]
    │
    ▼
User clicks "Apply" → Frontend calls invoke('write_file', {...})
    → File is created/updated on disk
    → Project Explorer refreshes
    → book.json phase progress is updated
```

#### Flow B: Direct Execute (For Small Inline Tasks)

```
User selects text in editor → right-click → "Rewrite"
    │
    ▼
Frontend sends: invoke('agent_quick', {
    skill: "prose_editor",
    scope: { book: "book-01", chapter: "ch-01", scene: "scene-01" },
    selected_text: "Marcus felt sad about what happened.",
    action: "rewrite",
})
    │
    ▼
Rust loads minimal context (current scene outline + draft + character sheet)
    → Calls Claude API (streaming)
    → Returns rewrite options
    │
    ▼
Frontend shows inline suggestions below the selected text:
    Option 1: "Marcus stared at the wall. The silence had a weight to it."
    Option 2: "Something had hollowed out behind his ribs."
    [Apply 1] [Apply 2] [Try Again] [Cancel]
```

#### The User Setting

In app settings, a toggle controls the behavior:

```
AI Approval Mode:
  ○ Always recommend first (every interaction shows plan before executing)
  ● Smart (recommend for substantive tasks, auto-execute for inline actions) ← default
  ○ Always auto-execute (skip recommendations, just run)
```

"Substantive tasks" are defined as: any task that involves the `agent_plan` command (multi-step, multi-file, or generative tasks). "Inline actions" are defined as: single-selection editor actions (rewrite, expand, compress, continue, synonym).

---

## 4. File System Schema

### 4.1 Application Root

```
~/Documents/sAIpling/                      # Configurable in settings
├── .saipling/                             # Application-level config
│   ├── config.json                        # API key (encrypted), global preferences
│   ├── skills/                            # Skill template overrides/customizations
│   └── recent-projects.json               # Recently opened projects list
│
├── my-first-series/                       # Project directory
├── standalone-novel/                      # Another project (series with 1 book)
└── ...
```

### 4.2 config.json Schema

```json
{
  "version": "1.0.0",
  "api_key_encrypted": "...",
  "default_model": "claude-sonnet-4-5-20250929",
  "projects_root": "~/Documents/sAIpling",
  "theme": "darkPro",
  "editor": {
    "auto_save_interval_seconds": 30,
    "show_word_count": true,
    "spell_check": true
  },
  "ai": {
    "default_temperature": 0.7,
    "max_context_tokens": 150000,
    "stream_responses": true,
    "approval_mode": "smart"
  }
}
```

The `approval_mode` field accepts: `"always_recommend"`, `"smart"` (default), or `"always_execute"`.

### 4.3 Project Structure (Full Series with Front/Back Matter)

```
my-series/
├── project.json                           # Series metadata + phase progress
│
├── series/                                # Series-level Sapling deliverables
│   ├── foundation.md                      # Series Seed Phase
│   └── arc.md                             # Series macro-arc across books
│
├── world/                                 # Shared world-building (series-wide)
│   ├── world-bible.md                     # Core world rules, tone, era
│   ├── locations/
│   │   ├── neo-detroit.md
│   │   └── precinct-7.md
│   ├── factions/
│   │   └── city-council.md
│   ├── technology/
│   │   └── ai-surveillance-network.md
│   ├── history/
│   │   └── the-collapse.md
│   ├── magic-systems/                     # (if applicable to genre)
│   └── rules/                             # Genre-specific rules/conventions
│       └── detective-procedural-notes.md
│
├── characters/                            # Series-level character definitions
│   ├── _relationships.md                  # Relationship map / dynamics
│   ├── marcus-cole.md                     # Character sheet
│   ├── sarah-chen.md
│   └── ...
│
├── books/
│   ├── book-01/
│   │   ├── book.json                      # Book metadata + phase progress
│   │   │
│   │   ├── front-matter/                  # Literary front matter
│   │   │   ├── title-page.md              # Title, author, publisher info
│   │   │   ├── copyright.md               # Copyright notice
│   │   │   ├── dedication.md              # Dedication
│   │   │   ├── epigraph.md                # Epigraph / opening quote
│   │   │   ├── acknowledgments.md         # Acknowledgments (can also be back matter)
│   │   │   ├── foreword.md                # Foreword (if applicable)
│   │   │   ├── preface.md                 # Preface (if applicable)
│   │   │   └── prologue.md                # Prologue (if applicable)
│   │   │
│   │   ├── foundation/
│   │   │   └── story-foundation.md        # This book's Seed Phase deliverable
│   │   │
│   │   ├── structure/
│   │   │   └── beat-outline.md            # This book's 21-beat Root Phase outline
│   │   │
│   │   ├── characters/                    # Book-specific character journeys
│   │   │   ├── marcus-cole-journey.md     # Marcus's 8-point arc for THIS book
│   │   │   ├── sarah-chen-journey.md
│   │   │   └── detective-reyes.md         # Characters unique to this book
│   │   │
│   │   ├── chapters/
│   │   │   ├── ch-01/
│   │   │   │   ├── _chapter.md            # Chapter-level outline/notes
│   │   │   │   ├── scene-01/
│   │   │   │   │   ├── outline.md         # Scene outline (Action/Reaction, goals)
│   │   │   │   │   ├── draft.md           # Current working draft
│   │   │   │   │   ├── .drafts/           # Automatic draft snapshots
│   │   │   │   │   │   ├── 2026-02-19T14-30-00.md
│   │   │   │   │   │   └── 2026-02-18T09-15-00.md
│   │   │   │   │   └── attachments/       # Reference images, research, notes
│   │   │   │   │       ├── crime-scene-photo.png
│   │   │   │   │       └── research-notes.md
│   │   │   │   ├── scene-02/
│   │   │   │   │   └── ...
│   │   │   │   └── ...
│   │   │   ├── ch-02/
│   │   │   └── ...
│   │   │
│   │   ├── back-matter/                   # Literary back matter
│   │   │   ├── epilogue.md                # Epilogue (if applicable)
│   │   │   ├── afterword.md               # Afterword / author's note
│   │   │   ├── appendices/                # Appendices (maps, glossaries, etc.)
│   │   │   │   ├── glossary.md
│   │   │   │   └── map-of-neo-detroit.md
│   │   │   ├── acknowledgments.md         # Acknowledgments (if placed in back)
│   │   │   └── about-the-author.md        # About the author
│   │   │
│   │   └── notes/                         # Book-specific notes
│   │       └── subplot-ideas.md
│   │
│   ├── book-02/
│   │   └── ... (same structure)
│   └── ...
│
├── notes/                                 # Series-level free-form notes
│   ├── research-ai-surveillance.md
│   ├── ideas-for-book-3.md
│   └── brainstorming-session-2026-02-19.md
│
├── timeline/                              # Timeline data (optional, app-managed)
│   └── events.json                        # Story-world events with dates
│
└── exports/                               # Generated output files
    ├── book-01-draft-1.pdf
    └── book-01-draft-1.docx
```

### 4.4 project.json Schema

```json
{
  "version": "1.0.0",
  "name": "The Cole Files",
  "author": "Author Name",
  "genre": "noir / science fiction",
  "created": "2026-02-19T10:00:00Z",
  "modified": "2026-02-19T15:30:00Z",

  "series_phase_progress": {
    "seed": {
      "status": "complete",
      "completed_at": "2026-02-19T11:00:00Z",
      "elements": {
        "central_premise": true,
        "theme_statement": true,
        "series_arc_summary": true,
        "emotional_promise": true,
        "world_fundamentals": true
      }
    },
    "root": {
      "status": "in_progress",
      "elements": {
        "series_arc_outline": true,
        "book_count_planned": true,
        "per_book_premise": false
      }
    },
    "sprout": { "status": "not_started" },
    "world_building": {
      "status": "in_progress",
      "elements": {
        "world_bible": true,
        "locations": true,
        "factions": false,
        "technology": true
      }
    },
    "characters": {
      "status": "in_progress",
      "characters_defined": ["marcus-cole", "sarah-chen"],
      "relationships_mapped": true
    }
  },

  "books": [
    {
      "id": "book-01",
      "title": "The Broken Mirror",
      "sort_order": 1
    },
    {
      "id": "book-02",
      "title": "The Glass Ceiling",
      "sort_order": 2
    }
  ],

  "settings": {
    "preferred_model": "claude-sonnet-4-5-20250929",
    "writing_style_notes": "Terse, Chandler-esque prose. Short sentences. Heavy on atmosphere.",
    "pov": "first-person",
    "tense": "past"
  }
}
```

### 4.5 book.json Schema

```json
{
  "version": "1.0.0",
  "id": "book-01",
  "title": "The Broken Mirror",
  "sort_order": 1,
  "created": "2026-02-19T12:00:00Z",
  "modified": "2026-02-19T15:30:00Z",
  "target_word_count": 80000,
  "current_word_count": 12450,

  "phase_progress": {
    "seed": {
      "status": "complete",
      "completed_at": "2026-02-19T12:30:00Z",
      "elements": {
        "central_premise": true,
        "theme_statement": true,
        "protagonist_profile": true,
        "central_conflict": true,
        "story_world": true,
        "emotional_promise": true
      }
    },
    "root": {
      "status": "complete",
      "completed_at": "2026-02-19T13:00:00Z",
      "beats_completed": 21,
      "beats_total": 21
    },
    "sprout": {
      "status": "in_progress",
      "character_journeys": {
        "marcus-cole": { "stages_completed": 5, "stages_total": 8 },
        "sarah-chen": { "stages_completed": 3, "stages_total": 8 }
      }
    },
    "flourish": {
      "status": "in_progress",
      "scenes_outlined": 12,
      "scenes_total": 45
    },
    "bloom": {
      "status": "in_progress",
      "scenes_drafted": 4,
      "scenes_total": 45
    }
  },

  "front_matter": {
    "title_page": true,
    "copyright": false,
    "dedication": true,
    "epigraph": false,
    "acknowledgments": false,
    "foreword": false,
    "preface": false,
    "prologue": true
  },

  "back_matter": {
    "epilogue": false,
    "afterword": false,
    "appendices": [],
    "acknowledgments": false,
    "about_the_author": false
  },

  "chapters": [
    {
      "id": "ch-01",
      "title": "The Call",
      "sort_order": 1,
      "scenes": [
        { "id": "scene-01", "title": "3 AM Phone Call", "sort_order": 1, "type": "action", "status": "drafted", "word_count": 2100 },
        { "id": "scene-02", "title": "Marcus Resists", "sort_order": 2, "type": "reaction", "status": "outlined", "word_count": 0 }
      ]
    },
    {
      "id": "ch-02",
      "title": "The Crime Scene",
      "sort_order": 2,
      "scenes": [
        { "id": "scene-01", "title": "Arrival at the Warehouse", "sort_order": 1, "type": "action", "status": "drafted", "word_count": 3200 }
      ]
    }
  ]
}
```

### 4.6 Markdown File Formats (with YAML Frontmatter)

All content files use YAML frontmatter for machine-readable metadata while keeping the body human-readable.

#### Story Foundation (Seed Phase Deliverable)

```markdown
---
type: story-foundation
scope: book
book: book-01
created: 2026-02-19
modified: 2026-02-19
status: complete
---

# Story Foundation — The Broken Mirror

## Central Premise
A disgraced detective must solve the murder of the woman he once loved, only to
discover the killer is someone he trusted with his life.

## Theme Statement
Trust, once broken, can never be fully restored — but the attempt to restore it
is what defines us.

## Protagonist Profile
**Marcus Cole** — Brilliant but emotionally guarded detective who pushes people
away to avoid being hurt. Wants justice but needs to learn to trust again.

## Central Conflict
The evidence points to Marcus's former partner, the one person he allowed himself
to trust after years of isolation — forcing him to choose between loyalty and justice.

## Story World Fundamentals
Near-future city where AI-assisted surveillance has made traditional detective work
nearly obsolete, but Marcus refuses to rely on systems he can't trust.

## Emotional Promise
A bittersweet sense of hard-won peace — Marcus doesn't get everything he wants,
but he gets what he needs.
```

#### Beat Outline (Root Phase Deliverable)

```markdown
---
type: beat-outline
book: book-01
created: 2026-02-19
modified: 2026-02-19
status: complete
beats_completed: 21
---

# 21-Beat Story Outline — The Broken Mirror

## Act One: The Known World

### Beat 1: Opening Image
Marcus alone in his apartment at 3 AM, surrounded by cold case files,
the blue glow of surveillance feeds he hacks but won't use officially.
Establishes his isolation and distrust of technology.

### Beat 2: Daily Life
[content...]

### Beat 3: Inciting Incident
[content...]

[...all 21 beats...]
```

#### Character Sheet

```markdown
---
type: character
scope: series
name: Marcus Cole
role: protagonist
created: 2026-02-19
modified: 2026-02-19
tags: [detective, main-cast, pov-character]
---

# Marcus Cole

## Core Identity
Age 42. Homicide detective, 18 years on the force...

## Appearance
Tall, lean to the point of gaunt...

## Want vs Need
- **Want**: Justice for Elena. To prove the department's AI-first approach is flawed.
- **Need**: To learn that trust — in people and systems — is not the same as vulnerability.

## Defining Flaw
Cannot allow himself to be vulnerable...

## Ghost / Backstory Wound
Three years ago, Marcus trusted his partner James...

## Speech Patterns
Short sentences. Deflects with dry humor...

## Key Relationships
[relationships listed...]

## Character Arc Summary
Begins isolated and distrustful → forced into collaboration → learns to integrate
human instinct with systematic approaches → ultimately chooses trust over self-protection
→ ends connected but changed.
```

#### Character Journey (Book-Level, Sprout Phase)

```markdown
---
type: character-journey
book: book-01
character: marcus-cole
created: 2026-02-19
modified: 2026-02-19
status: in_progress
stages_completed: 5
---

# Marcus Cole — Character Journey (Book 1)

## Stage 1: Comfort Zone
**Aligns with: Opening Image, Daily Life (Beats 1-2)**
[content...]

## Stage 2: Desire Emerges
**Aligns with: Inciting Incident (Beat 3)**
[content...]

[...all 8 stages...]
```

#### Scene Outline (Flourish Phase)

```markdown
---
type: scene-outline
book: book-01
chapter: ch-01
scene: scene-01
title: "3 AM Phone Call"
scene_type: action
pov_character: marcus-cole
location: marcus-apartment
beats: [1, 2, 3]
created: 2026-02-19
modified: 2026-02-19
status: complete
---

# Scene 1.1 — 3 AM Phone Call

## Scene Type: ACTION

### Character Goal
Marcus wants to be left alone...

### Mounting Conflict
- Phone rings at 3 AM — Marcus ignores it
- It rings again — caller leaves voicemail
[...]

### Outcome Crisis
Rosa reveals Elena left a note naming Marcus...

## Setting Details
Marcus's apartment. Small, neat to the point of sterile...

## Characters Present
- Marcus Cole (POV)
- Rosa Vasquez (voice only — phone call)

## Advances Plot By
[...]

## Advances Character Arc By
[...]

## Notes / Attachments
[...]
```

#### Scene Draft (Bloom Phase)

```markdown
---
type: scene-draft
book: book-01
chapter: ch-01
scene: scene-01
draft_number: 1
word_count: 2100
created: 2026-02-19
modified: 2026-02-19
status: first_draft
---

The phone rang at three in the morning.

Marcus did not move. The blue glow of the surveillance feeds painted
the ceiling in shifting patterns...
```

#### Relationship Map

```markdown
---
type: relationships
scope: series
created: 2026-02-19
modified: 2026-02-19
---

# Character Relationships

## Marcus Cole ↔ Elena Vasquez
- **Nature**: Former lovers, deep emotional bond
- **Status at story start**: Estranged (3 years no contact)
- **Tension**: [...]
- **Arc**: [...]

## Marcus Cole ↔ James Okafor
[...]
```

#### World Bible

```markdown
---
type: world-bible
scope: series
created: 2026-02-19
modified: 2026-02-19
---

# World Bible — The Cole Files

## Era & Setting
Near-future (approximately 2045)...

## Core World Rule
AI-assisted surveillance has made traditional detective work nearly obsolete...

## Technology Level
[...]

## Social Dynamics
[...]

## Rules for the Story
1. The AI is not sentient...
2. The surveillance system has real blind spots...
3. Technology is morally neutral...
```

#### Front Matter Example (Title Page)

```markdown
---
type: front-matter
subtype: title-page
book: book-01
created: 2026-02-19
modified: 2026-02-19
---

# The Broken Mirror

### Book One of The Cole Files

*by Author Name*

*Publisher Name, 2026*
```

#### Front Matter Example (Dedication)

```markdown
---
type: front-matter
subtype: dedication
book: book-01
created: 2026-02-19
modified: 2026-02-19
---

*For everyone who ever trusted someone they shouldn't have — and the ones brave enough to try again.*
```

#### Back Matter Example (Epilogue)

```markdown
---
type: back-matter
subtype: epilogue
book: book-01
created: 2026-02-19
modified: 2026-02-19
---

# Epilogue

Six months later, the surveillance cameras still watched...
```

---

## 5. Sapling Phase State Machine

### 5.1 Overview

The Sapling Framework operates at two levels: **Series Level** and **Book Level**. Series-level work (world-building, character creation, series arc) happens once and applies to all books. Book-level work (the five Sapling phases) happens per book.

### 5.2 Series-Level Phases

These are not strictly sequential — they can be worked on in any order and revisited.

- **Series Seed**: Series-wide premise, theme, emotional promise, overarching arc
- **World Building**: Bible, locations, factions, technology, history, rules
- **Characters**: Character sheets, relationship dynamics
- **Series Root**: Macro-arc across books, per-book premise planning

### 5.3 Book-Level Phases

Each book progresses through five phases. They are sequential but the user can always go back to refine earlier phases.

```
SEED ──→ ROOT ──→ SPROUT ──→ FLOURISH ──→ BLOOM
  │        │        │           │           │
  └────────┴────────┴───────────┴───────────┘
            (can always revisit)
```

### 5.4 Phase Definitions & Completion Criteria

#### SEED (Story Foundation)

| Element | Required | Completion Check |
|---------|----------|-----------------|
| Central Premise | Yes | Non-empty |
| Theme Statement | Yes | Non-empty |
| Protagonist Profile | Yes | Non-empty, includes Want and Need |
| Central Conflict | Yes | Non-empty |
| Story World | Yes | Non-empty |
| Emotional Promise | Yes | Non-empty |

**Complete when**: All six elements present in `foundation/story-foundation.md`.
**Primary skill**: `seed_developer`

#### ROOT (Story Structure)

| Element | Required | Completion Check |
|---------|----------|-----------------|
| 21 beats outlined | Yes | All 21 beats have content in `structure/beat-outline.md` |

**Complete when**: All 21 beats have substantive content.
**Primary skill**: `structure_analyst`

#### SPROUT (Character Journeys)

| Element | Required | Completion Check |
|---------|----------|-----------------|
| Protagonist 8-point journey | Yes | All 8 stages have content |
| Key supporting character journeys | Suggested | Not required for completion |
| Relationship dynamics doc | Suggested | Not required for completion |

**Complete when**: Protagonist journey fully developed (all 8 stages).
**Primary skills**: `character_developer`, `relationship_mapper`

#### FLOURISH (Scene Construction)

| Element | Required | Completion Check |
|---------|----------|-----------------|
| Chapter structure defined | Yes | At least one chapter exists |
| Scene outlines | Yes | Each scene has type, goal, conflict |

**Complete when**: All planned scenes have outlines.
**Primary skills**: `scene_architect`, `consistency_checker`

#### BLOOM (Paragraph Craft)

| Element | Required | Completion Check |
|---------|----------|-----------------|
| Scene drafts | Yes | Each scene has draft.md with content |

**Complete when**: All scenes have draft content (first draft exists).
**Primary skills**: `prose_writer`, `prose_editor`, `describe`, `dialogue_crafter`

### 5.5 Phase States

```
not_started → in_progress → complete
                   ↑            │
                   └────────────┘
                   (revisiting)
```

---

## 6. AI Agent System

### 6.1 Overview

The AI Agent System is the core intelligence layer of sAIpling. It sits between the user's intent and the Claude API, handling planning, context assembly, parallel execution, and result formatting.

### 6.2 Agent Orchestrator

The Agent Orchestrator lives in the Rust backend and handles:

1. **Intent Analysis**: Given a user message and current context (what file is open, what phase they're in), determine what skill(s) are needed and what the AI should do.

2. **Context Planning**: Determine which project files are relevant. For each file, decide whether to include the full content or a summary. This decision is based on:
   - **Relevance**: How directly related is this file to the task?
   - **Token budget**: How much context can we afford?
   - **File size**: Large files (e.g., a full beat outline) may need summarization if they're secondary context.

3. **Summarization**: The agent can generate summaries of .md files for use as context. Summaries are generated by a fast, cheap Claude call (Haiku) that extracts the key information from a file into a compressed form. Summaries are cached in memory (not written to disk) and invalidated when the source file changes.

4. **Plan Generation**: Before executing, the agent generates a plan that the user can review:
   - Which skill(s) will be used
   - Which files will be loaded (full or summarized)
   - What model will be used
   - Estimated token count and cost
   - A brief description of the approach

5. **Parallel Execution**: For complex tasks that involve multiple steps (e.g., "develop scene outlines for all of Chapter 3"), the agent can execute multiple Claude calls in parallel and merge the results.

6. **Result Formatting**: AI responses that produce actionable output (new files, edits to existing files, structured data) are parsed and presented to the user with clear apply/edit/discard actions.

### 6.3 Context Assembly Rules

The Context Assembler follows this process:

```
1. Load the skill definition (TOML file)
2. Resolve the scope:
   - If scope includes a book → load book-level context
   - If scope includes a chapter/scene → load scene-level context
   - Always load series-level context from always_include
3. For each context file:
   a. Check file size and estimate tokens
   b. If file is in always_include → include full
   c. If file is directly relevant to the task → include full
   d. If file is secondary context and large → generate/use cached summary
   e. If file would push total over token budget → summarize or exclude
4. Build the system prompt:
   - Start with the skill's system_prompt.template
   - Substitute variables (genre, existing content, style notes, etc.)
5. Build the context block:
   - Concatenate loaded files with clear delimiters:
     "=== FILE: characters/marcus-cole.md (FULL) ==="
     "=== FILE: world/world-bible.md (SUMMARY) ==="
6. Estimate total tokens (system + context + conversation history + user message)
7. If still over budget after summarization:
   - Remove least-relevant optional files
   - Truncate conversation history (keep most recent messages)
8. Assemble final API payload
```

### 6.4 Actionable Output Format

When Claude's response contains content that should be applied to files, the AI is instructed (via skill system prompts) to use a structured format:

```markdown
Here's a scene outline for Chapter 3, Scene 1:

```saipling-apply
target: books/book-01/chapters/ch-03/scene-01/outline.md
action: create
---
type: scene-outline
book: book-01
chapter: ch-03
scene: scene-01
title: "The Warehouse Discovery"
scene_type: action
pov_character: marcus-cole
location: abandoned-warehouse
beats: [5]
created: 2026-02-19
modified: 2026-02-19
status: complete
---

# Scene 3.1 — The Warehouse Discovery

## Scene Type: ACTION

### Character Goal
Marcus needs to find physical evidence the AI forensics missed...
[...]
```​

The frontend parses these `saipling-apply` blocks and renders them as actionable cards:

```
┌─────────────────────────────────────────┐
│ 📄 Create: ch-03/scene-01/outline.md    │
│                                          │
│  [Preview content...]                    │
│                                          │
│  [✓ Apply] [✏️ Edit First] [✕ Discard]  │
└─────────────────────────────────────────┘
```

When the user clicks "Apply", the frontend calls `invoke('write_file', ...)` with the parsed content. When they click "Edit First", the content opens in the TipTap editor for modification before saving.

For modifications to existing files, the AI uses:

```markdown
```saipling-apply
target: characters/marcus-cole.md
action: replace
section: "## Defining Flaw"
---
## Defining Flaw
Cannot allow himself to be vulnerable. Treats emotional distance as
professional discipline. Unconsciously tests people's loyalty by pushing
them away — if they leave, it confirms his belief that trust is dangerous.
If they stay, he pushes harder.
```​

The `action` field can be: `create` (new file), `replace` (replace a section), `append` (add to end), or `update_frontmatter` (modify YAML frontmatter only).

### 6.5 Summary Cache

The agent maintains an in-memory cache of file summaries:

```rust
struct SummaryCache {
    entries: HashMap<PathBuf, CacheEntry>,
}

struct CacheEntry {
    summary: String,
    source_hash: u64,        // Hash of the source file content
    token_count: usize,
    created_at: Instant,
}
```

Summaries are invalidated when:
- The source file's hash changes (detected via file watcher or on read)
- The app restarts (cache is not persisted)
- The user manually requests fresh context

### 6.6 Token Estimation

The Rust backend includes a token estimation function using `tiktoken-rs` (the `cl100k_base` encoding, which is close to Claude's tokenizer). This provides:
- Accurate-enough estimates for context planning
- Cost estimation displayed to the user before execution
- Budget management during context assembly

### 6.7 Model Selection

| Task Category | Default Model | Rationale |
|---------------|---------------|-----------|
| Summarization (internal) | Haiku | Fast, cheap, summaries don't need creativity |
| Inline actions (rewrite, expand, etc.) | Sonnet | Good balance of quality and speed |
| Most skill-based work | Sonnet | Best quality/cost ratio for collaborative writing |
| Complex multi-book analysis | Opus | Deep reasoning across large context |
| Consistency checking (full book) | Opus | Needs to hold many facts simultaneously |

The user can override the model for any individual interaction. The plan preview shows which model will be used.

---

## 7. Claude Skills

### 7.1 What Is a Skill?

A skill is a TOML configuration file that tells the agent:
1. **What system prompt to use** (positions Claude for a specific role)
2. **What context files to load** (which project files are relevant)
3. **What model to default to** (Haiku/Sonnet/Opus)
4. **What temperature to use** (creative vs analytical)

Skills are stored in `src-tauri/skills/` (built-in) and can be overridden by the user in `.saipling/skills/`.

### 7.2 Skill Definition Format

```toml
[skill]
name = "seed_developer"
display_name = "Seed Phase Developer"
description = "Helps develop the six core elements of a story's foundation"
default_model = "claude-sonnet-4-5-20250929"
temperature = 0.8

[context]
always_include = [
    "series/foundation.md",
]

[context.when_book]
include = [
    "{book}/foundation/story-foundation.md",
]

[context.optional]
include_if_exists = [
    "world/world-bible.md",
]

max_context_tokens = 30000

[system_prompt]
template = """
You are a creative story development collaborator helping a writer develop
the foundation of their novel using the Sapling Story Structure Framework's
Seed Phase.

Your role is to help crystallize the story idea into six Core Elements:
1. Central Premise — A single sentence capturing the entire story
2. Theme Statement — The fundamental truth the story explores
3. Protagonist Profile — Essential traits, want, need, and defining flaw
4. Central Conflict — The primary opposition driving the plot
5. Story World Fundamentals — What makes this world distinctive
6. Emotional Promise — What the reader will feel by the end

Guidelines:
- Ask targeted questions to draw out the writer's vision
- Offer 2-3 alternatives for each element so the writer has real choices
- Work on one element at a time unless the writer wants to jump around
- Check coherence between elements as they develop
- Keep suggestions specific and grounded in the story's genre/tone
- When all elements are complete, perform a coherence check

When producing completed or revised elements, use the saipling-apply format
to make them directly applicable to the story-foundation.md file.

{genre_context}
{existing_foundation_context}
"""
```

### 7.3 Complete Skill Inventory

Below is every skill the application ships with. Each must be implemented as a complete TOML file in `src-tauri/skills/`.

#### 7.3.1 brainstorm

**Purpose**: Open-ended creative exploration and idea generation.
**Default model**: Sonnet
**Temperature**: 0.9
**Context**: Series foundation + world bible (if exists). Minimal context — this is for free-form ideation.
**When used**: Any time. Available as a quick-launch option. Default skill when no file is open and no phase is active.

**System prompt core**: Position Claude as a generative creative partner. Encourage "what if" thinking, unexpected connections, multiple options. Don't worry about structure or consistency — that comes in later phases. Build on the writer's ideas rather than replacing them.

#### 7.3.2 seed_developer

**Purpose**: Guided development of the six Core Elements during the Seed Phase.
**Default model**: Sonnet
**Temperature**: 0.8
**Context**: Series foundation, book foundation (if exists), world bible (optional).
**When used**: Seed Phase workflow, or when editing story-foundation.md.

**System prompt core**: Walk the writer through each of the six elements one at a time. For each element, offer 2-3 specific options grounded in the story's genre. After all elements exist, check coherence: Does the conflict test the protagonist's flaw? Does the theme connect to the emotional promise? Use saipling-apply format for completed elements.

#### 7.3.3 structure_analyst

**Purpose**: Develops and validates the 21-beat story structure during the Root Phase.
**Default model**: Sonnet
**Temperature**: 0.7
**Context**: Series foundation, series arc, book foundation, book beat outline, world bible (summary), all character sheets (summaries).
**When used**: Root Phase workflow, or when editing beat-outline.md.

**System prompt core**: Help develop each of the 21 beats with specific, vivid content. Check structural balance (act proportions), escalation through Act Two, Opening/Closing Image contrast. Validate against Story Foundation — does structure serve the premise? Ensure Climactic Confrontation resolves Central Conflict. Ensure Final Decision connects to Theme. Identify underdeveloped beats. Use saipling-apply format for completed beats. Include the full 21-beat reference list in the prompt.

#### 7.3.4 character_developer

**Purpose**: Develops character sheets and 8-point character journeys during the Sprout Phase.
**Default model**: Sonnet
**Temperature**: 0.8
**Context**: Series foundation, relevant character sheet(s), book foundation, book beat outline, existing book character journeys, relationship map.
**When used**: Sprout Phase workflow, character sheet editing.

**System prompt core**: Help develop rich, internally consistent characters. Ensure Want and Need are distinct and create tension. Verify Defining Flaw is tested by the plot. Map journey stages to specific beats. Check character growth feels earned. Ensure distinctive voice/speech patterns. Include the 8-Point Character Journey Cycle reference. Use saipling-apply format for completed character sheets and journey stages.

#### 7.3.5 relationship_mapper

**Purpose**: Maps and develops character relationships and dynamics.
**Default model**: Sonnet
**Temperature**: 0.7
**Context**: All character sheets, relationship map, book foundation, book beat outline, book character journeys.
**When used**: Editing _relationships.md, or when working on character dynamics.

**System prompt core**: Map how characters relate. Track how relationships shift across the story. Identify dynamics that serve the theme. Flag missing relationships. Suggest complications. Ensure changes are motivated by plot events. Use saipling-apply format for the relationship map.

#### 7.3.6 world_builder

**Purpose**: Develops world-building elements — locations, factions, technology, history, rules.
**Default model**: Sonnet
**Temperature**: 0.8
**Context**: Series foundation, world bible, all world/ files, character sheets (summaries).
**When used**: Editing any world/ file, or when developing world elements.

**System prompt core**: Develop locations with sensory detail and narrative function. Build factions with goals and tensions. Design technology/magic that serves themes. Create history that informs conflicts. Ensure internal consistency. Every detail should connect to characters, conflict, or theme. Use saipling-apply format for world documents.

#### 7.3.7 scene_architect

**Purpose**: Designs individual scenes using the Action/Reaction pattern during the Flourish Phase.
**Default model**: Sonnet
**Temperature**: 0.7
**Context**: Series foundation, book foundation, book beat outline, chapter outline, all scene outlines in the current chapter, previous and next scene outlines/drafts, relevant character sheets, relevant location entries.
**When used**: Flourish Phase workflow, scene outline editing.

**System prompt core**: Help design scenes that serve both plot and character arc. Ensure Action/Reaction alternation. Verify scene goals connect to character's larger motivation. Check continuity (locations, timeline, information state). Ensure genuine conflict in every scene. Include Action Scene and Reaction Scene component references. Use saipling-apply format for scene outlines.

#### 7.3.8 prose_writer

**Purpose**: Assists with drafting prose during the Bloom Phase. Adapts to the writer's voice and style.
**Default model**: Sonnet
**Temperature**: 0.8
**Context**: Scene outline, current scene draft, previous scene's ending, character sheets for characters present, location entry, book foundation, scene attachments.
**When used**: Bloom Phase, active prose writing.

**System prompt core**: Write in the writer's voice and style, not your own. Use the four-beat paragraph pattern (External Stimulus → Internal Response → Visible Action → Consequential Result) as a default rhythm, varying for effect. Match established voice and tone. Maintain character-distinct dialogue. Keep continuity with previous scene. Never generate prose unprompted — wait for the writer to request, then offer options. Include project style notes, POV, and tense. Use saipling-apply format for drafted scenes.

#### 7.3.9 prose_editor

**Purpose**: Reviews and suggests improvements to existing draft prose.
**Default model**: Sonnet
**Temperature**: 0.5
**Context**: Scene outline, scene draft, previous scene draft, book foundation, relevant character sheets.
**When used**: When user asks for editorial feedback, or when using inline edit actions.

**System prompt core**: Look for clarity, rhythm, show-vs-tell, dialogue distinctness, sensory detail, pacing, consistency, redundancy, word choice. Be specific with feedback. Explain why changes are suggested. Preserve the writer's voice. Prioritize impactful changes. When suggesting rewrites, offer 2-3 options. Include project style notes. Use saipling-apply format with `action: replace` for edits.

#### 7.3.10 describe

**Purpose**: Generates rich multi-sense descriptions for settings, objects, and moments.
**Default model**: Sonnet
**Temperature**: 0.85
**Context**: Scene outline, scene draft, relevant location entry, world bible.
**When used**: Any phase, primarily Bloom. Triggered by selecting a passage and choosing "Describe."

**System prompt core**: Provide sensory details across sight, sound, smell, touch, taste, and metaphor. Provide details as a menu of options the writer can select from — not complete paragraphs. Let the writer compose. Match project tone and style.

#### 7.3.11 dialogue_crafter

**Purpose**: Helps write character-distinct dialogue that serves the scene's goals.
**Default model**: Sonnet
**Temperature**: 0.8
**Context**: Scene outline, scene draft, character sheets for all characters in scene, book character journeys.
**When used**: Bloom Phase, dialogue-heavy scenes.

**System prompt core**: Consider speech patterns, emotional state, hidden agendas/subtext, relationships between characters present. Each character must sound distinct. Subtext is more interesting than text. Dialogue should do double duty (advance plot AND reveal character). Offer multiple versions: direct, evasive, revealing. Include beats (physical actions between lines). Use saipling-apply format for dialogue passages.

#### 7.3.12 consistency_checker

**Purpose**: Scans for contradictions, timeline issues, and continuity errors.
**Default model**: Sonnet (Opus for full-book checks)
**Temperature**: 0.3
**Context**: World bible, all character sheets, relationship map, beat outline, all book character journeys, all scene outlines, and (for the scope being checked) full scene drafts.
**When used**: Any phase. Can be triggered on a single scene, a chapter, or an entire book.

**System prompt core**: Check character consistency, timeline errors, location continuity, information state (does a character know something they shouldn't yet?), world rule violations, physical impossibilities, relationship consistency. Report findings as a structured list with severity (ERROR/WARNING), location, description, and suggested fix. Be thorough but not pedantic.

#### 7.3.13 researcher

**Purpose**: Helps research real-world topics to inform fiction.
**Default model**: Sonnet
**Temperature**: 0.5
**Context**: Series foundation, world bible, relevant notes.
**When used**: Any time. Available via skill selector.

**System prompt core**: Provide accurate factual information. Explain technical subjects usably. Suggest realistic details for authenticity. Flag when the premise departs from reality and help do so plausibly. When uncertain, say so — never fabricate details the writer might rely on. The goal is enough accuracy that knowledgeable readers aren't pulled out of the story.

#### 7.3.14 series_arc_planner

**Purpose**: Plans and maintains the overarching arc across multiple books.
**Default model**: Opus
**Temperature**: 0.7
**Context**: Series foundation, series arc, all book foundations (full), all book beat outlines (summaries), all character sheets.
**When used**: Series-level planning, editing series/arc.md.

**System prompt core**: Plan overarching series premise, theme, emotional arc. Ensure each book stands alone while contributing to series arc. Track character growth across books. Plan escalation from book to book. Identify series-level plants and payoffs. Ensure satisfying overall shape. Help plan what each book contributes. Use saipling-apply format for series arc.

#### 7.3.15 genre_specialist

**Purpose**: Genre-specific guidance on conventions, tropes, reader expectations, and subversion.
**Default model**: Sonnet
**Temperature**: 0.7
**Context**: Series foundation, book foundation.
**When used**: Any phase, particularly Seed and Root.

**System prompt core**: Identify genre conventions relevant to the story. Suggest which tropes to embrace vs subvert. Flag violations of reader expectations (frustrating vs delightful). Recommend comparable works. Calibrate tone, pacing, and content for genre audience. Advise on genre-specific structural patterns. Be specific but never prescriptive.

#### 7.3.16 front_back_matter_writer

**Purpose**: Helps write front matter and back matter elements (dedications, epigraphs, author's notes, epilogues, etc.).
**Default model**: Sonnet
**Temperature**: 0.7
**Context**: Series foundation, book foundation, book beat outline, relevant character sheets, existing front/back matter files.
**When used**: When creating or editing any file in front-matter/ or back-matter/.

**System prompt core**: Help craft literary front and back matter. Dedications should be personal and meaningful. Epigraphs should resonate with the book's themes. Prologues should hook the reader while serving the story. Epilogues should provide satisfying closure (or deliberate openness). Author's notes should feel authentic. Appendices should enrich the world without being dry. Match the tone of the novel. Use saipling-apply format.

### 7.4 Skill Selection Logic

The agent determines which skill to load based on context:

```
IF user explicitly selects a skill → use that skill
ELSE IF user is in a Phase Workflow:
    Seed Phase → seed_developer
    Root Phase → structure_analyst
    Sprout Phase → character_developer (or relationship_mapper if on relationships view)
    Flourish Phase → scene_architect
    Bloom Phase → prose_writer
ELSE IF user has a file open in the editor:
    story-foundation.md → seed_developer
    beat-outline.md → structure_analyst
    *-journey.md → character_developer
    _relationships.md → relationship_mapper
    world-bible.md or world/**/*.md → world_builder
    outline.md (scene) → scene_architect
    draft.md → prose_writer
    series/arc.md → series_arc_planner
    front-matter/*.md → front_back_matter_writer
    back-matter/*.md → front_back_matter_writer
ELSE → brainstorm (default)
```

---

## 8. User Flow

### 8.1 First Launch

```
1. App opens → Welcome screen
2. User enters Anthropic API key → Validated with test request → Stored encrypted
3. User chooses: "New Project" or "Open Existing"
4. If new → Project creation wizard:
   a. Project name
   b. Is this a series or standalone novel?
      (standalone = series with one book, UI simplifies accordingly)
   c. Genre (optional, helps AI calibrate tone)
   d. Working directory (defaults to ~/Documents/sAIpling/<project-name>/)
5. App creates full directory structure on disk
6. User lands on the Dashboard
```

### 8.2 The Dashboard

The dashboard is the home screen for a project. It shows:

- **Project info**: Name, genre, author, word counts
- **Series-level status cards**: World Bible (exists/empty), Characters defined (count), Series Arc (status)
- **Book cards**: Each book shows its phase progress (5-phase indicator: ○ ◐ ✓ for each phase), word count, last modified date
- **Quick actions**: "Continue where I left off" (opens most recently edited file), "Start next phase" (opens guided workflow for next incomplete phase), "New Book" (adds a book to the series)

This is a functional overview — no decorative visualizations. Clean, information-dense, and actionable.

### 8.3 Series-Level Work

From the dashboard, the user can work on series-level content at any time:

**World Building**:
- User clicks into the World section via sidebar → Browses world/ directory
- Can create new entries (locations, factions, etc.) or edit existing ones in TipTap
- AI chat available with `world_builder` skill loaded
- User can ask Claude to flesh out locations, check consistency, suggest missing elements
- AI responses with new world content use saipling-apply format → user approves to create files

**Characters**:
- User clicks into Characters section → Sees list of character sheets
- "New Character" button → AI-assisted workflow or blank template
- AI chat with `character_developer` skill
- Relationship map view → Renders _relationships.md as a visual graph
- Clicking a relationship opens it for editing

**Series Foundation & Arc**:
- Series Seed Phase workflow (similar to book Seed but focused on overarching series)
- Series arc planning with `series_arc_planner` skill

### 8.4 Book-Level Work — Phase by Phase

#### 8.4.1 Seed Phase Workflow

The Seed Phase uses a guided conversational workflow.

```
1. User selects a book → enters Seed Phase
2. App opens the Seed Phase view:
   - Left column: Six core element cards (empty → filled)
   - Center: AI chat conversation with seed_developer skill
   - Right column (optional): story-foundation.md live preview
3. Claude begins:
   "Let's develop the foundation for this book. Tell me about the story
    you want to tell — it can be as rough as a feeling or as specific as
    a full plot."
4. User responds (can be minimal: "a noir detective story set in the future")
5. Claude asks targeted follow-ups, one element at a time
6. For each element, Claude offers 2-3 specific options using saipling-apply format
7. User can:
   - Approve a suggestion → written to story-foundation.md
   - Edit and approve → modified version written
   - Ask for different options → Claude generates more
   - Write their own → typed directly into the element card
8. Once all six elements exist, Claude performs a coherence check
9. User marks phase complete or continues refining
```

**Minimal-input mode**: The user can simply say "a detective noir in a cyberpunk city" and Claude can generate all six elements for review. The user just approves/edits each one. An entire Seed Phase can be completed in minutes with minimal typing.

#### 8.4.2 Root Phase Workflow

```
1. User enters Root Phase
2. App opens the Root Phase view:
   - Left column: 21 beats as a scrollable list (acts color-coded)
   - Center: Selected beat + AI chat with structure_analyst skill
   - Right column: Story Foundation reference panel
3. The user can work on beats in any order. The UI suggests starting with
   "anchor beats" (Inciting Incident, Midpoint Shift, Climactic Confrontation,
   Closing Image) that writers typically feel strongest about.
4. For each beat, the user can:
   - Write it directly
   - Ask Claude to suggest content based on the story foundation and surrounding beats
   - Ask Claude to generate ALL beats at once for review
5. Claude checks structural coherence as beats are developed
6. Phase complete when all 21 beats have content
```

**Minimal-input mode**: After the Seed Phase is complete, the user can say "generate all 21 beats based on my story foundation" and Claude will produce a complete beat outline for review. The user approves, edits individual beats, or asks for revisions.

#### 8.4.3 Sprout Phase Workflow

```
1. User enters Sprout Phase
2. App opens the Sprout Phase view:
   - Left column: Characters with journey progress indicators
   - Center: 8-stage journey builder for selected character
   - Right column: Beat outline reference (for alignment)
3. User selects a character (protagonist first)
4. For each of the 8 journey stages:
   - UI shows which beats this stage aligns with
   - User writes, or asks Claude to generate based on character sheet + beats
5. Relationship mapper view shows character connections visually
6. Phase complete when protagonist's full journey is developed
```

**Minimal-input mode**: Claude can generate complete character journeys for all characters based on the beat outline and character sheets. User reviews and approves.

#### 8.4.4 Flourish Phase Workflow

```
1. User enters Flourish Phase
2. App opens the Flourish Phase view:
   - Left column: Chapter/Scene tree (drag-to-reorder)
   - Center: Scene outline editor
   - Right column: Context panel (beats, character arcs, world entries)
3. User creates chapters and scenes, or asks Claude to suggest a complete
   chapter/scene breakdown based on the beat outline
4. For each scene, fills out: type (Action/Reaction), goal, conflict, outcome,
   POV character, location, characters present, beat coverage
5. Claude checks Action/Reaction alternation, continuity, pacing
6. User can attach reference images, research notes to scenes
7. Phase complete when all scenes have outlines
```

**Minimal-input mode**: "Generate a complete scene-by-scene breakdown for Book 1 based on my beat outline and character journeys." Claude produces all chapter structures and scene outlines. User reviews, reorders, and approves.

#### 8.4.5 Bloom Phase Workflow

```
1. User enters Bloom Phase
2. App opens the writing environment:
   - Left column: Chapter/Scene navigator (compact)
   - Center: TipTap editor (full-width prose editing)
   - Right column (toggleable): AI chat with prose_writer skill
3. The user writes scene by scene, or asks Claude to draft scenes
4. AI assistance available in multiple modes:
   a. CHAT MODE: Open conversation about the scene
   b. INLINE MODE: Select text → context menu → action:
      - Rewrite (offers tone options)
      - Expand (add detail)
      - Compress (tighten)
      - Continue (draft next paragraph from cursor)
      - Describe (multi-sense detail)
      - Dialogue Help
      - Check Consistency
      - Word Alternative (synonym)
   c. FULL DRAFT MODE: "Draft this entire scene based on the outline"
5. Auto-save creates snapshots in .drafts/
6. Word count tracking per scene, per chapter, per book
7. Phase complete when all scenes have draft content
```

**Minimal-input mode**: "Draft all scenes for Chapter 1." Claude produces complete prose drafts for each scene, following the scene outlines, character voices, and established style. User reviews, edits, and approves each scene. An entire book can be drafted this way.

### 8.5 Front Matter and Back Matter

Front matter and back matter are accessible from the Book view in the sidebar:

```
Book 1: The Broken Mirror
├── Front Matter
│   ├── Title Page
│   ├── Dedication
│   ├── Epigraph
│   └── Prologue
├── Chapters
│   ├── Chapter 1: The Call
│   └── ...
└── Back Matter
    ├── Epilogue
    ├── Glossary
    └── About the Author
```

The user can add or remove front/back matter sections from a menu. Each section is a .md file edited in TipTap. The `front_back_matter_writer` skill is available in the AI chat when editing these sections. The export system includes front and back matter in the correct order.

### 8.6 Navigation & Access Patterns

At any point, the user can:

- **Browse and edit any file** via the Project Explorer sidebar
- **Open the AI Chat** with any skill — not locked to phase-specific skills
- **View the Dashboard** for overall progress
- **Edit series-level content** (world, characters) — these are living documents
- **Jump between books** in a series
- **Create and browse notes** at any level
- **Edit front matter and back matter** for any book

The phase workflow is a guide, not a cage. The user can always work outside the guided process.

### 8.7 AI Chat — Universal Interface

The AI Chat panel is always available (toggleable right sidebar). It operates in several modes:

| Mode | Trigger | Skill Loaded | Context |
|------|---------|-------------|---------|
| **Phase Guided** | Entering a phase workflow | Phase-specific skill | Phase-relevant files |
| **Document Context** | Having a file open in editor | Inferred from file type | Open file + related files |
| **Free Chat** | Selecting "Brainstorm" or no file open | `brainstorm` | Minimal |
| **Inline Assist** | Selecting text + action | Action-specific skill | Scene context + selected text |

The user can explicitly choose a skill from a dropdown to override automatic selection.

---

## 9. Rust Backend Commands

### 9.1 Project Management

```rust
#[tauri::command]
fn create_project(name: String, is_series: bool, genre: Option<String>,
                  directory: PathBuf) -> Result<ProjectMetadata, AppError>

#[tauri::command]
fn open_project(directory: PathBuf) -> Result<ProjectMetadata, AppError>

#[tauri::command]
fn get_recent_projects() -> Result<Vec<RecentProject>, AppError>

#[tauri::command]
fn get_project_metadata(project_dir: PathBuf) -> Result<ProjectMetadata, AppError>

#[tauri::command]
fn update_project_metadata(project_dir: PathBuf,
                           metadata: ProjectMetadata) -> Result<(), AppError>
```

### 9.2 Book Management

```rust
#[tauri::command]
fn create_book(project_dir: PathBuf, title: String) -> Result<BookMetadata, AppError>

#[tauri::command]
fn get_book_metadata(project_dir: PathBuf, book_id: String) -> Result<BookMetadata, AppError>

#[tauri::command]
fn update_book_metadata(project_dir: PathBuf, book_id: String,
                        metadata: BookMetadata) -> Result<(), AppError>

#[tauri::command]
fn reorder_books(project_dir: PathBuf, book_ids: Vec<String>) -> Result<(), AppError>
```

### 9.3 File System

```rust
#[tauri::command]
fn read_file(path: PathBuf) -> Result<FileContent, AppError>
// FileContent { frontmatter: Value, body: String, path: PathBuf }

#[tauri::command]
fn write_file(path: PathBuf, frontmatter: Value, body: String) -> Result<(), AppError>

#[tauri::command]
fn create_from_template(path: PathBuf, template: String,
                        variables: HashMap<String, String>) -> Result<(), AppError>

#[tauri::command]
fn list_directory(path: PathBuf) -> Result<Vec<FileEntry>, AppError>
// FileEntry { name: String, path: PathBuf, is_dir: bool, file_type: Option<String> }

#[tauri::command]
fn create_directory(path: PathBuf) -> Result<(), AppError>

#[tauri::command]
fn rename_entry(from: PathBuf, to: PathBuf) -> Result<(), AppError>

#[tauri::command]
fn delete_entry(path: PathBuf) -> Result<(), AppError>
// Moves to OS recycle bin, does not permanently delete

#[tauri::command]
fn move_entry(from: PathBuf, to: PathBuf) -> Result<(), AppError>

#[tauri::command]
fn get_word_count(path: PathBuf) -> Result<u64, AppError>

#[tauri::command]
fn get_book_word_count(project_dir: PathBuf, book_id: String) -> Result<WordCountSummary, AppError>
```

### 9.4 Draft Management

```rust
#[tauri::command]
fn save_draft(path: PathBuf, content: String) -> Result<(), AppError>
// Auto-snapshots previous version to .drafts/ with timestamp filename

#[tauri::command]
fn list_drafts(scene_dir: PathBuf) -> Result<Vec<DraftSnapshot>, AppError>

#[tauri::command]
fn restore_draft(scene_dir: PathBuf, snapshot_name: String) -> Result<String, AppError>
```

### 9.5 Attachments

```rust
#[tauri::command]
fn add_attachment(target_dir: PathBuf, source_path: PathBuf) -> Result<String, AppError>
// Copies file into target_dir/attachments/

#[tauri::command]
fn list_attachments(target_dir: PathBuf) -> Result<Vec<AttachmentEntry>, AppError>

#[tauri::command]
fn remove_attachment(attachment_path: PathBuf) -> Result<(), AppError>
```

### 9.6 Chapter & Scene Management

```rust
#[tauri::command]
fn create_chapter(project_dir: PathBuf, book_id: String,
                  title: String) -> Result<ChapterMetadata, AppError>

#[tauri::command]
fn create_scene(project_dir: PathBuf, book_id: String, chapter_id: String,
                title: String, scene_type: SceneType) -> Result<SceneMetadata, AppError>

#[tauri::command]
fn reorder_chapters(project_dir: PathBuf, book_id: String,
                    chapter_ids: Vec<String>) -> Result<(), AppError>

#[tauri::command]
fn reorder_scenes(project_dir: PathBuf, book_id: String, chapter_id: String,
                  scene_ids: Vec<String>) -> Result<(), AppError>

#[tauri::command]
fn move_scene(project_dir: PathBuf, book_id: String, scene_id: String,
              from_chapter: String, to_chapter: String,
              position: usize) -> Result<(), AppError>
```

### 9.7 Front Matter & Back Matter

```rust
#[tauri::command]
fn create_front_matter(project_dir: PathBuf, book_id: String,
                       subtype: String) -> Result<PathBuf, AppError>
// Creates the appropriate .md file in front-matter/ with template

#[tauri::command]
fn create_back_matter(project_dir: PathBuf, book_id: String,
                      subtype: String) -> Result<PathBuf, AppError>

#[tauri::command]
fn remove_front_matter(project_dir: PathBuf, book_id: String,
                       subtype: String) -> Result<(), AppError>

#[tauri::command]
fn remove_back_matter(project_dir: PathBuf, book_id: String,
                      subtype: String) -> Result<(), AppError>

#[tauri::command]
fn list_front_matter(project_dir: PathBuf, book_id: String) -> Result<Vec<MatterEntry>, AppError>

#[tauri::command]
fn list_back_matter(project_dir: PathBuf, book_id: String) -> Result<Vec<MatterEntry>, AppError>
```

### 9.8 Agent / Claude API

```rust
// Generate an execution plan (recommend-before-execute flow)
#[tauri::command]
fn agent_plan(project_dir: PathBuf, intent: String, scope: ContextScope,
              message: String) -> Result<AgentPlan, AppError>

// Execute an approved plan (streaming)
// Emits events: "claude:chunk", "claude:done", "claude:error"
#[tauri::command]
fn agent_execute(plan_id: String,
                 conversation_history: Vec<Message>) -> Result<String, AppError>

// Quick execution for inline actions (bypasses plan approval)
// Emits events: "claude:chunk", "claude:done", "claude:error"
#[tauri::command]
fn agent_quick(project_dir: PathBuf, skill: String, scope: ContextScope,
               selected_text: Option<String>, action: String,
               message: String) -> Result<String, AppError>

// Cancel an in-progress request
#[tauri::command]
fn agent_cancel(conversation_id: String) -> Result<(), AppError>

// Estimate token count for a hypothetical context assembly
#[tauri::command]
fn estimate_context_tokens(project_dir: PathBuf, skill: String,
                           scope: ContextScope) -> Result<TokenEstimate, AppError>
```

### 9.9 Configuration

```rust
#[tauri::command]
fn get_config() -> Result<AppConfig, AppError>

#[tauri::command]
fn update_config(config: AppConfig) -> Result<(), AppError>

#[tauri::command]
fn set_api_key(key: String) -> Result<(), AppError>
// Encrypts and stores in config

#[tauri::command]
fn validate_api_key() -> Result<bool, AppError>
// Makes a minimal test request to Anthropic API
```

### 9.10 Export

```rust
#[tauri::command]
fn export_book(project_dir: PathBuf, book_id: String, format: ExportFormat,
               options: ExportOptions, output_path: PathBuf) -> Result<PathBuf, AppError>

// ExportFormat: PDF, DOCX, EPUB, Markdown, LaTeX
// ExportOptions: {
//   include_front_matter: bool,
//   include_back_matter: bool,
//   include_chapter_headings: bool,
//   page_size: "letter" | "a4",
// }
```

### 9.11 File Watcher Events

```rust
// Events emitted to frontend when files change externally:
"fs:file_changed"   -> { path: String, change_type: "modified" | "created" | "deleted" }
"fs:file_created"   -> { path: String }
"fs:file_deleted"   -> { path: String }
"fs:dir_changed"    -> { path: String }
```

---

## 10. UI Layout & Theme System

### 10.1 Theme System

The theme system uses CSS custom properties with `data-theme` attributes for switching.

#### 10.1.1 Available Themes

| Theme | Description | Primary BG | Text | Accent |
|-------|-------------|-----------|------|--------|
| **Light Professional** | Clean light theme | `#ffffff` | `#212529` | `#228be6` |
| **Dark Professional** | Dark, modern | `#151515` | `#e9ecef` | `#4dabf7` |
| **High Contrast** | Accessibility-focused | `#000000` | `#ffffff` | `#00afff` |
| **Sepia** | Warm, paper-like | `#f4ecd8` | `#5c4b37` | `#8b7355` |
| **Night Mode** | Blue-tinted dark (Tokyo Night) | `#1a1b26` | `#c0caf5` | `#7aa2f7` |

#### 10.1.2 Typography

- **UI font**: Inter — clean sans-serif for all interface elements (menus, panels, buttons, labels, chat messages)
- **Editor font**: Lora — serif font for the TipTap prose editor, optimized for long-form reading comfort

Both fonts are self-hosted from `public/fonts/`. No external font loading.

```css
:root {
  --font-ui: 'Inter', system-ui, -apple-system, sans-serif;
  --font-editor: 'Lora', 'Georgia', serif;
}
```

The UI font is applied globally. The editor font is applied only within the TipTap editor component.

#### 10.1.3 Semantic Color Tokens

Consistent across all themes:

| Color | Usage |
|-------|-------|
| **Info (Blue)** | AI chat messages, informational UI elements |
| **Success (Green)** | Phase completion, saves, positive confirmations |
| **Warning (Yellow)** | Consistency warnings, review suggestions |
| **Error (Red)** | API errors, critical issues |
| **Magenta** | Phase indicators, Sapling-specific accents |
| **Purple** | Character-related UI elements |
| **Grey** | Neutral actions, secondary buttons |

#### 10.1.4 Theme Implementation

Themes applied via `data-theme` attribute on root element. CSS custom properties cascade to all children. Smooth 0.3s transition on background and text colors when switching.

```css
:root { /* Light Professional defaults */ }
[data-theme="darkPro"] { /* Dark overrides */ }
[data-theme="highContrast"] { /* High Contrast overrides */ }
[data-theme="sepia"] { /* Sepia overrides */ }
[data-theme="nightMode"] { /* Night Mode overrides */ }
```

State managed via Zustand store, persisted in config.json.

All CSS variable definitions should be ported from the existing codebase in the GitHub repository (https://github.com/Delta-Zero-Games/saipling), specifically from `renderer/src/themes/base/variables.css`. The color values, shadows, border radii, and spacing tokens defined there should be used as-is, with the only change being the removal of dyslexic font references and the replacement of the font system with Inter + Lora.

### 10.2 Application Layout

```
┌───────────────────────────────────────────────────────────────┐
│  Title Bar (Tauri custom title bar, draggable)                 │
│  [sAIpling icon]  Project Name — Book 1        [─  □  ✕]     │
├───────┬───────────────────────────────────────┬───────────────┤
│       │                                       │               │
│ Left  │        Main Content Area              │  Right Panel  │
│ Side  │                                       │  (AI Chat /   │
│ bar   │  ┌─────────────────────────────────┐  │   Agent)      │
│       │  │                                 │  │               │
│ [📊]  │  │                                 │  │ ┌───────────┐│
│ Dash  │  │                                 │  │ │Skill: Auto││
│       │  │   Editor / Phase Workflow       │  │ │[dropdown]  ││
│ [📁]  │  │                                 │  │ ├───────────┤│
│ Files │  │   (context-dependent)           │  │ │Context:    ││
│       │  │                                 │  │ │ 3 files    ││
│ [📖]  │  │                                 │  │ │ ~8.5k tok  ││
│ Book  │  │                                 │  │ ├───────────┤│
│       │  │                                 │  │ │            ││
│ [🌍]  │  │                                 │  │ │  Chat      ││
│ World │  │                                 │  │ │  Messages  ││
│       │  │                                 │  │ │            ││
│ [👥]  │  │                                 │  │ │            ││
│ Chars │  │                                 │  │ ├───────────┤│
│       │  │                                 │  │ │[Message.. ]││
│ [📝]  │  │                                 │  │ │  [Send ➤] ││
│ Notes │  └─────────────────────────────────┘  │ └───────────┘│
│       │                                       │               │
│ [⚙️]  │                                       │               │
│ Sett. │                                       │               │
├───────┴───────────────────────────────────────┴───────────────┤
│  Phase Progress Bar                                            │
│  [SEED ✓]──[ROOT ✓]──[SPROUT ◐]──[FLOURISH ○]──[BLOOM ○]    │
├───────────────────────────────────────────────────────────────┤
│  Footer                                                        │
│  v0.1.0 │ Book 1 │ Ch.2 Sc.1 │ 12,450/80,000w │ ~$0.03 est │
└───────────────────────────────────────────────────────────────┘
```

### 10.3 Panel Descriptions

#### 10.3.1 Left Sidebar (Navigation — Always Visible)

A narrow icon rail (collapsed) or wider panel (expanded, toggleable) for primary navigation.

| Icon | View | Description |
|------|------|-------------|
| 📊 Dashboard | Project overview with status cards, book cards, quick actions |
| 📁 Files | Full project file tree (like VS Code explorer) |
| 📖 Book | Book-level view: front matter, chapters, scenes, back matter, word counts |
| 🌍 World | World-building browser: bible, locations, factions, etc. |
| 👥 Characters | Character list, relationship map, journey tracking |
| 📝 Notes | Free-form notes browser |
| ⚙️ Settings | Theme, font, API key, model preferences, AI approval mode |

Clicking a sidebar icon switches the Main Content Area. Within each view, clicking items opens them in the editor.

#### 10.3.2 Main Content Area (Center — Dynamic)

The largest panel, displaying context-dependent content:

- **Dashboard view**: Project info, phase progress, book cards, quick actions
- **Phase Workflow view**: Guided phase UI (Seed Phase cards, Root Phase beat list, etc.)
- **Editor view**: TipTap editor for editing any .md file
- **Relationship Map view**: Visual graph of character connections
- **File browser view**: Project explorer with directory tree

#### 10.3.3 AI Chat / Agent Panel (Right — Toggleable)

Collapsible right panel for AI interaction.

**Components from top to bottom:**
1. **Skill selector**: Dropdown showing active skill with option to change
2. **Context summary**: Shows which files the AI can "see" (expandable list with full/summary indicators), estimated token count
3. **Chat thread**: Scrollable message history (user + Claude)
   - Claude's messages can contain **saipling-apply blocks** rendered as actionable cards with [Apply] [Edit First] [Discard] buttons
   - Agent plan previews are shown inline with [Approve] [Edit Plan] [Cancel] buttons
4. **Model indicator**: Small badge showing which model is active (Haiku/Sonnet/Opus), clickable to override
5. **Input area**: Multi-line text input with Send button

The chat panel remembers conversation history per session. Starting a new skill or switching context starts a new conversation (with an option to continue).

#### 10.3.4 Phase Progress Bar (Bottom — Always Visible)

Horizontal bar showing the five Sapling phases as connected nodes:
- Each phase: ○ (not started), ◐ (in progress), ✓ (complete)
- Connected by lines showing progression
- Clicking a phase node jumps to that phase's workflow
- Hover tooltip shows phase details (e.g., "Sprout: 5/8 protagonist stages")
- Shows current book context (if viewing a book)

#### 10.3.5 Footer (Bottom — Always Visible)

Slim bar showing:
- App version
- Current context (book, chapter, scene)
- Word count (current document / book total / book target)
- Estimated cost of last AI interaction
- Save status indicator (saved / unsaved / saving)

### 10.4 View-Specific Layouts

#### Dashboard View

```
┌─────────────────────────────────────────────┐
│  Project: The Cole Files                     │
│  Genre: noir / science fiction               │
├──────────────────────┬──────────────────────┤
│  Series Status       │  Quick Actions        │
│  • World Bible ✓     │  [Continue Writing]   │
│  • 3 Characters      │  [Start Next Phase]   │
│  • Series Arc ◐      │  [New Book]           │
├──────────────────────┴──────────────────────┤
│  Books                                       │
│  ┌───────────────┐ ┌───────────────┐        │
│  │ Book 1        │ │ Book 2        │ [+]    │
│  │ The Broken    │ │ The Glass     │        │
│  │ Mirror        │ │ Ceiling       │        │
│  │ 12,450 words  │ │ 0 words       │        │
│  │ ✓✓◐○○         │ │ ○○○○○         │        │
│  │ Last: 2h ago  │ │ Not started   │        │
│  └───────────────┘ └───────────────┘        │
└─────────────────────────────────────────────┘
```

#### Seed Phase Workflow View

```
┌─────────────────────────────────────────────┐
│  Seed Phase — Story Foundation               │
├──────────────┬──────────────────────────────┤
│  Elements    │   AI Conversation             │
│              │                               │
│  [✓] Premise │  Claude: "Tell me about the  │
│  [✓] Theme   │  story you want to tell..."  │
│  [◐] Protag  │                               │
│  [ ] Conflict│  User: "a noir detective     │
│  [ ] World   │  story set in the future"    │
│  [ ] Promise │                               │
│              │  Claude: "Great. Here are     │
│──────────────│  three premise options:       │
│  Preview     │                               │
│  (renders    │  [saipling-apply card 1]     │
│  current     │  [saipling-apply card 2]     │
│  story-      │  [saipling-apply card 3]     │
│  foundation  │                               │
│  .md)        │  Which resonates most?"       │
│              │                               │
│              │  [Message input...]    [Send] │
└──────────────┴──────────────────────────────┘
```

#### Bloom Phase Writing View

```
┌─────────────────────────────────────────────┐
│  Chapter 1 > Scene 1: 3 AM Phone Call        │
├──────┬──────────────────────────┬───────────┤
│ Scn  │  TipTap Editor           │ AI Chat   │
│ Nav  │  (Lora font)             │ (prose_   │
│      │                          │  writer)  │
│ 1.1● │  The phone rang at       │           │
│ 1.2○ │  three in the morning.   │ "How do   │
│ 2.1○ │                          │ you want  │
│ 2.2○ │  Marcus did not move.    │ the next  │
│      │  The blue glow of the    │ paragraph │
│      │  surveillance feeds      │ to feel?" │
│      │  painted the ceiling...  │           │
│      │                          │ [Draft    │
│      │  [cursor]                │  entire   │
│      │                          │  scene]   │
│      │                          │           │
│      │  Status: 2,100 words     │           │
└──────┴──────────────────────────┴───────────┘
```

#### Book View (in sidebar, showing front/back matter)

```
┌──────────────────────┐
│ Book 1: The Broken   │
│ Mirror               │
├──────────────────────┤
│ ▸ Front Matter       │
│   ├ Title Page       │
│   ├ Dedication       │
│   └ Prologue         │
│ ▸ Chapters           │
│   ├ Ch 1: The Call   │
│   │  ├ Scene 1 ●     │
│   │  └ Scene 2 ○     │
│   └ Ch 2: Crime Scene│
│      └ Scene 1 ●     │
│ ▸ Back Matter        │
│   ├ Epilogue         │
│   └ Glossary         │
├──────────────────────┤
│ [+ Add Chapter]      │
│ [+ Front Matter]     │
│ [+ Back Matter]      │
└──────────────────────┘
```

---

## 11. Editor (TipTap)

### 11.1 Overview

The prose editor uses TipTap (built on ProseMirror). TipTap is the editor framework — there is no fallback or simpler alternative. Implement TipTap fully.

### 11.2 Configuration

The TipTap editor should be configured with:

- **Markdown serialization/deserialization**: Content is stored as markdown (.md files). TipTap loads markdown and serializes back to markdown on save.
- **Font**: Lora (serif) via `--font-editor` CSS variable. The editor's content area uses this font while the editor's toolbar/chrome uses Inter.
- **Extensions to include**:
  - StarterKit (basic formatting: bold, italic, headings, lists, blockquotes, code)
  - Placeholder ("Start writing...")
  - CharacterCount (word count display)
  - Typography (smart quotes, em dashes)
  - Highlight (for AI suggestion highlighting)
  - History (undo/redo)

### 11.3 YAML Frontmatter Handling

When a .md file is loaded, the YAML frontmatter is parsed separately by the Rust backend (via the `read_file` command). The editor receives only the body content. Frontmatter is displayed as a collapsible, read-only metadata panel above the editor (not inside the editable area). If the user needs to edit frontmatter, they can expand the panel and edit fields in a structured form (not raw YAML).

### 11.4 Inline AI Actions

When the user selects text in the editor, a floating toolbar appears with these actions:

| Action | Skill Used | Behavior |
|--------|-----------|----------|
| **Rewrite** | prose_editor | Offers 2-3 rewrite options. User picks one or cancels. |
| **Expand** | describe | Adds sensory detail to the selected passage. |
| **Compress** | prose_editor | Returns tightened version of selected text. |
| **Continue** | prose_writer | Drafts next paragraph from end of selection. |
| **Describe** | describe | Provides multi-sense detail options for a setting/moment. |
| **Dialogue** | dialogue_crafter | Rewrites dialogue for selected characters. |
| **Consistency** | consistency_checker | Checks selected passage against project facts. |
| **Synonym** | prose_editor (Haiku) | Suggests contextual word alternatives for a single selected word. |

These inline actions use the `agent_quick` command (bypassing plan approval by default, per the "smart" approval mode setting). Results appear inline below the selected text with accept/reject buttons.

### 11.5 Auto-Save

The editor auto-saves at the interval configured in settings (default: 30 seconds). Each save:
1. Serializes TipTap content back to markdown
2. Calls `save_draft` which writes to `draft.md` and snapshots the previous version to `.drafts/`
3. Updates word count in `book.json`
4. Footer shows save status indicator

### 11.6 Focus Mode

A toggle (keyboard shortcut: F11 or Ctrl+Shift+F) hides the sidebar, AI panel, progress bar, and footer — leaving only the TipTap editor in a centered, comfortable reading width. The user can still access inline AI actions via text selection. Press the shortcut again to exit focus mode.

---

## 12. Export System

### 12.1 Supported Formats

| Format | Method | Use Case |
|--------|--------|----------|
| **Combined Markdown** | Concatenate all content in order | Plain text sharing |
| **PDF** | Pandoc (markdown → PDF via LaTeX) | Print-ready manuscript |
| **DOCX** | Pandoc (markdown → docx) | Submission to agents/editors |
| **ePub** | Pandoc (markdown → epub) | E-reader format |
| **LaTeX** | Pandoc (markdown → tex) | Full typesetting control |

### 12.2 Export Process

```
1. User selects a book → clicks "Export" from Book view or menu
2. Chooses format and options:
   - Include front matter (and which sections)
   - Include back matter (and which sections)
   - Include chapter headings
   - Which draft version (current or specific snapshot)
   - Page size (US Letter, A4) for PDF
3. Rust backend:
   a. Reads front matter files in order (title page, copyright, dedication,
      epigraph, acknowledgments, foreword, preface, prologue)
   b. Reads all chapter scene draft.md files in chapter/scene order
   c. Reads back matter files in order (epilogue, afterword, appendices,
      acknowledgments, about the author)
   d. Concatenates with appropriate page breaks
   e. Applies formatting template
   f. Calls Pandoc for conversion
4. Output saved to exports/ directory
5. App opens the file or its containing folder
```

### 12.3 Pandoc Dependency

The app checks for Pandoc on the user's PATH at startup. If not found, the export menu shows a message with installation instructions and a link. Pandoc is not bundled — the user installs it separately.

---

## 13. Technical Stack

### 13.1 Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.x | UI framework |
| Vite | 6.x | Build tool |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 3.x | Utility styling |
| @tailwindcss/typography | Latest | Prose styling in editor |
| Zustand | 4.x | State management |
| Lucide React | Latest | Icons |
| TipTap | 2.x | Rich text / prose editor |
| react-markdown | Latest | Markdown rendering (for previews and chat) |
| remark-gfm | Latest | GitHub-flavored markdown support |
| remark-frontmatter | Latest | Frontmatter parsing |

### 13.2 Tauri / Rust Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| Tauri | 2.x | Desktop app framework |
| Rust | 1.7x+ | Backend language |
| reqwest | Latest | HTTP client (Anthropic API, streaming) |
| serde / serde_json | Latest | JSON serialization |
| serde_yaml | Latest | YAML frontmatter parsing |
| tokio | Latest | Async runtime |
| notify | 6.x | File system watching |
| futures-util | Latest | Stream utilities for API streaming |
| tauri-plugin-store | 2.x | Encrypted local config storage |
| tauri-plugin-dialog | 2.x | Native file/folder dialogs |
| tauri-plugin-fs | 2.x | File system access |
| uuid | Latest | Unique ID generation |
| chrono | Latest | Timestamps |
| toml | Latest | Skill definition parsing |
| tiktoken-rs | Latest | Token count estimation |

### 13.3 External Dependencies

| Tool | Purpose | Notes |
|------|---------|-------|
| Pandoc | Document export | User installs separately. App detects on PATH. |
| WebView2 | Rendering engine | Ships with Windows 10/11 |

### 13.4 Fonts

| Font | Usage | Source |
|------|-------|--------|
| Inter | App UI (all interface elements) | Self-hosted from public/fonts/ |
| Lora | TipTap prose editor | Self-hosted from public/fonts/ |

### 13.5 Application Source Structure

```
saipling-rust-app/
├── src/                              # React frontend
│   ├── assets/
│   │   └── logo.png                  # App logo for in-app use
│   ├── components/
│   │   ├── AIChat/                   # AI chat panel components
│   │   │   ├── ChatPanel.tsx         # Main chat panel container
│   │   │   ├── ChatMessage.tsx       # Individual message rendering
│   │   │   ├── AgentPlanCard.tsx     # Plan approval UI
│   │   │   ├── ApplyCard.tsx         # saipling-apply action cards
│   │   │   ├── SkillSelector.tsx     # Skill dropdown
│   │   │   ├── ContextSummary.tsx    # Shows loaded files / token count
│   │   │   └── ChatInput.tsx         # Message input with send button
│   │   ├── Dashboard/
│   │   │   ├── Dashboard.tsx         # Main dashboard view
│   │   │   ├── BookCard.tsx          # Individual book card
│   │   │   └── QuickActions.tsx      # Quick action buttons
│   │   ├── Editor/
│   │   │   ├── TipTapEditor.tsx      # TipTap editor wrapper
│   │   │   ├── EditorToolbar.tsx     # Formatting toolbar
│   │   │   ├── InlineAIToolbar.tsx   # Floating AI action toolbar
│   │   │   ├── FrontmatterPanel.tsx  # Collapsible metadata display
│   │   │   └── FocusMode.tsx         # Focus mode wrapper
│   │   ├── Layout/
│   │   │   ├── AppShell.tsx          # Top-level layout
│   │   │   ├── TitleBar.tsx          # Custom Tauri title bar
│   │   │   └── PanelLayout.tsx       # Resizable panel container
│   │   ├── PhaseWorkflow/
│   │   │   ├── SeedPhase.tsx
│   │   │   ├── RootPhase.tsx
│   │   │   ├── SproutPhase.tsx
│   │   │   ├── FlourishPhase.tsx
│   │   │   └── BloomPhase.tsx
│   │   ├── ProjectExplorer/
│   │   │   ├── FileTree.tsx          # Recursive file/folder tree
│   │   │   └── FileTreeItem.tsx      # Individual tree node
│   │   ├── BookView/
│   │   │   ├── BookView.tsx          # Book-level navigation
│   │   │   ├── ChapterList.tsx       # Chapter/scene tree
│   │   │   ├── FrontMatterList.tsx   # Front matter section list
│   │   │   └── BackMatterList.tsx    # Back matter section list
│   │   ├── WorldView/
│   │   │   └── WorldBrowser.tsx      # World-building file browser
│   │   ├── CharacterView/
│   │   │   ├── CharacterList.tsx     # Character cards
│   │   │   └── RelationshipMap.tsx   # Visual relationship graph
│   │   ├── NotesView/
│   │   │   └── NotesBrowser.tsx      # Notes file browser
│   │   ├── ProgressBar/
│   │   │   └── PhaseProgressBar.tsx  # Bottom phase indicator
│   │   ├── Footer/
│   │   │   └── Footer.tsx            # Status footer
│   │   ├── Settings/
│   │   │   ├── SettingsView.tsx      # Settings page
│   │   │   ├── ThemeSettings.tsx     # Theme selection
│   │   │   ├── AISettings.tsx        # Model prefs, approval mode
│   │   │   └── EditorSettings.tsx    # Auto-save, word count, etc.
│   │   └── Sidebar/
│   │       └── Sidebar.tsx           # Left navigation rail
│   ├── hooks/
│   │   ├── useProject.ts             # Project state and operations
│   │   ├── useClaude.ts              # AI interaction hook (plan, execute, quick)
│   │   ├── useFileSystem.ts          # File operations hook
│   │   ├── useTheme.ts               # Theme management hook
│   │   └── useFileWatcher.ts         # Listens for fs:* events
│   ├── stores/
│   │   ├── projectStore.ts           # Active project state
│   │   ├── editorStore.ts            # Editor state (open file, unsaved changes)
│   │   ├── aiStore.ts                # AI chat state, conversation history, plans
│   │   └── themeStore.ts             # Theme preferences
│   ├── styles/
│   │   ├── globals.css               # Global styles, Tailwind imports
│   │   ├── fonts.css                 # @font-face declarations for Inter + Lora
│   │   └── themes/
│   │       └── variables.css         # Theme CSS custom properties (all 5 themes)
│   ├── types/
│   │   ├── project.ts                # Project, Book, Chapter, Scene types
│   │   ├── sapling.ts                # Phase, Beat, Journey, SceneType types
│   │   ├── ai.ts                     # Skill, Message, AgentPlan, ApplyBlock types
│   │   └── theme.ts                  # Theme types
│   ├── utils/
│   │   ├── tauri.ts                  # Typed Tauri invoke wrappers
│   │   ├── markdown.ts               # Markdown parsing utilities
│   │   └── applyParser.ts            # Parses saipling-apply blocks from AI responses
│   ├── App.tsx                        # Root component
│   └── main.tsx                       # Entry point
│
├── src-tauri/                         # Rust backend
│   ├── src/
│   │   ├── main.rs                    # Tauri entry point, registers all commands
│   │   ├── commands/
│   │   │   ├── mod.rs                 # Command module exports
│   │   │   ├── project.rs             # create_project, open_project, etc.
│   │   │   ├── book.rs                # create_book, get_book_metadata, etc.
│   │   │   ├── filesystem.rs          # read_file, write_file, list_directory, etc.
│   │   │   ├── draft.rs               # save_draft, list_drafts, restore_draft
│   │   │   ├── attachment.rs          # add_attachment, list_attachments, etc.
│   │   │   ├── chapter.rs             # create_chapter, create_scene, reorder, etc.
│   │   │   ├── matter.rs              # create/remove/list front and back matter
│   │   │   ├── agent.rs               # agent_plan, agent_execute, agent_quick, agent_cancel
│   │   │   ├── config.rs              # get_config, update_config, set_api_key, validate
│   │   │   └── export.rs              # export_book
│   │   ├── context/
│   │   │   ├── mod.rs
│   │   │   ├── assembler.rs           # Context assembly logic
│   │   │   ├── skills.rs              # Skill TOML loading and parsing
│   │   │   ├── summarizer.rs          # File summarization via Haiku
│   │   │   └── tokens.rs              # Token estimation via tiktoken-rs
│   │   ├── agent/
│   │   │   ├── mod.rs
│   │   │   ├── orchestrator.rs        # Agent planning and execution
│   │   │   ├── planner.rs             # Intent analysis, plan generation
│   │   │   └── cache.rs               # Summary cache
│   │   ├── watcher.rs                 # File system watcher
│   │   └── error.rs                   # AppError type
│   ├── skills/                        # Built-in skill TOML files
│   │   ├── brainstorm.toml
│   │   ├── seed_developer.toml
│   │   ├── structure_analyst.toml
│   │   ├── character_developer.toml
│   │   ├── relationship_mapper.toml
│   │   ├── world_builder.toml
│   │   ├── scene_architect.toml
│   │   ├── prose_writer.toml
│   │   ├── prose_editor.toml
│   │   ├── describe.toml
│   │   ├── dialogue_crafter.toml
│   │   ├── consistency_checker.toml
│   │   ├── researcher.toml
│   │   ├── series_arc_planner.toml
│   │   ├── genre_specialist.toml
│   │   └── front_back_matter_writer.toml
│   ├── Cargo.toml
│   └── tauri.conf.json
│
├── public/
│   └── fonts/
│       ├── Inter-VariableFont.woff2   # (or individual weight files)
│       └── Lora-VariableFont.woff2    # (or individual weight files + italics)
│
├── index.html
├── package.json
├── pnpm-lock.yaml
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── README.md
```

---

## Appendix A: Sapling Phase Quick Reference

| Phase | Core Question | Deliverable | Key Skill(s) |
|-------|--------------|-------------|--------------|
| **Seed** | "What is this story about?" | Story Foundation (6 core elements) | seed_developer, brainstorm |
| **Root** | "What happens in this story?" | 21-Beat Story Outline | structure_analyst |
| **Sprout** | "Who changes, and how?" | Character Journeys + Relationships | character_developer, relationship_mapper |
| **Flourish** | "What does each scene do?" | Scene Outlines (Action/Reaction) | scene_architect, consistency_checker |
| **Bloom** | "How does this read?" | Draft Manuscript | prose_writer, prose_editor, describe, dialogue_crafter |

## Appendix B: 21-Beat Reference

| # | Beat | Act | Purpose |
|---|------|-----|---------|
| 1 | Opening Image | I | First impression of protagonist and world |
| 2 | Daily Life | I | Protagonist's routine existence |
| 3 | Inciting Incident | I | Event that disrupts the status quo |
| 4 | Reluctance Moment | I | Protagonist resists the call to change |
| 5 | Point of Departure | I | Commitment to the journey |
| 6 | First Challenge | I | Initial test of abilities |
| 7 | End of Known World | I | Final break from familiar territory |
| 8 | New Reality | II | Adjustment to changed circumstances |
| 9 | Initial Progress | II | First successes in the new world |
| 10 | Strengthening Allies | II | Building relationships and support |
| 11 | Midpoint Shift | II | Major revelation or change in direction |
| 12 | Growing Opposition | II | Escalating conflicts and challenges |
| 13 | Moment of Doubt | II | Crisis of confidence |
| 14 | Renewed Determination | II | Recommitment to the goal |
| 15 | Ultimate Challenge | II | Approach to the final test |
| 16 | Darkest Moment | III | All seems lost |
| 17 | Final Decision | III | Ultimate choice defining protagonist |
| 18 | Climactic Confrontation | III | Direct face-off with central conflict |
| 19 | Resolution | III | Outcome of the confrontation |
| 20 | Transformed Reality | III | New status quo after the journey |
| 21 | Closing Image | III | Final impression showing change |

## Appendix C: 8-Point Character Journey Reference

| # | Stage | Typical Beat Alignment |
|---|-------|----------------------|
| 1 | Comfort Zone | Beats 1-2 (Opening Image, Daily Life) |
| 2 | Desire Emerges | Beat 3 (Inciting Incident) |
| 3 | Crossing Threshold | Beats 5-7 (Point of Departure → End of Known World) |
| 4 | Adaptation | Beats 8-9 (New Reality, Initial Progress) |
| 5 | Trials and Allies | Beats 10-11 (Strengthening Allies, Midpoint Shift) |
| 6 | Supreme Ordeal | Beats 16-18 (Darkest Moment → Climactic Confrontation) |
| 7 | Transformation | Beat 17 (Final Decision) |
| 8 | Return with Gifts | Beats 20-21 (Transformed Reality, Closing Image) |

## Appendix D: Action/Reaction Scene Pattern

**Action Scene:**

| Component | Purpose |
|-----------|---------|
| Character Goal | What the character wants to achieve in this scene |
| Mounting Conflict | Obstacles that arise and escalate |
| Outcome Crisis | Setback or complication that changes direction |

**Reaction Scene:**

| Component | Purpose |
|-----------|---------|
| Emotional Response | Character's honest feelings about what just happened |
| Consideration of Options | Weighing possible next steps |
| New Direction | Decision that leads to the next goal |

## Appendix E: Four-Beat Paragraph Pattern

| Beat | Purpose |
|------|---------|
| External Stimulus | Something happens in the story world |
| Internal Response | Viewpoint character's thoughts/feelings/reactions |
| Visible Action | What the character physically does in response |
| Consequential Result | Immediate outcome (often becomes next paragraph's stimulus) |

## Appendix F: Front Matter / Back Matter Types

**Front Matter** (in conventional order):

| Type | File | Description |
|------|------|-------------|
| Title Page | title-page.md | Title, subtitle, author, publisher |
| Copyright | copyright.md | Copyright notice, ISBN, legal text |
| Dedication | dedication.md | Short dedication |
| Epigraph | epigraph.md | Opening quote or excerpt |
| Acknowledgments | acknowledgments.md | Thanks (can also be back matter) |
| Foreword | foreword.md | Written by someone other than the author |
| Preface | preface.md | Author's introduction to the work |
| Prologue | prologue.md | Narrative opening before Chapter 1 |

**Back Matter** (in conventional order):

| Type | File | Description |
|------|------|-------------|
| Epilogue | epilogue.md | Narrative closing after the final chapter |
| Afterword | afterword.md | Author's reflections on the work |
| Appendices | appendices/*.md | Supplementary material (glossaries, maps, etc.) |
| Acknowledgments | acknowledgments.md | Thanks (if placed in back matter) |
| About the Author | about-the-author.md | Author bio |
