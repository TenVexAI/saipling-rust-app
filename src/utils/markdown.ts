/**
 * Parses YAML frontmatter from a markdown string.
 * Returns { frontmatter, body } where frontmatter is a parsed object.
 */
export function parseFrontmatter(content: string): { frontmatter: Record<string, unknown>; body: string } {
  if (!content.startsWith('---\n') && !content.startsWith('---\r\n')) {
    return { frontmatter: {}, body: content };
  }

  const rest = content.slice(4);
  const endIdx = rest.indexOf('\n---');
  if (endIdx === -1) {
    return { frontmatter: {}, body: content };
  }

  const yamlStr = rest.slice(0, endIdx);
  const body = rest.slice(endIdx + 4).replace(/^\r?\n/, '');

  try {
    const frontmatter = parseSimpleYaml(yamlStr);
    return { frontmatter, body };
  } catch {
    return { frontmatter: {}, body: content };
  }
}

/**
 * Serializes frontmatter + body back to a markdown string with YAML frontmatter.
 */
export function serializeFrontmatter(frontmatter: Record<string, unknown>, body: string): string {
  if (!frontmatter || Object.keys(frontmatter).length === 0) {
    return body;
  }

  const yamlLines: string[] = [];
  for (const [key, value] of Object.entries(frontmatter)) {
    if (Array.isArray(value)) {
      yamlLines.push(`${key}: [${value.map((v) => JSON.stringify(v)).join(', ')}]`);
    } else if (typeof value === 'object' && value !== null) {
      yamlLines.push(`${key}: ${JSON.stringify(value)}`);
    } else if (typeof value === 'string') {
      yamlLines.push(`${key}: ${value}`);
    } else {
      yamlLines.push(`${key}: ${String(value)}`);
    }
  }

  return `---\n${yamlLines.join('\n')}\n---\n\n${body}`;
}

/**
 * Simple YAML key-value parser (handles flat frontmatter, not nested).
 */
function parseSimpleYaml(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const line of yaml.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;

    const key = trimmed.slice(0, colonIdx).trim();
    let value: unknown = trimmed.slice(colonIdx + 1).trim();

    // Parse arrays like [a, b, c]
    if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
      const inner = value.slice(1, -1);
      value = inner.split(',').map((v) => v.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    }
    // Parse booleans
    else if (value === 'true') value = true;
    else if (value === 'false') value = false;
    // Parse numbers
    else if (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value)) {
      value = Number(value);
    }
    // Strip quotes
    else if (typeof value === 'string' && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }
  return result;
}

/**
 * Extracts the title from a markdown body (first # heading).
 */
export function extractTitle(body: string): string | null {
  const match = body.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}
