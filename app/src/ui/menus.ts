import type { MenuItem } from '../state/ui';
import { ask } from '../state/ui';
import * as T from '../lib/tree-ops';
import {
  docs, tree, closeDoc, closeOthers, newGroupFrom, renameGroup, setGroupColor, collapseAllInside, ungroup, closeGroup,
  setGroupAutosave, moveNode, moveNodeToRoot, newNote, renameNote, displayTitle, activate, saveDoc, saveDocAs, QUICK_GROUP_ID,
} from '../state/app';
import { platform } from '../platform';
import { settings } from '../state/settings';
import { GROUP_HEX } from './colors';

function moveToGroupItems(nodeId: string): MenuItem[] {
  const items: MenuItem[] = T.allGroups(tree.value)
    .filter(({ group }) => group.id !== nodeId && T.canMove(tree.value, nodeId, group.id, 'inside'))
    .map(({ group, depth }) => ({
      label: `${'  '.repeat(depth - 1)}${group.name}`,
      swatch: GROUP_HEX[group.color],
      action: () => moveNode(nodeId, group.id, 'inside'),
    }));
  if (T.find(tree.value, nodeId)?.parent) items.push({ separator: true }, { label: 'Out of all groups', action: () => moveNodeToRoot(nodeId) });
  return items.length ? items : [{ label: 'No groups yet', disabled: true }];
}

export function noteMenu(id: string): MenuItem[] {
  const d = docs.value[id];
  if (!d) return [];
  const inGroup = !!T.find(tree.value, id)?.parent;
  return [
    { label: 'Add tab to new group', action: () => newGroupFrom([id]) },
    { label: 'Move to group', submenu: moveToGroupItems(id) },
    ...(inGroup ? [{ label: 'Remove from group', action: () => moveNodeToRoot(id) }] : []),
    { separator: true },
    ...(d.kind === 'note'
      ? [
          {
            label: 'Rename…',
            action: async () => {
              const r = await ask({ title: 'Rename note', buttons: [{ label: 'Rename', value: 'ok', primary: true }, { label: 'Cancel', value: 'cancel' }], input: { value: displayTitle(d), select: true } });
              if (r.value === 'ok') renameNote(id, r.input ?? '');
            },
          },
          { label: 'Save as file…', action: () => saveDocAs(id) },
        ]
      : [
          { label: 'Save', shortcut: 'Ctrl+S', action: () => saveDoc(id), disabled: !d.dirty },
          { label: 'Copy path', action: () => navigator.clipboard.writeText(d.path!) },
          { label: 'Reveal in File Explorer', action: () => platform.revealInExplorer(d.path!), disabled: platform.kind !== 'tauri' },
        ]),
    { separator: true },
    { label: 'Close tab', shortcut: 'Ctrl+W', action: () => closeDoc(id) },
    { label: 'Close other tabs', action: () => closeOthers(id) },
  ];
}

export function groupMenu(id: string): MenuItem[] {
  const loc = T.find(tree.value, id);
  if (!loc || loc.node.kind !== 'group') return [];
  const g = loc.node;
  const system = !!g.system;
  const autosaveLabel = g.autosave === undefined ? `follow setting (${settings.value.autosaveFiles ? 'on' : 'off'})` : g.autosave ? 'on' : 'off';
  return [
    {
      label: 'New note in group',
      action: () => {
        const n = newNote({ groupId: id });
        activate(n);
      },
    },
    ...(system
      ? []
      : [
          { label: 'Rename group…', action: () => renameGroup(id) },
          { label: 'Colour', submenu: T.GROUP_COLORS.map((c) => ({ label: c[0].toUpperCase() + c.slice(1), swatch: GROUP_HEX[c], checked: g.color === c, action: () => setGroupColor(id, c) })) },
          { label: 'New subgroup…', action: () => newGroupFrom([], id), disabled: loc.depth + 2 > T.MAX_GROUP_DEPTH },
          { label: 'Move group into', submenu: moveToGroupItems(id) },
        ]),
    { separator: true },
    { label: g.collapsed ? 'Expand' : 'Collapse', action: () => collapseAllInside(id, !g.collapsed) },
    { label: 'Collapse everything inside', action: () => collapseAllInside(id, true) },
    { label: 'Expand everything inside', action: () => collapseAllInside(id, false) },
    { separator: true },
    {
      label: `Autosave opened files: ${autosaveLabel}`,
      submenu: [
        { label: 'Follow the global setting', checked: g.autosave === undefined, action: () => setGroupAutosave(id, undefined) },
        { label: 'Always autosave files in this group', checked: g.autosave === true, action: () => setGroupAutosave(id, true) },
        { label: 'Never autosave files in this group', checked: g.autosave === false, action: () => setGroupAutosave(id, false) },
      ],
    },
    { separator: true },
    ...(system ? [] : [{ label: 'Ungroup', action: () => ungroup(id) }]),
    { label: id === QUICK_GROUP_ID ? 'Close all quick notes' : 'Close group', danger: true, action: () => closeGroup(id) },
  ];
}
