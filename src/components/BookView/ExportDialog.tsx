import { useState, useEffect } from 'react';
import { X, Download, FileText, FileType, BookOpen, AlertTriangle, Loader2, FolderOpen } from 'lucide-react';
import { exportBook } from '../../utils/tauri';

interface ExportDialogProps {
  projectDir: string;
  bookId: string;
  bookTitle: string;
  onClose: () => void;
}

const FORMATS = [
  { id: 'markdown', label: 'Markdown', ext: '.md', icon: FileText, needsPandoc: false, desc: 'Plain text, universal' },
  { id: 'docx', label: 'Word (DOCX)', ext: '.docx', icon: FileType, needsPandoc: true, desc: 'For agents & editors' },
  { id: 'pdf', label: 'PDF', ext: '.pdf', icon: FileType, needsPandoc: true, desc: 'Print-ready manuscript' },
  { id: 'epub', label: 'ePub', ext: '.epub', icon: BookOpen, needsPandoc: true, desc: 'E-reader format' },
  { id: 'latex', label: 'LaTeX', ext: '.tex', icon: FileText, needsPandoc: true, desc: 'Full typesetting control' },
] as const;

export function ExportDialog({ projectDir, bookId, bookTitle, onClose }: ExportDialogProps) {
  const [format, setFormat] = useState('markdown');
  const [includeFrontMatter, setIncludeFrontMatter] = useState(true);
  const [includeBackMatter, setIncludeBackMatter] = useState(true);
  const [includeChapterHeadings, setIncludeChapterHeadings] = useState(true);
  const [pageSize, setPageSize] = useState('letter');
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [hasPandoc, setHasPandoc] = useState<boolean | null>(null);

  // Check for Pandoc on mount
  useEffect(() => {
    // Try a markdown export dry-run style check — we'll just check if pandoc is available
    // by attempting to invoke the command through the backend
    setHasPandoc(null); // unknown initially
  }, []);

  const selectedFormat = FORMATS.find(f => f.id === format)!;
  const needsPandoc = selectedFormat.needsPandoc;

  const handleExport = async () => {
    setExporting(true);
    setResult(null);
    try {
      const outputPath = await exportBook(
        projectDir,
        bookId,
        format,
        {
          include_front_matter: includeFrontMatter,
          include_back_matter: includeBackMatter,
          include_chapter_headings: includeChapterHeadings,
          page_size: pageSize,
        },
        '', // empty = auto-generate in exports/ dir
      );
      setResult({ success: true, message: `Exported to:\n${outputPath}` });
      if (hasPandoc === null && needsPandoc) setHasPandoc(true);
    } catch (e) {
      const msg = String(e);
      if (msg.toLowerCase().includes('pandoc')) {
        setHasPandoc(false);
      }
      setResult({ success: false, message: msg });
    }
    setExporting(false);
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="rounded-xl shadow-2xl flex flex-col"
        style={{
          backgroundColor: 'var(--bg-elevated)',
          border: '1px solid var(--border-primary)',
          width: '480px',
          maxHeight: '90vh',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between shrink-0" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-secondary)' }}>
          <div className="flex items-center gap-2">
            <Download size={16} style={{ color: 'var(--accent)' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Export "{bookTitle}"
            </span>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-tertiary)' }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto" style={{ padding: '20px' }}>
          {/* Format Selection */}
          <div style={{ marginBottom: '20px' }}>
            <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
              Format
            </label>
            <div className="grid grid-cols-2" style={{ gap: '8px' }}>
              {FORMATS.map(f => (
                <button
                  key={f.id}
                  onClick={() => setFormat(f.id)}
                  className="text-left rounded-lg transition-colors"
                  style={{
                    padding: '10px 12px',
                    backgroundColor: format === f.id ? 'var(--accent-subtle)' : 'var(--bg-secondary)',
                    border: `1px solid ${format === f.id ? 'var(--accent)' : 'var(--border-primary)'}`,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <f.icon size={14} style={{ color: format === f.id ? 'var(--accent)' : 'var(--text-tertiary)' }} />
                    <span className="text-xs font-medium" style={{ color: format === f.id ? 'var(--accent)' : 'var(--text-primary)' }}>
                      {f.label}
                    </span>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)', marginTop: '2px', marginLeft: '22px' }}>
                    {f.desc}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Pandoc Warning */}
          {needsPandoc && hasPandoc === false && (
            <div className="flex items-start gap-2 rounded-lg" style={{ padding: '10px 12px', backgroundColor: 'var(--color-warning-bg, rgba(255,180,0,0.1))', border: '1px solid var(--color-warning)', marginBottom: '16px' }}>
              <AlertTriangle size={14} style={{ color: 'var(--color-warning)', marginTop: '1px', flexShrink: 0 }} />
              <div>
                <p className="text-xs font-medium" style={{ color: 'var(--color-warning)' }}>Pandoc Required</p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>
                  This format requires Pandoc. Install from{' '}
                  <span style={{ color: 'var(--accent)', textDecoration: 'underline', cursor: 'pointer' }}
                    onClick={() => window.open?.('https://pandoc.org/installing.html')}
                  >
                    pandoc.org
                  </span>
                </p>
              </div>
            </div>
          )}

          {/* Options */}
          <div style={{ marginBottom: '16px' }}>
            <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '10px' }}>
              Options
            </label>
            <div className="flex flex-col" style={{ gap: '8px' }}>
              <Checkbox checked={includeFrontMatter} onChange={setIncludeFrontMatter} label="Include front matter" />
              <Checkbox checked={includeBackMatter} onChange={setIncludeBackMatter} label="Include back matter" />
              <Checkbox checked={includeChapterHeadings} onChange={setIncludeChapterHeadings} label="Include chapter headings" />
            </div>
          </div>

          {/* Page Size (PDF only) */}
          {format === 'pdf' && (
            <div style={{ marginBottom: '16px' }}>
              <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                Page Size
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setPageSize('letter')}
                  className="rounded-lg text-xs"
                  style={{
                    padding: '6px 16px',
                    backgroundColor: pageSize === 'letter' ? 'var(--accent-subtle)' : 'var(--bg-secondary)',
                    border: `1px solid ${pageSize === 'letter' ? 'var(--accent)' : 'var(--border-primary)'}`,
                    color: pageSize === 'letter' ? 'var(--accent)' : 'var(--text-primary)',
                  }}
                >
                  US Letter
                </button>
                <button
                  onClick={() => setPageSize('a4')}
                  className="rounded-lg text-xs"
                  style={{
                    padding: '6px 16px',
                    backgroundColor: pageSize === 'a4' ? 'var(--accent-subtle)' : 'var(--bg-secondary)',
                    border: `1px solid ${pageSize === 'a4' ? 'var(--accent)' : 'var(--border-primary)'}`,
                    color: pageSize === 'a4' ? 'var(--accent)' : 'var(--text-primary)',
                  }}
                >
                  A4
                </button>
              </div>
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
                marginBottom: '8px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              <div className="flex items-start gap-2">
                {result.success ? <FolderOpen size={14} style={{ flexShrink: 0, marginTop: '1px' }} /> : <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />}
                <span>{result.message}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 flex justify-end gap-2" style={{ padding: '12px 20px', borderTop: '1px solid var(--border-secondary)' }}>
          <button
            onClick={onClose}
            className="rounded-lg text-xs font-medium"
            style={{
              padding: '8px 16px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-primary)',
              color: 'var(--text-primary)',
            }}
          >
            Close
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="rounded-lg text-xs font-medium flex items-center gap-2"
            style={{
              padding: '8px 20px',
              backgroundColor: 'var(--accent)',
              color: 'var(--text-inverse)',
              opacity: exporting ? 0.6 : 1,
            }}
          >
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {exporting ? 'Exporting...' : 'Export'}
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
          transition: 'all 0.15s',
        }}
        onClick={() => onChange(!checked)}
      >
        {checked && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 5L4.5 7.5L8 3" stroke="var(--text-inverse)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <span className="text-xs" style={{ color: 'var(--text-primary)' }}>{label}</span>
    </label>
  );
}
