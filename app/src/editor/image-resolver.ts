// One image resolver per document folder, reused, so the Markdown processor (cached per resolver)
// isn't rebuilt on every render.
import { resolveImageUrl } from './insert';
import { platform } from '../platform';

const cache = new Map<string, (u: string) => string>();

export function imageResolver(base: string | null): (u: string) => string {
  const key = base ?? '';
  let fn = cache.get(key);
  if (!fn) {
    fn = (u: string) => (u ? resolveImageUrl(base, u, platform.assetUrl) : base ?? '');
    if (cache.size > 50) cache.clear();
    cache.set(key, fn);
  }
  return fn;
}
