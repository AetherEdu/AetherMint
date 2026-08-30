'use client';

import React, { useEffect, useRef } from 'react';

interface VideoTile {
  userId: string;
  name: string;
  stream?: MediaStream | null;
  isMuted?: boolean;
  isVideoOff?: boolean;
  isLocal?: boolean;
}

interface VideoGridProps {
  tiles: VideoTile[];
  className?: string;
}

function VideoTileComponent({ tile }: { tile: VideoTile }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && tile.stream) {
      videoRef.current.srcObject = tile.stream;
    }
  }, [tile.stream]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-900">
      {tile.stream && !tile.isVideoOff ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={tile.isLocal}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full min-h-[160px] items-center justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-sky-600 text-2xl font-bold text-white">
            {tile.name.charAt(0).toUpperCase()}
          </div>
        </div>
      )}

      {/* Name overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-3 py-2">
        <p className="text-sm font-medium text-white">
          {tile.name} {tile.isLocal && '(You)'}
        </p>
      </div>

      {/* Mute indicator */}
      {tile.isMuted && (
        <div className="absolute right-2 top-2 rounded-full bg-red-500 p-1">
          <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" />
          </svg>
        </div>
      )}
    </div>
  );
}

export default function VideoGrid({ tiles, className = '' }: VideoGridProps) {
  const count = tiles.length;
  const gridCols = count <= 1 ? 'grid-cols-1' : count <= 2 ? 'grid-cols-2' : count <= 4 ? 'grid-cols-2' : 'grid-cols-3';

  return (
    <div className={`grid ${gridCols} gap-3 ${className}`}>
      {tiles.map((tile) => (
        <VideoTileComponent key={tile.userId} tile={tile} />
      ))}
    </div>
  );
}
