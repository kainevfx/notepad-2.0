import { expect, it, vi } from 'vitest';
import { createSpeechPlayer, type AudioHandle, type SpeechOptions } from './player';

const opts: SpeechOptions = { engine: 'kokoro', endpoint: 'http://127.0.0.1:8880', voice: 'bf_emma', windowsVoice: '', rate: 1 };

function setup() {
  const pending: { resolve: (h: AudioHandle) => void; reject: (error: Error) => void }[] = [];
  const handles: AudioHandle[] = [];
  const make = (): AudioHandle => {
    const a: AudioHandle = { playbackRate: 1, onended: null, onerror: null, play: vi.fn(async () => {}), pause: vi.fn(), dispose: vi.fn() };
    handles.push(a);
    return a;
  };
  // An engine turns one chunk of text into something playable (Kokoro: audio; Windows: an utterance).
  const prepare = vi.fn(() => new Promise<AudioHandle>((resolve, reject) => pending.push({ resolve, reject })));
  const player = createSpeechPlayer(prepare, vi.fn());
  return { player, pending, handles, prepare, make };
}

it('pause while generating cannot autoplay; resume starts once and speed applies', async () => {
  const { player, pending, handles, make } = setup();
  const work = player.start('Hello.', 'a', 'Page', opts);
  player.pause();
  pending[0].resolve(make());
  await work;
  expect(handles[0].play).not.toHaveBeenCalled();
  player.setRate(1.5);
  player.resume();
  await Promise.resolve();
  expect(handles[0].play).toHaveBeenCalledTimes(1);
  expect(handles[0].playbackRate).toBe(1.5);
  player.stop();
  expect(handles[0].dispose).toHaveBeenCalledOnce();
});

it('stop or replacement drops late audio and late errors', async () => {
  const { player, pending, make } = setup();
  const first = player.start('First', 'a', 'A', opts);
  const second = player.start('Second', 'b', 'B', opts);
  pending[0].reject(new Error('late'));
  await first;
  expect(player.state.docId).toBe('b');
  player.stop();
  const late = make();
  pending[1].resolve(late);
  await second;
  expect(late.play).not.toHaveBeenCalled();
  expect(late.dispose).toHaveBeenCalledOnce();
  expect(player.state.status).toBe('idle');
});

it('continues all chunks, completes cleanly, and reports service failures', async () => {
  const { player, pending, handles, prepare, make } = setup();
  const work = player.start('Hello world. '.repeat(100), 'a', 'A', opts);
  pending[0].resolve(make());
  await work;
  expect(player.state.total).toBe(2);
  handles[0].onended!();
  expect(prepare).toHaveBeenCalledTimes(2);
  pending[1].reject(new Error('Kokoro unavailable'));
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(player.state.status).toBe('error');
  expect(player.state.error).toBe('Kokoro unavailable');
});

it('a note from the engine (e.g. falling back to a Windows voice) is shown', async () => {
  const { player, pending, make } = setup();
  const work = player.start('Hi.', 'a', 'A', opts, "Kokoro isn't running, so a Windows voice is reading.");
  pending[0].resolve(make());
  await work;
  expect(player.state.note).toBe("Kokoro isn't running, so a Windows voice is reading.");
});
