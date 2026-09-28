import { useEffect, useRef, useState } from 'preact/hooks';
import { dialog, toast, closedNotesOpen } from '../state/ui';
import { closedNotes, reopenNote, deleteClosedNote } from '../state/app';
import { drag } from './dnd';
import { IcClose } from './icons';

export function DialogHost() {
  const d = dialog.value;
  const [text, setText] = useState('');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!d) return;
    setText(d.input?.value ?? '');
    setTimeout(() => {
      input.current?.focus();
      if (d.input?.select) input.current?.select();
    }, 0);
  }, [d]);
  if (!d) return null;
  const primary = d.buttons.find((b) => b.primary)?.value ?? d.buttons[0]?.value ?? null;
  const cancel = d.buttons.find((b) => b.value === 'cancel')?.value ?? null;
  return (
    <div
      class="modal-backdrop"
      onKeyDown={(e) => {
        if (e.key === 'Escape') d.resolve(cancel, text);
        if (e.key === 'Enter') d.resolve(primary, text);
      }}
    >
      <div class="modal" role="dialog" aria-modal="true" tabIndex={-1} ref={(el) => {
          if (el && !d.input) setTimeout(() => el.focus(), 0);
        }}>
        <div class="modal-title">{d.title}</div>
        {d.body && <div class="modal-body">{d.body}</div>}
        {d.input && (
          <label class="modal-input">
            {d.input.label && <span>{d.input.label}</span>}
            <input ref={input} type={d.input.type ?? 'text'} value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} />
          </label>
        )}
        <div class="modal-buttons">
          {d.buttons.map((b) => (
            <button class={`btn${b.primary ? ' primary' : ''}`} onClick={() => d.resolve(b.value, text)}>
              {b.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ClosedNotesDialog() {
  if (!closedNotesOpen.value) return null;
  const list = closedNotes.value;
  return (
    <div class="modal-backdrop" onKeyDown={(e) => e.key === 'Escape' && (closedNotesOpen.value = false)}>
      <div class="modal wide">
        <div class="modal-title">
          Closed notes
          <button class="icon-btn" style={{ marginLeft: 'auto' }} onClick={() => (closedNotesOpen.value = false)}>
            <IcClose />
          </button>
        </div>
        <div class="modal-body">
          Notes you closed are kept here until you delete them.
          <div class="closed-list">
            {list.length === 0 && <div class="set-desc">Nothing here.</div>}
            {list.map((n) => (
              <div class="closed-row">
                <button
                  class="closed-open"
                  onClick={() => {
                    closedNotesOpen.value = false;
                    reopenNote(n.id);
                  }}
                >
                  <span>{n.title}</span>
                  <small>
                    {n.quick ? 'Quick note · ' : ''}
                    {new Date(n.modified).toLocaleString()}
                  </small>
                </button>
                <button class="btn subtle" title="Delete for good" onClick={() => deleteClosedNote(n.id)}>
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Toast() {
  return toast.value ? <div class="toast">{toast.value}</div> : null;
}

export function DragGhost() {
  const d = drag.value;
  if (!d) return null;
  return (
    <div class="drag-ghost" style={{ left: d.x + 12 + 'px', top: d.y + 10 + 'px' }}>
      {d.label}
    </div>
  );
}
