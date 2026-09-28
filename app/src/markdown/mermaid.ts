// Replaces ```mermaid code blocks inside rendered Markdown with diagrams (loaded on demand).
let mermaidMod: Promise<typeof import('mermaid')> | null = null;
let mermaidSeq = 0;

export async function renderMermaid(root: HTMLElement, dark: boolean) {
  const blocks = Array.from(root.querySelectorAll('pre > code.language-mermaid')) as HTMLElement[];
  if (!blocks.length) return;
  mermaidMod ??= import('mermaid');
  const mermaid = (await mermaidMod).default;
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: dark ? 'dark' : 'default', fontFamily: 'Segoe UI, sans-serif' });
  for (const code of blocks) {
    const pre = code.parentElement!;
    try {
      const { svg } = await mermaid.render(`mmd-${++mermaidSeq}`, code.textContent ?? '');
      const fig = document.createElement('div');
      fig.className = 'mermaid-figure';
      fig.innerHTML = svg;
      fig.dataset.line = pre.dataset.line ?? '';
      pre.replaceWith(fig);
    } catch (e) {
      pre.classList.add('mermaid-error');
      pre.title = String(e);
    }
  }
}
