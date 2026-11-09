'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import jsQR from 'jsqr';
import { Camera, CameraOff, ScanLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/field';
import { TextInput } from './mover-ui';

interface QrDetector {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
type QrDetectorConstructor = new (options: { formats: string[] }) => QrDetector;

/** Chrome on Android reads QR codes natively; other browsers fall back to jsQR. */
function createDetector(): QrDetector | null {
  const Detector = (globalThis as { BarcodeDetector?: QrDetectorConstructor }).BarcodeDetector;
  if (!Detector) return null;
  try {
    return new Detector({ formats: ['qr_code'] });
  } catch {
    return null;
  }
}

const FRAME_INTERVAL_MS = 250;
/** A label held in view is read several times a second, but counts once. */
const REPEAT_IGNORE_MS = 3000;
const MAX_DECODE_SIDE = 1280;

async function readQrCode(
  source: CanvasImageSource,
  width: number,
  height: number,
  canvas: HTMLCanvasElement,
  detector: QrDetector | null,
  thorough: boolean,
): Promise<string | null> {
  if (detector) {
    try {
      const [found] = await detector.detect(source);
      if (found?.rawValue) return found.rawValue;
      if (!thorough) return null;
    } catch {
      // Unsupported image or detector failure: jsQR below still gets a try.
    }
  }

  const scale = Math.min(1, MAX_DECODE_SIDE / Math.max(width, height));
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  const found = jsQR(data, canvas.width, canvas.height, {
    inversionAttempts: thorough ? 'attemptBoth' : 'dontInvert',
  });
  return found?.data ?? null;
}

/** Browsers only open the camera on https or localhost. */
function liveCameraSupported(): boolean {
  return window.isSecureContext && Boolean(navigator.mediaDevices?.getUserMedia);
}

const noSubscription = () => () => {};

function cameraErrorMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Camera access was refused. Allow the camera for this site, or take a photo of each label instead.';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'No camera was found on this device. Take a photo of each label instead.';
  }
  if (name === 'NotReadableError') return 'The camera is being used by another app.';
  return 'The camera could not start. Take a photo of each label instead.';
}

/**
 * Reads box labels three ways: the live camera, a photo of one label (works on
 * plain http, where browsers block the live camera), or the code typed in.
 */
export function BoxScanner({ onCode }: { onCode: (code: string) => void }) {
  const liveSupported = useSyncExternalStore(noSubscription, liveCameraSupported, () => false);
  const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastRead = useRef<{ code: string; at: number } | null>(null);
  const onCodeRef = useRef(onCode);

  useEffect(() => {
    onCodeRef.current = onCode;
  });

  const reportLive = useCallback((code: string) => {
    const now = Date.now();
    const last = lastRead.current;
    lastRead.current = { code, at: now };
    if (last?.code === code && now - last.at < REPEAT_IGNORE_MS) return;
    onCodeRef.current(code);
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setRunning(false);
  }, []);

  const startCamera = async () => {
    setError(null);
    setStarting(true);
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' } },
      });
      setRunning(true);
    } catch (cameraError) {
      setError(cameraErrorMessage(cameraError));
    } finally {
      setStarting(false);
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!running || !video || !stream) return;

    video.srcObject = stream;
    void video.play().catch(() => {});
    const detector = createDetector();
    const canvas = document.createElement('canvas');
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const readFrame = async () => {
      if (stopped) return;
      if (video.readyState >= video.HAVE_CURRENT_DATA && video.videoWidth > 0) {
        const code = await readQrCode(
          video,
          video.videoWidth,
          video.videoHeight,
          canvas,
          detector,
          false,
        );
        if (code && !stopped) reportLive(code);
      }
      if (!stopped) timer = setTimeout(readFrame, FRAME_INTERVAL_MS);
    };
    timer = setTimeout(readFrame, FRAME_INTERVAL_MS);

    return () => {
      stopped = true;
      clearTimeout(timer);
      video.srcObject = null;
    };
  }, [running, reportLive]);

  // Leaving the page must turn the camera off.
  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []);

  const onPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError(null);
    setReading(true);
    try {
      const bitmap = await createImageBitmap(file);
      const code = await readQrCode(
        bitmap,
        bitmap.width,
        bitmap.height,
        document.createElement('canvas'),
        createDetector(),
        true,
      );
      bitmap.close();
      if (code) onCodeRef.current(code);
      else {
        setError(
          'No QR code found in this photo. Hold the phone closer, with the whole label in view.',
        );
      }
    } catch {
      setError('This photo could not be read. Try again.');
    } finally {
      setReading(false);
    }
  };

  const onTyped = (event: FormEvent) => {
    event.preventDefault();
    const code = typed.trim();
    if (!code) return;
    onCodeRef.current(code);
    setTyped('');
  };

  return (
    <div className="flex flex-col gap-3">
      {running ? (
        <div className="relative overflow-hidden border border-ink bg-ink">
          <video
            ref={videoRef}
            muted
            playsInline
            aria-label="Camera view. Point it at a box label."
            className="aspect-[4/3] w-full object-cover"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-[20%] inset-y-[15%] border-2 border-paper"
          />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {liveSupported ? (
          running ? (
            <Button variant="outline" onClick={stopCamera}>
              <CameraOff className="size-4" aria-hidden /> Stop camera
            </Button>
          ) : (
            <Button onClick={() => void startCamera()} disabled={starting}>
              <ScanLine className="size-4" aria-hidden />
              {starting ? 'Starting camera…' : 'Start scanning'}
            </Button>
          )
        ) : null}
        <label
          htmlFor="box-photo"
          className="mono inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap border-2 border-ink px-3 text-[11px] hover:bg-ink hover:text-paper focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-hazard"
        >
          <Camera className="size-4" aria-hidden />
          {reading ? 'Reading…' : liveSupported ? 'Scan from a photo' : 'Photo of a label'}
          <input
            id="box-photo"
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(event) => void onPhoto(event)}
            disabled={reading}
          />
        </label>
      </div>

      {!liveSupported ? (
        <p className="text-sm text-ink-80">
          Live scanning needs a secure (https) connection, so take a photo of each label instead.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-hazard-dark">
          {error}
        </p>
      ) : null}

      <form onSubmit={onTyped} className="flex gap-2">
        <div className="min-w-0 flex-1">
          <Label htmlFor="box-code" className="sr-only">
            Box code
          </Label>
          <TextInput
            id="box-code"
            placeholder="Or type the code under the label"
            autoComplete="off"
            maxLength={200}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
          />
        </div>
        <Button type="submit" variant="outline" className="h-12" disabled={!typed.trim()}>
          Add
        </Button>
      </form>
    </div>
  );
}
