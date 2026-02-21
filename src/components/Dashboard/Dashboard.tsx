import { useProjectStore } from '../../stores/projectStore';
import { BookOpen, Plus, ArrowRight, Sparkles, LogOut } from 'lucide-react';

export function Dashboard() {
  const project = useProjectStore((s) => s.project);
  const clearProject = useProjectStore((s) => s.clearProject);

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
        <div style={{ marginBottom: '32px' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3" style={{ marginBottom: '4px' }}>
              <Sparkles size={20} style={{ color: 'var(--color-magenta)' }} />
              <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {project.name}
              </h1>
            </div>
            <button
              onClick={clearProject}
              className="flex items-center gap-2 rounded-lg text-xs font-medium transition-colors"
              style={{
                color: 'var(--text-tertiary)',
                padding: '6px 12px',
                border: '1px solid var(--border-primary)',
                backgroundColor: 'transparent',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--text-tertiary)';
              }}
              title="Close project and return to start"
            >
              <LogOut size={14} />
              Exit Project
            </button>
          </div>
          {project.genre && (
            <p className="text-sm" style={{ color: 'var(--text-tertiary)', marginLeft: '32px' }}>
              {project.genre}
            </p>
          )}
        </div>

        {/* Quick Actions */}
        <div className="flex gap-3" style={{ marginBottom: '40px' }}>
          <button
            className="flex items-center gap-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: 'var(--accent)',
              color: 'var(--text-inverse)',
              padding: '10px 20px',
            }}
          >
            <ArrowRight size={16} />
            Continue Writing
          </button>
          <button
            className="flex items-center gap-2 rounded-lg text-sm font-medium transition-colors"
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
    </div>
  );
}
