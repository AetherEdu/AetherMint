'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Box, Play, Pause, RotateCw, ZoomIn, ZoomOut, Move3d, Eye, Settings } from 'lucide-react';

export type HolographicContentType = '3d-model' | 'text' | 'image' | 'video' | 'interactive' | 'simulation';
export type RenderMode = 'wireframe' | 'solid' | 'transparent' | 'hologram' | 'glowing';
export type InteractionMode = 'view' | 'manipulate' | 'annotate' | 'collaborate';

interface HolographicContent {
  id: string;
  type: HolographicContentType;
  title: string;
  description: string;
  url?: string;
  data?: any;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
  materials: {
    color: string;
    opacity: number;
    emissive: string;
    roughness: number;
    metalness: number;
  };
  animations?: {
    name: string;
    duration: number;
    loop: boolean;
    autoplay: boolean;
  }[];
  interactive: boolean;
  physics: {
    mass: number;
    friction: number;
    restitution: number;
    gravity: boolean;
  };
}

interface RenderSettings {
  mode: RenderMode;
  quality: 'low' | 'medium' | 'high' | 'ultra';
  shadows: boolean;
  reflections: boolean;
  ambientOcclusion: boolean;
  bloom: boolean;
  depthOfField: boolean;
  motionBlur: boolean;
  targetFPS: 30 | 60 | 90 | 120;
  antiAliasing: 'none' | 'fxaa' | 'taa' | 'msaa';
}

interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  drawCalls: number;
  triangles: number;
  memoryUsage: number;
  gpuUtilization: number;
  renderTime: number;
}

interface HolographicRendererProps {
  content: HolographicContent[];
  mode: InteractionMode;
  renderSettings: RenderSettings;
  onContentSelect?: (content: HolographicContent) => void;
  onContentUpdate?: (content: HolographicContent) => void;
  onPerformanceUpdate?: (metrics: PerformanceMetrics) => void;
  enableMultiUser?: boolean;
  spatialAudioEnabled?: boolean;
  gestureInteractionEnabled?: boolean;
  physicsEnabled?: boolean;
}

const DEFAULT_RENDER_SETTINGS: RenderSettings = {
  mode: 'hologram',
  quality: 'high',
  shadows: true,
  reflections: true,
  ambientOcclusion: true,
  bloom: true,
  depthOfField: false,
  motionBlur: false,
  targetFPS: 60,
  antiAliasing: 'taa'
};

export function HolographicRenderer({
  content,
  mode,
  renderSettings = DEFAULT_RENDER_SETTINGS,
  onContentSelect,
  onContentUpdate,
  onPerformanceUpdate,
  enableMultiUser = false,
  spatialAudioEnabled = true,
  gestureInteractionEnabled = true,
  physicsEnabled = true
}: HolographicRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [selectedContent, setSelectedContent] = useState<HolographicContent | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({
    fps: 60,
    frameTime: 16.67,
    drawCalls: 0,
    triangles: 0,
    memoryUsage: 0,
    gpuUtilization: 0,
    renderTime: 0
  });
  const [showSettings, setShowSettings] = useState(false);
  const [renderMode, setRenderMode] = useState<RenderMode>(renderSettings.mode);
  const [cameraPosition, setCameraPosition] = useState({ x: 0, y: 0, z: 5 });
  const [cameraRotation, setCameraRotation] = useState({ x: 0, y: 0, z: 0 });

  // Initialize holographic renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const initializeRenderer = async () => {
      try {
        // Initialize WebGL context with holographic extensions
        const gl = canvas.getContext('webgl2', {
          antialias: true,
          alpha: true,
          premultipliedAlpha: false,
          preserveDrawingBuffer: false
        });

        if (!gl) {
          throw new Error('WebGL2 not supported');
        }

        // Enable holographic extensions if available
        const extensions = [
          'OES_texture_float',
          'WEBGL_depth_texture',
          'EXT_texture_filter_anisotropic',
          'WEBGL_draw_buffers',
          'OES_element_index_uint'
        ];

        extensions.forEach(ext => {
          gl.getExtension(ext);
        });

        // Set up holographic rendering pipeline
        setupHolographicPipeline(gl);
        
        setIsInitialized(true);
        console.log('Holographic renderer initialized successfully');
      } catch (error) {
        console.error('Failed to initialize holographic renderer:', error);
      }
    };

    initializeRenderer();
  }, []);

  // Set up holographic rendering pipeline
  const setupHolographicPipeline = (gl: WebGL2RenderingContext) => {
    // Enable depth testing for 3D rendering
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    // Enable blending for transparency effects
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Set up viewport
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    // Clear color with transparency for holographic effect
    gl.clearColor(0, 0, 0, 0);

    // Create holographic shader programs
    createHolographicShaders(gl);
  };

  // Create holographic shader programs
  const createHolographicShaders = (gl: WebGL2RenderingContext) => {
    // Vertex shader for holographic rendering
    const vertexShaderSource = `
      attribute vec3 position;
      attribute vec3 normal;
      attribute vec2 uv;
      
      uniform mat4 modelMatrix;
      uniform mat4 viewMatrix;
      uniform mat4 projectionMatrix;
      uniform mat3 normalMatrix;
      
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec2 vUv;
      varying vec3 vViewPosition;
      
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vPosition = (modelMatrix * vec4(position, 1.0)).xyz;
        vViewPosition = (viewMatrix * vec4(vPosition, 1.0)).xyz;
        vUv = uv;
        
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
      }
    `;

    // Fragment shader for holographic effect
    const fragmentShaderSource = `
      precision mediump float;
      
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec2 vUv;
      varying vec3 vViewPosition;
      
      uniform vec3 color;
      uniform float opacity;
      uniform vec3 emissive;
      uniform float roughness;
      uniform float metalness;
      uniform float time;
      uniform vec3 lightPosition;
      uniform vec3 lightColor;
      
      void main() {
        vec3 normal = normalize(vNormal);
        vec3 viewDirection = normalize(vViewPosition - vPosition);
        vec3 lightDirection = normalize(lightPosition - vPosition);
        
        // Holographic scan line effect
        float scanline = sin(vUv.y * 30.0 + time * 2.0) * 0.5 + 0.5;
        float hologramEffect = scanline * 0.3 + 0.7;
        
        // Fresnel effect for holographic appearance
        float fresnel = pow(1.0 - dot(normal, viewDirection), 2.0);
        
        // Basic lighting
        float diff = max(dot(normal, lightDirection), 0.0);
        vec3 diffuse = diff * lightColor;
        
        // Specular reflection
        vec3 reflectDir = reflect(-lightDirection, normal);
        float spec = pow(max(dot(viewDirection, reflectDir), 0.0), 32.0);
        vec3 specular = spec * lightColor * metalness;
        
        // Combine effects
        vec3 ambient = color * 0.2;
        vec3 finalColor = ambient + diffuse + specular + emissive;
        
        // Apply holographic effects
        finalColor *= hologramEffect;
        finalColor += fresnel * 0.3 * vec3(0.0, 1.0, 1.0); // Cyan glow
        
        gl_FragColor = vec4(finalColor, opacity);
      }
    `;

    // Compile and link shaders
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    
    if (vertexShader && fragmentShader) {
      const program = gl.createProgram();
      if (program) {
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
          console.error('Shader program linking failed:', gl.getProgramInfoLog(program));
        }
      }
    }
  };

  // Create and compile shader
  const createShader = (gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compilation failed:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    
    return shader;
  };

  // Render holographic content
  const render = useCallback(() => {
    if (!isInitialized || !canvasRef.current) return;

    const gl = canvasRef.current.getContext('webgl2');
    if (!gl) return;

    const startTime = performance.now();

    // Clear the canvas
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Render each holographic content item
    content.forEach(item => {
      renderHolographicContent(gl, item);
    });

    // Calculate performance metrics
    const endTime = performance.now();
    const frameTime = endTime - startTime;
    const fps = 1000 / frameTime;

    const newMetrics = {
      fps: Math.round(fps),
      frameTime: Math.round(frameTime * 100) / 100,
      drawCalls: content.length,
      triangles: content.reduce((sum, item) => sum + (item.data?.triangles || 0), 0),
      memoryUsage: 0, // Would be calculated from WebGL buffers
      gpuUtilization: 0, // Would be measured from GPU APIs
      renderTime: Math.round(frameTime * 100) / 100
    };

    setPerformanceMetrics(newMetrics);
    onPerformanceUpdate?.(newMetrics);

    // Continue rendering loop
    if (isPlaying) {
      requestAnimationFrame(render);
    }
  }, [content, isInitialized, isPlaying, onPerformanceUpdate]);

  // Render individual holographic content
  const renderHolographicContent = (gl: WebGL2RenderingContext, item: HolographicContent) => {
    // Create transformation matrix
    const modelMatrix = createTransformMatrix(item.position, item.rotation, item.scale);
    
    // Apply material properties
    const material = item.materials;
    
    // Render based on content type
    switch (item.type) {
      case '3d-model':
        render3DModel(gl, item, modelMatrix, material);
        break;
      case 'text':
        render3DText(gl, item, modelMatrix, material);
        break;
      case 'image':
        render3DImage(gl, item, modelMatrix, material);
        break;
      case 'video':
        render3DVideo(gl, item, modelMatrix, material);
        break;
      case 'interactive':
        renderInteractiveContent(gl, item, modelMatrix, material);
        break;
      case 'simulation':
        renderSimulation(gl, item, modelMatrix, material);
        break;
    }
  };

  // Create transformation matrix
  const createTransformMatrix = (position: any, rotation: any, scale: any): Float32Array => {
    // Simplified matrix creation - in production would use proper matrix library
    const matrix = new Float32Array(16);
    
    // Identity matrix
    matrix[0] = scale.x; matrix[5] = scale.y; matrix[10] = scale.z; matrix[15] = 1;
    matrix[12] = position.x; matrix[13] = position.y; matrix[14] = position.z;
    
    return matrix;
  };

  // Best-effort parse of a CSS colour string into normalized RGB floats.
  // Falls back to the holographic default when the format isn't hex.
  const parseColor = (value: string): [number, number, number] => {
    const hex = (value ?? '').trim();
    if (hex.startsWith('#')) {
      const digits = hex.slice(1);
      const expanded = digits.length === 3
        ? digits.split('').map((c) => c + c).join('')
        : digits;
      const n = parseInt(expanded, 16);
      if (!Number.isNaN(n)) {
        return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
      }
    }
    return [0.3, 0.6, 0.9];
  };

  // Render 3D model
  const render3DModel = (gl: WebGL2RenderingContext, item: HolographicContent, modelMatrix: Float32Array, material: any) => {
    // In production, this would render actual 3D geometry
    // For now, we'll create a simple placeholder
    
    // Create a simple cube geometry
    const vertices = new Float32Array([
      // Front face
      -0.5, -0.5,  0.5,
       0.5, -0.5,  0.5,
       0.5,  0.5,  0.5,
      -0.5,  0.5,  0.5,
      // Back face
      -0.5, -0.5, -0.5,
      -0.5,  0.5, -0.5,
       0.5,  0.5, -0.5,
       0.5, -0.5, -0.5,
    ]);

    const indices = new Uint16Array([
      0, 1, 2,  0, 2, 3,  // Front
      4, 5, 6,  4, 6, 7,  // Back
      3, 2, 6,  3, 6, 5,  // Top
      0, 4, 7,  0, 7, 1,  // Bottom
      1, 7, 6,  1, 6, 2,  // Right
      0, 3, 5,  0, 5, 4   // Left
    ]);

    // Create and bind buffers
    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    // Set up vertex attributes
    const positionAttributeLocation = 0; // Would get from shader program
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(positionAttributeLocation, 3, gl.FLOAT, false, 0, 0);

    // Apply holographic material
    gl.uniform3f(1, ...parseColor(material.color)); // color uniform
    gl.uniform1f(2, material.opacity); // opacity uniform
    gl.uniform3f(3, ...parseColor(material.emissive)); // emissive uniform

    // Draw the geometry
    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
  };

  // Render 3D text
  const render3DText = (gl: WebGL2RenderingContext, item: HolographicContent, modelMatrix: Float32Array, material: any) => {
    // Create 3D text geometry using canvas 2D to texture
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.fillStyle = '#00ffff';
      ctx.font = 'bold 48px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(item.title, canvas.width / 2, canvas.height / 2 + 16);
      
      // Create texture from canvas
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      
      // Render textured quad
      renderTexturedQuad(gl, texture, modelMatrix, material);
    }
  };

  // Render 3D image
  const render3DImage = (gl: WebGL2RenderingContext, item: HolographicContent, modelMatrix: Float32Array, material: any) => {
    // Load and render image as texture
    if (item.url) {
      const img = new Image();
      img.onload = () => {
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        
        renderTexturedQuad(gl, texture, modelMatrix, material);
      };
      img.src = item.url;
    }
  };

  // Render 3D video
  const render3DVideo = (gl: WebGL2RenderingContext, item: HolographicContent, modelMatrix: Float32Array, material: any) => {
    // Render video as texture
    if (item.url) {
      const video = document.createElement('video');
      video.src = item.url;
      video.play();
      
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      
      const updateVideoTexture = () => {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
        renderTexturedQuad(gl, texture, modelMatrix, material);
        
        if (!video.paused && !video.ended) {
          requestAnimationFrame(updateVideoTexture);
        }
      };
      
      video.addEventListener('play', updateVideoTexture);
    }
  };

  // Render interactive content
  const renderInteractiveContent = (gl: WebGL2RenderingContext, item: HolographicContent, modelMatrix: Float32Array, material: any) => {
    // Render interactive elements with hover states
    render3DModel(gl, item, modelMatrix, material);
    
    // Add interactive overlay effects
    if (item.interactive && selectedContent?.id === item.id) {
      // Render selection outline
      const selectionMaterial = {
        ...material,
        emissive: '#ffff00',
        opacity: 0.8
      };
      renderSelectionOutline(gl, item, modelMatrix, selectionMaterial);
    }
  };

  // Render simulation
  const renderSimulation = (gl: WebGL2RenderingContext, item: HolographicContent, modelMatrix: Float32Array, material: any) => {
    // Render simulation with animated elements
    const time = Date.now() * 0.001;
    
    // Animate based on simulation data
    const animatedMaterial = {
      ...material,
      emissive: `hsl(${(time * 50) % 360}, 100%, 50%)`
    };
    
    render3DModel(gl, item, modelMatrix, animatedMaterial);
  };

  // Render textured quad
  const renderTexturedQuad = (gl: WebGL2RenderingContext, texture: WebGLTexture, modelMatrix: Float32Array, material: any) => {
    const vertices = new Float32Array([
      -0.5, -0.5, 0,
       0.5, -0.5, 0,
       0.5,  0.5, 0,
      -0.5,  0.5, 0,
    ]);

    const uvs = new Float32Array([
      0, 1,
      1, 1,
      1, 0,
      0, 0,
    ]);

    const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);

    // Create and bind buffers
    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const uvBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);

    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    // Bind texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Draw
    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
  };

  // Render selection outline
  const renderSelectionOutline = (gl: WebGL2RenderingContext, item: HolographicContent, modelMatrix: Float32Array, material: any) => {
    // Render wireframe outline for selected object
    gl.lineWidth(2.0);
    
    // Create wireframe geometry
    const vertices = new Float32Array([
      // Cube wireframe edges
      -0.5, -0.5,  0.5,  0.5, -0.5,  0.5,
      0.5, -0.5,  0.5,  0.5,  0.5,  0.5,
      0.5,  0.5,  0.5, -0.5,  0.5,  0.5,
      -0.5,  0.5,  0.5, -0.5, -0.5,  0.5,
      -0.5, -0.5, -0.5,  0.5, -0.5, -0.5,
      0.5, -0.5, -0.5,  0.5,  0.5, -0.5,
      0.5,  0.5, -0.5, -0.5,  0.5, -0.5,
      -0.5,  0.5, -0.5, -0.5, -0.5, -0.5,
      // Connecting edges
      -0.5, -0.5,  0.5, -0.5, -0.5, -0.5,
      0.5, -0.5,  0.5,  0.5, -0.5, -0.5,
      0.5,  0.5,  0.5,  0.5,  0.5, -0.5,
      -0.5,  0.5,  0.5, -0.5,  0.5, -0.5,
    ]);

    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    // Draw lines
    gl.drawArrays(gl.LINES, 0, vertices.length / 3);
  };

  // Start rendering loop
  useEffect(() => {
    if (isInitialized && isPlaying) {
      render();
    }
  }, [isInitialized, isPlaying, render]);

  // Handle content selection
  const handleContentSelect = (item: HolographicContent) => {
    setSelectedContent(item);
    onContentSelect?.(item);
  };

  // Handle camera controls
  const handleCameraMove = (axis: 'x' | 'y' | 'z', delta: number) => {
    setCameraPosition(prev => ({
      ...prev,
      [axis]: prev[axis] + delta
    }));
  };

  const handleCameraRotate = (axis: 'x' | 'y' | 'z', delta: number) => {
    setCameraRotation(prev => ({
      ...prev,
      [axis]: prev[axis] + delta
    }));
  };

  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Initializing holographic renderer...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-black rounded-lg overflow-hidden">
      {/* Holographic Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        width={800}
        height={600}
      />

      {/* Control Panel */}
      <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-cyan-500/30">
        <div className="flex items-center gap-3 mb-4">
          <Box className="h-5 w-5 text-cyan-400" />
          <h3 className="text-white font-semibold">Holographic Renderer</h3>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-2 bg-cyan-600 text-white rounded hover:bg-cyan-700 transition-colors"
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <button
            onClick={render}
            className="p-2 bg-cyan-600 text-white rounded hover:bg-cyan-700 transition-colors"
          >
            <RotateCw className="h-4 w-4" />
          </button>
        </div>

        {/* Render Mode */}
        <div className="mb-4">
          <label className="text-cyan-400 text-sm">Render Mode</label>
          <select
            value={renderMode}
            onChange={(e) => setRenderMode(e.target.value as RenderMode)}
            className="w-full mt-1 p-2 bg-black/50 border border-cyan-500/30 rounded text-cyan-100"
          >
            <option value="wireframe">Wireframe</option>
            <option value="solid">Solid</option>
            <option value="transparent">Transparent</option>
            <option value="hologram">Hologram</option>
            <option value="glowing">Glowing</option>
          </select>
        </div>

        {/* Camera Controls */}
        <div className="space-y-2">
          <div className="text-cyan-400 text-sm">Camera Position</div>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handleCameraMove('x', -0.5)}
              className="p-1 bg-cyan-600/20 text-cyan-400 rounded text-xs hover:bg-cyan-600/30"
            >
              X-
            </button>
            <button
              onClick={() => handleCameraMove('y', -0.5)}
              className="p-1 bg-cyan-600/20 text-cyan-400 rounded text-xs hover:bg-cyan-600/30"
            >
              Y-
            </button>
            <button
              onClick={() => handleCameraMove('z', -0.5)}
              className="p-1 bg-cyan-600/20 text-cyan-400 rounded text-xs hover:bg-cyan-600/30"
            >
              Z-
            </button>
            <button
              onClick={() => handleCameraMove('x', 0.5)}
              className="p-1 bg-cyan-600/20 text-cyan-400 rounded text-xs hover:bg-cyan-600/30"
            >
              X+
            </button>
            <button
              onClick={() => handleCameraMove('y', 0.5)}
              className="p-1 bg-cyan-600/20 text-cyan-400 rounded text-xs hover:bg-cyan-600/30"
            >
              Y+
            </button>
            <button
              onClick={() => handleCameraMove('z', 0.5)}
              className="p-1 bg-cyan-600/20 text-cyan-400 rounded text-xs hover:bg-cyan-600/30"
            >
              Z+
            </button>
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="absolute top-4 right-4 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-green-500/30">
        <div className="flex items-center gap-3 mb-3">
          <Eye className="h-5 w-5 text-green-400" />
          <h3 className="text-white font-semibold">Performance</h3>
        </div>
        
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">FPS:</span>
            <span className={`font-mono ${performanceMetrics.fps >= 60 ? 'text-green-400' : performanceMetrics.fps >= 30 ? 'text-yellow-400' : 'text-red-400'}`}>
              {performanceMetrics.fps}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Frame Time:</span>
            <span className="font-mono text-green-400">{performanceMetrics.frameTime}ms</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Draw Calls:</span>
            <span className="font-mono text-green-400">{performanceMetrics.drawCalls}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Triangles:</span>
            <span className="font-mono text-green-400">{performanceMetrics.triangles}</span>
          </div>
        </div>
      </div>

      {/* Content List */}
      <div className="absolute bottom-4 left-4 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-purple-500/30 max-w-xs">
        <div className="flex items-center gap-3 mb-3">
          <Move3d className="h-5 w-5 text-purple-400" />
          <h3 className="text-white font-semibold">Content</h3>
        </div>
        
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {content.map((item) => (
            <button
              key={item.id}
              onClick={() => handleContentSelect(item)}
              className={`w-full text-left p-2 rounded transition-colors ${
                selectedContent?.id === item.id
                  ? 'bg-purple-600/30 border border-purple-500'
                  : 'bg-purple-600/10 border border-purple-500/20 hover:bg-purple-600/20'
              }`}
            >
              <div className="text-white text-sm font-medium">{item.title}</div>
              <div className="text-purple-300 text-xs">{item.type}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Settings Button */}
      <button
        onClick={() => setShowSettings(!showSettings)}
        className="absolute top-4 right-20 p-2 bg-black/80 backdrop-blur-md rounded-lg border border-gray-500/30 text-white hover:bg-black/90 transition-colors"
      >
        <Settings className="h-5 w-5" />
      </button>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            className="absolute top-16 right-4 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-gray-500/30 w-80"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <h3 className="text-white font-semibold mb-4">Render Settings</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm">Quality</label>
                <select className="w-full mt-1 p-2 bg-black/50 border border-gray-500/30 rounded text-white">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="ultra">Ultra</option>
                </select>
              </div>
              
              <div>
                <label className="text-gray-400 text-sm">Target FPS</label>
                <select className="w-full mt-1 p-2 bg-black/50 border border-gray-500/30 rounded text-white">
                  <option value="30">30 FPS</option>
                  <option value="60">60 FPS</option>
                  <option value="90">90 FPS</option>
                  <option value="120">120 FPS</option>
                </select>
              </div>
              
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked className="rounded" />
                  <span className="text-gray-400 text-sm">Shadows</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked className="rounded" />
                  <span className="text-gray-400 text-sm">Reflections</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked className="rounded" />
                  <span className="text-gray-400 text-sm">Ambient Occlusion</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked className="rounded" />
                  <span className="text-gray-400 text-sm">Bloom Effect</span>
                </label>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
