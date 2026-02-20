import type { ApplyBlock } from '../types/ai';

/**
 * Parses saipling-apply blocks from Claude's response text.
 * These blocks contain file operations the user can approve.
 *
 * Format:
 * ```saipling-apply
 * target: path/to/file.md
 * action: create|replace|append|update_frontmatter
 * section: "## Section Title" (optional, for replace)
 * ---
 * (content including optional YAML frontmatter)
 * ```
 */
export function parseApplyBlocks(text: string): { blocks: ApplyBlock[]; cleanText: string } {
  const blocks: ApplyBlock[] = [];
  const BLOCK_START = '```saipling-apply';
  const BLOCK_END = '```';

  const cleanText = text;
  let searchFrom = 0;

  while (true) {
    const startIdx = cleanText.indexOf(BLOCK_START, searchFrom);
    if (startIdx === -1) break;

    const contentStart = startIdx + BLOCK_START.length + 1; // +1 for newline
    const endIdx = cleanText.indexOf(BLOCK_END, contentStart);
    if (endIdx === -1) break;

    const blockContent = cleanText.slice(contentStart, endIdx);
    const block = parseBlockContent(blockContent);

    if (block) {
      blocks.push(block);
    }

    // Move past this block for next search
    searchFrom = endIdx + BLOCK_END.length;
  }

  return { blocks, cleanText };
}

function parseBlockContent(content: string): ApplyBlock | null {
  const lines = content.split('\n');
  let target = '';
  let action: ApplyBlock['action'] = 'create';
  let section: string | undefined;
  let bodyStartIdx = 0;

  // Parse header lines (key: value pairs before the --- separator)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line === '---') {
      bodyStartIdx = i + 1;
      break;
    }

    if (line.startsWith('target:')) {
      target = line.slice(7).trim();
    } else if (line.startsWith('action:')) {
      const val = line.slice(7).trim();
      if (['create', 'replace', 'append', 'update_frontmatter'].includes(val)) {
        action = val as ApplyBlock['action'];
      }
    } else if (line.startsWith('section:')) {
      section = line.slice(8).trim().replace(/^["']|["']$/g, '');
    }

    // If we haven't found --- yet and we've gone past likely header lines,
    // treat everything as content
    if (i > 10 && bodyStartIdx === 0) {
      bodyStartIdx = 0;
      break;
    }
  }

  if (!target) return null;

  const bodyContent = lines.slice(bodyStartIdx).join('\n').trim();

  // Check if body content starts with YAML frontmatter
  let frontmatter: Record<string, unknown> | undefined;
  let finalContent = bodyContent;

  if (bodyContent.startsWith('---\n') || bodyContent.startsWith('---\r\n')) {
    const rest = bodyContent.slice(4);
    const fmEnd = rest.indexOf('\n---');
    if (fmEnd !== -1) {
      // Keep the frontmatter as part of the content (it's for the target file)
      finalContent = bodyContent;
    }
  }

  return {
    target,
    action,
    section,
    content: finalContent,
    frontmatter,
  };
}

/**
 * Checks if a message contains any saipling-apply blocks.
 */
export function hasApplyBlocks(text: string): boolean {
  return text.includes('```saipling-apply');
}

/**
 * Extracts the text portions of a message (everything outside apply blocks).
 */
export function getMessageText(text: string): string {
  return text.replace(/```saipling-apply[\s\S]*?```/g, '').trim();
}
