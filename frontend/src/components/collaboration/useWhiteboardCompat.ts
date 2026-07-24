'use client';

/**
 * Compatibility shim that lets new components import a stable
 * `drawOnCanvas` method without breaking the legacy `useWhiteboard` API.
 *
 * The original hook:
 *   - returns event handlers (`startDrawing`, `draw`, `stopDrawing`) for
 *     attaching to a `<canvas>`,
 *   - listens on `socket.on('whiteboard-update')` for remote ops,
 *   - exposes `clearCanvas()` for both local and remote clears.
 *
 * We add a `drawOnCanvas(drawData)` method that straight-line draws a single
 * op onto the canvas. This is needed by the persistence flow which replays
 * saved ops back into the live canvas when a session is loaded.
 */

import { useCallback, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';

export type DrawTool = 'pen' | 'eraser' | 'line' | 'rectangle' | 'circle' | 'text';

export interface DrawData {
  tool: DrawTool;
  color: string;
  lineWidth: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  text?: string;
}

export function useWhiteboard(socket: Socket | null, roomId: string) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<DrawTool>('pen');
  const [color, setColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(2);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });

  const drawOnCanvas = useCallback((drawData: DrawData) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = drawData.color;
    ctx.lineWidth = drawData.lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    switch (drawData.tool) {
      case 'pen':
        ctx.beginPath();
        ctx.moveTo(drawData.startX, drawData.startY);
        ctx.lineTo(drawData.endX, drawData.endY);
        ctx.stroke();
        break;
      case 'eraser':
        ctx.clearRect(
          drawData.endX - drawData.lineWidth / 2,
          drawData.endY - drawData.lineWidth / 2,
          drawData.lineWidth,
          drawData.lineWidth
        );
        break;
      case 'line':
        ctx.beginPath();
        ctx.moveTo(drawData.startX, drawData.startY);
        ctx.lineTo(drawData.endX, drawData.endY);
        ctx.stroke();
        break;
      case 'rectangle':
        ctx.strokeRect(
          drawData.startX,
          drawData.startY,
          drawData.endX - drawData.startX,
          drawData.endY - drawData.startY
        );
        break;
      case 'circle': {
        const radius = Math.sqrt(
          (drawData.endX - drawData.startX) ** 2 +
            (drawData.endY - drawData.startY) ** 2
        );
        ctx.beginPath();
        ctx.arc(drawData.startX, drawData.startY, radius, 0, 2 * Math.PI);
        ctx.stroke();
        break;
      }
      case 'text':
        if (drawData.text) {
          ctx.font = `${drawData.lineWidth * 10}px Arial`;
          ctx.fillStyle = drawData.color;
          ctx.fillText(drawData.text, drawData.startX, drawData.startY);
        }
        break;
    }
  }, []);

  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    setStartPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setIsDrawing(true);
  }, []);

  const draw = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (isDrawing) {
        const data: DrawData = {
          tool,
          color,
          lineWidth,
          startX: startPos.x,
          startY: startPos.y,
          endX: x,
          endY: y,
        };
        if (tool === 'pen' || tool === 'eraser') {
          drawOnCanvas(data);
          setStartPos({ x, y });
          socket?.emit('whiteboard-draw', { roomId, drawData: data });
        }
      }
    },
    [color, drawOnCanvas, isDrawing, lineWidth, roomId, socket, startPos.x, startPos.y, tool]
  );

  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
  }, []);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    socket?.emit('whiteboard-clear', { roomId });
  }, [roomId, socket]);

  return {
    canvasRef,
    tool,
    setTool,
    color,
    setColor,
    lineWidth,
    setLineWidth,
    startDrawing,
    draw,
    stopDrawing,
    clearCanvas,
    drawOnCanvas,
  };
}
