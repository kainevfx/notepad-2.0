// The two voices Notepad 2.0 can read with:
// - Kokoro: a neural voice from a Kokoro server (OpenAI-compatible speech API); best quality.
// - Windows voices: the speech voices installed in Windows, through the web view. No setup.
// "Automatic" uses Kokoro when its server answers and a Windows voice otherwise (and says so).
import type { AudioHandle, EngineChoice } from './player';

export const FALLBACK_NOTE = "Kokoro isn't running, so a Windows voice is reading. Settings → Read aloud explains how to start it.";

export async function chooseEngine(
  choice: EngineChoice,
  kokoroReachable: () => Promise<boolean>,
  windowsAvailable: boolean,
): Promise<{ engine: 'kokoro' | 'windows'; note?: string }> {
  if (choice === 'windows') return { engine: 'windows' };
  if (choice === 'kokoro') return { engine: 'kokoro' };
  if (await kokoroReachable()) return { engine: 'kokoro' };
  return windowsAvailable ? { engine: 'windows', note: FALLBACK_NOTE } : { engine: 'kokoro' };
}

/** The chosen Windows voice, else a British English one, else the system default, else the first. */
export function pickWindowsVoice(voices: SpeechSynthesisVoice[], name: string): SpeechSynthesisVoice | null {
  return (
    (name && voices.find((v) => v.name === name)) ||
    voices.find((v) => v.lang === 'en-GB') ||
    voices.find((v) => v.default) ||
    voices[0] ||
    null
  );
}

type Synth = Pick<SpeechSynthesis, 'speak' | 'pause' | 'resume' | 'cancel'>;

/** One chunk spoken by a Windows voice, behaving like an audio element for the player. */
export function windowsHandle(
  text: string,
  voice: SpeechSynthesisVoice | null,
  synth: Synth = window.speechSynthesis,
  Utterance: typeof SpeechSynthesisUtterance = window.SpeechSynthesisUtterance,
): AudioHandle {
  let started = false;
  let disposed = false;
  const u = new Utterance(text);
  if (voice) u.voice = voice;
  const handle: AudioHandle = {
    playbackRate: 1,
    onended: null,
    onerror: null,
    async play() {
      if (disposed) return;
      if (started) synth.resume();
      else {
        started = true;
        // Windows voices take their speed when they start (0.5–2 maps onto the same range).
        u.rate = handle.playbackRate;
        synth.speak(u);
      }
    },
    pause() {
      if (started && !disposed) synth.pause();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (started) synth.cancel();
    },
  };
  u.onend = () => {
    if (!disposed) handle.onended?.();
  };
  u.onerror = (e: SpeechSynthesisErrorEvent) => {
    // Stopping or replacing the reading cancels the utterance: that's not a failure.
    if (e.error === 'canceled' || e.error === 'interrupted') return;
    handle.onerror?.();
  };
  return handle;
}
