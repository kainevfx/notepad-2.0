// Kokoro server calls. In the desktop app they go through Rust (no CORS, text never logged);
// the browser build calls the server directly.
import type { SpeechOptions } from './player';

const isTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export async function synthesize(text: string, options: SpeechOptions, signal: AbortSignal): Promise<Blob> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    const bytes = await invoke<ArrayBuffer>('kokoro_speech', { input: text, endpoint: options.endpoint, voice: options.voice });
    signal.throwIfAborted();
    return new Blob([bytes], { type: 'audio/wav' });
  }
  const response = await fetch(options.endpoint.replace(/\/+$/, '') + '/v1/audio/speech', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({ model: 'kokoro', input: text, voice: options.voice, response_format: 'wav', speed: 1 }),
  });
  if (!response.ok) throw new Error(`Kokoro returned HTTP ${response.status}. Check the server and voice in Settings.`);
  return response.blob();
}

/** The server's voices; throws a readable message when Kokoro can't be reached. */
export async function kokoroVoices(endpoint: string): Promise<string[]> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<string[]>('kokoro_voices', { endpoint });
  }
  const r = await fetch(endpoint.replace(/\/+$/, '') + '/v1/audio/voices', { signal: AbortSignal.timeout(4000) });
  if (!r.ok) throw new Error(`Kokoro answered HTTP ${r.status}.`);
  const j = await r.json();
  const list: unknown[] = Array.isArray(j) ? j : j.voices ?? [];
  return list.map((v: any) => (typeof v === 'string' ? v : v?.id ?? v?.name)).filter((v): v is string => typeof v === 'string').sort();
}

/** Voices every Kokoro-82M server has, for when the list can't be fetched. */
export const KOKORO_VOICES: { id: string; label: string }[] = [
  { id: 'bf_emma', label: 'Emma · British' },
  { id: 'bf_isabella', label: 'Isabella · British' },
  { id: 'bf_alice', label: 'Alice · British' },
  { id: 'bf_lily', label: 'Lily · British' },
  { id: 'bm_george', label: 'George · British' },
  { id: 'bm_lewis', label: 'Lewis · British' },
  { id: 'bm_daniel', label: 'Daniel · British' },
  { id: 'af_heart', label: 'Heart · American' },
  { id: 'af_bella', label: 'Bella · American' },
  { id: 'af_nicole', label: 'Nicole · American' },
  { id: 'am_michael', label: 'Michael · American' },
  { id: 'am_fenrir', label: 'Fenrir · American' },
];

/** "bf_emma" → "Emma · British" (known voices), else the id as sent. */
export function voiceLabel(id: string): string {
  const known = KOKORO_VOICES.find((v) => v.id === id);
  if (known) return known.label;
  const m = /^([ab])([fm])_(\w+)$/.exec(id);
  if (!m) return id;
  const name = m[3].charAt(0).toUpperCase() + m[3].slice(1);
  return `${name} · ${m[1] === 'b' ? 'British' : 'American'}`;
}
