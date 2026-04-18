// ============================================================
// Sync Engine — Client-side delta sync logic
// Compares local state vs server, uploads/downloads accordingly
// ============================================================
import api from '../services/api';
import { sha256 } from './crypto';

const SYNC_KEY = 'sc_last_sync';

/**
 * Get the timestamp of the last successful sync from localStorage.
 */
export function getLastSync() {
  return localStorage.getItem(SYNC_KEY) || new Date(0).toISOString();
}

/**
 * Persist the sync timestamp.
 */
export function setLastSync(ts) {
  localStorage.setItem(SYNC_KEY, ts || new Date().toISOString());
}

/**
 * Fetch delta (files changed since last sync) from server.
 * @returns {{ changes: Array, serverTime: string }}
 */
export async function fetchDelta() {
  const since = getLastSync();
  const { data } = await api.post('/sync/delta', null, { params: { since } });
  return data;
}

/**
 * Get server sync status (total files, last modified, server time).
 */
export async function fetchSyncStatus() {
  const { data } = await api.get('/sync/status');
  return data;
}

/**
 * Compute SHA-256 of a File object (as ArrayBuffer).
 * Used to detect local changes before uploading.
 */
export async function hashFile(file) {
  const buffer = await file.arrayBuffer();
  return sha256(buffer);
}

/**
 * Resolve naming conflict by appending a counter.
 * e.g. "report.pdf" → "report (2).pdf"
 */
export function resolveConflictName(filename, existingNames) {
  if (!existingNames.includes(filename)) return filename;
  const ext  = filename.lastIndexOf('.');
  const base = ext > -1 ? filename.slice(0, ext) : filename;
  const suf  = ext > -1 ? filename.slice(ext)    : '';
  let   n    = 2;
  while (existingNames.includes(`${base} (${n})${suf}`)) n++;
  return `${base} (${n})${suf}`;
}

/**
 * Run a full sync cycle:
 * 1. Fetch delta from server
 * 2. Identify new/modified/deleted files
 * 3. Report what needs action (actual up/download handled by caller with master key)
 *
 * @param {Array} localFiles  - Current known file list (from last API fetch)
 * @returns {{ toDownload, toDelete, serverTime }}
 */
export async function runDeltaSync(localFiles) {
  const { changes, serverTime } = await fetchDelta();

  const localMap = new Map(localFiles.map(f => [f.id, f]));
  const toDownload = [];
  const toDelete   = [];

  for (const change of changes) {
    if (change.isDeleted) {
      if (localMap.has(change.id)) toDelete.push(change);
    } else {
      const local = localMap.get(change.id);
      if (!local || local.hash !== change.hash) {
        toDownload.push(change);
      }
    }
  }

  setLastSync(serverTime);
  return { toDownload, toDelete, serverTime };
}
