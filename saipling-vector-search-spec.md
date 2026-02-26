# SAiPLING Vector Search Integration Spec

---

## 1. Overview

The Vector Search system is an **optional** enhancement layer that provides semantic search across project files. It sits alongside the existing deterministic Context Assembler — not replacing it — giving the agent and the user the ability to find relevant content when the needed files can't be predicted by skill definitions alone.

### 1.1 Design Principles

- **Completely optional.** The app works identically without it. Users who don't want to pay for embeddings can disable it in Settings. No skill, workflow, or feature should _require_ vector search to function.
- **Supplementary, not primary.** The skill-based context assembly (always_include, when_book, optional) remains the primary context pipeline. Vector search adds a secondary retrieval channel.
- **Filesystem is the source of truth.** The vector index stores only embeddings and metadata. All content is read from .md/.json files on disk at query time. The index is fully rebuildable from the filesystem at any time.
- **Transparent to the user.** When vector search contributes files to context, the plan preview shows them clearly distinguished from deterministic files (e.g., "via search" vs "via skill").

### 1.2 When Vector Search Is Useful

| Scenario | Without Vector Search | With Vector Search |
|----------|----------------------|-------------------|
| "Where did I mention Marcus's sister?" | User manually searches files | Agent queries index, surfaces relevant passages |
| Consistency checker on a full novel | Load everything into context (expensive, may exceed budget) | Targeted lookups for specific facts/references |
| Chat-mode question referencing an obscure detail | Only skill-defined context files loaded | Semantic search supplements with relevant passages |
| Writing Scene 12 that callbacks to Scene 3 | Only adjacent scenes loaded by skill | Agent finds the callback target across the full project |
| Series with 200+ .md files | Skill configs must be maintained as project grows | Index handles retrieval across all files automatically |

### 1.3 When Vector Search Is NOT Used

- Core generate workflows (brainstorm, beat outline, prose writing) where the skill config already defines exactly the right files.
- Any time the feature is disabled in settings.
- When the user has no API key set (embeddings require the API).
- Offline mode (no API access for embedding generation).

---

## 2. Architecture

### 2.1 Components

```
┌─────────────────────────────────────────────────────────┐
│                    Agent Orchestrator                     │
│                                                          │
│  ┌──────────────────┐    ┌────────────────────────────┐  │
│  │ Context Assembler │    │ Vector Search Module       │  │
│  │ (deterministic)   │    │                            │  │
│  │                   │    │  ┌──────────────────────┐  │  │
│  │ always_include    │    │  │ Embedding Client     │  │  │
│  │ when_book         │    │  │ (Voyage via Anthropic│  │  │
│  │ optional          │    │  │  API)                │  │  │
│  │ summarization     │    │  └──────────────────────┘  │  │
│  │                   │    │  ┌──────────────────────┐  │  │
│  │                   │    │  │ SQLite + sqlite-vec  │  │  │
│  │                   │    │  │ (.saipling/index.db) │  │  │
│  └────────┬─────────┘    │  └──────────────────────┘  │  │
│           │               │  ┌──────────────────────┐  │  │
│           │               │  │ Chunker              │  │  │
│           │               │  │ (section-aware .md   │  │  │
│           │               │  │  splitting)          │  │  │
│           │               │  └──────────────────────┘  │  │
│           │               └─────────────┬──────────────┘  │
│           │                             │                  │
│           └──────────┬──────────────────┘                  │
│                      ▼                                     │
│              Merged Context                                │
│         (deterministic + search results)                   │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow

**Indexing Pipeline** (background, triggered by file watcher with debounce):

```
File changed on disk (e.g., auto-save every 30s)
  → File watcher detects change (existing notify watcher)
  → Watcher records/resets a per-file "last modified" timestamp
  → Background task checks every 10 seconds:
      → For each tracked file where (now - last_modified) > QUIET_PERIOD:
          → Chunker splits file into sections
          → For each chunk:
              → Generate content hash (SHA-256)
              → If hash unchanged → skip (already indexed)
              → If hash changed → add to embedding batch
          → Flush batch to Voyage API
          → Upsert embeddings + metadata into SQLite
          → Remove file from "pending" tracker
      → For deleted files: remove all chunks immediately (no debounce)

QUIET_PERIOD = 2 minutes (configurable)
```

**Why the debounce matters:** The app auto-saves every 30 seconds during active writing. Without debounce, a 1-hour writing session would trigger ~120 re-embeds of the same file. With the 2-minute quiet period, the file is only embedded once — after the user stops editing it. This prevents pointless API calls on half-finished sentences while still keeping the index current. File deletions skip the debounce and remove index entries immediately, since there's no content to re-embed.

**Query Pipeline** (at context assembly time):

```
User message / agent intent arrives
  → Context Assembler loads deterministic files (unchanged)
  → If vector_search enabled on skill OR agent decides to search:
      → Embed the query text via Voyage API
      → Query SQLite for top-K nearest chunks
      → Load project context settings (.context_settings.json)
      → Filter results:
          → Remove chunks whose file_path is marked "exclude" in context settings
          → Remove chunks whose file_path was already loaded by the deterministic assembler
      → For each remaining result: load the source file/section from disk
      → Add to context with "via search" annotation
  → Merge into final prompt
```

### 2.3 Storage Location

```
my-series/
├── .saipling/                    # Project-level config (already exists)
│   ├── index.db                  # SQLite vector index (NEW)
│   └── ...
```

The `index.db` file is:
- **Gitignored** (add to default .gitignore template).
- **Fully rebuildable** from project files at any time.
- **Deletable** with no data loss — the user can delete it and re-index.
- **Project-scoped** — each project has its own index.

---

## 3. SQLite Schema

### 3.1 Tables

```sql
-- Tracks indexed files and their state
CREATE TABLE indexed_files (
    file_path     TEXT PRIMARY KEY,      -- Relative path from project root
    content_hash  TEXT NOT NULL,          -- SHA-256 of file content
    file_type     TEXT NOT NULL,          -- 'character', 'world', 'scene', 'foundation', etc.
    last_indexed  TEXT NOT NULL,          -- ISO 8601 timestamp
    chunk_count   INTEGER NOT NULL DEFAULT 0
);

-- Stores individual chunks with embeddings
CREATE TABLE chunks (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path     TEXT NOT NULL,          -- FK to indexed_files
    chunk_index   INTEGER NOT NULL,       -- Order within file (0, 1, 2...)
    section_heading TEXT,                 -- e.g., "## Defining Flaw", null for frontmatter
    content_hash  TEXT NOT NULL,          -- SHA-256 of chunk content (for dedup)
    content_preview TEXT NOT NULL,        -- First 200 chars for display in plan preview
    token_count   INTEGER NOT NULL,       -- Estimated tokens for budget calculation
    embedding     BLOB NOT NULL,          -- float32 vector via sqlite-vec
    
    FOREIGN KEY (file_path) REFERENCES indexed_files(file_path) ON DELETE CASCADE,
    UNIQUE(file_path, chunk_index)
);

-- sqlite-vec virtual table for ANN search
CREATE VIRTUAL TABLE vec_chunks USING vec0(
    chunk_id INTEGER PRIMARY KEY,
    embedding float[1024]               -- Voyage 3 outputs 1024 dimensions
);

-- Metadata for filtering during search
CREATE TABLE chunk_metadata (
    chunk_id      INTEGER PRIMARY KEY,
    book_id       TEXT,                   -- Which book this belongs to (null for series-level)
    chapter_id    TEXT,                   -- Which chapter (null for non-scene files)
    entity_type   TEXT,                   -- 'character', 'location', 'faction', 'beat', 'scene', etc.
    entity_name   TEXT,                   -- e.g., 'marcus-cole', 'neo-detroit'
    
    FOREIGN KEY (chunk_id) REFERENCES chunks(id) ON DELETE CASCADE
);

-- Tracks embedding costs for the user
CREATE TABLE embedding_log (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp     TEXT NOT NULL,
    tokens_used   INTEGER NOT NULL,
    chunks_embedded INTEGER NOT NULL,
    cost_usd      REAL NOT NULL
);
```

### 3.2 Index

```sql
CREATE INDEX idx_chunks_file ON chunks(file_path);
CREATE INDEX idx_metadata_book ON chunk_metadata(book_id);
CREATE INDEX idx_metadata_entity ON chunk_metadata(entity_type, entity_name);
```

---

## 4. Chunking Strategy

### 4.1 How Files Are Split

SAiPLING's .md files are already well-structured with YAML frontmatter and markdown headings. The chunker exploits this structure rather than using arbitrary token-window splitting.

**Chunking Rules:**

1. **YAML frontmatter** → its own chunk (entity metadata extracted from frontmatter fields).
2. **Each `##` heading section** → its own chunk. This maps naturally to character sheet sections (## Want, ## Need, ## Defining Flaw), world-bible sections, scene outline components, etc.
3. **If a section exceeds 1000 tokens** → split at paragraph boundaries, keeping the heading in each sub-chunk for context.
4. **Files with no headings** (e.g., prose drafts) → split at paragraph boundaries, targeting ~500-token chunks with ~50-token overlap for continuity.

**Metadata Extraction:**

The chunker reads frontmatter to populate `chunk_metadata`:

```yaml
# From characters/marcus-cole/profile.md frontmatter:
---
type: character
name: Marcus Cole
role: protagonist
scope: series
---
```

Produces metadata:
```
entity_type: "character"
entity_name: "marcus-cole"
book_id: null  (series-scoped, not book-specific)
```

```yaml
# From books/book-01/phase-5-bloom/ch-01/scene-01.md frontmatter:
---
type: scene_draft
scope: book-01
status: first_draft
---
```

Produces metadata:
```
entity_type: "scene_draft"
entity_name: "ch-01-scene-01"
book_id: "book-01"
chapter_id: "ch-01"
```

### 4.2 File Type Classification

The chunker determines `file_type` from the file's location in the project structure:

| Path Pattern | file_type |
|-------------|-----------|
| `overview/overview.md` | `overview` |
| `overview/brainstorm.md` | `brainstorm` |
| `characters/**/profile.md` | `character` |
| `characters/**/brainstorm.md` | `brainstorm` |
| `world/**/*.md` | `world` |
| `notes/*.md` | `notes` |
| `books/{book}/overview/*.md` | `book_overview` |
| `books/{book}/phase-1-seed/**/*.md` | `seed` |
| `books/{book}/phase-2-root/**/*.md` | `structure` |
| `books/{book}/phase-3-sprout/**/*.md` | `character_arc` |
| `books/{book}/phase-4-flourish/**/*.md` | `scene_outline` |
| `books/{book}/phase-5-bloom/**/*.md` | `scene_draft` |
| `books/{book}/front-matter/*.md` | `front_matter` |
| `books/{book}/back-matter/**/*.md` | `back_matter` |
| `books/{book}/notes/*.md` | `notes` |
| `*.json` | `config` (indexed for searchability but low priority) |

---

## 5. Embedding Pipeline

### 5.1 API Configuration

The system uses Voyage AI embeddings for semantic search. **Voyage AI has its own API and requires a separate API key** — the user's Anthropic/Claude API key will not work for Voyage. Users must obtain a Voyage API key from https://dash.voyageai.com/ and enter it in the Vector Search settings.

**Model:** `voyage-4` (1024 dimensions, strong retrieval performance)

**Endpoint:** `https://api.voyageai.com/v1/embeddings`

> **Implementation note:** The `embedding_api_key_encrypted` field in `VectorSearchConfig` stores the Voyage API key. The Settings UI should make this prominent — not hidden behind a "use main API key" toggle. The implementation uses a provider-agnostic `EmbeddingClient` trait so the embedding provider can be swapped in the future if Anthropic bundles Voyage access or an alternative provider is preferred.

### 5.2 Debounce & Batching

**The problem:** SAiPLING auto-saves every 30 seconds while the user is actively writing. Without debounce, each auto-save would trigger a re-embed of the file — roughly 120 unnecessary API calls per hour of writing. While the cost per call is tiny (~$0.0002), it's wasteful and the embeddings of half-finished sentences are useless for search.

**Solution: Per-file quiet period + batch flush.**

The indexer maintains a `HashMap<PathBuf, Instant>` tracking the last modification time of each pending file. The embedding pipeline only processes a file once it has been "quiet" (unmodified) for a configurable period.

```rust
const QUIET_PERIOD: Duration = Duration::from_secs(120);  // 2 minutes
const TICK_INTERVAL: Duration = Duration::from_secs(10);   // Check every 10s
const MAX_BATCH_SIZE: usize = 128;                         // Voyage batch limit
```

**Background task loop (runs every TICK_INTERVAL):**

```
1. Lock the pending_files map
2. For each (file_path, last_modified):
   a. If (now - last_modified) < QUIET_PERIOD → skip (still being edited)
   b. If file no longer exists on disk → remove from map, deindex from SQLite
   c. Otherwise → add to "ready to embed" list, remove from map
3. For each file in the ready list:
   a. Read file from disk, chunk it, hash each chunk
   b. Compare hashes to what's in SQLite
   c. Collect changed chunks into an embedding batch
4. Send batches to Voyage API (max 128 chunks per call)
5. Upsert results into SQLite
6. Log to embedding_log
```

**File deletions bypass the debounce entirely.** When the watcher reports a deletion, the indexer removes all chunks for that file from SQLite immediately on the next tick — no reason to wait.

**Full re-index (manual trigger) also bypasses the debounce.** When the user clicks "Re-index Project" in settings, all files are processed immediately in batches of 128 with a brief pause between batches to avoid rate limits.

**What this looks like in practice:**

| Scenario | Behavior |
|----------|----------|
| User writes for 1 hour straight in Scene 5 | File is re-embedded once, ~2 min after they stop or switch files |
| User edits 3 character sheets in quick succession | Each sheet is embedded ~2 min after its last save |
| User switches from Scene 5 to chat panel | Scene 5's quiet timer starts; embedded 2 min later |
| User does a git pull that changes 40 files | All 40 files enter the pending map; embedded in batches after 2 min of quiet |
| User deletes a character file | Chunks removed from index immediately on next tick |
| User clicks "Re-index Project" | All files processed immediately, ignoring quiet period |

### 5.3 Cost Tracking

Every embedding API call logs to `embedding_log`:

```rust
struct EmbeddingLogEntry {
    tokens_used: u64,
    chunks_embedded: u32,
    cost_usd: f64,  // Voyage 3: $0.06 per million tokens
}
```

The Settings UI displays:
- Total embedding cost for this project (sum of embedding_log).
- Estimated cost to re-index the full project.
- A "Re-index Project" button.

### 5.4 Cost Estimates (for reference)

| Project Size | Est. Chunks | Est. Tokens | Embedding Cost |
|-------------|-------------|-------------|----------------|
| Short novel (50K words, simple world) | ~200 | ~80K | ~$0.005 |
| Full novel (100K words, rich world) | ~600 | ~250K | ~$0.015 |
| 5-book series with extensive world-building | ~3,000 | ~1.2M | ~$0.07 |

These costs are trivial compared to Claude API usage for actual writing assistance.

---

## 6. Integration with Context Assembler

### 6.1 Skill TOML Extension

Add an optional `[context.vector_search]` block to skill definitions:

```toml
[skill]
name = "consistency_checker"
display_name = "Consistency Checker"
description = "Checks for continuity errors and contradictions"
default_model = "claude-opus-4-5-20250929"
temperature = 0.3

[context]
always_include = [
    "overview/overview.md",
]

[context.when_book]
include = [
    "{book}/phase-1-seed/story-foundation.md",
    "{book}/phase-2-root/story-structure-outline.md",
]

max_context_tokens = 100000

# NEW: Vector search configuration for this skill
[context.vector_search]
enabled = true                  # This skill uses vector search (if globally enabled)
mode = "auto"                   # "auto" | "always" | "never"
max_results = 10                # Max chunks to retrieve
max_search_tokens = 20000       # Token budget for search results (within overall budget)
filter_entity_types = []        # Empty = search all types. Could be ["character", "world"]
```

**Field definitions:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | bool | `false` | Whether this skill can use vector search. Only effective if the user has vector search enabled globally. |
| `mode` | string | `"auto"` | `"auto"`: agent decides per-request whether search would help. `"always"`: always run a search query. `"never"`: override to disable even if enabled. |
| `max_results` | int | `5` | Maximum number of chunks to retrieve from the index. |
| `max_search_tokens` | int | `15000` | Maximum total tokens from search results. This comes out of the skill's `max_context_tokens` budget. |
| `filter_entity_types` | string[] | `[]` | Restrict search to specific entity types. Empty means search everything. |

### 6.2 Skills That Should Have Vector Search Enabled

| Skill | vector_search.enabled | mode | Rationale |
|-------|----------------------|------|-----------|
| `brainstorm` | `true` | `auto` | Open-ended questions may reference anything |
| `consistency_checker` | `true` | `always` | Needs to find contradictions across the full project |
| `prose_writer` | `true` | `auto` | May need callback references, foreshadowing targets |
| `prose_editor` | `true` | `auto` | May need to verify facts during editing |
| `scene_architect` | `true` | `auto` | May need to reference distant scenes for continuity |
| `character_developer` | `true` | `auto` | May need to find all mentions of a character |
| `world_builder` | `true` | `auto` | May need cross-references across world docs |
| `researcher` | `true` | `always` | Explicitly searching project content |
| `relationship_mapper` | `true` | `auto` | May need to find character interactions across scenes |
| `series_arc_planner` | `true` | `auto` | May need to reference content across multiple books |
| `overview_generator` | `true` | `auto` | May benefit from project-wide context |
| `genre_specialist` | `false` | — | Works from genre definitions and existing context |
| `front_back_matter_writer` | `false` | — | Deterministic context (book metadata, existing matter) is sufficient |
| `seed_developer` | `false` | — | Working from scratch, minimal existing content |
| `structure_analyst` | `false` | — | Deterministic context (beat outline) is sufficient |
| `describe` | `false` | — | Inline action, needs only the selected text + immediate context |
| `dialogue_crafter` | `false` | — | Inline action |

### 6.3 Modified Context Assembly Flow

The existing 8-step assembly process (SPEC, section 6.3) gains a new step between steps 5 and 6:

```
1. Load the skill definition (TOML file)
2. Resolve the scope (book/chapter/scene)
3. For each context file: load full or summarized
4. Build the system prompt
5. Build the context block from deterministic files
   ┌─────────────────────────────────────────────────────┐
   │ 5b. (NEW) Vector Search Enrichment                   │
   │                                                      │
   │   IF vector_search globally enabled                  │
   │   AND skill has vector_search.enabled = true         │
   │   AND (mode = "always" OR (mode = "auto" AND         │
   │        agent determines search would help)):          │
   │                                                      │
   │   a. Formulate search query from user message +      │
   │      current task context                            │
   │   b. Embed the query via Voyage API                  │
   │   c. Query sqlite-vec for top-K nearest chunks       │
   │   d. Apply filters (entity_type, book scope)         │
   │   e. Load .context_settings.json for the project     │
   │   f. Remove results where file is "exclude"          │
   │   g. Remove results where file already loaded (1-5)  │
   │   h. Calculate tokens for each remaining result      │
   │   i. Add results within max_search_tokens budget     │
   │   j. Append to context block with delimiters:        │
   │      "=== FILE: characters/sarah-chen.md (SEARCH) ===│"
   │      "  (matched section: ## Background)"             │
   └─────────────────────────────────────────────────────┘
6. Estimate total tokens
7. If over budget: remove least-relevant (search results shed first)
8. Return assembled context
```

**Important:** When shedding tokens to fit budget (step 7), search results are removed before deterministic files. The deterministic context is always higher priority.

### 6.4 Context Settings Integration

The existing Context Settings system (`.context_settings.json`) lets users mark individual files as `auto`, `exclude`, or `force`. Vector search must respect these settings. This is critical — if a user excluded a file, they excluded it for a reason, and having it sneak back in via vector search would be a confusing and frustrating experience.

**How it works:**

The `.context_settings.json` file lives at the project root and contains a simple map of relative paths to modes:

```json
{
  "characters/old-draft-marcus/profile.md": "exclude",
  "world/locations/spoiler-notes/entry.md": "exclude",
  "overview/overview.md": "force"
}
```

Files not in the map default to `auto` (the assembler decides based on the skill config and token budget).

> **Note:** The existing `load_context_settings()` and `is_excluded()` helpers in `assembler.rs` already handle path normalization (backslash → forward-slash). The vector search module should reuse these existing functions rather than duplicating them.

**Rules for vector search results:**

| Context Setting | Deterministic Assembler Behavior | Vector Search Behavior |
|----------------|----------------------------------|----------------------|
| `auto` (default) | Loaded if skill config includes it | Returned if semantically relevant |
| `exclude` | Never loaded | **Never returned.** Filtered out after sqlite-vec query, before results are passed to the assembler. |
| `force` | Always loaded in full | Not returned by search (already loaded by assembler — deduplicated by `loaded_canonical` check in step 5b.g). |

**Implementation detail:** The filtering happens at the file level, not the chunk level. Context settings reference full file paths. When sqlite-vec returns chunk results, each chunk's `file_path` is checked against the context settings map. If the file is `exclude`, all chunks from that file are dropped from the results regardless of similarity score.

**Where to load context settings:** The context settings are already loaded at the start of `assemble_context()` in `assembler.rs` via the existing `load_context_settings()` helper. The vector search enrichment step (5b) should reuse the already-loaded `ctx_settings` variable rather than re-reading the file. For standalone search commands (e.g., `/search`), call `load_context_settings()` directly.

**User-initiated /search command:** The `/search` command in chat (section 7.1) should also respect context settings. Excluded files should not appear in search results. This keeps behavior consistent — if you excluded a file, it's invisible to the AI everywhere.

### 6.5 Plan Preview Updates

The `AgentPlan` struct gains a new field for search results:

```rust
pub struct AgentPlan {
    pub plan_id: String,
    pub skills: Vec<String>,
    pub model: String,
    pub context_files: Vec<ContextFileInfo>,
    pub search_results: Vec<SearchResultInfo>,  // NEW
    pub total_tokens_est: u64,
    pub estimated_cost: String,
    pub approach: String,
}

pub struct SearchResultInfo {
    pub file_path: String,
    pub section: Option<String>,      // e.g., "## Background"
    pub similarity_score: f32,        // 0.0 to 1.0
    pub tokens_est: u64,
    pub content_preview: String,      // First 200 chars
}
```

In the plan confirmation UI, search results appear in a separate group:

```
Context files (via skill):
  ✓ overview/overview.md (FULL) — 2,400 tokens
  ✓ books/book-01/phase-1-seed/story-foundation.md (FULL) — 1,800 tokens

Context files (via search):
  🔍 characters/sarah-chen/profile.md § Background — 420 tokens (0.87 match)
  🔍 world/locations/old-quarter/entry.md § History — 310 tokens (0.82 match)
  
Total: 4,930 tokens | ~$0.02
```

The user can remove individual search results from the plan before executing.

---

## 7. User-Initiated Search

Beyond skill-driven search, the user should be able to explicitly search their project.

### 7.1 Search Command in Chat

When the user types a message in chat that begins with `/search` or the agent detects a search-intent query (e.g., "where did I write about...", "find all mentions of..."), the agent routes to a dedicated search flow:

```
User: /search Marcus's relationship with his father

→ Embed query
→ Query top 10 results
→ Display results in chat as a list:

  Found 6 relevant passages:

  1. characters/marcus-cole/profile.md § Background (0.91)
     "Marcus's father disappeared when he was twelve..."
  
  2. books/book-01/phase-5-bloom/ch-03/scene-02.md § paragraph 4 (0.85)
     "He stared at the photograph on the mantel..."
  
  3. characters/marcus-cole/profile.md § Defining Flaw (0.79)
     "Cannot allow himself to be vulnerable..."

  [Open File] buttons for each result
```

This doesn't invoke any skill — it's a pure retrieval operation, fast and cheap (one embedding call + one SQLite query).

### 7.2 Context Settings Integration

The existing Context Settings panel (which shows files included/excluded for context) gains a "Search" tab:

- A search bar at the top for semantic queries.
- Results show file + section + similarity score.
- User can pin search results to "force include" for the current session (same as existing context force/exclude system).

---

## 8. Settings & Configuration

### 8.1 config.json Extension

```json
{
  "version": "1.0.0",
  "api_key_encrypted": "...",
  "default_model": "claude-sonnet-4-6",
  "...existing fields...",
  
  "vector_search": {
    "enabled": false,
    "embedding_model": "voyage-4",
    "embedding_api_key_encrypted": "",
    "auto_index": true,
    "max_results_default": 5,
    "max_search_tokens_default": 15000
  }
}
```

**Field definitions:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | bool | `false` | Master toggle. When false, no indexing or searching occurs. Defaults to off — user must opt in. |
| `embedding_model` | string | `"voyage-4"` | Embedding model identifier. Future-proofed for model upgrades. |
| `embedding_api_key_encrypted` | string | `""` | Voyage AI API key (required for embeddings). Must be obtained from https://dash.voyageai.com/. |
| `auto_index` | bool | `true` | When true, files are automatically indexed when modified. When false, user must manually trigger re-indexing. |
| `max_results_default` | int | `5` | Default max results when a skill doesn't specify. |
| `max_search_tokens_default` | int | `15000` | Default token budget for search results. |

### 8.2 Settings UI

A new section in the Settings view, placed after the existing AI section:

```
── Vector Search (Optional) ──────────────────────────

[Toggle: OFF] Enable Vector Search
  Adds semantic search across your project files.
  Requires an active API key. Embedding costs are
  minimal (typically < $0.01 per full novel index).

  When disabled, all features work normally — vector
  search only provides supplementary context for
  supported skills.

[When enabled, show:]

  Voyage AI API Key (required)
  ┌──────────────────────────────────────────────┐
  │ pa-...                            [Change]   │
  └──────────────────────────────────────────────┘
  Get your Voyage API key at dash.voyageai.com

  [Toggle: ON] Auto-index on file changes
    Automatically updates the search index when you
    edit project files. Disable to index manually.

  ── Project Index Status ──
  
  Index: 847 chunks from 142 files
  Last indexed: 2 minutes ago
  Total embedding cost: $0.02
  
  [Re-index Project]  [Clear Index]

  ── Advanced ──
  
  Default max search results: [5 ▾]
  Default search token budget: [15,000 ▾]
```

### 8.3 First-Time Setup Flow

When the user enables vector search for the first time:

1. Toggle switched ON → show confirmation dialog:
   ```
   Enable Vector Search?
   
   This will index your project files using AI embeddings.
   
   • Uses your API key to generate embeddings (~$0.01 for a full novel)
   • Creates a search index in your project's .saipling/ folder  
   • The index can be deleted and rebuilt at any time
   • You can disable this at any time with no data loss
   
   [Enable]  [Cancel]
   ```

2. If confirmed → begin initial indexing:
   - Show a progress indicator ("Indexing: 0/142 files...")
   - Process in batches, update progress bar.
   - On completion: "Index ready! Vector search is now active for supported skills."

3. If the Voyage API key is missing or invalid → show a clear error:
   ```
   Voyage API Key Required
   
   Vector search requires a Voyage AI API key for generating
   embeddings. Get one at dash.voyageai.com (free tier available).
   
   [Enter Voyage API Key]  [Disable Vector Search]
   ```

---

## 9. Rust Implementation

### 9.1 New Crate Dependencies

Add to `src-tauri/Cargo.toml`:

```toml
[dependencies]
# Existing deps...
rusqlite = { version = "0.31", features = ["bundled"] }
sqlite-vec = "0.1"          # sqlite-vec extension for Rust
sha2 = "0.10"               # SHA-256 hashing for change detection
```

> **Note on sqlite-vec:** As of writing, the Rust bindings for sqlite-vec are relatively new. If the crate isn't stable enough, an alternative approach is to compile sqlite-vec as a loadable extension and load it via `rusqlite::Connection::load_extension()`. The implementation should check the ecosystem state at build time and choose the most reliable approach.

### 9.2 Module Structure

```
src-tauri/src/
├── context/
│   ├── assembler.rs         # MODIFIED: add search enrichment step
│   ├── skills.rs            # MODIFIED: add VectorSearchConfig to SkillContext
│   ├── tokens.rs            # Unchanged
│   └── vector/              # NEW: Vector search module
│       ├── mod.rs            # Public API
│       ├── db.rs             # SQLite + sqlite-vec management
│       ├── chunker.rs        # File → chunk splitting logic
│       ├── embeddings.rs     # Voyage API client (behind EmbeddingClient trait)
│       ├── indexer.rs        # Orchestrates chunk → embed → store pipeline
│       └── search.rs         # Query embedding + ANN search + result ranking
├── commands/
│   ├── agent.rs             # MODIFIED: integrate search into planning
│   ├── config.rs            # MODIFIED: add VectorSearchConfig
│   └── vector_search.rs     # NEW: Tauri commands for search UI
```

### 9.3 Key Types

```rust
// context/vector/mod.rs

/// Configuration from config.json
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VectorSearchConfig {
    pub enabled: bool,
    pub embedding_model: String,
    pub embedding_api_key_encrypted: String,
    pub auto_index: bool,
    pub max_results_default: u32,
    pub max_search_tokens_default: u64,
}

impl Default for VectorSearchConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            embedding_model: "voyage-4".to_string(),
            embedding_api_key_encrypted: String::new(),
            auto_index: true,
            max_results_default: 5,
            max_search_tokens_default: 15000,
        }
    }
}

/// Skill-level vector search config from TOML
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillVectorSearchConfig {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default = "default_auto")]
    pub mode: String,                    // "auto" | "always" | "never"
    #[serde(default = "default_max_results")]
    pub max_results: u32,
    #[serde(default = "default_max_search_tokens")]
    pub max_search_tokens: u64,
    #[serde(default)]
    pub filter_entity_types: Vec<String>,
}

/// A single search result returned to the assembler
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub file_path: String,
    pub section_heading: Option<String>,
    pub similarity_score: f32,
    pub content_preview: String,
    pub token_count: u64,
    pub entity_type: Option<String>,
    pub entity_name: Option<String>,
    pub book_id: Option<String>,
}

/// Index status for the settings UI
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexStatus {
    pub total_files: u32,
    pub total_chunks: u32,
    pub last_indexed: Option<String>,
    pub total_cost_usd: f64,
    pub is_indexing: bool,
    pub index_progress: Option<IndexProgress>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexProgress {
    pub files_processed: u32,
    pub files_total: u32,
    pub current_file: String,
}
```

### 9.4 Embedding Client Trait

To keep the embedding provider swappable:

```rust
// context/vector/embeddings.rs

#[async_trait]
pub trait EmbeddingClient: Send + Sync {
    /// Embed a batch of text chunks. Returns one vector per input.
    async fn embed_batch(&self, texts: &[String]) -> Result<Vec<Vec<f32>>, AppError>;
    
    /// Embed a single query. May use a different model/prefix for queries.
    async fn embed_query(&self, query: &str) -> Result<Vec<f32>, AppError>;
    
    /// Returns the dimensionality of the embedding vectors.
    fn dimensions(&self) -> usize;
    
    /// Returns the cost per million tokens for logging.
    fn cost_per_million_tokens(&self) -> f64;
}

pub struct VoyageClient {
    api_key: String,
    model: String,
    http_client: reqwest::Client,
}

impl VoyageClient {
    pub fn new(api_key: String, model: String) -> Self {
        Self {
            api_key,
            model,
            http_client: reqwest::Client::new(),
        }
    }
}

#[async_trait]
impl EmbeddingClient for VoyageClient {
    async fn embed_batch(&self, texts: &[String]) -> Result<Vec<Vec<f32>>, AppError> {
        // POST to https://api.voyageai.com/v1/embeddings
        // model: self.model
        // input: texts
        // input_type: "document"
        todo!()
    }
    
    async fn embed_query(&self, query: &str) -> Result<Vec<f32>, AppError> {
        // Same endpoint but with input_type: "query"
        // Voyage optimizes differently for queries vs documents
        todo!()
    }
    
    fn dimensions(&self) -> usize { 1024 }
    fn cost_per_million_tokens(&self) -> f64 { 0.06 }
}
```

### 9.5 Tauri Commands

```rust
// commands/vector_search.rs

/// Search the project index. Used by chat /search and Context Settings.
/// IMPORTANT: This command must load .context_settings.json and filter out
/// any results where the file is marked "exclude". This applies to both
/// skill-driven searches and user-initiated /search commands.
#[tauri::command]
pub async fn vector_search(
    project_dir: PathBuf,
    query: String,
    max_results: Option<u32>,
    filter_entity_types: Option<Vec<String>>,
    filter_book_id: Option<String>,
    respect_context_settings: Option<bool>,  // Default true. Set false only for Settings UI browsing.
) -> Result<Vec<SearchResult>, AppError> { ... }

/// Get the current index status for the Settings UI.
#[tauri::command]
pub async fn get_index_status(
    project_dir: PathBuf,
) -> Result<IndexStatus, AppError> { ... }

/// Trigger a full re-index of the project.
#[tauri::command]
pub async fn reindex_project(
    app: tauri::AppHandle,
    project_dir: PathBuf,
) -> Result<(), AppError> { ... }

/// Clear the index completely.
#[tauri::command]
pub async fn clear_index(
    project_dir: PathBuf,
) -> Result<(), AppError> { ... }

/// Index a single file (called by file watcher integration).
#[tauri::command]
pub async fn index_file(
    project_dir: PathBuf,
    file_path: PathBuf,
) -> Result<(), AppError> { ... }

/// Remove a file from the index (called when file is deleted).
#[tauri::command]
pub async fn deindex_file(
    project_dir: PathBuf,
    file_path: PathBuf,
) -> Result<(), AppError> { ... }
```

### 9.6 File Watcher Integration

The existing `start_file_watcher` command already watches for file changes. Add vector indexing to the watcher callback:

```rust
// In the file watcher event handler (existing code):

match event.kind {
    EventKind::Modify(_) | EventKind::Create(_) => {
        // Existing: invalidate summary cache
        // ...
        
        // NEW: track for vector indexing with debounce
        // Each save resets the file's quiet-period timer.
        // The background task only embeds once the file has been
        // unmodified for 2 minutes (see section 5.2).
        if vector_search_enabled() {
            if let Ok(mut pending) = PENDING_FILES.lock() {
                pending.insert(path.clone(), Instant::now());
            }
        }
    }
    EventKind::Remove(_) => {
        // NEW: remove from index immediately (no debounce for deletions)
        if vector_search_enabled() {
            if let Ok(mut pending) = PENDING_FILES.lock() {
                pending.remove(&path);
            }
            if let Ok(mut deleted) = DELETED_FILES.lock() {
                deleted.push(path.clone());
            }
        }
    }
}
```

The index queue is processed by a background tokio task that applies a per-file quiet period before embedding (see section 5.2). Files are only embedded once they've been unmodified for 2 minutes, preventing wasteful re-embeds during active writing sessions where auto-save fires every 30 seconds. File deletions are processed immediately.

---

## 10. Modified Skill Definition Struct

Update `SkillContext` in `context/skills.rs`:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillContext {
    #[serde(default)]
    pub always_include: Vec<String>,
    #[serde(default)]
    pub when_book: Option<SkillContextWhen>,
    #[serde(default)]
    pub optional: Option<SkillContextOptional>,
    #[serde(default)]
    pub max_context_tokens: u64,
    #[serde(default)]                                    // NEW
    pub vector_search: Option<SkillVectorSearchConfig>,   // NEW
}
```

This is backward compatible — skills without `[context.vector_search]` in their TOML will have `vector_search: None`, and behavior is unchanged.

---

## 11. Frontend Changes

### 11.1 New TypeScript Types

```typescript
// types/vectorSearch.ts

export interface VectorSearchConfig {
  enabled: boolean;
  embedding_model: string;
  embedding_api_key_encrypted: string;
  auto_index: boolean;
  max_results_default: number;
  max_search_tokens_default: number;
}

export interface SearchResult {
  file_path: string;
  section_heading: string | null;
  similarity_score: number;
  content_preview: string;
  token_count: number;
  entity_type: string | null;
  entity_name: string | null;
  book_id: string | null;
}

export interface IndexStatus {
  total_files: number;
  total_chunks: number;
  last_indexed: string | null;
  total_cost_usd: number;
  is_indexing: boolean;
  index_progress: IndexProgress | null;
}

export interface IndexProgress {
  files_processed: number;
  files_total: number;
  current_file: string;
}
```

### 11.2 Updated AppConfig Type

```typescript
// In utils/tauri.ts — extend AppConfig:

export interface AppConfig {
  // ...existing fields...
  vector_search: VectorSearchConfig;
}
```

### 11.3 New Tauri Invoke Bindings

```typescript
// In utils/tauri.ts:

export const vectorSearch = (
  projectDir: string, 
  query: string, 
  maxResults?: number,
  filterEntityTypes?: string[],
  filterBookId?: string,
  respectContextSettings?: boolean,  // Default true. Pass false for Settings UI search tab.
) => invoke<SearchResult[]>('vector_search', { 
  projectDir, query, maxResults, filterEntityTypes, filterBookId, 
  respectContextSettings: respectContextSettings ?? true,
});

export const getIndexStatus = (projectDir: string) =>
  invoke<IndexStatus>('get_index_status', { projectDir });

export const reindexProject = (projectDir: string) =>
  invoke<void>('reindex_project', { projectDir });

export const clearIndex = (projectDir: string) =>
  invoke<void>('clear_index', { projectDir });
```

### 11.4 UI Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `VectorSearchSettings` | `components/Settings/VectorSearchSettings.tsx` | Toggle, API key, index status, re-index button |
| `SearchResultsList` | `components/AIChat/SearchResultsList.tsx` | Renders /search results in chat |
| `PlanSearchResults` | `components/AIChat/PlanSearchResults.tsx` | Shows search results in plan confirmation, with remove buttons |
| `ContextSearchTab` | `components/ContextSettings/ContextSearchTab.tsx` | Search bar + results in Context Settings panel |

---

## 12. Technical Stack Additions

Add to SPEC section 13.2 (Tauri / Rust Backend):

| Technology | Version | Purpose |
|------------|---------|---------|
| rusqlite | 0.31+ | SQLite database access (bundled) |
| sqlite-vec | 0.1+ | Vector similarity search extension |
| sha2 | 0.10 | Content hashing for change detection |

Add to SPEC section 13.3 (External Dependencies):

| Tool | Purpose | Notes |
|------|---------|-------|
| Voyage AI API | Text embeddings | Uses Anthropic API key (or separate Voyage key). Optional — only when vector search enabled. |

---

## 13. Edge Cases & Error Handling

### 13.1 API Key Issues

| Scenario | Behavior |
|----------|----------|
| No API key set | Vector search toggle disabled in settings with tooltip: "Requires an API key" |
| API key doesn't support embeddings | Show error on first use, offer to enter Voyage key or disable |
| API rate limited during indexing | Retry with exponential backoff (max 3 retries), then pause indexing with notification |
| API key revoked mid-session | Catch error, disable auto-indexing, notify user in settings |

### 13.2 Index Integrity

| Scenario | Behavior |
|----------|----------|
| index.db is corrupted | Detect on open (SQLite integrity check), offer to rebuild |
| index.db is deleted | Detect on next query, offer to re-index |
| File deleted but still in index | Caught by file watcher → deindex. Backup: query results validate file exists on disk before returning |
| File renamed | File watcher sees delete + create → deindex old path, index new path |
| Project moved to new location | Index uses relative paths, so it should still work. If not, re-index. |
| Embedding model upgraded | New model produces different vectors. On model change, clear and re-index. |

### 13.3 Performance

| Scenario | Mitigation |
|----------|-----------|
| Large project initial index | Background processing with progress bar. UI remains responsive. |
| Auto-save during active writing (every 30s) | Per-file 2-minute quiet period. File is only embedded once the user stops editing it. Zero wasted API calls during active writing. |
| Many files changing at once (e.g., git checkout) | Per-file debounce: each file is embedded 2 min after its last change, in batches of 128 |
| Search query during indexing | Query works on whatever is already indexed. Results may be incomplete — show indicator. |
| SQLite contention (read during write) | WAL mode enabled by default. Reads don't block writes. |

---

## 14. Implementation Priority

This feature should be implemented **after** the core application is fully functional. The following order is recommended:

1. **Phase 1: SQLite foundation** — Create the database schema, chunker, and basic CRUD. No embeddings yet — just the infrastructure.
2. **Phase 2: Embedding pipeline** — Implement VoyageClient, batch embedding, cost tracking. Test with a sample project.
3. **Phase 3: Search query** — Implement sqlite-vec queries, result ranking, file loading. Test with /search command in chat.
4. **Phase 4: Assembler integration** — Wire into the Context Assembler's new step 5b. Update plan preview UI.
5. **Phase 5: Settings UI** — Build the VectorSearchSettings component, index status display, re-index flow.
6. **Phase 6: Auto-indexing** — Integrate with file watcher for real-time index updates.

Each phase is independently testable and the app works without later phases being complete.

---

## 15. Developer Implementation Guide — Codebase Integration Points

This section maps every change to exact files in the current `TenVexAI/saipling-rust-app` codebase (as of the latest `main` branch). This is the implementation checklist.

### 15.1 Cargo.toml Changes

**File:** `src-tauri/Cargo.toml`

The current dependencies section ends with `trash = "5"`. Add the following:

```toml
# Vector Search (optional feature)
rusqlite = { version = "0.31", features = ["bundled"] }
sha2 = "0.10"
async-trait = "0.1"
```

**Note on sqlite-vec:** The `sqlite-vec` Rust crate (`sqlite-vec = "0.1"`) should be added if stable bindings exist at implementation time. If not, compile `sqlite-vec` as a loadable SQLite extension and load it via `rusqlite::Connection::load_extension()`. Check https://github.com/asg017/sqlite-vec for the latest Rust integration status. If using the loadable extension approach, the compiled `.dll`/`.so` must be bundled with the app in `src-tauri/resources/` and the Tauri config must include it in bundle resources.

### 15.2 Error Variants

**File:** `src-tauri/src/error.rs`

Add new variants to the existing `AppError` enum:

```rust
#[error("Vector search error: {0}")]
VectorSearch(String),

#[error("Embedding error: {0}")]
Embedding(String),

#[error("Index error: {0}")]
IndexError(String),

#[error("SQLite error: {0}")]
Sqlite(#[from] rusqlite::Error),
```

### 15.3 AppConfig Extension

**File:** `src-tauri/src/commands/config.rs`

Add the `VectorSearchConfig` struct and add it to `AppConfig`:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VectorSearchConfig {
    pub enabled: bool,
    pub embedding_model: String,
    #[serde(default)]
    pub embedding_api_key_encrypted: String,
    pub auto_index: bool,
    pub max_results_default: u32,
    pub max_search_tokens_default: u64,
}

impl Default for VectorSearchConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            embedding_model: "voyage-4".to_string(),
            embedding_api_key_encrypted: String::new(),
            auto_index: true,
            max_results_default: 5,
            max_search_tokens_default: 15000,
        }
    }
}
```

Then add to the `AppConfig` struct (after `custom_theme_colors`):

```rust
#[serde(default)]
pub vector_search: VectorSearchConfig,
```

And in `impl Default for AppConfig`, add:

```rust
vector_search: VectorSearchConfig::default(),
```

Because `#[serde(default)]` is used, existing `config.json` files without the `vector_search` field will deserialize correctly using the defaults. No migration needed.

### 15.4 SkillContext Extension

**File:** `src-tauri/src/context/skills.rs`

Add the `SkillVectorSearchConfig` struct:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillVectorSearchConfig {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default = "default_auto_mode")]
    pub mode: String,
    #[serde(default = "default_max_results")]
    pub max_results: u32,
    #[serde(default = "default_max_search_tokens")]
    pub max_search_tokens: u64,
    #[serde(default)]
    pub filter_entity_types: Vec<String>,
}

fn default_auto_mode() -> String { "auto".to_string() }
fn default_max_results() -> u32 { 5 }
fn default_max_search_tokens() -> u64 { 15000 }
```

Then add to the existing `SkillContext` struct:

```rust
#[serde(default)]
pub vector_search: Option<SkillVectorSearchConfig>,
```

Existing `.toml` skill files without `[context.vector_search]` will deserialize with `vector_search: None`. No changes to existing skill files are needed initially.

> **Important:** There is a hardcoded fallback `SkillContext` construction in `src-tauri/src/commands/agent.rs` (around line 194) used when a skill TOML fails to load. This must be updated to include `vector_search: None` to match the new struct definition.

### 15.5 New Module Structure

**Create these new files:**

```
src-tauri/src/context/vector/
├── mod.rs            # pub mod db; pub mod chunker; etc. + public API
├── db.rs             # SQLite connection, schema init, CRUD
├── chunker.rs        # .md file → chunks splitting
├── embeddings.rs     # EmbeddingClient trait + VoyageClient
├── indexer.rs        # Orchestrates: chunk → embed → store
└── search.rs         # Query embedding → ANN search → results
```

**File:** `src-tauri/src/context/mod.rs` — Add `pub mod vector;`

**Create:** `src-tauri/src/commands/vector_search.rs` — The Tauri command handlers.

### 15.6 Tauri Command Registration

**File:** `src-tauri/src/lib.rs`

The current `generate_handler!` macro lists all commands. Add the new vector search commands to it:

```rust
use commands::{
    project, book, filesystem, draft, attachment, chapter, matter,
    agent as agent_cmd, config, models, export,
    vector_search as vs_cmd,  // NEW
};

// Inside generate_handler![...]:
// Vector Search
vs_cmd::vector_search,
vs_cmd::get_index_status,
vs_cmd::reindex_project,
vs_cmd::clear_index,
```

Also add the module declaration at the top of `lib.rs` if `commands/vector_search.rs` is a new submodule — ensure `mod commands` includes it (check how commands are organized, likely via `src-tauri/src/commands/mod.rs`).

### 15.7 File Watcher Integration

**File:** `src-tauri/src/watcher.rs`

The current watcher uses `std::mem::forget` to keep the watcher alive and emits Tauri events from a closure. To add index queue support:

1. Create a global pending-files tracker (similar to the existing `ACTIVE_PLANS` pattern in `agent.rs`):

```rust
use once_cell::sync::Lazy;
use std::sync::Mutex;
use std::time::Instant;

/// Tracks files that have been modified but not yet re-embedded.
/// Key: file path, Value: timestamp of most recent modification.
/// Each new modification resets the timestamp, implementing the quiet-period debounce.
static PENDING_FILES: Lazy<Mutex<HashMap<PathBuf, Instant>>> = Lazy::new(|| Mutex::new(HashMap::new()));

/// Files that have been deleted and need their index entries removed.
/// Deletions bypass the debounce and are processed on the next tick.
static DELETED_FILES: Lazy<Mutex<Vec<PathBuf>>> = Lazy::new(|| Mutex::new(Vec::new()));
```

2. In the watcher closure, after the existing `emit` calls, update the tracker:

```rust
EventKind::Modify(_) | EventKind::Create(_) => {
    // Existing emit code...
    
    // NEW: track for vector indexing (resets debounce timer on each save)
    if vector_search_enabled() {
        if let Ok(mut pending) = PENDING_FILES.lock() {
            pending.insert(PathBuf::from(path), Instant::now());
        }
    }
}
EventKind::Remove(_) => {
    // Existing emit code...
    
    // NEW: queue for immediate deindexing (no debounce for deletions)
    if vector_search_enabled() {
        // Remove from pending in case it was waiting to be embedded
        if let Ok(mut pending) = PENDING_FILES.lock() {
            pending.remove(&PathBuf::from(path));
        }
        if let Ok(mut deleted) = DELETED_FILES.lock() {
            deleted.push(PathBuf::from(path));
        }
    }
}
```

3. A separate background tokio task (spawned when vector search is enabled) runs every 10 seconds. It checks `PENDING_FILES` for entries where `Instant::now() - last_modified > 2 minutes`, drains those into an embedding batch, and processes them. `DELETED_FILES` is drained and processed immediately on every tick. This task should check the global config to see if vector search is enabled before doing any work.

**Why this matters:** The app auto-saves every 30 seconds. Without the 2-minute quiet period, each auto-save would re-embed the file. With it, files are only embedded once the user has stopped editing them — preventing ~120 pointless API calls per hour of active writing.

### 15.8 Agent Plan Extension

**File:** `src-tauri/src/commands/agent.rs`

The existing `AgentPlan` struct needs the `search_results` field. Add:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResultInfo {
    pub file_path: String,
    pub section: Option<String>,
    pub similarity_score: f32,
    pub tokens_est: u64,
    pub content_preview: String,
}
```

Then add to `AgentPlan`:

```rust
pub struct AgentPlan {
    // ...existing fields...
    #[serde(default)]
    pub search_results: Vec<SearchResultInfo>,  // NEW
}
```

In the `agent_plan` function, after context assembly, add the vector search enrichment step (only if enabled). The search results get appended to the plan for user review.

### 15.9 Context Assembler Modification

**File:** `src-tauri/src/context/assembler.rs`

After the existing step that loads optional files (the `// 3. Optional files` block), add a new step for vector search enrichment. This step should:

1. Check if `skill.context.vector_search` is `Some` and `enabled`
2. Check if the global `VectorSearchConfig.enabled` is `true`
3. If `mode == "always"` or `mode == "auto"` (with agent heuristic), run the search
4. Load `.context_settings.json` from the project root and parse it into a `HashMap<String, String>` (path → "exclude"/"force"). The file may not exist (new projects) — treat missing file as empty map.
5. Call the search module with the user's message as the query
6. Filter out results where the file path is `"exclude"` in context settings
7. Filter out files already in `loaded_canonical` (handles both dedup and `"force"` files that are already loaded)
8. Add results within the `max_search_tokens` budget
9. Use a distinct delimiter: `"--- {} (SEARCH: {}) ---"` showing the matched section

**Context settings helpers already exist in `assembler.rs`:**

The `load_context_settings()` and `is_excluded()` functions are already implemented in `src-tauri/src/context/assembler.rs`. They handle path normalization (backslash → forward-slash) and loading from `.context_settings.json`. **Make these `pub` so the vector search module can reuse them.** Do NOT duplicate this logic.

```rust
// In assembler.rs — change from private to public:
pub fn load_context_settings(project_dir: &PathBuf) -> HashMap<String, String> { ... }
pub fn is_excluded(rel_path: &str, settings: &HashMap<String, String>) -> bool { ... }
```

The vector search module imports and calls these directly:
```rust
use crate::context::assembler::{load_context_settings, is_excluded};
```

### 15.10 Frontend TypeScript Changes

**File:** `src/utils/tauri.ts`

Add to the `AppConfig` interface:

```typescript
vector_search: {
  enabled: boolean;
  embedding_model: string;
  embedding_api_key_encrypted: string;
  auto_index: boolean;
  max_results_default: number;
  max_search_tokens_default: number;
};
```

Add invoke bindings (see spec section 11.3).

**File:** `src/components/Settings/SettingsView.tsx`

Add a new section for Vector Search settings after the existing AI/Theme sections. Follow the same pattern as the existing sections (uses `getConfig`/`updateConfig`).

### 15.11 Project-Level Index Storage

The `index.db` file lives inside each project directory, NOT in the application-level `.saipling/` config directory. The current project structure has no hidden directory, so create one:

```
my-project/
├── .saipling/              # NEW: project-level config/cache
│   └── index.db            # Vector search index
├── project.json
├── overview/
├── characters/
├── world/
├── notes/
└── books/
```

**Important:** Add `.saipling/` to the default `.gitignore` template that's generated when creating new projects (in `src-tauri/src/commands/project.rs`, check `create_project`).

Also ensure the Context Settings file tree (in `ContextSettings.tsx`) filters out the `.saipling/` directory. The current code already filters entries starting with `.`:

```typescript
const isHidden = entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'exports';
```

This will automatically hide `.saipling/`.

### 15.12 Voyage API Network Access

The Voyage AI API endpoint is `https://api.voyageai.com/v1/embeddings`. The current `tauri.conf.json` has `"csp": null` (no restrictions), so no CSP or allowlist changes are needed for Voyage API access.

If Anthropic later provides embeddings through `api.anthropic.com` directly, the `EmbeddingClient` trait abstraction allows swapping without code changes beyond the client implementation.

### 15.13 Frontend Event Listeners for Index Progress

**File:** `src/hooks/useFileWatcher.ts`

Add listeners for new indexing events emitted from the Rust backend:

```typescript
// NEW: Vector search indexing events
const u4 = await listen<{ files_processed: number; files_total: number; current_file: string }>(
  'vector:indexing_progress', (event) => {
    // Update a Zustand store with indexing progress for the Settings UI
  }
);
unlisteners.push(u4);

const u5 = await listen<{ total_files: number; total_chunks: number }>(
  'vector:indexing_complete', () => {
    // Clear progress state
  }
);
unlisteners.push(u5);
```

### 15.14 Existing Patterns to Follow

For consistency, the developer should follow these patterns already established in the codebase:

| Pattern | Example in Codebase | Apply To |
|---------|-------------------|----------|
| Global state via `once_cell::Lazy<Mutex<>>` | `ACTIVE_PLANS` in `agent.rs` | Index queue, DB connection pool |
| Tauri event emission | `app_handle.emit("fs:file_changed", ...)` in `watcher.rs` | Index progress events |
| Config with `#[serde(default)]` | `skill_overrides` in `AppConfig` | `vector_search` field |
| Streaming cost tracking | `calculateCost()` in `modelPricing.ts` | Embedding cost display |
| Plan confirmation UI | `AgentPlanCard` component | Search results in plan preview |
| Settings section layout | Existing sections in `SettingsView.tsx` | Vector Search settings section |
| Skill override pattern | `SkillOverride` in `config.rs` | Per-skill vector search config |

### 15.15 Files Changed Summary

**Rust files modified:**
- `src-tauri/Cargo.toml` — new dependencies
- `src-tauri/src/error.rs` — new error variants
- `src-tauri/src/lib.rs` — register new commands
- `src-tauri/src/commands/config.rs` — VectorSearchConfig + AppConfig extension
- `src-tauri/src/context/skills.rs` — SkillVectorSearchConfig + SkillContext extension
- `src-tauri/src/context/assembler.rs` — search enrichment step
- `src-tauri/src/context/mod.rs` — add `pub mod vector`
- `src-tauri/src/commands/agent.rs` — SearchResultInfo + AgentPlan extension
- `src-tauri/src/watcher.rs` — index queue integration

**Rust files created:**
- `src-tauri/src/context/vector/mod.rs`
- `src-tauri/src/context/vector/db.rs`
- `src-tauri/src/context/vector/chunker.rs`
- `src-tauri/src/context/vector/embeddings.rs`
- `src-tauri/src/context/vector/indexer.rs`
- `src-tauri/src/context/vector/search.rs`
- `src-tauri/src/commands/vector_search.rs`

**TypeScript files modified:**
- `src/utils/tauri.ts` — AppConfig type + new invoke bindings
- `src/hooks/useFileWatcher.ts` — indexing event listeners
- `src/components/Settings/SettingsView.tsx` — new Vector Search section

**TypeScript files created:**
- `src/types/vectorSearch.ts` — TypeScript types
- `src/components/Settings/VectorSearchSettings.tsx`
- `src/components/AIChat/SearchResultsList.tsx`
- `src/components/AIChat/PlanSearchResults.tsx`
- `src/components/ContextSettings/ContextSearchTab.tsx`

**Skill TOML files modified (add `[context.vector_search]` blocks):**
- `src-tauri/skills/brainstorm.toml`
- `src-tauri/skills/consistency_checker.toml`
- `src-tauri/skills/prose_writer.toml`
- `src-tauri/skills/prose_editor.toml`
- `src-tauri/skills/scene_architect.toml`
- `src-tauri/skills/character_developer.toml`
- `src-tauri/skills/world_builder.toml`
- `src-tauri/skills/researcher.toml`
- `src-tauri/skills/relationship_mapper.toml`
- `src-tauri/skills/series_arc_planner.toml`
- `src-tauri/skills/overview_generator.toml`
