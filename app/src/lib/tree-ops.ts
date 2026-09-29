// Pure operations on the tab / group tree. The UI never mutates the tree itself:
// every drag, drop, group and ungroup goes through here, and every function returns a new
// tree (or null when the move is not allowed), so it is trivially unit-testable.

export type GroupColor = 'grey' | 'blue' | 'red' | 'yellow' | 'green' | 'pink' | 'purple' | 'cyan' | 'orange';
export const GROUP_COLORS: GroupColor[] = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];

export interface GroupNode {
  id: string;
  kind: 'group';
  name: string;
  color: GroupColor;
  collapsed: boolean;
  /** Per-group override for "autosave opened files". undefined = follow the global setting. */
  autosave?: boolean;
  /** Built-in groups (Quick Notes) cannot be deleted or renamed away. */
  system?: 'quick-notes';
  children: TreeNode[];
}

export interface NoteNode {
  id: string; // same as the document id
  kind: 'note';
}

export type TreeNode = GroupNode | NoteNode;
export type DropPosition = 'before' | 'after' | 'inside';

/** Groups can nest this many levels deep (a top-level group is level 1). */
export const MAX_GROUP_DEPTH = 4;

export interface Located {
  node: TreeNode;
  parent: GroupNode | null;
  index: number;
  /** Number of groups above this node. */
  depth: number;
}

export function find(root: TreeNode[], id: string): Located | null {
  const walk = (list: TreeNode[], parent: GroupNode | null, depth: number): Located | null => {
    for (let i = 0; i < list.length; i++) {
      const n = list[i];
      if (n.id === id) return { node: n, parent, index: i, depth };
      if (n.kind === 'group') {
        const hit = walk(n.children, n, depth + 1);
        if (hit) return hit;
      }
    }
    return null;
  };
  return walk(root, null, 0);
}

/** Ancestor groups of a node, outermost first. */
export function ancestors(root: TreeNode[], id: string): GroupNode[] {
  const path: GroupNode[] = [];
  const walk = (list: TreeNode[]): boolean => {
    for (const n of list) {
      if (n.id === id) return true;
      if (n.kind === 'group') {
        path.push(n);
        if (walk(n.children)) return true;
        path.pop();
      }
    }
    return false;
  };
  return walk(root) ? path : [];
}

export function isDescendant(root: TreeNode[], ancestorId: string, id: string): boolean {
  const loc = find(root, ancestorId);
  if (!loc || loc.node.kind !== 'group') return false;
  return find(loc.node.children, id) !== null;
}

/** Height of a group subtree in group levels (a group with no subgroups = 1). */
export function groupHeight(node: TreeNode): number {
  if (node.kind !== 'group') return 0;
  return 1 + Math.max(0, ...node.children.map(groupHeight));
}

export function flattenNotes(root: TreeNode[]): string[] {
  const out: string[] = [];
  const walk = (list: TreeNode[]) => {
    for (const n of list) n.kind === 'note' ? out.push(n.id) : walk(n.children);
  };
  walk(root);
  return out;
}

/** Notes whose every ancestor group is expanded, in tree order. */
export function visibleNotes(root: TreeNode[]): string[] {
  const out: string[] = [];
  const walk = (list: TreeNode[]) => {
    for (const n of list) {
      if (n.kind === 'note') out.push(n.id);
      else if (!n.collapsed) walk(n.children);
    }
  };
  walk(root);
  return out;
}

export function allGroups(root: TreeNode[]): { group: GroupNode; depth: number }[] {
  const out: { group: GroupNode; depth: number }[] = [];
  const walk = (list: TreeNode[], depth: number) => {
    for (const n of list)
      if (n.kind === 'group') {
        out.push({ group: n, depth });
        walk(n.children, depth + 1);
      }
  };
  walk(root, 1);
  return out;
}

function mapTree(list: TreeNode[], fn: (n: TreeNode) => TreeNode | null): TreeNode[] {
  const out: TreeNode[] = [];
  for (const n of list) {
    const m = fn(n);
    if (!m) continue;
    out.push(m.kind === 'group' ? { ...m, children: mapTree(m.children, fn) } : m);
  }
  return out;
}

export function remove(root: TreeNode[], id: string): { tree: TreeNode[]; removed: TreeNode | null } {
  let removed: TreeNode | null = null;
  const tree = mapTree(root, (n) => {
    if (n.id === id) {
      removed = n;
      return null;
    }
    return n;
  });
  return { tree, removed };
}

/** Insert at index inside parentId (null = top level). Index is clamped. */
export function insert(root: TreeNode[], node: TreeNode, parentId: string | null, index: number): TreeNode[] {
  if (parentId === null) {
    const copy = [...root];
    copy.splice(Math.max(0, Math.min(index, copy.length)), 0, node);
    return copy;
  }
  return mapTree(root, (n) => {
    if (n.id === parentId && n.kind === 'group') {
      const children = [...n.children];
      children.splice(Math.max(0, Math.min(index, children.length)), 0, node);
      return { ...n, children };
    }
    return n;
  });
}

/** Can `id` be dropped at (targetId, position)? */
export function canMove(root: TreeNode[], id: string, targetId: string, position: DropPosition): boolean {
  if (id === targetId) return false;
  const src = find(root, id);
  const tgt = find(root, targetId);
  if (!src || !tgt) return false;
  if (position === 'inside' && tgt.node.kind !== 'group') return false;
  if (src.node.kind === 'group' && isDescendant(root, id, targetId)) return false; // cycle
  if (src.node.kind === 'group') {
    const parentDepth = position === 'inside' ? tgt.depth + 1 : tgt.depth;
    if (parentDepth + groupHeight(src.node) > MAX_GROUP_DEPTH) return false;
    // System groups stay at the top level.
    if ((src.node as GroupNode).system && parentDepth > 0) return false;
  }
  return true;
}

export function move(root: TreeNode[], id: string, targetId: string, position: DropPosition): TreeNode[] | null {
  if (!canMove(root, id, targetId, position)) return null;
  const { tree, removed } = remove(root, id);
  if (!removed) return null;
  const tgt = find(tree, targetId)!;
  if (position === 'inside') {
    const g = tgt.node as GroupNode;
    return insert(tree, removed, g.id, g.children.length);
  }
  const parentId = tgt.parent ? tgt.parent.id : null;
  return insert(tree, removed, parentId, position === 'before' ? tgt.index : tgt.index + 1);
}

/** Move a node to the end of the top level (drag out of all groups). */
export function moveToRoot(root: TreeNode[], id: string): TreeNode[] | null {
  const { tree, removed } = remove(root, id);
  if (!removed) return null;
  return [...tree, removed];
}

export function update(root: TreeNode[], id: string, patch: Partial<GroupNode>): TreeNode[] {
  return mapTree(root, (n) => (n.id === id && n.kind === 'group' ? { ...n, ...patch, kind: 'group' } : n));
}

/**
 * Create a group around `noteIds`. The group lands where the first note was, inside the same
 * parent (so "Add to new group" on a note inside a group makes a subgroup), or at `parentId`.
 */
export function createGroup(
  root: TreeNode[],
  group: Omit<GroupNode, 'children' | 'kind'>,
  noteIds: string[],
  parentId?: string | null,
): TreeNode[] | null {
  let tree = root;
  let at: { parentId: string | null; index: number } | null = null;
  if (noteIds.length) {
    const first = find(tree, noteIds[0]);
    if (first) at = { parentId: first.parent ? first.parent.id : null, index: first.index };
  }
  if (parentId !== undefined) {
    const p = parentId === null ? null : find(tree, parentId);
    if (parentId !== null && (!p || p.node.kind !== 'group')) return null;
    if (p && p.depth + 2 > MAX_GROUP_DEPTH) return null;
    at = { parentId, index: p ? (p.node as GroupNode).children.length : tree.length };
  }
  if (!at) at = { parentId: null, index: tree.length };
  if (at.parentId) {
    const p = find(tree, at.parentId)!;
    if (p.depth + 2 > MAX_GROUP_DEPTH) return null;
  }
  const children: TreeNode[] = [];
  for (const id of noteIds) {
    const r = remove(tree, id);
    if (r.removed) {
      tree = r.tree;
      children.push(r.removed);
    }
  }
  // Re-locate the insertion point, removing notes may have shifted it.
  if (at.parentId && !find(tree, at.parentId)) at.parentId = null;
  const siblings = at.parentId ? (find(tree, at.parentId)!.node as GroupNode).children : tree;
  const index = Math.min(at.index, siblings.length);
  return insert(tree, { ...group, kind: 'group', children }, at.parentId, index);
}

/** Dissolve a group, putting its children where it was. */
export function ungroup(root: TreeNode[], groupId: string): TreeNode[] {
  const loc = find(root, groupId);
  if (!loc || loc.node.kind !== 'group' || loc.node.system) return root;
  const children = loc.node.children;
  const { tree } = remove(root, groupId);
  let out = tree;
  children.forEach((c, i) => {
    out = insert(out, c, loc.parent ? loc.parent.id : null, loc.index + i);
  });
  return out;
}

/** Set collapsed on a group and every group beneath it. */
export function setCollapsedDeep(root: TreeNode[], groupId: string, collapsed: boolean): TreeNode[] {
  const loc = find(root, groupId);
  if (!loc || loc.node.kind !== 'group') return root;
  const ids = new Set(allGroups([loc.node]).map((g) => g.group.id));
  return mapTree(root, (n) => (n.kind === 'group' && ids.has(n.id) ? { ...n, collapsed } : n));
}

/** Nearest group override for autosave, walking up from the note. */
export function effectiveAutosave(root: TreeNode[], noteId: string, globalDefault: boolean): boolean {
  const chain = ancestors(root, noteId);
  for (let i = chain.length - 1; i >= 0; i--) if (chain[i].autosave !== undefined) return chain[i].autosave!;
  return globalDefault;
}

/** Drop notes whose documents no longer exist and drop empty non-system groups if asked. */
export function prune(root: TreeNode[], keep: (noteId: string) => boolean): TreeNode[] {
  return mapTree(root, (n) => (n.kind === 'note' && !keep(n.id) ? null : n));
}

/**
 * Ungrouped files always sit above the groups at the top level. Stable on both sides; returns
 * the same array when it is already in that order.
 */
export function normalizeLooseFirst(root: TreeNode[]): TreeNode[] {
  const firstGroup = root.findIndex((n) => n.kind === 'group');
  if (firstGroup < 0 || !root.slice(firstGroup).some((n) => n.kind === 'note')) return root;
  return [...root.filter((n) => n.kind === 'note'), ...root.filter((n) => n.kind === 'group')];
}
