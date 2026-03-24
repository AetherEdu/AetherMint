import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, SkipBack, SkipForward, Download } from 'lucide-react';

const AudioPlayer = ({ 
  content, 
  onProgress, 
  onBookmark, 
  bookmarks = [],
  startTime = 0,
  showTranscript = false 
}) => {
  const audioRef = useRef(null);
  const progressIntervalRef = useRef(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(startTime);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showTranscriptPanel, setShowTranscriptPanel] = useState(showTranscript);

  // Initialize audio player
  useEffect(() => {
    if (!audioRef.current || !content.files) return;

    const audio = audioRef.current;
    const audioFile = content.files.find(f => f.type === 'audio');
    
    if (audioFile && audioFile.url) {
      audio.src = audioFile.url;
      audio.load();
      
      if (startTime > 0) {
        audio.currentTime = startTime;
      }
    }
  }, [content.files, startTime]);

  // Progress tracking
  useEffect(() => {
    if (isPlaying && onProgress) {
      progressIntervalRef.current = setInterval(() => {
        const progress = {
          currentTime: audioRef.current.currentTime,
          duration: audioRef.current.duration,
          watchTime: 1 // 1 second interval
        };
        onProgress(progress);
      }, 1000);
    } else {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    }

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [isPlaying, onProgress]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      setDuration(audioRef.current.duration || 0);
    }
  };

  const handleSeek = (e) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeChange = (e) => {
    const vol = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.volume = vol;
      setVolume(vol);
    }
  };

  const handleSpeedChange = (speed) => {
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
      setPlaybackSpeed(speed);
    }
  };

  const addBookmark = () => {
    if (onBookmark) {
      onBookmark({
        contentId: content._id,
        timestamp: currentTime,
        note: ''
      });
    }
  };

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` 
                : `${m}:${s.toString().padStart(2, '0')}`;
  };

  const hasBookmarkAtTime = (time) => {
    return bookmarks.some(b => Math.abs(b.timestamp - time) < 2);
  };

  const transcript = content.files?.find(f => f.type === 'transcript');

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      {/* Audio Player */}
      <div className="mb-6">
        <audio
          ref={audioRef}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleTimeUpdate}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          className="w-full"
        />
        
        {/* Audio Info */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{content.title}</h3>
            <p className="text-sm text-gray-600">{content.description}</p>
          </div>
          {content.metadata?.duration && (
            <span className="text-sm text-gray-500">
              {formatTime(content.metadata.duration)}
            </span>
          )}
        </div>

        {/* Waveform visualization placeholder */}
        <div className="bg-gray-100 rounded-lg h-24 mb-4 flex items-center justify-center">
          <div className="text-gray-400 text-sm">Audio waveform visualization</div>
        </div>

        {/* Progress Bar */}
        <div className="relative mb-4">
          <input
            type="range"
            min="0"
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer"
          />
          {/* Bookmark indicators */}
          {bookmarks.map((bookmark, index) => (
            <div
              key={index}
              className="absolute top-1/2 transform -translate-y-1/2 w-3 h-3 bg-yellow-500 rounded-full"
              style={{ left: `${(bookmark.timestamp / duration) * 100}%` }}
            />
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              className="bg-blue-500 text-white p-3 rounded-full hover:bg-blue-600 transition-colors"
            >
              {isPlaying ? <Pause size={20} /> : <Play size={20} />}
            </button>

            {/* Skip Back/Forward */}
            <button
              onClick={() => {
                if (audioRef.current) {
                  audioRef.current.currentTime = Math.max(0, currentTime - 10);
                }
              }}
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              <SkipBack size={20} />
            </button>
            <button
              onClick={() => {
                if (audioRef.current) {
                  audioRef.current.currentTime = Math.min(duration, currentTime + 10);
                }
              }}
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              <SkipForward size={20} />
            </button>

            {/* Time Display */}
            <span className="text-sm text-gray-600">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center space-x-4">
            {/* Volume */}
            <div className="flex items-center space-x-2">
              <Volume2 size={20} className="text-gray-600" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={handleVolumeChange}
                className="w-20 h-1 bg-gray-300 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Playback Speed */}
            <select
              value={playbackSpeed}
              onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
              className="bg-gray-100 text-gray-700 text-sm px-2 py-1 rounded border border-gray-300"
            >
              <option value="0.5">0.5x</option>
              <option value="0.75">0.75x</option>
              <option value="1">1x</option>
              <option value="1.25">1.25x</option>
              <option value="1.5">1.5x</option>
              <option value="2">2x</option>
            </select>

            {/* Bookmark */}
            <button
              onClick={addBookmark}
              className={`p-2 rounded transition-colors ${hasBookmarkAtTime(currentTime) ? 'bg-yellow-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
              title="Add bookmark"
            >
              <Download size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Transcript Section */}
      {transcript && (
        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-gray-900">Transcript</h4>
            <button
              onClick={() => setShowTranscriptPanel(!showTranscriptPanel)}
              className="text-blue-500 hover:text-blue-600 text-sm"
            >
              {showTranscriptPanel ? 'Hide' : 'Show'}
            </button>
          </div>
          
          {showTranscriptPanel && (
            <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
              <div className="text-sm text-gray-700 leading-relaxed">
                {/* Transcript content would be loaded from the transcript file */}
                <p className="mb-2">Transcript content will be displayed here...</p>
                <p className="mb-2">Each paragraph could be timestamped for easy navigation.</p>
                <p>Click on timestamps to jump to that position in the audio.</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AudioPlayer;
