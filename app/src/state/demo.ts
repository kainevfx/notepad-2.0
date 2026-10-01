// Browser build only: a first-run workspace that mirrors Kaine's mockups, so screenshots
// show groups, nested subgroups and TrayNotes. The Windows app starts with one empty tab.
import * as T from '../lib/tree-ops';
import { DEMO_DIR } from '../platform/mock-samples';
import { platform } from '../platform';
import { tree, openFiles, newNote, docs, QUICK_GROUP_ID, commitTree, renameNote, activate } from './app';

export async function seedDemo() {
  const D = DEMO_DIR;
  const g = (id: string, name: string, color: T.GroupColor, collapsed = false): T.GroupNode => ({ id, kind: 'group', name, color, collapsed, children: [] });
  tree.value = [
    g('g-alpha', 'Project Alpha', 'blue'),
    g('g-dev', 'Development', 'purple'),
    g('g-meet', 'Meeting Notes', 'orange'),
    g('g-ideas', 'Ideas', 'green', true),
    { ...g(QUICK_GROUP_ID, 'TrayNotes', 'yellow', true), system: 'quick-notes' },
  ];
  await openFiles([D + 'Business strategy discussion record.md'], { groupId: 'g-alpha' });
  const monitor = newNote({ text: 'Monitor\n\nLED wall: 5x3 panels, 2.6mm pitch\nProcessor: Novastar, 3840x1152 canvas\n', groupId: 'g-alpha', activate: false });
  renameNote(monitor, 'Monitor');
  await openFiles([D + 'Code Snippets.txt', D + 'API Docs.md'], { groupId: 'g-dev' });
  commitTree(T.createGroup(tree.value, { id: 'g-backend', name: 'Backend', color: 'cyan', collapsed: false }, [], 'g-dev'));
  await openFiles([D + 'Bugs.txt', D + 'server.log'], { groupId: 'g-backend' });
  await openFiles([D + 'Meeting Note 1.txt', D + 'Meeting Note 2.txt', D + 'Meeting Note 3.txt'], { groupId: 'g-meet' });
  commitTree(T.createGroup(tree.value, { id: 'g-files', name: 'Production files', color: 'pink', collapsed: true }, [], null));
  const P = D + 'Production\\';
  await openFiles(
    [P + 'Cast.csv', P + 'Budget.xlsx', P + 'config.json', P + 'pipeline.yaml', P + 'feed.xml', P + 'settings.toml', P + 'Brief.html', D + 'Production Brief.docx', D + 'Logo.png'],
    { groupId: 'g-files' },
  );
  newNote({ text: 'Laser-cut acrylic hologram box\n', groupId: 'g-ideas', activate: false });
  newNote({ text: 'Loop pack: liquid chrome at 174 BPM\n', groupId: 'g-ideas', activate: false });
  const q = newNote({ text: 'Call the venue about the rigging plot\n', groupId: QUICK_GROUP_ID, activate: false });
  docs.value = { ...docs.value, [q]: { ...docs.value[q], quick: true, language: 'markdown' } };
  await platform.storeWrite('quicknote-current.json', JSON.stringify({ id: q }));
  // Make the strategy doc the active tab.
  const strat = Object.values(docs.value).find((d) => d.path?.endsWith('record.md'));
  if (strat) activate(strat.id);
}
