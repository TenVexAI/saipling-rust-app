import { useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { startFileWatcher, getBookMetadata } from '../utils/tauri';
import { useProjectStore } from '../stores/projectStore';

/**
 * Starts the file watcher when a project is open and listens for
 * fs:file_changed, fs:file_created, fs:file_deleted events.
 * Triggers a book metadata reload when relevant files change.
 */
export function useFileWatcher() {
  const projectDir = useProjectStore((s) => s.projectDir);
  const watcherStarted = useRef(false);

  useEffect(() => {
    if (!projectDir || watcherStarted.current) return;

    startFileWatcher(projectDir).then(() => {
      watcherStarted.current = true;
    }).catch((e) => {
      console.warn('File watcher failed to start:', e);
    });

    return () => {
      watcherStarted.current = false;
    };
  }, [projectDir]);

  // Listen for file change events
  useEffect(() => {
    if (!projectDir) return;

    const unlisteners: (() => void)[] = [];

    const setup = async () => {
      const u1 = await listen<{ path: string; change_type: string }>('fs:file_changed', (event) => {
        const path = event.payload.path;
        // If a book.json or project.json changed externally, could trigger reload
        if (path.endsWith('book.json') || path.endsWith('project.json')) {
          const store = useProjectStore.getState();
          if (store.activeBookId && store.projectDir) {
            getBookMetadata(store.projectDir, store.activeBookId).then((meta) => {
              store.setActiveBook(store.activeBookId!, meta);
            }).catch(() => {});
          }
        }
      });
      unlisteners.push(u1);

      const u2 = await listen<{ path: string }>('fs:file_created', () => {
        // Could refresh file tree if needed
      });
      unlisteners.push(u2);

      const u3 = await listen<{ path: string }>('fs:file_deleted', () => {
        // Could refresh file tree if needed
      });
      unlisteners.push(u3);
    };

    setup();

    return () => {
      unlisteners.forEach(u => u());
    };
  }, [projectDir]);
}
