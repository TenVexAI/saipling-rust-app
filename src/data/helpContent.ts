/**
 * Help content for the SAiPLING Help window.
 *
 * EDITING GUIDE:
 * - Each top-level entry in HELP_SECTIONS is a collapsible section in the Help window.
 * - Each section can have `subsections` which are also collapsible.
 * - Use `id` fields for deep-linking (e.g. openHelpWindow('phase-2-new-reality')).
 * - `content` is plain text rendered with basic formatting (newlines → <br>, **bold**, *italic*).
 * - `bullets` is an optional array of bullet-point strings.
 * - `table` is an optional array of { label, desc } for structured info.
 */

export interface HelpSubsection {
  id: string;
  title: string;
  content: string;
  bullets?: string[];
  table?: { label: string; desc: string }[];
  subsections?: HelpSubsection[];
}

export interface HelpSection {
  id: string;
  title: string;
  content: string;
  bullets?: string[];
  table?: { label: string; desc: string }[];
  subsections?: HelpSubsection[];
}

// ────────────────────────────────────────────────────────
// Section 1: How to Use SAiPLING
// ────────────────────────────────────────────────────────
const howToUse: HelpSection = {
  id: 'how-to-use',
  title: 'How to Use SAiPLING',
  content:
    'SAiPLING is an AI-assisted novel-writing desktop application that guides you through the entire process of creating a novel — from the initial spark of an idea to a complete draft manuscript. Here is a basic walkthrough of the intended workflow.',
  subsections: [
    {
      id: 'getting-started',
      title: 'Getting Started',
      content:
        'When you first open SAiPLING, you\'ll see the Welcome screen. From here you can create a new project or open an existing one.',
      bullets: [
        'Click "Create New Project" to start fresh. Give your project a name, choose a genre (optional), and select a folder on your computer where the project files will be stored.',
        'Click "Open Existing Project" to resume work on a project you\'ve already started.',
        'Your recent projects will appear on the Welcome screen for quick access.',
        'Once inside a project, use keyboard shortcuts to navigate quickly — see the Keyboard Shortcuts section for a full list.',
      ],
    },
    {
      id: 'setting-up-api-key',
      title: 'Setting Up Your API Key',
      content:
        'Before you can use the AI features, you\'ll need to configure your Anthropic API key. Go to Settings (gear icon in the sidebar) and paste your API key. See the "Anthropic API Key" section of this help guide for detailed instructions on obtaining a key.',
    },
    {
      id: 'the-five-phases',
      title: 'The Five-Phase Workflow',
      content:
        'SAiPLING uses the Sapling Method to guide you through five phases of novel development. Each phase builds on the previous one, creating layers of depth and structure. You\'ll see the phase progress bar at the bottom of the main content area — click any phase to enter its workflow.',
      bullets: [
        'Phase 1: Seed — Define your story\'s core idea (premise, theme, protagonist, conflict, world, emotional promise).',
        'Phase 2: Root — Build the architectural blueprint using a 21-beat story structure across three acts.',
        'Phase 3: Sprout — Map character journeys and relationships using an 8-stage character arc cycle.',
        'Phase 4: Flourish — Break your story into individual scenes, alternating between Action and Reaction types.',
        'Phase 5: Bloom — Write the actual prose, scene by scene, with AI assistance for drafting and refinement.',
      ],
    },
    {
      id: 'using-the-ai-chat',
      title: 'Using the AI Chat Panel',
      content:
        'The AI chat panel on the right side of the app is your creative partner. It adapts its behavior based on the phase you\'re working in. You can ask questions, request suggestions, or have it help generate content. The AI always has context about your project — your story foundation, structure, characters, and scenes — so its suggestions are tailored to your specific story.',
      bullets: [
        'Type your message in the text box at the bottom and press Enter or click Send.',
        'The AI skill selector at the top of the chat panel lets you switch between different AI capabilities.',
        'Your conversation is preserved as you navigate between views within the same session.',
        'Click "Clear Conversation" to start fresh if needed.',
        'Use Ctrl+Shift+D to jump back to the Dashboard at any time.',
      ],
    },
    {
      id: 'using-the-editor',
      title: 'Writing in the Editor',
      content:
        'When you open a scene or any markdown file, the prose editor opens in the main content area. It includes a formatting toolbar, auto-save, and word count tracking.',
      bullets: [
        'Use the toolbar for bold, italic, headings, lists, and other formatting.',
        'Select text to see the inline AI toolbar with options to Rewrite, Shorten, Expand, Improve, or Continue.',
        'Press Ctrl+S to save manually, or rely on the 30-second auto-save.',
        'Press Ctrl+Shift+F to enter Focus Mode for distraction-free writing. The window will automatically maximize.',
        'Press Ctrl+Shift+N to instantly create a new note — great for jotting down ideas mid-writing.',
      ],
    },
    {
      id: 'exporting-your-work',
      title: 'Exporting Your Work',
      content:
        'When you\'re ready to export, open the Book view and click the "Export" button in the header. You can export in multiple formats.',
      bullets: [
        'Markdown — plain text, universal format. No extra software needed.',
        'Word (DOCX) — for agents and editors. Requires Pandoc installed on your system.',
        'PDF — print-ready manuscript. Requires Pandoc and a LaTeX engine (XeLaTeX).',
        'ePub — e-reader format. Requires Pandoc.',
        'LaTeX — for full typesetting control. Requires Pandoc.',
      ],
    },
    {
      id: 'focus-mode',
      title: 'Focus Mode',
      content:
        'Focus Mode strips away all UI chrome — sidebar, chat panel, toolbar, title bar, and footer — leaving only the editor and a minimal status bar. This is ideal for when you want to concentrate purely on writing.',
      bullets: [
        'Toggle with Ctrl+Shift+F or F11.',
        'The window automatically maximizes when entering Focus Mode.',
        'Word count remains visible at the bottom left.',
        'A subtle hint at the bottom right reminds you how to exit.',
        'If you want to un-maximize the window while staying in Focus Mode, press Win+Down Arrow.',
      ],
    },
  ],
};

// ────────────────────────────────────────────────────────
// Section 2: The Sapling Method
// ────────────────────────────────────────────────────────
const saplingMethod: HelpSection = {
  id: 'sapling-method',
  title: 'The Sapling Method',
  content:
    'The Sapling Story Structure Framework is SAiPLING\'s methodology for developing a novel from a single spark of an idea into a fully realized, structurally sound narrative. It works on a simple but powerful principle: stories are built in layers, from the most abstract and foundational down to the most granular and detailed. Each layer provides the context and constraints for the next, so that by the time you\'re crafting individual paragraphs, every word is supported by a deeply developed foundation of character, world, structure, and theme.\n\nThe framework is named after its metaphor — a sapling growing from seed to full bloom — and each phase corresponds to a stage of that growth. Every phase is designed as a collaboration between you and the AI. You drive creative decisions; the AI helps surface options, maintain consistency, and manage complexity.',
  subsections: [
    {
      id: 'phase-1-seed',
      title: 'Phase 1: Seed — Story Foundation',
      content:
        'The Seed Phase is where the entire story begins. You arrive with an idea — sometimes fully formed, sometimes just a feeling or an image — and work with the AI to crystallize it into six Core Elements that define the story at its most essential level.\n\nThe deliverable is a Story Foundation Document — a concise reference that every subsequent phase builds upon.\n\nMost stories that fall apart do so because they were never clear about what they were at their core. The Seed Phase prevents this by forcing clarity before complexity.',
      table: [
        { label: 'Central Premise', desc: 'A single sentence that captures the entire story — the elevator pitch, the logline, the DNA of the narrative.' },
        { label: 'Theme Statement', desc: 'The fundamental truth the story explores. What the story is really about beyond the plot.' },
        { label: 'Protagonist Profile', desc: 'The essential traits — who they are at their core, what they want, what they need, and their defining flaw.' },
        { label: 'Central Conflict', desc: 'The primary opposition to the protagonist\'s desires. The engine that drives the entire plot.' },
        { label: 'Story World Fundamentals', desc: 'The basic rules and unique elements of the setting that make the world distinctive.' },
        { label: 'Emotional Promise', desc: 'What the reader will feel by the end — the contract between author and reader.' },
      ],
    },
    {
      id: 'phase-2-root',
      title: 'Phase 2: Root — Story Structure',
      content:
        'The Root Phase takes the Core Elements from the Seed Phase and builds the architectural blueprint of the story. This is where the plot gets its skeleton — the major beats, turning points, and act structure that carry the narrative from beginning to end.\n\nThe framework uses a 21-beat structure divided across three acts, drawing on proven storytelling principles (Three-Act Structure, Save the Cat, the Hero\'s Journey) while remaining flexible for creative variation.\n\nThe deliverable is a Story Structure Outline — a beat-by-beat roadmap of the entire plot.',
      subsections: [
        {
          id: 'phase-2-act-one',
          title: 'Act One: The Known World (~25%)',
          content:
            'This act establishes the protagonist\'s ordinary life, disrupts it, and pushes them into the unknown.',
          table: [
            { label: 'Opening Image', desc: 'First impression of protagonist and world — sets tone, mood, and expectations.' },
            { label: 'Daily Life', desc: 'Protagonist\'s routine existence — shows who the character is before the story changes them.' },
            { label: 'Inciting Incident', desc: 'Event that disrupts the status quo — the thing that makes this day different from every other day.' },
            { label: 'Reluctance Moment', desc: 'Protagonist resists the call to change — shows attachment to their current life/identity.' },
            { label: 'Point of Departure', desc: 'Commitment to the journey — the decision or forced circumstance that launches the story.' },
            { label: 'First Challenge', desc: 'Initial test of protagonist\'s abilities — early taste of what they\'re up against.' },
            { label: 'End of Known World', desc: 'Final break from familiar territory — the door closes behind them.' },
          ],
        },
        {
          id: 'phase-2-act-two',
          title: 'Act Two: The Unknown World (~50%)',
          content:
            'The longest act. The protagonist navigates a changed reality, builds alliances, faces escalating challenges, and approaches the ultimate test.',
          table: [
            { label: 'New Reality', desc: 'Adjustment to changed circumstances — learning the rules of the new situation.' },
            { label: 'Initial Progress', desc: 'First successes in the new world — early wins that build confidence and reader investment.' },
            { label: 'Strengthening Allies', desc: 'Building relationships and support — deepening the character web.' },
            { label: 'Midpoint Shift', desc: 'Major revelation or change in direction — the story pivots and everything changes.' },
            { label: 'Growing Opposition', desc: 'Escalating conflicts and challenges — stakes rise, enemies strengthen, complications multiply.' },
            { label: 'Moment of Doubt', desc: 'Crisis of confidence — the character questions whether they can or should succeed.' },
            { label: 'Renewed Determination', desc: 'Recommitment to the goal — something reignites the character\'s drive.' },
            { label: 'Ultimate Challenge', desc: 'The approach to the final test — all threads converging toward the climax.' },
          ],
        },
        {
          id: 'phase-2-act-three',
          title: 'Act Three: The Transformed World (~25%)',
          content:
            'The story reaches its climax and resolves. The character is transformed by their journey.',
          table: [
            { label: 'Darkest Moment', desc: 'All seems lost — the lowest point with maximum despair before the turn.' },
            { label: 'Final Decision', desc: 'Ultimate choice that defines the protagonist — the thematic heart of the story.' },
            { label: 'Climactic Confrontation', desc: 'Direct face-off with the central conflict — the scene the entire story has been building toward.' },
            { label: 'Resolution', desc: 'Outcome of the confrontation — what happens as a result of the climax.' },
            { label: 'Transformed Reality', desc: 'New status quo after the journey — the world changed by everything that happened.' },
            { label: 'Closing Image', desc: 'Final impression showing change — mirrors the Opening Image to show how far the character has come.' },
          ],
        },
      ],
    },
    {
      id: 'phase-3-sprout',
      title: 'Phase 3: Sprout — Character Journeys',
      content:
        'The Sprout Phase maps the internal journeys of the characters — primarily the protagonist, but also key supporting characters. While the Root Phase defines what happens in the plot, the Sprout Phase defines what happens inside the characters as a result.\n\nThis phase uses an 8-point Character Journey Cycle that tracks a character\'s transformation from start to finish. The cycle maps onto the 21-beat structure — Comfort Zone aligns with Opening Image and Daily Life, Desire Emerges with the Inciting Incident, and so on.\n\nThe deliverable is a Character Journey Map for each significant character and a Relationship Dynamics Document.',
      table: [
        { label: 'Comfort Zone', desc: 'Character\'s initial state of being — worldview, habits, limitations before the story starts.' },
        { label: 'Desire Emerges', desc: 'Recognition of want or need — what they become aware they\'re lacking.' },
        { label: 'Crossing Threshold', desc: 'Entering unfamiliar territory — stepping outside what\'s safe and known.' },
        { label: 'Adaptation', desc: 'Learning new rules and skills — how they grow in capability and what it costs them.' },
        { label: 'Trials and Allies', desc: 'Facing challenges and building connections — relationships and conflicts that shape the journey.' },
        { label: 'Supreme Ordeal', desc: 'Confronting greatest fear or obstacle — the moment that breaks or remakes them.' },
        { label: 'Transformation', desc: 'Fundamental change in character — who they become as a result of everything.' },
        { label: 'Return with Gifts', desc: 'Bringing new wisdom or abilities back — how their transformation affects the world.' },
      ],
    },
    {
      id: 'phase-4-flourish',
      title: 'Phase 4: Flourish — Scene Construction',
      content:
        'The Flourish Phase breaks the broad strokes of structure and character into individual scenes — the actual building blocks the reader will experience. Scenes alternate between two types, creating a natural rhythm of tension and release.\n\nThe deliverable is a Complete Scene Outline — every scene in order, typed (Action or Reaction), with goals, conflicts, outcomes, and notes.',
      table: [
        { label: 'Action Scenes', desc: 'Character pursues a goal → obstacles arise and escalate → outcome crisis creates a new problem.' },
        { label: 'Reaction Scenes', desc: 'Emotional response to what just happened → consideration of options → new direction leading to next action.' },
      ],
    },
    {
      id: 'phase-5-bloom',
      title: 'Phase 5: Bloom — Paragraph Craft',
      content:
        'The Bloom Phase is where you\'re actually writing prose — composing the paragraphs that make up each scene. The framework provides a four-beat pattern for constructing engaging paragraphs. This pattern isn\'t rigid — it\'s a default rhythm you can vary for effect.\n\nThe deliverable is the actual manuscript — draft prose for every scene, ready for revision and polish.',
      table: [
        { label: 'External Stimulus', desc: 'Something happens in the story world — an event, sound, dialogue, or change in environment.' },
        { label: 'Internal Response', desc: 'The viewpoint character\'s thoughts, feelings, or reactions to the stimulus.' },
        { label: 'Visible Action', desc: 'What the character physically does in response.' },
        { label: 'Consequential Result', desc: 'The immediate outcome — often becomes the next paragraph\'s External Stimulus.' },
      ],
    },
    {
      id: 'why-sapling-works',
      title: 'Why the Sapling Method Works',
      content: 'The framework\'s power comes from several interlocking principles:',
      bullets: [
        'Top-Down Development prevents structural collapse — building from premise → structure → character → scene → paragraph ensures each layer supports the next.',
        'The AI Gets Smarter As You Go — each phase produces artifacts that become part of the AI\'s context for the next phase.',
        'Scene Alternation Creates Natural Pacing — the Action/Reaction pattern mirrors how human experience works.',
        'Character Journey and Plot Structure Are Linked but Distinct — developed in parallel and connected, so you understand both what happens and what it means.',
        'The Framework Scales — the same methodology works for standalone novels, multi-book series, or extended universes.',
        'The Writer Always Drives — the AI surfaces options and checks consistency, but the creative vision belongs to you.',
      ],
    },
  ],
};

// ────────────────────────────────────────────────────────
// Section 3: Anthropic API Key
// ────────────────────────────────────────────────────────
const apiKeySection: HelpSection = {
  id: 'api-key',
  title: 'Anthropic API Key',
  content:
    'SAiPLING uses Anthropic\'s Claude AI models to power its writing assistance features. To use the AI capabilities, you need an Anthropic API key. Your key is stored securely on your local machine and is never sent anywhere except directly to Anthropic\'s servers.',
  subsections: [
    {
      id: 'api-key-how-to-get',
      title: 'How to Get an API Key',
      content: 'Follow these steps to obtain your Anthropic API key:',
      bullets: [
        'Go to https://console.anthropic.com and create an account (or sign in if you already have one).',
        'Navigate to "API Keys" in the dashboard sidebar.',
        'Click "Create Key" and give it a name (e.g. "SAiPLING").',
        'Copy the key — it starts with "sk-ant-" — and paste it into SAiPLING\'s Settings page.',
        'SAiPLING will validate the key automatically. If it\'s valid, you\'re ready to go.',
      ],
    },
    {
      id: 'api-key-models',
      title: 'Available Models',
      content:
        'SAiPLING uses Claude models from Anthropic. Here are the currently available models and their characteristics:',
      table: [
        { label: 'Claude Opus 4.6', desc: 'Most capable model. Best for complex creative tasks, deep analysis, and nuanced writing. Higher cost but highest quality.' },
        { label: 'Claude Sonnet 4.6', desc: 'Excellent balance of capability and cost. Great for most writing tasks, brainstorming, and structural work. Recommended default.' },
        { label: 'Claude Haiku 4.5', desc: 'Fastest and most affordable model. Good for quick tasks like word suggestions, brief edits, and simple queries.' },
      ],
    },
    {
      id: 'api-key-costs',
      title: 'How Costs Work',
      content:
        'Anthropic charges per token — a token is roughly 3/4 of a word. Costs are split between input tokens (what you send to Claude, including your story context) and output tokens (what Claude generates in response).\n\nSAiPLING shows estimated token counts and costs before each AI operation so you can stay informed. Typical costs for writing a full novel with heavy AI assistance range from $5–$30 depending on the model used and how much AI interaction you do.\n\nYou only pay for what you use — there is no subscription. You add credit to your Anthropic account and it\'s drawn down as you use the AI features.',
      table: [
        { label: 'Claude Opus 4.6', desc: '$5 per million input tokens / $25 per million output tokens' },
        { label: 'Claude Sonnet 4.6', desc: '$3 per million input tokens / $15 per million output tokens' },
        { label: 'Claude Haiku 4.5', desc: '$1 per million input tokens / $5 per million output tokens' },
      ],
    },
    {
      id: 'api-key-links',
      title: 'Useful Links',
      content: 'Here are the key links you\'ll need:',
      bullets: [
        'Anthropic Console (sign up & manage keys): https://console.anthropic.com',
        'Anthropic Pricing: https://claude.com/pricing#api',
        'Anthropic Documentation: https://docs.anthropic.com',
      ],
    },
  ],
};

// ────────────────────────────────────────────────────────
// Section 4: Keyboard Shortcuts
// ────────────────────────────────────────────────────────
const keyboardShortcuts: HelpSection = {
  id: 'keyboard-shortcuts',
  title: 'Keyboard Shortcuts',
  content:
    'SAiPLING provides keyboard shortcuts so you can navigate and work without reaching for the mouse.',
  table: [
    { label: 'Ctrl+Shift+D', desc: 'Go to Dashboard' },
    { label: 'Ctrl+Shift+E', desc: 'Go to Files & Context' },
    { label: 'Ctrl+Shift+B', desc: 'Go to Book view' },
    { label: 'Ctrl+Shift+W', desc: 'Go to World view' },
    { label: 'Ctrl+Shift+C', desc: 'Go to Characters view' },
    { label: 'Ctrl+Shift+N', desc: 'Go to Notes and create a new note' },
    { label: 'Ctrl+Shift+H', desc: 'Open the Help window' },
    { label: 'Ctrl+Shift+,', desc: 'Open Settings' },
    { label: 'Ctrl+S', desc: 'Save the current file' },
    { label: 'Ctrl+Shift+F', desc: 'Toggle Focus Mode (also maximizes the window)' },
    { label: 'F11', desc: 'Toggle Focus Mode (alternative)' },
  ],
};

// ────────────────────────────────────────────────────────
// Export all sections
// ────────────────────────────────────────────────────────
export const HELP_SECTIONS: HelpSection[] = [
  howToUse,
  saplingMethod,
  apiKeySection,
  keyboardShortcuts,
];
