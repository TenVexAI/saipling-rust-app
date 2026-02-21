import { useState } from 'react';
import { X } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import { updateProjectMetadata } from '../../utils/tauri';

interface EditProjectModalProps {
  onClose: () => void;
}

export function EditProjectModal({ onClose }: EditProjectModalProps) {
  const project = useProjectStore((s) => s.project);
  const projectDir = useProjectStore((s) => s.projectDir);
  const setProject = useProjectStore((s) => s.setProject);
  const [name, setName] = useState(project?.name || '');
  const [description, setDescription] = useState(project?.description || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!project || !projectDir || !name.trim()) return;
    setSaving(true);
    setError('');
    try {
      const updated = {
        ...project,
        name: name.trim(),
        description: description.trim(),
        modified: new Date().toISOString(),
      };
      await updateProjectMetadata(projectDir, updated);
      setProject(updated, projectDir);
      onClose();
    } catch (e) {
      setError(String(e));
    }
    setSaving(false);
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
          width: '400px',
          maxWidth: '90vw',
          boxShadow: 'var(--shadow-lg)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between" style={{ marginBottom: '20px' }}>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            Edit Project
          </h2>
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

        {error && (
          <div className="rounded-lg text-xs" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--color-error)', padding: '10px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Project Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
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
          <div>
            <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Short Description
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A brief description of your project"
              className="w-full rounded-lg text-sm"
              style={{
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-primary)',
                color: 'var(--text-primary)',
                padding: '10px 12px',
              }}
            />
          </div>
          <div className="flex justify-end" style={{ gap: '8px', paddingTop: '4px' }}>
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
              onClick={handleSave}
              disabled={!name.trim() || saving}
              className="rounded-lg text-sm font-medium"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--text-inverse)',
                opacity: name.trim() && !saving ? 1 : 0.5,
                padding: '8px 16px',
                cursor: name.trim() && !saving ? 'pointer' : 'default',
              }}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
