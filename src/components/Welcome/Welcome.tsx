import { useState } from 'react';
import { FolderOpen, Plus, Clock } from 'lucide-react';
import { AnimatedLogo } from './AnimatedLogo';
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
      const selected = await open({ directory: true, title: 'Open SAiPLING Project' });
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
      <div className="w-full max-w-sm" style={{ padding: '0 24px' }}>
        <div className="flex flex-col items-center" style={{ marginBottom: '20px' }}>
          <div style={{ marginBottom: '4px' }}>
            <AnimatedLogo size={300} />
          </div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
            SAiPLING
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-tertiary)', marginTop: '4px' }}>
            Novel writing with Claude and the Sapling Method
          </p>
        </div>

        {error && (
          <div className="rounded-lg text-sm" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--color-error)', padding: '12px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        {!showCreate ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-3 w-full rounded-lg text-sm font-medium transition-colors"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--text-inverse)',
                padding: '12px 16px',
              }}
            >
              <Plus size={18} />
              New Project
            </button>
            <button
              onClick={handleOpen}
              className="flex items-center gap-3 w-full rounded-lg text-sm font-medium transition-colors"
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-primary)',
                padding: '12px 16px',
              }}
            >
              <FolderOpen size={18} />
              Open Existing Project
            </button>

            {recents.length > 0 && (
              <div style={{ marginTop: '24px' }}>
                <h3 className="flex items-center gap-2 text-xs font-semibold" style={{ color: 'var(--text-tertiary)', marginBottom: '12px' }}>
                  <Clock size={12} />
                  Recent Projects
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {recents.slice(0, 5).map((r) => (
                    <button
                      key={r.path}
                      onClick={() => handleOpenRecent(r.path)}
                      className="flex flex-col w-full rounded-lg text-left transition-colors"
                      style={{ color: 'var(--text-primary)', padding: '10px 12px' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <span className="text-sm font-medium">{r.name}</span>
                      <span className="text-xs truncate" style={{ color: 'var(--text-tertiary)', marginTop: '2px' }}>
                        {r.path}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Project Name
              </label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="My Novel"
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
                Genre (optional)
              </label>
              <input
                value={newGenre}
                onChange={(e) => setNewGenre(e.target.value)}
                placeholder="e.g. noir / science fiction"
                className="w-full rounded-lg text-sm"
                style={{
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-primary)',
                  color: 'var(--text-primary)',
                  padding: '10px 12px',
                }}
              />
            </div>
            <div className="flex items-center" style={{ gap: '8px' }}>
              <input
                type="checkbox"
                id="isSeries"
                checked={isSeries}
                onChange={(e) => setIsSeries(e.target.checked)}
                style={{ borderRadius: '4px' }}
              />
              <label htmlFor="isSeries" className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                This is a multi-book series
              </label>
            </div>
            <div className="flex" style={{ gap: '8px', paddingTop: '4px' }}>
              <button
                onClick={handleCreate}
                disabled={!newName.trim()}
                className="flex-1 rounded-lg text-sm font-medium"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--text-inverse)',
                  opacity: newName.trim() ? 1 : 0.5,
                  padding: '10px 16px',
                }}
              >
                Create
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="rounded-lg text-sm"
                style={{
                  backgroundColor: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-primary)',
                  padding: '10px 16px',
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
