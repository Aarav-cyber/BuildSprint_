import fs from 'fs';
import path from 'path';

const defaultStateFilePath = path.resolve('data/state.json');

/**
 * Ensures data directory exists.
 */
function ensureDataDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Reads persistent PR triage state from JSON file.
 */
export function loadPRState(filePath = defaultStateFilePath) {
  try {
    ensureDataDir(filePath);
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.warn('[State Store] Could not read state file:', err.message);
  }
  return {};
}

/**
 * Writes persistent PR triage state to JSON file.
 */
export function savePRState(state, filePath = defaultStateFilePath) {
  try {
    ensureDataDir(filePath);
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.error('[State Store] Could not save state file:', err.message);
  }
}

/**
 * Updates a specific PR's tracking entry in state.
 */
export function updatePREntry(key, data, filePath = defaultStateFilePath) {
  const state = loadPRState(filePath);
  state[key] = {
    ...state[key],
    ...data,
    updatedAt: new Date().toISOString(),
  };
  savePRState(state, filePath);
  return state[key];
}
