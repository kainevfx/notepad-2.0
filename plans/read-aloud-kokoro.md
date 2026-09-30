# Kokoro read aloud and Markdown images

## Plan

1. Repair Visual image node rendering and share document-relative image resolution with Split.
2. Cover relative, drive, file URI and embedded image sources; retain original Markdown on save.
3. Add Read page aloud / Read selection aloud to the editor context menu, preserving editing actions.
4. Extract readable text, split long pages at natural boundaries, and synthesize with Kokoro's OpenAI-compatible speech API.
5. Add an accessible playback bar with pause, resume, stop, voice and speed controls. Cancel stale playback on stop, replacement or tab change.
6. Add configurable Kokoro endpoint (local by default); run native HTTP requests outside the webview.
7. Verify regression tests, real speech synthesis, image loading in both views, and Windows packaging.

## Decisions

- Text and Markdown documents are supported. Binary viewers are excluded.
- Read the current unsaved document, including collapsed sections. Omit fenced code and front matter.
- Speech is generated in bounded chunks; audio remains in memory and is discarded after playback.
- Default voice: British English Emma. Playback speed changes immediately without generating new audio.
- No automatic switch to a different speech provider.
- Service deployment location awaits the user's local-PC versus existing-service answer.
- User reports images absent in both views. Visual lacks rendering context and an inline image node view. Split requires native verification; do not assume the files are corrupt.

## Acceptance checks

- Local images display in Visual and Split, with spaces and bracketed folder names.
- Remote-image blocking works in both views; changing rendering context does not mark a file edited.
- Original image syntax survives an unrelated Visual edit.
- Page and selection commands speak readable text; long pages are not truncated.
- Pause during synthesis, stop, rapid replacement, failed requests and tab switching cannot start stale audio.
- Settings survive restart; an unavailable Kokoro service produces a useful error.

## References

- [Kokoro-FastAPI](https://github.com/remsky/Kokoro-FastAPI)
- [Kokoro voices](https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md)
