import { readFile, writeFile } from './tauri';
import { useAIStore } from '../stores/aiStore';
import type { Message } from '../types/ai';

const CHAT_FILE = '.ai_chat.json';

interface ChatData {
  messages: Message[];
  activeSkill: string | null;
  conversationId: string | null;
  sessionCost: number;
}

export async function loadProjectChat(projectDir: string): Promise<void> {
  try {
    const { body } = await readFile(`${projectDir}\\${CHAT_FILE}`);
    const data: ChatData = JSON.parse(body);
    const store = useAIStore.getState();
    store.setMessages(data.messages || []);
    store.setActiveSkill(data.activeSkill ?? null);
    store.setConversationId(data.conversationId ?? null);
    store.setSessionCost(data.sessionCost || 0);
  } catch {
    // No saved chat — start fresh
    useAIStore.getState().clearMessages();
  }
}

export async function saveProjectChat(projectDir: string): Promise<void> {
  const { messages, activeSkill, conversationId, sessionCost } = useAIStore.getState();
  const data: ChatData = { messages, activeSkill, conversationId, sessionCost };
  try {
    await writeFile(`${projectDir}\\${CHAT_FILE}`, {}, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Failed to save project chat:', e);
  }
}

/** Save chat for the current project (convenience wrapper) */
export async function saveCurrentChat(): Promise<void> {
  const projectDir = (await import('../stores/projectStore')).useProjectStore.getState().projectDir;
  if (!projectDir) return;
  await saveProjectChat(projectDir);
}
