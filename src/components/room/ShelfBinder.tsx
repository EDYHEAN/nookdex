"use client";

import { useId, useMemo, type ReactNode } from "react";
import { shade } from "@/lib/binders";
import { quadMatrix, type SCENE } from "@/lib/scene";

/**
 * A lever-arch binder standing on the shelf, drawn like the painted room: ink outline, flat colors,
 * a soft light from the left. Drawn flat (w x h), then projected onto its place, so its top and bottom
 * follow the shelf's vanishing lines.
 * The last binder of a row shows its side cover, going back to the right, and throws a shadow on the wall.
 */
type Slot = (typeof SCENE)["slots"][number];

interface Props {
  slot: Slot;
  color?: string;
  /** last of its row: side cover + shadow visible */
  last?: boolean;
  /** empty place: pencil sketch, no color */
  sketch?: boolean;
  /** laid on the spine, in the flat drawing's coordinates (the label) */
  children?: ReactNode;
}

const INK = "#2e2430";
const STROKE = 3.6;
/** how far the side cover goes back (x) and down (y), in scene px */
const DEPTH = { x: 46, y: 22 };

/** Size of the flat drawing for a place: its width, and the mean height of its two edges. */
export function binderSize(slot: Slot) {
  const [tl, tr, br, bl] = slot.quad;
  return { w: slot.w, h: (bl[1] - tl[1] + br[1] - tr[1]) / 2 };
}

/** Where the white label sits on a w x h spine (the set logo is laid on it). */
export function binderLabel(w: number, h: number) {
  const face = w - 11; // the rest is the rounded edge of the cover
  const lw = face * 0.64;
  return { x: face / 2 - lw / 2 + 1, y: h * 0.085, w: lw, h: h * 0.53 };
}

export function ShelfBinder({ slot, color = "#b9b3bd", last = false, sketch = false, children }: Props) {
  const { w, h } = binderSize(slot);
  const transform = useMemo(
    () =>
      quadMatrix(
        w,
        h,
        slot.quad.map(([x, y]) => [x - slot.x, y - slot.y] as [number, number]),
      ),
    [w, h, slot],
  );
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: w,
        height: h,
        transformOrigin: "0 0",
        transform,
        // the drawing hangs over the next place (side cover, shadow): only the button's own rect catches the pointer
        pointerEvents: "none",
      }}
    >
      <Drawing w={w} h={h} color={color} last={last} sketch={sketch} />
      {children}
    </div>
  );
}

function Drawing({ w, h, color, last, sketch }: { w: number; h: number; color: string; last: boolean; sketch: boolean }) {
  const id = useId().replace(/:/g, "");
  const face = w - 11;
  const label = binderLabel(w, h);
  const hole = { cx: face / 2 + 1, cy: h * 0.85, r: face * 0.2 };
  const side = [
    [w - 3, 4],
    [w + DEPTH.x, DEPTH.y],
    [w + DEPTH.x, h - 3],
    [w - 3, h - 1.8],
  ]
    .map((p) => p.join(","))
    .join(" ");

  if (sketch) {
    return (
      <svg className="shelfBinder" width={w + DEPTH.x + 4} height={h + 2} viewBox={`0 0 ${w + DEPTH.x + 4} ${h + 2}`} aria-hidden>
        <defs>
          <pattern id={`hatch${id}`} width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)">
            <line x1="0" y1="0" x2="0" y2="10" stroke={INK} strokeOpacity="0.35" strokeWidth="3" />
          </pattern>
        </defs>
        <g fill="none" stroke={INK} strokeOpacity="0.55" strokeWidth="2.6" strokeDasharray="9 7" strokeLinecap="round">
          <polygon points={side} fill={`url(#hatch${id})`} fillOpacity="0.5" />
          <rect x={STROKE / 2} y={STROKE / 2} width={w - STROKE} height={h - STROKE} rx="8" fill={`url(#hatch${id})`} />
          <rect x={label.x} y={label.y} width={label.w} height={label.h} rx="2.5" />
          <circle cx={hole.cx} cy={hole.cy} r={hole.r} />
        </g>
      </svg>
    );
  }

  const sideFill = shade(color, -0.3);
  return (
    <svg className="shelfBinder" width={w + DEPTH.x + 30} height={h + 12} viewBox={`0 0 ${w + DEPTH.x + 30} ${h + 12}`} aria-hidden>
      <defs>
        <linearGradient id={`spine${id}`} x1="0" x2="1">
          <stop offset="0" stopColor={shade(color, 0.14)} />
          <stop offset="0.5" stopColor={color} />
          <stop offset="1" stopColor={shade(color, -0.08)} />
        </linearGradient>
        <linearGradient id={`side${id}`} x1="0" x2="1">
          <stop offset="0" stopColor={sideFill} />
          <stop offset="1" stopColor={shade(color, -0.42)} />
        </linearGradient>
        <linearGradient id={`ao${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#281830" stopOpacity="0" />
          <stop offset="1" stopColor="#281830" stopOpacity="0.28" />
        </linearGradient>
        <filter id={`soft${id}`} x="-50%" y="-20%" width="200%" height="140%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>

      {last && (
        <>
          {/* shadow on the wall, the room light comes from the left */}
          <polygon
            points={`${w},${18} ${w + DEPTH.x + 22},${DEPTH.y + 16} ${w + DEPTH.x + 24},${h - 2} ${w},${h}`}
            fill="#3a2850"
            opacity="0.3"
            filter={`url(#soft${id})`}
          />
          <polygon points={side} fill={`url(#side${id})`} stroke={INK} strokeWidth={STROKE} strokeLinejoin="round" />
        </>
      )}

      {/* spine */}
      <rect
        x={STROKE / 2}
        y={STROKE / 2}
        width={w - STROKE}
        height={h - STROKE}
        rx="8"
        fill={`url(#spine${id})`}
        stroke={INK}
        strokeWidth={STROKE}
      />
      {/* ground contact */}
      <rect x={STROKE} y={h * 0.8} width={w - STROKE * 2} height={h * 0.2 - STROKE} rx="6" fill={`url(#ao${id})`} />
      {/* light on the left edge, fold of the cover on the right */}
      <line x1="8" y1="12" x2="8" y2={h - 14} stroke="#fff" strokeOpacity="0.22" strokeWidth="3" strokeLinecap="round" />
      <line x1={w - 11} y1="7" x2={w - 11} y2={h - 7} stroke={INK} strokeOpacity="0.4" strokeWidth="2" />

      {/* label */}
      <rect x={label.x} y={label.y} width={label.w} height={label.h} rx="2.5" fill="#eee8ea" stroke={INK} strokeWidth="2.6" />
      <line x1={label.x + 3} y1={label.y + 4} x2={label.x + label.w - 3} y2={label.y + 4} stroke="#b8aab4" strokeWidth="2" />

      {/* finger hole */}
      <circle cx={hole.cx} cy={hole.cy} r={hole.r} fill="#ddd4d8" stroke={INK} strokeWidth="2.6" />
      <circle cx={hole.cx} cy={hole.cy} r={hole.r * 0.62} fill="#4b4452" stroke={INK} strokeWidth="1.6" />
      <path
        d={`M ${hole.cx - hole.r * 0.45} ${hole.cy - hole.r * 0.2} a ${hole.r * 0.5} ${hole.r * 0.5} 0 0 1 ${hole.r * 0.5} ${-hole.r * 0.3}`}
        fill="none"
        stroke="#fff"
        strokeOpacity="0.35"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
