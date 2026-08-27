'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  CheckCircle,
  Download,
  Wifi,
  WifiOff,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  HardDrive,
  RefreshCw,
  BookOpen,
  Volume2,
  VolumeX,
  Maximize,
  Clock,
  Sparkles
} from 'lucide-react';
import {
  saveLessonOffline,
  getOfflineLesson,
  deleteOfflineLesson,
  saveOfflineProgress,
  getOfflineProgress,
  OfflineLessonRecord
} from '@/utils/offlineDB';
import { useOfflineSync, reconcileProgress } from '@/hooks/useOfflineSync';
import OfflineDownloadManager from './OfflineDownloadManager';

export interface Lesson {
  id: string;
  title: string;
  description: string;
  durationSeconds: number;
  type: 'video' | 'article' | 'quiz';
  videoUrl?: string;
  articleContent?: string;
}

export interface CoursePlayerProps {
  courseId: string;
  courseTitle: string;
  lessons: Lesson[];
  initialLessonId?: string;
}

export default function CoursePlayer({
  courseId,
  courseTitle,
  lessons,
  initialLessonId
}: CoursePlayerProps) {
  const [currentLessonIndex, setCurrentLessonIndex] = useState<number>(() => {
    if (!initialLessonId) return 0;
    const foundIdx = lessons.findIndex(l => l.id === initialLessonId);
    return foundIdx !== -1 ? foundIdx : 0;
  });

  const currentLesson = lessons[currentLessonIndex] || lessons[0];

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(currentLesson?.durationSeconds || 100);
  const [isMuted, setIsMuted] = useState(false);

  // Download & Storage state
  const [downloadedLessons, setDownloadedLessons] = useState<Record<string, boolean>>({});
  const [downloadingLessonId, setDownloadingLessonId] = useState<string | null>(null);
  const [isStorageManagerOpen, setIsStorageManagerOpen] = useState(false);

  // Sync & Progress state
  const [completedLessons, setCompletedLessons] = useState<string[]>([]);
  const [overallProgress, setOverallProgress] = useState(0);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [isResumeLoaded, setIsResumeLoaded] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const { isOnline, isSyncing, addToQueue, triggerSync } = useOfflineSync();

  // Check downloaded status of lessons
  const checkDownloadedLessons = useCallback(async () => {
    const statusMap: Record<string, boolean> = {};
    for (const lesson of lessons) {
      const record = await getOfflineLesson(courseId, lesson.id);
      statusMap[lesson.id] = !!record;
    }
    setDownloadedLessons(statusMap);
  }, [courseId, lessons]);

  // Load progress and resume position across devices
  const loadProgressAndResume = useCallback(async () => {
    try {
      let serverProgress: any = null;
      let offlineProg: any = null;

      // 1. Try fetching from server if online
      if (isOnline) {
        try {
          const res = await fetch(`/api/progress/${courseId}`);
          if (res.ok) {
            const data = await res.json();
            serverProgress = data.data;
          }
        } catch (e) {
          console.warn('Failed to fetch progress from server, falling back to offline storage', e);
        }
      }

      // 2. Try fetching from offline IndexedDB
      offlineProg = await getOfflineProgress(`progress_${courseId}`);

      // 3. Conflict-free reconcile
      const merged = reconcileProgress(offlineProg, serverProgress);

      if (merged) {
        setCompletedLessons(merged.completedLessons || []);
        setOverallProgress(merged.overallProgress || 0);

        // Resume last active lesson
        if (merged.lastActiveLessonId) {
          const idx = lessons.findIndex(l => l.id === merged.lastActiveLessonId);
          if (idx !== -1) {
            setCurrentLessonIndex(idx);
          }
        }

        // Resume timestamp position for current lesson
        const currentLessonPos = merged.playbackPositions?.[currentLesson?.id];
        if (currentLessonPos && typeof currentLessonPos.timestamp === 'number') {
          setCurrentTime(currentLessonPos.timestamp);
          if (videoRef.current) {
            videoRef.current.currentTime = currentLessonPos.timestamp;
          }
        }
      }
    } catch (error) {
      console.error('Error restoring progress:', error);
    } finally {
      setIsResumeLoaded(true);
    }
  }, [courseId, isOnline, lessons, currentLesson?.id]);

  useEffect(() => {
    checkDownloadedLessons();
    loadProgressAndResume();
  }, [checkDownloadedLessons, loadProgressAndResume]);

  // Save progress locally & sync online
  const saveProgressState = useCallback(async (
    lessonId: string,
    timeSec: number,
    isCompleted: boolean = false
  ) => {
    const updatedCompleted = isCompleted
      ? Array.from(new Set([...completedLessons, lessonId]))
      : completedLessons;

    const newOverallProgress = Math.round((updatedCompleted.length / lessons.length) * 100);

    const progressPayload = {
      courseId,
      overallProgress: newOverallProgress,
      completedLessons: updatedCompleted,
      lastActiveLessonId: lessonId,
      playbackPositions: {
        [lessonId]: {
          timestamp: timeSec,
          completed: isCompleted,
          lastUpdated: Date.now(),
        },
      },
      lastUpdated: Date.now(),
    };

    setCompletedLessons(updatedCompleted);
    setOverallProgress(newOverallProgress);

    // Save to IndexedDB
    await saveOfflineProgress(`progress_${courseId}`, progressPayload);

    // If online, post to server; if offline, add to sync outbox queue
    if (isOnline) {
      try {
        await fetch('/api/progress/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            courseId,
            lessonId,
            playbackTimestamp: timeSec,
            completed: isCompleted,
            overallProgress: newOverallProgress,
          }),
        });
      } catch (err) {
        addToQueue('create', '/api/progress/update', {
          courseId,
          lessonId,
          playbackTimestamp: timeSec,
          completed: isCompleted,
          overallProgress: newOverallProgress,
        });
      }
    } else {
      addToQueue('create', '/api/progress/update', {
        courseId,
        lessonId,
        playbackTimestamp: timeSec,
        completed: isCompleted,
        overallProgress: newOverallProgress,
      });
    }
  }, [completedLessons, lessons.length, courseId, isOnline, addToQueue]);

  // Handle periodic video playback time updates
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const time = videoRef.current.currentTime;
      setCurrentTime(time);

      // Periodically save resume position every 5 seconds
      if (Math.floor(time) % 5 === 0 && currentLesson) {
        saveProgressState(currentLesson.id, time, false);
      }
    }
  };

  // Toggle Play / Pause
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  // Toggle Lesson Completion
  const toggleLessonComplete = () => {
    if (!currentLesson) return;
    const isCompleted = completedLessons.includes(currentLesson.id);
    saveProgressState(currentLesson.id, currentTime, !isCompleted);
  };

  // Download Lesson for Offline Study
  const handleDownloadLesson = async (lesson: Lesson) => {
    try {
      setDownloadingLessonId(lesson.id);

      const content = {
        title: lesson.title,
        description: lesson.description,
        type: lesson.type,
        videoUrl: lesson.videoUrl,
        articleContent: lesson.articleContent || `Offline study guide for ${lesson.title}`,
      };

      await saveLessonOffline(
        courseId,
        lesson.id,
        lesson.title,
        content,
        lesson.videoUrl,
        1024 * 500 // estimate 500 KB per lesson
      );

      await checkDownloadedLessons();
      setSyncMessage(`Lesson "${lesson.title}" saved for offline study!`);
      setTimeout(() => setSyncMessage(null), 3000);
    } catch (error) {
      console.error('Failed to download lesson offline:', error);
    } finally {
      setDownloadingLessonId(null);
    }
  };

  // Delete downloaded lesson
  const handleDeleteDownloadedLesson = async (lessonId: string) => {
    try {
      await deleteOfflineLesson(courseId, lessonId);
      await checkDownloadedLessons();
    } catch (error) {
      console.error('Failed to remove offline lesson:', error);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto p-4">
      {/* Main Player Area */}
      <div className="flex-1 space-y-4">
        {/* Status Bar */}
        <div className="flex items-center justify-between bg-slate-900 text-slate-100 p-3 px-5 rounded-xl shadow-sm text-sm">
          <div className="flex items-center gap-2">
            {isOnline ? (
              <span className="flex items-center gap-1.5 text-emerald-400 font-medium text-xs">
                <Wifi className="w-4 h-4" />
                Online Sync Active
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-amber-400 font-medium text-xs">
                <WifiOff className="w-4 h-4" />
                Offline Mode (Progress Buffered)
              </span>
            )}
            {isSyncing && (
              <span className="flex items-center gap-1 text-blue-400 text-xs animate-pulse">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Syncing...
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsStorageManagerOpen(true)}
              className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg text-slate-200 transition-colors"
            >
              <HardDrive className="w-3.5 h-3.5 text-blue-400" />
              Storage Quota
            </button>
          </div>
        </div>

        {syncMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-medium flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            {syncMessage}
          </div>
        )}

        {/* Video / Content Display */}
        <div className="bg-slate-950 rounded-2xl overflow-hidden shadow-xl aspect-video relative flex items-center justify-center border border-slate-800">
          {currentLesson?.type === 'video' ? (
            <video
              ref={videoRef}
              src={currentLesson.videoUrl || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'}
              className="w-full h-full object-contain"
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={() => {
                if (videoRef.current) {
                  setDuration(videoRef.current.duration);
                }
              }}
              onEnded={() => saveProgressState(currentLesson.id, duration, true)}
            />
          ) : (
            <div className="p-8 text-slate-100 max-w-2xl overflow-y-auto max-h-full">
              <BookOpen className="w-12 h-12 text-blue-400 mb-4" />
              <h2 className="text-2xl font-bold mb-2">{currentLesson?.title}</h2>
              <p className="text-slate-300 leading-relaxed text-sm">
                {currentLesson?.articleContent || currentLesson?.description}
              </p>
            </div>
          )}

          {/* Controls Bar Overlay for Video */}
          {currentLesson?.type === 'video' && (
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-950/90 to-transparent p-4 flex flex-col gap-2">
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setCurrentTime(val);
                  if (videoRef.current) videoRef.current.currentTime = val;
                }}
                className="w-full accent-blue-500 h-1 bg-slate-700 rounded-lg cursor-pointer"
              />

              <div className="flex items-center justify-between text-slate-200 text-xs">
                <div className="flex items-center gap-3">
                  <button onClick={togglePlay} className="p-1.5 hover:bg-slate-800 rounded-lg text-white">
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                  </button>

                  <span>
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setIsMuted(!isMuted);
                      if (videoRef.current) videoRef.current.muted = !isMuted;
                    }}
                    className="p-1.5 hover:bg-slate-800 rounded-lg"
                  >
                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Lesson Metadata Header & Actions */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
                Lesson {currentLessonIndex + 1} of {lessons.length}
              </span>
              <h2 className="text-xl font-bold text-gray-900 mt-0.5">{currentLesson?.title}</h2>
              <p className="text-sm text-gray-600 mt-1">{currentLesson?.description}</p>
            </div>

            <div className="flex items-center gap-3">
              {/* Toggle Complete */}
              <button
                onClick={toggleLessonComplete}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  completedLessons.includes(currentLesson?.id)
                    ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                <CheckCircle className="w-4 h-4" />
                {completedLessons.includes(currentLesson?.id) ? 'Completed' : 'Mark Complete'}
              </button>

              {/* Download Offline Button */}
              {downloadedLessons[currentLesson?.id] ? (
                <button
                  onClick={() => handleDeleteDownloadedLesson(currentLesson.id)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-medium hover:bg-emerald-100 transition-colors"
                  title="Lesson downloaded offline. Click to remove."
                >
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  Downloaded
                </button>
              ) : (
                <button
                  onClick={() => handleDownloadLesson(currentLesson)}
                  disabled={downloadingLessonId === currentLesson?.id}
                  className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-xl text-xs font-medium transition-colors disabled:opacity-50"
                >
                  {downloadingLessonId === currentLesson?.id ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                  ) : (
                    <Download className="w-4 h-4 text-gray-500" />
                  )}
                  Save Offline
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar: Course Playlist & Progress */}
      <div className="w-full lg:w-80 space-y-4">
        {/* Progress Card */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-3">
          <div className="flex justify-between items-center text-sm font-bold text-gray-900">
            <span>Overall Course Progress</span>
            <span className="text-blue-600">{overallProgress}%</span>
          </div>

          <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${overallProgress}%` }}
            />
          </div>

          <p className="text-xs text-gray-500 font-mono">
            {completedLessons.length} of {lessons.length} lessons completed
          </p>
        </div>

        {/* Lessons List */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 bg-gray-50 border-b border-gray-200 font-bold text-sm text-gray-800 flex justify-between items-center">
            <span>Course Content</span>
            <span className="text-xs font-normal text-gray-500">{lessons.length} items</span>
          </div>

          <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
            {lessons.map((lesson, idx) => {
              const isActive = idx === currentLessonIndex;
              const isCompleted = completedLessons.includes(lesson.id);
              const isDownloaded = downloadedLessons[lesson.id];

              return (
                <div
                  key={lesson.id}
                  onClick={() => {
                    setCurrentLessonIndex(idx);
                    setCurrentTime(0);
                  }}
                  className={`p-3.5 flex items-center justify-between cursor-pointer transition-colors text-sm ${
                    isActive ? 'bg-blue-50/70 border-l-4 border-blue-600' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {isCompleted ? (
                      <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    ) : (
                      <span className="w-4 h-4 rounded-full border-2 border-gray-300 flex-shrink-0 text-[10px] flex items-center justify-center font-bold text-gray-400">
                        {idx + 1}
                      </span>
                    )}

                    <div>
                      <h4 className={`font-medium ${isActive ? 'text-blue-900 font-semibold' : 'text-gray-800'}`}>
                        {lesson.title}
                      </h4>
                      <span className="text-xs text-gray-500 font-mono">
                        {formatTime(lesson.durationSeconds || 120)}
                      </span>
                    </div>
                  </div>

                  {isDownloaded && (
                    <span className="text-emerald-600" title="Downloaded offline">
                      <Download className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Storage Quota Manager Drawer */}
      <OfflineDownloadManager
        courseId={courseId}
        isOpen={isStorageManagerOpen}
        onClose={() => setIsStorageManagerOpen(false)}
        onStorageChanged={checkDownloadedLessons}
      />
    </div>
  );
}
