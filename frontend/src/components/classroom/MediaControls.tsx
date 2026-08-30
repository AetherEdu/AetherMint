'use client';

import React from 'react';

interface MediaControlsProps {
  isAudioOn: boolean;
  isVideoOn: boolean;
  isScreenSharing: boolean;
  isRecording: boolean;
  isLive: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onToggleRecording: () => void;
  onToggleLive: () => void;
  onStartCamera: () => void;
  onStopCamera: () => void;
  onRaiseHand: () => void;
  isHandRaised: boolean;
}

export default function MediaControls({
  isAudioOn,
  isVideoOn,
  isScreenSharing,
  isRecording,
  isLive,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onToggleRecording,
  onToggleLive,
  onStartCamera,
  onStopCamera,
  onRaiseHand,
  isHandRaised,
}: MediaControlsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {/* Camera/Mic toggle */}
      <ControlButton
        active={!isAudioOn && !isVideoOn}
        onClick={isAudioOn || isVideoOn ? onStopCamera : onStartCamera}
        label={isAudioOn || isVideoOn ? 'Stop Camera' : 'Start Camera'}
        icon={
          isAudioOn || isVideoOn ? (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
          )
        }
      />

      {/* Audio toggle */}
      <ControlButton
        active={!isAudioOn}
        onClick={onToggleAudio}
        label={isAudioOn ? 'Mute' : 'Unmute'}
        icon={
          isAudioOn ? (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
          )
        }
      />

      {/* Video toggle */}
      <ControlButton
        active={!isVideoOn}
        onClick={onToggleVideo}
        label={isVideoOn ? 'Video Off' : 'Video On'}
        icon={
          isVideoOn ? (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
          )
        }
      />

      {/* Screen share */}
      <ControlButton
        active={isScreenSharing}
        onClick={onToggleScreenShare}
        label={isScreenSharing ? 'Stop Share' : 'Share Screen'}
        icon={
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
        }
      />

      {/* Recording */}
      <ControlButton
        active={isRecording}
        onClick={onToggleRecording}
        label={isRecording ? 'Stop Rec' : 'Record'}
        icon={
          <svg className="h-5 w-5" fill={isRecording ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="10" strokeWidth={2} /><circle cx="12" cy="12" r="4" fill={isRecording ? 'white' : 'currentColor'} /></svg>
        }
      />

      {/* Live stream */}
      <ControlButton
        active={isLive}
        onClick={onToggleLive}
        label={isLive ? 'Stop Live' : 'Go Live'}
        icon={
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
        }
      />

      {/* Hand raise */}
      <ControlButton
        active={isHandRaised}
        onClick={onRaiseHand}
        label={isHandRaised ? 'Lower Hand' : 'Raise Hand'}
        icon={
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" /></svg>
        }
      />
    </div>
  );
}

function ControlButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
        active
          ? 'bg-red-100 text-red-700 hover:bg-red-200'
          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
      }`}
      title={label}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
