# Sub-plan 02: vertical tabs, groups, nested subgroups (P2)

## Modes
- **Top** (default, pure Notepad). Groups still show as coloured chips in the tab strip, Chrome style: click chip to collapse the group's tabs.
- **Left**: sidebar as in screenshots 1 to 3. Resizable 180 to 420 px, width remembered.
- **Rail**: sidebar collapsed via the `<` button to a thin strip with group names rotated 90 degrees (screenshot 4). Hover or click expands it as an overlay.
- Toggle: View > Tabs, a title-bar button, and `Ctrl+Shift+,`.

## Data model (`workspace.json`)
```ts
type Color = 'grey'|'blue'|'red'|'yellow'|'green'|'pink'|'purple'|'cyan'|'orange'; // Chrome's 9
interface GroupNode { id: string; kind: 'group'; name: string; color: Color; collapsed: boolean; children: TreeNode[] }
interface NoteNode  { id: string; kind: 'note'; title: string; source: { type: 'file'; path: string } | { type: 'store'; storeId: string }; pinned?: boolean }
type TreeNode = GroupNode | NoteNode;
interface Workspace { version: 1; root: TreeNode[]; activeId: string | null; tabsMode: 'top'|'left'|'rail'; sidebarWidth: number }
```
- Nesting depth capped at 4 levels (keeps the sidebar readable). Subgroups inherit the parent colour as a left border tint unless they have their own.
- An open tab is simply a NoteNode. Closing a tab removes it from the tree unless the group is "pinned" (option), so groups can act as saved workspaces.

## Interactions
- Drag a note: reorder, drop onto a group header to add, drop between groups to ungroup. Drag a group: reorder or nest into another group. Drop indicator line plus a highlighted target header.
- Library: `@atlaskit/pragmatic-drag-and-drop` + its tree-item hitbox helper (handles "before / after / make child" zones, keyboard accessible).
- All moves go through `tree-ops.ts` (pure functions: `move`, `insert`, `remove`, `wouldCreateCycle`) with vitest coverage, including dropping a group into its own descendant (rejected).
- Right-click note: Add to new group, Move to group >, Remove from group, Close, Reveal in Explorer, Copy path.
- Right-click group: Rename, Colour (9 swatches), New subgroup, Collapse all inside, Ungroup, Close group, Save group as workspace.
- Click a group header or its chevron: expand/collapse. Alt+click: collapse/expand all siblings.
- Keyboard: Ctrl+Tab / Ctrl+Shift+Tab walks visible tabs in tree order, `Ctrl+Shift+G` new group from current tab.
- The `.md` badge in screenshot 1 shows per-note file type.
