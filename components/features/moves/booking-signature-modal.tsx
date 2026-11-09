'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Check, PenTool, RotateCcw, ShieldCheck, FileCheck, Truck, MapPin, Box } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BookingSignatureModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (signatureDataUrl: string) => void;
  pickupAddress: string;
  destinationAddress: string;
  vehicleName: string;
  volume: number;
  weight: number;
  itemCount: number;
  price: number;
  scheduledDate?: string;
  scheduledTime?: string;
  isSubmitting?: boolean;
}

export function BookingSignatureModal({
  open,
  onClose,
  onConfirm,
  pickupAddress,
  destinationAddress,
  vehicleName,
  volume,
  weight,
  itemCount,
  price,
  scheduledDate,
  scheduledTime,
  isSubmitting = false,
}: BookingSignatureModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(true);

  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#101010';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  }, [open]);

  if (!open) return null;

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0]!.clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0]!.clientY : e.clientY;

    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0]!.clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0]!.clientY : e.clientY;

    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleConfirm = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    onConfirm(dataUrl);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-3 sm:p-5 backdrop-blur-sm">
      <div className="relative w-full max-w-lg border-2 border-ink bg-paper p-5 sm:p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-ink pb-3">
          <div>
            <div className="flex items-center gap-1.5 mono text-[10px] text-hazard font-bold">
              <FileCheck size={14} />
              <span>CONTRACT VALIDATION &middot; ELECTRONIC SIGNATURE</span>
            </div>
            <h3 className="display text-2xl font-bold mt-1">SIGN TO CONFIRM MOVE.</h3>
            <p className="mono text-xs text-ink-60 mt-0.5">MoveUp Transport &amp; Relocation Agreement</p>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="grid size-8 place-items-center border border-ink hover:bg-hazard hover:text-white transition disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </div>

        {/* Move Recap Summary Card */}
        <div className="mt-4 border border-ink bg-paper-soft p-3 mono text-xs space-y-1.5">
          <div className="flex items-center justify-between border-b border-ink/20 pb-1">
            <span className="text-ink-60 flex items-center gap-1">
              <Truck size={12} className="text-hazard" /> ALLOCATED VEHICLE
            </span>
            <span className="font-bold text-ink">{vehicleName}</span>
          </div>

          {scheduledDate && (
            <div className="flex items-center justify-between border-b border-ink/20 pb-1 text-hazard font-semibold">
              <span className="text-ink-60 flex items-center gap-1">
                SCHEDULED DATE &amp; TIME
              </span>
              <span>{scheduledDate} &middot; {scheduledTime || 'Morning'}</span>
            </div>
          )}

          <div className="flex items-center justify-between border-b border-ink/20 pb-1">
            <span className="text-ink-60 flex items-center gap-1">
              <Box size={12} /> VERIFIED LOAD
            </span>
            <span>{volume.toFixed(1)} m&sup3; &middot; {Math.round(weight)} kg ({itemCount} items)</span>
          </div>

          <div className="flex items-start justify-between border-b border-ink/20 pb-1 text-[11px]">
            <span className="text-ink-60 flex items-center gap-1 shrink-0">
              <MapPin size={12} /> ROUTE
            </span>
            <span className="truncate max-w-[240px] text-right font-medium">
              {pickupAddress.split(',')[0]} &rarr; {destinationAddress.split(',')[0]}
            </span>
          </div>

          <div className="flex items-center justify-between pt-0.5">
            <span className="text-ink-80 font-bold">TOTAL ESTIMATED FARE</span>
            <span className="display text-lg font-bold text-hazard">{price} TND</span>
          </div>
        </div>

        {/* Signature Area */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <label className="mono text-[10px] text-ink font-bold uppercase flex items-center gap-1">
              <PenTool size={12} className="text-hazard" /> CLIENT ELECTRONIC SIGNATURE *
            </label>
            <button
              type="button"
              onClick={clearCanvas}
              disabled={isSubmitting}
              className="mono text-[10px] text-ink-60 hover:text-ink underline flex items-center gap-1"
            >
              <RotateCcw size={10} /> CLEAR &amp; RETRY
            </button>
          </div>

          <div className="relative border-2 border-dashed border-ink bg-white">
            <canvas
              ref={canvasRef}
              width={460}
              height={140}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className="w-full touch-none cursor-crosshair"
            />

            {!hasSignature && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center mono text-xs text-ink-40">
                SIGN YOUR NAME WITH FINGER OR MOUSE
              </div>
            )}
          </div>
        </div>

        {/* Legal Terms Checkbox */}
        <label className="mt-3 flex items-start gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={agreedToTerms}
            onChange={(e) => setAgreedToTerms(e.target.checked)}
            className="mt-0.5 size-4 accent-[#e61919] cursor-pointer"
          />
          <span className="mono text-[10px] text-ink-80 leading-tight">
            I confirm the load manifest, route details, and certify that this electronic signature legally validates the move request.
          </span>
        </label>

        {/* Security Certificate Badge */}
        <div className="mt-3 flex items-center gap-1.5 mono text-[9px] text-emerald-700 bg-emerald-50 border border-emerald-300 p-2">
          <ShieldCheck size={13} className="shrink-0" />
          <span>CRYPTOGRAPHICALLY ENCRYPTED &amp; AUDIT TRAIL LOGGED</span>
        </div>

        {/* Action Buttons */}
        <div className="mt-5 flex gap-3 border-t-2 border-ink pt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
            className="mono flex-1 text-xs"
          >
            CANCEL
          </Button>

          <Button
            variant="hazard"
            size="sm"
            disabled={!hasSignature || !agreedToTerms || isSubmitting}
            onClick={handleConfirm}
            className="mono flex-1 text-xs font-bold"
          >
            <Check size={14} className="mr-1.5" />
            {isSubmitting ? 'CONFIRMING MOVE…' : 'CONFIRM & BOOK MOVE'}
          </Button>
        </div>
      </div>
    </div>
  );
}
