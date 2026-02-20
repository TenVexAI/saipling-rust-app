import { useEffect } from 'react';
import { AppShell } from './components/Layout/AppShell';
import { TitleBar } from './components/Layout/TitleBar';
import { Welcome } from './components/Welcome/Welcome';
import { useProjectStore } from './stores/projectStore';
import { useThemeStore } from './stores/themeStore';
import { getConfig } from './utils/tauri';

function App() {
  const project = useProjectStore((s) => s.project);
  const setTheme = useThemeStore((s) => s.setTheme);

  useEffect(() => {
    getConfig().then((config) => {
      if (config.theme) {
        setTheme(config.theme as Parameters<typeof setTheme>[0]);
      }
    }).catch(() => {
      // Config doesn't exist yet, use defaults
    });
  }, [setTheme]);

  if (!project) {
    return (
      <div className="flex flex-col h-full w-full overflow-hidden">
        <TitleBar />
        <Welcome />
      </div>
    );
  }

  return <AppShell />;
}

export default App;
