import React, { useState, useEffect } from 'react';
import offlineService from '../services/offlineService';
import { Download, Wifi, WifiOff, Trash2, RefreshCw, HardDrive, Clock, CheckCircle, AlertCircle } from 'lucide-react';

const OfflineManager = ({ content, onDownloadComplete, onSyncComplete }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineContent, setOfflineContent] = useState([]);
  const [storageUsage, setStorageUsage] = useState({ totalSize: 0, fileCount: 0, contentCount: 0 });
  const [downloading, setDownloading] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initialize offline service and load data
    initializeOfflineData();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const initializeOfflineData = async () => {
    try {
      await offlineService.initDB();
      await loadOfflineContent();
      await updateStorageUsage();
    } catch (error) {
      console.error('Failed to initialize offline service:', error);
    }
  };

  const loadOfflineContent = async () => {
    try {
      const content = await offlineService.getAllOfflineContent();
      setOfflineContent(content);
    } catch (error) {
      console.error('Failed to load offline content:', error);
    }
  };

  const updateStorageUsage = async () => {
    try {
      const usage = await offlineService.getStorageUsage();
      setStorageUsage(usage);
    } catch (error) {
      console.error('Failed to get storage usage:', error);
    }
  };

  const downloadContent = async (content) => {
    if (downloading.includes(content._id)) return;

    setDownloading(prev => [...prev, content._id]);

    try {
      const filesToDownload = content.files || [];
      const result = await offlineService.downloadContent(content, filesToDownload);

      if (result.success) {
        await loadOfflineContent();
        await updateStorageUsage();
        
        if (onDownloadComplete) {
          onDownloadComplete(content, result);
        }
      }

      return result;
    } catch (error) {
      console.error('Download failed:', error);
      throw error;
    } finally {
      setDownloading(prev => prev.filter(id => id !== content._id));
    }
  };

  const deleteOfflineContent = async (contentId) => {
    try {
      await offlineService.deleteOfflineContent(contentId);
      await loadOfflineContent();
      await updateStorageUsage();
    } catch (error) {
      console.error('Failed to delete offline content:', error);
    }
  };

  const syncWithServer = async () => {
    if (!isOnline) return;

    setSyncing(true);
    try {
      const result = await offlineService.syncWithServer();
      setLastSyncTime(new Date());
      
      if (onSyncComplete) {
        onSyncComplete(result);
      }
      
      return result;
    } catch (error) {
      console.error('Sync failed:', error);
      throw error;
    } finally {
      setSyncing(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const isContentDownloaded = (contentId) => {
    return offlineContent.some(c => c.id === contentId && c.isDownloaded);
  };

  const getDownloadProgress = (contentId) => {
    const content = offlineContent.find(c => c.id === contentId);
    return content ? content.downloadProgress : 0;
  };

  // Component for individual content download status
  const ContentDownloadStatus = ({ content }) => {
    const isDownloaded = isContentDownloaded(content._id);
    const isDownloading = downloading.includes(content._id);
    const progress = getDownloadProgress(content._id);

    if (isDownloaded) {
      return (
        <div className="flex items-center space-x-2 text-green-600">
          <CheckCircle size={16} />
          <span className="text-sm">Downloaded</span>
          <button
            onClick={() => deleteOfflineContent(content._id)}
            className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
            title="Remove from offline"
          >
            <Trash2 size={14} />
          </button>
        </div>
      );
    }

    if (isDownloading) {
      return (
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-blue-600">
            Downloading... {Math.round(progress)}%
          </span>
        </div>
      );
    }

    return (
      <button
        onClick={() => downloadContent(content)}
        disabled={!isOnline}
        className="flex items-center space-x-1 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
      >
        <Download size={14} />
        <span>Download</span>
      </button>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Offline Content</h2>
          <p className="text-sm text-gray-600 mt-1">
            Download content for offline viewing
          </p>
        </div>
        <div className="flex items-center space-x-4">
          {/* Connection Status */}
          <div className="flex items-center space-x-2">
            {isOnline ? (
              <>
                <Wifi size={20} className="text-green-500" />
                <span className="text-sm text-green-600">Online</span>
              </>
            ) : (
              <>
                <WifiOff size={20} className="text-red-500" />
                <span className="text-sm text-red-600">Offline</span>
              </>
            )}
          </div>

          {/* Sync Button */}
          {isOnline && (
            <button
              onClick={syncWithServer}
              disabled={syncing}
              className="flex items-center space-x-1 px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              <span className="text-sm">{syncing ? 'Syncing...' : 'Sync'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Storage Usage */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <HardDrive size={20} className="text-gray-600" />
            <span className="font-medium text-gray-900">Storage Usage</span>
          </div>
          <span className="text-sm text-gray-600">
            {formatFileSize(storageUsage.totalSize)}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Files:</span>
            <span className="ml-2 font-medium">{storageUsage.fileCount}</span>
          </div>
          <div>
            <span className="text-gray-500">Content:</span>
            <span className="ml-2 font-medium">{storageUsage.contentCount}</span>
          </div>
          <div>
            <span className="text-gray-500">Last Sync:</span>
            <span className="ml-2 font-medium">
              {lastSyncTime ? lastSyncTime.toLocaleTimeString() : 'Never'}
            </span>
          </div>
        </div>
      </div>

      {/* Current Content Download Status */}
      {content && (
        <div className="border border-gray-200 rounded-lg p-4 mb-6">
          <h3 className="font-medium text-gray-900 mb-3">Current Content</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">{content.title}</p>
              <p className="text-sm text-gray-600">{content.type}</p>
            </div>
            <ContentDownloadStatus content={content} />
          </div>
        </div>
      )}

      {/* Downloaded Content List */}
      {offlineContent.length > 0 && (
        <div>
          <h3 className="font-medium text-gray-900 mb-3">Downloaded Content</h3>
          <div className="space-y-3">
            {offlineContent.map((item) => (
              <div
                key={item.id}
                className="border border-gray-200 rounded-lg p-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{item.title}</p>
                    <p className="text-sm text-gray-600 capitalize">{item.type}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <Clock size={14} className="text-gray-400" />
                      <span className="text-xs text-gray-500">
                        Downloaded {new Date(item.downloadedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {item.isDownloaded ? (
                      <span className="text-green-600 text-sm">Available offline</span>
                    ) : (
                      <span className="text-yellow-600 text-sm">
                        {Math.round(item.downloadProgress)}% downloaded
                      </span>
                    )}
                    <button
                      onClick={() => deleteOfflineContent(item.id)}
                      className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Remove from offline"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {offlineContent.length === 0 && (
        <div className="text-center py-8">
          <AlertCircle size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500 mb-2">No offline content yet</p>
          <p className="text-sm text-gray-400">
            Download content to access it when you're offline
          </p>
        </div>
      )}

      {/* Offline Instructions */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2">Offline Mode Tips</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Download content while connected to WiFi</li>
          <li>• Your progress is saved locally and synced when online</li>
          <li>• Offline content expires after 30 days</li>
          <li>• Manage storage to keep your most important content</li>
        </ul>
      </div>
    </div>
  );
};

export default OfflineManager;
