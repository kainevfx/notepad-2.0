import { expect, it, vi } from 'vitest';
import { createSpeechPlayer, type AudioHandle } from './player';
const opts = { endpoint: 'http://127.0.0.1:8880', voice: 'bf_emma', rate: 1 };
function setup() {
  const pending: { resolve: (blob: Blob) => void; reject: (error: Error) => void }[] = [];
  const handles: AudioHandle[] = [];
  const synthesize = vi.fn(() => new Promise<Blob>((resolve, reject) => pending.push({ resolve, reject })));
  const player = createSpeechPlayer(synthesize, () => {
    const a = { playbackRate: 1, onended: null, onerror: null, play: vi.fn(async () => {}), pause: vi.fn(), dispose: vi.fn() };
    handles.push(a); return a;
  }, vi.fn());
  return { player, pending, handles, synthesize };
}
it('pause while generating cannot autoplay; resume starts once and speed applies', async () => {
  const { player, pending, handles } = setup();
  const work = player.start('Hello.', 'a', 'Page', opts);
  player.pause(); pending[0].resolve(new Blob()); await work;
  expect(handles[0].play).not.toHaveBeenCalled();
  player.setRate(1.5); player.resume(); await Promise.resolve();
  expect(handles[0].play).toHaveBeenCalledTimes(1);
  expect(handles[0].playbackRate).toBe(1.5);
  player.stop(); expect(handles[0].dispose).toHaveBeenCalledOnce();
});
it('stop or replacement drops late audio and late errors', async () => {
  const { player, pending, handles } = setup();
  const first = player.start('First', 'a', 'A', opts);
  const second = player.start('Second', 'b', 'B', opts);
  pending[0].reject(new Error('late')); await first;
  expect(player.state.docId).toBe('b');
  player.stop(); pending[1].resolve(new Blob()); await second;
  expect(handles).toHaveLength(0);
  expect(player.state.status).toBe('idle');
});
it('continues all chunks, completes cleanly, and reports service failures', async () => {
  const { player, pending, handles, synthesize } = setup();
  const work = player.start('Hello world. '.repeat(100), 'a', 'A', opts);
  pending[0].resolve(new Blob()); await work;
  expect(player.state.total).toBe(2);
  handles[0].onended!();
  expect(synthesize).toHaveBeenCalledTimes(2);
  pending[1].reject(new Error('Kokoro unavailable'));
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(player.state.status).toBe('error');
  expect(player.state.error).toBe('Kokoro unavailable');
});
