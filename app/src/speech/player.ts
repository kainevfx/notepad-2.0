import { speechChunks } from './text';

export type SpeechStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';
export interface SpeechState { status: SpeechStatus; title: string; docId: string; part: number; total: number; error?: string }
export interface SpeechOptions { endpoint: string; voice: string; rate: number }
export interface AudioHandle {
  playbackRate: number; onended: (() => void) | null; onerror: (() => void) | null;
  play(): Promise<void>; pause(): void; dispose(): void;
}

/** Injectable transport/player keep race conditions testable without a sound device. */
export function createSpeechPlayer(
  synthesize: (text: string, options: SpeechOptions, signal: AbortSignal) => Promise<Blob>,
  makeAudio: (blob: Blob) => AudioHandle,
  changed: (state: SpeechState) => void,
) {
  let state: SpeechState = { status: 'idle', title: '', docId: '', part: 0, total: 0 };
  let generation = 0;
  let controller: AbortController | undefined;
  let audio: AudioHandle | undefined;
  let paused = false;
  let rate = 1;
  const publish = (patch: Partial<SpeechState>) => { state = { ...state, ...patch }; changed(state); };
  const release = () => {
    if (audio) { audio.onended = audio.onerror = null; audio.pause(); audio.dispose(); audio = undefined; }
  };
  const stop = () => {
    generation++; controller?.abort(); controller = undefined; paused = false; release();
    publish({ status: 'idle', error: undefined, part: 0, total: 0, docId: '', title: '' });
  };
  const fail = (error: unknown, token: number) => {
    if (token !== generation) return;
    release(); publish({ status: 'error', error: error instanceof Error ? error.message : String(error) });
  };
  const play = async (token: number) => {
    if (!audio || token !== generation || paused) return;
    try {
      await audio.play();
      if (token === generation && !paused) publish({ status: 'playing' });
    } catch (error) { if (!paused) fail(error, token); }
  };
  return {
    stop,
    get state() { return state; },
    async start(text: string, docId: string, title: string, options: SpeechOptions) {
      stop();
      const chunks = speechChunks(text);
      if (!chunks.length) return;
      const token = generation;
      controller = new AbortController();
      const signal = controller.signal;
      rate = options.rate;
      publish({ status: 'loading', title, docId, part: 1, total: chunks.length });
      const next = async (index: number): Promise<void> => {
        if (token !== generation) return;
        release();
        if (index === chunks.length) { stop(); return; }
        publish({ part: index + 1, status: paused ? 'paused' : 'loading' });
        try {
          const blob = await synthesize(chunks[index], options, signal);
          if (token !== generation) return;
          audio = makeAudio(blob);
          audio.playbackRate = rate;
          audio.onended = () => { void next(index + 1); };
          audio.onerror = () => fail(new Error('The generated audio could not be played. Try another voice.'), token);
          await play(token);
        } catch (error) { fail(error, token); }
      };
      await next(0);
    },
    pause() {
      if (state.status !== 'loading' && state.status !== 'playing') return;
      paused = true; audio?.pause(); publish({ status: 'paused' });
    },
    resume() {
      if (state.status !== 'paused') return;
      paused = false; publish({ status: audio ? 'playing' : 'loading' }); void play(generation);
    },
    setRate(value: number) {
      rate = Number.isFinite(value) ? Math.max(0.5, Math.min(2, value)) : 1;
      if (audio) audio.playbackRate = rate;
    },
  };
}
