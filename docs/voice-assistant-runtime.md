# Voice assistant runtime

This is a bounded spoken-turn assistant: record up to 20 seconds, finish the
question, and hear a generated reply. It is not full-duplex Live/WebRTC. The
visitor UI has no text composer, response transcript, or chat feed. Existing
ordinary site copy and contact links remain available.

## Contract

`GET /api/voice` returns `available`, `voiceLabel`, `voiceIsCustom`,
`maxRecordingSeconds: 20`, and `maxTurns: 6`. A disabled or incompletely configured
service reports unavailable without a paid request.

`POST /api/voice` JSON:

```
{action: "speak", requestId: UUID, requestToken: random32BytesBase64URL,
 audioBase64: PCM16Mono16kHzWAV, conversationToken?: opaqueEncryptedToken}
```

The server checks RIFF lengths, actual PCM format, sample rate, channels and
duration. Browser MIME declarations and timers do not establish those bounds.
The reply has `ok`, `requestId`, `audioBase64`, `mimeType: "audio/wav"`,
`conversationToken`, `voiceLabel` and `voiceIsCustom`. It never returns a provider
key or transcript.

After a lost response, an explicit `recover` request with the same request ID
and capability token retrieves the encrypted saved result without another model
call. Pending and unknown outcomes remain reserved. An identical `speak` request
does not infer again; changed payloads conflict. Do not retry with a new ID.

A terminal `voice_response_unavailable` error includes `requestId` and `final: true` only after a failed result receipt is persisted. It means no playable answer, not no charge. The same recovery request returns that final error without new inference. If persistence itself is uncertain, the endpoint returns `outcome_unknown` with no final flag and preserves the reservation.

The capability token is not a login; it permits recovery of one otherwise
unguessable result. Production also requires exact origins and server-verified
Vercel IP rate buckets. Rate hashes rotate daily, and raw IPs are not persisted.

## Knowledge and memory

`voice-knowledge.js` reads only two explicit public-source paths: personal
`about/index.html`; or FIRSTUNIT's generated public `index.html` JSON plus curated
`experience-data.json` services/case studies. It does not load the private brand
ledger, media originals, room reference photos, résumé, vault or CodeByIP data.
Public project availability follows `where`, not generic project state labels.
Knowledge updates naturally with the deployed source files; no crawler or new
scheduled indexing job is needed.

Only the last two spoken assistant answers travel in the encrypted,
site-scoped, 30-minute conversation token. This supports follow-ups but is **not
a complete history of prior spoken questions**. Input recordings are not saved.
There is no cross-site or ChatGPT/Codex memory. `store:false` disables optional
OpenAI completion storage; it is not a claim of zero provider retention.

## Provider and cost controls

The server calls `gpt-audio-1.5` once per accepted question, with audio input and
output, no tools, one choice and 512 maximum completion tokens. Custom voices
use an approved recorded `voice_*` ID. The default is explicitly labeled
**AI preview voice**, not Isaac's voice.

Each accepted turn atomically reserves $0.25 before dispatch. Actual USD is
calculated from returned text/audio token details; cached input is conservatively
charged at full price. Missing usage and uncertain provider outcomes retain the
entire reservation. Any recorded cost above its reservation disables further
admission. Six turns per encrypted conversation, twelve accepted questions per
daily IP hash and a three-second admission gap constrain use. Rate limits are
additional controls, not the dollar cap.

Both website previews share one $8 file ledger, part of the root pilot's $20
total allocation ($12 remains allocated to GIF work). Existing receipts are never
replenished by restarting the preview. The ledger uses an interprocess lock,
fsync and atomic rename. Completed audio responses are encrypted for recovery;
recovery expires after ten minutes. Local expired ciphertext is discarded on the
next ledger operation; the SQL adapter cleans it on a later admission. This is a
recovery window, not a guarantee of timed physical deletion. Accounting receipts
and unknown holds remain.

An existing file lock is never automatically reclaimed, even if its recorded PID
appears dead. Admission fails closed after five seconds. To recover a verified
orphan, first stop **both** preview servers and any other ledger writer, verify
that none is running, inspect the lock and ledger, and only then remove that
specific orphan lock. Do not delete receipts, change the allowance, or perform
lock recovery while a writer can start or acquire it.

## Local attended preview

Use `tools/voice-preview.cjs`, Node built-ins only. It binds to loopback, replays
global response headers and excludes API source, tools, docs and private paths
from static serving. It is not a new scheduled server or a deployment.

Supply the approved credential from 1Password to the process environment without
printing it. Set `VOICE_ENABLED=true`, an absolute `VOICE_PREVIEW_LEDGER` outside
the public repository, and optionally `VOICE_PREVIEW_PORT` (personal 8431,
FIRSTUNIT 8432). Both processes must use the same ledger and expiry. Default
expiry is `2026-12-10T22:05:52Z`; an existing ledger refuses changed policy.

For attended diagnosis only, `VOICE_PREVIEW_DIAGNOSTICS_DIR` can name a private
absolute folder outside the public repository. Invalid provider outputs then
write a mode-0600 record containing only the provider output, provider ID and
usage. Input recordings, API credentials and raw exception text are excluded.
The core invokes this hook only for a loopback client in local-preview mode,
never in Vercel. No diagnostic folder is enabled by default. Provider WAV
unknown-length `0xFFFFFFFF` headers are normalized before playback; visitor
input still requires exact lengths. Invalid provider output is a terminal
upstream failure with its known charge retained; it is not a new input error.

For Isaac's recorded voice, set `OPENAI_CUSTOM_VOICE_ID` and
`VOICE_CUSTOM_APPROVED=true` only after access, consent/sample enrollment and
listening approval. The voice ID is not an API secret, but provisioning belongs
to the separate attended consent workflow.

## Production activation is separate

Public handlers never select the local file adapter. They require the server-only
OpenAI key, `VOICE_ENABLED=true`, `VOICE_BUDGET_URL` fixed to the existing platform
Supabase project, and a service-only `VOICE_BUDGET_KEY`. Production additionally
requires `VOICE_PUBLIC_APPROVED=true`. Missing storage, RPCs, valid rate headers,
enabled budget or current cycle yields unavailable. A deployment by itself
does not create database tables or enable paid traffic.

`voice-budget-draft.sql` is an **unapplied draft**, not the canonical platform
migration. Move it through the platform's migration/review process before
deployment, then independently verify grants, RLS, concurrency, a disabled
budget, and only afterward the approved current $8 allowance. It seeds no grant.
The aggregate cap applies jointly to both sites. A future renewal needs an
explicit new cycle design, not deleting requests or overwriting this ledger.

Provider eligibility, the recorded custom voice, a real physical microphone,
phone playback and public deployment are separate proof boundaries.

## Verification

`node --test tools/voice-backend.test.cjs` exercises malformed/oversized audio,
origin protection, no text input, source scope, encryption and cross-site
isolation, request recovery, duplicate prevention, held unknown costs, atomic
shared budget admission and conversation expiry. Tests use injected provider
responses and never spend credits.

Official sources: [audio Chat Completions](https://developers.openai.com/api/docs/guides/audio-chat-completions),
[request reference](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create),
[GPT-Audio pricing](https://developers.openai.com/api/docs/models/gpt-audio-1.5), and
[recorded custom voices](https://developers.openai.com/api/docs/guides/custom-voices).
