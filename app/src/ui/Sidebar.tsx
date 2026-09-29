// Vertical tabs (screenshots 1 to 3) and the collapsed rail (screenshot 4).
import { useRef, useState } from 'preact/hooks';
import { signal } from '@preact/signals';
import type { TreeNode, GroupNode } from '../lib/tree-ops';
import { tree, docs, activeId, activate, closeDoc, newNote, displayTitle, toggleGroup, newGroupFrom, renameDoc, renameGroupTo } from '../state/app';
import { settings, updateSettings } from '../state/settings';
import { openContextMenu, railPeek, closedNotesOpen, renamingId } from '../state/ui';
import { InlineRename } from './InlineRename';
import { IcChevronDown, IcChevronUp, IcChevronLeft, IcChevronRight, IcClose, IcFolderPlus, IcSearch, IcNewText, IcNewMd } from './icons';
import { startDrag, consumeDragClick, dropClass, drag } from './dnd';
import { noteMenu, groupMenu, ungroupedMenu } from './menus';
import { groupVars, docColorVars } from './colors';
import { fileBadge } from '../lib/file-badge';
import { sortNodes, relativeTime, SORT_LABELS, type SortMode, type SortDoc } from '../lib/sort';

/** Ticks every 30 s so "5 min ago" labels stay current. */
const clock = signal(Date.now());
setInterval(() => (clock.value = Date.now()), 30_000);

function sortDocs(): Record<string, SortDoc> {
  const out: Record<string, SortDoc> = {};
  for (const [id, d] of Object.entries(docs.value)) out[id] = { title: displayTitle(d), created: d.created, modified: d.modified, language: d.language };
  return out;
}

function matches(id: string, q: string): boolean {
  const d = docs.value[id];
  if (!d || !q) return true;
  const s = q.toLowerCase();
  return displayTitle(d).toLowerCase().includes(s) || (d.path ?? '').toLowerCase().includes(s);
}

function anyMatch(n: TreeNode, q: string): boolean {
  if (!q) return true;
  if (n.kind === 'note') return matches(n.id, q);
  return n.name.toLowerCase().includes(q.toLowerCase()) || n.children.some((c) => anyMatch(c, q));
}

function NoteRow({ id, depth }: { id: string; depth: number }) {
  const d = docs.value[id];
  if (!d) return null;
  const title = displayTitle(d);
  const b = fileBadge(d);
  return (
    <div
      class={`side-note${activeId.value === id ? ' active' : ''}${d.color ? ' colored' : ''}${dropClass(id)}`}
      style={{ '--depth': depth, ...docColorVars(d.color) } as any}
      data-drop-id={id}
      data-drop-kind="note"
      title={d.path ?? title}
      onPointerDown={(e) => startDrag(e as PointerEvent, id, title)}
      onClick={() => !consumeDragClick() && activate(id)}
      onAuxClick={(e) => e.button === 1 && closeDoc(id)}
      onDblClick={() => (renamingId.value = id)}
      onContextMenu={(e) => openContextMenu(e as MouseEvent, noteMenu(id))}
    >
      <span class={`type-badge type-${b.kind}`}>{b.label}</span>
      <span class="side-note-text">
        {renamingId.value === id ? (
          <InlineRename value={title} onCommit={(v) => void renameDoc(id, v)} />
        ) : (
          <span class="side-note-title">{title}</span>
        )}
        <span class="side-note-time" title={new Date(d.modified).toLocaleString()}>{relativeTime(d.modified, clock.value)}</span>
      </span>
      <button
        class={`side-close${d.dirty ? ' dirty' : ''}`}
        title="Close"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          closeDoc(id);
        }}
      >
        <span class="dot" />
        <IcClose size={12} />
      </button>
    </div>
  );
}

function GroupBlock({ g, depth, q }: { g: GroupNode; depth: number; q: string }) {
  const open = !g.collapsed || !!q;
  const count = countNotes(g);
  return (
    <div class={`side-group depth-${depth}`} style={groupVars(g.color)}>
      <div
        class={`side-group-head${dropClass(g.id)}`}
        data-drop-id={g.id}
        data-drop-kind="group"
        data-collapsed={String(g.collapsed)}
        onPointerDown={(e) => startDrag(e as PointerEvent, g.id, g.name)}
        onClick={(e) => !consumeDragClick() && toggleGroup(g.id, (e as MouseEvent).altKey)}
        onContextMenu={(e) => openContextMenu(e as MouseEvent, groupMenu(g.id))}
        onDblClick={() => !g.system && (renamingId.value = g.id)}
        title="Click to expand or collapse. Double-click to rename. Right-click for options."
      >
        {renamingId.value === g.id ? (
          <InlineRename value={g.name} onCommit={(v) => renameGroupTo(g.id, v)} class="on-group" />
        ) : (
          <span class="side-group-name">{g.name}</span>
        )}
        {!open && <span class="side-group-count">{count}</span>}
        <span class="side-group-chev">{open ? <IcChevronUp /> : <IcChevronDown />}</span>
      </div>
      {open && (
        <div class="side-group-body">
          {g.children.filter((c) => anyMatch(c, q)).map((c) =>
            c.kind === 'note' ? <NoteRow key={c.id} id={c.id} depth={depth} /> : <GroupBlock key={c.id} g={c} depth={depth + 1} q={q} />,
          )}
          {g.children.length === 0 && <div class="side-empty">Drag files here</div>}
        </div>
      )}
    </div>
  );
}

function countNotes(g: GroupNode): number {
  return g.children.reduce((a, c) => a + (c.kind === 'note' ? 1 : countNotes(c)), 0);
}

export function Sidebar() {
  const [q, setQ] = useState('');
  const resizing = useRef(false);
  const s = settings.value;
  const nodes = sortNodes(tree.value, s.sidebarSort, sortDocs());

  const onResize = (e: PointerEvent) => {
    e.preventDefault();
    resizing.current = true;
    const startX = e.clientX;
    const startW = s.sidebarWidth;
    const move = (ev: PointerEvent) => updateSettings({ sidebarWidth: Math.max(180, Math.min(420, startW + ev.clientX - startX)) });
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <aside class="sidebar" style={{ width: s.sidebarWidth + 'px' }}>
      <div class="side-tools">
        <div class="side-head">
          <label class="side-sort" title="How files are ordered here. Manual keeps the order you arranged.">
            <span>Sort</span>
            <select class="fb-select" value={s.sidebarSort} onChange={(e) => updateSettings({ sidebarSort: (e.target as HTMLSelectElement).value as SortMode })}>
              {(Object.keys(SORT_LABELS) as SortMode[]).map((m) => (
                <option value={m}>{SORT_LABELS[m]}</option>
              ))}
            </select>
          </label>
          <button class="icon-btn side-collapse" title="Collapse sidebar to a rail" onClick={() => updateSettings({ tabsMode: 'rail' })}>
            <IcChevronLeft />
          </button>
        </div>
        <div class="side-search-row">
          <div class="side-search">
            <IcSearch size={14} />
            <input placeholder="Search tabs" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
          </div>
        </div>
        <div class="side-actions">
          <button class="side-action" title="New text file (Ctrl+N)" onClick={() => newNote({ language: 'plain' })}>
            <IcNewText />
            <span>New text file</span>
          </button>
          <button class="side-action" title="New Markdown file (Ctrl+Alt+N)" onClick={() => newNote({ language: 'markdown' })}>
            <IcNewMd />
            <span>New MD file</span>
          </button>
          <button class="side-action" title="New file group (Ctrl+Shift+G)" onClick={() => newGroupFrom([], null)}>
            <IcFolderPlus />
            <span>New group</span>
          </button>
        </div>
      </div>
      <div
        class="side-scroll"
        onContextMenu={(e) => {
          const t = e.target as HTMLElement;
          if (t.closest('.side-note, .side-group-head, .side-link')) return;
          openContextMenu(e as MouseEvent, ungroupedMenu());
        }}
      >
        {nodes.filter((n) => anyMatch(n, q)).map((n) =>
          n.kind === 'note' ? <NoteRow key={n.id} id={n.id} depth={0} /> : <GroupBlock key={n.id} g={n} depth={1} q={q} />,
        )}
        <div class={`side-root-drop${drag.value ? ' visible' : ''}${dropClass('__root__')}`} data-drop-id="__root__">
          {drag.value ? 'Drop here to take it out of its file group' : ''}
        </div>
        <button class="side-link" onClick={() => (closedNotesOpen.value = true)}>
          Closed notes…
        </button>
      </div>
      <div class="side-resizer" onPointerDown={(e) => onResize(e as PointerEvent)} />
    </aside>
  );
}

/** Collapsed rail: group names rotated 90 degrees. Click a name to peek, chevron to re-open. */
export function Rail() {
  const groups = tree.value.filter((n): n is GroupNode => n.kind === 'group');
  const loose = tree.value.filter((n) => n.kind === 'note').length;
  return (
    <aside class="rail">
      <button class="icon-btn rail-open" title="Expand sidebar" onClick={() => updateSettings({ tabsMode: 'left' })}>
        <IcChevronRight />
      </button>
      <div class="rail-items">
        {groups.map((g) => (
          <button
            key={g.id}
            class="rail-item"
            style={groupVars(g.color)}
            title={g.name}
            onClick={() => (railPeek.value = !railPeek.value)}
            onContextMenu={(e) => openContextMenu(e as MouseEvent, groupMenu(g.id))}
          >
            <span>{g.name}</span>
          </button>
        ))}
        {loose > 0 && (
          <button class="rail-item rail-loose" onClick={() => (railPeek.value = !railPeek.value)}>
            <span>Tabs ({loose})</span>
          </button>
        )}
      </div>
      {railPeek.value && (
        <div class="rail-peek" onMouseLeave={() => !drag.value && (railPeek.value = false)}>
          <Sidebar />
        </div>
      )}
    </aside>
  );
}
