// Small-print dates for the sidebar: "today 19:38", "yesterday 22:09", "Mon 3 Aug 10:15", "28 Sep 2025".
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => String(n).padStart(2, '0');
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export function dayTime(ts: number, now: number): string {
  const d = new Date(ts);
  const n = new Date(now);
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (sameDay(d, n)) return `today ${hm}`;
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (sameDay(d, y)) return `yesterday ${hm}`;
  if (d.getFullYear() === n.getFullYear()) return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${hm}`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Short form for tight spaces: "13:13" today, "yesterday", "Mon 3 Aug", "28 Sep 2025". */
export function shortWhen(ts: number, now: number): string {
  const d = new Date(ts);
  const n = new Date(now);
  if (sameDay(d, n)) return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (sameDay(d, y)) return 'yesterday';
  if (d.getFullYear() === n.getFullYear()) return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** ".md file", ".txt file", ".xlsx file": from the path's extension, else the tab's language. */
export function typeLabel(d: { path: string | null; language: 'plain' | 'markdown' }): string {
  const ext = d.path && /\.([^.\\/]+)$/.exec(d.path)?.[1]?.toLowerCase();
  return `.${ext || (d.language === 'markdown' ? 'md' : 'txt')} file`;
}
