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

/**
 * Convert markdown to HTML for TipTap consumption.
 * Handles headings, bold, italic, lists, blockquotes, code blocks, links, horizontal rules.
 */
export function markdownToHtml(md: string): string {
  if (!md) return '';

  let html = md;

  // Code blocks (fenced) - must be done before inline processing
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) => {
    return `<pre><code>${escapeHtml(code.trimEnd())}</code></pre>`;
  });

  // Split into lines for block-level processing
  const lines = html.split('\n');
  const result: string[] = [];
  let inList: 'ul' | 'ol' | null = null;
  let inBlockquote = false;
  let blockquoteLines: string[] = [];

  const flushBlockquote = () => {
    if (blockquoteLines.length > 0) {
      result.push(`<blockquote><p>${processInline(blockquoteLines.join(' '))}</p></blockquote>`);
      blockquoteLines = [];
    }
    inBlockquote = false;
  };

  const flushList = () => {
    if (inList) {
      result.push(inList === 'ul' ? '</ul>' : '</ol>');
      inList = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip if inside a pre block (already handled)
    if (line.startsWith('<pre>') || line.startsWith('</pre>')) {
      flushBlockquote();
      flushList();
      result.push(line);
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushBlockquote();
      flushList();
      const level = headingMatch[1].length;
      result.push(`<h${level}>${processInline(headingMatch[2])}</h${level}>`);
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      flushBlockquote();
      flushList();
      result.push('<hr>');
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      flushList();
      inBlockquote = true;
      blockquoteLines.push(line.slice(2));
      continue;
    } else if (inBlockquote) {
      flushBlockquote();
    }

    // Unordered list
    if (/^[\s]*[-*+]\s+/.test(line)) {
      if (inList !== 'ul') {
        flushList();
        result.push('<ul>');
        inList = 'ul';
      }
      result.push(`<li>${processInline(line.replace(/^[\s]*[-*+]\s+/, ''))}</li>`);
      continue;
    }

    // Ordered list
    if (/^[\s]*\d+\.\s+/.test(line)) {
      if (inList !== 'ol') {
        flushList();
        result.push('<ol>');
        inList = 'ol';
      }
      result.push(`<li>${processInline(line.replace(/^[\s]*\d+\.\s+/, ''))}</li>`);
      continue;
    }

    flushList();

    // Empty line
    if (line.trim() === '') {
      continue;
    }

    // Regular paragraph
    result.push(`<p>${processInline(line)}</p>`);
  }

  flushBlockquote();
  flushList();

  return result.join('\n');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function processInline(text: string): string {
  let result = text;
  // Bold + italic
  result = result.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  // Bold
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  result = result.replace(/__(.+?)__/g, '<strong>$1</strong>');
  // Italic
  result = result.replace(/\*(.+?)\*/g, '<em>$1</em>');
  result = result.replace(/_(.+?)_/g, '<em>$1</em>');
  // Inline code
  result = result.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Links
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  // Strikethrough
  result = result.replace(/~~(.+?)~~/g, '<s>$1</s>');
  return result;
}

/**
 * Convert TipTap HTML back to markdown for saving.
 */
export function htmlToMarkdown(html: string): string {
  if (!html) return '';

  const div = document.createElement('div');
  div.innerHTML = html;

  return nodeToMarkdown(div).trim();
}

function nodeToMarkdown(node: Node): string {
  const parts: string[] = [];

  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      parts.push(child.textContent || '');
      continue;
    }

    if (child.nodeType !== Node.ELEMENT_NODE) continue;

    const el = child as HTMLElement;
    const tag = el.tagName.toLowerCase();

    switch (tag) {
      case 'h1': parts.push(`# ${inlineToMd(el)}\n\n`); break;
      case 'h2': parts.push(`## ${inlineToMd(el)}\n\n`); break;
      case 'h3': parts.push(`### ${inlineToMd(el)}\n\n`); break;
      case 'h4': parts.push(`#### ${inlineToMd(el)}\n\n`); break;
      case 'h5': parts.push(`##### ${inlineToMd(el)}\n\n`); break;
      case 'h6': parts.push(`###### ${inlineToMd(el)}\n\n`); break;
      case 'p': parts.push(`${inlineToMd(el)}\n\n`); break;
      case 'blockquote': {
        const inner = nodeToMarkdown(el).trim().split('\n').map((l) => `> ${l}`).join('\n');
        parts.push(`${inner}\n\n`);
        break;
      }
      case 'ul': {
        for (const li of Array.from(el.children)) {
          parts.push(`- ${inlineToMd(li as HTMLElement)}\n`);
        }
        parts.push('\n');
        break;
      }
      case 'ol': {
        let idx = 1;
        for (const li of Array.from(el.children)) {
          parts.push(`${idx}. ${inlineToMd(li as HTMLElement)}\n`);
          idx++;
        }
        parts.push('\n');
        break;
      }
      case 'pre': {
        const code = el.querySelector('code');
        parts.push(`\`\`\`\n${code?.textContent || el.textContent}\n\`\`\`\n\n`);
        break;
      }
      case 'hr': parts.push('---\n\n'); break;
      default: parts.push(inlineToMd(el)); break;
    }
  }

  return parts.join('');
}

function inlineToMd(el: HTMLElement): string {
  const parts: string[] = [];

  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      parts.push(child.textContent || '');
      continue;
    }

    if (child.nodeType !== Node.ELEMENT_NODE) continue;

    const cel = child as HTMLElement;
    const tag = cel.tagName.toLowerCase();

    switch (tag) {
      case 'strong':
      case 'b':
        parts.push(`**${inlineToMd(cel)}**`);
        break;
      case 'em':
      case 'i':
        parts.push(`*${inlineToMd(cel)}*`);
        break;
      case 'code':
        parts.push(`\`${cel.textContent}\``);
        break;
      case 'a':
        parts.push(`[${inlineToMd(cel)}](${cel.getAttribute('href') || ''})`);
        break;
      case 's':
      case 'del':
        parts.push(`~~${inlineToMd(cel)}~~`);
        break;
      case 'mark':
        parts.push(`==${inlineToMd(cel)}==`);
        break;
      default:
        parts.push(inlineToMd(cel));
        break;
    }
  }

  return parts.join('');
}
