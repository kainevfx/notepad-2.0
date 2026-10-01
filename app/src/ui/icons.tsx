// Fluent-style line icons, 16px grid, stroke follows currentColor.
import type { JSX } from 'preact';

type P = { size?: number; class?: string };
const S = (d: JSX.Element, { size = 16, class: c }: P, vb = '0 0 16 16') => (
  <svg class={`ic ${c ?? ''}`} width={size} height={size} viewBox={vb} fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    {d}
  </svg>
);

export const IcMinimize = (p: P) => S(<path d="M3 8h10" />, p);
export const IcMaximize = (p: P) => S(<rect x="3.5" y="3.5" width="9" height="9" rx="1" />, p);
export const IcRestore = (p: P) => S(<><rect x="3.5" y="5.5" width="7" height="7" rx="1" /><path d="M5.5 5.5V4.5a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-1" /></>, p);
export const IcClose = (p: P) => S(<path d="M4 4l8 8M12 4l-8 8" />, p);
export const IcPlus = (p: P) => S(<path d="M8 3v10M3 8h10" />, p);
export const IcChevronDown = (p: P) => S(<path d="M4.5 6.5 8 10l3.5-3.5" />, p);
export const IcChevronUp = (p: P) => S(<path d="M4.5 9.5 8 6l3.5 3.5" />, p);
export const IcChevronRight = (p: P) => S(<path d="M6.5 4.5 10 8l-3.5 3.5" />, p);
export const IcChevronLeft = (p: P) => S(<path d="M9.5 4.5 6 8l3.5 3.5" />, p);
export const IcGear = (p: P) =>
  S(
    <>
      <circle cx="8" cy="8" r="2" />
      <path d="M8 1.8l1 1.6 1.8-.5.5 1.8 1.6 1-.9 1.6.9 1.6-1.6 1-.5 1.8-1.8-.5-1 1.6-1-1.6-1.8.5-.5-1.8-1.6-1 .9-1.6-.9-1.6 1.6-1 .5-1.8 1.8.5z" />
    </>,
    p,
  );
export const IcTray = (p: P) => S(<><path d="M2.5 9.5h3l1 1.5h3l1-1.5h3" /><path d="M2.5 9.5v3a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-3l-1.8-5.2a1 1 0 0 0-.9-.8H5.2a1 1 0 0 0-.9.8z" /><path d="M8 3.5v4M6.3 5.9 8 7.6l1.7-1.7" /></>, p);
/** Collapse the sidebar: a panel with its side bar and an arrow pointing into it. */
export const IcPanelCollapse = (p: P) => S(<><rect x="1.5" y="2.5" width="13" height="11" rx="1.5" /><path d="M6 2.5v11M11.5 6 9.5 8l2 2" /></>, p);
/** Expand the sidebar: the same panel, arrow pointing out. */
export const IcPanelExpand = (p: P) => S(<><rect x="1.5" y="2.5" width="13" height="11" rx="1.5" /><path d="M6 2.5v11M9.5 6l2 2-2 2" /></>, p);
export const IcSidebar = (p: P) => S(<><rect x="2" y="3" width="12" height="10" rx="1.5" /><path d="M6 3v10" /></>, p);
export const IcTabsTop = (p: P) => S(<><rect x="2" y="3" width="12" height="10" rx="1.5" /><path d="M2 6.5h12M6 3v3.5" /></>, p);
export const IcDoc = (p: P) => S(<><path d="M4.5 2h5l3 3v8.5a.5.5 0 0 1-.5.5H4.5a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5z" /><path d="M9.5 2v3h3M6 8h4.5M6 10.5h4.5" /></>, p);
export const IcLines = (p: P) => S(<path d="M3 4h10M3 7h10M3 10h10M3 13h10" />, p);
export const IcGrid = (p: P) => S(<><rect x="2.5" y="2.5" width="11" height="11" rx="1" /><path d="M2.5 6.2h11M2.5 9.8h11M6.2 2.5v11M9.8 2.5v11" /></>, p);
export const IcNumbers = (p: P) => S(<><path d="M2.5 3.5h1v3M2.5 6.5h2M2.5 9.5h2l-2 2.5h2" /><path d="M7 4.5h6.5M7 8h6.5M7 11.5h6.5" /></>, p);
export const IcNone = (p: P) => S(<><circle cx="8" cy="8" r="5.5" /><path d="M4.1 11.9l7.8-7.8" /></>, p);
export const IcPaper = (p: P) => S(<><path d="M3.5 2.5h9v11h-9z" /><path d="M5.5 5.5h5M5.5 8h5M5.5 10.5h3" /></>, p);
export const IcMarkdown = (p: P) => S(<><rect x="1.5" y="3.5" width="13" height="9" rx="1.5" /><path d="M4 10.5v-5l2 2.5 2-2.5v5M10.5 5.5v5M9 9l1.5 1.5L12 9" /></>, p);
export const IcSplit = (p: P) => S(<><rect x="2" y="3" width="12" height="10" rx="1.5" /><path d="M8 3v10" /></>, p);
export const IcEye = (p: P) => S(<><path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" /><circle cx="8" cy="8" r="2" /></>, p);
export const IcPencil = (p: P) => S(<path d="M10.5 2.5l3 3L6 13H3v-3z" />, p);
export const IcMore = (p: P) => S(<><circle cx="3.5" cy="8" r=".6" fill="currentColor" /><circle cx="8" cy="8" r=".6" fill="currentColor" /><circle cx="12.5" cy="8" r=".6" fill="currentColor" /></>, p);
export const IcFolderPlus = (p: P) => S(<><path d="M1.5 4.5a1 1 0 0 1 1-1h3.3l1.4 1.5h6.3a1 1 0 0 1 1 1v6.5a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1z" /><path d="M8 7.5v4M6 9.5h4" /></>, p);
export const IcSearch = (p: P) => S(<><circle cx="7" cy="7" r="4" /><path d="M10 10l3.5 3.5" /></>, p);
export const IcPin = (p: P) => S(<path d="M9.5 2.5l4 4-2 1-2.5 2.5.5 2.5-1 1-2.5-2.5L3 14l-.5-.5 3-3L3 8l1-1 2.5.5L9 5z" />, p);
export const IcCheck = (p: P) => S(<path d="M3.5 8.5l3 3 6-7" />, p);
export const IcSave = (p: P) => S(<><path d="M3 2.5h8l2.5 2.5v8.5H3z" /><path d="M5.5 2.5v3h4.5v-3M5 13.5v-4h6v4" /></>, p);

// New-file and formatting toolbar icons.
export const IcNewText = (p: P) => S(<><path d="M4.5 2h5l3 3v8.5a.5.5 0 0 1-.5.5H4.5a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5z" /><path d="M9.5 2v3h3M8 7.5v4M6 9.5h4" /></>, p);
export const IcNewMd = (p: P) => S(<><path d="M4.5 2h5l3 3v8.5a.5.5 0 0 1-.5.5H4.5a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5z" /><path d="M9.5 2v3h3M5.8 11.5v-4l1.3 1.6 1.3-1.6v4M10.5 7.5v4M9.5 10.5l1 1 1-1" /></>, p);
export const IcBold = (p: P) => S(<path d="M5 3h3.8a2.5 2.5 0 0 1 0 5H5zM5 8h4.3a2.5 2.5 0 0 1 0 5H5z" stroke-width="1.7" />, p);
export const IcItalic = (p: P) => S(<path d="M7 3h5M4 13h5M9.5 3l-3 10" stroke-width="1.4" />, p);
export const IcUnderline = (p: P) => S(<path d="M4.5 2.5v5a3.5 3.5 0 0 0 7 0v-5M3.5 14h9" stroke-width="1.3" />, p);
export const IcStrike = (p: P) => S(<path d="M2.5 8h11M11 4.5C10.5 3.3 9.4 2.8 8 2.8 6.2 2.8 5 3.8 5 5.2c0 1 .6 1.6 1.5 2M5 11.3c.5 1.2 1.7 1.9 3.2 1.9 1.9 0 3.2-1 3.2-2.5 0-.6-.2-1.1-.6-1.5" stroke-width="1.2" />, p);
export const IcCode = (p: P) => S(<path d="M5.5 4.5 2 8l3.5 3.5M10.5 4.5 14 8l-3.5 3.5" stroke-width="1.3" />, p);
export const IcMic = (p: P) => S(<><rect x="6" y="2" width="4" height="8" rx="2" /><path d="M3.8 7.5a4.2 4.2 0 0 0 8.4 0M8 11.7V14M6 14h4" /></>, p);
/** Font colour: a red letter A. */
export const IcColor = (p: P) => S(<path d="M3.5 13.5 8 2.5l4.5 11M5.3 9.3h5.4" stroke="var(--fb-color, #d93025)" stroke-width="1.8" />, p);
export const IcAlignLeft = (p: P) => S(<path d="M3 4h10M3 7h6M3 10h10M3 13h6" />, p);
export const IcAlignCenter = (p: P) => S(<path d="M3 4h10M5 7h6M3 10h10M5 13h6" />, p);
export const IcAlignRight = (p: P) => S(<path d="M3 4h10M7 7h6M3 10h10M7 13h6" />, p);
export const IcAlignJustify = (p: P) => S(<path d="M3 4h10M3 7h10M3 10h10M3 13h10" />, p);
export const IcListBullet = (p: P) => S(<><circle cx="3.5" cy="4.5" r=".9" fill="currentColor" /><circle cx="3.5" cy="8" r=".9" fill="currentColor" /><circle cx="3.5" cy="11.5" r=".9" fill="currentColor" /><path d="M6.5 4.5h7M6.5 8h7M6.5 11.5h7" /></>, p);
export const IcListNumber = (p: P) => S(<><path d="M2.5 3.3h1v2.9M2.3 6.2h2.2M2.3 9.5h2.2l-2.2 2.6h2.2" stroke-width=".9" /><path d="M6.5 4.5h7M6.5 8h7M6.5 11.5h7" /></>, p);
export const IcListCheck = (p: P) => S(<><rect x="2" y="3" width="3" height="3" rx=".5" /><path d="M2.5 10.5l1 1 1.8-2" /><path d="M7 4.5h6.5M7 10.5h6.5" /></>, p);
export const IcIndent = (p: P) => S(<path d="M3 3.5h10M7 6.5h6M7 9.5h6M3 12.5h10M3 6.2 5 8 3 9.8" />, p);
export const IcOutdent = (p: P) => S(<path d="M3 3.5h10M7 6.5h6M7 9.5h6M3 12.5h10M5 6.2 3 8l2 1.8" />, p);
export const IcLink = (p: P) => S(<path d="M6.8 9.2a2.6 2.6 0 0 0 3.7 0l2.2-2.2a2.6 2.6 0 0 0-3.7-3.7l-.8.8M9.2 6.8a2.6 2.6 0 0 0-3.7 0L3.3 9a2.6 2.6 0 0 0 3.7 3.7l.8-.8" />, p);
export const IcTable = (p: P) => S(<><rect x="2" y="3" width="12" height="10" rx="1" /><path d="M2 6.3h12M2 9.6h12M6 3v10M10 3v10" /></>, p);
export const IcRule = (p: P) => S(<path d="M2 8h12M4 4.5h8M4 11.5h8" />, p);
export const IcWrap = (p: P) => S(<path d="M2.5 4h11M2.5 8h9a2 2 0 0 1 0 4H8.5M10 10.5 8.5 12l1.5 1.5M2.5 12h3.5" />, p);
export const IcConvert = (p: P) => S(<path d="M3 5.5h9l-2.5-2.5M13 10.5H4l2.5 2.5" />, p);

/** App icon: the tray icon's sheet of yellow writing paper (assets/icon/tray-icon.svg), the master icon for the whole app. */
export const AppIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
    <rect x="6" y="2.5" width="20" height="27" rx="1.5" fill="#F7D774" stroke="#B8901F" stroke-width="1" />
    <line x1="11" y1="3" x2="11" y2="29" stroke="#D9534F" stroke-width="1" />
    <line x1="7.5" y1="10" x2="24.5" y2="10" stroke="#6E8FB8" stroke-width="1.2" />
    <line x1="7.5" y1="15" x2="24.5" y2="15" stroke="#6E8FB8" stroke-width="1.2" />
    <line x1="7.5" y1="20" x2="24.5" y2="20" stroke="#6E8FB8" stroke-width="1.2" />
    <line x1="7.5" y1="25" x2="24.5" y2="25" stroke="#6E8FB8" stroke-width="1.2" />
  </svg>
);
