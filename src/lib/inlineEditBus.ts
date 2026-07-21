/**
 * Native Browser DOM Event Bus for launching and pre-selecting edit fields in the Edit Modal.
 * Immune to Vite module splitting and Astro island boundaries.
 */

export interface OpenModalDetail {
  fieldKey?: string;
  tab?: 'general' | 'links' | 'developers';
}

export function openEditModalBus(fieldKey?: string, tab?: 'general' | 'links' | 'developers') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('gg-open-edit-modal', {
      detail: { fieldKey, tab },
    })
  );
}
