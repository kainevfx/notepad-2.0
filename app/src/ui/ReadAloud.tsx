// Read aloud: the page's right-click menu, the playback bar under the document, and the
// Settings section (engine, Kokoro server and voice, Windows voice, speed).
import { useEffect, useState } from 'preact/hooks';
import { useSignalEffect } from '@preact/signals';
import { activeDoc, cmd, docs } from '../state/app';
import { settings, updateSettings } from '../state/settings';
import { openContextMenu, settingsOpen, showToast } from '../state/ui';
import type { MenuItem } from '../state/ui';
import { visualApi } from '../editor/visual/sync';
import { speech, speechState, windowsVoices, setKokoroReach } from '../speech/state';
import { readPage, readSelection, currentSelection, canRead, stopIfDocClosed } from '../speech/commands';
import { kokoroVoices, KOKORO_VOICES, voiceLabel } from '../speech/kokoro';

/** Read aloud items (also used by View → Read aloud). */
export function readAloudItems(): MenuItem[] {
  const st = speech.state.status;
  const reading = st === 'loading' || st === 'playing' || st === 'paused';
  const ok = canRead();
  // Keep the selection as it is now: clicking the menu item can clear it.
  const selection = currentSelection();
  return [
    { label: 'Read page aloud', shortcut: 'Ctrl+Alt+R', disabled: !ok, action: () => void readPage() },
    { label: 'Read selection aloud', disabled: !ok || !selection.text.trim(), action: () => void readSelection(selection) },
    ...(reading
      ? [
          { label: st === 'paused' ? 'Resume reading' : 'Pause reading', action: () => (st === 'paused' ? speech.resume() : speech.pause()) },
          { label: 'Stop reading', action: () => speech.stop() },
        ]
      : []),
  ];
}

/** Right-click on the page: read aloud, plus the usual editing items. */
export function readAloudMenu(event: MouseEvent) {
  const target = event.target as HTMLElement;
  if (target.closest('input, textarea, button, select, .banner, .view-switch, .viewer')) return;
  const doc = activeDoc.value;
  if (!doc || !canRead()) return;
  visualApi.flush();
  const inPreview = !!target.closest('.md-preview');
  const selected = currentSelection().text;
  openContextMenu(event, [
    ...readAloudItems(),
    { separator: true },
    { label: 'Cut', shortcut: 'Ctrl+X', disabled: doc.readonly || inPreview, action: cmd.cut },
    {
      label: 'Copy',
      shortcut: 'Ctrl+C',
      action: inPreview ? () => void navigator.clipboard.writeText(selected) : cmd.copy,
    },
    { label: 'Paste', shortcut: 'Ctrl+V', disabled: doc.readonly || inPreview, action: cmd.paste },
    { label: 'Select all', shortcut: 'Ctrl+A', action: cmd.selectAll },
    { separator: true },
    { label: 'Read aloud settings…', action: () => (settingsOpen.value = true) },
  ]);
}

export function ReadAloudBar() {
  // Reading carries on across tab and pane switches; closing its document stops it.
  useSignalEffect(() => {
    docs.value;
    stopIfDocClosed();
  });
  useSignalEffect(() => speech.setRate(settings.value.readAloudRate));
  useEffect(() => () => speech.stop(), []);
  const state = speechState.value;
  if (state.status === 'idle') return null;
  const heading =
    state.status === 'loading' ? 'Preparing audio…' : state.status === 'paused' ? 'Paused' : state.status === 'error' ? "Read aloud couldn't play" : 'Reading aloud';
  return (
    <aside class="read-aloud-bar" aria-label="Read aloud playback">
      <div class="read-aloud-status" role="status" aria-live="polite">
        <strong>{heading}</strong>
        <span>{state.status === 'error' ? state.error : `${state.title} · Part ${state.part} of ${state.total}`}</span>
        {state.note && state.status !== 'error' && <span class="read-aloud-note">{state.note}</span>}
      </div>
      {state.status !== 'error' && (
        <button class="btn" onClick={() => (state.status === 'paused' ? speech.resume() : speech.pause())}>
          {state.status === 'paused' ? 'Resume' : 'Pause'}
        </button>
      )}
      <button class="btn" onClick={() => speech.stop()}>
        {state.status === 'error' ? 'Close' : 'Stop'}
      </button>
      <label>
        Speed{' '}
        <select class="fb-select" aria-label="Read aloud speed" value={settings.value.readAloudRate} onChange={(e) => updateSettings({ readAloudRate: Number(e.currentTarget.value) })}>
          {[0.75, 1, 1.25, 1.5, 1.75, 2].map((r) => (
            <option value={r}>{r}×</option>
          ))}
        </select>
      </label>
      <button class="btn" onClick={() => (settingsOpen.value = true)}>
        Voice and settings
      </button>
    </aside>
  );
}

export const KOKORO_SETUP = 'docker run -d --name kokoro-tts --restart unless-stopped -p 127.0.0.1:8880:8880 ghcr.io/remsky/kokoro-fastapi-cpu';

/** Settings → Read aloud. */
export function ReadAloudSettings({ Row }: { Row: (p: { title: string; desc?: string; children?: any }) => any }) {
  const s = settings.value;
  const [serverVoices, setServerVoices] = useState<string[] | null>(null);
  const [test, setTest] = useState<{ ok: boolean; text: string } | null>(null);
  const [winVoices, setWinVoices] = useState<SpeechSynthesisVoice[]>(() => windowsVoices());

  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const load = () => setWinVoices(windowsVoices());
    window.speechSynthesis.addEventListener?.('voiceschanged', load);
    load();
    return () => window.speechSynthesis.removeEventListener?.('voiceschanged', load);
  }, []);

  const runTest = async () => {
    const endpoint = s.kokoroEndpoint;
    setTest({ ok: true, text: 'Checking…' });
    try {
      const v = await kokoroVoices(endpoint);
      setServerVoices(v);
      setKokoroReach(endpoint, true);
      setTest({ ok: true, text: `Connected · ${v.length} voices` });
    } catch (e) {
      setKokoroReach(endpoint, false);
      setTest({ ok: false, text: String((e as Error)?.message ?? e) });
    }
  };
  useEffect(() => {
    // A new address: forget the old answer, and ignore a slow reply for the old one.
    let live = true;
    setTest(null);
    setServerVoices(null);
    void kokoroVoices(s.kokoroEndpoint).then(
      (v) => live && setServerVoices(v),
      () => live && setServerVoices(null),
    );
    return () => {
      live = false;
    };
  }, [s.kokoroEndpoint]);

  const kokoroList = serverVoices?.length ? serverVoices.map((id) => ({ id, label: voiceLabel(id) })) : KOKORO_VOICES;
  if (!kokoroList.some((v) => v.id === s.kokoroVoice)) kokoroList.unshift({ id: s.kokoroVoice, label: voiceLabel(s.kokoroVoice) });

  return (
    <>
      <Row title="Voice engine" desc="Automatic uses Kokoro when its server answers, and a Windows voice otherwise.">
        <select class="fb-select" aria-label="Voice engine" value={s.readAloudEngine} onChange={(e) => updateSettings({ readAloudEngine: e.currentTarget.value as any })}>
          <option value="auto">Automatic</option>
          <option value="kokoro">Kokoro only</option>
          <option value="windows">Windows voices only</option>
        </select>
      </Row>
      <Row title="Kokoro voice" desc={serverVoices ? 'From your Kokoro server.' : 'The server list shows once Kokoro is running.'}>
        <select class="fb-select" aria-label="Kokoro voice" value={s.kokoroVoice} onChange={(e) => updateSettings({ kokoroVoice: e.currentTarget.value })}>
          {kokoroList.map((v) => (
            <option value={v.id}>{v.label}</option>
          ))}
        </select>
      </Row>
      <Row title="Kokoro server" desc="Your text is sent only to this server. Use HTTPS for a server on another machine.">
        <div class="ra-server">
          <input class="input" aria-label="Kokoro server" type="url" value={s.kokoroEndpoint} onChange={(e) => updateSettings({ kokoroEndpoint: e.currentTarget.value.trim() })} />
          <button class="btn" onClick={() => void runTest()}>
            Test connection
          </button>
        </div>
        {test && <div class={`ra-test ${test.ok ? 'ok' : 'bad'}`}>{test.text}</div>}
      </Row>
      <Row
        title="Start Kokoro on this PC"
        desc="Kokoro is a free, offline neural voice (Kokoro-82M, Apache 2.0). With Docker Desktop running, this command starts it and keeps it running (about 2 GB to download once). Voice mixes such as af_bella+af_sky work too."
      >
        <div class="ra-setup">
          <code>{KOKORO_SETUP}</code>
          <button
            class="btn"
            onClick={() => void navigator.clipboard.writeText(KOKORO_SETUP).then(() => showToast('Command copied'), () => {})}
          >
            Copy
          </button>
        </div>
      </Row>
      <Row title="Windows voice" desc="Used by Windows voices only, and by Automatic when Kokoro isn't running.">
        <select class="fb-select" aria-label="Windows voice" value={s.windowsVoice} onChange={(e) => updateSettings({ windowsVoice: e.currentTarget.value })}>
          <option value="">British English if installed, else the default</option>
          {winVoices.map((v) => (
            <option value={v.name}>
              {v.name} ({v.lang})
            </option>
          ))}
        </select>
      </Row>
      <Row title="Speed" desc="Changes straight away, also while reading.">
        <select class="fb-select" aria-label="Read aloud speed" value={s.readAloudRate} onChange={(e) => updateSettings({ readAloudRate: Number(e.currentTarget.value) })}>
          {[0.75, 1, 1.25, 1.5, 1.75, 2].map((r) => (
            <option value={r}>{r}×</option>
          ))}
        </select>
      </Row>
      <Row
        title="How to use it"
        desc="Right-click the page, press Ctrl+Alt+R, or use View → Read aloud. It reads the selection if there is one, else the whole page. Code blocks, front matter and link addresses are skipped. Press Ctrl+Alt+R again to stop."
      />
    </>
  );
}
