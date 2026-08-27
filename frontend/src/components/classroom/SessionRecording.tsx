'use client';

import React from 'react';

interface SessionRecordingProps {
  isRecording: boolean;
  playbackUrl?: string | null;
  onStartRecording: () => void;
  onStopRecording: () => void;
  isInstructor: boolean;
}

export default function SessionRecording({
  isRecording,
  playbackUrl,
  onStartRecording,
  onStopRecording,
  isInstructor,
}: SessionRecordingProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <svg className="h-5 w-5 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        <h3 className="text-lg font-semibold text-slate-900">Session Recording</h3>
      </div>

      {isInstructor && (
        <div className="flex gap-2">
          {isRecording ? (
            <button
              onClick={onStopRecording}
              className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-500"
            >
              <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
              Stop Recording
            </button>
          ) : (
            <button
              onClick={onStartRecording}
              className="flex items-center gap-2 rounded-xl bg-slate-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-600"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="8" />
              </svg>
              Start Recording
            </button>
          )}
        </div>
      )}

      {isRecording && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
          Recording in progress...
        </div>
      )}

      {playbackUrl && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700">Recording Available</p>
          <a
            href={playbackUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-100"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Watch Playback
          </a>
        </div>
      )}

      {!playbackUrl && !isRecording && (
        <p className="text-sm text-slate-500">No recording available yet.</p>
      )}
    </div>
  );
}
