'use client';

import React from 'react';
import { Pencil, Eraser, Minus, Square, Circle, Type, Trash2 } from 'lucide-react';
import { DrawTool } from '@/hooks/useWhiteboard';

interface WhiteboardProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  tool: DrawTool;
  setTool: (tool: DrawTool) => void;
  color: string;
  setColor: (color: string) => void;
  lineWidth: number;
  setLineWidth: (width: number) => void;
  startDrawing: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  draw: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  stopDrawing: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  clearCanvas: () => void;
}

const Whiteboard: React.FC<WhiteboardProps> = ({
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
  clearCanvas
}) => {
  const tools: { name: DrawTool; icon: React.ReactNode; label: string }[] = [
    { name: 'pen', icon: <Pencil className="w-5 h-5" />, label: 'Pen' },
    { name: 'eraser', icon: <Eraser className="w-5 h-5" />, label: 'Eraser' },
    { name: 'line', icon: <Minus className="w-5 h-5" />, label: 'Line' },
    { name: 'rectangle', icon: <Square className="w-5 h-5" />, label: 'Rectangle' },
    { name: 'circle', icon: <Circle className="w-5 h-5" />, label: 'Circle' },
    { name: 'text', icon: <Type className="w-5 h-5" />, label: 'Text' }
  ];

  const colors = [
    '#000000', '#FF0000', '#00FF00', '#0000FF',
    '#FFFF00', '#FF00FF', '#00FFFF', '#FFFFFF'
  ];

  return (
    <div className="w-full h-full flex flex-col bg-gray-900">
      {/* Toolbar */}
      <div className="bg-gray-800 p-4 flex items-center gap-4 border-b border-gray-700">
        {/* Drawing tools */}
        <div className="flex gap-2">
          {tools.map((t) => (
            <button
              key={t.name}
              onClick={() => setTool(t.name)}
              className={`p-2 rounded-lg transition-colors ${
                tool === t.name
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              title={t.label}
            >
              {t.icon}
            </button>
          ))}
        </div>

        <div className="w-px h-8 bg-gray-700" />

        {/* Color picker */}
        <div className="flex gap-2 items-center">
          <span className="text-sm text-gray-400">Color:</span>
          <div className="flex gap-1">
            {colors.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-8 h-8 rounded border-2 transition-all ${
                  color === c ? 'border-blue-500 scale-110' : 'border-gray-600'
                }`}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer"
          />
        </div>

        <div className="w-px h-8 bg-gray-700" />

        {/* Line width */}
        <div className="flex gap-2 items-center">
          <span className="text-sm text-gray-400">Size:</span>
          <input
            type="range"
            min="1"
            max="20"
            value={lineWidth}
            onChange={(e) => setLineWidth(Number(e.target.value))}
            className="w-32"
          />
          <span className="text-sm text-gray-300 w-8">{lineWidth}px</span>
        </div>

        <div className="flex-1" />

        {/* Clear button */}
        <button
          onClick={clearCanvas}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
        >
          <Trash2 className="w-5 h-5" />
          Clear
        </button>
      </div>

      {/* Canvas */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        <canvas
          ref={canvasRef}
          width={1920}
          height={1080}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          className="bg-white rounded-lg shadow-2xl cursor-crosshair max-w-full max-h-full"
          style={{ touchAction: 'none' }}
        />
      </div>
    </div>
  );
};

export default Whiteboard;
