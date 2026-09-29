// In-place rename field for a file row, a file group header or a top tab.
// Enter or clicking away commits; Esc cancels.
import { useEffect, useRef } from 'preact/hooks';
import { renamingId } from '../state/ui';

export function InlineRename({ value, onCommit, class: cls = '' }: { value: string; onCommit: (name: string) => void; class?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    // Select the name without its extension, like File Explorer.
    const dot = value.lastIndexOf('.');
    el.setSelectionRange(0, dot > 0 ? dot : value.length);
  }, []);

  const finish = (commit: boolean) => {
    if (done.current) return;
    done.current = true;
    renamingId.value = null;
    const v = ref.current?.value.trim() ?? '';
    if (commit && v && v !== value) onCommit(v);
  };

  return (
    <input
      ref={ref}
      class={`inline-rename ${cls}`}
      defaultValue={value}
      spellcheck={false}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDblClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') finish(true);
        if (e.key === 'Escape') finish(false);
      }}
      onBlur={() => finish(true)}
    />
  );
}
