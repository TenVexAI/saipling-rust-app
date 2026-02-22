import { useState, useEffect } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { useAIStore } from '../../stores/aiStore';
import { listDirectory } from '../../utils/tauri';
import { saveProjectChat } from '../../utils/projectChat';
import { BookOpen, Plus, Lightbulb, LogOut, Pencil, Trash2 } from 'lucide-react';
import { SaiplingDashLogo } from './SaiplingDashLogo';
import { EditProjectModal } from './EditProjectModal';
import { DeleteProjectModal } from './DeleteProjectModal';
import { GettingStartedModal } from './GettingStartedModal';

export function Dashboard() {
  const project = useProjectStore((s) => s.project);
  const projectDir = useProjectStore((s) => s.projectDir);
  const clearProjectStore = useProjectStore((s) => s.clearProject);
  const setActiveFile = useProjectStore((s) => s.setActiveFile);
  const setActiveSkill = useAIStore((s) => s.setActiveSkill);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [overviewPath, setOverviewPath] = useState<string | null>(null);
  const [overviewChecked, setOverviewChecked] = useState(false);
  const [showGettingStarted, setShowGettingStarted] = useState(false);

  const handleExitProject = async () => {
    if (projectDir) await saveProjectChat(projectDir);
    clearProjectStore();
  };

  useEffect(() => {
    if (!projectDir) return;
    const overviewDir = `${projectDir}\\project_overview`;
    listDirectory(overviewDir)
      .then((entries) => {
        const overview = entries.find((e) => /^project_overview(_v\d+)?\.md$/.test(e.name));
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

  const handleBrainstorm = () => {
    if (!projectDir) return;
    setActiveSkill('brainstorm');
    setActiveFile(overviewPath ?? `${projectDir}\\project_overview\\project_brainstorm_notes.md`);
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
            {project.books.map((book) => (
              <button
                key={book.id}
                className="text-left rounded-xl transition-all"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--border-primary)',
                  padding: '20px',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-primary)'; e.currentTarget.style.boxShadow = 'none'; }}
                onClick={() => {
                  useProjectStore.getState().setActiveBook(book.id);
                  useProjectStore.getState().setActiveView('book');
                }}
              >
                <div className="flex items-center gap-2" style={{ marginBottom: '8px' }}>
                  <BookOpen size={18} style={{ color: 'var(--accent)' }} />
                  <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                    {book.title}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    0 words
                  </span>
                  <span className="text-xs" style={{
                    color: 'var(--color-magenta)',
                    backgroundColor: 'var(--bg-tertiary)',
                    padding: '2px 8px',
                    borderRadius: '999px',
                  }}>
                    Seed
                  </span>
                </div>
              </button>
            ))}

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
    </div>
  );
}
