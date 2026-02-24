import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

/**
 * Opens the Help window, optionally navigating to a specific section.
 * If the help window is already open, it focuses it and navigates to the section.
 *
 * @param section - Optional section ID to deep-link to (e.g. 'api-key-how-to-get', 'phase-2-act-two')
 */
export async function openHelpWindow(section?: string) {
  const url = section
    ? `index.html?window=help&section=${encodeURIComponent(section)}`
    : 'index.html?window=help';

  // Check if help window already exists
  const existing = await WebviewWindow.getByLabel('help');
  if (existing) {
    await existing.setFocus();
    // If a section is requested, emit a navigate event via the window's URL
    if (section) {
      await existing.emit('help-navigate', { section });
    }
    return;
  }

  // Create new help window
  new WebviewWindow('help', {
    url,
    title: 'SAiPLING HELP',
    width: 800,
    height: 700,
    minWidth: 500,
    minHeight: 400,
    decorations: false,
    center: true,
  });
}

export async function closeHelpWindow(): Promise<boolean> {
  const existing = await WebviewWindow.getByLabel('help');
  if (existing) {
    await existing.close();
    return true;
  }
  return false;
}

export async function isHelpWindowOpen(): Promise<boolean> {
  const existing = await WebviewWindow.getByLabel('help');
  return existing !== null;
}

export async function toggleHelpWindow() {
  const existing = await WebviewWindow.getByLabel('help');
  if (existing) {
    await existing.close();
  } else {
    await openHelpWindow();
  }
}
