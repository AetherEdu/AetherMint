import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface InteractiveDiagramProps {
  diagramType: 'flowchart' | 'mindmap' | 'network' | 'hierarchy' | 'timeline';
  title: string;
  data: DiagramData;
  onNodeClick?: (node: DiagramNode) => void;
  onConnectionClick?: (connection: DiagramConnection) => void;
  editable?: boolean;
  accessibilityMode?: boolean;
}

export interface DiagramNode {
  id: string;
  label: string;
  x: number;
  y: number;
  type: 'start' | 'process' | 'decision' | 'end' | 'data' | 'concept';
  color?: string;
  description?: string;
  connections?: string[];
}

export interface DiagramConnection {
  id: string;
  from: string;
  to: string;
  label?: string;
  type: 'solid' | 'dashed' | 'arrow';
}

export interface DiagramData {
  nodes: DiagramNode[];
  connections: DiagramConnection[];
}

const InteractiveDiagram: React.FC<InteractiveDiagramProps> = ({
  diagramType,
  title,
  data,
  onNodeClick,
  onConnectionClick,
  editable = false,
  accessibilityMode = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedNode, setSelectedNode] = useState<DiagramNode | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<DiagramConnection | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedNode, setDraggedNode] = useState<DiagramNode | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [animationSpeed, setAnimationSpeed] = useState(1);

  const nodeColors = {
    start: '#10b981',
    process: '#3b82f6',
    decision: '#f59e0b',
    end: '#ef4444',
    data: '#8b5cf6',
    concept: '#06b6d4'
  };

  const drawNode = useCallback((ctx: CanvasRenderingContext2D, node: DiagramNode, isSelected: boolean) => {
    ctx.save();
    ctx.translate(pan.x + node.x * zoom, pan.y + node.y * zoom);
    ctx.scale(zoom, zoom);

    const color = node.color || nodeColors[node.type];
    
    // Draw shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    // Draw node based on type
    ctx.fillStyle = color;
    ctx.strokeStyle = isSelected ? '#1f2937' : color;
    ctx.lineWidth = isSelected ? 3 : 2;

    switch (node.type) {
      case 'start':
      case 'end':
        ctx.beginPath();
        ctx.arc(0, 0, 30, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
      
      case 'decision':
        ctx.beginPath();
        ctx.moveTo(0, -30);
        ctx.lineTo(30, 0);
        ctx.lineTo(0, 30);
        ctx.lineTo(-30, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      
      case 'data':
        ctx.beginPath();
        ctx.moveTo(-25, -30);
        ctx.lineTo(25, -30);
        ctx.lineTo(35, 30);
        ctx.lineTo(-35, 30);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      
      default:
        ctx.beginPath();
        ctx.roundRect(-40, -25, 80, 50, 5);
        ctx.fill();
        ctx.stroke();
        break;
    }

    // Draw label
    if (showLabels) {
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Truncate label if too long
      const maxLength = 10;
      const label = node.label.length > maxLength 
        ? node.label.substring(0, maxLength) + '...' 
        : node.label;
      
      ctx.fillText(label, 0, 0);
    }

    ctx.restore();
  }, [pan, zoom, showLabels, nodeColors]);

  const drawConnection = useCallback((ctx: CanvasRenderingContext2D, connection: DiagramConnection, isSelected: boolean) => {
    const fromNode = data.nodes.find(n => n.id === connection.from);
    const toNode = data.nodes.find(n => n.id === connection.to);
    
    if (!fromNode || !toNode) return;

    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    const fromX = fromNode.x;
    const fromY = fromNode.y;
    const toX = toNode.x;
    const toY = toNode.y;

    ctx.strokeStyle = isSelected ? '#1f2937' : '#6b7280';
    ctx.lineWidth = isSelected ? 3 : 2;

    // Set line style
    if (connection.type === 'dashed') {
      ctx.setLineDash([5, 5]);
    } else {
      ctx.setLineDash([]);
    }

    // Draw line
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    
    if (diagramType === 'flowchart') {
      // Draw orthogonal lines for flowcharts
      const midX = (fromX + toX) / 2;
      ctx.lineTo(midX, fromY);
      ctx.lineTo(midX, toY);
      ctx.lineTo(toX, toY);
    } else {
      // Draw curved lines for other types
      const controlX = (fromX + toX) / 2;
      const controlY = (fromY + toY) / 2 - 50;
      ctx.quadraticCurveTo(controlX, controlY, toX, toY);
    }
    
    ctx.stroke();

    // Draw arrow
    if (connection.type === 'arrow') {
      const angle = Math.atan2(toY - fromY, toX - fromX);
      const arrowLength = 10;
      const arrowAngle = Math.PI / 6;
      
      ctx.beginPath();
      ctx.moveTo(toX, toY);
      ctx.lineTo(
        toX - arrowLength * Math.cos(angle - arrowAngle),
        toY - arrowLength * Math.sin(angle - arrowAngle)
      );
      ctx.moveTo(toX, toY);
      ctx.lineTo(
        toX - arrowLength * Math.cos(angle + arrowAngle),
        toY - arrowLength * Math.sin(angle + arrowAngle)
      );
      ctx.stroke();
    }

    // Draw label
    if (showLabels && connection.label) {
      ctx.fillStyle = '#374151';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      const labelX = (fromX + toX) / 2;
      const labelY = (fromY + toY) / 2;
      
      // Draw background for label
      const metrics = ctx.measureText(connection.label);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fillRect(labelX - metrics.width / 2 - 4, labelY - 8, metrics.width + 8, 16);
      
      ctx.fillStyle = '#374151';
      ctx.fillText(connection.label, labelX, labelY);
    }

    ctx.restore();
  }, [data.nodes, pan, zoom, showLabels, diagramType]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    
    for (let x = 0; x < canvas.width; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    
    for (let y = 0; y < canvas.height; y += 50) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Draw connections
    data.connections.forEach(connection => {
      drawConnection(ctx, connection, selectedConnection?.id === connection.id);
    });

    // Draw nodes
    data.nodes.forEach(node => {
      drawNode(ctx, node, selectedNode?.id === node.id);
    });
  }, [data, selectedNode, selectedConnection, drawNode, drawConnection]);

  useEffect(() => {
    draw();
  }, [draw]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x) / zoom;
    const y = (e.clientY - rect.top - pan.y) / zoom;

    // Check if a node was clicked
    const clickedNode = data.nodes.find(node => {
      const distance = Math.sqrt(Math.pow(x - node.x, 2) + Math.pow(y - node.y, 2));
      return distance <= 40;
    });

    if (clickedNode) {
      setSelectedNode(clickedNode);
      setSelectedConnection(null);
      onNodeClick?.(clickedNode);
    } else {
      // Check if a connection was clicked
      const clickedConnection = data.connections.find(connection => {
        const fromNode = data.nodes.find(n => n.id === connection.from);
        const toNode = data.nodes.find(n => n.id === connection.to);
        
        if (!fromNode || !toNode) return false;

        // Simple distance to line check
        const distance = pointToLineDistance(
          { x, y },
          { x: fromNode.x, y: fromNode.y },
          { x: toNode.x, y: toNode.y }
        );
        
        return distance <= 5;
      });

      if (clickedConnection) {
        setSelectedConnection(clickedConnection);
        setSelectedNode(null);
        onConnectionClick?.(clickedConnection);
      } else {
        setSelectedNode(null);
        setSelectedConnection(null);
      }
    }
  }, [data, pan, zoom, onNodeClick, onConnectionClick]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x) / zoom;
    const y = (e.clientY - rect.top - pan.y) / zoom;

    const clickedNode = data.nodes.find(node => {
      const distance = Math.sqrt(Math.pow(x - node.x, 2) + Math.pow(y - node.y, 2));
      return distance <= 40;
    });

    if (clickedNode && editable) {
      setIsDragging(true);
      setDraggedNode(clickedNode);
    } else if (e.shiftKey) {
      setIsPanning(true);
      setMousePos({ x: e.clientX, y: e.clientY });
    }
  }, [data, pan, zoom, editable]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging && draggedNode && editable) {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left - pan.x) / zoom;
      const y = (e.clientY - rect.top - pan.y) / zoom;

      // Update node position
      const updatedNodes = data.nodes.map(node => 
        node.id === draggedNode.id ? { ...node, x, y } : node
      );
      
      // This would typically update state in a parent component
      // For now, we'll just update the local dragged node
      setDraggedNode({ ...draggedNode, x, y });
    } else if (isPanning) {
      const deltaX = e.clientX - mousePos.x;
      const deltaY = e.clientY - mousePos.y;
      setPan(prev => ({ x: prev.x + deltaX, y: prev.y + deltaY }));
      setMousePos({ x: e.clientX, y: e.clientY });
    }
  }, [isDragging, draggedNode, isPanning, mousePos, pan, zoom, editable]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDraggedNode(null);
    setIsPanning(false);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.max(0.5, Math.min(3, prev * delta)));
  }, []);

  const pointToLineDistance = (point: { x: number; y: number }, lineStart: { x: number; y: number }, lineEnd: { x: number; y: number }) => {
    const A = point.x - lineStart.x;
    const B = point.y - lineStart.y;
    const C = lineEnd.x - lineStart.x;
    const D = lineEnd.y - lineStart.y;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;

    if (lenSq !== 0) param = dot / lenSq;

    let xx, yy;

    if (param < 0) {
      xx = lineStart.x;
      yy = lineStart.y;
    } else if (param > 1) {
      xx = lineEnd.x;
      yy = lineEnd.y;
    } else {
      xx = lineStart.x + param * C;
      yy = lineStart.y + param * D;
    }

    const dx = point.x - xx;
    const dy = point.y - yy;

    return Math.sqrt(dx * dx + dy * dy);
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const exportAsImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `${title}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">{title}</h2>
        <p className="text-gray-600">Interactive {diagramType} diagram</p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 mb-4">
        <button
          onClick={() => setShowLabels(!showLabels)}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          {showLabels ? 'Hide Labels' : 'Show Labels'}
        </button>
        
        <button
          onClick={resetView}
          className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
        >
          Reset View
        </button>
        
        <button
          onClick={exportAsImage}
          className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
        >
          Export as Image
        </button>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Zoom:</label>
          <input
            type="range"
            min="0.5"
            max="3"
            step="0.1"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="w-32"
          />
          <span className="text-sm text-gray-600">{Math.round(zoom * 100)}%</span>
        </div>
      </div>

      {/* Canvas */}
      <div className="border border-gray-300 rounded-lg overflow-hidden">
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          className="cursor-move"
          onClick={handleCanvasClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          aria-label={`${title} interactive diagram`}
        />
      </div>

      {/* Instructions */}
      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold text-gray-800 mb-2">Instructions:</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Click on nodes to select and view details</li>
          <li>• Click on connections to select them</li>
          {editable && <li>• Drag nodes to reposition them</li>}
          <li>• Hold Shift and drag to pan the canvas</li>
          <li>• Use mouse wheel to zoom in/out</li>
        </ul>
      </div>

      {/* Selected Node/Connection Info */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg"
          >
            <h3 className="font-semibold text-blue-800 mb-2">Selected Node:</h3>
            <p className="text-blue-700"><strong>ID:</strong> {selectedNode.id}</p>
            <p className="text-blue-700"><strong>Label:</strong> {selectedNode.label}</p>
            <p className="text-blue-700"><strong>Type:</strong> {selectedNode.type}</p>
            {selectedNode.description && (
              <p className="text-blue-700"><strong>Description:</strong> {selectedNode.description}</p>
            )}
          </motion.div>
        )}

        {selectedConnection && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg"
          >
            <h3 className="font-semibold text-green-800 mb-2">Selected Connection:</h3>
            <p className="text-green-700"><strong>From:</strong> {selectedConnection.from}</p>
            <p className="text-green-700"><strong>To:</strong> {selectedConnection.to}</p>
            {selectedConnection.label && (
              <p className="text-green-700"><strong>Label:</strong> {selectedConnection.label}</p>
            )}
            <p className="text-green-700"><strong>Type:</strong> {selectedConnection.type}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default InteractiveDiagram;
