import { useEffect } from 'preact/hooks';
import { useSignalEffect } from '@preact/signals';
import { activeDoc, cmd, getView, textOf } from '../state/app';
import { settings, updateSettings } from '../state/settings';
import { openContextMenu, settingsOpen } from '../state/ui';
import { visualApi } from '../editor/visual/sync';
import { isBinaryKind } from '../lib/view-kind';
import { readableText } from '../speech/text';
import { speech, speechState } from '../speech/state';

export function readAloudMenu(event: MouseEvent) {
  const target = event.target as HTMLElement;
  if (target.closest('input, textarea, button, select, .banner')) return;
  const doc = activeDoc.value;
  if (!doc || isBinaryKind(doc.viewer)) return;
  visualApi.flush();
  const markdown = doc.language === 'markdown';
  // Capture before opening a menu moves focus. DOM selection must belong to this editor.
  const selection = window.getSelection();
  const inPreview = !!target.closest('.visual-editor, .md-preview');
  const selected = inPreview
    ? selection?.anchorNode && (event.currentTarget as HTMLElement).contains(selection.anchorNode) ? selection.toString() : ''
    : getView()?.state.selection.ranges.map(r => getView()!.state.sliceDoc(r.from, r.to)).join('\n') ?? '';
  const start = (text: string, isMarkdown: boolean) => {
    const s = settings.peek();
    void speech.start(readableText(text, isMarkdown), doc.id, doc.title, {
      endpoint: s.kokoroEndpoint, voice: s.kokoroVoice, rate: s.readAloudRate,
    });
  };
  const page = textOf(doc.id);
  openContextMenu(event, [
    { label: 'Read page aloud', disabled: !page.trim(), action: () => start(page, markdown) },
    { label: 'Read selection aloud', disabled: !selected.trim(), action: () => start(selected, markdown && !inPreview) },
    ...(speech.state.status !== 'idle' ? [
      { label: speech.state.status === 'paused' ? 'Resume reading' : 'Pause reading', disabled: speech.state.status === 'error',
        action: () => speech.state.status === 'paused' ? speech.resume() : speech.pause() },
      { label: 'Stop reading', action: speech.stop },
    ] : []),
    { separator: true },
    { label: 'Cut', shortcut: 'Ctrl+X', disabled: doc.readonly || inPreview && !target.closest('.visual-editor'), action: cmd.cut },
    { label: 'Copy', shortcut: 'Ctrl+C', action: inPreview ? () => { void navigator.clipboard.writeText(selected); } : cmd.copy },
    { label: 'Paste', shortcut: 'Ctrl+V', disabled: doc.readonly || inPreview && !target.closest('.visual-editor'), action: cmd.paste },
    { label: 'Select all', shortcut: 'Ctrl+A', action: cmd.selectAll },
    { separator: true },
    { label: 'Read aloud settings…', action: () => { settingsOpen.value = true; } },
  ]);
}

export function VoiceSelect() {
  return <select class="select" aria-label="Read aloud voice" value={settings.value.kokoroVoice}
    onChange={e => updateSettings({ kokoroVoice: e.currentTarget.value })}>
    <option value="bf_emma">Emma · British</option>
    <option value="bf_isabella">Isabella · British</option>
    <option value="bm_george">George · British</option>
    <option value="af_heart">Heart · American</option>
    <option value="am_michael">Michael · American</option>
  </select>;
}

export function ReadAloudBar() {
  useSignalEffect(() => {
    const id = activeDoc.value?.id;
    if (speech.state.docId && speech.state.docId !== id) speech.stop();
  });
  useSignalEffect(() => speech.setRate(settings.value.readAloudRate));
  useEffect(() => () => speech.stop(), []);
  const state = speechState.value;
  if (state.status === 'idle') return null;
  return <aside class="read-aloud-bar" aria-label="Read aloud playback">
    <div class="read-aloud-status" role="status" aria-live="polite">
      <strong>{state.status === 'loading' ? 'Preparing audio…' : state.status === 'paused' ? 'Paused' : state.status === 'error' ? 'Read aloud unavailable' : 'Reading aloud'}</strong>
      <span>{state.status === 'error' ? state.error : `${state.title} · Part ${state.part} of ${state.total}`}</span>
    </div>
    {state.status !== 'error' && <button class="btn" onClick={() => state.status === 'paused' ? speech.resume() : speech.pause()}>
      {state.status === 'paused' ? 'Resume' : 'Pause'}
    </button>}
    <button class="btn" onClick={speech.stop}>Stop</button>
    <label>Speed <select class="select" aria-label="Read aloud speed" value={settings.value.readAloudRate}
      onChange={e => updateSettings({ readAloudRate: Number(e.currentTarget.value) })}>
      {[0.75, 1, 1.25, 1.5, 1.75, 2].map(rate => <option value={rate}>{rate}×</option>)}
    </select></label>
    <button class="btn" onClick={() => { settingsOpen.value = true; }}>Voice & settings</button>
  </aside>;
}
