/**
 * Canvas export utilities (PNG + SVG).
 *
 * - PNG: drawn to an offscreen canvas at the session's declared width/height.
 * - SVG: serialized using `<line>` and `<path>` elements. Text/styling
 *   carries through for a crisp, scalable export.
 *
 * We intentionally do not touch the source canvas — we replay the saved ops
 * into a fresh context so partial / in-progress state does not bleed into
 * the rendition.
 */

import type { WhiteboardOp } from '../types/whiteboardSession';

export interface ExportPngOptions {
  width: number;
  height: number;
  background?: string;
  /** Padding around the content in px. Defaults to 0. */
  padding?: number;
}

export async function exportOpsAsPng(
  ops: ReadonlyArray<WhiteboardOp>,
  options: ExportPngOptions
): Promise<Blob> {
  const { width, height, background = '#ffffff', padding = 0 } = options;
  const canvas = document.createElement('canvas');
  canvas.width = width + padding * 2;
  canvas.height = height + padding * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable in this browser');

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.translate(padding, padding);

  drawOps(ctx, ops);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to encode PNG'));
    }, 'image/png');
  });
}

export function exportOpsAsSvg(ops: ReadonlyArray<WhiteboardOp>, options: ExportPngOptions): string {
  const { width, height, padding = 0 } = options;
  const totalWidth = width + padding * 2;
  const totalHeight = height + padding * 2;

  const segments: string[] = [];
  let textNodes: string[] = [];

  for (const op of ops) {
    if (op.points.length === 0) continue;
    const stroke = op.color ?? '#000000';
    const strokeWidth = op.width;
    switch (op.tool) {
      case 'pen':
      case 'eraser': {
        if (op.points.length === 1) {
          segments.push(
            `<circle cx="${num(op.points[0].x)}" cy="${num(op.points[0].y)}" r="${strokeWidth / 2}" fill="${escapeAttr(stroke)}" />`
          );
        } else {
          segments.push(
            `<polyline points="${op.points
              .map((p) => `${num(p.x)},${num(p.y)}`)
              .join(' ')}" fill="none" stroke="${escapeAttr(stroke)}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" />`
          );
        }
        break;
      }
      case 'line': {
        const [start, end] = op.points;
        if (!start || !end) continue;
        segments.push(
          `<line x1="${num(start.x)}" y1="${num(start.y)}" x2="${num(end.x)}" y2="${num(end.y)}" stroke="${escapeAttr(stroke)}" stroke-width="${strokeWidth}" stroke-linecap="round" />`
        );
        break;
      }
      case 'rectangle': {
        const [start, end] = op.points;
        if (!start || !end) continue;
        const x = Math.min(start.x, end.x);
        const y = Math.min(start.y, end.y);
        const w = Math.abs(end.x - start.x);
        const h = Math.abs(end.y - start.y);
        segments.push(
          `<rect x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}" fill="none" stroke="${escapeAttr(stroke)}" stroke-width="${strokeWidth}" />`
        );
        break;
      }
      case 'circle': {
        const [start, end] = op.points;
        if (!start || !end) continue;
        const r = Math.hypot(end.x - start.x, end.y - start.y);
        segments.push(
          `<circle cx="${num(start.x)}" cy="${num(start.y)}" r="${num(r)}" fill="none" stroke="${escapeAttr(stroke)}" stroke-width="${strokeWidth}" />`
        );
        break;
      }
      case 'text': {
        const anchor = op.points[0];
        if (!anchor || !op.text) continue;
        // Escape XML entities and preserve newlines.
        const lines = op.text.split('\n');
        textNodes = textNodes.concat(
          lines.map(
            (line, i) =>
              `<text x="${num(anchor.x)}" y="${num(anchor.y) + i * (strokeWidth * 12)}" fill="${escapeAttr(stroke)}" font-size="${strokeWidth * 10}" font-family="Inter, Arial, sans-serif">${escapeText(line)}</text>`
          )
        );
        break;
      }
    }
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}">`,
    `<rect width="100%" height="100%" fill="#ffffff" />`,
    `<g transform="translate(${padding},${padding})">`,
    ...segments,
    ...textNodes,
    '</g>',
    '</svg>',
  ].join('\n');
}

/**
 * Replay `ops` onto an existing 2d context. Used by both the live canvas and
 * the offscreen export canvas so the visuals match exactly.
 */
export function drawOps(ctx: CanvasRenderingContext2D, ops: ReadonlyArray<WhiteboardOp>): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const op of ops) {
    if (op.points.length === 0) continue;
    ctx.strokeStyle = op.color ?? '#000000';
    ctx.fillStyle = op.color ?? '#000000';
    ctx.lineWidth = op.width;
    switch (op.tool) {
      case 'pen':
        if (op.points.length > 1) {
          ctx.beginPath();
          ctx.moveTo(op.points[0].x, op.points[0].y);
          for (let i = 1; i < op.points.length; i++) ctx.lineTo(op.points[i].x, op.points[i].y);
          ctx.stroke();
        }
        break;
      case 'eraser':
        // Eraser draws in destination-out — easier to emulate by clearing
        // the surrounding rectangle.
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        if (op.points.length > 1) {
          ctx.moveTo(op.points[0].x, op.points[0].y);
          for (let i = 1; i < op.points.length; i++) ctx.lineTo(op.points[i].x, op.points[i].y);
        } else {
          ctx.arc(op.points[0].x, op.points[0].y, op.width / 2, 0, Math.PI * 2);
        }
        ctx.lineWidth = op.width;
        ctx.stroke();
        ctx.restore();
        break;
      case 'line':
        if (op.points.length >= 2) {
          ctx.beginPath();
          ctx.moveTo(op.points[0].x, op.points[0].y);
          ctx.lineTo(op.points[1].x, op.points[1].y);
          ctx.stroke();
        }
        break;
      case 'rectangle':
        if (op.points.length >= 2) {
          const x = Math.min(op.points[0].x, op.points[1].x);
          const y = Math.min(op.points[0].y, op.points[1].y);
          const w = Math.abs(op.points[1].x - op.points[0].x);
          const h = Math.abs(op.points[1].y - op.points[0].y);
          ctx.strokeRect(x, y, w, h);
        }
        break;
      case 'circle':
        if (op.points.length >= 2) {
          const r = Math.hypot(op.points[1].x - op.points[0].x, op.points[1].y - op.points[0].y);
          ctx.beginPath();
          ctx.arc(op.points[0].x, op.points[0].y, r, 0, Math.PI * 2);
          ctx.stroke();
        }
        break;
      case 'text':
        if (op.points.length >= 1 && op.text) {
          ctx.font = `${op.width * 10}px Inter, Arial, sans-serif`;
          const lines = op.text.split('\n');
          lines.forEach((line, i) => {
            ctx.fillText(line, op.points[0].x, op.points[0].y + i * (op.width * 12));
          });
        }
        break;
    }
  }
}

function num(value: number): string {
  // SVG accepts well-formed numbers; round to 2 decimals.
  return Number.isFinite(value) ? Number(value).toFixed(2) : '0';
}

function escapeAttr(value: string): string {
  return value.replace(/[&"<>]/g, (c) => `&#${c.charCodeAt(0)};`);
}

function escapeText(value: string): string {
  return value.replace(/[&<>]/g, (c) => `&#${c.charCodeAt(0)};`);
}
