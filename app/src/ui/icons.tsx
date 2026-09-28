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

/** App icon: a notepad page with a folded corner and a "2" badge. Our own artwork. */
export const AppIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
    <defs>
      <linearGradient id="np2g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#5ec8ff" />
        <stop offset="1" stop-color="#2a6fdb" />
      </linearGradient>
    </defs>
    <path d="M7 3h13l6 6v18a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" fill="#fdfdfd" stroke="#8aa4c2" stroke-width="1" />
    <path d="M20 3v6h6" fill="#dfe9f5" stroke="#8aa4c2" stroke-width="1" stroke-linejoin="round" />
    <path d="M9 13h11M9 17h11M9 21h7" stroke="#9fb3c8" stroke-width="1.4" stroke-linecap="round" />
    <circle cx="23.5" cy="23.5" r="7" fill="url(#np2g)" />
    <path d="M20.9 21.6c.3-1.3 1.3-2 2.6-2 1.5 0 2.5.9 2.5 2.1 0 1-.6 1.6-1.6 2.4l-2.8 2.2h4.6" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
);
