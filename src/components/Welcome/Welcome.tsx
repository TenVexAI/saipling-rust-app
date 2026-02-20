import { useState } from 'react';
import { FolderOpen, Plus, Clock } from 'lucide-react';
import logo from '../../assets/logo.png';
import { useProjectStore } from '../../stores/projectStore';
import { getRecentProjects, createProject, openProject, getConfig } from '../../utils/tauri';
import { open } from '@tauri-apps/plugin-dialog';
import type { RecentProject } from '../../types/project';

export function Welcome() {
  const setProject = useProjectStore((s) => s.setProject);
  const [recents, setRecents] = useState<RecentProject[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newGenre, setNewGenre] = useState('');
  const [isSeries, setIsSeries] = useState(false);
  const [error, setError] = useState('');

  if (!loaded) {
    getRecentProjects()
      .then((r) => setRecents(r))
      .catch(() => {})
      .finally(() => setLoaded(true));
    return null;
  }

  const handleOpen = async () => {
    try {
      const selected = await open({ directory: true, title: 'Open sAIpling Project' });
      if (selected) {
        const meta = await openProject(selected as string);
        setProject(meta, selected as string);
      }
    } catch (e) {
      setError(String(e));
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const config = await getConfig();
      const dir = `${config.projects_root}\\${newName.trim().toLowerCase().replace(/\s+/g, '-')}`;
      const meta = await createProject(newName.trim(), isSeries, newGenre || null, dir);
      setProject(meta, dir);
    } catch (e) {
      setError(String(e));
    }
  };

  const handleOpenRecent = async (path: string) => {
    try {
      const meta = await openProject(path);
      setProject(meta, path);
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div
      className="flex items-center justify-center h-full"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      <div className="w-full max-w-md p-8">
        <div className="flex flex-col items-center mb-8">
          <img src={logo} alt="sAIpling" className="w-16 h-16 mb-3" />
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
            sAIpling
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>
            Novel writing with the Sapling Story Structure
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg text-sm" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--color-error)' }}>
            {error}
          </div>
        )}

        {!showCreate ? (
          <div className="space-y-3">
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm font-medium transition-colors"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--text-inverse)',
              }}
            >
              <Plus size={18} />
              New Project
            </button>
            <button
              onClick={handleOpen}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm font-medium transition-colors"
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-primary)',
              }}
            >
              <FolderOpen size={18} />
              Open Existing Project
            </button>

            {recents.length > 0 && (
              <div className="mt-6">
                <h3 className="flex items-center gap-2 text-xs font-semibold mb-2" style={{ color: 'var(--text-tertiary)' }}>
                  <Clock size={12} />
                  Recent Projects
                </h3>
                <div className="space-y-1">
                  {recents.slice(0, 5).map((r) => (
                    <button
                      key={r.path}
                      onClick={() => handleOpenRecent(r.path)}
                      className="flex flex-col w-full px-3 py-2 rounded text-left transition-colors"
                      style={{ color: 'var(--text-primary)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <span className="text-sm font-medium">{r.name}</span>
                      <span className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>
                        {r.path}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                Project Name
              </label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="My Novel"
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-primary)',
                  color: 'var(--text-primary)',
                }}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                Genre (optional)
              </label>
              <input
                value={newGenre}
                onChange={(e) => setNewGenre(e.target.value)}
                placeholder="e.g. noir / science fiction"
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-primary)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isSeries"
                checked={isSeries}
                onChange={(e) => setIsSeries(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="isSeries" className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                This is a multi-book series
              </label>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleCreate}
                disabled={!newName.trim()}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--text-inverse)',
                  opacity: newName.trim() ? 1 : 0.5,
                }}
              >
                Create
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 rounded-lg text-sm"
                style={{
                  backgroundColor: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-primary)',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
