import { describe, it, expect, vi } from 'vitest';
import { chooseEngine, windowsHandle, pickWindowsVoice, FALLBACK_NOTE } from './engines';

describe('chooseEngine', () => {
  it('Automatic uses Kokoro when its server answers', async () =>
    expect(await chooseEngine('auto', async () => true, true)).toEqual({ engine: 'kokoro' }));
  it('Automatic falls back to a Windows voice, and says so', async () =>
    expect(await chooseEngine('auto', async () => false, true)).toEqual({ engine: 'windows', note: FALLBACK_NOTE }));
  it('Automatic still tries Kokoro when there are no Windows voices (its error then explains)', async () =>
    expect(await chooseEngine('auto', async () => false, false)).toEqual({ engine: 'kokoro' }));
  it('Kokoro only never checks or falls back', async () => {
    const check = vi.fn(async () => false);
    expect(await chooseEngine('kokoro', check, true)).toEqual({ engine: 'kokoro' });
    expect(check).not.toHaveBeenCalled();
  });
  it('Windows only', async () => expect(await chooseEngine('windows', async () => true, true)).toEqual({ engine: 'windows' }));
});

describe('pickWindowsVoice', () => {
  const voices = [
    { name: 'Microsoft David - English (United States)', lang: 'en-US', default: true },
    { name: 'Microsoft Hazel - English (United Kingdom)', lang: 'en-GB', default: false },
    { name: 'Microsoft Zira - English (United States)', lang: 'en-US', default: false },
  ] as SpeechSynthesisVoice[];
  it('the chosen voice by name', () => expect(pickWindowsVoice(voices, 'Microsoft Zira - English (United States)')?.name).toContain('Zira'));
  it('otherwise a British English voice', () => expect(pickWindowsVoice(voices, '')?.name).toContain('Hazel'));
  it('otherwise the default', () => expect(pickWindowsVoice(voices.filter((v) => v.lang !== 'en-GB'), '')?.name).toContain('David'));
  it('none', () => expect(pickWindowsVoice([], '')).toBeNull());
});

describe('windowsHandle', () => {
  function fakeSynth() {
    const spoken: any[] = [];
    return {
      spoken,
      speaking: false,
      paused: false,
      speak: vi.fn((u: any) => spoken.push(u)),
      pause: vi.fn(),
      resume: vi.fn(),
      cancel: vi.fn(),
    };
  }
  class U {
    text: string;
    rate = 1;
    voice: any = null;
    onend: any = null;
    onerror: any = null;
    constructor(t: string) {
      this.text = t;
    }
  }
  it('speaks at the chosen rate, pauses and resumes, reports the end', async () => {
    const synth = fakeSynth();
    const h = windowsHandle('Hello there.', null, synth as any, U as any);
    h.playbackRate = 1.5;
    await h.play();
    expect(synth.speak).toHaveBeenCalledTimes(1);
    expect(synth.spoken[0].rate).toBe(1.5);
    h.pause();
    expect(synth.pause).toHaveBeenCalled();
    await h.play();
    expect(synth.resume).toHaveBeenCalled();
    expect(synth.speak).toHaveBeenCalledTimes(1);
    const ended = vi.fn();
    h.onended = ended;
    synth.spoken[0].onend();
    expect(ended).toHaveBeenCalled();
  });
  it('cancelling (stop) is not reported as an error', async () => {
    const synth = fakeSynth();
    const h = windowsHandle('x', null, synth as any, U as any);
    const err = vi.fn();
    h.onerror = err;
    await h.play();
    synth.spoken[0].onerror({ error: 'canceled' });
    synth.spoken[0].onerror({ error: 'interrupted' });
    expect(err).not.toHaveBeenCalled();
    synth.spoken[0].onerror({ error: 'synthesis-failed' });
    expect(err).toHaveBeenCalledTimes(1);
    h.dispose();
    expect(synth.cancel).toHaveBeenCalled();
    synth.spoken[0].onerror({ error: 'synthesis-failed' });
    expect(err).toHaveBeenCalledTimes(1); // nothing is reported after stopping
  });
});
