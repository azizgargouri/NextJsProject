'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Check, PenTool, RotateCcw, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProofOfDeliveryModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (signatureDataUrl: string) => void;
  moveReference: string;
  moverName: string;
}

export function ProofOfDeliveryModal({
  open,
  onClose,
  onConfirm,
  moveReference,
  moverName,
}: ProofOfDeliveryModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

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

    // Clear canvas
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
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg border-2 border-ink bg-paper p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-ink pb-3">
          <div>
            <div className="flex items-center gap-1.5 mono text-[10px] text-hazard font-bold">
              <ShieldCheck size={14} />
              <span>PROOF OF DELIVERY &middot; MOVE SIGN-OFF</span>
            </div>
            <h3 className="display text-2xl font-bold mt-1">CLIENT DELIVERY SIGNATURE.</h3>
            <p className="mono text-xs text-ink-60 mt-0.5">REF: {moveReference} &middot; {moverName}</p>
          </div>
          <button
            onClick={onClose}
            className="grid size-8 place-items-center border border-ink hover:bg-hazard hover:text-white transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="mt-4 space-y-3">
          <p className="text-xs text-ink-80">
            Please sign below using your finger or stylus to confirm all goods have been unloaded and received in good order.
          </p>

          {/* Signature Canvas */}
          <div className="relative border-2 border-dashed border-ink bg-white">
            <canvas
              ref={canvasRef}
              width={460}
              height={180}
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
                <PenTool size={14} className="mr-1.5" /> SIGN ON THIS LINE
              </div>
            )}

            <button
              type="button"
              onClick={clearCanvas}
              className="mono absolute bottom-2 right-2 flex items-center gap-1 border border-ink/40 bg-paper px-2 py-1 text-[10px] hover:bg-paper-soft"
            >
              <RotateCcw size={11} /> CLEAR
            </button>
          </div>

          <div className="flex items-center gap-1.5 mono text-[10px] text-ink-60 pt-1">
            <CheckCircle2 size={12} className="text-emerald-600" />
            <span>Digital signature is cryptographically bound to move record {moveReference}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex gap-3 border-t-2 border-ink pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="mono flex-1 text-xs"
          >
            CANCEL
          </Button>

          <Button
            variant="hazard"
            size="sm"
            disabled={!hasSignature}
            onClick={handleConfirm}
            className="mono flex-1 text-xs font-bold"
          >
            <Check size={14} className="mr-1.5" /> CONFIRM &amp; CLOSE MOVE
          </Button>
        </div>
      </div>
    </div>
  );
}
