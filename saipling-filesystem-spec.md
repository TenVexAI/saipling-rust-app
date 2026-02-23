# sAIpling File System & Document Specification

**Version**: 2.0  
**Date**: February 23, 2026  
**Status**: Draft — Pending Developer Review

---

## 1. Design Principles

### 1.1 The Brainstorm → Chat → Generate Pattern

Every significant document in sAIpling follows the same creation workflow:

1. **Brainstorm** — A `brainstorm.md` file is created. The user brain-dumps ideas freely.
2. **Chat** — The user discusses the brainstorm with Claude in the AI Chat panel. Claude uses the brainstorm notes (and relevant context files) to understand the user's vision.
3. **Generate** — When ready, the user clicks **Generate**. The appropriate AI skill produces a polished draft document from the brainstorm notes and conversation.
4. **Iterate** — The user can regenerate, edit, or refine the output at any time. Generated documents are living artifacts, not final products.

This pattern applies at every level: project overview, book overview, character profiles, world entries, phase elements, and phase deliverables.

### 1.2 Folder-as-Context

Files are organized into meaningful folders. A file named `brainstorm.md` inside `phase-1-seed/premise/` is unambiguous — the folder path provides the context. This keeps filenames short and consistent while making the project navigable both in the app and in a file explorer.

### 1.3 Frontmatter as Structured Data

Every `.md` file uses YAML frontmatter for machine-readable metadata. The app and AI read this frontmatter to understand what each file is, where it belongs, and how it connects to other files. The body of the file is human-readable markdown.

### 1.4 Brainstorm Files Are Ephemeral Context

Brainstorm files (`brainstorm.md`) are working documents. They are included in AI context during the generation step that produces their corresponding draft, but are **not** included in later phases by default. The generated draft is the canonical artifact. Users can override this via context settings if they want a brainstorm file to persist as context.

---

## 2. Universal Frontmatter Schema

Every `.md` file in the project includes these base fields:

```yaml
---
type: [string]             # File type identifier (see Section 5 for all types)
scope: [string]            # "series" for project-wide files, "book-XX" for book-specific
created: [date]            # ISO date: 2026-02-23
modified: [date]           # ISO date, updated on save
status: [string]           # Lifecycle state (see below)
---
```

### 2.1 Status Values by Category

| Category | Values | Used By |
|----------|--------|---------|
| **Brainstorm files** | `empty` · `in_progress` · `ready` | All brainstorm.md files |
| **Generated drafts** | `not_started` · `generated` · `revised` · `approved` | Element drafts, character profiles, world entries |
| **Phase deliverables** | `not_started` · `generated` · `revised` · `complete` | Logline, story foundation, structure outline, etc. |
| **Scene drafts (prose)** | `not_started` · `drafting` · `first_draft` · `revised` · `polished` | Phase 5 scene drafts |

- `empty` — File created but no content written yet
- `in_progress` — User has started writing content
- `ready` — User considers this brainstorm complete enough to generate from
- `not_started` — Generation has not been attempted
- `generated` — AI has produced initial content
- `revised` — User has manually edited the generated content
- `approved` — User has marked this as final (for element drafts)
- `complete` — Phase deliverable is considered done
- `drafting` — Prose is being actively written
- `first_draft` — First complete pass of the scene
- `polished` — Scene has been through revision and is considered publication-ready

---

## 3. Directory Structure

```
project-name/
│
├── project.json                              # Project metadata, book list, settings
│
├── overview/                                 # Project-level brainstorm & overview
│   ├── brainstorm.md                         #   Brain dump for the whole project
│   └── overview.md                           #   Generated project overview
│
├── characters/                               # Series-wide character definitions
│   ├── [character-slug]/                     #   e.g. marcus-cole/
│   │   ├── brainstorm.md                     #     Character brainstorm notes
│   │   └── profile.md                        #     Generated character profile sheet
│   └── .../
│
├── world/                                    # Series-wide world bible
│   ├── locations/                            #   Default section (always present)
│   │   ├── [entry-slug]/                     #     e.g. neo-detroit/
│   │   │   ├── brainstorm.md                 #       Entry brainstorm notes
│   │   │   └── entry.md                      #       Generated world entry
│   │   └── .../
│   ├── items/                                #   Default section (always present)
│   │   └── [entry-slug]/
│   │       ├── brainstorm.md
│   │       └── entry.md
│   └── [section-slug]/                       #   User-added sections (see 3.1)
│       └── [entry-slug]/
│           ├── brainstorm.md
│           └── entry.md
│
├── notes/                                    # Series-level freeform notes
│   └── *.md
│
├── books/
│   ├── book-01/
│   │   ├── book.json                         #   Book metadata & phase progress
│   │   │
│   │   ├── overview/                         #   Book-level brainstorm & overview
│   │   │   ├── brainstorm.md                 #     Book brainstorm notes
│   │   │   └── overview.md                   #     Generated book overview
│   │   │
│   │   ├── phase-1-seed/                     #   Phase 1: Seed
│   │   │   ├── premise/
│   │   │   │   ├── brainstorm.md
│   │   │   │   └── draft.md
│   │   │   ├── theme/
│   │   │   │   ├── brainstorm.md
│   │   │   │   └── draft.md
│   │   │   ├── protagonist/
│   │   │   │   ├── brainstorm.md
│   │   │   │   └── draft.md
│   │   │   ├── central-conflict/
│   │   │   │   ├── brainstorm.md
│   │   │   │   └── draft.md
│   │   │   ├── story-world/
│   │   │   │   ├── brainstorm.md
│   │   │   │   └── draft.md
│   │   │   ├── emotional-promise/
│   │   │   │   ├── brainstorm.md
│   │   │   │   └── draft.md
│   │   │   ├── logline.md                    #     Phase 1 deliverable
│   │   │   └── story-foundation.md           #     Phase 1 deliverable
│   │   │
│   │   ├── phase-2-root/                     #   Phase 2: Root
│   │   │   ├── beat-01-opening-image/
│   │   │   │   ├── brainstorm.md
│   │   │   │   └── draft.md
│   │   │   ├── beat-02-daily-life/
│   │   │   │   ├── brainstorm.md
│   │   │   │   └── draft.md
│   │   │   ├── beat-03-inciting-incident/
│   │   │   │   ├── brainstorm.md
│   │   │   │   └── draft.md
│   │   │   ├── beat-04-reluctance-moment/
│   │   │   │   ├── brainstorm.md
│   │   │   │   └── draft.md
│   │   │   ├── beat-05-point-of-departure/
│   │   │   │   ├── brainstorm.md
│   │   │   │   └── draft.md
│   │   │   ├── beat-06-first-challenge/
│   │   │   │   ├── brainstorm.md
│   │   │   │   └── draft.md
│   │   │   ├── beat-07-end-of-known-world/
│   │   │   │   ├── brainstorm.md
│   │   │   │   └── draft.md
│   │   │   ├── beat-08-new-reality/
│   │   │   │   ├── brainstorm.md
│   │   │   │   └── draft.md
│   │   │   ├── beat-09-initial-progress/
│   │   │   │   ├── brainstorm.md
│   │   │   │   └── draft.md
│   │   │   ├── beat-10-strengthening-allies/
│   │   │   │   ├── brainstorm.md
│   │   │   │   └── draft.md
│   │   │   ├── beat-11-midpoint-shift/
│   │   │   │   ├── brainstorm.md
│   │   │   │   └── draft.md
│   │   │   ├── beat-12-growing-opposition/
│   │   │   │   ├── brainstorm.md
│   │   │   │   └── draft.md
│   │   │   ├── beat-13-moment-of-doubt/
│   │   │   │   ├── brainstorm.md
│   │   │   │   └── draft.md
│   │   │   ├── beat-14-renewed-determination/
│   │   │   │   ├── brainstorm.md
│   │   │   │   └── draft.md
│   │   │   ├── beat-15-ultimate-challenge/
│   │   │   │   ├── brainstorm.md
│   │   │   │   └── draft.md
│   │   │   ├── beat-16-darkest-moment/
│   │   │   │   ├── brainstorm.md
│   │   │   │   └── draft.md
│   │   │   ├── beat-17-final-decision/
│   │   │   │   ├── brainstorm.md
│   │   │   │   └── draft.md
│   │   │   ├── beat-18-climactic-confrontation/
│   │   │   │   ├── brainstorm.md
│   │   │   │   └── draft.md
│   │   │   ├── beat-19-resolution/
│   │   │   │   ├── brainstorm.md
│   │   │   │   └── draft.md
│   │   │   ├── beat-20-new-equilibrium/
│   │   │   │   ├── brainstorm.md
│   │   │   │   └── draft.md
│   │   │   ├── beat-21-closing-image/
│   │   │   │   ├── brainstorm.md
│   │   │   │   └── draft.md
│   │   │   └── story-structure-outline.md    #     Phase 2 deliverable
│   │   │
│   │   ├── phase-3-sprout/                   #   Phase 3: Sprout
│   │   │   ├── [character-slug]/             #     e.g. marcus-cole/
│   │   │   │   ├── stage-1-comfort-zone/
│   │   │   │   │   ├── brainstorm.md
│   │   │   │   │   └── draft.md
│   │   │   │   ├── stage-2-desire-emerges/
│   │   │   │   │   ├── brainstorm.md
│   │   │   │   │   └── draft.md
│   │   │   │   ├── stage-3-crossing-threshold/
│   │   │   │   │   ├── brainstorm.md
│   │   │   │   │   └── draft.md
│   │   │   │   ├── stage-4-trial-and-error/
│   │   │   │   │   ├── brainstorm.md
│   │   │   │   │   └── draft.md
│   │   │   │   ├── stage-5-moment-of-truth/
│   │   │   │   │   ├── brainstorm.md
│   │   │   │   │   └── draft.md
│   │   │   │   ├── stage-6-supreme-ordeal/
│   │   │   │   │   ├── brainstorm.md
│   │   │   │   │   └── draft.md
│   │   │   │   ├── stage-7-transformation/
│   │   │   │   │   ├── brainstorm.md
│   │   │   │   │   └── draft.md
│   │   │   │   ├── stage-8-return-integration/
│   │   │   │   │   ├── brainstorm.md
│   │   │   │   │   └── draft.md
│   │   │   │   └── journey-map.md            #     Per-character deliverable
│   │   │   ├── [another-character-slug]/
│   │   │   │   └── ...
│   │   │   └── relationship-dynamics.md      #     Phase 3 deliverable
│   │   │
│   │   ├── phase-4-flourish/                 #   Phase 4: Flourish (scene outlines)
│   │   │   ├── act-1/
│   │   │   │   ├── beat-01-scene-01.md
│   │   │   │   ├── beat-01-scene-02.md
│   │   │   │   ├── beat-02-scene-01.md
│   │   │   │   └── ...
│   │   │   ├── act-2/
│   │   │   │   ├── beat-08-scene-01.md
│   │   │   │   └── ...
│   │   │   └── act-3/
│   │   │       ├── beat-16-scene-01.md
│   │   │       └── ...
│   │   │
│   │   ├── phase-5-bloom/                    #   Phase 5: Bloom (prose drafts)
│   │   │   ├── ch-01/
│   │   │   │   ├── _chapter.md               #     Chapter metadata & notes
│   │   │   │   ├── scene-01.md               #     Scene prose draft
│   │   │   │   ├── scene-02.md
│   │   │   │   └── ...
│   │   │   ├── ch-02/
│   │   │   │   └── ...
│   │   │   └── .../
│   │   │
│   │   ├── front-matter/                     #   Literary front matter
│   │   │   ├── title-page.md
│   │   │   ├── copyright.md
│   │   │   ├── dedication.md
│   │   │   ├── epigraph.md
│   │   │   ├── prologue.md
│   │   │   └── ...
│   │   │
│   │   ├── back-matter/                      #   Literary back matter
│   │   │   ├── epilogue.md
│   │   │   ├── afterword.md
│   │   │   ├── acknowledgments.md
│   │   │   ├── appendices/
│   │   │   │   └── *.md
│   │   │   └── about-the-author.md
│   │   │
│   │   └── notes/                            #   Book-specific notes
│   │       └── *.md
│   │
│   ├── book-02/
│   │   └── ... (same structure)
│   └── .../
│
├── timeline/                                 #   World-event timeline definitions
│   └── timelines.json                        #     Named timelines & configuration
│
└── exports/                                  #   Generated manuscript exports
    └── *.pdf / *.docx / *.epub
```

### 3.1 World Bible Sections

Two sections are created by default for every project: **Locations** and **Items**.

All other sections are added by the user via **+ New Section** in the World Bible view. The available sections are presented in a dropdown, grouped by applicability:

**Common (broadly applicable across genres):**

| Section Slug | Display Name | Description |
|-------------|-------------|-------------|
| `history` | History & Backstory | Events that precede the story |
| `factions` | Factions & Organizations | Groups, companies, families, agencies |
| `culture` | Culture & Society | Customs, social norms, class structures, daily life |
| `rules` | Rules & Conventions | Genre-specific logic, story-world constraints |

**Genre-leaning (commonly needed for specific genres):**

| Section Slug | Display Name | Description |
|-------------|-------------|-------------|
| `technology` | Technology | Systems, devices, infrastructure |
| `magic-systems` | Magic Systems | Rules, costs, limitations |
| `religion` | Religion & Belief Systems | Faiths, philosophies, superstitions |
| `government` | Government & Politics | Power structures, laws, jurisdictions |
| `economy` | Economy & Trade | Money, resources, commerce, wealth dynamics |
| `flora-fauna` | Flora & Fauna | Creatures, plants, ecosystems |

**Specialized:**

| Section Slug | Display Name | Description |
|-------------|-------------|-------------|
| `languages` | Languages & Communication | Dialects, slang, constructed languages, codes |
| `mythology` | Mythology & Legends | In-world myths, prophecies, folklore |
| `geography` | Geography & Climate | Physical world, weather patterns, natural features |
| `medicine` | Medicine & Science | Medical systems, scientific understanding, health |
| `arts` | Arts & Entertainment | In-world media, music, literature, sports |
| `food` | Food & Cuisine | Culinary traditions |
| `calendar` | Calendar & Timekeeping | Seasons, festivals, how time is marked |
| `transportation` | Transportation & Travel | How people get around, travel times, infrastructure |
| `custom` | Custom Section | User names it themselves |

### 3.2 Beat-to-Act Mapping

Scene outlines in Phase 4 are organized by act. Beats map to acts as follows:

| Act | Beats | Folder |
|-----|-------|--------|
| **Act 1** — The Known World (~25%) | Beats 1–7 | `act-1/` |
| **Act 2** — The Unknown World (~50%) | Beats 8–15 | `act-2/` |
| **Act 3** — The Transformed World (~25%) | Beats 16–21 | `act-3/` |

### 3.3 Scene File Naming Convention

**Phase 4 (outlines):** `beat-{NN}-scene-{NN}.md`  
Example: `beat-03-scene-02.md` = the second scene in Beat 3 (Inciting Incident)

**Phase 5 (prose drafts):** `scene-{NN}.md` inside chapter folders  
Example: `ch-02/scene-01.md` = the first scene in Chapter 2

The frontmatter of each Phase 5 scene draft references back to its Phase 4 outline via the `outline_ref` field (see Section 5.16).

---

## 4. User Flow

### 4.1 Project Creation

```
1. App opens → Welcome screen
2. User chooses: "New Project" or "Open Existing"
3. If new → Project creation wizard:
   a. Project name
   b. Short description (optional — displayed on Dashboard)
   c. [Create]
4. App automatically sets working directory to ~/Documents/sAIpling/<project-slug>/
   (the user does not choose or configure the directory — it is derived from the project name)
5. App creates directory structure + project.json
6. App creates overview/brainstorm.md with empty template
7. User lands on the Dashboard
```

> **Note**: There is no project-level genre. Genre is set per-book when adding a book (Step 4.3), since projects may contain books across different genres or sub-genres.

### 4.2 Project Brainstorm → Overview

> **Developer note**: This is the current process we already have in the app. The only changes are the folder structure and file naming conventions described in this spec.

```
1. User opens overview/brainstorm.md from the Dashboard
2. User brain-dumps all ideas for the project/series/universe
3. User chats with Claude (brainstorm skill loaded, brainstorm.md as context)
4. When satisfied, user clicks [Generate Overview]
5. overview_generator skill runs with:
   Context: overview/brainstorm.md + AI chat conversation
6. overview/overview.md is created/regenerated
7. User can edit, regenerate, or version the overview at any time
```

### 4.3 Adding a Book

> **Developer note**: Previously, book folders (e.g. `books/book-01/`) were created at project creation time. With this spec, book folders are created **only when the user adds a new book**. The project starts with an empty `books/` directory.

```
1. User clicks [+ New Book] on Dashboard
2. Modal appears:
   a. Title (text input)
   b. Author (text input)
   c. Primary Genre (dropdown — see genre list in 4.3.1)
   d. [Create]
3. App creates books/book-XX/ directory structure + book.json
4. App creates books/book-XX/overview/brainstorm.md
5. New book appears as a card/button on the Dashboard book list
6. User clicks the book card to open it and begin working
7. Each book card has an edit (gear) icon in the top-right corner
   that opens a modal to edit the book's metadata (title, author, primary genre)
8. User brain-dumps book-specific ideas into brainstorm.md
9. User chats with Claude (brainstorm skill, context: project overview + book brainstorm)
10. When satisfied, user clicks [Generate Book Overview]
11. overview_generator skill runs with:
    Context: overview/overview.md (project) + book brainstorm.md + AI chat
12. books/book-XX/overview/overview.md is created
13. User is now ready to begin Phase 1, or to build out Characters & World first
```

**4.3.1 Genre Options**

The genre dropdown includes: Fantasy, Science Fiction, Romance, Mystery, Thriller, Suspense, Horror, Historical Fiction, Literary Fiction, Young Adult, Middle Grade, and Other (text input).

### 4.4 Creating a Character

```
1. User navigates to Characters view (sidebar) and clicks [+ New]
2. Modal appears: Character name (text input) → [Create]
3. App creates characters/[character-slug]/ directory
4. App creates characters/[character-slug]/brainstorm.md with character template
5. User brain-dumps character ideas
6. User chats with Claude (character_developer skill, context: project overview + brainstorm)
7. When satisfied, user clicks [Generate Character Profile]
8. character_developer skill runs with:
   Context: project overview + book overview(s) + brainstorm.md + AI chat
   + any existing story foundation or beat outlines (if they exist)
9. characters/[character-slug]/profile.md is created
10. User can edit, regenerate, or refine at any time
```

### 4.5 Creating a World Bible Entry

```
1. User navigates to World Bible view (sidebar)
2. If the desired section doesn't exist:
   a. User clicks [+ New Section]
   b. Modal shows categorized dropdown of available sections (see 3.1)
   c. User selects a section → folder is created under world/
3. User clicks [+ New Entry] within a section
4. Modal appears: Entry name (text input) → [Create]
5. App creates world/[section-slug]/[entry-slug]/ directory
6. App creates brainstorm.md with section-appropriate template
7. User brain-dumps, chats with Claude, generates entry.md
8. world_builder skill runs with:
   Context: project overview + world-bible entries + brainstorm.md + AI chat
```

### 4.6 Phase 1: Seed

```
1. User navigates to Phase 1 via the phase bar or Dashboard prompt
2. Phase 1 view shows 6 element cards:
   - Premise · Theme · Protagonist · Central Conflict · Story World · Emotional Promise
3. User clicks an element card → opens the element's brainstorm.md
4. For each element:
   a. User brain-dumps into brainstorm.md
   b. User chats with Claude (seed_developer skill)
      Context: project overview + book overview + any existing element drafts
              + character profiles + world entries
   c. User clicks [Generate] → element draft.md is created
   d. User can iterate: edit draft, regenerate, refine
5. Once all 6 element drafts exist, the [Generate Deliverables] button activates
6. User clicks [Generate Deliverables]:
   a. Logline (logline.md) — single-sentence elevator pitch
   b. Story Foundation (story-foundation.md) — concise reference document
      Context: all 6 element drafts + book overview + project overview
7. Phase 1 status updates to "complete" in book.json
8. Dashboard prompts user to begin Phase 2
```

### 4.7 Phase 2: Root

```
1. User navigates to Phase 2 via phase bar or Dashboard
2. Phase 2 view shows 21 beat cards organized by act:
   - Act 1 (Beats 1–7) · Act 2 (Beats 8–15) · Act 3 (Beats 16–21)
3. Anchor beats are highlighted: Beat 3 (Inciting Incident), Beat 11 (Midpoint Shift),
   Beat 18 (Climactic Confrontation), Beat 21 (Closing Image)
4. User is encouraged to start with anchor beats
5. For each beat:
   a. User clicks beat card → opens beat's brainstorm.md
   b. User brain-dumps ideas for this beat
   c. User chats with Claude (structure_analyst skill)
      Context: story foundation + logline + any completed beat drafts
              + character profiles + world entries
   d. User clicks [Generate] → beat draft.md is created
6. User can also ask Claude to generate multiple beats at once:
   - "Generate all Act 1 beats" or "Generate all 21 beats"
   - Claude creates individual beat draft files for each
7. User iterates until satisfied with all 21 beats
8. [Generate Deliverable] button activates when all 21 beat drafts exist
9. User clicks [Generate Deliverable]:
   - Story Structure Outline (story-structure-outline.md) — all 21 beats in one document
     Context: all 21 beat drafts + story foundation
10. Phase 2 status updates to "complete"
```

### 4.8 Phase 3: Sprout

```
1. User navigates to Phase 3 via phase bar or Dashboard
2. Phase 3 view shows character cards for all characters in characters/
3. User is encouraged to review/revise character profiles based on story development
4. For each significant character:
   a. User clicks character → sees 8 journey stage cards:
      Stage 1: Comfort Zone · Stage 2: Desire Emerges · Stage 3: Crossing the Threshold
      Stage 4: Trial & Error · Stage 5: Moment of Truth · Stage 6: The Supreme Ordeal
      Stage 7: Transformation · Stage 8: Return & Integration
   b. Each stage shows which beats it aligns with (see 4.8.1)
   c. For each stage: brainstorm → chat → generate (same pattern)
      Context: character profile + story foundation + story structure outline
              + completed journey stages + beat drafts for aligned beats
   d. Once all 8 stages are drafted, [Generate Journey Map] activates
   e. journey-map.md is generated — full character arc in one document
5. Once all significant characters have journey maps:
   [Generate Relationship Dynamics] activates
6. relationship-dynamics.md is generated
   Context: all character profiles + all journey maps + story structure outline
7. Phase 3 status updates to "complete"
```

**4.8.1 Journey Stage → Beat Alignment**

| Journey Stage | Aligned Beats |
|--------------|---------------|
| Stage 1: Comfort Zone | Beat 1 (Opening Image), Beat 2 (Daily Life) |
| Stage 2: Desire Emerges | Beat 3 (Inciting Incident), Beat 4 (Reluctance Moment) |
| Stage 3: Crossing the Threshold | Beat 5 (Point of Departure), Beat 6 (First Challenge), Beat 7 (End of Known World) |
| Stage 4: Trial & Error | Beat 8 (New Reality), Beat 9 (Initial Progress), Beat 10 (Strengthening Allies) |
| Stage 5: Moment of Truth | Beat 11 (Midpoint Shift), Beat 12 (Growing Opposition), Beat 13 (Moment of Doubt) |
| Stage 6: The Supreme Ordeal | Beat 14 (Renewed Determination), Beat 15 (Ultimate Challenge), Beat 16 (Darkest Moment) |
| Stage 7: Transformation | Beat 17 (Final Decision), Beat 18 (Climactic Confrontation) |
| Stage 8: Return & Integration | Beat 19 (Resolution), Beat 20 (New Equilibrium), Beat 21 (Closing Image) |

### 4.9 Phase 4: Flourish

```
1. User navigates to Phase 4 via phase bar or Dashboard
2. Phase 4 view shows beats organized by act, with the ability to add scenes to each beat
3. For each beat, user creates scene outlines:
   a. Click [+ Scene] on a beat → scene outline file is created
   b. User can brainstorm in the AI chat or write the outline directly
   c. Each scene must be designated as Action or Reaction
   d. Claude can generate scenes for individual beats, full acts, or the entire story
      Context: story foundation + story structure outline + character journey maps
              + relationship dynamics + relevant character profiles + relevant world entries
4. Scene outlines are organized by act folder (act-1/, act-2/, act-3/)
5. No formal "generate deliverable" step — the collection of scene outlines IS the deliverable
6. Phase 4 status updates based on scene outline coverage across beats
7. User can begin Phase 5 for any scene that has an outline (or even without one)
```

### 4.10 Phase 5: Bloom

```
1. User navigates to Phase 5 via phase bar, Dashboard, or by opening a scene draft
2. Phase 5 view shows chapters with scenes inside them
3. User organizes scenes into chapters (drag-and-drop or manual assignment)
4. For each scene:
   a. Scene draft file is created in the appropriate chapter folder
   b. User writes prose directly, or asks Claude to draft based on the scene outline
   c. Claude follows the Four-Beat Paragraph Pattern as a default rhythm:
      External Stimulus → Internal Response → Visible Action → Consequential Result
   d. AI editor tools are active: rewrite, expand, compress, describe, dialogue, synonyms
      Context: scene outline (from Phase 4) + surrounding scene drafts (prev/next)
              + character profiles + relevant world entries + story foundation
5. User iterates on each scene until satisfied
6. The full manuscript can be viewed, exported, or sent to Claude for review at any time
7. Phase 5 is "complete" when all scenes have a status of at least first_draft
```

### 4.11 Book Overview Regeneration

At any point during or after any phase, the user can regenerate the book overview:

```
1. User clicks [Regenerate] on the book overview
2. overview_generator skill runs with ALL available context:
   - Project overview
   - Book brainstorm
   - Story foundation + logline (if exists)
   - Story structure outline (if exists)
   - Character profiles and journey maps (if exist)
   - Relationship dynamics (if exists)
   - World bible entries
   - Current AI chat conversation
3. Book overview is regenerated to reflect the current state of development
```

This keeps the book overview as a living, current-state summary of the project.

---

## 5. File Type Specifications

Each section below defines the complete frontmatter and initial template content for a file type. When a file is first created, it contains the frontmatter, a title, and a description of what the document is — useful for both the user and Claude.

---

### 5.1 Project Brainstorm

**Path**: `overview/brainstorm.md`  
**Created**: On project creation

```yaml
---
type: brainstorm
scope: series
subject: project
created: 2026-02-23
modified: 2026-02-23
status: empty
---
```

**Template body**:

```markdown
# Project Brainstorm

This is your space to brain-dump everything about your project — the big ideas,
the vague feelings, the "what if" questions, the scenes you can already see in
your head. Don't worry about structure or consistency here. Just get your ideas
down.

Think about:
- What's the core idea that excites you?
- What kind of story is this? (series, standalone, universe?)
- What genre(s) does it live in?
- What tone or feeling are you going for?
- Any characters, settings, or scenes that are already forming?
- What themes or questions do you want to explore?
- What books, movies, or stories inspire this project?

Write freely below — this document is your starting point, not your final answer.

---


```

---

### 5.2 Project Overview

**Path**: `overview/overview.md`  
**Created**: Generated by overview_generator skill

```yaml
---
type: overview
scope: series
subject: project
created: 2026-02-23
modified: 2026-02-23
status: generated
generated_from:
  - overview/brainstorm.md
---
```

**Template body**: AI-generated. Typical sections include Premise, Setting, Main Characters, Central Conflict, Themes, Tone & Style, Story Arc. Only sections with sufficient information from the brainstorm are included.

---

### 5.3 Book Brainstorm

**Path**: `books/book-XX/overview/brainstorm.md`  
**Created**: When a new book is added

```yaml
---
type: brainstorm
scope: book-01
subject: book
created: 2026-02-23
modified: 2026-02-23
status: empty
---
```

**Template body**:

```markdown
# Book Brainstorm

This is your space to brain-dump everything about this specific book. If you've
already created a project overview, think about what makes THIS book unique within
the larger project.

Think about:
- What's the core story of this book?
- Who is the main character and what do they want?
- What's the central conflict or problem?
- Where and when does this book take place?
- How does this book fit into the larger series (if applicable)?
- What should the reader feel by the end?
- Any specific scenes, moments, or images you already have in mind?

Write freely below.

---


```

---

### 5.4 Book Overview

**Path**: `books/book-XX/overview/overview.md`  
**Created**: Generated by overview_generator skill

```yaml
---
type: overview
scope: book-01
subject: book
created: 2026-02-23
modified: 2026-02-23
status: generated
generated_from:
  - overview/overview.md
  - books/book-01/overview/brainstorm.md
---
```

**Template body**: AI-generated. Same structure as project overview, scoped to this specific book.

---

### 5.5 Character Brainstorm

**Path**: `characters/[character-slug]/brainstorm.md`  
**Created**: When user creates a new character

```yaml
---
type: brainstorm
scope: series
subject: character
character_id: marcus-cole
created: 2026-02-23
modified: 2026-02-23
status: empty
---
```

**Template body**:

```markdown
# Character Brainstorm — [Character Name]

Dump everything you know or feel about this character. Don't worry about filling
in every detail — just capture what's alive in your imagination right now.

Think about:
- Who is this person at their core?
- What do they want more than anything? (their conscious desire)
- What do they actually need? (often different from what they want)
- What's their biggest flaw or blind spot?
- What happened in their past that shaped who they are today?
- How do they talk? What makes their voice distinctive?
- What are their key relationships?
- What role do they play in the story?
- How will they change by the end?

Write freely below.

---


```

---

### 5.6 Character Profile

**Path**: `characters/[character-slug]/profile.md`  
**Created**: Generated by character_developer skill

```yaml
---
type: character-profile
scope: series
character_id: marcus-cole
role: protagonist
created: 2026-02-23
modified: 2026-02-23
status: generated
generated_from:
  - characters/marcus-cole/brainstorm.md
---
```

**Template body**: AI-generated. Standard sections:

```markdown
# [Character Name]

## Role
[protagonist / antagonist / supporting / minor]

## Core Identity
[Who this person is in a few sentences]

## Want
[What they consciously desire]

## Need
[What they must learn or accept — often in tension with their Want]

## Defining Flaw
[The internal obstacle that holds them back]

## Ghost / Backstory Wound
[The past event or pattern that created the flaw]

## Speech Patterns
[How they talk — sentence length, vocabulary, verbal tics, tone]

## Key Relationships
[How they connect to other characters]

## Character Arc Summary
[How they change from beginning to end]
```

---

### 5.7 World Entry Brainstorm

**Path**: `world/[section-slug]/[entry-slug]/brainstorm.md`  
**Created**: When user creates a new world entry

```yaml
---
type: brainstorm
scope: series
subject: world-entry
category: technology
entry_id: warp-drive
created: 2026-02-23
modified: 2026-02-23
status: empty
---
```

**Template body** (varies by category — example for Technology):

```markdown
# World Entry Brainstorm — [Entry Name]

Dump everything you know about this element of your world. Remember: every
world-building detail should ultimately serve your story — connecting to
characters, conflict, or theme.

Think about:
- What is it and how does it work?
- What are its rules and limitations?
- How does it affect daily life in your world?
- How does it create conflict or story possibilities?
- What's its history — how did it come to exist?
- How do different characters or groups relate to it?

Write freely below.

---


```

> **Note**: The template body should adapt its prompting questions based on `category`. A Location entry asks about atmosphere and significance. A Faction entry asks about goals and internal tensions. The app should have a template map for each category.

---

### 5.8 World Entry

**Path**: `world/[section-slug]/[entry-slug]/entry.md`  
**Created**: Generated by world_builder skill

```yaml
---
type: world-entry
scope: series
category: technology
entry_id: warp-drive
created: 2026-02-23
modified: 2026-02-23
status: generated
timelines: [main]
time_period: 2180/present
characters: [elena-vasquez, chief-engineer-ross]
locations: [uss-meridian]
generated_from:
  - world/technology/warp-drive/brainstorm.md
---
```

**Template body**: AI-generated. Structure varies by category. Common structure:

```markdown
# [Entry Name]

## Overview
[What it is and why it matters to the story]

## Details
[Specifics — how it works, what it looks like, its rules]

## Story Significance
[How it connects to characters, conflict, or theme]

## Connections
[Related world entries, characters, or events]
```

---

### 5.9 Seed Phase Element — Brainstorm

**Path**: `books/book-XX/phase-1-seed/[element]/brainstorm.md`  
**Created**: When user opens an element for the first time

Elements: `premise`, `theme`, `protagonist`, `central-conflict`, `story-world`, `emotional-promise`

```yaml
---
type: brainstorm
scope: book-01
subject: seed-element
element: premise
created: 2026-02-23
modified: 2026-02-23
status: empty
---
```

**Template body** (example for Premise):

```markdown
# Central Premise — Brainstorm

The **Central Premise** is a single sentence that captures the entire story. This
is the elevator pitch, the logline, the DNA of the narrative. Everything that
follows must serve this premise.

A strong premise typically contains:
- A character with a specific situation
- A conflict or challenge they face
- The stakes — what happens if they fail
- A hook — what makes this story unique

Example: "A disgraced detective must solve the murder of the woman he once loved,
only to discover the killer is someone he trusted with his life."

Brainstorm your premise ideas below.

---


```

> **Note**: Each of the 6 elements has a unique template body explaining what that element is and how to think about it. The descriptions from the Sapling Story Structure Framework should be used. See Section 4.6 for the full element descriptions.

**Element descriptions for template bodies:**

| Element | Opening Line |
|---------|-------------|
| `premise` | The **Central Premise** is a single sentence that captures the entire story. This is the elevator pitch, the logline, the DNA of the narrative. Everything that follows must serve this premise. |
| `theme` | The **Theme Statement** is the fundamental truth the story explores. Theme is what gives a story meaning beyond its plot. It's the answer to the question "what is this story really about?" |
| `protagonist` | The **Protagonist Profile** captures the essential traits — not a full character sheet, just the core. Who is this person at their core? What do they want? What do they need? What is their defining flaw? |
| `central-conflict` | The **Central Conflict** is the primary opposition to the protagonist's desires. This is the engine that drives the entire plot. Without conflict, there is no story. |
| `story-world` | **Story World Fundamentals** — the basic rules and unique elements of the setting. Not exhaustive world-building — just enough to establish what kind of world this story takes place in and what makes it distinctive. |
| `emotional-promise` | The **Emotional Promise** is what the reader will feel by the end. This is the contract between author and reader — the emotional experience the story commits to delivering. |

---

### 5.10 Seed Phase Element — Draft

**Path**: `books/book-XX/phase-1-seed/[element]/draft.md`  
**Created**: Generated by seed_developer skill

```yaml
---
type: seed-element-draft
scope: book-01
element: premise
created: 2026-02-23
modified: 2026-02-23
status: generated
generated_from:
  - books/book-01/phase-1-seed/premise/brainstorm.md
---
```

**Template body**: AI-generated. The draft contains the developed element content. For premise, this would be a refined single-sentence premise with supporting context. For protagonist, a focused profile. Each element draft is concise and focused.

---

### 5.11 Logline (Seed Phase Deliverable)

**Path**: `books/book-XX/phase-1-seed/logline.md`  
**Created**: Generated as Phase 1 deliverable

```yaml
---
type: logline
scope: book-01
phase: seed
created: 2026-02-23
modified: 2026-02-23
status: generated
generated_from:
  - books/book-01/phase-1-seed/premise/draft.md
  - books/book-01/phase-1-seed/central-conflict/draft.md
  - books/book-01/phase-1-seed/protagonist/draft.md
---
```

**Template body**: AI-generated. A single sentence (or at most two) that captures the entire story. This is the most distilled form of the book's premise.

---

### 5.12 Story Foundation (Seed Phase Deliverable)

**Path**: `books/book-XX/phase-1-seed/story-foundation.md`  
**Created**: Generated as Phase 1 deliverable

```yaml
---
type: story-foundation
scope: book-01
phase: seed
created: 2026-02-23
modified: 2026-02-23
status: generated
generated_from:
  - books/book-01/phase-1-seed/premise/draft.md
  - books/book-01/phase-1-seed/theme/draft.md
  - books/book-01/phase-1-seed/protagonist/draft.md
  - books/book-01/phase-1-seed/central-conflict/draft.md
  - books/book-01/phase-1-seed/story-world/draft.md
  - books/book-01/phase-1-seed/emotional-promise/draft.md
---
```

**Template body**: AI-generated. This is **not** a section-by-section relisting of the 6 core elements. Instead, it is a synthesized narrative — a few paragraphs that weave all 6 elements together into a cohesive summary of the story's DNA. The AI considers all 6 elements holistically and produces something greater than the sum of its parts: a concise, readable foundation document that captures the story's premise, the protagonist's internal journey, how the conflict tests the theme, why the world matters, and what the reader will feel. This becomes the primary alignment context for all subsequent phases.

```markdown
# Story Foundation — [Book Title]

## Logline
[Single sentence — the elevator pitch]

## Story Foundation
[2–4 paragraphs synthesizing all 6 core elements into a cohesive narrative.
This is not a list of elements — it is a unified summary that captures the
story's DNA. It should read as a compelling description of the story that
naturally integrates the premise, theme, protagonist, central conflict,
story world, and emotional promise into a single flowing piece. A reader
should be able to read this and understand exactly what the story is, who
it's about, what drives it, and why it matters.]
```

---

### 5.13 Beat Brainstorm (Root Phase)

**Path**: `books/book-XX/phase-2-root/beat-NN-[beat-slug]/brainstorm.md`  
**Created**: When user opens a beat for the first time

```yaml
---
type: brainstorm
scope: book-01
subject: beat
beat_number: 3
beat_name: Inciting Incident
act: 1
is_anchor: true
created: 2026-02-23
modified: 2026-02-23
status: empty
---
```

**Template body** (example for Beat 3):

```markdown
# Beat 3: Inciting Incident — Brainstorm

**What this beat does**: The Inciting Incident is the event that disrupts the
status quo — the thing that makes this day different from every other day. This
is the moment the story truly begins.

**Act**: 1 — The Known World  
**Anchor beat**: Yes — this is one of the four structural pillars of your story.

**Questions to consider**:
- What event forces your protagonist out of their routine?
- How does this event connect to the Central Conflict?
- What makes this moment impossible to ignore?
- How does the protagonist initially react?

Brainstorm below.

---


```

> **Note**: Each of the 21 beats has a unique template with its description, act placement, and whether it's an anchor beat. The full beat reference list from the Sapling Story Structure Framework should populate these templates.

**Full Beat Reference:**

| # | Beat Name | Slug | Act | Anchor |
|---|-----------|------|-----|--------|
| 1 | Opening Image | `opening-image` | 1 | No |
| 2 | Daily Life | `daily-life` | 1 | No |
| 3 | Inciting Incident | `inciting-incident` | 1 | **Yes** |
| 4 | Reluctance Moment | `reluctance-moment` | 1 | No |
| 5 | Point of Departure | `point-of-departure` | 1 | No |
| 6 | First Challenge | `first-challenge` | 1 | No |
| 7 | End of Known World | `end-of-known-world` | 1 | No |
| 8 | New Reality | `new-reality` | 2 | No |
| 9 | Initial Progress | `initial-progress` | 2 | No |
| 10 | Strengthening Allies | `strengthening-allies` | 2 | No |
| 11 | Midpoint Shift | `midpoint-shift` | 2 | **Yes** |
| 12 | Growing Opposition | `growing-opposition` | 2 | No |
| 13 | Moment of Doubt | `moment-of-doubt` | 2 | No |
| 14 | Renewed Determination | `renewed-determination` | 2 | No |
| 15 | Ultimate Challenge | `ultimate-challenge` | 2 | No |
| 16 | Darkest Moment | `darkest-moment` | 3 | No |
| 17 | Final Decision | `final-decision` | 3 | No |
| 18 | Climactic Confrontation | `climactic-confrontation` | 3 | **Yes** |
| 19 | Resolution | `resolution` | 3 | No |
| 20 | New Equilibrium | `new-equilibrium` | 3 | No |
| 21 | Closing Image | `closing-image` | 3 | **Yes** |

---

### 5.14 Beat Draft (Root Phase)

**Path**: `books/book-XX/phase-2-root/beat-NN-[beat-slug]/draft.md`  
**Created**: Generated by structure_analyst skill

```yaml
---
type: beat-draft
scope: book-01
beat_number: 3
beat_name: Inciting Incident
act: 1
is_anchor: true
created: 2026-02-23
modified: 2026-02-23
status: generated
generated_from:
  - books/book-01/phase-2-root/beat-03-inciting-incident/brainstorm.md
---
```

**Template body**: AI-generated. A developed description of what happens at this beat, including key events, character actions, and how it advances the story. Typically 1–3 paragraphs.

---

### 5.15 Story Structure Outline (Root Phase Deliverable)

**Path**: `books/book-XX/phase-2-root/story-structure-outline.md`  
**Created**: Generated as Phase 2 deliverable

```yaml
---
type: story-structure-outline
scope: book-01
phase: root
created: 2026-02-23
modified: 2026-02-23
status: generated
beats_included: 21
generated_from:
  - books/book-01/phase-2-root/beat-01-opening-image/draft.md
  - books/book-01/phase-2-root/beat-02-daily-life/draft.md
  # ... all 21 beat drafts
  - books/book-01/phase-2-root/beat-21-closing-image/draft.md
---
```

**Template body**: AI-generated. All 21 beats compiled into a single, cohesive story structure document organized by act. This is the "read the whole story structure at a glance" document.

```markdown
# Story Structure Outline — [Book Title]

## Act 1 — The Known World

### Beat 1: Opening Image
[content from beat draft]

### Beat 2: Daily Life
[content from beat draft]

...

## Act 2 — The Unknown World

### Beat 8: New Reality
[content from beat draft]

...

## Act 3 — The Transformed World

### Beat 16: Darkest Moment
[content from beat draft]

...
```

---

### 5.16 Journey Stage Brainstorm (Sprout Phase)

**Path**: `books/book-XX/phase-3-sprout/[character-slug]/stage-N-[stage-slug]/brainstorm.md`  
**Created**: When user opens a journey stage for the first time

```yaml
---
type: brainstorm
scope: book-01
subject: journey-stage
character_id: marcus-cole
stage_number: 1
stage_name: Comfort Zone
aligned_beats: [1, 2]
created: 2026-02-23
modified: 2026-02-23
status: empty
---
```

**Template body** (example for Stage 1):

```markdown
# Stage 1: Comfort Zone — Brainstorm
**Character**: [Character Name]

**What this stage is**: The Comfort Zone shows who the character is BEFORE the
story changes them. Their routines, their coping mechanisms, their worldview —
all of it on display, often without the character realizing how limited it is.

**Aligns with beats**: Beat 1 (Opening Image), Beat 2 (Daily Life)

**Questions to consider**:
- What does a typical day look like for this character?
- What coping mechanisms or habits define their current life?
- What are they avoiding or in denial about?
- How does their Defining Flaw manifest in their daily routine?
- What small details reveal who they really are beneath the surface?

Brainstorm below.

---


```

**Full Journey Stage Reference:**

| # | Stage Name | Slug | Aligned Beats |
|---|-----------|------|---------------|
| 1 | Comfort Zone | `comfort-zone` | 1, 2 |
| 2 | Desire Emerges | `desire-emerges` | 3, 4 |
| 3 | Crossing the Threshold | `crossing-threshold` | 5, 6, 7 |
| 4 | Trial & Error | `trial-and-error` | 8, 9, 10 |
| 5 | Moment of Truth | `moment-of-truth` | 11, 12, 13 |
| 6 | The Supreme Ordeal | `supreme-ordeal` | 14, 15, 16 |
| 7 | Transformation | `transformation` | 17, 18 |
| 8 | Return & Integration | `return-integration` | 19, 20, 21 |

---

### 5.17 Journey Stage Draft (Sprout Phase)

**Path**: `books/book-XX/phase-3-sprout/[character-slug]/stage-N-[stage-slug]/draft.md`  
**Created**: Generated by character_developer skill

```yaml
---
type: journey-stage-draft
scope: book-01
character_id: marcus-cole
stage_number: 1
stage_name: Comfort Zone
aligned_beats: [1, 2]
created: 2026-02-23
modified: 2026-02-23
status: generated
generated_from:
  - books/book-01/phase-3-sprout/marcus-cole/stage-1-comfort-zone/brainstorm.md
---
```

**Template body**: AI-generated. Describes how this character experiences and moves through this journey stage, mapped to specific story beats.

---

### 5.18 Character Journey Map (Sprout Phase Deliverable)

**Path**: `books/book-XX/phase-3-sprout/[character-slug]/journey-map.md`  
**Created**: Generated as per-character deliverable

```yaml
---
type: journey-map
scope: book-01
character_id: marcus-cole
phase: sprout
stages_included: 8
created: 2026-02-23
modified: 2026-02-23
status: generated
generated_from:
  - books/book-01/phase-3-sprout/marcus-cole/stage-1-comfort-zone/draft.md
  # ... all 8 stage drafts
  - books/book-01/phase-3-sprout/marcus-cole/stage-8-return-integration/draft.md
---
```

**Template body**: AI-generated. The complete character arc compiled into a single document, showing the full emotional and psychological journey through all 8 stages.

```markdown
# Character Journey Map — [Character Name] ([Book Title])

## Overview
[Brief arc summary — who they are at the start vs. who they become]

## Stage 1: Comfort Zone (Beats 1–2)
[content from stage draft]

## Stage 2: Desire Emerges (Beats 3–4)
[content from stage draft]

...

## Stage 8: Return & Integration (Beats 19–21)
[content from stage draft]

## Arc Summary
[How the full journey serves the story's theme]
```

---

### 5.19 Relationship Dynamics (Sprout Phase Deliverable)

**Path**: `books/book-XX/phase-3-sprout/relationship-dynamics.md`  
**Created**: Generated as Phase 3 deliverable

```yaml
---
type: relationship-dynamics
scope: book-01
phase: sprout
characters: [marcus-cole, elena-vasquez, sarah-chen, james-okafor]
created: 2026-02-23
modified: 2026-02-23
status: generated
generated_from:
  - books/book-01/phase-3-sprout/marcus-cole/journey-map.md
  - books/book-01/phase-3-sprout/elena-vasquez/journey-map.md
  # ... all character journey maps
  - characters/marcus-cole/profile.md
  - characters/elena-vasquez/profile.md
  # ... all character profiles
---
```

**Template body**: AI-generated.

```markdown
# Relationship Dynamics — [Book Title]

## Key Relationships

### [Character A] ↔ [Character B]
- **Nature**: [What connects them]
- **Status at story start**: [Where they stand when the book begins]
- **Tension**: [What creates friction between them]
- **Arc**: [How the relationship changes through the story]
- **Key intersection points**: [Beats/stages where one character's journey impacts the other]

...

## Relationship Web Summary
[How all relationships serve the story's theme and conflict]

## Dynamic Shifts
[Major relationship changes mapped to story beats]
```

---

### 5.20 Scene Outline (Flourish Phase)

**Path**: `books/book-XX/phase-4-flourish/act-N/beat-NN-scene-NN.md`  
**Created**: By user or generated by scene_architect skill

```yaml
---
type: scene-outline
scope: book-01
beat_number: 3
scene_number: 2
scene_type: reaction
pov_character: marcus-cole
characters: [marcus-cole, rosa-vasquez]
locations: [marcus-apartment]
world_refs: [ai-surveillance-network]
timelines: [main]
story_date: 2045-03-15T04:00/2045-03-15T04:30
referenced_events:
  - date: "2042-06-01"
    ref: world/history/the-collapse/entry.md
    label: "The Collapse (mentioned)"
    timeline: pre-history
created: 2026-02-23
modified: 2026-02-23
status: generated
---
```

**Template body** (when created empty, before generation):

```markdown
# Scene Outline — Beat [N], Scene [N]

## Scene Type: [ACTION / REACTION]

> **Action scenes** have: Character Goal → Mounting Conflict → Outcome Crisis
> **Reaction scenes** have: Emotional Response → Consideration of Options → New Direction

---

### [Component 1 — e.g. Character Goal]
[What the character wants to achieve in this scene]

### [Component 2 — e.g. Mounting Conflict]
[The obstacles that arise and escalate]

### [Component 3 — e.g. Outcome Crisis]
[The setback or complication that changes direction]

---

## Setting
[Where and when this scene takes place]

## Characters Present
[Who is in this scene and what role they play]

## Advances Plot By
[How this scene moves the story forward]

## Advances Character Arc By
[How this scene develops the POV character]

## Notes
[Any additional considerations]
```

When AI-generated, the template descriptions are replaced with actual content.

---

### 5.21 Chapter Metadata (Bloom Phase)

**Path**: `books/book-XX/phase-5-bloom/ch-NN/_chapter.md`  
**Created**: When a chapter is created

```yaml
---
type: chapter
scope: book-01
chapter_number: 1
title: "The Call"
created: 2026-02-23
modified: 2026-02-23
status: in_progress
---
```

**Template body**:

```markdown
# Chapter [N] — [Title]

Chapter-level notes, themes, or goals for this chapter.
```

---

### 5.22 Scene Draft (Bloom Phase)

**Path**: `books/book-XX/phase-5-bloom/ch-NN/scene-NN.md`  
**Created**: By user or generated by prose_writer skill

```yaml
---
type: scene-draft
scope: book-01
chapter: 1
scene_number: 1
draft_number: 1
word_count: 0
pov_character: marcus-cole
scene_type: action
outline_ref: books/book-01/phase-4-flourish/act-1/beat-03-scene-01.md
timelines: [main]
story_date: 2045-03-15T03:00/2045-03-15T03:45
characters: [marcus-cole, rosa-vasquez]
locations: [marcus-apartment]
referenced_events:
  - date: "2042-06-01"
    ref: world/history/the-collapse/entry.md
    label: "The Collapse (flashback)"
    timeline: pre-history
created: 2026-02-23
modified: 2026-02-23
status: not_started
---
```

**Template body** (when created empty):

```markdown
# [Scene Title]

<!-- Scene prose goes here. The recommended rhythm for paragraphs:
     External Stimulus → Internal Response → Visible Action → Consequential Result
     Vary this pattern for effect — it's a default rhythm, not a rigid rule. -->


```

When AI-generated, this contains actual prose narrative.

---

### 5.23 Note

**Path**: `notes/*.md` (series-level) or `books/book-XX/notes/*.md` (book-level)  
**Created**: By user at any time

```yaml
---
type: note
scope: series
tags: [research, subplot, worldbuilding]
related: [marcus-cole, neo-detroit]
created: 2026-02-23
modified: 2026-02-23
status: in_progress
---
```

**Template body**:

```markdown
# [Note Title]

[Freeform content — research, ideas, reference material, anything]
```

---

### 5.24 Front Matter

**Path**: `books/book-XX/front-matter/[subtype].md`  
**Created**: By user when adding front matter elements

```yaml
---
type: front-matter
scope: book-01
subtype: prologue
timelines: [pre-history]
story_date: 2042-06-01
created: 2026-02-23
modified: 2026-02-23
status: not_started
---
```

**Subtypes**: `title-page`, `copyright`, `dedication`, `epigraph`, `acknowledgments`, `foreword`, `preface`, `prologue`

---

### 5.25 Back Matter

**Path**: `books/book-XX/back-matter/[subtype].md`  
**Created**: By user when adding back matter elements

```yaml
---
type: back-matter
scope: book-01
subtype: epilogue
timelines: [main]
story_date: 2045-09-15
created: 2026-02-23
modified: 2026-02-23
status: not_started
---
```

**Subtypes**: `epilogue`, `afterword`, `acknowledgments`, `about-the-author`, and files inside `appendices/` subfolder

---

## 6. Timeline System

### 6.1 Narrative Timeline (Derived)

The narrative timeline requires no dedicated files. It is **derived** from the existing file structure:

```
Narrative order = book.json chapters[] → scenes[] in sort_order
```

Each scene's position in the narrative timeline is determined by its chapter and scene number. The app reads `phase-5-bloom/` chapter and scene ordering to construct this view.

### 6.2 World-Event Timelines (Configured + Derived)

World-event timelines are **configured** in `timeline/timelines.json` and **populated** by scanning frontmatter across all files.

**Path**: `timeline/timelines.json`

```json
{
  "timelines": [
    {
      "id": "main",
      "name": "Main Timeline",
      "description": "Primary story chronology",
      "start": "2040-01-01",
      "end": "2046-12-31",
      "calendar": "standard"
    },
    {
      "id": "pre-history",
      "name": "World History",
      "description": "Events before the story begins",
      "start": "2020-01-01",
      "end": "2040-01-01",
      "calendar": "standard"
    }
  ]
}
```

The app scans all `.md` files for `timelines`, `story_date`, `time_period`, and `referenced_events` fields in frontmatter, then plots them on the appropriate timeline(s).

**The `timelines` field**: Since a project can have multiple world-event timelines (e.g. "Main Timeline", "Mirror Universe", "World History"), every file that carries timeline data includes a `timelines` array specifying which timeline(s) it belongs to. This is a list of timeline IDs matching entries in `timelines.json`. If omitted, the file defaults to the first timeline defined in `timelines.json`. Referenced events also carry their own `timeline` field, since a flashback in a scene on the "main" timeline might reference an event on the "pre-history" timeline.

**Files that contribute timeline data:**

| File Type | Frontmatter Fields | What They Represent |
|-----------|-------------------|---------------------|
| Scene outline | `timelines`, `story_date` | Which timeline(s) and when this scene takes place |
| Scene draft | `timelines`, `story_date` | Which timeline(s) and when this scene takes place |
| Scene outline/draft | `referenced_events[].date`, `referenced_events[].timeline` | Flashbacks, mentions, references and which timeline they belong to |
| World entry | `timelines`, `time_period` | Which timeline(s) and when this world element exists/is relevant |
| Front/back matter | `timelines`, `story_date` | Which timeline(s) and when prologues/epilogues take place |

### 6.3 Date Format Flexibility

The `story_date` and `time_period` fields accept flexible formats:

| Format | Example | Use Case |
|--------|---------|----------|
| Full datetime range | `2045-03-15T03:00/2045-03-15T03:45` | Precise scene timing |
| Date range | `2045-03-15/2045-03-18` | Multi-day events |
| Single date | `2045-03-15` | Day-level precision |
| Month | `2045-03` | Month-level precision |
| Year | `2045` | Year-level precision |
| Year range | `2040/2045` | Span of years (for world entries) |
| Relative | `year-minus-3` | Backstory without fixed dates |
| Freeform | `"Third Age 1247"` | Fantasy/custom calendars (quoted string, manually positioned) |

ISO dates are plottable automatically. Freeform strings are displayed as labels and positioned manually by the user.

### 6.4 Timeline Visualization

The timeline view shows two synchronized panels:

**Left: Narrative Timeline** — Vertical sequence of scenes in reading order, collapsible by book → chapter → beat → scene. Color-coded by book. Shows `story_date` alongside each scene if available.

**Right: World-Event Timeline** — Horizontal chronological axis. Events plotted by date. Scenes, world entries, flashbacks, and references all visible. Collapsible by timeline (main, history, alternate), by book, or by event type.

**Connecting lines** between the two panels reveal non-linear structure: flashbacks reach backward, time skips create gaps, parallel storylines converge.

---

## 7. JSON Schemas

### 7.1 project.json

```json
{
  "version": "1.0.0",
  "name": "The Cole Files",
  "description": "A near-future noir series about a disgraced detective navigating AI-driven surveillance",
  "created": "2026-02-23T10:00:00Z",
  "modified": "2026-02-23T15:30:00Z",
  "books": [
    {
      "id": "book-01",
      "title": "The Broken Mirror",
      "sort_order": 1,
      "genre": "noir / science fiction"
    }
  ],
  "world_sections": ["locations", "items", "technology", "history"]
}
```

> **Note**: `world_sections` tracks which world bible sections the user has added. `locations` and `items` are always present. The app uses this list to know which folders exist under `world/`.

### 7.2 book.json

```json
{
  "version": "1.0.0",
  "id": "book-01",
  "title": "The Broken Mirror",
  "author": "Author Name",
  "genre": "noir / science fiction",
  "sort_order": 1,
  "created": "2026-02-23T12:00:00Z",
  "modified": "2026-02-23T15:30:00Z",
  "target_word_count": 80000,
  "current_word_count": 0,
  "phase_progress": {
    "seed": {
      "status": "not_started",
      "elements": {
        "premise": false,
        "theme": false,
        "protagonist": false,
        "central_conflict": false,
        "story_world": false,
        "emotional_promise": false
      },
      "deliverables": {
        "logline": false,
        "story_foundation": false
      }
    },
    "root": {
      "status": "not_started",
      "beats_drafted": 0,
      "beats_total": 21,
      "deliverables": {
        "story_structure_outline": false
      }
    },
    "sprout": {
      "status": "not_started",
      "characters": {},
      "deliverables": {
        "relationship_dynamics": false
      }
    },
    "flourish": {
      "status": "not_started",
      "scenes_outlined": 0
    },
    "bloom": {
      "status": "not_started",
      "scenes_drafted": 0,
      "scenes_total": 0
    }
  },
  "chapters": [],
  "front_matter": {},
  "back_matter": {},
  "settings": {
    "pov": "",
    "tense": ""
  }
}
```

---

## 8. Context Loading Strategy

### 8.1 What Gets Included as AI Context (by Phase)

| Phase | Always Include | Include If Exists | Brainstorm Files |
|-------|---------------|-------------------|-----------------|
| **Project Overview Gen** | project brainstorm | — | Current brainstorm only |
| **Book Overview Gen** | project overview, book brainstorm | — | Current brainstorm only |
| **Character Gen** | project overview, character brainstorm | book overview(s), story foundation, world entries | Current brainstorm only |
| **World Entry Gen** | project overview, entry brainstorm | book overview(s), related world entries, character profiles | Current brainstorm only |
| **Phase 1: Seed** | book overview, project overview | character profiles, world entries, other seed element drafts | Current element brainstorm |
| **Phase 1: Deliverables** | all 6 element drafts, book overview | project overview | None |
| **Phase 2: Root** | story foundation, logline | character profiles, world entries, completed beat drafts | Current beat brainstorm |
| **Phase 2: Deliverable** | all 21 beat drafts, story foundation | — | None |
| **Phase 3: Sprout** | character profile, story foundation, story structure outline | completed journey stages, beat drafts for aligned beats, relationship dynamics | Current stage brainstorm |
| **Phase 3: Journey Map** | all 8 stage drafts for character, character profile | story foundation | None |
| **Phase 3: Rel. Dynamics** | all journey maps, all character profiles | story structure outline | None |
| **Phase 4: Flourish** | story structure outline, story foundation | character journey maps, relationship dynamics, relevant character profiles, relevant world entries | None (outlines are authored directly) |
| **Phase 5: Bloom** | scene outline (from Phase 4), surrounding scene drafts | character profiles, world entries, story foundation | None (drafts are authored directly) |

### 8.2 Brainstorm File Context Rules

- Brainstorm files are included in context **only** during the generation step that produces their corresponding draft/output.
- After the draft is generated, the brainstorm file is **excluded by default** from future context loading.
- The user can override this via context settings (force-include any file).
- The AI chat conversation history is included alongside the brainstorm during generation.

### 8.3 User Context Overrides

Every file supports three context modes, configurable per-file in the Context Settings panel:

| Mode | Behavior |
|------|----------|
| **Auto** (default) | App decides based on phase, file type, and relevance |
| **Force** | Always include this file in AI context, regardless of phase |
| **Exclude** | Never include this file in AI context |

---

## 9. File Count Summary

For a single book with one protagonist and one supporting character:

| Category | Brainstorm Files | Draft/Generated Files | Deliverables | Total |
|----------|-----------------|----------------------|-------------|-------|
| Project overview | 1 | 1 | — | 2 |
| Book overview | 1 | 1 | — | 2 |
| Phase 1: Seed | 6 | 6 | 2 (logline + foundation) | 14 |
| Phase 2: Root | 21 | 21 | 1 (structure outline) | 43 |
| Phase 3: Sprout (2 chars) | 16 | 16 | 3 (2 journey maps + rel. dynamics) | 35 |
| Phase 4: Flourish | — | ~30–60 scene outlines | — | ~30–60 |
| Phase 5: Bloom | — | ~30–60 scene drafts + ch metadata | — | ~30–60 |
| Characters (2) | 2 | 2 | — | 4 |
| World entries (est. 5) | 5 | 5 | — | 10 |
| **Total** | **~52** | **~112–142** | **6** | **~170–200** |

The brainstorm files account for roughly 30% of all files but are ephemeral working documents — they serve their purpose during generation and then step out of the way.

---

## 10. Appendix: Slug Generation Rules

All folder and file names use **slugified** versions of user-provided names:

- Lowercase
- Spaces → hyphens
- Remove special characters except hyphens
- Trim to 50 characters max
- Ensure uniqueness within parent directory (append `-2`, `-3` if needed)

Examples:
- "Marcus Cole" → `marcus-cole`
- "Neo-Detroit" → `neo-detroit`
- "AI Surveillance Network" → `ai-surveillance-network`
- "The Collapse of 2042" → `the-collapse-of-2042`
