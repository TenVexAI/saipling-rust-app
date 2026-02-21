import { readFile, writeFile } from './tauri';
import { useProjectStore } from '../stores/projectStore';

const COST_FILE = '.ai_cost.json';

interface CostData {
  total: number;
}

export async function loadProjectCost(projectDir: string): Promise<number> {
  try {
    const { body } = await readFile(`${projectDir}\\${COST_FILE}`);
    const data: CostData = JSON.parse(body);
    return data.total || 0;
  } catch {
    return 0;
  }
}

export async function saveProjectCost(projectDir: string, total: number): Promise<void> {
  try {
    await writeFile(`${projectDir}\\${COST_FILE}`, {}, JSON.stringify({ total }, null, 2));
  } catch (e) {
    console.error('Failed to save project cost:', e);
  }
}

/** Call after each AI cost is incurred to update store + persist to disk */
export async function trackCost(cost: number): Promise<void> {
  const { projectDir, addProjectCost, totalProjectCost } = useProjectStore.getState();
  if (!projectDir) return;
  addProjectCost(cost);
  await saveProjectCost(projectDir, totalProjectCost + cost);
}
