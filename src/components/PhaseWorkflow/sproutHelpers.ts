export const JOURNEY_STAGES = [
  { num: 1, name: 'Comfort Zone', slug: 'comfort-zone', template: 'stage-1-comfort-zone', beats: 'Beats 1-2' },
  { num: 2, name: 'Desire Emerges', slug: 'desire-emerges', template: 'stage-2-desire-emerges', beats: 'Beat 3-4' },
  { num: 3, name: 'Crossing Threshold', slug: 'crossing-threshold', template: 'stage-3-crossing-threshold', beats: 'Beats 5-7' },
  { num: 4, name: 'Trial and Error', slug: 'trial-and-error', template: 'stage-4-trial-and-error', beats: 'Beats 8-10' },
  { num: 5, name: 'Moment of Truth', slug: 'moment-of-truth', template: 'stage-5-moment-of-truth', beats: 'Beats 11-13' },
  { num: 6, name: 'Supreme Ordeal', slug: 'supreme-ordeal', template: 'stage-6-supreme-ordeal', beats: 'Beats 14-16' },
  { num: 7, name: 'Transformation', slug: 'transformation', template: 'stage-7-transformation', beats: 'Beats 17-18' },
  { num: 8, name: 'Return & Integration', slug: 'return-integration', template: 'stage-8-return-integration', beats: 'Beats 19-21' },
];

export function stageDir(num: number, slug: string): string {
  return `stage-${num}-${slug}`;
}
