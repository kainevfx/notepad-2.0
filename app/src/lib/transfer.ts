// Moving files and file groups between windows (pure tree logic; the hand-over itself is in
// state/app.ts). Each window owns its own tree; a move takes subtrees out of one and adds them
// to another.
import * as T from './tree-ops';
import type { TreeNode, GroupNode } from './tree-ops';

/** Note ids inside a node (the node itself when it is a note). */
function noteIds(node: TreeNode): string[] {
  return node.kind === 'note' ? [node.id] : node.children.flatMap(noteIds);
}

/**
 * Take `ids` (files or groups) out of the tree. A file already inside a taken group goes with
 * its group. Returns the taken subtrees in tree order, every doc id they hold, and the rest.
 */
export function extractItems(tree: TreeNode[], ids: string[]): { nodes: TreeNode[]; docIds: string[]; rest: TreeNode[] } {
  const want = new Set(ids);
  const nodes: TreeNode[] = [];
  const walk = (list: TreeNode[]): TreeNode[] =>
    list.flatMap((node): TreeNode[] => {
      if (want.has(node.id)) {
        nodes.push(node);
        return [];
      }
      return node.kind === 'group' ? [{ ...node, children: walk(node.children) } as GroupNode] : [node];
    });
  const rest = walk(tree);
  return { nodes, docIds: nodes.flatMap(noteIds), rest };
}

/**
 * Add moved subtrees to a tree: into a file group (at its end, or before `beforeId`), or into
 * Ungrouped (files after the ungrouped files, groups after the groups). Unknown groups fall back
 * to Ungrouped.
 */
export function importItems(tree: TreeNode[], nodes: TreeNode[], drop: { groupId: string | null; beforeId?: string | null }): TreeNode[] {
  const target = drop.groupId ? T.find(tree, drop.groupId) : null;
  if (target && target.node.kind === 'group') {
    const group = target.node as GroupNode;
    let at = drop.beforeId ? group.children.findIndex((c) => c.id === drop.beforeId) : -1;
    if (at < 0) at = group.children.length;
    let t = tree;
    for (const node of nodes) t = T.insert(t, node, group.id, at++);
    return T.normalizeLooseFirst(t);
  }
  return T.normalizeLooseFirst([...tree, ...nodes]);
}

/** Copies need fresh ids: returns the renumbered subtrees and old-id -> new-id. */
export function remapIds(nodes: TreeNode[], newId: (old: TreeNode) => string): { nodes: TreeNode[]; map: Record<string, string> } {
  const map: Record<string, string> = {};
  const copy = (node: TreeNode): TreeNode => {
    const id = newId(node);
    map[node.id] = id;
    return node.kind === 'group' ? ({ ...node, id, children: node.children.map(copy) } as GroupNode) : ({ ...node, id } as TreeNode);
  };
  return { nodes: nodes.map(copy), map };
}

/** "main" is window 1, "main-3" is window 3. */
export function windowIndex(label: string): number {
  const m = /^main-(\d+)$/.exec(label);
  return m ? Number(m[1]) : 1;
}

/** The title bar says which window this is once there is more than one. */
export function windowTitle(base: string, label: string, count: number): string {
  return count > 1 ? `${base} (Window ${windowIndex(label)})` : base;
}

/** Where a window keeps its tabs and groups. "main" keeps the original file. */
export function sessionKey(label: string): string {
  return label === 'main' ? 'session.json' : `sessions/${label}.json`;
}
