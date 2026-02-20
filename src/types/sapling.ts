export type Phase = 'seed' | 'root' | 'sprout' | 'flourish' | 'bloom';

export type PhaseStatus = 'not_started' | 'in_progress' | 'complete';

export interface PhaseInfo {
  id: Phase;
  label: string;
  question: string;
  deliverable: string;
  skills: string[];
}

export const PHASES: PhaseInfo[] = [
  {
    id: 'seed',
    label: 'Seed',
    question: 'What is this story about?',
    deliverable: 'Story Foundation (6 core elements)',
    skills: ['seed_developer', 'brainstorm'],
  },
  {
    id: 'root',
    label: 'Root',
    question: 'What happens in this story?',
    deliverable: '21-Beat Story Outline',
    skills: ['structure_analyst'],
  },
  {
    id: 'sprout',
    label: 'Sprout',
    question: 'Who changes, and how?',
    deliverable: 'Character Journeys + Relationships',
    skills: ['character_developer', 'relationship_mapper'],
  },
  {
    id: 'flourish',
    label: 'Flourish',
    question: 'What does each scene do?',
    deliverable: 'Scene Outlines (Action/Reaction)',
    skills: ['scene_architect', 'consistency_checker'],
  },
  {
    id: 'bloom',
    label: 'Bloom',
    question: 'How does this read?',
    deliverable: 'Draft Manuscript',
    skills: ['prose_writer', 'prose_editor', 'describe', 'dialogue_crafter'],
  },
];

export type SceneType = 'action' | 'reaction';

export const BEATS = [
  { num: 1, name: 'Opening Image', act: 'I' },
  { num: 2, name: 'Daily Life', act: 'I' },
  { num: 3, name: 'Inciting Incident', act: 'I' },
  { num: 4, name: 'Reluctance Moment', act: 'I' },
  { num: 5, name: 'Point of Departure', act: 'I' },
  { num: 6, name: 'First Challenge', act: 'I' },
  { num: 7, name: 'End of Known World', act: 'I' },
  { num: 8, name: 'New Reality', act: 'II' },
  { num: 9, name: 'Initial Progress', act: 'II' },
  { num: 10, name: 'Strengthening Allies', act: 'II' },
  { num: 11, name: 'Midpoint Shift', act: 'II' },
  { num: 12, name: 'Growing Opposition', act: 'II' },
  { num: 13, name: 'Moment of Doubt', act: 'II' },
  { num: 14, name: 'Renewed Determination', act: 'II' },
  { num: 15, name: 'Ultimate Challenge', act: 'II' },
  { num: 16, name: 'Darkest Moment', act: 'III' },
  { num: 17, name: 'Final Decision', act: 'III' },
  { num: 18, name: 'Climactic Confrontation', act: 'III' },
  { num: 19, name: 'Resolution', act: 'III' },
  { num: 20, name: 'Transformed Reality', act: 'III' },
  { num: 21, name: 'Closing Image', act: 'III' },
] as const;

export const CHARACTER_JOURNEY_STAGES = [
  { num: 1, name: 'Comfort Zone', beats: 'Beats 1-2' },
  { num: 2, name: 'Desire Emerges', beats: 'Beat 3' },
  { num: 3, name: 'Crossing Threshold', beats: 'Beats 5-7' },
  { num: 4, name: 'Adaptation', beats: 'Beats 8-9' },
  { num: 5, name: 'Trials and Allies', beats: 'Beats 10-11' },
  { num: 6, name: 'Supreme Ordeal', beats: 'Beats 16-18' },
  { num: 7, name: 'Transformation', beats: 'Beat 17' },
  { num: 8, name: 'Return with Gifts', beats: 'Beats 20-21' },
] as const;
