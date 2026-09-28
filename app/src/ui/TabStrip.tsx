// Top tab strip (Notepad default). Groups show as Chrome-style coloured chips; click a chip to
// collapse its tabs. Tabs and chips are draggable.
import type { JSX } from 'preact';
import type { TreeNode, GroupNode } from '../lib/tree-ops';
import { tree, docs, activeId, activate, closeDoc, newNote, displayTitle, toggleGroup } from '../state/app';
import { openContextMenu } from '../state/ui';
import { IcPlus, IcClose, IcNewMd } from './icons';
import { startDrag, consumeDragClick, dropClass } from './dnd';
import { noteMenu, groupMenu } from './menus';
import { groupVars, docColorVars } from './colors';
import { fileBadge } from '../lib/file-badge';

function Tab({ id, group }: { id: string; group: GroupNode | null }) {
  const d = docs.value[id];
  if (!d) return null;
  const active = activeId.value === id;
  const title = displayTitle(d);
  const b = fileBadge(d);
  return (
    <div
      class={`tab${active ? ' active' : ''}${group ? ' grouped' : ''}${d.color ? ' colored' : ''}${dropClass(id)}`}
      style={{ ...(group ? groupVars(group.color) : {}), ...docColorVars(d.color) }}
      data-drop-id={id}
      data-drop-kind="note"
      data-drop-axis="x"
      title={d.path ?? title}
      onPointerDown={(e) => startDrag(e as PointerEvent, id, title)}
      onClick={() => !consumeDragClick() && activate(id)}
      onAuxClick={(e) => e.button === 1 && closeDoc(id)}
      onContextMenu={(e) => openContextMenu(e as MouseEvent, noteMenu(id))}
    >
      <span class={`type-badge type-${b.kind}`}>{b.label}</span>
      <span class="tab-title">{title}</span>
      <button
        class={`tab-close${d.dirty ? ' dirty' : ''}`}
        title="Close tab (Ctrl+W)"
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

function render(nodes: TreeNode[], parent: GroupNode | null, out: JSX.Element[]) {
  for (const n of nodes) {
    if (n.kind === 'note') out.push(<Tab key={n.id} id={n.id} group={parent} />);
    else {
      out.push(
        <div
          key={n.id}
          class={`tab-chip${n.collapsed ? ' collapsed' : ''}${dropClass(n.id)}`}
          style={groupVars(n.color)}
          data-drop-id={n.id}
          data-drop-kind="group"
          data-drop-axis="x"
          title={`${n.name}: click to ${n.collapsed ? 'expand' : 'collapse'}`}
          onPointerDown={(e) => startDrag(e as PointerEvent, n.id, n.name)}
          onClick={() => !consumeDragClick() && toggleGroup(n.id)}
          onContextMenu={(e) => openContextMenu(e as MouseEvent, groupMenu(n.id))}
        >
          {n.name}
          {n.collapsed && <span class="chip-count">{countNotes(n)}</span>}
        </div>,
      );
      if (!n.collapsed) render(n.children, n, out);
    }
  }
}

function countNotes(g: GroupNode): number {
  return g.children.reduce((a, c) => a + (c.kind === 'note' ? 1 : countNotes(c)), 0);
}

export function TabStrip() {
  const out: JSX.Element[] = [];
  render(tree.value, null, out);
  return (
    <div class="tabstrip" onWheel={(e) => ((e.currentTarget as HTMLElement).scrollLeft += (e as WheelEvent).deltaY)}>
      {out}
      <button class="tab-new" title="New text file (Ctrl+N)" onClick={() => newNote({ language: 'plain' })}>
        <IcPlus />
      </button>
      <button class="tab-new" title="New Markdown file (Ctrl+Alt+N)" onClick={() => newNote({ language: 'markdown' })}>
        <IcNewMd />
      </button>
    </div>
  );
}
