/**
 * Name for a copy: "Notes.md" -> "Notes (2).md", the smallest free number from 2 up.
 * A copy of "Notes (2).md" continues from its number. `taken` answers whether a name is in use.
 */
export function copyName(name: string, taken: (candidate: string) => boolean): string {
  const dot = name.lastIndexOf('.');
  const ext = dot > 0 ? name.slice(dot) : '';
  let stem = dot > 0 ? name.slice(0, dot) : name;
  let n = 2;
  const numbered = /^(.*) \((\d+)\)$/.exec(stem);
  if (numbered) {
    stem = numbered[1];
    n = Number(numbered[2]) + 1;
  }
  for (;; n++) {
    const candidate = `${stem} (${n})${ext}`;
    if (!taken(candidate)) return candidate;
  }
}
