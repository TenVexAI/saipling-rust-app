import { useState, useEffect } from 'react';
import { X, Download, FileText, FileType, BookOpen, AlertTriangle, Loader2, FolderOpen } from 'lucide-react';
import { exportBook, checkPandoc } from '../../utils/tauri';

interface ExportDialogProps {
  projectDir: string;
  bookId: string;
  bookTitle: string;
  onClose: () => void;
}

// ── Format definitions ────────────────────────────────────────────────────────
const FORMATS = [
  { id: 'markdown', label: 'Markdown',    ext: '.md',   icon: FileText, needsPandoc: false, desc: 'Plain text, universal'   },
  { id: 'docx',     label: 'Word (DOCX)', ext: '.docx', icon: FileType, needsPandoc: true,  desc: 'For agents & editors'     },
  { id: 'pdf',      label: 'PDF',         ext: '.pdf',  icon: FileType, needsPandoc: true,  desc: 'Print-ready manuscript'   },
  { id: 'epub',     label: 'ePub',        ext: '.epub', icon: BookOpen, needsPandoc: true,  desc: 'E-reader format'          },
  { id: 'latex',    label: 'LaTeX',       ext: '.tex',  icon: FileText, needsPandoc: false, desc: 'Full typesetting control' },
] as const;

type FormatId = (typeof FORMATS)[number]['id'];

// ── Template definitions per format ──────────────────────────────────────────
const TEMPLATES: Record<string, { id: string; label: string; description: string }[]> = {
  docx: [
    { id: 'standard-manuscript', label: 'Standard Manuscript',  description: 'Industry standard for agent & publisher submissions (TNR 12pt, double-spaced, running header)' },
    { id: 'clean-modern',        label: 'Clean Modern',         description: 'Georgia 11pt, comfortable spacing — great for sharing with beta readers' },
    { id: 'chicago-style',       label: 'Chicago Style',        description: 'Chicago Manual of Style 17th ed. — centered bold chapter titles, double-spaced' },
  ],
  pdf: [
    { id: 'classic-novel', label: 'Classic Novel', description: 'Traditional book layout — mirrored margins, ornamental chapter breaks, running headers' },
    { id: 'minimal',       label: 'Minimal',       description: 'Clean, contemporary — light chapter titles, simple footer page numbers' },
  ],
  epub: [
    { id: 'clean-reader',   label: 'Clean Reader',   description: 'Maximum e-reader compatibility — system serif, respects user font preferences' },
    { id: 'classic-book',   label: 'Classic Book',   description: 'Traditional typography — drop caps, ornamental scene breaks, old-style numerals' },
    { id: 'modern-minimal', label: 'Modern Minimal', description: 'Contemporary — paragraph spacing, left-aligned, clean chapter titles' },
  ],
  latex: [
    { id: 'classic-novel', label: 'Classic Novel', description: 'memoir class — mirrored margins, chapter styles, proper book typography' },
    { id: 'minimal',       label: 'Minimal',       description: 'article class — clean, simple, good for drafts and academic-adjacent work' },
  ],
  markdown: [],
};

// ── Default templates ─────────────────────────────────────────────────────────
const DEFAULT_TEMPLATE: Record<string, string> = {
  docx:     'standard-manuscript',
  pdf:      'classic-novel',
  epub:     'clean-reader',
  latex:    'classic-novel',
  markdown: '',
};

export function ExportDialog({ projectDir, bookId, bookTitle, onClose }: ExportDialogProps) {
  const [format, setFormat]                         = useState<FormatId>('markdown');
  const [template, setTemplate]                     = useState<string>('');
  const [includeFrontMatter, setIncludeFrontMatter] = useState(true);
  const [includeBackMatter, setIncludeBackMatter]   = useState(true);
  const [includeChapterHeadings, setIncludeChapterHeadings] = useState(true);
  const [pageSize, setPageSize]                     = useState('letter');
  const [exporting, setExporting]                   = useState(false);
  const [result, setResult]                         = useState<{ success: boolean; message: string } | null>(null);
  const [pandocAvailable, setPandocAvailable]       = useState<boolean | null>(null);

  const selectedFormat     = FORMATS.find(f => f.id === format)!;
  const availableTemplates = TEMPLATES[format] ?? [];
  const needsPandoc        = selectedFormat.needsPandoc;

  // ── Check Pandoc availability on mount ─────────────────────────────────────
  useEffect(() => {
    checkPandoc()
      .then(available => setPandocAvailable(available))
      .catch(() => setPandocAvailable(false));
  }, []);

  // ── Sync template default when format changes ──────────────────────────────
  useEffect(() => {
    setTemplate(DEFAULT_TEMPLATE[format] ?? '');
    setResult(null);
  }, [format]);

  const handleExport = async () => {
    setExporting(true);
    setResult(null);
    try {
      const outputPath = await exportBook(
        projectDir,
        bookId,
        format,
        {
          include_front_matter:     includeFrontMatter,
          include_back_matter:      includeBackMatter,
          include_chapter_headings: includeChapterHeadings,
          page_size:                pageSize,
          template:                 template,
        },
        '',
      );
      setResult({ success: true, message: `Exported to:\n${outputPath}` });
    } catch (e) {
      const msg = String(e);
      if (msg.toLowerCase().includes('pandoc') || msg.toLowerCase().includes('typst')) {
        setPandocAvailable(false);
      }
      setResult({ success: false, message: msg });
    }
    setExporting(false);
  };

  // ── Pandoc warning banner ──────────────────────────────────────────────────
  const showPandocWarning = needsPandoc && pandocAvailable === false;
  const pandocWarningText = format === 'pdf'
    ? 'PDF export requires Pandoc + Typst. Install both from pandoc.org and typst.app.'
    : 'This format requires Pandoc. Install from pandoc.org';

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="rounded-xl shadow-2xl flex flex-col"
        style={{
          backgroundColor: 'var(--bg-elevated)',
          border: '1px solid var(--border-primary)',
          width: '520px',
          maxHeight: '90vh',
        }}
      >
        {/* ── Header ── */}
        <div
          className="flex items-center justify-between shrink-0"
          style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-secondary)' }}
        >
          <div className="flex items-center gap-2">
            <Download size={16} style={{ color: 'var(--accent)' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Export "{bookTitle}"
            </span>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Format grid */}
          <div>
            <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
              Format
            </label>
            <div className="grid grid-cols-2" style={{ gap: '8px' }}>
              {FORMATS.map(f => {
                const Icon = f.icon;
                return (
                  <button
                    key={f.id}
                    onClick={() => setFormat(f.id as FormatId)}
                    className="text-left rounded-lg transition-colors"
                    style={{
                      padding: '10px 12px',
                      backgroundColor: format === f.id ? 'var(--accent-subtle)' : 'var(--bg-secondary)',
                      border: `1px solid ${format === f.id ? 'var(--accent)' : 'var(--border-primary)'}`,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <Icon size={14} style={{ color: format === f.id ? 'var(--accent)' : 'var(--text-tertiary)', flexShrink: 0 }} />
                      <span className="text-xs font-medium" style={{ color: format === f.id ? 'var(--accent)' : 'var(--text-primary)' }}>
                        {f.label}
                      </span>
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-tertiary)', marginTop: '3px', paddingLeft: '22px' }}>
                      {f.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Template picker — shown when templates are available */}
          {availableTemplates.length > 0 && (
            <div>
              <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                Template
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {availableTemplates.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTemplate(t.id)}
                    className="text-left rounded-lg transition-colors"
                    style={{
                      padding: '9px 12px',
                      backgroundColor: template === t.id ? 'var(--accent-subtle)' : 'var(--bg-secondary)',
                      border: `1px solid ${template === t.id ? 'var(--accent)' : 'var(--border-primary)'}`,
                    }}
                  >
                    <div className="text-xs font-medium" style={{ color: template === t.id ? 'var(--accent)' : 'var(--text-primary)' }}>
                      {t.label}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-tertiary)', marginTop: '2px' }}>
                      {t.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Options */}
          <div>
            <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
              Options
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Checkbox checked={includeFrontMatter}     onChange={setIncludeFrontMatter}     label="Include front matter" />
              <Checkbox checked={includeBackMatter}      onChange={setIncludeBackMatter}      label="Include back matter" />
              <Checkbox checked={includeChapterHeadings} onChange={setIncludeChapterHeadings} label="Include chapter headings" />
            </div>
          </div>

          {/* Page size — PDF only */}
          {format === 'pdf' && (
            <div>
              <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                Page size
              </label>
              <div className="flex" style={{ gap: '8px' }}>
                {(['letter', 'a4'] as const).map(ps => (
                  <button
                    key={ps}
                    onClick={() => setPageSize(ps)}
                    className="rounded-lg text-xs font-medium"
                    style={{
                      padding: '7px 16px',
                      backgroundColor: pageSize === ps ? 'var(--accent-subtle)' : 'var(--bg-secondary)',
                      border: `1px solid ${pageSize === ps ? 'var(--accent)' : 'var(--border-primary)'}`,
                      color: pageSize === ps ? 'var(--accent)' : 'var(--text-primary)',
                    }}
                  >
                    {ps === 'letter' ? 'US Letter' : 'A4'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Pandoc warning */}
          {showPandocWarning && (
            <div
              className="rounded-lg text-xs flex items-start gap-2"
              style={{
                padding: '10px 12px',
                backgroundColor: 'rgba(255,160,0,0.08)',
                border: '1px solid rgba(255,160,0,0.35)',
                color: 'var(--color-warning, #e08000)',
              }}
            >
              <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span>{pandocWarningText}</span>
            </div>
          )}

          {/* Result */}
          {result && (
            <div
              className="rounded-lg text-xs"
              style={{
                padding: '10px 12px',
                backgroundColor: result.success ? 'rgba(60,242,129,0.1)' : 'rgba(255,80,80,0.1)',
                border: `1px solid ${result.success ? 'var(--color-success)' : 'var(--color-error)'}`,
                color: result.success ? 'var(--color-success)' : 'var(--color-error)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              <div className="flex items-start gap-2">
                {result.success
                  ? <FolderOpen size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
                  : <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />}
                <span>{result.message}</span>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div
          className="shrink-0 flex justify-end gap-2"
          style={{ padding: '12px 20px', borderTop: '1px solid var(--border-secondary)' }}
        >
          <button
            onClick={onClose}
            className="rounded-lg text-xs font-medium"
            style={{
              padding: '8px 16px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-primary)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
          <button
            onClick={handleExport}
            disabled={exporting || (needsPandoc && pandocAvailable === false)}
            className="rounded-lg text-xs font-medium flex items-center gap-2"
            style={{
              padding: '8px 20px',
              backgroundColor: 'var(--accent)',
              color: 'var(--text-inverse)',
              border: 'none',
              opacity: (exporting || (needsPandoc && pandocAvailable === false)) ? 0.5 : 1,
              cursor: (needsPandoc && pandocAvailable === false) ? 'not-allowed' : 'pointer',
            }}
          >
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {exporting ? 'Exporting…' : 'Export'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <div
        className="flex items-center justify-center rounded"
        style={{
          width: '16px',
          height: '16px',
          backgroundColor: checked ? 'var(--accent)' : 'transparent',
          border: `1px solid ${checked ? 'var(--accent)' : 'var(--border-primary)'}`,
          flexShrink: 0,
          transition: 'all 0.15s',
        }}
        onClick={() => onChange(!checked)}
      >
        {checked && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="var(--text-inverse)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <span className="text-xs" style={{ color: 'var(--text-primary)' }}>{label}</span>
    </label>
  );
}
