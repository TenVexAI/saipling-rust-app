import { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import { deleteProject } from '../../utils/tauri';

interface DeleteProjectModalProps {
  onClose: () => void;
}

export function DeleteProjectModal({ onClose }: DeleteProjectModalProps) {
  const project = useProjectStore((s) => s.project);
  const projectDir = useProjectStore((s) => s.projectDir);
  const clearProject = useProjectStore((s) => s.clearProject);
  const [confirmation, setConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const expectedPhrase = `delete ${project?.name || ''}`;
  const isConfirmed = confirmation.trim().toLowerCase() === expectedPhrase.toLowerCase();

  const handleDelete = async () => {
    if (!projectDir || !isConfirmed) return;
    setDeleting(true);
    setError('');
    try {
      await deleteProject(projectDir);
      clearProject();
      onClose();
    } catch (e) {
      setError(String(e));
      setDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000 }}
      onClick={onClose}
    >
      <div
        className="rounded-xl"
        style={{
          backgroundColor: 'var(--bg-elevated)',
          border: '1px solid var(--border-primary)',
          padding: '24px',
          width: '440px',
          maxWidth: '90vw',
          boxShadow: 'var(--shadow-lg)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between" style={{ marginBottom: '20px' }}>
          <div className="flex items-center gap-2">
            <AlertTriangle size={20} style={{ color: 'var(--color-error)' }} />
            <h2 className="text-lg font-semibold" style={{ color: 'var(--color-error)' }}>
              Delete Project
            </h2>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center transition-colors"
            style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
          >
            <X size={18} />
          </button>
        </div>

        <div className="rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)', padding: '14px', marginBottom: '16px' }}>
          <p className="text-sm" style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>
            This will permanently delete <strong>{project?.name}</strong> and all of its files.
          </p>
          <p className="text-xs" style={{ color: 'var(--color-error)' }}>
            This action cannot be undone.
          </p>
        </div>

        {error && (
          <div className="rounded-lg text-xs" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--color-error)', padding: '10px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: '16px' }}>
          <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)', marginBottom: '6px' }}>
            Type <strong style={{ color: 'var(--text-primary)' }}>delete {project?.name}</strong> to confirm
          </label>
          <input
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            placeholder={`delete ${project?.name}`}
            className="w-full rounded-lg text-sm"
            style={{
              backgroundColor: 'var(--bg-input)',
              border: '1px solid var(--border-primary)',
              color: 'var(--text-primary)',
              padding: '10px 12px',
            }}
            autoFocus
          />
        </div>

        <div className="flex justify-end" style={{ gap: '8px' }}>
          <button
            onClick={onClose}
            className="rounded-lg text-sm"
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-primary)',
              padding: '8px 16px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={!isConfirmed || deleting}
            className="rounded-lg text-sm font-medium"
            style={{
              backgroundColor: isConfirmed && !deleting ? 'var(--color-error)' : 'var(--bg-tertiary)',
              color: isConfirmed && !deleting ? '#fff' : 'var(--text-tertiary)',
              opacity: isConfirmed && !deleting ? 1 : 0.5,
              padding: '8px 16px',
              cursor: isConfirmed && !deleting ? 'pointer' : 'default',
              border: 'none',
            }}
          >
            {deleting ? 'Deleting...' : 'Delete Project'}
          </button>
        </div>
      </div>
    </div>
  );
}
