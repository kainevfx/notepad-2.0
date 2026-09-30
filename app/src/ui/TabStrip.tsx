import { useEffect } from 'preact/hooks';
// Top tab strip (Notepad default). Groups show as Chrome-style coloured chips; click a chip to
// collapse its tabs. Tabs and chips are draggable.
import type { JSX } from 'preact';
import type { TreeNode, GroupNode } from '../lib/tree-ops';
import { tree, docs, activeId, activate, closeDoc, newNote, displayTitle, toggleGroup, renameDoc, renameGroupTo } from '../state/app';
import { openContextMenu, renamingId } from '../state/ui';
import { InlineRename } from './InlineRename';
import { IcPlus, IcClose, IcNewMd } from './icons';
import { startDrag, consumeDragClick, dropClass } from './dnd';
import { noteMenu, groupMenu } from './menus';
import { groupVars, docColorVars } from './colors';
import { fileBadge } from '../lib/file-badge';

function Tab({ id, group, lvl }: { id: string; group: GroupNode | null; lvl: number }) {
  const d = docs.value[id];
  if (!d) return null;
  const active = activeId.value === id;
  const title = displayTitle(d);
  const b = fileBadge(d);
  return (
    <div
      class={`tab${active ? ' active' : ''}${group ? ' grouped' : ''}${d.color ? ' colored' : ''}${dropClass(id)}`}
      style={{ ...(group ? groupVars(group.color) : {}), ...docColorVars(d.color), '--lvl': lvl } as any}
      data-drop-id={id}
      data-drop-kind="note"
      data-drop-axis="x"
      title={d.path ?? title}
      onPointerDown={(e) => startDrag(e as PointerEvent, id, title)}
      onClick={() => !consumeDragClick() && activate(id)}
      onAuxClick={(e) => e.button === 1 && closeDoc(id)}
      onDblClick={() => (renamingId.value = id)}
      onContextMenu={(e) => openContextMenu(e as MouseEvent, noteMenu(id))}
    >
      {renamingId.value === id ? <InlineRename value={title} onCommit={(v) => void renameDoc(id, v)} /> : <span class="tab-title">{title}</span>}
      <span class={`type-badge type-${b.kind}`}>{b.label}</span>
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

/**
 * A file group is drawn as a container: its chip (with a small GROUP caption) and its tabs sit in
 * one outlined box in the group's colour. Each nesting level sits a little lower (`--lvl`).
 */
function render(nodes: TreeNode[], parent: GroupNode | null, lvl: number): JSX.Element[] {
  return nodes.map((n) => {
    if (n.kind === 'note') return <Tab key={n.id} id={n.id} group={parent} lvl={lvl} />;
    return (
      <div key={n.id} class={`tab-group${n.collapsed ? ' collapsed' : ''}`} style={{ ...groupVars(n.color), '--lvl': lvl } as any}>
        <div
          class={`tab-chip${dropClass(n.id)}`}
          data-drop-id={n.id}
          data-drop-kind="group"
          data-drop-axis="x"
          title={`File group "${n.name}": click to ${n.collapsed ? 'expand' : 'collapse'}, double-click to rename`}
          onPointerDown={(e) => startDrag(e as PointerEvent, n.id, n.name)}
          onClick={() => !consumeDragClick() && toggleGroup(n.id)}
          onContextMenu={(e) => openContextMenu(e as MouseEvent, groupMenu(n.id))}
          onDblClick={() => !n.system && (renamingId.value = n.id)}
        >
          <span class="chip-kind">Group</span>
          <span class="chip-name">
            {renamingId.value === n.id ? <InlineRename value={n.name} onCommit={(v) => renameGroupTo(n.id, v)} /> : n.name}
            {n.collapsed && <span class="chip-count">{countNotes(n)}</span>}
          </span>
        </div>
        {!n.collapsed && render(n.children, n, lvl + 1)}
      </div>
    );
  });
}

function countNotes(g: GroupNode): number {
  return g.children.reduce((a, c) => a + (c.kind === 'note' ? 1 : countNotes(c)), 0);
}

export function TabStrip() {
  // Keep the open tab in view when it changes.
  const active = activeId.value;
  useEffect(() => {
    document.querySelector('.tabstrip .tab.active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [active]);
  const out = render(tree.value, null, 0);
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
