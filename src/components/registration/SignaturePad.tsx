import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";

export interface SignaturePadHandle {
  clear: () => void;
  isEmpty: () => boolean;
  toDataURL: () => string;
}

interface Props {
  height?: number;
  className?: string;
}

export const SignaturePad = forwardRef<SignaturePadHandle, Props>(({ height = 220, className }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const dirtyRef = useRef(false);

  useImperativeHandle(ref, () => ({
    clear: () => {
      const c = canvasRef.current; if (!c) return;
      const ctx = c.getContext("2d"); if (!ctx) return;
      ctx.clearRect(0, 0, c.width, c.height);
      dirtyRef.current = false;
    },
    isEmpty: () => !dirtyRef.current,
    toDataURL: () => canvasRef.current?.toDataURL("image/png") ?? "",
  }));

  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = rect.width * dpr;
    c.height = rect.height * dpr;
    const ctx = c.getContext("2d"); if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#0f172a";
  }, []);

  const pos = (e: PointerEvent | React.PointerEvent) => {
    const c = canvasRef.current!; const r = c.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault(); (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    drawingRef.current = true; lastRef.current = pos(e);
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const c = canvasRef.current!; const ctx = c.getContext("2d")!; const p = pos(e);
    const isPen = e.pointerType === "pen";
    const pressure = (e as unknown as PointerEvent).pressure ?? 0.5;
    ctx.lineWidth = isPen ? Math.max(1.2, 3.2 * (pressure || 0.5)) : 2.2;
    ctx.beginPath(); ctx.moveTo(lastRef.current!.x, lastRef.current!.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    lastRef.current = p; dirtyRef.current = true;
  };
  const onUp = () => { drawingRef.current = false; lastRef.current = null; };

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onPointerLeave={onUp}
      style={{ height, touchAction: "none" }}
      className={`w-full rounded-xl bg-white ${className ?? ""}`}
      aria-label="Signature pad"
    />
  );
});
SignaturePad.displayName = "SignaturePad";
