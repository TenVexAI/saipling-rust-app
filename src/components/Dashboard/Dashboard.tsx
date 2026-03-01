import { useState, useEffect, useCallback, useRef } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { useAIStore } from '../../stores/aiStore';
import { listDirectory, createBook, getBookWordCount, getBookTotalDocWords, getBookMetadata, updateBookMetadata, getGenres, readFile } from '../../utils/tauri';
import type { Genre } from '../../utils/tauri';
import { saveProjectChat } from '../../utils/projectChat';
import { BookOpen, Plus, Lightbulb, LogOut, Pencil, Trash2, Check, ArrowRight, X, ChevronRight } from 'lucide-react';
import { SaiplingDashLogo } from './SaiplingDashLogo';
import { PhaseIcon } from '../PhaseWorkflow/PhaseIcon';
import { EditProjectModal } from './EditProjectModal';
import { DeleteProjectModal } from './DeleteProjectModal';
import { DeleteBookModal } from './DeleteBookModal';
import { GettingStartedModal } from './GettingStartedModal';
import { ContinueWorkingModal } from './ContinueWorkingModal';
import type { BookMetadata } from '../../types/project';
import { PHASES } from '../../types/sapling';
import type { Phase } from '../../types/sapling';

interface BookCardData {
  sceneWords: number;
  totalDocWords: number;
  currentPhase: string;
  hasOverview: boolean;
  meta: BookMetadata | null;
  logline: string;
}

const PHASE_ORDER: Phase[] = ['seed', 'root', 'sprout', 'flourish', 'bloom'];

const PHASE_LABELS: Record<Phase, string> = {
  seed: 'Seed',
  root: 'Root',
  sprout: 'Sprout',
  flourish: 'Flourish',
  bloom: 'Bloom',
};

function getCurrentPhase(phaseProgress: Record<string, { status: string }>): string {
  for (let i = PHASE_ORDER.length - 1; i >= 0; i--) {
    const p = phaseProgress[PHASE_ORDER[i]];
    if (p && p.status === 'complete') {
      return PHASE_ORDER[i + 1] ? PHASE_LABELS[PHASE_ORDER[i + 1]] : 'Complete';
    }
    if (p && p.status === 'in_progress') {
      return PHASE_LABELS[PHASE_ORDER[i]];
    }
  }
  return 'Seed';
}

function getCurrentPhaseId(phaseProgress: Record<string, { status: string }>): Phase | null {
  for (let i = PHASE_ORDER.length - 1; i >= 0; i--) {
    const p = phaseProgress[PHASE_ORDER[i]];
    if (p && p.status === 'complete') {
      return PHASE_ORDER[i + 1] ?? null;
    }
    if (p && p.status === 'in_progress') {
      return PHASE_ORDER[i];
    }
  }
  return 'seed';
}

export function Dashboard() {
  const project = useProjectStore((s) => s.project);
  const projectDir = useProjectStore((s) => s.projectDir);
  const activeBookId = useProjectStore((s) => s.activeBookId);
  const clearProjectStore = useProjectStore((s) => s.clearProject);
  const setActiveFile = useProjectStore((s) => s.setActiveFile);
  const setActiveSkill = useAIStore((s) => s.setActiveSkill);
  const setActivePhase = useProjectStore((s) => s.setActivePhase);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [overviewPath, setOverviewPath] = useState<string | null>(null);
  const [overviewChecked, setOverviewChecked] = useState(false);
  const [showGettingStarted, setShowGettingStarted] = useState(false);
  const [showNewBook, setShowNewBook] = useState(false);
  const [newBookTitle, setNewBookTitle] = useState('');
  const [newBookAuthor, setNewBookAuthor] = useState('');
  const [newBookGenreId, setNewBookGenreId] = useState('');
  const [newBookSubGenreId, setNewBookSubGenreId] = useState('');
  const [newBookTense, setNewBookTense] = useState('');
  const [newBookPerspective, setNewBookPerspective] = useState('');
  const [newBookTargetWords, setNewBookTargetWords] = useState('80000');
  const [bookError, setBookError] = useState('');
  const [bookCardData, setBookCardData] = useState<Record<string, BookCardData>>({});
  const [editingBook, setEditingBook] = useState<BookMetadata | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editAuthor, setEditAuthor] = useState('');
  const [editGenreId, setEditGenreId] = useState('');
  const [editSubGenreId, setEditSubGenreId] = useState('');
  const [editTense, setEditTense] = useState('');
  const [editPerspective, setEditPerspective] = useState('');
  const [editTargetWords, setEditTargetWords] = useState('');
  const [editError, setEditError] = useState('');
  const [activeBookHasOverview, setActiveBookHasOverview] = useState(false);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [expandedSubGenre, setExpandedSubGenre] = useState<string | null>(null);
  const [editExpandedSubGenre, setEditExpandedSubGenre] = useState<string | null>(null);
  const [deletingBook, setDeletingBook] = useState<{ id: string; title: string } | null>(null);
  const [showContinueModal, setShowContinueModal] = useState(false);
  const [continueDismissed, setContinueDismissed] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const refreshCounter = useProjectStore((s) => s.refreshCounter);

  // Load genres on mount
  useEffect(() => {
    getGenres().then((config) => setGenres(config.genres.sort((a, b) => a.sort_order - b.sort_order))).catch(() => {});
  }, []);

  // Check if the active book has an overview document
  useEffect(() => {
    if (!projectDir || !activeBookId) {
      setActiveBookHasOverview(false);
      return;
    }
    const bookOverviewDir = `${projectDir}\\books\\${activeBookId}\\overview`;
    listDirectory(bookOverviewDir)
      .then((entries) => {
        setActiveBookHasOverview(entries.some((e) => e.name === 'overview.md'));
      })
      .catch(() => setActiveBookHasOverview(false));
  }, [projectDir, activeBookId, refreshCounter]);

  const handleExitProject = async () => {
    if (projectDir) await saveProjectChat(projectDir);
    clearProjectStore();
  };

  useEffect(() => {
    if (!projectDir) return;
    const overviewDir = `${projectDir}\\overview`;
    listDirectory(overviewDir)
      .then((entries) => {
        const overview = entries.find((e) => e.name === 'overview.md');
        setOverviewPath(overview ? overview.path : null);
        setOverviewChecked(true);
        if (!overview) setShowGettingStarted(true);
      })
      .catch(() => {
        setOverviewPath(null);
        setOverviewChecked(true);
        setShowGettingStarted(true);
      });
  }, [projectDir]);

  // Show "Continue Working" modal when both overviews exist and user hasn't dismissed
  useEffect(() => {
    if (
      overviewChecked &&
      overviewPath &&
      activeBookHasOverview &&
      activeBookId &&
      bookCardData[activeBookId] &&
      !continueDismissed &&
      !showGettingStarted
    ) {
      setShowContinueModal(true);
    }
  }, [overviewChecked, overviewPath, activeBookHasOverview, activeBookId, bookCardData, continueDismissed, showGettingStarted]);

  // Fetch word counts + metadata for each book
  const loadBookData = useCallback(async () => {
    if (!projectDir || !project) return;
    const data: Record<string, BookCardData> = {};
    for (const book of project.books) {
      try {
        const [wc, totalWords, meta] = await Promise.all([
          getBookWordCount(projectDir, book.id),
          getBookTotalDocWords(projectDir, book.id),
          getBookMetadata(projectDir, book.id),
        ]);
        const bookOverviewDir = `${projectDir}\\books\\${book.id}\\overview`;
        let hasOverview = false;
        try {
          const entries = await listDirectory(bookOverviewDir);
          hasOverview = entries.some((e) => e.name === 'overview.md');
        } catch { /* no overview dir */ }
        const rawPhase = getCurrentPhase(meta.phase_progress as Record<string, { status: string }>);
        // Load logline if seed phase is complete
        let logline = '';
        const seedStatus = (meta.phase_progress as Record<string, { status: string }>)['seed'];
        if (seedStatus?.status === 'complete') {
          try {
            const loglineContent = await readFile(`${projectDir}\\books\\${book.id}\\phase-1-seed\\logline.md`);
            logline = loglineContent.body.trim();
          } catch { /* no logline yet */ }
        }
        data[book.id] = {
          sceneWords: wc.book_total,
          totalDocWords: totalWords,
          currentPhase: !hasOverview && rawPhase === 'Seed' ? 'Brainstorm' : rawPhase,
          hasOverview,
          meta,
          logline,
        };
      } catch {
        data[book.id] = { sceneWords: 0, totalDocWords: 0, currentPhase: 'Brainstorm', hasOverview: false, meta: null, logline: '' };
      }
    }
    setBookCardData(data);
  }, [projectDir, project]);

  useEffect(() => {
    loadBookData();
  }, [loadBookData, refreshCounter]);

  const handleBrainstorm = () => {
    if (!projectDir) return;
    setActiveSkill('brainstorm');
    setActiveFile(overviewPath ?? `${projectDir}\\overview\\brainstorm.md`);
  };

  const handleCreateBook = async () => {
    if (!projectDir || !project || !newBookTitle.trim()) return;
    setBookError('');
    try {
      const meta = await createBook(projectDir, newBookTitle.trim(), newBookAuthor.trim(), newBookGenreId, newBookSubGenreId, newBookTense, newBookPerspective, parseInt(newBookTargetWords) || 80000);
      useProjectStore.getState().updateBooks([
        ...project.books,
        { id: meta.id, title: meta.title, sort_order: meta.sort_order, genre_id: meta.genre_id },
      ]);
      setShowNewBook(false);
      setNewBookTitle('');
      setNewBookAuthor('');
      setNewBookGenreId('');
      setNewBookSubGenreId('');
      setNewBookTense('');
      setNewBookPerspective('');
      setNewBookTargetWords('80000');
      setExpandedSubGenre(null);
      loadBookData();
    } catch (e) {
      setBookError(String(e));
    }
  };

  const handleOpenEditBook = async (bookId: string) => {
    if (!projectDir) return;
    try {
      const meta = await getBookMetadata(projectDir, bookId);
      setEditingBook(meta);
      setEditTitle(meta.title);
      setEditAuthor(meta.author || '');
      setEditGenreId(meta.genre_id || '');
      setEditSubGenreId(meta.sub_genre_id || '');
      setEditTense(meta.settings?.tense || '');
      setEditPerspective(meta.settings?.perspective || '');
      setEditTargetWords(String(meta.target_word_count || 80000));
      setEditError('');
      setEditExpandedSubGenre(null);
    } catch (e) {
      setEditError(String(e));
    }
  };

  const handleSaveEditBook = async () => {
    if (!projectDir || !editingBook || !editTitle.trim()) return;
    setEditError('');
    try {
      const updated: BookMetadata = {
        ...editingBook,
        title: editTitle.trim(),
        author: editAuthor.trim(),
        genre_id: editGenreId,
        sub_genre_id: editSubGenreId,
        target_word_count: parseInt(editTargetWords) || 80000,
        settings: { ...editingBook.settings, tense: editTense, perspective: editPerspective },
      };
      await updateBookMetadata(projectDir, editingBook.id, updated);
      const currentBooks = project?.books || [];
      useProjectStore.getState().updateBooks(
        currentBooks.map((b) => b.id === editingBook.id ? { ...b, title: updated.title, genre_id: updated.genre_id } : b)
      );
      setEditingBook(null);
      loadBookData();
    } catch (e) {
      setEditError(String(e));
    }
  };

  const handleCardClick = (bookId: string) => {
    useProjectStore.getState().setActiveBook(bookId);
  };

  const handleOpenBook = (bookId: string) => {
    useProjectStore.getState().setActiveBook(bookId);
    useProjectStore.getState().setActiveView('book');
  };

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-tertiary)' }}>
        No project loaded
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div style={{ padding: '32px 40px' }}>
        {/* Header */}
        <div className="flex items-start gap-4" style={{ marginBottom: '32px' }}>
          <div className="shrink-0">
            {(() => {
              if (activeBookId && activeBookHasOverview) {
                const data = bookCardData[activeBookId];
                const phaseId = data?.meta
                  ? getCurrentPhaseId(data.meta.phase_progress as Record<string, { status: string }>)
                  : null;
                if (phaseId) return <PhaseIcon phase={phaseId} size={60} />;
              }
              return <SaiplingDashLogo size={60} />;
            })()}
          </div>
          <div className="flex-1 min-w-0">
            {/* Title row: name + edit/delete icons + exit button floated right */}
            <div className="flex items-center gap-2" style={{ marginBottom: '4px' }}>
              <h1 className="text-2xl font-bold truncate" style={{ color: 'var(--text-primary)', minWidth: 0 }}>
                {project.name}
              </h1>
              <button
                onClick={() => setShowEditModal(true)}
                className="flex items-center justify-center shrink-0 hover-icon"
                style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                title="Edit project name and description"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="flex items-center justify-center shrink-0 hover-icon-danger"
                style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                title="Delete project"
              >
                <Trash2 size={14} />
              </button>
              <div className="flex-1" />
              <button
                onClick={handleExitProject}
                className="flex items-center gap-2 rounded-lg text-xs font-medium shrink-0 hover-btn-danger"
                style={{
                  color: 'var(--text-tertiary)',
                  padding: '6px 12px',
                  border: '1px solid var(--border-primary)',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
                title="Close project and return to start"
              >
                <LogOut size={14} style={{ color: 'var(--color-error)' }} />
                Exit Project
              </button>
            </div>
            {/* Description below the title row, spanning full width */}
            {project.description && (
              <p className="text-sm" style={{ color: 'var(--text-tertiary)', marginTop: '2px', lineHeight: '1.5' }}>
                {project.description.length > 500 ? `${project.description.slice(0, 500)}…` : project.description}
              </p>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-3" style={{ marginBottom: '40px' }}>
          <button
            onClick={handleBrainstorm}
            className="flex items-center gap-2 rounded-lg text-sm font-medium hover-btn-primary"
            style={{
              backgroundColor: 'var(--accent)',
              color: 'var(--text-inverse)',
              padding: '10px 20px',
            }}
          >
            {!overviewPath && <Lightbulb size={16} />}
            {overviewPath ? 'Project Overview' : 'Brainstorm'}
          </button>
          <button
            onClick={() => setShowNewBook(true)}
            className="flex items-center gap-2 rounded-lg text-sm font-medium hover-btn"
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-primary)',
              padding: '10px 20px',
            }}
          >
            <Plus size={16} />
            New Book
          </button>

          {/* Current Phase / Book Brainstorm indicator */}
          {overviewPath && activeBookId && (() => {
            if (!activeBookHasOverview) {
              return (
                <>
                  <div className="flex-1" />
                  <button
                    onClick={() => handleOpenBook(activeBookId)}
                    className="flex items-center gap-2 rounded-lg text-sm font-medium hover-btn"
                    style={{
                      backgroundColor: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-primary)',
                      padding: '10px 20px',
                    }}
                    title="Create your book overview via a brainstorming session"
                  >
                    <Lightbulb size={14} style={{ color: 'var(--accent)' }} />
                    <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: '13px' }}>
                      Book Brainstorm
                    </span>
                    <ArrowRight size={14} style={{ color: 'var(--accent)' }} />
                  </button>
                </>
              );
            }
            const data = bookCardData[activeBookId];
            const phaseId = data?.meta
              ? getCurrentPhaseId(data.meta.phase_progress as Record<string, { status: string }>)
              : null;
            if (!phaseId) return null;
            const phaseInfo = PHASES.find((p) => p.id === phaseId);
            if (!phaseInfo) return null;
            const activeBookTitle = project.books.find((b) => b.id === activeBookId)?.title;
            return (
              <>
                <div className="flex-1" />
                <button
                  onClick={() => setActivePhase(phaseId)}
                  className="flex items-center gap-2 rounded-lg text-sm font-medium hover-btn"
                  style={{
                    backgroundColor: 'var(--bg-tertiary)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-primary)',
                    padding: '10px 20px',
                  }}
                  title={`${phaseInfo.question} — ${activeBookTitle ?? 'Active Book'}`}
                >
                  <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Current Phase:</span>
                  <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: '13px' }}>
                    {phaseInfo.label}
                  </span>
                  <ArrowRight size={14} style={{ color: 'var(--accent)' }} />
                </button>
              </>
            );
          })()}
        </div>

        {/* Books Section */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)', marginBottom: '16px' }}>
            Books
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(450px, 1fr))', gap: '12px' }}>
            {project.books.map((book) => {
              const data = bookCardData[book.id];
              const sceneWords = data?.sceneWords ?? 0;
              const totalDocWords = data?.totalDocWords ?? 0;
              const tokenEstimate = Math.round(totalDocWords * 0.75);
              const phase = data?.currentPhase ?? 'Seed';
              const isActive = activeBookId === book.id;

              return (
                <div
                  key={book.id}
                  className="relative text-left rounded-xl transition-all cursor-pointer"
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    border: isActive ? '2px solid var(--accent)' : '1px solid var(--border-primary)',
                    padding: isActive ? '19px' : '20px',
                  }}
                  onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; } }}
                  onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.borderColor = 'var(--border-primary)'; e.currentTarget.style.boxShadow = 'none'; } }}
                  onClick={() => handleCardClick(book.id)}
                >
                  {/* Phase tag + edit icon: top-right */}
                  <div className="absolute flex items-center gap-2" style={{ top: '10px', right: '10px' }}>
                    <span className="text-xs font-semibold" style={{
                      color: '#fff',
                      backgroundColor: 'var(--accent)',
                      padding: '2px 10px',
                      borderRadius: '999px',
                      letterSpacing: '0.02em',
                    }}>
                      {phase}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleOpenEditBook(book.id); }}
                      className="flex items-center justify-center rounded hover-icon"
                      style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: '3px' }}
                      title="Edit book details"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeletingBook({ id: book.id, title: book.title }); }}
                      className="flex items-center justify-center rounded hover-icon-danger"
                      style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: '3px' }}
                      title="Delete book"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {/* Title + icon */}
                  <div style={{ marginBottom: '10px', paddingRight: '140px' }}>
                    <div className="flex items-center gap-2">
                      <BookOpen size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                      <span className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                        {book.title}
                      </span>
                    </div>
                    {data?.logline && (
                      <p className="text-xs" style={{ color: 'var(--text-tertiary)', marginTop: '4px', paddingLeft: '26px', lineHeight: '1.5' }}>
                        {data.logline}
                      </p>
                    )}
                  </div>

                  {/* Token estimate + word count */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      ~{tokenEstimate.toLocaleString()} tokens in full context
                    </span>
                    <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                      {sceneWords.toLocaleString()} / {(data?.meta?.target_word_count ?? 0).toLocaleString()} words
                    </span>
                  </div>

                  {/* Active indicator + Open Book button */}
                  {isActive && (
                    <div className="flex items-center" style={{ marginTop: '8px' }}>
                      <div className="flex items-center gap-1">
                        <Check size={12} style={{ color: 'var(--accent)' }} />
                        <span className="text-xs font-medium" style={{ color: 'var(--accent)' }}>Active</span>
                      </div>
                      <div className="flex-1" />
                      <button
                        onClick={(e) => { e.stopPropagation(); handleOpenBook(book.id); }}
                        className="flex items-center gap-1.5 rounded-md text-xs font-medium hover-btn-primary"
                        style={{
                          backgroundColor: 'var(--accent)',
                          color: 'var(--text-inverse)',
                          padding: '5px 12px',
                        }}
                      >
                        Open Book
                        <ArrowRight size={12} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {project.books.length === 0 && (
              <div
                className="rounded-xl text-center text-sm"
                style={{
                  border: '2px dashed var(--border-primary)',
                  color: 'var(--text-tertiary)',
                  padding: '32px 20px',
                }}
              >
                No books yet. Click "New Book" to get started.
              </div>
            )}
          </div>
        </div>
      </div>

      {showEditModal && (
        <EditProjectModal onClose={() => setShowEditModal(false)} />
      )}
      {showDeleteModal && (
        <DeleteProjectModal onClose={() => setShowDeleteModal(false)} />
      )}
      {deletingBook && (
        <DeleteBookModal
          bookId={deletingBook.id}
          bookTitle={deletingBook.title}
          onClose={() => setDeletingBook(null)}
          onDeleted={() => {
            const currentBooks = project?.books || [];
            const remaining = currentBooks.filter((b) => b.id !== deletingBook.id);
            useProjectStore.getState().updateBooks(remaining);
            if (activeBookId === deletingBook.id) {
              const nextBook = remaining.length > 0 ? remaining[0].id : null;
              useProjectStore.getState().setActiveBook(nextBook);
            }
            loadBookData();
          }}
        />
      )}
      {showGettingStarted && overviewChecked && !overviewPath && (
        <GettingStartedModal
          onStart={() => {
            setShowGettingStarted(false);
            handleBrainstorm();
          }}
          onDismiss={() => setShowGettingStarted(false)}
        />
      )}
      {showContinueModal && activeBookId && (() => {
        const data = bookCardData[activeBookId];
        const phaseId = data?.meta
          ? getCurrentPhaseId(data.meta.phase_progress as Record<string, { status: string }>)
          : null;
        if (!phaseId) return null;
        const phaseInfo = PHASES.find((p) => p.id === phaseId);
        if (!phaseInfo) return null;
        const bookTitle = project?.books.find((b) => b.id === activeBookId)?.title ?? 'Active Book';
        return (
          <ContinueWorkingModal
            phaseInfo={phaseInfo}
            phaseId={phaseId}
            bookTitle={bookTitle}
            onGoToPhase={() => {
              setShowContinueModal(false);
              setActivePhase(phaseId);
            }}
            onAddCharacter={() => {
              setShowContinueModal(false);
              useProjectStore.getState().setActiveView('characters');
            }}
            onAddWorldEntry={() => {
              setShowContinueModal(false);
              useProjectStore.getState().setActiveView('world');
            }}
            onDismiss={() => {
              setShowContinueModal(false);
              setContinueDismissed(true);
            }}
          />
        );
      })()}

      {/* New Book Modal — Two-Panel */}
      {showNewBook && (() => {
        const selectedGenre = genres.find((g) => g.id === newBookGenreId) || null;
        const formatWordCount = (n: number) => n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);
        return (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000 }}
          onClick={() => setShowNewBook(false)}
        >
          <div
            className="rounded-xl flex"
            style={{
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-primary)',
              boxShadow: 'var(--shadow-lg)',
              width: '780px',
              maxWidth: '95vw',
              maxHeight: '92vh',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Left Panel — Form */}
            <div className="flex flex-col" style={{ width: '340px', padding: '24px', borderRight: '1px solid var(--border-primary)', flexShrink: 0 }}>
              <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>New Book</h3>
                <button onClick={() => setShowNewBook(false)} className="hover-icon" style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                  <X size={16} />
                </button>
              </div>

              {bookError && (
                <div className="rounded-lg text-xs" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--color-error)', padding: '8px 12px', marginBottom: '12px' }}>
                  {bookError}
                </div>
              )}

              <div className="flex-1 overflow-y-auto" style={{ display: 'flex', flexDirection: 'column', gap: '12px', margin: '0 -4px', padding: '0 4px' }}>
                <div>
                  <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>Title</label>
                  <input
                    ref={titleInputRef}
                    value={newBookTitle}
                    onChange={(e) => setNewBookTitle(e.target.value)}
                    placeholder="Book title"
                    className="w-full rounded-lg text-sm"
                    style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)', padding: '8px 12px' }}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>Author</label>
                  <input
                    value={newBookAuthor}
                    onChange={(e) => setNewBookAuthor(e.target.value)}
                    placeholder="Author name"
                    className="w-full rounded-lg text-sm"
                    style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)', padding: '8px 12px' }}
                  />
                </div>

                {/* Genre list */}
                <div>
                  <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)', marginBottom: '6px' }}>Genre</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '140px', overflowY: 'auto', border: '1px solid var(--border-primary)', borderRadius: '8px', padding: '4px 6px' }}>
                    {genres.map((g) => (
                      <button
                        key={g.id}
                        onClick={() => { setNewBookGenreId(g.id); setNewBookSubGenreId(''); setExpandedSubGenre(null); setNewBookTargetWords(String(Math.round((g.novel_word_count_min + g.novel_word_count_max) / 2))); }}
                        className="text-left text-xs rounded-md transition-colors"
                        style={{
                          padding: '6px 10px',
                          backgroundColor: newBookGenreId === g.id ? 'var(--accent-subtle)' : 'transparent',
                          color: newBookGenreId === g.id ? 'var(--accent)' : 'var(--text-primary)',
                          fontWeight: newBookGenreId === g.id ? 600 : 400,
                          border: 'none',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => { if (newBookGenreId !== g.id) e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
                        onMouseLeave={(e) => { if (newBookGenreId !== g.id) e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        {g.name}
                      </button>
                    ))}
                    <button
                      onClick={() => { setNewBookGenreId('other'); setNewBookSubGenreId(''); setExpandedSubGenre(null); setNewBookTargetWords('80000'); }}
                      className="text-left text-xs rounded-md transition-colors"
                      style={{
                        padding: '6px 10px',
                        backgroundColor: newBookGenreId === 'other' ? 'var(--accent-subtle)' : 'transparent',
                        color: newBookGenreId === 'other' ? 'var(--accent)' : 'var(--text-primary)',
                        fontWeight: newBookGenreId === 'other' ? 600 : 400,
                        border: 'none',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => { if (newBookGenreId !== 'other') e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
                      onMouseLeave={(e) => { if (newBookGenreId !== 'other') e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      Other
                    </button>
                  </div>
                </div>

                {/* Tense */}
                <div>
                  <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>Tense</label>
                  <select
                    value={newBookTense}
                    onChange={(e) => setNewBookTense(e.target.value)}
                    className="w-full rounded-lg text-sm"
                    style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)', padding: '8px 12px' }}
                  >
                    <option value="">Not decided yet</option>
                    <option value="past">Past Tense</option>
                    <option value="present">Present Tense</option>
                    <option value="mixed">Mixed (Past + Present)</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {/* Perspective */}
                <div>
                  <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>Perspective</label>
                  <select
                    value={newBookPerspective}
                    onChange={(e) => setNewBookPerspective(e.target.value)}
                    className="w-full rounded-lg text-sm"
                    style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)', padding: '8px 12px' }}
                  >
                    <option value="">Not decided yet</option>
                    <option value="first">First Person</option>
                    <option value="first_multiple">First Person (Multiple)</option>
                    <option value="third_close">Third Person Close</option>
                    <option value="third_close_multiple">Third Person Close (Multiple)</option>
                    <option value="third_limited">Third Person Limited</option>
                    <option value="third_limited_multiple">Third Person Limited (Multiple)</option>
                    <option value="third_omniscient">Third Person Omniscient</option>
                    <option value="second">Second Person</option>
                    <option value="mixed">Mixed Perspectives</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {/* Target Word Count */}
                <div>
                  <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>Target Word Count</label>
                  <input
                    value={newBookTargetWords}
                    onChange={(e) => setNewBookTargetWords(e.target.value)}
                    type="number"
                    min="0"
                    step="1000"
                    className="w-full rounded-lg text-sm"
                    style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)', padding: '8px 12px' }}
                  />
                </div>
              </div>
            </div>

            {/* Right Panel — Genre Detail */}
            <div className="flex-1 flex flex-col" style={{ padding: '24px' }}>
              <div className="flex-1 overflow-y-auto">
              {!selectedGenre && newBookGenreId !== 'other' ? (
                <div className="flex flex-col items-center justify-center h-full" style={{ color: 'var(--text-tertiary)' }}>
                  <BookOpen size={28} style={{ marginBottom: '10px', opacity: 0.4 }} />
                  <p className="text-sm">Select a genre to see details</p>
                </div>
              ) : newBookGenreId === 'other' ? (
                <div className="flex flex-col items-center justify-center h-full" style={{ color: 'var(--text-tertiary)' }}>
                  <BookOpen size={28} style={{ marginBottom: '10px', opacity: 0.4 }} />
                  <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Other</p>
                  <p className="text-xs" style={{ marginTop: '6px', textAlign: 'center', maxWidth: '280px' }}>
                    Your genre isn't listed? No problem — the AI will adapt based on your brainstorm content. You can always change this later.
                  </p>
                </div>
              ) : selectedGenre && (
                <div>
                  <h4 className="text-sm font-semibold" style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>{selectedGenre.name}</h4>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '16px' }}>{selectedGenre.description}</p>

                  {/* Word count ranges */}
                  <div className="flex gap-4" style={{ marginBottom: '20px' }}>
                    <div className="rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)', padding: '10px 14px', flex: 1 }}>
                      <div className="text-xs" style={{ color: 'var(--text-tertiary)', marginBottom: '2px' }}>Novel Length</div>
                      <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {formatWordCount(selectedGenre.novel_word_count_min)}–{formatWordCount(selectedGenre.novel_word_count_max)} words
                      </div>
                    </div>
                    <div className="rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)', padding: '10px 14px', flex: 1 }}>
                      <div className="text-xs" style={{ color: 'var(--text-tertiary)', marginBottom: '2px' }}>Chapter Length</div>
                      <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {formatWordCount(selectedGenre.chapter_word_count_min)}–{formatWordCount(selectedGenre.chapter_word_count_max)} words
                      </div>
                    </div>
                  </div>

                  {/* Sub-genres */}
                  {selectedGenre.sub_genres.length > 0 && (
                    <div>
                      <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>
                        Sub-genre <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>(optional)</span>
                      </label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {selectedGenre.sub_genres.map((sg) => (
                          <div key={sg.id}>
                            <button
                              onClick={() => {
                                if (newBookSubGenreId === sg.id) { setNewBookSubGenreId(''); setExpandedSubGenre(null); }
                                else { setNewBookSubGenreId(sg.id); setExpandedSubGenre(sg.id); }
                              }}
                              className="flex items-center gap-2 w-full text-left text-xs rounded-md transition-colors"
                              style={{
                                padding: '6px 10px',
                                backgroundColor: newBookSubGenreId === sg.id ? 'var(--accent-subtle)' : 'transparent',
                                color: newBookSubGenreId === sg.id ? 'var(--accent)' : 'var(--text-primary)',
                                fontWeight: newBookSubGenreId === sg.id ? 600 : 400,
                                border: 'none',
                                cursor: 'pointer',
                              }}
                              onMouseEnter={(e) => { if (newBookSubGenreId !== sg.id) e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
                              onMouseLeave={(e) => { if (newBookSubGenreId !== sg.id) e.currentTarget.style.backgroundColor = 'transparent'; }}
                            >
                              <ChevronRight size={12} style={{ transform: expandedSubGenre === sg.id ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }} />
                              {sg.name}
                            </button>
                            {expandedSubGenre === sg.id && (
                              <div className="text-xs" style={{ color: 'var(--text-tertiary)', padding: '2px 10px 8px 28px', lineHeight: '1.5' }}>
                                {sg.description}
                              </div>
                            )}
                          </div>
                        ))}
                        <button
                          onClick={() => {
                            if (newBookSubGenreId === 'other') { setNewBookSubGenreId(''); setExpandedSubGenre(null); }
                            else { setNewBookSubGenreId('other'); setExpandedSubGenre(null); }
                          }}
                          className="flex items-center gap-2 w-full text-left text-xs rounded-md transition-colors"
                          style={{
                            padding: '6px 10px',
                            backgroundColor: newBookSubGenreId === 'other' ? 'var(--accent-subtle)' : 'transparent',
                            color: newBookSubGenreId === 'other' ? 'var(--accent)' : 'var(--text-primary)',
                            fontWeight: newBookSubGenreId === 'other' ? 600 : 400,
                            border: 'none',
                            cursor: 'pointer',
                          }}
                          onMouseEnter={(e) => { if (newBookSubGenreId !== 'other') e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
                          onMouseLeave={(e) => { if (newBookSubGenreId !== 'other') e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                          <ChevronRight size={12} style={{ opacity: 0 }} />
                          Other
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              </div>
              <div className="flex gap-2 justify-end" style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-primary)' }}>
                <button
                  onClick={() => setShowNewBook(false)}
                  className="rounded-lg text-xs font-medium hover-btn"
                  style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-primary)', padding: '8px 16px' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateBook}
                  disabled={!newBookTitle.trim()}
                  className="rounded-lg text-xs font-medium hover-btn-primary"
                  style={{ backgroundColor: 'var(--accent)', color: 'var(--text-inverse)', border: 'none', padding: '8px 16px', opacity: newBookTitle.trim() ? 1 : 0.5 }}
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Edit Book Modal — Two-Panel */}
      {editingBook && (() => {
        const editSelectedGenre = genres.find((g) => g.id === editGenreId) || null;
        const formatWC = (n: number) => n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);
        return (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000 }}
          onClick={() => setEditingBook(null)}
        >
          <div
            className="rounded-xl flex"
            style={{
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-primary)',
              boxShadow: 'var(--shadow-lg)',
              width: '780px',
              maxWidth: '95vw',
              maxHeight: '92vh',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Left Panel — Form */}
            <div className="flex flex-col" style={{ width: '340px', padding: '24px', borderRight: '1px solid var(--border-primary)', flexShrink: 0 }}>
              <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Edit Book</h3>
                <button onClick={() => setEditingBook(null)} className="hover-icon" style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                  <X size={16} />
                </button>
              </div>

              {editError && (
                <div className="rounded-lg text-xs" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--color-error)', padding: '8px 12px', marginBottom: '12px' }}>
                  {editError}
                </div>
              )}

              <div className="flex-1 overflow-y-auto" style={{ display: 'flex', flexDirection: 'column', gap: '12px', margin: '0 -4px', padding: '0 4px' }}>
                <div>
                  <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>Title</label>
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Book title"
                    className="w-full rounded-lg text-sm"
                    style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)', padding: '8px 12px' }}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>Author</label>
                  <input
                    value={editAuthor}
                    onChange={(e) => setEditAuthor(e.target.value)}
                    placeholder="Author name"
                    className="w-full rounded-lg text-sm"
                    style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)', padding: '8px 12px' }}
                  />
                </div>

                {/* Genre list */}
                <div>
                  <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)', marginBottom: '6px' }}>Genre</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '140px', overflowY: 'auto', border: '1px solid var(--border-primary)', borderRadius: '8px', padding: '4px 6px' }}>
                    {genres.map((g) => (
                      <button
                        key={g.id}
                        onClick={() => { setEditGenreId(g.id); setEditSubGenreId(''); setEditExpandedSubGenre(null); }}
                        className="text-left text-xs rounded-md transition-colors"
                        style={{
                          padding: '6px 10px',
                          backgroundColor: editGenreId === g.id ? 'var(--accent-subtle)' : 'transparent',
                          color: editGenreId === g.id ? 'var(--accent)' : 'var(--text-primary)',
                          fontWeight: editGenreId === g.id ? 600 : 400,
                          border: 'none',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => { if (editGenreId !== g.id) e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
                        onMouseLeave={(e) => { if (editGenreId !== g.id) e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        {g.name}
                      </button>
                    ))}
                    <button
                      onClick={() => { setEditGenreId('other'); setEditSubGenreId(''); setEditExpandedSubGenre(null); }}
                      className="text-left text-xs rounded-md transition-colors"
                      style={{
                        padding: '6px 10px',
                        backgroundColor: editGenreId === 'other' ? 'var(--accent-subtle)' : 'transparent',
                        color: editGenreId === 'other' ? 'var(--accent)' : 'var(--text-primary)',
                        fontWeight: editGenreId === 'other' ? 600 : 400,
                        border: 'none',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => { if (editGenreId !== 'other') e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
                      onMouseLeave={(e) => { if (editGenreId !== 'other') e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      Other
                    </button>
                  </div>
                </div>

                {/* Tense */}
                <div>
                  <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>Tense</label>
                  <select
                    value={editTense}
                    onChange={(e) => setEditTense(e.target.value)}
                    className="w-full rounded-lg text-sm"
                    style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)', padding: '8px 12px' }}
                  >
                    <option value="">Not decided yet</option>
                    <option value="past">Past Tense</option>
                    <option value="present">Present Tense</option>
                    <option value="mixed">Mixed (Past + Present)</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {/* Perspective */}
                <div>
                  <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>Perspective</label>
                  <select
                    value={editPerspective}
                    onChange={(e) => setEditPerspective(e.target.value)}
                    className="w-full rounded-lg text-sm"
                    style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)', padding: '8px 12px' }}
                  >
                    <option value="">Not decided yet</option>
                    <option value="first">First Person</option>
                    <option value="first_multiple">First Person (Multiple)</option>
                    <option value="third_close">Third Person Close</option>
                    <option value="third_close_multiple">Third Person Close (Multiple)</option>
                    <option value="third_limited">Third Person Limited</option>
                    <option value="third_limited_multiple">Third Person Limited (Multiple)</option>
                    <option value="third_omniscient">Third Person Omniscient</option>
                    <option value="second">Second Person</option>
                    <option value="mixed">Mixed Perspectives</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {/* Target Word Count */}
                <div>
                  <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>Target Word Count</label>
                  <input
                    value={editTargetWords}
                    onChange={(e) => setEditTargetWords(e.target.value)}
                    type="number"
                    min="0"
                    step="1000"
                    className="w-full rounded-lg text-sm"
                    style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)', padding: '8px 12px' }}
                  />
                </div>
              </div>
            </div>

            {/* Right Panel — Genre Detail */}
            <div className="flex-1 flex flex-col" style={{ padding: '24px' }}>
              <div className="flex-1 overflow-y-auto">
              {!editSelectedGenre && editGenreId !== 'other' ? (
                <div className="flex flex-col items-center justify-center h-full" style={{ color: 'var(--text-tertiary)' }}>
                  <BookOpen size={28} style={{ marginBottom: '10px', opacity: 0.4 }} />
                  <p className="text-sm">Select a genre to see details</p>
                </div>
              ) : editGenreId === 'other' ? (
                <div className="flex flex-col items-center justify-center h-full" style={{ color: 'var(--text-tertiary)' }}>
                  <BookOpen size={28} style={{ marginBottom: '10px', opacity: 0.4 }} />
                  <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Other</p>
                  <p className="text-xs" style={{ marginTop: '6px', textAlign: 'center', maxWidth: '280px' }}>
                    Your genre isn't listed? No problem — the AI will adapt based on your brainstorm content. You can always change this later.
                  </p>
                </div>
              ) : editSelectedGenre && (
                <div>
                  <h4 className="text-sm font-semibold" style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>{editSelectedGenre.name}</h4>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '16px' }}>{editSelectedGenre.description}</p>

                  {/* Word count ranges */}
                  <div className="flex gap-4" style={{ marginBottom: '20px' }}>
                    <div className="rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)', padding: '10px 14px', flex: 1 }}>
                      <div className="text-xs" style={{ color: 'var(--text-tertiary)', marginBottom: '2px' }}>Novel Length</div>
                      <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {formatWC(editSelectedGenre.novel_word_count_min)}–{formatWC(editSelectedGenre.novel_word_count_max)} words
                      </div>
                    </div>
                    <div className="rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)', padding: '10px 14px', flex: 1 }}>
                      <div className="text-xs" style={{ color: 'var(--text-tertiary)', marginBottom: '2px' }}>Chapter Length</div>
                      <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {formatWC(editSelectedGenre.chapter_word_count_min)}–{formatWC(editSelectedGenre.chapter_word_count_max)} words
                      </div>
                    </div>
                  </div>

                  {/* Sub-genres */}
                  {editSelectedGenre.sub_genres.length > 0 && (
                    <div>
                      <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>
                        Sub-genre <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>(optional)</span>
                      </label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {editSelectedGenre.sub_genres.map((sg) => (
                          <div key={sg.id}>
                            <button
                              onClick={() => {
                                if (editSubGenreId === sg.id) { setEditSubGenreId(''); setEditExpandedSubGenre(null); }
                                else { setEditSubGenreId(sg.id); setEditExpandedSubGenre(sg.id); }
                              }}
                              className="flex items-center gap-2 w-full text-left text-xs rounded-md transition-colors"
                              style={{
                                padding: '6px 10px',
                                backgroundColor: editSubGenreId === sg.id ? 'var(--accent-subtle)' : 'transparent',
                                color: editSubGenreId === sg.id ? 'var(--accent)' : 'var(--text-primary)',
                                fontWeight: editSubGenreId === sg.id ? 600 : 400,
                                border: 'none',
                                cursor: 'pointer',
                              }}
                              onMouseEnter={(e) => { if (editSubGenreId !== sg.id) e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
                              onMouseLeave={(e) => { if (editSubGenreId !== sg.id) e.currentTarget.style.backgroundColor = 'transparent'; }}
                            >
                              <ChevronRight size={12} style={{ transform: editExpandedSubGenre === sg.id ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }} />
                              {sg.name}
                            </button>
                            {editExpandedSubGenre === sg.id && (
                              <div className="text-xs" style={{ color: 'var(--text-tertiary)', padding: '2px 10px 8px 28px', lineHeight: '1.5' }}>
                                {sg.description}
                              </div>
                            )}
                          </div>
                        ))}
                        <button
                          onClick={() => {
                            if (editSubGenreId === 'other') { setEditSubGenreId(''); setEditExpandedSubGenre(null); }
                            else { setEditSubGenreId('other'); setEditExpandedSubGenre(null); }
                          }}
                          className="flex items-center gap-2 w-full text-left text-xs rounded-md transition-colors"
                          style={{
                            padding: '6px 10px',
                            backgroundColor: editSubGenreId === 'other' ? 'var(--accent-subtle)' : 'transparent',
                            color: editSubGenreId === 'other' ? 'var(--accent)' : 'var(--text-primary)',
                            fontWeight: editSubGenreId === 'other' ? 600 : 400,
                            border: 'none',
                            cursor: 'pointer',
                          }}
                          onMouseEnter={(e) => { if (editSubGenreId !== 'other') e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
                          onMouseLeave={(e) => { if (editSubGenreId !== 'other') e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                          <ChevronRight size={12} style={{ opacity: 0 }} />
                          Other
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              </div>
              <div className="flex gap-2 justify-end" style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-primary)' }}>
                <button
                  onClick={() => setEditingBook(null)}
                  className="rounded-lg text-xs font-medium hover-btn"
                  style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-primary)', padding: '8px 16px' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEditBook}
                  disabled={!editTitle.trim()}
                  className="rounded-lg text-xs font-medium hover-btn-primary"
                  style={{ backgroundColor: 'var(--accent)', color: 'var(--text-inverse)', border: 'none', padding: '8px 16px', opacity: editTitle.trim() ? 1 : 0.5 }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
}
