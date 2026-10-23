import { useEffect, useSyncExternalStore } from 'react';
import { ApiError } from '../api/client';
import { libraryContains, removeFromLibrary, saveToLibrary } from '../api/player';
import { showToast } from '../lib/toast';
import { invalidatePersonalData } from './usePersonalData';

// "Is this in my library?" for tracks (liked), albums, playlists, podcasts, audiobooks.
// Lookups from all visible rows are batched into one request per 40 uris.

const MAX_URIS_PER_REQUEST = 40;
const BATCH_DELAY_MS = 60;

const saved = new Map<string, boolean>();
const listeners = new Set<() => void>();
let queued = new Set<string>();
let batchTimer: number | undefined;

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function requestStatus(uri: string) {
  if (saved.has(uri) || queued.has(uri)) return;
  queued.add(uri);
  window.clearTimeout(batchTimer);
  batchTimer = window.setTimeout(() => void flush(), BATCH_DELAY_MS);
}

async function flush() {
  const uris = [...queued];
  queued = new Set();
  for (let start = 0; start < uris.length; start += MAX_URIS_PER_REQUEST) {
    const chunk = uris.slice(start, start + MAX_URIS_PER_REQUEST);
    try {
      const result = await libraryContains(chunk);
      chunk.forEach((uri, index) => saved.set(uri, result[index] ?? false));
    } catch {
      // Unknown stays unknown; the heart just isn't filled.
    }
  }
  emit();
}

/** null while unknown. Only spotify: uris can be saved. */
export function useSaved(uri: string | null): boolean | null {
  const canSave = uri?.startsWith('spotify:') ?? false;
  useEffect(() => {
    if (uri && canSave) requestStatus(uri);
  }, [uri, canSave]);
  return useSyncExternalStore(subscribe, () => (uri && canSave ? (saved.get(uri) ?? null) : null));
}

/** Optimistic like/save/follow; reverts and explains on failure. */
export async function setSaved(uri: string, value: boolean): Promise<void> {
  const previous = saved.get(uri);
  saved.set(uri, value);
  emit();
  try {
    await (value ? saveToLibrary([uri]) : removeFromLibrary([uri]));
    invalidatePersonalData();
    showToast(value ? savedMessage(uri) : 'Aus deiner Bibliothek entfernt', 'info');
  } catch (error) {
    if (previous === undefined) saved.delete(uri);
    else saved.set(uri, previous);
    emit();
    showToast(error instanceof ApiError ? error.message : 'Das hat nicht geklappt.');
  }
}

/** For callers that changed the library by other means (e.g. deleting a playlist). */
export function markSaved(uri: string, value: boolean): void {
  saved.set(uri, value);
  emit();
}

function savedMessage(uri: string): string {
  if (uri.startsWith('spotify:track:')) return 'Zu Lieblingssongs hinzugefügt';
  if (uri.startsWith('spotify:playlist:')) return 'Playlist gespeichert';
  if (uri.startsWith('spotify:show:')) return 'Du folgst jetzt diesem Podcast';
  return 'In deiner Bibliothek gespeichert';
}
