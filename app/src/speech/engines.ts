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

/**
 * One chunk spoken by a Windows voice, behaving like an audio element for the player. A speed
 * change applies straight away: the chunk restarts from the last word spoken at the new speed.
 */
export function windowsHandle(
  text: string,
  voice: SpeechSynthesisVoice | null,
  synth: Synth = window.speechSynthesis,
  Utterance: typeof SpeechSynthesisUtterance = window.SpeechSynthesisUtterance,
): AudioHandle {
  let started = false;
  let disposed = false;
  let paused = false;
  let rate = 1;
  let spokenTo = 0; // characters of `text` already spoken (from word boundaries)
  let current: SpeechSynthesisUtterance | null = null;

  const speakFrom = (from: number) => {
    const u = new Utterance(text.slice(from));
    if (voice) u.voice = voice;
    u.rate = rate;
    current = u;
    u.onboundary = (e: SpeechSynthesisEvent) => {
      if (current === u) spokenTo = from + e.charIndex;
    };
    u.onend = () => {
      if (current === u && !disposed) handle.onended?.();
    };
    u.onerror = (e: SpeechSynthesisErrorEvent) => {
      // Stopping, replacing or restarting at a new speed cancels the utterance: not a failure.
      if (current !== u || e.error === 'canceled' || e.error === 'interrupted') return;
      handle.onerror?.();
    };
    synth.speak(u);
  };

  const handle: AudioHandle = {
    get playbackRate() {
      return rate;
    },
    set playbackRate(r: number) {
      if (r === rate) return;
      rate = r;
      if (started && !disposed && !paused) {
        current = null;
        synth.cancel();
        speakFrom(spokenTo);
      }
    },
    onended: null,
    onerror: null,
    async play() {
      if (disposed) return;
      if (!started) {
        started = true;
        speakFrom(0);
      } else if (paused) {
        paused = false;
        synth.resume();
      }
    },
    pause() {
      if (!started || disposed || paused) return;
      paused = true;
      synth.pause();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      current = null;
      if (!started) return;
      // A paused synthesiser stays paused across cancel(): resume it so the next reading plays.
      if (paused) synth.resume();
      synth.cancel();
    },
  };
  return handle;
}
