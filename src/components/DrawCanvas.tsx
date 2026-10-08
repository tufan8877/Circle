import { useLanguage } from '@/lib/i18n';
import { useRef, useEffect, useCallback, useState } from "react";
import type { Point } from "@/lib/circleAnalysis";

interface DrawCanvasProps {
  onDrawComplete: (points: Point[]) => void;
  isAnalyzing: boolean;
  hasResult: boolean;
  resetSignal: number;
  lineColor: string;
}

export default function DrawCanvas({
  onDrawComplete,
  isAnalyzing,
  hasResult,
  resetSignal,
  lineColor,
}: DrawCanvasProps) {
  const {t} = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pointsRef = useRef<Point[]>([]);
  const drawingRef = useRef(false);
  const dprRef = useRef(1);
  const sizeRef = useRef({ w: 0, h: 0 });
  const [isDrawing, setIsDrawing] = useState(false);

  // ── Setup canvas size for DPR ──────────────────────────────────
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    dprRef.current = dpr;
    sizeRef.current = { w: rect.width, h: rect.height };

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Redraw existing points if any.
      redrawLine(ctx, pointsRef.current, lineColor, dpr);
    }
  }, [lineColor]);

  useEffect(() => {
    resizeCanvas();
    const ro = new ResizeObserver(() => resizeCanvas());
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [resizeCanvas]);

  // ── Clear on reset ─────────────────────────────────────────────
  useEffect(() => {
    if (resetSignal === 0) return;
    pointsRef.current = [];
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [resetSignal]);

  // ── Clear when starting a new draw (after result shown) ────────
  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    pointsRef.current = [];
  }, []);

  // ── Pointer handlers ───────────────────────────────────────────
  const getPos = (e: React.PointerEvent): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isAnalyzing) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    // If a result is showing, clear and start fresh.
    if (hasResult) {
      clearCanvas();
    }

    drawingRef.current = true;
    setIsDrawing(true);
    const pt = getPos(e);
    pointsRef.current = [pt];

    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const pt = getPos(e);
    pointsRef.current.push(pt);

    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    drawingRef.current = false;
    setIsDrawing(false);

    const ctx = canvasRef.current!.getContext("2d")!;
    // Smooth visual line: redraw with quadratic curves.
    ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
    drawSmoothLine(ctx, pointsRef.current, lineColor, dprRef.current);

    const pts = pointsRef.current;
    if (pts.length >= 2) {
      onDrawComplete(pts);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full"
      style={{ minHeight: "320px" }}
    >
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className="absolute inset-0 rounded-3xl"
        style={{
          touchAction: "none",
          cursor: isDrawing ? "crosshair" : hasResult ? "pointer" : "crosshair",
        }}
      />
      {!isDrawing && !hasResult && !isAnalyzing && pointsRef.current.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-3 text-white/25 select-none">
            <div className="w-16 h-16 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-white/20" />
            </div>
            <span className="text-sm font-medium tracking-wide">
              {t('Draw a circle here')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Drawing helpers ──────────────────────────────────────────────────

function drawSmoothLine(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  color: string,
  dpr: number,
) {
  if (points.length < 2) return;
  ctx.save();
  // Set an absolute transform: the canvas context is already scaled for DPR.
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length - 1; i++) {
    const xc = (points[i].x + points[i + 1].x) / 2;
    const yc = (points[i].y + points[i + 1].y) / 2;
    ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
  }
  ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
  ctx.stroke();
  ctx.restore();
}

function redrawLine(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  color: string,
  dpr: number,
) {
  if (points.length === 0) return;
  drawSmoothLine(ctx, points, color, dpr);
}
