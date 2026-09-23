import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface CollaborativeWhiteboardProps {
  whiteboardId: string;
  userId: string;
  title: string;
  readOnly?: boolean;
  collaborationEnabled?: boolean;
  onWhiteboardUpdate?: (data: WhiteboardData) => void;
  onUserJoin?: (user: WhiteboardUser) => void;
  onUserLeave?: (userId: string) => void;
  accessibilityMode?: boolean;
}

export interface WhiteboardUser {
  id: string;
  name: string;
  avatar?: string;
  color: string;
  cursor?: { x: number; y: number };
  isActive: boolean;
}

export interface DrawingElement {
  id: string;
  type: 'pen' | 'line' | 'rectangle' | 'circle' | 'text' | 'image' | 'sticky';
  userId: string;
  timestamp: number;
  data: any;
  style: {
    color: string;
    strokeWidth: number;
    fill?: string;
    fontSize?: number;
    fontFamily?: string;
  };
}

export interface WhiteboardData {
  elements: DrawingElement[];
  users: WhiteboardUser[];
  version: number;
  lastModified: Date;
}

const CollaborativeWhiteboard: React.FC<CollaborativeWhiteboardProps> = ({
  whiteboardId,
  userId,
  title,
  readOnly = false,
  collaborationEnabled = true,
  onWhiteboardUpdate,
  onUserJoin,
  onUserLeave,
  accessibilityMode = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentTool, setCurrentTool] = useState<'pen' | 'line' | 'rectangle' | 'circle' | 'text' | 'eraser'>('pen');
  const [currentColor, setCurrentColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [elements, setElements] = useState<DrawingElement[]>([]);
  const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[]>([]);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [users, setUsers] = useState<WhiteboardUser[]>([]);
  const [selectedElement, setSelectedElement] = useState<DrawingElement | null>(null);
  const [showUserCursors, setShowUserCursors] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [history, setHistory] = useState<DrawingElement[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });

  // Mock user data - in real app, this would come from WebSocket/real-time service
  useEffect(() => {
    const mockUsers: WhiteboardUser[] = [
      {
        id: userId,
        name: 'You',
        color: '#3b82f6',
        isActive: true
      },
      ...(collaborationEnabled ? [
        {
          id: 'user2',
          name: 'Alice',
          color: '#ef4444',
          isActive: true,
          cursor: { x: 200, y: 150 }
        },
        {
          id: 'user3',
          name: 'Bob',
          color: '#10b981',
          isActive: true,
          cursor: { x: 400, y: 300 }
        }
      ] : [])
    ];
    
    setUsers(mockUsers);
  }, [userId, collaborationEnabled]);

  const drawElement = useCallback((ctx: CanvasRenderingContext2D, element: DrawingElement) => {
    ctx.save();
    ctx.strokeStyle = element.style.color;
    ctx.lineWidth = element.style.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    switch (element.type) {
      case 'pen':
        if (element.data.path && element.data.path.length > 0) {
          ctx.beginPath();
          ctx.moveTo(element.data.path[0].x, element.data.path[0].y);
          element.data.path.forEach((point: { x: number; y: number }) => {
            ctx.lineTo(point.x, point.y);
          });
          ctx.stroke();
        }
        break;

      case 'line':
        if (element.data.start && element.data.end) {
          ctx.beginPath();
          ctx.moveTo(element.data.start.x, element.data.start.y);
          ctx.lineTo(element.data.end.x, element.data.end.y);
          ctx.stroke();
        }
        break;

      case 'rectangle':
        if (element.data.start && element.data.end) {
          ctx.beginPath();
          const width = element.data.end.x - element.data.start.x;
          const height = element.data.end.y - element.data.start.y;
          ctx.rect(element.data.start.x, element.data.start.y, width, height);
          ctx.stroke();
          if (element.style.fill) {
            ctx.fillStyle = element.style.fill;
            ctx.fill();
          }
        }
        break;

      case 'circle':
        if (element.data.center && element.data.radius) {
          ctx.beginPath();
          ctx.arc(element.data.center.x, element.data.center.y, element.data.radius, 0, Math.PI * 2);
          ctx.stroke();
          if (element.style.fill) {
            ctx.fillStyle = element.style.fill;
            ctx.fill();
          }
        }
        break;

      case 'text':
        if (element.data.text && element.data.position) {
          ctx.font = `${element.style.fontSize || 16}px ${element.style.fontFamily || 'Arial'}`;
          ctx.fillStyle = element.style.color;
          ctx.fillText(element.data.text, element.data.position.x, element.data.position.y);
        }
        break;

      case 'sticky':
        if (element.data.position && element.data.text) {
          // Draw sticky note background
          ctx.fillStyle = '#fef3c7';
          const width = 150;
          const height = 100;
          ctx.fillRect(element.data.position.x, element.data.position.y, width, height);
          
          // Draw border
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 2;
          ctx.strokeRect(element.data.position.x, element.data.position.y, width, height);
          
          // Draw text
          ctx.fillStyle = '#92400e';
          ctx.font = '14px Arial';
          const lines = element.data.text.split('\n');
          lines.forEach((line: string, index: number) => {
            ctx.fillText(line, element.data.position.x + 10, element.data.position.y + 20 + index * 18);
          });
        }
        break;
    }

    ctx.restore();
  }, []);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw grid
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    const gridSize = 20;
    
    for (let x = 0; x < canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    
    for (let y = 0; y < canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Draw all elements
    elements.forEach(element => {
      drawElement(ctx, element);
    });

    // Draw current path being drawn
    if (isDrawing && currentPath.length > 0) {
      ctx.strokeStyle = currentColor;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(currentPath[0].x, currentPath[0].y);
      currentPath.forEach(point => {
        ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();
    }
  }, [elements, isDrawing, currentPath, currentColor, strokeWidth, drawElement]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  const getMousePos = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - pan.x) / zoom,
      y: (e.clientY - rect.top - pan.y) / zoom
    };
  }, [pan, zoom]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (readOnly) return;

    const pos = getMousePos(e);
    
    if (e.shiftKey || e.button === 1) {
      setIsPanning(true);
      setLastPanPoint({ x: e.clientX, y: e.clientY });
      return;
    }

    setIsDrawing(true);
    setStartPoint(pos);

    if (currentTool === 'pen' || currentTool === 'eraser') {
      setCurrentPath([pos]);
    }
  }, [readOnly, currentTool, getMousePos]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e);

    if (isPanning) {
      const deltaX = e.clientX - lastPanPoint.x;
      const deltaY = e.clientY - lastPanPoint.y;
      setPan(prev => ({ x: prev.x + deltaX, y: prev.y + deltaY }));
      setLastPanPoint({ x: e.clientX, y: e.clientY });
      return;
    }

    if (!isDrawing || readOnly) return;

    if (currentTool === 'pen' || currentTool === 'eraser') {
      setCurrentPath(prev => [...prev, pos]);
    }
  }, [isDrawing, isPanning, currentTool, readOnly, getMousePos, lastPanPoint]);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (!isDrawing || readOnly) return;

    const pos = getMousePos(e);
    const currentUser = users.find(u => u.id === userId);
    const userColor = currentUser?.color || '#000000';

    let newElement: DrawingElement | null = null;

    switch (currentTool) {
      case 'pen':
        if (currentPath.length > 0) {
          newElement = {
            id: Date.now().toString(),
            type: 'pen',
            userId,
            timestamp: Date.now(),
            data: { path: currentPath },
            style: { color: currentColor, strokeWidth }
          };
        }
        break;

      case 'line':
        if (startPoint) {
          newElement = {
            id: Date.now().toString(),
            type: 'line',
            userId,
            timestamp: Date.now(),
            data: { start: startPoint, end: pos },
            style: { color: currentColor, strokeWidth }
          };
        }
        break;

      case 'rectangle':
        if (startPoint) {
          newElement = {
            id: Date.now().toString(),
            type: 'rectangle',
            userId,
            timestamp: Date.now(),
            data: { start: startPoint, end: pos },
            style: { color: currentColor, strokeWidth, fill: 'transparent' }
          };
        }
        break;

      case 'circle':
        if (startPoint) {
          const radius = Math.sqrt(
            Math.pow(pos.x - startPoint.x, 2) + Math.pow(pos.y - startPoint.y, 2)
          );
          newElement = {
            id: Date.now().toString(),
            type: 'circle',
            userId,
            timestamp: Date.now(),
            data: { center: startPoint, radius },
            style: { color: currentColor, strokeWidth, fill: 'transparent' }
          };
        }
        break;

      case 'eraser':
        if (currentPath.length > 0) {
          // Remove elements that intersect with eraser path
          const updatedElements = elements.filter(element => {
            // Simple check - in real implementation, would check actual intersection
            return !currentPath.some(point => 
              Math.abs(point.x - element.data.start?.x || 0) < 20 &&
              Math.abs(point.y - element.data.start?.y || 0) < 20
            );
          });
          setElements(updatedElements);
        }
        break;
    }

    if (newElement) {
      const updatedElements = [...elements, newElement];
      setElements(updatedElements);
      
      // Add to history
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(updatedElements);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
      
      onWhiteboardUpdate?.({
        elements: updatedElements,
        users,
        version: Date.now(),
        lastModified: new Date()
      });
    }

    setIsDrawing(false);
    setCurrentPath([]);
    setStartPoint(null);
  }, [isDrawing, isPanning, currentTool, startPoint, currentPath, elements, currentColor, strokeWidth, userId, users, history, historyIndex, getMousePos, onWhiteboardUpdate]);

  const addText = useCallback(() => {
    const text = prompt('Enter text:');
    if (!text) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const newElement: DrawingElement = {
      id: Date.now().toString(),
      type: 'text',
      userId,
      timestamp: Date.now(),
      data: { 
        text, 
        position: { x: canvas.width / 2, y: canvas.height / 2 } 
      },
      style: { 
        color: currentColor, 
        strokeWidth: 1, 
        fontSize: 16, 
        fontFamily: 'Arial' 
      }
    };

    const updatedElements = [...elements, newElement];
    setElements(updatedElements);
    
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(updatedElements);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    
    onWhiteboardUpdate?.({
      elements: updatedElements,
      users,
      version: Date.now(),
      lastModified: new Date()
    });
  }, [elements, currentColor, userId, users, history, historyIndex, onWhiteboardUpdate]);

  const addStickyNote = useCallback(() => {
    const text = prompt('Enter sticky note text:');
    if (!text) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const newElement: DrawingElement = {
      id: Date.now().toString(),
      type: 'sticky',
      userId,
      timestamp: Date.now(),
      data: { 
        text, 
        position: { x: canvas.width / 2 - 75, y: canvas.height / 2 - 50 } 
      },
      style: { 
        color: '#92400e', 
        strokeWidth: 2
      }
    };

    const updatedElements = [...elements, newElement];
    setElements(updatedElements);
    
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(updatedElements);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    
    onWhiteboardUpdate?.({
      elements: updatedElements,
      users,
      version: Date.now(),
      lastModified: new Date()
    });
  }, [elements, userId, users, history, historyIndex, onWhiteboardUpdate]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setElements(history[newIndex]);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setElements(history[newIndex]);
    }
  }, [history, historyIndex]);

  const clearCanvas = useCallback(() => {
    setElements([]);
    const newHistory = [...history, []];
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history]);

  const exportAsImage = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `${title}.png`;
    link.href = canvas.toDataURL();
    link.click();
  }, [title]);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom(prev => Math.max(0.1, Math.min(5, prev * delta)));
    }
  }, []);

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">{title}</h2>
        <p className="text-gray-600">
          Collaborative whiteboard {collaborationEnabled ? 'with real-time collaboration' : ''}
        </p>
      </div>

      {/* Active Users */}
      {collaborationEnabled && (
        <div className="mb-4 flex items-center gap-4">
          <span className="text-sm font-medium text-gray-700">Active Users:</span>
          <div className="flex gap-2">
            {users.map(user => (
              <div
                key={user.id}
                className="flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100"
                style={{ borderColor: user.color, borderWidth: 2 }}
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: user.color }}
                />
                <span className="text-sm text-gray-700">{user.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Toolbar */}
      {!readOnly && (
        <div className="mb-4 flex flex-wrap gap-2 p-4 bg-gray-50 rounded-lg">
          {/* Drawing Tools */}
          <div className="flex gap-2">
            {[
              { tool: 'pen' as const, icon: '✏️', label: 'Pen' },
              { tool: 'line' as const, icon: '📏', label: 'Line' },
              { tool: 'rectangle' as const, icon: '⬜', label: 'Rectangle' },
              { tool: 'circle' as const, icon: '⭕', label: 'Circle' },
              { tool: 'text' as const, icon: '📝', label: 'Text' },
              { tool: 'eraser' as const, icon: '🧹', label: 'Eraser' }
            ].map(({ tool, icon, label }) => (
              <button
                key={tool}
                onClick={() => setCurrentTool(tool)}
                className={`px-3 py-2 rounded-lg transition-colors ${
                  currentTool === tool
                    ? 'bg-blue-500 text-white'
                    : 'bg-white border border-gray-300 hover:bg-gray-50'
                }`}
                title={label}
              >
                {icon}
              </button>
            ))}
          </div>

          {/* Color Picker */}
          <input
            type="color"
            value={currentColor}
            onChange={(e) => setCurrentColor(e.target.value)}
            className="w-10 h-10 border border-gray-300 rounded cursor-pointer"
            title="Color"
          />

          {/* Stroke Width */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Width:</label>
            <input
              type="range"
              min="1"
              max="20"
              value={strokeWidth}
              onChange={(e) => setStrokeWidth(parseInt(e.target.value))}
              className="w-20"
            />
            <span className="text-sm text-gray-600">{strokeWidth}px</span>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={addStickyNote}
              className="px-3 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
              title="Add Sticky Note"
            >
              📋 Sticky
            </button>
            
            <button
              onClick={undo}
              disabled={historyIndex <= 0}
              className="px-3 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:bg-gray-300 transition-colors"
              title="Undo"
            >
              ↶ Undo
            </button>
            
            <button
              onClick={redo}
              disabled={historyIndex >= history.length - 1}
              className="px-3 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:bg-gray-300 transition-colors"
              title="Redo"
            >
              ↷ Redo
            </button>
            
            <button
              onClick={clearCanvas}
              className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              title="Clear"
            >
              🗑️ Clear
            </button>
            
            <button
              onClick={exportAsImage}
              className="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              title="Export"
            >
              💾 Export
            </button>
          </div>
        </div>
      )}

      {/* Canvas */}
      <div className="border border-gray-300 rounded-lg overflow-hidden mb-4">
        <canvas
          ref={canvasRef}
          width={1000}
          height={600}
          className="cursor-crosshair w-full"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          style={{ cursor: isPanning ? 'grabbing' : currentTool === 'eraser' ? 'grab' : 'crosshair' }}
          aria-label={`${title} collaborative whiteboard`}
        />
      </div>

      {/* Zoom Controls */}
      <div className="flex items-center gap-4 mb-4">
        <span className="text-sm text-gray-600">Zoom:</span>
        <button
          onClick={() => setZoom(prev => Math.max(0.1, prev * 0.8))}
          className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 transition-colors"
        >
          -
        </button>
        <span className="text-sm text-gray-600">{Math.round(zoom * 100)}%</span>
        <button
          onClick={() => setZoom(prev => Math.min(5, prev * 1.2))}
          className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 transition-colors"
        >
          +
        </button>
        <button
          onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
          className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 transition-colors"
        >
          Reset
        </button>
      </div>

      {/* Instructions */}
      <div className="p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold text-gray-800 mb-2">Instructions:</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Select a tool and start drawing on the canvas</li>
          <li>• Hold Shift + drag to pan the canvas</li>
          <li>• Ctrl/Cmd + scroll to zoom in/out</li>
          <li>• Use Undo/Redo buttons to navigate through history</li>
          <li>• Add sticky notes for text annotations</li>
          {collaborationEnabled && <li>• Other users' cursors and changes appear in real-time</li>}
        </ul>
      </div>
    </div>
  );
};

export default CollaborativeWhiteboard;
