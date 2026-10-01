// A sideways scrollbar that stays at the bottom of the window for wide tables.
//
// A table wider than the page scrolls sideways inside its own box, but that box's scrollbar sits
// under the table's last row - off screen for a long table. While such a table is on screen and
// its own scrollbar isn't, this shows a copy of the scrollbar pinned to the bottom of `scroller`
// (the element that scrolls up and down). Dragging either one moves the table.

/** Which wide box (if any) the floating bar should drive, given layout boxes in screen pixels. */
export function pickWide(
  view: { top: number; bottom: number },
  boxes: { top: number; bottom: number; wide: boolean }[],
): number {
  return boxes.findIndex((b) => b.wide && b.top < view.bottom - 24 && b.bottom > view.bottom);
}

export function floatingHScroll(scroller: HTMLElement, selector: string): () => void {
  const bar = document.createElement('div');
  bar.className = 'float-hscroll';
  bar.setAttribute('aria-hidden', 'true');
  bar.style.display = 'none';
  const inner = document.createElement('div');
  bar.appendChild(inner);
  scroller.appendChild(bar);

  let target: HTMLElement | null = null;
  let syncing = false;

  const update = () => {
    if (bar.parentElement !== scroller || scroller.lastElementChild !== bar) scroller.appendChild(bar);
    const view = scroller.getBoundingClientRect();
    const els = [...scroller.querySelectorAll<HTMLElement>(selector)];
    const i = pickWide(
      view,
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, wide: el.scrollWidth > el.clientWidth + 1 };
      }),
    );
    target = i < 0 ? null : els[i];
    if (!target) {
      bar.style.display = 'none';
      return;
    }
    // Layout px: the interface size setting zooms the page, so screen px differ.
    const scale = scroller.offsetWidth ? view.width / scroller.offsetWidth : 1;
    const r = target.getBoundingClientRect();
    bar.style.display = 'block';
    bar.style.marginLeft = `${Math.max(0, (r.left - view.left) / scale)}px`;
    bar.style.width = `${target.clientWidth}px`;
    inner.style.width = `${target.scrollWidth}px`;
    if (Math.abs(bar.scrollLeft - target.scrollLeft) > 1) {
      syncing = true;
      bar.scrollLeft = target.scrollLeft;
    }
  };

  const onBar = () => {
    if (syncing) {
      syncing = false;
      return;
    }
    if (target) target.scrollLeft = bar.scrollLeft;
  };
  // Scroll events don't bubble; listen while capturing so a table scrolled by Shift+wheel or its
  // own scrollbar moves the floating bar too, and scrolling the page up/down re-picks the table.
  const onScroll = (e: Event) => {
    if (e.target === bar) return;
    if (target && e.target === target) {
      if (Math.abs(bar.scrollLeft - target.scrollLeft) > 1) {
        syncing = true;
        bar.scrollLeft = target.scrollLeft;
      }
      return;
    }
    update();
  };

  let frame = 0;
  const soon = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(update);
  };
  bar.addEventListener('scroll', onBar);
  scroller.addEventListener('scroll', onScroll, true);
  const ro = new ResizeObserver(soon);
  ro.observe(scroller);
  const mo = new MutationObserver((records) => {
    if (records.every((r) => r.target === bar || bar.contains(r.target))) return;
    soon();
  });
  mo.observe(scroller, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
  soon();

  return () => {
    cancelAnimationFrame(frame);
    ro.disconnect();
    mo.disconnect();
    bar.removeEventListener('scroll', onBar);
    scroller.removeEventListener('scroll', onScroll, true);
    bar.remove();
  };
}
