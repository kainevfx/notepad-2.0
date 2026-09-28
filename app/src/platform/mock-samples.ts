// Demo files for the browser build (screenshots, e2e). Not shipped behaviour on Windows.
const D = 'C:\\Users\\Kaine\\Documents\\';

export const SAMPLE_FILES: Record<string, string> = {
  [D + 'Business strategy discussion record.md']: `---
title: Business strategy discussion record
date: 2026-09-23
status: draft
---

## **Business Strategy** discussion record

**Date:** 23 September 2026
**Context:** Halloween loops, Christmas loops, VJ-loop expertise, and a possible creator marketplace.
**Status:** Exploration for future evaluation, not an approved plan.

## Start here

The goal is an affordable, high-quality loop business that treats customers and creators fairly.
The first business creates and sells its own products. The longer-term ambition is a trusted
platform where other creators can sell useful, well-made loops themselves.

### Priorities

1. Halloween loops first, Christmas next
2. Window projection packs
3. Creator marketplace *after* the stores prove demand

| Pack | Loops | Price | Status |
|:-----|------:|------:|:------:|
| Halloween Window | 12 | £29 | ✅ ready |
| Xmas Facade | 16 | £39 | 🛠 in progress |
| Box Mapping Toolkit V2 | 40 | £69 | ✅ live |

- [x] Draft pack list
- [x] Price check against competitors
- [ ] Creator payout model
- [ ] ~~Launch everything at once~~ (rejected)

> **Central unresolved issue:** can affordable pricing generate enough profitable purchases
> to pay creators fairly and cover operating costs?

Revenue per pack is $R = p \\times n - c$, and break-even needs $n \\ge \\frac{c}{p}$.

$$
\\text{margin} = \\frac{\\sum_{i=1}^{k} (p_i - c_i)}{\\sum_{i=1}^{k} p_i}
$$

\`\`\`python
def loop_duration(bpm: int, bars: int = 8) -> float:
    """Seconds for a seamless loop at a given BPM."""
    return bars * 4 * 60 / bpm
\`\`\`

\`\`\`mermaid
graph LR
  A[Render] --> B[Loop QC]
  B --> C[Pack]
  C --> D[Store]
\`\`\`

Footnotes work too.[^1]

<details><summary>Raw HTML is allowed (sanitised)</summary>
Scripts and event handlers are stripped.
</details>

[^1]: Rendered with a CommonMark and GitHub-flavoured Markdown compliant parser.
`,
  [D + 'Meeting Note 1.txt']: `Meeting Note 1
Attendees: Kaine, studio team

- Review the Halloween window pack renders
- Confirm the BPM grid for the Xmas facade loops (128 / 174)
- Next sync Friday 10:00
`,
  [D + 'Meeting Note 2.txt']: `Meeting Note 2

Show file for Saturday: DXV3 exports, 1920x1080 and 3840x2160.
Bring the spare capture card.
`,
  [D + 'Meeting Note 3.txt']: `Meeting Note 3

Creator scouting shortlist, scoring sheet to follow.
`,
  [D + 'API Docs.md']: `# API Docs

\`GET /api/packs\` returns every published pack.

| Field | Type | Notes |
|---|---|---|
| id | string | slug |
| loops | number | count |
`,
  [D + 'Code Snippets.txt']: `// Resolume OSC: trigger column 3
/composition/columns/3/connect 1

// ffmpeg: DXV3 to H.264 preview
ffmpeg -i in.mov -c:v libx264 -crf 18 -pix_fmt yuv420p out.mp4
`,
  [D + 'Bugs.txt']: `Bugs

1. Loop seam visible at frame 0 on the lava pack
2. Alpha premultiplied twice in the hologram set
`,
  [D + 'server.log']: `2026-09-27 09:14:02 INFO  boot ok
2026-09-27 09:14:03 WARN  cache cold
2026-09-27 09:15:10 INFO  render queue empty
`,
};

export const DEMO_DIR = D;
