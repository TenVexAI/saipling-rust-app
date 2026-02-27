/** Map beat name → slug for directory naming and template lookup */
export function beatSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-');
}

/** Zero-padded beat number + slug directory name */
export function beatDir(num: number, name: string): string {
  return `beat-${String(num).padStart(2, '0')}-${beatSlug(name)}`;
}

/** Template name for a beat */
export function beatTemplate(num: number, name: string): string {
  return `beat-${String(num).padStart(2, '0')}-${beatSlug(name)}`;
}

export const ANCHOR_BEATS = new Set([3, 11, 18, 21]);
