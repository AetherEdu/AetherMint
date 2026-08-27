'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  HardDrive,
  Trash2,
  Download,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  FolderDown,
  X,
  Database
} from 'lucide-react';
import {
  listAllOfflineLessons,
  deleteOfflineLesson,
  clearStore,
  getStorageQuotaInfo,
  OfflineLessonRecord,
  StorageQuotaInfo
} from '@/utils/offlineDB';

interface OfflineDownloadManagerProps {
  courseId?: string;
  isOpen: boolean;
  onClose: () => void;
  onStorageChanged?: () => void;
}

export default function OfflineDownloadManager({
  courseId,
  isOpen,
  onClose,
  onStorageChanged
}: OfflineDownloadManagerProps) {
  const [offlineLessons, setOfflineLessons] = useState<OfflineLessonRecord[]>([]);
  const [quotaInfo, setQuotaInfo] = useState<StorageQuotaInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchStorageData = useCallback(async () => {
    try {
      setLoading(true);
      const [allLessons, quota] = await Promise.all([
        listAllOfflineLessons(),
        getStorageQuotaInfo(),
      ]);

      const filtered = courseId
        ? allLessons.filter(l => l.courseId === courseId)
        : allLessons;

      setOfflineLessons(filtered);
      setQuotaInfo(quota);
    } catch (error) {
      console.error('Failed to load offline storage data:', error);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    if (isOpen) {
      fetchStorageData();
    }
  }, [isOpen, fetchStorageData]);

  const handleDeleteLesson = async (lesson: OfflineLessonRecord) => {
    try {
      setDeletingId(lesson.id);
      await deleteOfflineLesson(lesson.courseId, lesson.lessonId);
      await fetchStorageData();
      if (onStorageChanged) onStorageChanged();
    } catch (error) {
      console.error('Failed to delete offline lesson:', error);
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearAllDownloads = async () => {
    if (!confirm('Are you sure you want to delete all downloaded offline lessons?')) return;
    try {
      setLoading(true);
      await clearStore('lessons');
      await fetchStorageData();
      if (onStorageChanged) onStorageChanged();
    } catch (error) {
      console.error('Failed to clear offline lessons:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl max-w-xl w-full max-h-[85vh] overflow-y-auto p-6 shadow-2xl border border-gray-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Database className="w-6 h-6 text-blue-600" />
            <h2 className="text-lg font-bold text-gray-900">Storage & Download Manager</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quota Usage Gauge */}
        {quotaInfo && (
          <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                <HardDrive className="w-4 h-4 text-slate-500" />
                Browser Storage Quota
              </span>
              <span className="text-slate-600 font-mono text-xs">
                {formatBytes(quotaInfo.usage)} / {formatBytes(quotaInfo.quota)}
              </span>
            </div>

            <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-2.5 rounded-full transition-all duration-500 ${
                  quotaInfo.usagePercentage > 85 ? 'bg-rose-500' : 'bg-blue-600'
                }`}
                style={{ width: `${Math.max(2, quotaInfo.usagePercentage)}%` }}
              />
            </div>

            <div className="flex justify-between text-xs text-slate-500">
              <span>{quotaInfo.usagePercentage.toFixed(1)}% Used</span>
              <span>{formatBytes(quotaInfo.availableBytes)} Available</span>
            </div>
          </div>
        )}

        {/* Action Header */}
        <div className="mt-6 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
            <FolderDown className="w-4 h-4 text-blue-600" />
            Downloaded Lessons ({offlineLessons.length})
          </h3>

          {offlineLessons.length > 0 && (
            <button
              onClick={handleClearAllDownloads}
              className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-800 font-medium transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear All Downloads
            </button>
          )}
        </div>

        {/* Lessons List */}
        <div className="mt-3 space-y-2">
          {loading ? (
            <div className="py-8 text-center text-gray-500 flex justify-center items-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
              Checking offline storage...
            </div>
          ) : offlineLessons.length === 0 ? (
            <div className="py-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200 p-6 text-gray-500 text-sm">
              <FolderDown className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              No offline lessons stored. Download lessons to study offline!
            </div>
          ) : (
            offlineLessons.map((lesson) => (
              <div
                key={lesson.id}
                className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-200 hover:border-gray-300 transition-all text-sm"
              >
                <div>
                  <h4 className="font-medium text-gray-900">{lesson.title}</h4>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5 font-mono">
                    <span>Course: {lesson.courseId}</span>
                    <span>•</span>
                    <span>Size: {formatBytes(lesson.sizeBytes)}</span>
                    <span>•</span>
                    <span>{new Date(lesson.downloadedAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <button
                  onClick={() => handleDeleteLesson(lesson)}
                  disabled={deletingId === lesson.id}
                  className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50"
                  title="Delete Offline Lesson"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Modal Footer */}
        <div className="mt-6 pt-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 text-sm font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
