import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface InteractiveTimelineMapProps {
  contentType: 'timeline' | 'map' | 'hybrid';
  title: string;
  description: string;
  data: TimelineData | MapData;
  onEventSelect?: (event: TimelineEvent | MapLocation) => void;
  onLocationSelect?: (location: MapLocation) => void;
  showNavigation?: boolean;
  accessibilityMode?: boolean;
}

export interface TimelineEvent {
  id: string;
  title: string;
  description: string;
  date: Date;
  category: string;
  importance: 'low' | 'medium' | 'high' | 'critical';
  media?: {
    type: 'image' | 'video' | 'audio';
    url: string;
    caption?: string;
  };
  location?: MapLocation;
  relatedEvents?: string[];
}

export interface TimelineData {
  events: TimelineEvent[];
  categories: string[];
  startDate: Date;
  endDate: Date;
}

export interface MapLocation {
  id: string;
  name: string;
  description: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  type: 'city' | 'landmark' | 'region' | 'country';
  events?: TimelineEvent[];
  media?: {
    type: 'image' | 'video' | 'audio';
    url: string;
    caption?: string;
  };
  historicalInfo?: {
    period: string;
    significance: string;
  };
}

export interface MapData {
  locations: MapLocation[];
  center: {
    lat: number;
    lng: number;
  };
  zoom: number;
  bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

const InteractiveTimelineMap: React.FC<InteractiveTimelineMapProps> = ({
  contentType,
  title,
  description,
  data,
  onEventSelect,
  onLocationSelect,
  showNavigation = true,
  accessibilityMode = false
}) => {
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<MapLocation | null>(null);
  const [currentDate, setCurrentDate] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<'timeline' | 'map' | 'both'>('both');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const playbackRef = useRef<NodeJS.Timeout>();

  const isTimelineData = (d: any): d is TimelineData => {
    return d && 'events' in d && 'startDate' in d;
  };

  const isMapData = (d: any): d is MapData => {
    return d && 'locations' in d && 'center' in d;
  };

  const timelineData = isTimelineData(data) ? data : null;
  const mapData = isMapData(data) ? data : null;

  useEffect(() => {
    if (isPlaying && timelineData) {
      const startYear = timelineData.startDate.getFullYear();
      const endYear = timelineData.endDate.getFullYear();
      const yearRange = endYear - startYear;
      const yearStep = Math.max(1, Math.floor(yearRange / 100)); // 100 steps for playback

      playbackRef.current = setInterval(() => {
        setCurrentDate(prev => {
          if (!prev) return timelineData.startDate;
          
          const nextYear = prev.getFullYear() + yearStep;
          if (nextYear > endYear) {
            setIsPlaying(false);
            return timelineData.startDate;
          }
          
          return new Date(nextYear, prev.getMonth(), prev.getDate());
        });
      }, 1000 / playbackSpeed);
    } else {
      if (playbackRef.current) {
        clearInterval(playbackRef.current);
      }
    }

    return () => {
      if (playbackRef.current) {
        clearInterval(playbackRef.current);
      }
    };
  }, [isPlaying, playbackSpeed, timelineData]);

  const drawTimeline = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    if (!timelineData) return;

    ctx.clearRect(0, 0, width, height);
    
    const padding = 60;
    const timelineY = height / 2;
    const startX = padding;
    const endX = width - padding;
    const timelineWidth = endX - startX;

    // Draw timeline base
    ctx.strokeStyle = '#6b7280';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(startX, timelineY);
    ctx.lineTo(endX, timelineY);
    ctx.stroke();

    // Draw year markers
    const startYear = timelineData.startDate.getFullYear();
    const endYear = timelineData.endDate.getFullYear();
    const yearRange = endYear - startYear;

    for (let year = startYear; year <= endYear; year += Math.ceil(yearRange / 10)) {
      const x = startX + ((year - startYear) / yearRange) * timelineWidth;
      
      ctx.strokeStyle = '#9ca3af';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, timelineY - 10);
      ctx.lineTo(x, timelineY + 10);
      ctx.stroke();

      ctx.fillStyle = '#374151';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(year.toString(), x, timelineY + 25);
    }

    // Draw current date indicator
    if (currentDate) {
      const currentYear = currentDate.getFullYear();
      const currentX = startX + ((currentYear - startYear) / yearRange) * timelineWidth;
      
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(currentX, timelineY - 20);
      ctx.lineTo(currentX, timelineY + 20);
      ctx.stroke();
    }

    // Draw events
    const filteredEvents = timelineData.events.filter(event => {
      if (filter !== 'all' && event.category !== filter) return false;
      if (searchQuery && !event.title.toLowerCase().includes(searchQuery.toLowerCase()) && 
          !event.description.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });

    filteredEvents.forEach((event, index) => {
      const eventYear = event.date.getFullYear();
      const eventX = startX + ((eventYear - startYear) / yearRange) * timelineWidth;
      
      // Determine vertical position based on importance
      let eventY = timelineY;
      switch (event.importance) {
        case 'critical': eventY = timelineY - 60; break;
        case 'high': eventY = timelineY - 40; break;
        case 'medium': eventY = timelineY - 20; break;
        case 'low': eventY = timelineY + 20; break;
      }

      // Draw event marker
      const colors = {
        critical: '#ef4444',
        high: '#f59e0b',
        medium: '#3b82f6',
        low: '#10b981'
      };

      ctx.fillStyle = colors[event.importance];
      ctx.beginPath();
      ctx.arc(eventX, eventY, 8, 0, Math.PI * 2);
      ctx.fill();

      // Draw connection to timeline
      ctx.strokeStyle = colors[event.importance];
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(eventX, eventY);
      ctx.lineTo(eventX, timelineY);
      ctx.stroke();

      // Draw event title
      ctx.fillStyle = '#1f2937';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      
      // Truncate long titles
      const maxLength = 15;
      const title = event.title.length > maxLength 
        ? event.title.substring(0, maxLength) + '...' 
        : event.title;
      
      ctx.fillText(title, eventX, eventY - 15);
    });
  }, [timelineData, currentDate, filter, searchQuery]);

  const drawMap = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    if (!mapData) return;

    ctx.clearRect(0, 0, width, height);
    
    // Draw simple world map background
    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(0, 0, width, height);

    // Draw simplified continents (very basic representation)
    ctx.fillStyle = '#9ca3af';
    
    // North America
    ctx.fillRect(width * 0.15, height * 0.2, width * 0.15, height * 0.3);
    
    // South America
    ctx.fillRect(width * 0.2, height * 0.5, width * 0.08, height * 0.3);
    
    // Europe
    ctx.fillRect(width * 0.45, height * 0.15, width * 0.08, height * 0.15);
    
    // Africa
    ctx.fillRect(width * 0.45, height * 0.35, width * 0.1, height * 0.35);
    
    // Asia
    ctx.fillRect(width * 0.55, height * 0.15, width * 0.25, height * 0.35);
    
    // Australia
    ctx.fillRect(width * 0.7, height * 0.65, width * 0.1, height * 0.15);

    // Draw locations
    mapData.locations.forEach((location, index) => {
      // Convert lat/lng to canvas coordinates
      const x = ((location.coordinates.lng + 180) / 360) * width;
      const y = ((90 - location.coordinates.lat) / 180) * height;

      // Draw location marker
      const colors = {
        city: '#ef4444',
        landmark: '#f59e0b',
        region: '#3b82f6',
        country: '#10b981'
      };

      ctx.fillStyle = colors[location.type];
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fill();

      // Draw location name
      ctx.fillStyle = '#1f2937';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(location.name, x, y - 12);
    });
  }, [mapData]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    if (viewMode === 'timeline' || viewMode === 'both') {
      drawTimeline(ctx, canvas.width / zoom, viewMode === 'both' ? canvas.height / (2 * zoom) : canvas.height / zoom);
    }

    if (viewMode === 'map' || viewMode === 'both') {
      const mapY = viewMode === 'both' ? canvas.height / (2 * zoom) : 0;
      ctx.translate(0, mapY);
      drawMap(ctx, canvas.width / zoom, viewMode === 'both' ? canvas.height / (2 * zoom) : canvas.height / zoom);
      ctx.translate(0, -mapY);
    }

    ctx.restore();
  }, [viewMode, zoom, pan, drawTimeline, drawMap]);

  useEffect(() => {
    draw();
  }, [draw]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x) / zoom;
    const y = (e.clientY - rect.top - pan.y) / zoom;

    // Check if timeline event was clicked
    if (timelineData && (viewMode === 'timeline' || viewMode === 'both')) {
      const padding = 60;
      const timelineY = viewMode === 'both' ? canvas.height / (4 * zoom) : canvas.height / (2 * zoom);
      const startX = padding;
      const endX = (canvas.width / zoom) - padding;
      const timelineWidth = endX - startX;

      const startYear = timelineData.startDate.getFullYear();
      const endYear = timelineData.endDate.getFullYear();
      const yearRange = endYear - startYear;

      const filteredEvents = timelineData.events.filter(event => {
        if (filter !== 'all' && event.category !== filter) return false;
        if (searchQuery && !event.title.toLowerCase().includes(searchQuery.toLowerCase()) && 
            !event.description.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
      });

      for (const event of filteredEvents) {
        const eventYear = event.date.getFullYear();
        const eventX = startX + ((eventYear - startYear) / yearRange) * timelineWidth;
        
        let eventY = timelineY;
        switch (event.importance) {
          case 'critical': eventY = timelineY - 60; break;
          case 'high': eventY = timelineY - 40; break;
          case 'medium': eventY = timelineY - 20; break;
          case 'low': eventY = timelineY + 20; break;
        }

        const distance = Math.sqrt(Math.pow(x - eventX, 2) + Math.pow(y - eventY, 2));
        if (distance <= 10) {
          setSelectedEvent(event);
          onEventSelect?.(event);
          return;
        }
      }
    }

    // Check if map location was clicked
    if (mapData && (viewMode === 'map' || viewMode === 'both')) {
      const mapY = viewMode === 'both' ? canvas.height / 2 : 0;
      const adjustedY = y - mapY / zoom;

      for (const location of mapData.locations) {
        const locX = ((location.coordinates.lng + 180) / 360) * (canvas.width / zoom);
        const locY = ((90 - location.coordinates.lat) / 180) * (canvas.height / zoom);

        const distance = Math.sqrt(Math.pow(x - locX, 2) + Math.pow(adjustedY - locY, 2));
        if (distance <= 10) {
          setSelectedLocation(location);
          onLocationSelect?.(location);
          return;
        }
      }
    }
  }, [pan, zoom, viewMode, timelineData, mapData, filter, searchQuery, onEventSelect, onLocationSelect]);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.max(0.5, Math.min(3, prev * delta)));
  }, []);

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setCurrentDate(null);
    setIsPlaying(false);
  };

  const exportAsImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `${title}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  const categories = timelineData ? timelineData.categories : [];

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">{title}</h2>
        <p className="text-gray-600">{description}</p>
      </div>

      {/* Controls */}
      {showNavigation && (
        <div className="flex flex-wrap gap-3 mb-4">
          {/* View Mode Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('timeline')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                viewMode === 'timeline' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Timeline
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                viewMode === 'map' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Map
            </button>
            <button
              onClick={() => setViewMode('both')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                viewMode === 'both' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Both
            </button>
          </div>

          {/* Timeline Controls */}
          {timelineData && (
            <>
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                {isPlaying ? 'Pause' : 'Play'}
              </button>
              
              <select
                value={playbackSpeed}
                onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                className="px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="0.5">0.5x</option>
                <option value="1">1x</option>
                <option value="2">2x</option>
                <option value="4">4x</option>
              </select>

              {/* Filter */}
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="all">All Categories</option>
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>

              {/* Search */}
              <input
                type="text"
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg"
              />
            </>
          )}

          <button
            onClick={resetView}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            Reset View
          </button>
          
          <button
            onClick={exportAsImage}
            className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
          >
            Export
          </button>
        </div>
      )}

      {/* Canvas */}
      <div className="border border-gray-300 rounded-lg overflow-hidden mb-4">
        <canvas
          ref={canvasRef}
          width={1000}
          height={viewMode === 'both' ? 800 : 600}
          className="cursor-crosshair w-full"
          onClick={handleCanvasClick}
          onWheel={handleWheel}
          aria-label={`${title} interactive ${contentType}`}
        />
      </div>

      {/* Current Date Display */}
      {currentDate && timelineData && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-blue-800 font-medium">
            Current Date: {currentDate.toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
        </div>
      )}

      {/* Selected Event/Location Info */}
      <AnimatePresence>
        {selectedEvent && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="p-4 bg-blue-50 border border-blue-200 rounded-lg"
          >
            <h3 className="font-semibold text-blue-800 mb-2">{selectedEvent.title}</h3>
            <p className="text-blue-700 mb-2">{selectedEvent.description}</p>
            <div className="flex flex-wrap gap-4 text-sm text-blue-600">
              <span><strong>Date:</strong> {selectedEvent.date.toLocaleDateString()}</span>
              <span><strong>Category:</strong> {selectedEvent.category}</span>
              <span><strong>Importance:</strong> {selectedEvent.importance}</span>
            </div>
            {selectedEvent.media && (
              <div className="mt-3">
                {selectedEvent.media.type === 'image' && (
                  <img 
                    src={selectedEvent.media.url} 
                    alt={selectedEvent.media.caption}
                    className="max-w-xs rounded-lg"
                  />
                )}
              </div>
            )}
          </motion.div>
        )}

        {selectedLocation && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="p-4 bg-green-50 border border-green-200 rounded-lg"
          >
            <h3 className="font-semibold text-green-800 mb-2">{selectedLocation.name}</h3>
            <p className="text-green-700 mb-2">{selectedLocation.description}</p>
            <div className="flex flex-wrap gap-4 text-sm text-green-600">
              <span><strong>Type:</strong> {selectedLocation.type}</span>
              <span><strong>Coordinates:</strong> {selectedLocation.coordinates.lat.toFixed(2)}, {selectedLocation.coordinates.lng.toFixed(2)}</span>
            </div>
            {selectedLocation.historicalInfo && (
              <div className="mt-3 text-sm text-green-600">
                <p><strong>Period:</strong> {selectedLocation.historicalInfo.period}</p>
                <p><strong>Significance:</strong> {selectedLocation.historicalInfo.significance}</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Instructions */}
      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold text-gray-800 mb-2">Instructions:</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Click on events or locations to view details</li>
          <li>• Use mouse wheel to zoom in/out</li>
          <li>• Use Play button to animate through timeline</li>
          <li>• Filter events by category or search for specific events</li>
          <li>• Switch between Timeline, Map, or Both views</li>
        </ul>
      </div>
    </div>
  );
};

export default InteractiveTimelineMap;
