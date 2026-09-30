// Image viewer zoom: steps of 10%, 5%–1600%, and "fit" that only ever shrinks.

export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 16;

export function stepZoom(z: number, dir: 1 | -1): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, dir > 0 ? z * 1.1 : z / 1.1));
}

export function fitScale(imgW: number, imgH: number, stageW: number, stageH: number): number {
  if (!imgW || !imgH || !stageW || !stageH) return 1;
  return Math.min(1, stageW / imgW, stageH / imgH);
}
