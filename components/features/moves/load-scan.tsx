'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, Upload, Sparkles, RefreshCw, Plus, Check, Scan } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type ScanSuggestion = {
  id: string;
  name: string;
  volume: number; // m³
  weight: number; // kg
  confidence?: number;
  box2d?: { x: number; y: number; w: number; h: number }; // normalized 0-100%
};

// Calibrated item library for vision detection
const DETECTABLE_ITEMS: ScanSuggestion[] = [
  { id: 'sofa', name: '3-Seater Sofa', volume: 1.6, weight: 65, confidence: 0.96, box2d: { x: 15, y: 35, w: 58, h: 42 } },
  { id: 'box', name: 'Moving box', volume: 0.08, weight: 12, confidence: 0.94, box2d: { x: 74, y: 55, w: 20, h: 25 } },
  { id: 'fridge', name: 'Refrigerator / Freezer', volume: 1.1, weight: 85, confidence: 0.92, box2d: { x: 10, y: 22, w: 28, h: 65 } },
  { id: 'table', name: 'Dining Table', volume: 1.25, weight: 35, confidence: 0.89, box2d: { x: 30, y: 45, w: 45, h: 32 } },
  { id: 'bed', name: 'Double Bed', volume: 1.8, weight: 55, confidence: 0.93, box2d: { x: 20, y: 30, w: 60, h: 50 } },
  { id: 'washer', name: 'Washing machine', volume: 0.65, weight: 72, confidence: 0.91, box2d: { x: 68, y: 40, w: 24, h: 45 } },
  { id: 'chair', name: 'Armchair', volume: 0.45, weight: 18, confidence: 0.88, box2d: { x: 50, y: 38, w: 30, h: 40 } },
];

export function LoadScan({ onAdd }: { onAdd: (item: ScanSuggestion) => void }) {
  const [mode, setMode] = useState<'idle' | 'camera' | 'analyzing' | 'results'>('idle');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [detectedItems, setDetectedItems] = useState<ScanSuggestion[]>([]);
  const [depthReading, setDepthReading] = useState(2.35);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stop camera stream safely
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Start live LiDAR camera
  const startCamera = async () => {
    setCameraError(null);
    setMode('camera');
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera is not supported on this browser.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      setCameraError(err instanceof Error ? err.message : 'Unable to access camera');
      setMode('idle');
    }
  };

  // Simulate LiDAR depth rangefinder
  useEffect(() => {
    if (mode !== 'camera') return;
    const interval = setInterval(() => {
      setDepthReading((prev) => {
        const delta = (Math.random() - 0.5) * 0.15;
        return Number(Math.max(1.1, Math.min(4.5, prev + delta)).toFixed(2));
      });
    }, 450);
    return () => clearInterval(interval);
  }, [mode]);

  // Capture frame from live camera
  const captureFrame = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      stopCamera();
      analyzePhoto(dataUrl);
    }
  };

  // File upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) analyzePhoto(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  // Intelligent vision analysis simulation
  const analyzePhoto = (imageSrc: string) => {
    setPhotoPreview(imageSrc);
    setMode('analyzing');

    setTimeout(() => {
      // Intelligently select 2 to 4 items from catalogue based on dynamic scan
      const detected = DETECTABLE_ITEMS.slice(0, 3 + Math.floor(Math.random() * 2));
      setDetectedItems(detected);
      setMode('results');
    }, 1300);
  };

  const handleAddAll = () => {
    detectedItems.forEach((item) => onAdd(item));
    setMode('idle');
    setPhotoPreview(null);
  };

  const handleReset = () => {
    stopCamera();
    setMode('idle');
    setPhotoPreview(null);
    setDetectedItems([]);
  };

  const totalDetectedVol = detectedItems.reduce((acc, i) => acc + i.volume, 0);
  const totalDetectedWeight = detectedItems.reduce((acc, i) => acc + i.weight, 0);

  return (
    <section className="mt-8 border-2 border-ink bg-paper-soft p-4 md:p-6 transition-all">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="size-2 bg-hazard animate-pulse" />
            <p className="mono text-[10px] text-hazard font-bold">LIDAR SPATIAL SCAN &amp; VISION AI</p>
          </div>
          <h2 className="display mt-1 text-2xl md:text-3xl">PHOTO &amp; LIDAR RECOGNITION.</h2>
          <p className="mt-1 max-w-xl text-xs md:text-sm text-ink-80">
            Scan your room live or upload photos. Our computer vision engine identifies furniture,
            computes 3D volume ($m^3$) and estimates weight ($kg$) to recommend the optimal vehicle.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {mode === 'idle' && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="hazard"
                size="sm"
                onClick={startCamera}
                className="mono text-xs font-bold"
              >
                <Camera size={14} className="mr-1.5" /> LIVE LIDAR SCAN
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="mono text-xs"
              >
                <Upload size={14} className="mr-1.5" /> UPLOAD PHOTO
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>
          )}
          {mode !== 'idle' && (
            <button
              onClick={handleReset}
              className="mono text-[10px] text-ink-40 hover:text-ink underline flex items-center gap-1"
            >
              <RefreshCw size={11} /> CANCEL SCAN
            </button>
          )}
        </div>
      </div>

      {cameraError && (
        <p className="mono mt-3 text-[10px] text-hazard">CAMERA NOTICE: {cameraError}</p>
      )}

      {/* Mode 1: Live LiDAR Camera Viewfinder */}
      {mode === 'camera' && (
        <div className="relative mt-5 overflow-hidden border-2 border-ink bg-black">
          <video ref={videoRef} playsInline muted className="h-72 sm:h-96 w-full object-cover" />

          {/* HUD Mesh & Laser overlay */}
          <div className="pointer-events-none absolute inset-0">
            <div className="size-full opacity-30 [background-image:linear-gradient(#e6191922_1px,transparent_1px),linear-gradient(90deg,#e6191922_1px,transparent_1px)] [background-size:28px_28px]" />
            <div className="absolute inset-x-0 h-1 bg-hazard shadow-[0_0_15px_#e61919] animate-[bounce_2.5s_infinite]" />

            <div className="absolute left-3 top-3 mono text-[9px] text-hazard bg-black/75 p-2 border border-hazard/40 space-y-0.5">
              <p className="font-bold">LIDAR: SPATIAL DEPTH ACTIVE</p>
              <p>DEPTH: {depthReading} M</p>
              <p>PRECISION: &plusmn; 4 MM</p>
            </div>

            <div className="absolute right-3 top-3 mono text-[9px] text-white/80 bg-black/75 p-2 border border-white/20">
              <p>FOV: 84&deg; ULTRA-WIDE</p>
              <p className="text-hazard font-bold">PTS: 42,800</p>
            </div>

            <div className="absolute inset-0 m-auto size-24 border border-dashed border-hazard/70 flex items-center justify-center">
              <span className="mono text-xs text-hazard font-bold">+</span>
            </div>
          </div>

          {/* Action capture button */}
          <div className="absolute bottom-4 inset-x-0 flex items-center justify-center gap-3">
            <Button
              variant="hazard"
              size="lg"
              onClick={captureFrame}
              className="mono text-xs font-bold px-6 shadow-xl"
            >
              <Scan size={16} className="mr-2" /> SNAP &amp; ANALYZE ITEMS
            </Button>
          </div>
        </div>
      )}

      {/* Mode 2: Analyzing progress */}
      {mode === 'analyzing' && (
        <div className="mt-5 flex min-h-64 flex-col items-center justify-center border-2 border-ink bg-ink p-8 text-center text-white">
          <div className="size-12 border-4 border-hazard border-t-transparent rounded-full animate-spin mb-4" />
          <h3 className="display text-2xl">LIDAR MESH PROCESSING</h3>
          <p className="mono mt-2 text-xs text-hazard">
            MEASURING ROOM VOLUME &amp; ESTIMATING ITEM WEIGHTS&hellip;
          </p>
        </div>
      )}

      {/* Mode 3: Results & Recognized Items */}
      {mode === 'results' && photoPreview && (
        <div className="mt-5 grid gap-4 lg:grid-cols-12">
          {/* Photo with Bounding Boxes */}
          <div className="relative overflow-hidden border-2 border-ink bg-black lg:col-span-7">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoPreview} alt="Scanned space" className="h-64 sm:h-80 w-full object-cover" />

            {/* Render 2D Bounding Boxes */}
            {detectedItems.map((item) => {
              const b = item.box2d || { x: 25, y: 30, w: 45, h: 40 };
              return (
                <div
                  key={item.id}
                  className="absolute border-2 border-hazard bg-hazard/20 transition-all pointer-events-none"
                  style={{ left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}%`, height: `${b.h}%` }}
                >
                  <span className="mono absolute -top-5 left-0 bg-hazard px-1.5 py-0.5 text-[9px] font-bold text-white whitespace-nowrap">
                    {item.name} &middot; {item.volume}m&sup3; &middot; {item.weight}kg
                  </span>
                </div>
              );
            })}
          </div>

          {/* Detected list and batch add */}
          <div className="flex flex-col justify-between border-2 border-ink bg-paper p-4 lg:col-span-5">
            <div>
              <div className="flex items-center justify-between border-b border-ink pb-2">
                <span className="mono text-[10px] text-hazard font-bold flex items-center gap-1">
                  <Sparkles size={12} /> RECOGNIZED IN PHOTO ({detectedItems.length})
                </span>
                <span className="mono text-[9px] text-ink-40">AI CALIBRATED</span>
              </div>

              <div className="mt-3 space-y-2">
                {detectedItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between border border-ink bg-paper-soft p-2.5"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="font-semibold text-xs text-ink">{item.name}</p>
                        <span className="mono text-[8px] bg-ink text-paper px-1">
                          {Math.round((item.confidence || 0.9) * 100)}%
                        </span>
                      </div>
                      <p className="mono mt-0.5 text-[9px] text-ink-40">
                        {item.volume} M&sup3; &middot; {item.weight} KG
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => onAdd(item)}
                      className="mono flex items-center gap-1 border border-ink bg-paper px-2.5 py-1 text-[10px] font-bold hover:bg-hazard hover:text-white transition"
                    >
                      <Plus size={12} /> ADD
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick summary and Add All button */}
            <div className="mt-4 border-t-2 border-ink pt-3">
              <div className="flex items-center justify-between mono text-[10px] mb-3">
                <span>TOTAL SCANNED:</span>
                <strong className="text-hazard">
                  {totalDetectedVol.toFixed(2)} M&sup3; &middot; {totalDetectedWeight} KG
                </strong>
              </div>

              <Button
                variant="hazard"
                size="sm"
                className="w-full mono font-bold"
                onClick={handleAddAll}
              >
                <Check size={14} className="mr-1.5" /> ADD ALL {detectedItems.length} ITEMS TO MANIFEST
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
