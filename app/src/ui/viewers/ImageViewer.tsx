// Images: fit to the window (never enlarged), 100%, zoom buttons and Ctrl+wheel. SVGs are shown
// as images, so scripts inside them never run.
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { ViewerProps } from '../ViewerPane';
import { platform } from '../../platform';
import { formatBytes } from '../../lib/view-kind';
import { stepZoom, fitScale } from '../../lib/zoom';
import { Notice } from './Notice';

export function ImageViewer({ doc }: ViewerProps) {
  const [zoom, setZoom] = useState<'fit' | number>('fit');
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [stage, setStage] = useState({ w: 800, h: 600 });
  const [failed, setFailed] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setStage({ w: el.clientWidth - 32, h: el.clientHeight - 32 }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!doc.path) return null;
  if (failed) return <Notice text="Couldn't show this image." path={doc.path} />;

  const scale = zoom === 'fit' ? fitScale(nat?.w ?? 0, nat?.h ?? 0, stage.w, stage.h) : zoom;
  const src = platform.assetUrl(doc.path) + (doc.rev ? `?v=${doc.rev}` : '');
  const onWheel = (e: WheelEvent) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    setZoom(stepZoom(scale, e.deltaY < 0 ? 1 : -1));
  };

  return (
    <>
      <div class="viewer-toolbar">
        <button class={`btn${zoom === 'fit' ? ' pressed' : ''}`} onClick={() => setZoom('fit')}>Fit</button>
        <button class={`btn${zoom === 1 ? ' pressed' : ''}`} onClick={() => setZoom(1)}>100%</button>
        <button class="btn" title="Zoom out (Ctrl+wheel)" onClick={() => setZoom(stepZoom(scale, -1))}>−</button>
        <button class="btn" title="Zoom in (Ctrl+wheel)" onClick={() => setZoom(stepZoom(scale, 1))}>+</button>
        <span>{Math.round(scale * 100)}%</span>
        <span class="viewer-info">
          {nat ? `${nat.w} × ${nat.h} px · ` : ''}
          {formatBytes(doc.size)}
        </span>
      </div>
      <div class="img-stage" ref={box} onWheel={(e) => onWheel(e as WheelEvent)}>
        <img
          src={src}
          alt={doc.title}
          style={nat ? { width: `${nat.w * scale}px`, height: `${nat.h * scale}px` } : undefined}
          onLoad={(e) => {
            const i = e.currentTarget as HTMLImageElement;
            setNat({ w: i.naturalWidth || 1, h: i.naturalHeight || 1 });
          }}
          onError={() => setFailed(true)}
        />
      </div>
    </>
  );
}
