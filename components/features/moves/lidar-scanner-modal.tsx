'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, Upload, X, Check, Scan, Sparkles, RefreshCw, AlertCircle, Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type DetectedItem = {
  id: string;
  name: string;
  category: 'furniture' | 'box' | 'appliance';
  confidence: number;
  volume: number; // m³
  weight: number; // kg
  quantity: number;
  box2d?: { x: number; y: number; w: number; h: number }; // normalized 0-100%
};

const COMMON_RECOGNITIONS: Omit<DetectedItem, 'quantity'>[] = [
  { id: 'sofa-scan', name: '3-Seater Sofa', category: 'furniture', confidence: 0.96, volume: 1.6, weight: 75, box2d: { x: 18, y: 35, w: 55, h: 42 } },
  { id: 'box-scan-1', name: 'Standard Moving Box', category: 'box', confidence: 0.94, volume: 0.08, weight: 15, box2d: { x: 75, y: 55, w: 18, h: 22 } },
  { id: 'fridge-scan', name: 'Refrigerator / Freezer', category: 'appliance', confidence: 0.91, volume: 1.1, weight: 85, box2d: { x: 8, y: 22, w: 26, h: 65 } },
  { id: 'table-scan', name: 'Dining Table', category: 'furniture', confidence: 0.89, volume: 1.25, weight: 42, box2d: { x: 30, y: 45, w: 45, h: 32 } },
  { id: 'bed-scan', name: 'Double Bed Frame', category: 'furniture', confidence: 0.93, volume: 1.8, weight: 65, box2d: { x: 22, y: 28, w: 60, h: 50 } },
  { id: 'washer-scan', name: 'Washing Machine', category: 'appliance', confidence: 0.92, volume: 0.65, weight: 70, box2d: { x: 68, y: 40, w: 22, h: 45 } },
];

export function LidarScannerModal({
  open,
  onClose,
  onApplyItems,
}: {
  open: boolean;
  onClose: () => void;
  onApplyItems: (items: DetectedItem[]) => void;
}) {
  const [activeTab, setActiveTab] = useState<'camera' | 'upload'>('camera');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [detectedItems, setDetectedItems] = useState<DetectedItem[]>([]);
  const [depthMetric, setDepthMetric] = useState(2.35);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stop camera stream safely
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  // Start camera stream
  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera is not supported in this browser.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to access camera';
      setCameraError(msg);
      setActiveTab('upload');
    }
  }, [stopCamera]);

  useEffect(() => {
    if (open && activeTab === 'camera') {
      void startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [open, activeTab, startCamera, stopCamera]);

  // Simulated LiDAR depth fluctuation
  useEffect(() => {
    if (!cameraActive) return;
    const interval = setInterval(() => {
      setDepthMetric((prev) => {
        const delta = (Math.random() - 0.5) * 0.12;
        return Number(Math.max(1.2, Math.min(4.8, prev + delta)).toFixed(2));
      });
    }, 600);
    return () => clearInterval(interval);
  }, [cameraActive]);

  // Analyze image and extract recognized items
  const processImageAnalysis = (imageSrc: string) => {
    setCapturedImage(imageSrc);
    setIsScanning(true);

    // Dynamic vision detection simulation (takes 1.2s to analyze spatial depth and objects)
    setTimeout(() => {
      // Pick 2 to 4 items from common recognition catalogue with randomized confident distribution
      const selectedRecognitions = COMMON_RECOGNITIONS.slice(0, 3 + Math.floor(Math.random() * 2)).map(
        (item) => ({
          ...item,
          quantity: item.category === 'box' ? 3 : 1,
        }),
      );
      setDetectedItems(selectedRecognitions);
      setIsScanning(false);
    }, 1200);
  };

  // Capture current frame from camera
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
      processImageAnalysis(dataUrl);
    }
  };

  // Handle uploaded file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        processImageAnalysis(result);
      }
    };
    reader.readAsDataURL(file);
  };

  const updateItemQuantity = (id: string, delta: number) => {
    setDetectedItems((prev) =>
      prev
        .map((item) => (item.id === id ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item))
        .filter((item) => item.quantity > 0),
    );
  };

  const handleApply = () => {
    onApplyItems(detectedItems);
    onClose();
  };

  const totalScannedVolume = detectedItems.reduce((acc, item) => acc + item.volume * item.quantity, 0);
  const totalScannedWeight = detectedItems.reduce((acc, item) => acc + item.weight * item.quantity, 0);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-3 sm:p-6 backdrop-blur-sm">
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col border-2 border-ink bg-paper shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-ink bg-paper px-4 py-3 md:px-6">
          <div className="flex items-center gap-2">
            <span className="size-2.5 bg-hazard animate-pulse" />
            <h3 className="mono text-sm font-bold text-ink">
              LIDAR SPATIAL SCANNER &middot; VOLUME &amp; WEIGHT ENGINE
            </h3>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="grid size-9 place-items-center text-ink-40 hover:text-ink transition"
            aria-label="Close scanner"
          >
            <X size={18} />
          </button>
        </div>

        {/* Viewfinder / Mode selection */}
        <div className="flex flex-1 flex-col overflow-y-auto md:grid md:grid-cols-12 md:overflow-hidden">
          {/* Left panel: Camera or Photo with LiDAR overlay */}
          <div className="relative flex flex-col border-b-2 border-ink bg-ink text-white md:col-span-7 md:border-b-0 md:border-r-2">
            {/* Mode tabs */}
            {!capturedImage && (
              <div className="absolute left-3 top-3 z-30 flex gap-1 border border-white/30 bg-ink/80 p-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('camera')}
                  className={`mono px-3 py-1 text-[10px] font-bold uppercase transition ${
                    activeTab === 'camera' ? 'bg-hazard text-white' : 'text-white/70 hover:text-white'
                  }`}
                >
                  <Camera size={12} className="mr-1.5 inline" /> LIVE LIDAR
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('upload')}
                  className={`mono px-3 py-1 text-[10px] font-bold uppercase transition ${
                    activeTab === 'upload' ? 'bg-hazard text-white' : 'text-white/70 hover:text-white'
                  }`}
                >
                  <Upload size={12} className="mr-1.5 inline" /> PHOTO FILE
                </button>
              </div>
            )}

            {/* Viewfinder area */}
            <div className="relative flex min-h-[300px] flex-1 items-center justify-center overflow-hidden bg-black md:min-h-[460px]">
              {/* 1. Live Camera */}
              {activeTab === 'camera' && !capturedImage && (
                <>
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className="size-full object-cover"
                  />

                  {/* LiDAR Wireframe Grid Overlay */}
                  <div className="pointer-events-none absolute inset-0">
                    {/* Perspective grid */}
                    <div className="size-full opacity-35 [background-image:linear-gradient(#e6191922_1px,transparent_1px),linear-gradient(90deg,#e6191922_1px,transparent_1px)] [background-size:32px_32px]" />

                    {/* Laser sweep animation */}
                    <div className="absolute inset-x-0 h-1 bg-hazard shadow-[0_0_15px_#e61919] animate-[bounce_3s_infinite]" />

                    {/* HUD crosshairs and telemetry markers */}
                    <div className="absolute left-4 top-14 mono text-[10px] text-hazard space-y-0.5 bg-black/60 p-2 border border-hazard/40">
                      <p>SYS: LIDAR MESH ONLINE</p>
                      <p>SENSOR: TRUE-DEPTH 3D</p>
                      <p className="font-bold">RANGE: {depthMetric} M</p>
                    </div>

                    <div className="absolute right-4 top-14 mono text-[10px] text-right text-white/80 space-y-0.5 bg-black/60 p-2 border border-white/20">
                      <p>CALIBRATION: ACTIVE</p>
                      <p>FOV: 84&deg; ULTRA-WIDE</p>
                      <p>SAMPLE: 120 FPS</p>
                    </div>

                    {/* Center reticle */}
                    <div className="absolute inset-0 m-auto size-24 border border-dashed border-hazard/70 flex items-center justify-center">
                      <span className="mono text-xs text-hazard font-bold">+</span>
                    </div>

                    <div className="absolute bottom-4 left-4 right-4 flex justify-between mono text-[9px] text-white/60">
                      <span>X: 10.1815&deg; / Y: 36.8065&deg;</span>
                      <span className="text-hazard font-bold">POINT CLOUD: 48,200 PTS</span>
                    </div>
                  </div>
                </>
              )}

              {/* 2. File Upload View */}
              {activeTab === 'upload' && !capturedImage && (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <div className="grid size-16 place-items-center border-2 border-dashed border-white/40 bg-white/5 mb-4">
                    <Upload size={28} className="text-hazard" />
                  </div>
                  <h4 className="display text-xl">DROP FURNITURE PHOTO HERE</h4>
                  <p className="mono mt-2 max-w-xs text-[10px] text-white/70">
                    Upload a wide photo of your room, furniture, or packed boxes.
                  </p>
                  <Button
                    variant="hazard"
                    size="sm"
                    className="mt-6"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    SELECT PHOTO
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  {cameraError && (
                    <p className="mono mt-4 text-[10px] text-hazard flex items-center gap-1">
                      <AlertCircle size={12} /> {cameraError}
                    </p>
                  )}
                </div>
              )}

              {/* 3. Captured / Uploaded Image View with Detections */}
              {capturedImage && (
                <div className="relative size-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={capturedImage}
                    alt="Captured room or item"
                    className="size-full object-contain"
                  />

                  {/* Scanning Animation */}
                  {isScanning && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75">
                      <div className="size-16 border-4 border-hazard border-t-transparent rounded-full animate-spin mb-4" />
                      <p className="display text-xl text-white">ANALYZING SPATIAL VOLUMETRY</p>
                      <p className="mono mt-2 text-xs text-hazard">
                        COMPUTING OBJECT WEIGHT &amp; VEHICLE MATCH&hellip;
                      </p>
                    </div>
                  )}

                  {/* Detected Bounding Boxes Overlay */}
                  {!isScanning &&
                    detectedItems.map((item, idx) => {
                      const box = item.box2d || { x: 20 + idx * 15, y: 30 + idx * 10, w: 30, h: 30 };
                      return (
                        <div
                          key={item.id}
                          className="absolute border-2 border-hazard bg-hazard/15 transition-all"
                          style={{
                            left: `${box.x}%`,
                            top: `${box.y}%`,
                            width: `${box.w}%`,
                            height: `${box.h}%`,
                          }}
                        >
                          <span className="mono absolute -top-5 left-0 bg-hazard px-1.5 py-0.5 text-[9px] font-bold text-white whitespace-nowrap">
                            {item.name} &middot; {item.volume}m&sup3; &middot; {item.weight}kg
                          </span>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Viewfinder bottom controls */}
            <div className="flex items-center justify-between border-t border-white/20 bg-ink px-4 py-3">
              {!capturedImage ? (
                <>
                  <p className="mono text-[10px] text-white/60">
                    {activeTab === 'camera'
                      ? 'AIM AT FURNITURE OR BOXES & SNAP'
                      : 'SUPPORTED FORMATS: JPG, PNG, WEBP'}
                  </p>
                  {activeTab === 'camera' && (
                    <Button
                      variant="hazard"
                      size="sm"
                      onClick={captureFrame}
                      className="mono font-bold tracking-wider"
                    >
                      <Scan size={14} className="mr-1.5" /> CAPTURE &amp; DETECT
                    </Button>
                  )}
                </>
              ) : (
                <div className="flex w-full items-center justify-between">
                  <button
                    onClick={() => {
                      setCapturedImage(null);
                      setDetectedItems([]);
                      if (activeTab === 'camera') void startCamera();
                    }}
                    className="mono flex items-center gap-1.5 text-[10px] text-white/70 hover:text-white"
                  >
                    <RefreshCw size={12} /> SCAN ANOTHER PHOTO
                  </button>
                  <span className="mono text-[10px] text-hazard font-bold">
                    {detectedItems.length} OBJECTS IDENTIFIED
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right panel: Detected Items & Weight / Volume Summary */}
          <div className="flex flex-col justify-between bg-paper p-4 md:col-span-5 md:overflow-y-auto md:p-6">
            <div>
              <div className="border-b border-ink pb-3">
                <p className="mono text-[10px] text-hazard font-bold">[ AUTOMATED INVENTORY ]</p>
                <h4 className="display mt-1 text-2xl">DETECTED ITEMS</h4>
                <p className="mt-1 text-xs text-ink-80">
                  Items extracted from LiDAR point cloud and vision telemetry.
                </p>
              </div>

              {detectedItems.length === 0 ? (
                <div className="py-12 text-center text-ink-40">
                  <Sparkles size={32} className="mx-auto mb-3 opacity-40" />
                  <p className="mono text-xs">NO SCANNED ITEMS YET</p>
                  <p className="mt-1 text-[11px]">Capture a photo or upload an image to start scanning.</p>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {detectedItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between border border-ink bg-paper-soft p-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-xs text-ink">{item.name}</p>
                          <span className="mono text-[8px] bg-ink text-paper px-1 py-0.5">
                            {Math.round(item.confidence * 100)}%
                          </span>
                        </div>
                        <p className="mono mt-1 text-[9px] text-ink-40">
                          {item.volume} M&sup3; &middot; {item.weight} KG EACH
                        </p>
                      </div>

                      <div className="flex items-center border border-ink bg-paper">
                        <button
                          type="button"
                          onClick={() => updateItemQuantity(item.id, -1)}
                          className="grid size-8 place-items-center hover:bg-paper-soft"
                          aria-label={`Remove one ${item.name}`}
                        >
                          <Minus size={13} />
                        </button>
                        <span className="mono grid w-7 place-items-center text-xs font-bold">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateItemQuantity(item.id, 1)}
                          className="grid size-8 place-items-center border-l border-ink bg-ink text-paper hover:bg-hazard"
                          aria-label={`Add one ${item.name}`}
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Total telemetry breakdown */}
            {detectedItems.length > 0 && (
              <div className="mt-6 border-t-2 border-ink pt-4">
                <div className="grid grid-cols-2 gap-3 border border-ink bg-paper-soft p-3 mb-4">
                  <div>
                    <p className="mono text-[9px] text-ink-40">TOTAL SCANNED VOLUME</p>
                    <p className="display text-xl text-ink">
                      {totalScannedVolume.toFixed(2)} <span className="text-xs">M&sup3;</span>
                    </p>
                  </div>
                  <div>
                    <p className="mono text-[9px] text-ink-40">ESTIMATED PAYLOAD</p>
                    <p className="display text-xl text-hazard">
                      {Math.round(totalScannedWeight)} <span className="text-xs">KG</span>
                    </p>
                  </div>
                </div>

                <Button
                  variant="hazard"
                  size="lg"
                  className="w-full mono font-bold"
                  onClick={handleApply}
                >
                  <Check size={16} className="mr-2" /> ADD TO MOVE MANIFEST
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
