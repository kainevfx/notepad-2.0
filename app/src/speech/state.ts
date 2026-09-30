// The one read-aloud player for this window, and how a reading starts: pick the engine
// (Automatic / Kokoro / Windows), then read chunk by chunk.
import { signal } from '@preact/signals';
import { createSpeechPlayer, type SpeechState, type AudioHandle, type Prepare } from './player';
import { synthesize, kokoroVoices } from './kokoro';
import { chooseEngine, windowsHandle, pickWindowsVoice } from './engines';
import { settings } from '../state/settings';

export const speechState = signal<SpeechState>({ status: 'idle', title: '', docId: '', part: 0, total: 0 });

function audioFromBlob(blob: Blob): AudioHandle {
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.preservesPitch = true;
  return Object.assign(audio, {
    dispose() {
      audio.removeAttribute('src');
      audio.load();
      URL.revokeObjectURL(url);
    },
  }) as unknown as AudioHandle;
}

const hasWindowsVoices = () => typeof window !== 'undefined' && 'speechSynthesis' in window;
export const windowsVoices = (): SpeechSynthesisVoice[] => (hasWindowsVoices() ? window.speechSynthesis.getVoices() : []);

// The web view lists Windows voices only after asking once (then 'voiceschanged'): ask at start-up.
if (hasWindowsVoices()) window.speechSynthesis.getVoices();

/** The Windows voices, waiting briefly for the list the first time. */
async function loadedWindowsVoices(): Promise<SpeechSynthesisVoice[]> {
  const now = windowsVoices();
  if (now.length || !hasWindowsVoices()) return now;
  await new Promise<void>((resolve) => {
    const done = () => resolve();
    window.speechSynthesis.addEventListener?.('voiceschanged', done, { once: true });
    setTimeout(done, 1000);
  });
  return windowsVoices();
}

const prepare: Prepare = async (text, o, abort) =>
  o.engine === 'windows'
    ? windowsHandle(text, pickWindowsVoice(await loadedWindowsVoices(), o.windowsVoice))
    : audioFromBlob(await synthesize(text, o, abort));

export const speech = createSpeechPlayer(prepare, (s) => {
  // A Kokoro failure means "check again next time" for Automatic.
  if (s.status === 'error') reach = null;
  speechState.value = s;
});

let reach: { endpoint: string; ok: boolean; at: number } | null = null;
/** What Settings → Test connection just found (so the next reading uses it straight away). */
export function setKokoroReach(endpoint: string, ok: boolean) {
  reach = { endpoint, ok, at: Date.now() };
}
/** Is a Kokoro server answering at `endpoint`? Remembered for 30 s so starting stays instant. */
export async function kokoroReachable(endpoint: string): Promise<boolean> {
  if (reach && reach.endpoint === endpoint && Date.now() - reach.at < 30_000) return reach.ok;
  const ok = await kokoroVoices(endpoint).then(
    (v) => v.length > 0,
    () => false,
  );
  reach = { endpoint, ok, at: Date.now() };
  return ok;
}

/** Start reading `text` (already turned into plain readable text). */
export async function startReading(text: string, docId: string, title: string) {
  const s = settings.peek();
  // "Preparing…" shows at once, and Stop (or Ctrl+Alt+R) during the engine check cancels it.
  const token = speech.announce(docId, title);
  const { engine, note } = await chooseEngine(s.readAloudEngine, () => kokoroReachable(s.kokoroEndpoint), hasWindowsVoices());
  await speech.start(text, docId, title, { engine, endpoint: s.kokoroEndpoint, voice: s.kokoroVoice, windowsVoice: s.windowsVoice, rate: s.readAloudRate }, note, token);
}
