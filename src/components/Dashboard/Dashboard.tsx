import { useState, useEffect, useCallback } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { useAIStore } from '../../stores/aiStore';
import { listDirectory, createBook, getBookWordCount, getBookTotalDocWords, getBookMetadata, updateBookMetadata } from '../../utils/tauri';
import { saveProjectChat } from '../../utils/projectChat';
import { BookOpen, Plus, Lightbulb, LogOut, Pencil, Trash2, ExternalLink, Check } from 'lucide-react';
import { SaiplingDashLogo } from './SaiplingDashLogo';
import { EditProjectModal } from './EditProjectModal';
import { DeleteProjectModal } from './DeleteProjectModal';
import { GettingStartedModal } from './GettingStartedModal';
import type { BookMetadata } from '../../types/project';

interface BookCardData {
  sceneWords: number;
  totalDocWords: number;
  currentPhase: string;
  meta: BookMetadata | null;
}

const PHASE_NAMES: Record<string, string> = {
  'phase-1-seed': 'Seed',
  'phase-2-root': 'Root',
  'phase-3-sprout': 'Sprout',
  'phase-4-flourish': 'Flourish',
  'phase-5-bloom': 'Bloom',
};

const PHASE_ORDER = ['phase-1-seed', 'phase-2-root', 'phase-3-sprout', 'phase-4-flourish', 'phase-5-bloom'];

function getCurrentPhase(phaseProgress: Record<string, { status: string }>): string {
  for (let i = PHASE_ORDER.length - 1; i >= 0; i--) {
    const p = phaseProgress[PHASE_ORDER[i]];
    if (p && p.status === 'complete') {
      return PHASE_ORDER[i + 1] ? PHASE_NAMES[PHASE_ORDER[i + 1]] : 'Complete';
    }
    if (p && p.status === 'in_progress') {
      return PHASE_NAMES[PHASE_ORDER[i]];
    }
  }
  return 'Seed';
}

export function Dashboard() {
  const project = useProjectStore((s) => s.project);
  const projectDir = useProjectStore((s) => s.projectDir);
  const activeBookId = useProjectStore((s) => s.activeBookId);
  const clearProjectStore = useProjectStore((s) => s.clearProject);
  const setActiveFile = useProjectStore((s) => s.setActiveFile);
  const setActiveSkill = useAIStore((s) => s.setActiveSkill);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [overviewPath, setOverviewPath] = useState<string | null>(null);
  const [overviewChecked, setOverviewChecked] = useState(false);
  const [showGettingStarted, setShowGettingStarted] = useState(false);
  const [showNewBook, setShowNewBook] = useState(false);
  const [newBookTitle, setNewBookTitle] = useState('');
  const [newBookAuthor, setNewBookAuthor] = useState('');
  const [newBookGenre, setNewBookGenre] = useState('');
  const [bookError, setBookError] = useState('');
  const [bookCardData, setBookCardData] = useState<Record<string, BookCardData>>({});
  const [editingBook, setEditingBook] = useState<BookMetadata | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editAuthor, setEditAuthor] = useState('');
  const [editGenre, setEditGenre] = useState('');
  const [editTargetWords, setEditTargetWords] = useState('');
  const [editError, setEditError] = useState('');

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
        data[book.id] = {
          sceneWords: wc.book_total,
          totalDocWords: totalWords,
          currentPhase: getCurrentPhase(meta.phase_progress as Record<string, { status: string }>),
          meta,
        };
      } catch {
        data[book.id] = { sceneWords: 0, totalDocWords: 0, currentPhase: 'Seed', meta: null };
      }
    }
    setBookCardData(data);
  }, [projectDir, project]);

  useEffect(() => {
    loadBookData();
  }, [loadBookData]);

  const handleBrainstorm = () => {
    if (!projectDir) return;
    setActiveSkill('brainstorm');
    setActiveFile(overviewPath ?? `${projectDir}\\overview\\brainstorm.md`);
  };

  const handleCreateBook = async () => {
    if (!projectDir || !project || !newBookTitle.trim()) return;
    setBookError('');
    try {
      const meta = await createBook(projectDir, newBookTitle.trim(), newBookAuthor.trim(), newBookGenre);
      useProjectStore.getState().updateBooks([
        ...project.books,
        { id: meta.id, title: meta.title, sort_order: meta.sort_order, genre: meta.genre },
      ]);
      setShowNewBook(false);
      setNewBookTitle('');
      setNewBookAuthor('');
      setNewBookGenre('');
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
      setEditGenre(meta.genre || '');
      setEditTargetWords(String(meta.target_word_count || 80000));
      setEditError('');
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
        genre: editGenre,
        target_word_count: parseInt(editTargetWords) || 80000,
      };
      await updateBookMetadata(projectDir, editingBook.id, updated);
      // Update the book ref in project store
      const currentBooks = project?.books || [];
      useProjectStore.getState().updateBooks(
        currentBooks.map((b) => b.id === editingBook.id ? { ...b, title: updated.title, genre: updated.genre } : b)
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
      <div className="max-w-4xl mx-auto" style={{ padding: '32px 40px' }}>
        {/* Header */}
        <div className="flex items-start gap-4" style={{ marginBottom: '32px' }}>
          <div className="shrink-0">
            <SaiplingDashLogo size={60} />
          </div>
          <div className="flex-1 min-w-0">
            {/* Title row: name + edit/delete icons + exit button floated right */}
            <div className="flex items-center gap-2" style={{ marginBottom: '4px' }}>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                {project.name.length > 35 ? `${project.name.slice(0, 35)}…` : project.name}
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
        </div>

        {/* Books Section */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)', marginBottom: '16px' }}>
            Books
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ gap: '16px' }}>
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
                  {/* Action icons: top-right */}
                  <div className="absolute flex flex-col gap-1" style={{ top: '10px', right: '10px' }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleOpenEditBook(book.id); }}
                      className="flex items-center justify-center rounded hover-icon"
                      style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: '3px' }}
                      title="Edit book details"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleOpenBook(book.id); }}
                      className="flex items-center justify-center rounded hover-icon"
                      style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: '3px' }}
                      title="Open book page"
                    >
                      <ExternalLink size={13} />
                    </button>
                  </div>

                  {/* Title + icon */}
                  <div className="flex items-center gap-2" style={{ marginBottom: '6px', paddingRight: '28px' }}>
                    <BookOpen size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    <span className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                      {book.title}
                    </span>
                  </div>

                  {/* Genre */}
                  {book.genre && (
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)', marginBottom: '10px' }}>{book.genre}</p>
                  )}

                  {/* Word count + phase tag */}
                  <div className="flex items-center justify-between" style={{ marginBottom: '4px' }}>
                    <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                      {sceneWords.toLocaleString()} words
                    </span>
                    <span className="text-xs font-semibold" style={{
                      color: '#fff',
                      backgroundColor: 'var(--accent)',
                      padding: '2px 10px',
                      borderRadius: '999px',
                      letterSpacing: '0.02em',
                    }}>
                      {phase}
                    </span>
                  </div>

                  {/* Token estimate */}
                  <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    ~{tokenEstimate.toLocaleString()} tokens in full context
                  </span>

                  {/* Active indicator */}
                  {isActive && (
                    <div className="flex items-center gap-1" style={{ marginTop: '8px' }}>
                      <Check size={12} style={{ color: 'var(--accent)' }} />
                      <span className="text-xs font-medium" style={{ color: 'var(--accent)' }}>Active</span>
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
      {showGettingStarted && overviewChecked && !overviewPath && (
        <GettingStartedModal
          onStart={() => {
            setShowGettingStarted(false);
            handleBrainstorm();
          }}
          onDismiss={() => setShowGettingStarted(false)}
        />
      )}

      {/* New Book Modal */}
      {showNewBook && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000 }}
          onClick={() => setShowNewBook(false)}
        >
          <div
            className="rounded-xl"
            style={{
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-primary)',
              boxShadow: 'var(--shadow-lg)',
              padding: '24px',
              maxWidth: '420px',
              width: '90%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)', marginBottom: '16px' }}>
              New Book
            </h3>

            {bookError && (
              <div className="rounded-lg text-xs" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--color-error)', padding: '8px 12px', marginBottom: '12px' }}>
                {bookError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>Title</label>
                <input
                  value={newBookTitle}
                  onChange={(e) => setNewBookTitle(e.target.value)}
                  placeholder="Book title"
                  className="w-full rounded-lg text-sm"
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-primary)',
                    color: 'var(--text-primary)',
                    padding: '8px 12px',
                  }}
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
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-primary)',
                    color: 'var(--text-primary)',
                    padding: '8px 12px',
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>Primary Genre</label>
                <select
                  value={newBookGenre}
                  onChange={(e) => setNewBookGenre(e.target.value)}
                  className="w-full rounded-lg text-sm"
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-primary)',
                    color: 'var(--text-primary)',
                    padding: '8px 12px',
                  }}
                >
                  <option value="">Select genre...</option>
                  <option value="Fantasy">Fantasy</option>
                  <option value="Science Fiction">Science Fiction</option>
                  <option value="Romance">Romance</option>
                  <option value="Mystery">Mystery</option>
                  <option value="Thriller">Thriller</option>
                  <option value="Suspense">Suspense</option>
                  <option value="Horror">Horror</option>
                  <option value="Historical Fiction">Historical Fiction</option>
                  <option value="Literary Fiction">Literary Fiction</option>
                  <option value="Young Adult">Young Adult</option>
                  <option value="Middle Grade">Middle Grade</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 justify-end" style={{ marginTop: '20px' }}>
              <button
                onClick={() => setShowNewBook(false)}
                className="rounded-lg text-xs font-medium hover-btn"
                style={{
                  backgroundColor: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-primary)',
                  padding: '8px 16px',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateBook}
                disabled={!newBookTitle.trim()}
                className="rounded-lg text-xs font-medium hover-btn-primary"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--text-inverse)',
                  border: 'none',
                  padding: '8px 16px',
                  opacity: newBookTitle.trim() ? 1 : 0.5,
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Book Modal */}
      {editingBook && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000 }}
          onClick={() => setEditingBook(null)}
        >
          <div
            className="rounded-xl"
            style={{
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-primary)',
              boxShadow: 'var(--shadow-lg)',
              padding: '24px',
              maxWidth: '420px',
              width: '90%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)', marginBottom: '16px' }}>
              Edit Book
            </h3>

            {editError && (
              <div className="rounded-lg text-xs" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--color-error)', padding: '8px 12px', marginBottom: '12px' }}>
                {editError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>Title</label>
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Book title"
                  className="w-full rounded-lg text-sm"
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-primary)',
                    color: 'var(--text-primary)',
                    padding: '8px 12px',
                  }}
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
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-primary)',
                    color: 'var(--text-primary)',
                    padding: '8px 12px',
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>Primary Genre</label>
                <select
                  value={editGenre}
                  onChange={(e) => setEditGenre(e.target.value)}
                  className="w-full rounded-lg text-sm"
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-primary)',
                    color: 'var(--text-primary)',
                    padding: '8px 12px',
                  }}
                >
                  <option value="">Select genre...</option>
                  <option value="Fantasy">Fantasy</option>
                  <option value="Science Fiction">Science Fiction</option>
                  <option value="Romance">Romance</option>
                  <option value="Mystery">Mystery</option>
                  <option value="Thriller">Thriller</option>
                  <option value="Suspense">Suspense</option>
                  <option value="Horror">Horror</option>
                  <option value="Historical Fiction">Historical Fiction</option>
                  <option value="Literary Fiction">Literary Fiction</option>
                  <option value="Young Adult">Young Adult</option>
                  <option value="Middle Grade">Middle Grade</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>Target Word Count</label>
                <input
                  value={editTargetWords}
                  onChange={(e) => setEditTargetWords(e.target.value)}
                  type="number"
                  min="0"
                  step="1000"
                  className="w-full rounded-lg text-sm"
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-primary)',
                    color: 'var(--text-primary)',
                    padding: '8px 12px',
                  }}
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end" style={{ marginTop: '20px' }}>
              <button
                onClick={() => setEditingBook(null)}
                className="rounded-lg text-xs font-medium hover-btn"
                style={{
                  backgroundColor: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-primary)',
                  padding: '8px 16px',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEditBook}
                disabled={!editTitle.trim()}
                className="rounded-lg text-xs font-medium hover-btn-primary"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--text-inverse)',
                  border: 'none',
                  padding: '8px 16px',
                  opacity: editTitle.trim() ? 1 : 0.5,
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
