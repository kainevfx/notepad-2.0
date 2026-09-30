import type { RenderOptions } from '../../markdown/pipeline';

/** Each editor owns its rendering context. Refreshing it never changes the document or undo history. */
export function createRenderContext(getOptions: () => RenderOptions = () => ({})) {
  const listeners = new Set<() => void>();
  return {
    options: getOptions,
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    refresh() { for (const fn of listeners) fn(); },
  };
}
export type VisualRenderContext = ReturnType<typeof createRenderContext>;
