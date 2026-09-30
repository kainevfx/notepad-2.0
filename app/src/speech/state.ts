import { signal } from '@preact/signals';
import { createSpeechPlayer, type SpeechState, type AudioHandle } from './player';
import { synthesize } from './kokoro';
export const speechState = signal<SpeechState>({ status: 'idle', title: '', docId: '', part: 0, total: 0 });
export const speech = createSpeechPlayer(synthesize, blob => {
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.preservesPitch = true;
  return Object.assign(audio, { dispose() { audio.removeAttribute('src'); audio.load(); URL.revokeObjectURL(url); } }) as unknown as AudioHandle;
}, state => { speechState.value = state; });
