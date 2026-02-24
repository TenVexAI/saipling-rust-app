import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

export async function openThemeEditor() {
  const existing = await WebviewWindow.getByLabel('theme-editor');
  if (existing) {
    await existing.setFocus();
    return;
  }

  new WebviewWindow('theme-editor', {
    url: 'index.html?window=theme-editor',
    title: 'Custom Theme Editor',
    width: 480,
    height: 670,
    minWidth: 480,
    minHeight: 690,
    maxWidth: 480,
    maxHeight: 690,
    decorations: false,
    center: true,
  });
}
