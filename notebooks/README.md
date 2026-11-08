# MoveUp AI notebooks (Kaggle-ready)

Two self-contained notebooks for the MoveUp HR AI features.

## 1. `geo_fraud_detection.ipynb`

Synthetic GPS traces for 8 movers and 4 client jobs in Greater Tunis. Detects:

- impossible travel
- buddy punching / identical coordinates
- off-site check-ins
- GPS accuracy anomalies
- overstays at non-client locations (red zones)
- route detours
- crew separation

Outputs: interactive Folium map, static PNG, findings CSV/JSON, employee risk
roll-up, evaluation against 12 injected anomalies, threshold sensitivity, and a
policy JSON for the app.

The data is synthetic. The evaluation validates the geometry, not real-world
precision.

## 2. `voice_checkin_speaker_verification.ipynb`

Real human speech only — no TTS. Uses the public 2-speaker × 2-session
speaker-verification demo plus real JFK/MLK/TED/French/multilingual clips
(13 source speakers, 26 sessions).

- MFCC + cosine baseline
- SpeechBrain ECAPA-TDNN (192-d) with MFCC fallback
- EER / FAR / FRR / AUC
- job + geofence + random challenge phrase
- different-voice rejection, replay analysis, noise/gain robustness
- optional Whisper tiny ASR
- `voice_policy.json` export

## Local validation results

- **Geo:** 12/12 injected anomalies recovered; micro precision = recall = F1 = 1.000.
  The 10-minute dwell sweep also flags the legitimate 12-minute coffee stop, while
  the selected 25-minute threshold does not.
- **Voice, ECAPA-TDNN:** EER 0.000, AUC 1.000, 8/8 check-in scenarios pass.
- **Voice, MFCC fallback:** EER 0.064, AUC 0.969, 8/8 check-in scenarios pass.
- **Replay:** the exact enrollment replay scores 1.0 for voice but is rejected by
  the fresh challenge phrase.
- **ASR:** the optional Whisper cell was not exercised locally because
  `transformers` is not installed in the local environment. It is wrapped to skip
  cleanly; Kaggle's Python image includes `transformers`.

## How to run on Kaggle

1. Create a new notebook and upload/import the `.ipynb`.
2. For the voice notebook, enable **Internet** in Settings.
3. For the interactive map tiles, enable Internet.
4. Run all. Outputs are written to `/kaggle/working/`.

The first install cell uses Kaggle-compatible `%pip install -q ...` commands.

## Caveats

- Geo data is synthetic; road-network routing (OSRM) and real device traces
  should replace the straight-line synthetic legs in production.
- The voice clips are public read speech, not moving-company check-in phrases.
  The speaker verification is real; the command transcripts are scripted for
  the intent/geofence tests.
- Check the source repository's terms before redistributing the demo audio.
  For production, use VoxCeleb/Common Voice under their terms or, preferably,
  consented recordings from your own employees.
- Voice is biometric data. Obtain consent, store embeddings rather than raw
  audio, and require human review before disciplinary action.
