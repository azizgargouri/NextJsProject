/**
 * Audio helpers for the voice check-in.
 *
 * MediaRecorder produces WebM/Opus, but the Kaggle verifier reads uploads with
 * `soundfile`, which only understands WAV/FLAC/OGG — not WebM. We therefore
 * decode the take in the browser and re-render it as 16 kHz mono PCM WAV, the
 * exact format the verifier's embedding model expects.
 */

/** Encodes mono float samples as a 16-bit PCM WAV blob. */
export function encodeWavPcm16(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

/** Decodes any browser-playable recording and renders it to 16 kHz mono WAV. */
export async function convertToWav16k(blob: Blob): Promise<Blob> {
  const AudioCtor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioCtor) throw new Error('Audio decoding is not supported in this browser.');

  const decodeContext = new AudioCtor();
  try {
    const decoded = await decodeContext.decodeAudioData(await blob.arrayBuffer());
    // `duration` can be Infinity for MediaRecorder blobs; frames are reliable.
    const duration = decoded.length / decoded.sampleRate;
    const targetRate = 16000;
    const frames = Math.max(1, Math.ceil(duration * targetRate));

    const offline = new OfflineAudioContext(1, frames, targetRate);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();

    const rendered = await offline.startRendering();
    return encodeWavPcm16(rendered.getChannelData(0), targetRate);
  } finally {
    void decodeContext.close();
  }
}
