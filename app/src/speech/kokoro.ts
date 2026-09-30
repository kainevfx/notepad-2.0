import type { SpeechOptions } from './player';

export async function synthesize(text: string, options: SpeechOptions, signal: AbortSignal): Promise<Blob> {
  if ('__TAURI_INTERNALS__' in window) {
    const { invoke } = await import('@tauri-apps/api/core');
    const bytes = await invoke<ArrayBuffer>('kokoro_speech', { input: text, endpoint: options.endpoint, voice: options.voice });
    signal.throwIfAborted();
    return new Blob([bytes], { type: 'audio/wav' });
  }
  // Browser development preview; production uses the native command (no CORS requirement).
  const response = await fetch(options.endpoint.replace(/\/+$/, '') + '/v1/audio/speech', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal,
    body: JSON.stringify({ model: 'kokoro', input: text, voice: options.voice, response_format: 'wav', speed: 1 }),
  });
  if (!response.ok) throw new Error(`Kokoro returned HTTP ${response.status}. Check the server and voice in Settings.`);
  return response.blob();
}
