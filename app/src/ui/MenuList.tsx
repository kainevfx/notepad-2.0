import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { MenuItem } from '../state/ui';
import { contextMenu } from '../state/ui';
import { IcCheck, IcChevronRight } from './icons';

export function MenuList({ items, onDone, style }: { items: MenuItem[]; onDone: () => void; style?: Record<string, string> }) {
  const [sub, setSub] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Record<string, string>>(style ?? {});

  // Keep the menu on screen.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const next = { ...(style ?? {}) };
    if (r.right > window.innerWidth - 4) next.left = `${Math.max(4, window.innerWidth - r.width - 4)}px`;
    if (r.bottom > window.innerHeight - 4) next.top = `${Math.max(4, window.innerHeight - r.height - 4)}px`;
    setPos(next);
  }, [items]);

  return (
    <div class="menu" ref={ref} style={pos} role="menu" onPointerDown={(e) => e.stopPropagation()}>
      {items.map((it, i) =>
        it.separator ? (
          <div key={i} class="menu-sep" />
        ) : (
          <div
            key={i}
            role="menuitem"
            class={`menu-item${it.disabled ? ' disabled' : ''}${it.danger ? ' danger' : ''}${sub === i ? ' open' : ''}`}
            onMouseEnter={() => setSub(it.submenu ? i : null)}
            onClick={(e) => {
              e.stopPropagation();
              if (it.disabled) return;
              if (it.submenu) return setSub(i);
              onDone();
              it.action?.();
            }}
          >
            <span class="menu-check">{it.checked ? <IcCheck size={14} /> : it.swatch ? <span class="swatch" style={{ background: it.swatch }} /> : null}</span>
            <span class="menu-label">{it.label}</span>
            {it.shortcut && <span class="menu-shortcut">{it.shortcut}</span>}
            {it.submenu && <IcChevronRight size={12} />}
            {it.submenu && sub === i && (
              <div class="submenu-host">
                <MenuList items={it.submenu} onDone={onDone} />
              </div>
            )}
          </div>
        ),
      )}
    </div>
  );
}

export function ContextMenuHost() {
  const cm = contextMenu.value;
  useEffect(() => {
    if (!cm) return;
    const close = () => (contextMenu.value = null);
    const key = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('pointerdown', close);
    window.addEventListener('blur', close);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('blur', close);
      window.removeEventListener('keydown', key);
    };
  }, [cm]);
  if (!cm) return null;
  return <MenuList items={cm.items} onDone={() => (contextMenu.value = null)} style={{ left: `${cm.x}px`, top: `${cm.y}px`, position: 'fixed' }} />;
}
