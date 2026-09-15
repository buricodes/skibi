import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  color: string;
  size: number;
  points: Point[];
}

export interface CanvasHandle {
  clear: () => void;
  applyRemoteStrokeStart: (s: { x: number; y: number; color: string; size: number }) => void;
  applyRemoteStrokePoint: (p: { x: number; y: number }) => void;
  applyRemoteStrokeEnd: () => void;
  applyRemoteClear: () => void;
}

interface CanvasProps {
  // false for a guesser's read-only view, which only ever gets driven by
  // applyRemote* calls (see GameContext.onRemoteStroke) and never accepts
  // pointer input or shows the color/size palette.
  interactive?: boolean;
  onStrokeStart?: (s: { x: number; y: number; color: string; size: number }) => void;
  onStrokePoint?: (p: { x: number; y: number }) => void;
  onStrokeEnd?: () => void;
  onClear?: () => void;
}

const COLORS = ['#0b0d14', '#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#ffffff'];
const SIZES = [3, 6, 12];
const CANVAS_WIDTH = 480;
const CANVAS_HEIGHT = 360;

// The canvas's internal pixel resolution (CANVAS_WIDTH x CANVAS_HEIGHT) is
// fixed and identical for every client regardless of how large it's
// displayed via CSS — that's what makes raw stroke coordinates portable
// between the drawer and every viewer without any extra normalization.
export const Canvas = forwardRef<CanvasHandle, CanvasProps>(function Canvas(
  { interactive = true, onStrokeStart, onStrokePoint, onStrokeEnd, onClear },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeStrokeRef = useRef<Stroke | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(SIZES[1]);

  useImperativeHandle(ref, () => ({
    clear: () => {
      setStrokes([]);
      onClear?.();
    },
    applyRemoteStrokeStart: (s) => {
      activeStrokeRef.current = { color: s.color, size: s.size, points: [{ x: s.x, y: s.y }] };
      setStrokes((prev) => [...prev, activeStrokeRef.current!]);
    },
    applyRemoteStrokePoint: (p) => {
      const active = activeStrokeRef.current;
      if (!active) return;
      active.points.push({ x: p.x, y: p.y });
      setStrokes((prev) => [...prev.slice(0, -1), active]);
    },
    applyRemoteStrokeEnd: () => {
      activeStrokeRef.current = null;
    },
    applyRemoteClear: () => setStrokes([]),
  }));

  const redraw = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const stroke of strokes) drawStroke(ctx, stroke);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(redraw, [strokes]);

  function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
    if (stroke.points.length === 1) {
      const [p] = stroke.points;
      ctx.beginPath();
      ctx.arc(p.x, p.y, stroke.size / 2, 0, Math.PI * 2);
      ctx.fillStyle = stroke.color;
      ctx.fill();
      return;
    }
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (const p of stroke.points.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  // The canvas is drawn at a fixed internal resolution but displayed at
  // whatever width CSS gives it, so pointer coordinates need rescaling
  // from CSS pixels to canvas pixels — otherwise strokes drift from the
  // cursor on any screen where the canvas isn't shown at 1:1.
  function pointFromEvent(e: ReactPointerEvent<HTMLCanvasElement>): Point {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) * canvas.width) / rect.width,
      y: ((e.clientY - rect.top) * canvas.height) / rect.height,
    };
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!interactive) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const point = pointFromEvent(e);
    const stroke: Stroke = { color, size, points: [point] };
    activeStrokeRef.current = stroke;
    setStrokes((s) => [...s, stroke]);
    onStrokeStart?.({ x: point.x, y: point.y, color, size });
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    const active = activeStrokeRef.current;
    if (!interactive || !active) return;
    const point = pointFromEvent(e);
    // Mutating the in-flight stroke's points array in place (instead of
    // copying on every move) keeps a fast-drawn stroke cheap; the outer
    // strokes array is still replaced so React/the redraw effect notice.
    active.points.push(point);
    setStrokes((s) => [...s.slice(0, -1), active]);
    onStrokePoint?.(point);
  }

  function handlePointerUp() {
    if (!interactive || !activeStrokeRef.current) return;
    activeStrokeRef.current = null;
    onStrokeEnd?.();
  }

  function handleClear() {
    setStrokes([]);
    onClear?.();
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className={`w-full rounded-lg border border-border bg-white ${interactive ? 'touch-none' : ''}`}
        style={{ aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}` }}
      />
      {interactive && (
        <div className="flex flex-wrap items-center gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`h-6 w-6 rounded-full border-2 ${color === c ? 'border-accent' : 'border-white/10'}`}
              style={{ background: c }}
              aria-label={`color ${c}`}
            />
          ))}
          <div className="mx-1 h-5 w-px bg-border" />
          {SIZES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSize(s)}
              className={`flex h-6 w-6 items-center justify-center rounded-full border ${size === s ? 'border-accent' : 'border-border'}`}
            >
              <span className="rounded-full bg-white/80" style={{ width: s, height: s }} />
            </button>
          ))}
          <div className="mx-1 h-5 w-px bg-border" />
          <button
            type="button"
            onClick={handleClear}
            className="rounded-md border border-border px-2 py-1 text-xs text-white/70 hover:border-accent"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
});
