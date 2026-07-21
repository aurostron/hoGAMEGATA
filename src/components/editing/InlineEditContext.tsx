import React, { useEffect, useSyncExternalStore } from 'react';

type Listener = () => void;

const STORE_EVENT = 'gg-inline-edit-change';

/**
 * Global editing state store that lives on `window.__ggEditStore`.
 * Communication between Astro React islands uses `CustomEvent` on `window`
 * so it works regardless of how Vite splits/duplicates module chunks.
 */
interface StoreShape {
  isEditing: boolean;
  initialData: Record<string, string>;
  history: Record<string, string>[];
  historyIndex: number;
  snapshot: SnapshotShape | null;
}

interface SnapshotShape {
  isEditing: boolean;
  pendingEdits: Record<string, string>;
  canUndo: boolean;
  canRedo: boolean;
  editedCount: number;
  initialData: Record<string, string>;
}

/* ── Store access ──────────────────────────────────────────────── */

function store(): StoreShape {
  if (typeof window === 'undefined') {
    return {
      isEditing: false,
      initialData: {},
      history: [{}],
      historyIndex: 0,
      snapshot: null,
    };
  }
  const w = window as any;
  if (!w.__ggEditStore) {
    w.__ggEditStore = {
      isEditing: false,
      initialData: {},
      history: [{}],
      historyIndex: 0,
      snapshot: null,
    } as StoreShape;
  }
  return w.__ggEditStore as StoreShape;
}

function computeSnapshot(): SnapshotShape {
  const s = store();
  const currentEdits = s.history[s.historyIndex] || s.initialData;
  return {
    isEditing: s.isEditing,
    pendingEdits: currentEdits,
    canUndo: s.historyIndex > 0,
    canRedo: s.historyIndex < s.history.length - 1,
    editedCount: Object.keys(currentEdits).filter(
      (key) => (currentEdits[key] || '') !== (s.initialData[key] || '')
    ).length,
    initialData: s.initialData,
  };
}

/** Returns a cached snapshot; only recomputed after notify(). */
function getSnapshot(): SnapshotShape {
  const s = store();
  if (!s.snapshot) {
    s.snapshot = computeSnapshot();
  }
  return s.snapshot;
}

/** SSR fallback snapshot. */
const SSR_SNAPSHOT: SnapshotShape = {
  isEditing: false,
  pendingEdits: {},
  canUndo: false,
  canRedo: false,
  editedCount: 0,
  initialData: {},
};
function getServerSnapshot(): SnapshotShape {
  return SSR_SNAPSHOT;
}

/**
 * Invalidate cached snapshot and broadcast change via CustomEvent.
 * Every island listening on `window` picks it up instantly.
 */
function notify() {
  const s = store();
  s.snapshot = null; // invalidate cache
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(STORE_EVENT));
  }
}

/**
 * Subscribe to store changes. Uses `window` CustomEvent so it works
 * across any number of independently-bundled React islands.
 */
function subscribe(onStoreChange: Listener): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = () => onStoreChange();
  window.addEventListener(STORE_EVENT, handler);
  return () => window.removeEventListener(STORE_EVENT, handler);
}

/* ── Mutations ─────────────────────────────────────────────────── */

export function initStore(initialData: Record<string, string>) {
  const s = store();
  s.initialData = initialData;
  if (s.history.length === 1 && Object.keys(s.history[0]).length === 0) {
    s.history = [initialData];
    s.historyIndex = 0;
    notify();
  }
}

export function setIsEditing(val: boolean | ((prev: boolean) => boolean)) {
  const s = store();
  const next = typeof val === 'function' ? val(s.isEditing) : val;
  if (s.isEditing !== next) {
    s.isEditing = next;
    notify();
  }
}

export function updateField(fieldKey: string, newValue: string) {
  const s = store();
  const current = s.history[s.historyIndex] || {};
  if (current[fieldKey] === newValue) return;
  const nextState = { ...current, [fieldKey]: newValue };
  s.history = [...s.history.slice(0, s.historyIndex + 1), nextState];
  s.historyIndex = s.history.length - 1;
  notify();
}

export function undo() {
  const s = store();
  if (s.historyIndex > 0) {
    s.historyIndex -= 1;
    notify();
  }
}

export function redo() {
  const s = store();
  if (s.historyIndex < s.history.length - 1) {
    s.historyIndex += 1;
    notify();
  }
}

export function resetEdits() {
  const s = store();
  s.history = [s.initialData];
  s.historyIndex = 0;
  notify();
}

/* ── React hook (useSyncExternalStore) ─────────────────────────── */

export const useInlineEdit = () => {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return {
    ...state,
    setIsEditing,
    updateField,
    undo,
    redo,
    resetEdits,
  };
};

/* ── Provider (initialises store, passes children through) ─────── */

interface InlineEditProviderProps {
  children: React.ReactNode;
  initialData?: Record<string, string>;
}

export const InlineEditProvider: React.FC<InlineEditProviderProps> = ({
  children,
  initialData = {},
}) => {
  useEffect(() => {
    initStore(initialData);
  }, [initialData]);

  return <>{children}</>;
};
