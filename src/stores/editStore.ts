/**
 * Shared editing state for cross-island communication.
 * Uses Nano Stores — Astro's officially recommended approach
 * for sharing reactive state between independent React islands.
 */
import { atom, map, computed } from 'nanostores';

/* ── Atoms ─────────────────────────────────────────────────────── */

export const $isEditing = atom<boolean>(false);
export const $initialData = atom<Record<string, string>>({});
export const $history = atom<Record<string, string>[]>([{}]);
export const $historyIndex = atom<number>(0);

/* ── Computed ──────────────────────────────────────────────────── */

export const $pendingEdits = computed(
  [$history, $historyIndex, $initialData],
  (history, idx, initial) => history[idx] || initial
);

export const $canUndo = computed($historyIndex, (idx) => idx > 0);

export const $canRedo = computed(
  [$historyIndex, $history],
  (idx, history) => idx < history.length - 1
);

export const $editedCount = computed(
  [$pendingEdits, $initialData],
  (edits, initial) =>
    Object.keys(edits).filter(
      (key) => (edits[key] || '') !== (initial[key] || '')
    ).length
);

/* ── Actions ───────────────────────────────────────────────────── */

export function initStore(initialData: Record<string, string>) {
  $initialData.set(initialData);
  const h = $history.get();
  if (h.length === 1 && Object.keys(h[0]).length === 0) {
    $history.set([initialData]);
    $historyIndex.set(0);
  }
}

export function toggleEditing() {
  $isEditing.set(!$isEditing.get());
}

export function setEditing(val: boolean) {
  $isEditing.set(val);
}

export function updateField(fieldKey: string, newValue: string) {
  const history = $history.get();
  const idx = $historyIndex.get();
  const current = history[idx] || {};
  if (current[fieldKey] === newValue) return;
  const nextState = { ...current, [fieldKey]: newValue };
  const newHistory = [...history.slice(0, idx + 1), nextState];
  $history.set(newHistory);
  $historyIndex.set(newHistory.length - 1);
}

export function undo() {
  const idx = $historyIndex.get();
  if (idx > 0) $historyIndex.set(idx - 1);
}

export function redo() {
  const idx = $historyIndex.get();
  const len = $history.get().length;
  if (idx < len - 1) $historyIndex.set(idx + 1);
}

export function resetEdits() {
  $history.set([$initialData.get()]);
  $historyIndex.set(0);
}
