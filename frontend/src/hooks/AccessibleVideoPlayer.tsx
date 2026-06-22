import React, { useRef, useState } from 'react';

interface Subtitle {
  src: string;
  srcLang: string;
  label: string;
  default?: boolean;
  kind?: 'subtitles' | 'captions';
}

interface AccessibleVideoPlayerProps {
  src: string;
  title: string;
  subtitles?: Subtitle[];
  poster?: string;
}

export const AccessibleVideoPlayer: React.FC<AccessibleVideoPlayerProps> = ({
  src,
  title,
  subtitles = [],
  poster
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const statusText = `${title} is ${isPlaying ? 'playing' : 'paused'} and ${isMuted ? 'muted' : 'unmuted'}.`;

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      togglePlay();
    } else if (e.key === 'm' || e.key === 'M') {
      e.preventDefault();
      toggleMute();
    }
  };

  return (
    <div 
      className="relative w-full max-w-4xl mx-auto rounded-lg overflow-hidden bg-black focus-within:ring-2 focus-within:ring-blue-500"
      role="region"
      aria-label={`Video player for ${title}`}
      aria-describedby="video-player-help video-player-status"
      onKeyDown={handleKeyDown}
    >
      <video
        ref={videoRef}
        className="w-full"
        poster={poster}
        aria-label={title}
        aria-describedby="video-player-help"
        onClick={togglePlay}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onVolumeChange={(event) => setIsMuted(event.currentTarget.muted)}
        controls={true}
      >
        <source src={src} type="video/mp4" />
        {subtitles.map((sub, index) => (
          <track
            key={index}
            kind={sub.kind || 'captions'}
            src={sub.src}
            srcLang={sub.srcLang}
            label={sub.label}
            default={sub.default}
          />
        ))}
        <p>Your browser does not support the video tag. Please download the video to view it.</p>
      </video>
      
      {/* Accessible screen reader only instructions */}
      <div id="video-player-help" className="sr-only">
        Press Space to play or pause. Press M to mute or unmute. Use Tab to navigate video controls.
      </div>
      <div id="video-player-status" className="sr-only" aria-live="polite">
        {statusText}
      </div>
    </div>
  );
};

export default AccessibleVideoPlayer;
