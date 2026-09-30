// The startup guide (Help > Run startup guide, and once on first run). Each step spotlights the
// first matching element of `target` (tried in order), or shows a centred card when none is set
// or none is on screen.

export interface GuideStep {
  title: string;
  text: string;
  target?: string[];
}

export const GUIDE_STEPS: GuideStep[] = [
  {
    title: 'Welcome to Notepad 2.0',
    text: 'It works like Windows Notepad, with extras: file groups, Markdown with a formatting toolbar, tables, paper styles and a Quick Note. This short tour points each one out. Use Next, or the arrow keys.',
  },
  {
    title: 'New files',
    text: 'Make a plain text file or a Markdown (MD) file here, or with Ctrl+N and Ctrl+Alt+N. Every tab shows a TXT or MD badge so you always know which kind it is.',
    target: ['.side-actions', '.tab-new'],
  },
  {
    title: 'File groups',
    text: 'Keep related files together in a file group. Drag files onto a group, drag groups inside groups, and click a group to fold it away. Ungrouped files always stay at the top.',
    target: ['.side-group-head', '.tab-chip', '.side-actions'],
  },
  {
    title: 'Right-click and double-click',
    text: 'Double-click a file or group (or press F2) to rename it; saved files are renamed on disk. Right-click for Duplicate, Copy and Paste into another group, Colour, and Open in File Explorer.',
    target: ['.side-note', '.tab'],
  },
  {
    title: 'Sort your files',
    text: 'Show files by date modified, date created, name or type. Manual keeps the order you arranged, and switching back never loses it.',
    target: ['.side-sort'],
  },
  {
    title: 'Formatting toolbar',
    text: 'Headings, font size and weight, bold, italic, underline, colour, alignment, lists, links and tables. On a plain .txt file only what text can hold is available, plus Convert to Markdown.',
    target: ['.formatbar'],
  },
  {
    title: 'Visual, Source and Split',
    text: 'Markdown files open in Visual: type straight into the formatted page. Source shows the raw Markdown, and Split shows Source next to a live preview.',
    target: ['.view-switch'],
  },
  {
    title: 'Tables',
    text: 'Insert a table from the toolbar or the Insert menu. Cells can hold headings, lists and formatted text. Drag a column or row border to resize it; the Table button appears while you are in one.',
    target: ['.fb-grid-anchor', '.formatbar'],
  },
  {
    title: 'Paper and page margin',
    text: 'Choose Lines, Grid or Code paper (numbers on every line) and set the page margin so text never runs to the window edges.',
    target: ['.paper-anchor'],
  },
  {
    title: 'Interface size',
    text: 'This slider makes the sidebar and the page more compact or roomier; menus and toolbars stay the same size. Ctrl + and Ctrl − zoom just the text.',
    target: ['.sb-scale'],
  },
  {
    title: 'Quick Note and the tray',
    text: 'This button hides Notepad 2.0 to the tray. Click the tray icon or press Win+Alt+N for a small always-on-top Quick Note that saves as you type.',
    target: ['.cap-tray'],
  },
  {
    title: 'Saving',
    text: 'Untitled notes save themselves. Files you open save with Ctrl+S, and unsaved changes survive a crash or restart. The status bar always says which applies.',
    target: ['.sb-save'],
  },
  {
    title: "You're all set",
    text: 'Help > Keyboard shortcuts lists every shortcut, and Help > Run startup guide brings this tour back any time.',
  },
];
