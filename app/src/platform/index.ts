import type { Platform } from './types';
import { createMockPlatform } from './mock';
import { createTauriPlatform } from './tauri';

export * from './types';

export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

function make(): Platform {
  if (isTauri) return createTauriPlatform();
  const label = location.pathname.includes('quicknote') ? 'quicknote' : 'main';
  return createMockPlatform(label);
}

export const platform: Platform = make();
