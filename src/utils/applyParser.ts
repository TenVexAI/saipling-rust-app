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
  const cleanText = text;

  // Parse ```saipling-apply code fence blocks
  let searchFrom = 0;
  const BLOCK_START = '```saipling-apply';
  const BLOCK_END = '```';
  while (true) {
    const startIdx = cleanText.indexOf(BLOCK_START, searchFrom);
    if (startIdx === -1) break;
    const contentStart = startIdx + BLOCK_START.length + 1;
    const endIdx = cleanText.indexOf(BLOCK_END, contentStart);
    if (endIdx === -1) break;
    const blockContent = cleanText.slice(contentStart, endIdx);
    const block = parseBlockContent(blockContent);
    if (block) blocks.push(block);
    searchFrom = endIdx + BLOCK_END.length;
  }

  // Parse <sapling-apply ...> ... </sapling-apply> XML-style blocks
  // Use a permissive regex first, then extract attributes from the opening tag
  const xmlRegex = /<sapling-apply([^>]*)>([\s\S]*?)<\/sapling-apply>/gi;
  let xmlMatch;
  while ((xmlMatch = xmlRegex.exec(cleanText)) !== null) {
    const attrs = xmlMatch[1];
    let content = xmlMatch[2].trim();

    // Extract filepath from attributes (handles filepath=, file=, path=, target=)
    const fpMatch = attrs.match(/(?:filepath|file|path|target)\s*=\s*["']([^"']+)["']/i);
    const filepath = fpMatch ? fpMatch[1] : '';

    // Strip inner code fence if present (```markdown ... ```)
    const innerFence = content.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/s);
    if (innerFence) content = innerFence[1].trim();

    // Only add the block if we got content (filepath can be empty — card still shows content)
    if (content) {
      blocks.push({
        target: filepath || 'unknown',
        action: 'create',
        content,
      });
    }
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
 * Extracts clean markdown body from an AI response that may be wrapped in
 * sapling-apply tags, code fences, and/or contain its own frontmatter.
 *
 * Handles formats like:
 *   <sapling-apply filepath="..."> ```markdown\n---\nfm\n---\nbody``` </sapling-apply>
 *   ```saipling-apply\ntarget: ...\n---\n---\nfm\n---\nbody```
 *   ```markdown\n---\nfm\n---\nbody```
 *   ---\nfm\n---\nbody (raw with frontmatter)
 */
export function extractDraftBody(raw: string): string {
  let text = raw.trim();

  // Strip <sapling-apply ...> ... </sapling-apply> wrapper
  text = text.replace(/<sapling-apply[^>]*>\s*/gi, '');
  text = text.replace(/\s*<\/sapling-apply>/gi, '');
  text = text.trim();

  // Extract content from a markdown/saipling-apply code fence.
  // Try exact match first (entire text is one fence), then embedded (fence within prose).
  const exactFence = text.match(/^```(?:markdown|md|saipling-apply)?\s*\n([\s\S]*?)\n```\s*$/);
  if (exactFence) {
    text = exactFence[1].trim();
  } else {
    const embeddedFence = text.match(/```(?:markdown|md|saipling-apply)?\s*\n([\s\S]*?)\n```/);
    if (embeddedFence) {
      text = embeddedFence[1].trim();
    }
  }

  // If this was a saipling-apply code block, strip the header lines (target:, action:, etc.) up to ---
  if (raw.includes('saipling-apply')) {
    const headerMatch = text.match(/^(?:target:.*\n|action:.*\n|section:.*\n)*---\n([\s\S]*)$/);
    if (headerMatch) {
      text = headerMatch[1].trim();
    }
  }

  // Strip embedded YAML frontmatter (--- ... ---)
  const fmMatch = text.match(/^---\s*\n[\s\S]*?\n---\s*\n([\s\S]*)$/);
  if (fmMatch) {
    text = fmMatch[1].trim();
  }

  return text;
}

/**
 * Checks if a message contains any saipling-apply blocks.
 */
export function hasApplyBlocks(text: string): boolean {
  return text.includes('```saipling-apply') || /<sapling-apply\s/i.test(text);
}

/**
 * Extracts the text portions of a message (everything outside apply blocks).
 */
export function getMessageText(text: string): string {
  let cleaned = text;
  // Strip ```saipling-apply ... ``` code fence blocks
  cleaned = cleaned.replace(/```saipling-apply[\s\S]*?```/g, '');
  // Strip <sapling-apply ...> ... </sapling-apply> XML blocks
  cleaned = cleaned.replace(/<sapling-apply[\s\S]*?<\/sapling-apply>/gi, '');
  return cleaned.trim();
}
