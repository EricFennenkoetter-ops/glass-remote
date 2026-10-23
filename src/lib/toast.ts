import { useSyncExternalStore } from 'react';

export type Toast = { id: number; message: string; tone: 'info' | 'error' };

const TOAST_DURATION_MS = 3500;

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function showToast(message: string, tone: Toast['tone'] = 'error'): void {
  // Same message already visible → don't stack duplicates (e.g. repeated network errors while polling).
  if (toasts.some((toast) => toast.message === message)) return;
  const toast = { id: nextId++, message, tone };
  toasts = [...toasts, toast].slice(-3);
  emit();
  window.setTimeout(() => dismissToast(toast.id), TOAST_DURATION_MS);
}

export function dismissToast(id: number): void {
  toasts = toasts.filter((toast) => toast.id !== id);
  emit();
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => toasts,
  );
}
