// Startup guide overlay: a spotlight on one part of the app and a card explaining it.
import { useEffect, useLayoutEffect, useState } from 'preact/hooks';
import { guideOpen } from '../state/ui';
import { updateSettings } from '../state/settings';
import { GUIDE_STEPS } from './guide-steps';

type Box = { left: number; top: number; width: number; height: number };

function findTarget(selectors: string[] | undefined): Box | null {
  for (const sel of selectors ?? []) {
    const el = document.querySelector(sel) as HTMLElement | null;
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    return { left: r.left - 6, top: r.top - 6, width: r.width + 12, height: r.height + 12 };
  }
  return null;
}

export function Guide() {
  const [i, setI] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const step = GUIDE_STEPS[i];
  const last = i === GUIDE_STEPS.length - 1;

  const close = () => {
    guideOpen.value = false;
    updateSettings({ firstRunDone: true });
    setI(0);
  };
  const next = () => (last ? close() : setI(i + 1));
  const back = () => setI(Math.max(0, i - 1));

  useLayoutEffect(() => {
    const measure = () => setBox(findTarget(step.target));
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [i]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight' || e.key === 'Enter') next();
      else if (e.key === 'ArrowLeft') back();
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  });

  // Card next to the spotlight: below it when there is room, otherwise above; centred without one.
  const cardW = 340;
  let cardStyle: Record<string, string>;
  if (box) {
    const below = box.top + box.height + 12;
    const top = below + 190 < window.innerHeight ? below : Math.max(12, box.top - 190 - 12);
    const left = Math.min(Math.max(12, box.left), window.innerWidth - cardW - 12);
    cardStyle = { left: `${left}px`, top: `${top}px` };
  } else {
    cardStyle = { left: `calc(50% - ${cardW / 2}px)`, top: '30%' };
  }

  return (
    <div class="guide" role="dialog" aria-modal="true" aria-label="Startup guide">
      {box ? (
        <div class="guide-spot" style={{ left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px` }} />
      ) : (
        <div class="guide-dim" />
      )}
      <div class="guide-card" style={cardStyle}>
        <div class="guide-count">
          Step {i + 1} of {GUIDE_STEPS.length}
        </div>
        <h3>{step.title}</h3>
        <p>{step.text}</p>
        <div class="guide-actions">
          <button class="btn subtle" onClick={close}>
            {last ? 'Close' : 'Skip tour'}
          </button>
          <span class="guide-flex" />
          {i > 0 && (
            <button class="btn" onClick={back}>
              Back
            </button>
          )}
          <button class="btn primary" onClick={next} autoFocus>
            {last ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
