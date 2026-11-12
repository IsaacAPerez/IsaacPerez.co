# Voice interface

The website assistant is voice-only: there is no text composer or conversation feed. The fixed launcher opens a native dialog. Speak starts explicit microphone capture, Finish submits one bounded recording, and the answer plays as audio. The visitor can mute while recording, stop without submitting, interrupt playback with a new recording, or end the conversation. The provider-selected voice is clearly identified as AI speech; a stock preview must never be presented as Isaac's voice.

The browser records at most the server-advertised limit, clamped to 20 seconds, and encodes mono PCM16 WAV at 16 kHz. Same-origin AudioWorklet capture is preferred, with a ScriptProcessor fallback for older browsers. The microphone is stopped before the request is sent. Page hiding cancels recording; closing the dialog releases tracks, audio contexts and playback URLs. A response that arrives while hidden waits for an explicit Play answer action.

Each speak request carries a random request UUID and an independent 256-bit recovery capability. A failed or interrupted transport is never automatically resubmitted. Check for answer uses the backend's read-only recovery action. Only the opaque conversation token carries prior context; the interface does not persist recordings or transcripts to browser storage.

## Pattern references

- [Delphi voice conversation](https://mobbin.com/screens/1dc157f3-7617-4ad0-b680-d957327cfc23): centered conversational identity, visible listening state, separated microphone and end actions.
- [Telegram voice call](https://mobbin.com/screens/cddafed7-88a6-4122-be08-3959b3629313): explicit microphone state and a distinct stop action.
- [Skype call](https://mobbin.com/screens/77ace54f-7ed4-4218-ac14-42223ff960e1): participant focus and persistent call controls. Its chat panel was not adopted.

FIRSTUNIT keeps bone/ink surfaces, square geometry and existing Anybody/Instrument Sans/Fragment Mono typography. IsaacPerez.co keeps its personal palette and rounded treatment. Neither site's unrelated layout is redesigned.

## Browser verification

`tools/test-voice-browser.cjs` uses a fake browser microphone, real browser capture/encoding/playback APIs and a mocked endpoint returning a synthetic tone. It does **not** make paid API calls, clone a voice, or establish physical microphone/speaker quality. Set `PLAYWRIGHT_MODULE` to the existing Playwright installation and optionally `EVIDENCE_DIR` outside the repository for screenshots and silent browser videos.

The browser fixture host `tools/voice-ui-preview.cjs` replays the current Vercel response headers and excludes repository-only paths. It is separate from the real API preview at `tools/voice-preview.cjs`. The latter requires an external durable ledger and explicit runtime setup; see backend documentation.

Tests cover desktop/mobile layout, absence of text fields, actual WAV format, mute/unmute, playback, stop/close cleanup, focus restoration, denied microphone, unavailable service, automatic recording limit, and request recovery without another inference. Personal-site tests additionally check the 3D homepage, pointer-lock release and room keyboard isolation while the voice dialog is open, and all sitemap routes with the updated headers.

Public activation still requires the backend's durable allowance and server credential configuration, an inspected preview, and actual microphone/playback verification on the supported target browsers.

`tools/test-voice-live-browser.cjs` is a separate integration harness requiring explicit paid-test approval for a new inference. It can instead use `VOICE_RECOVERY_FILE` for read-only recovery, or `VOICE_ANSWER_WAV` for a clearly labeled local saved-answer replay with mocked transport. Replays never forward a speak request to the backend. Save each run to a new evidence directory. Playback completion is captured from the native `ended` event before the interface clears its audio URL; the test also verifies the recording reaches the full audio duration and the interface returns to idle.
