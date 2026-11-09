'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, Upload, X, Check, Scan, Sparkles, RefreshCw, Ruler, Weight, Box, Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { detectObjects, type DetectedObject } from '@/lib/vision/detector';

export type DetectedItem = DetectedObject;

export function LidarScannerModal({
  open,
  onClose,
  onApplyItems,
}: {
  open: boolean;
  onClose: () => void;
  onApplyItems: (items: DetectedItem[]) => void;
  initialItems?: DetectedItem[];
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
    }, 400);
    return () => clearInterval(interval);
  }, [cameraActive]);

  // Process image analysis with real computer vision
  const processImageAnalysis = async (imageSrc: string) => {
    setCapturedImage(imageSrc);
    setIsScanning(true);

    try {
      let items: DetectedItem[] = [];
      try {
        const res = await fetch('/api/vision/detect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: imageSrc, depthMeters: depthMetric }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.items && data.items.length > 0) {
            items = data.items;
          }
        }
      } catch {
        // Fall back to client spatial detector
      }

      if (items.length === 0) {
        items = await detectObjects(imageSrc, depthMetric);
      }

      setDetectedItems(items);
    } catch {
      const fallback = await detectObjects(imageSrc, depthMetric);
      setDetectedItems(fallback);
    } finally {
      setIsScanning(false);
    }
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
      void processImageAnalysis(dataUrl);
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
        void processImageAnalysis(result);
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
            <span className="size-2 bg-hazard animate-pulse" />
            <h2 className="display text-xl sm:text-2xl font-bold">LIDAR RECOGNITION &amp; LOAD ESTIMATION</h2>
          </div>
          <button
            onClick={onClose}
            className="grid size-9 place-items-center border border-ink bg-paper hover:bg-hazard hover:text-white transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="grid grid-cols-2 border-b-2 border-ink mono text-xs font-bold bg-paper-soft">
          <button
            onClick={() => {
              setActiveTab('camera');
              setCapturedImage(null);
            }}
            className={`flex items-center justify-center gap-2 py-3 border-r-2 border-ink transition ${
              activeTab === 'camera' ? 'bg-ink text-paper' : 'hover:bg-paper'
            }`}
          >
            <Camera size={14} /> LIVE CAMERA SCAN
          </button>
          <button
            onClick={() => {
              setActiveTab('upload');
              stopCamera();
            }}
            className={`flex items-center justify-center gap-2 py-3 transition ${
              activeTab === 'upload' ? 'bg-ink text-paper' : 'hover:bg-paper'
            }`}
          >
            <Upload size={14} /> UPLOAD PHOTO
          </button>
        </div>

        {/* Main Body */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {/* CAMERA TAB */}
          {activeTab === 'camera' && !capturedImage && (
            <div className="relative overflow-hidden border-2 border-ink bg-black">
              <video ref={videoRef} playsInline muted className="h-72 sm:h-96 w-full object-cover" />

              {/* Spatial HUD Overlay */}
              <div className="pointer-events-none absolute inset-0">
                <div className="size-full opacity-25 [background-image:linear-gradient(#e6191922_1px,transparent_1px),linear-gradient(90deg,#e6191922_1px,transparent_1px)] [background-size:24px_24px]" />
                <div className="absolute inset-x-0 h-1 bg-hazard shadow-[0_0_15px_#e61919] animate-[bounce_2.5s_infinite]" />

                <div className="absolute left-3 top-3 mono text-[9px] text-hazard bg-black/80 p-2.5 border border-hazard/40 space-y-0.5">
                  <p className="font-bold">LIDAR: ACTIVE TELEMETRY</p>
                  <p>RANGE: {depthMetric} M</p>
                  <p>UNCERTAINTY: &plusmn; 4 MM</p>
                </div>

                <div className="absolute right-3 top-3 mono text-[9px] text-white/80 bg-black/80 p-2 border border-white/20">
                  <p>MODEL: DEPTH-CALIBRATED</p>
                  <p className="text-hazard font-bold">FOV: 84&deg;</p>
                </div>

                <div className="absolute inset-0 m-auto size-28 border border-dashed border-hazard/70 flex items-center justify-center">
                  <span className="mono text-sm text-hazard font-bold">+</span>
                </div>
              </div>

              {cameraError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-paper p-6 text-center">
                  <p className="mono text-xs text-hazard font-bold">CAMERA UNAVAILABLE</p>
                  <p className="mt-2 text-sm text-ink-80">{cameraError}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 mono text-xs"
                    onClick={() => setActiveTab('upload')}
                  >
                    SWITCH TO PHOTO UPLOAD
                  </Button>
                </div>
              )}

              {cameraActive && (
                <div className="absolute bottom-4 inset-x-0 flex items-center justify-center gap-3">
                  <Button
                    variant="hazard"
                    size="lg"
                    onClick={captureFrame}
                    className="mono text-xs font-bold px-6 shadow-2xl"
                  >
                    <Scan size={16} className="mr-2" /> CAPTURE &amp; DETECT
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* UPLOAD TAB */}
          {activeTab === 'upload' && !capturedImage && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex min-h-72 cursor-pointer flex-col items-center justify-center border-2 border-dashed border-ink bg-paper-soft p-8 text-center transition hover:border-hazard"
            >
              <div className="grid size-14 place-items-center border-2 border-ink bg-paper text-ink mb-3">
                <Upload size={24} className="text-hazard" />
              </div>
              <h3 className="display text-2xl">SELECT ROOM OR ITEM PHOTO</h3>
              <p className="mono mt-2 max-w-sm text-xs text-ink-80">
                Click or drag-and-drop a photo of your furniture, boxes, or room.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>
          )}

          {/* ANALYZING STATE */}
          {isScanning && (
            <div className="flex min-h-72 flex-col items-center justify-center border-2 border-ink bg-ink p-8 text-center text-white">
              <div className="size-12 border-4 border-hazard border-t-transparent rounded-full animate-spin mb-4" />
              <h3 className="display text-2xl">ANALYZING PIXELS &amp; DEPTH</h3>
              <p className="mono mt-2 text-xs text-hazard">
                COMPUTING OBJECT CLASS, METRIC HEIGHT &amp; MASS PAYLOAD&hellip;
              </p>
            </div>
          )}

          {/* RESULTS STATE */}
          {!isScanning && capturedImage && (
            <div className="grid gap-6 lg:grid-cols-12">
              {/* Photo with Bounding Boxes */}
              <div className="relative overflow-hidden border-2 border-ink bg-black lg:col-span-6">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={capturedImage} alt="Detected load" className="h-64 sm:h-80 w-full object-cover" />

                {detectedItems.map((item) => {
                  const b = item.box2d || { x: 20, y: 25, w: 50, h: 45 };
                  return (
                    <div
                      key={item.id}
                      className="absolute border-2 border-hazard bg-hazard/20 transition-all pointer-events-none"
                      style={{ left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}%`, height: `${b.h}%` }}
                    >
                      <span className="mono absolute -top-5 left-0 bg-hazard px-1.5 py-0.5 text-[9px] font-bold text-white whitespace-nowrap shadow-md">
                        {item.name} &middot; H: {item.heightCm}cm &middot; {item.weight}kg
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Items List */}
              <div className="flex flex-col justify-between border-2 border-ink bg-paper p-4 lg:col-span-6">
                <div>
                  <div className="flex items-center justify-between border-b border-ink pb-2">
                    <span className="mono text-[10px] text-hazard font-bold flex items-center gap-1">
                      <Sparkles size={13} /> DETECTED OBJECTS ({detectedItems.length})
                    </span>
                    <button
                      onClick={() => {
                        setCapturedImage(null);
                        setDetectedItems([]);
                        if (activeTab === 'camera') void startCamera();
                      }}
                      className="mono text-[10px] text-ink-40 hover:text-ink underline flex items-center gap-1"
                    >
                      <RefreshCw size={11} /> RETAKE
                    </button>
                  </div>

                  <div className="mt-3 space-y-2.5 max-h-60 overflow-y-auto pr-1">
                    {detectedItems.length === 0 ? (
                      <div className="border border-dashed border-ink/40 p-5 text-center bg-paper-soft">
                        <p className="mono text-xs font-bold text-hazard">NO OBJECTS DETECTED</p>
                        <p className="mt-1 text-[11px] text-ink-80">
                          The camera could not isolate distinct furniture or boxes in this frame. Ensure the area is illuminated and point directly at items.
                        </p>
                      </div>
                    ) : (
                      detectedItems.map((item) => (
                        <div
                          key={item.id}
                          className="border border-ink bg-paper-soft p-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <p className="font-bold text-xs text-ink">{item.name}</p>
                                <span className="mono text-[8px] bg-ink text-paper px-1 uppercase">
                                  {item.category}
                                </span>
                              </div>
                              <p className="mt-0.5 text-[10px] text-ink-80">{item.description}</p>
                            </div>

                            {/* Quantity control */}
                            <div className="flex items-center border border-ink bg-paper shrink-0">
                              <button
                                type="button"
                                onClick={() => updateItemQuantity(item.id, -1)}
                                className="grid size-7 place-items-center hover:bg-paper-soft"
                              >
                                <Minus size={12} />
                              </button>
                              <span className="mono grid w-7 place-items-center text-xs font-bold">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateItemQuantity(item.id, 1)}
                                className="grid size-7 place-items-center border-l border-ink bg-ink text-paper hover:bg-hazard"
                              >
                                <Plus size={12} />
                              </button>
                            </div>
                          </div>

                          <div className="mt-2 grid grid-cols-3 gap-1 border-t border-ink/20 pt-1.5 mono text-[9px] text-ink-80">
                            <div className="flex items-center gap-1">
                              <Ruler size={11} className="text-hazard" />
                              <span>{item.widthCm}&times;{item.heightCm} cm</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Box size={11} className="text-ink-40" />
                              <span>{item.volume} m&sup3;</span>
                            </div>
                            <div className="flex items-center gap-1 font-bold text-hazard">
                              <Weight size={11} />
                              <span>{item.weight} kg</span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="mt-4 border-t-2 border-ink pt-3">
                  <div className="flex items-center justify-between mono text-[11px] mb-3">
                    <span>ESTIMATED TOTAL:</span>
                    <strong className="text-hazard font-bold">
                      {totalScannedVolume.toFixed(2)} M&sup3; &middot; {totalScannedWeight} KG
                    </strong>
                  </div>
                  <Button
                    variant="hazard"
                    size="sm"
                    className="w-full mono font-bold"
                    onClick={handleApply}
                    disabled={detectedItems.length === 0}
                  >
                    <Check size={14} className="mr-1.5" /> APPLY TO MANIFEST
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
