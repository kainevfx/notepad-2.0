// Reading a page aloud: split the text into chunks, have the engine prepare each one (Kokoro:
// audio from the server; Windows: an utterance) and play them in order. Pause, resume, stop,
// replacement and speed changes are safe at any moment: a chunk that arrives after the reading
// was stopped or replaced is thrown away, never played.
import { speechChunks } from './text';

export type SpeechStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';
export type EngineChoice = 'auto' | 'kokoro' | 'windows';
export interface SpeechState {
  status: SpeechStatus;
  title: string;
  docId: string;
  part: number;
  total: number;
  error?: string;
  /** e.g. "Kokoro isn't running, so a Windows voice is reading." */
  note?: string;
}
export interface SpeechOptions {
  /** The engine actually used for this reading ('kokoro' or 'windows'). */
  engine: EngineChoice;
  endpoint: string;
  voice: string;
  windowsVoice: string;
  rate: number;
}
export interface AudioHandle {
  playbackRate: number;
  onended: (() => void) | null;
  onerror: (() => void) | null;
  play(): Promise<void>;
  pause(): void;
  dispose(): void;
}
export type Prepare = (text: string, options: SpeechOptions, signal: AbortSignal) => Promise<AudioHandle>;

export function createSpeechPlayer(prepare: Prepare, changed: (state: SpeechState) => void) {
  let state: SpeechState = { status: 'idle', title: '', docId: '', part: 0, total: 0 };
  let generation = 0;
  let controller: AbortController | undefined;
  let audio: AudioHandle | undefined;
  let paused = false;
  let rate = 1;
  const publish = (patch: Partial<SpeechState>) => {
    state = { ...state, ...patch };
    changed(state);
  };
  let prefetch: { index: number; handle: Promise<AudioHandle> } | undefined;
  const release = () => {
    if (!audio) return;
    audio.onended = audio.onerror = null;
    audio.dispose();
    audio = undefined;
  };
  /** Throw away a part prepared ahead of time (when it arrives, if it hasn't yet). */
  const dropPrefetch = () => {
    prefetch?.handle.then((h) => h.dispose(), () => {});
    prefetch = undefined;
  };
  const stop = () => {
    generation++;
    controller?.abort();
    controller = undefined;
    paused = false;
    release();
    dropPrefetch();
    publish({ status: 'idle', error: undefined, note: undefined, part: 0, total: 0, docId: '', title: '' });
  };
  const fail = (error: unknown, token: number) => {
    if (token !== generation) return;
    release();
    publish({ status: 'error', error: error instanceof Error ? error.message : String(error) });
  };
  const play = async (token: number) => {
    if (!audio || token !== generation || paused) return;
    try {
      await audio.play();
      if (token === generation && !paused) publish({ status: 'playing' });
    } catch (error) {
      if (!paused) fail(error, token);
    }
  };
  return {
    stop,
    get state() {
      return state;
    },
    /** Show "Preparing…" straight away (while the engine is chosen); returns the token for start(). */
    announce(docId: string, title: string): number {
      stop();
      publish({ status: 'loading', title, docId, part: 0, total: 0 });
      return generation;
    },
    async start(text: string, docId: string, title: string, options: SpeechOptions, note?: string, announced?: number) {
      if (announced === undefined) stop();
      else if (announced !== generation) return; // stopped (or replaced) while it was being set up
      const chunks = speechChunks(text);
      if (!chunks.length) {
        stop();
        return;
      }
      const token = generation;
      controller = new AbortController();
      const signal = controller.signal;
      rate = options.rate;
      publish({ status: 'loading', title, docId, part: 1, total: chunks.length, note });
      const next = async (index: number): Promise<void> => {
        if (token !== generation) return;
        release();
        if (index === chunks.length) {
          stop();
          return;
        }
        publish({ part: index + 1, status: paused ? 'paused' : 'loading' });
        try {
          const ready = prefetch?.index === index ? prefetch.handle : prepare(chunks[index], { ...options, rate }, signal);
          prefetch = undefined;
          const handle = await ready;
          if (token !== generation) {
            handle.dispose();
            return;
          }
          audio = handle;
          audio.playbackRate = rate;
          audio.onended = () => void next(index + 1);
          audio.onerror = () => fail(new Error('The audio could not be played. Try another voice.'), token);
          // Prepare the next part while this one plays, so there's no gap between parts.
          if (index + 1 < chunks.length) {
            const handle = prepare(chunks[index + 1], { ...options, rate }, signal);
            handle.catch(() => {});
            prefetch = { index: index + 1, handle };
          }
          await play(token);
        } catch (error) {
          fail(error, token);
        }
      };
      await next(0);
    },
    pause() {
      if (state.status !== 'loading' && state.status !== 'playing') return;
      paused = true;
      audio?.pause();
      publish({ status: 'paused' });
    },
    resume() {
      if (state.status !== 'paused') return;
      paused = false;
      publish({ status: audio ? 'playing' : 'loading' });
      void play(generation);
    },
    setRate(value: number) {
      rate = Number.isFinite(value) ? Math.max(0.5, Math.min(2, value)) : 1;
      if (audio) audio.playbackRate = rate;
    },
  };
}
