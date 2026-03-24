import React, { useState, useEffect } from 'react';
import VideoPlayer from './VideoPlayer';
import AudioPlayer from './AudioPlayer';
import DocumentViewer from './DocumentViewer';
import CodeEditor from './CodeEditor';
import { Book, FileText, Code, Video, Music, Download, Share2, Bookmark, Note } from 'lucide-react';

const ContentPlayer = ({ contentId, courseId, onStartProgress, onSaveProgress }) => {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bookmarks, setBookmarks] = useState([]);
  const [notes, setNotes] = useState([]);
  const [userProgress, setUserProgress] = useState(null);
  const [showNotesPanel, setShowNotesPanel] = useState(false);
  const [showBookmarksPanel, setShowBookmarksPanel] = useState(false);

  useEffect(() => {
    fetchContent();
    fetchBookmarks();
    fetchNotes();
    fetchUserProgress();
  }, [contentId]);

  const fetchContent = async () => {
    try {
      const response = await fetch(`/api/content/${contentId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch content');
      
      const data = await response.json();
      setContent(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchBookmarks = async () => {
    try {
      const response = await fetch(`/api/bookmarks?contentId=${contentId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setBookmarks(data);
      }
    } catch (err) {
      console.error('Failed to fetch bookmarks:', err);
    }
  };

  const fetchNotes = async () => {
    try {
      const response = await fetch(`/api/bookmarks/notes?contentId=${contentId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setNotes(data);
      }
    } catch (err) {
      console.error('Failed to fetch notes:', err);
    }
  };

  const fetchUserProgress = async () => {
    try {
      const response = await fetch(`/api/progress/content/${contentId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setUserProgress(data);
      }
    } catch (err) {
      console.error('Failed to fetch progress:', err);
    }
  };

  const handleProgress = async (progressData) => {
    try {
      const response = await fetch('/api/progress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          content: contentId,
          ...progressData
        })
      });

      if (response.ok) {
        const data = await response.json();
        setUserProgress(data);
        if (onSaveProgress) onSaveProgress(data);
      }
    } catch (err) {
      console.error('Failed to save progress:', err);
    }
  };

  const handleBookmark = async (bookmarkData) => {
    try {
      const response = await fetch('/api/bookmarks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(bookmarkData)
      });

      if (response.ok) {
        const data = await response.json();
        setBookmarks(prev => {
          const filtered = prev.filter(b => b._id !== data._id);
          return [...filtered, data];
        });
      }
    } catch (err) {
      console.error('Failed to save bookmark:', err);
    }
  };

  const handleNote = async (noteData) => {
    try {
      const response = await fetch('/api/bookmarks/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          contentId,
          ...noteData
        })
      });

      if (response.ok) {
        const data = await response.json();
        setNotes(prev => [data, ...prev]);
      }
    } catch (err) {
      console.error('Failed to save note:', err);
    }
  };

  const shareContent = () => {
    const shareUrl = `${window.location.origin}/course/${courseId}/content/${contentId}`;
    
    if (navigator.share) {
      navigator.share({
        title: content?.title,
        text: content?.description,
        url: shareUrl
      });
    } else {
      navigator.clipboard.writeText(shareUrl);
      // Show toast notification
    }
  };

  const downloadContent = () => {
    // Implement offline download functionality
    console.log('Download for offline viewing');
  };

  const renderContentPlayer = () => {
    if (!content) return null;

    const startTime = userProgress?.currentTime || userProgress?.timestamp || 0;

    switch (content.type) {
      case 'video':
        return (
          <VideoPlayer
            content={content}
            onProgress={handleProgress}
            onBookmark={handleBookmark}
            bookmarks={bookmarks}
            startTime={startTime}
          />
        );
      
      case 'audio':
        return (
          <AudioPlayer
            content={content}
            onProgress={handleProgress}
            onBookmark={handleBookmark}
            bookmarks={bookmarks}
            startTime={startTime}
          />
        );
      
      case 'document':
        return (
          <DocumentViewer
            content={content}
            onProgress={handleProgress}
            onBookmark={handleBookmark}
            bookmarks={bookmarks}
            startPage={userProgress?.currentPage || 1}
          />
        );
      
      case 'code':
        return (
          <CodeEditor
            content={content}
            onProgress={handleProgress}
            onBookmark={handleBookmark}
            bookmarks={bookmarks}
            initialCode={content.metadata?.code}
            language={content.metadata?.language || 'javascript'}
          />
        );
      
      case 'text':
      case 'interactive':
        return (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="prose max-w-none">
              <h1>{content.title}</h1>
              <div 
                dangerouslySetInnerHTML={{ __html: content.description }}
                className="text-gray-700 leading-relaxed"
              />
            </div>
          </div>
        );
      
      default:
        return (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="text-center text-gray-500">
              <FileText size={48} className="mx-auto mb-4" />
              <p>Content type not supported yet</p>
            </div>
          </div>
        );
    }
  };

  const getContentIcon = (type) => {
    const icons = {
      video: Video,
      audio: Music,
      document: FileText,
      code: Code,
      text: Book,
      interactive: Book
    };
    return icons[type] || FileText;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="text-red-800">
          <h3 className="font-semibold mb-2">Error loading content</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <div className="text-gray-500 text-center">
          <FileText size={48} className="mx-auto mb-4" />
          <p>Content not found</p>
        </div>
      </div>
    );
  }

  const ContentIcon = getContentIcon(content.type);

  return (
    <div className="max-w-6xl mx-auto">
      {/* Content Header */}
      <div className="bg-white rounded-lg shadow-lg mb-6">
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <ContentIcon size={24} className="text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">{content.title}</h1>
                <p className="text-gray-600 mb-4">{content.description}</p>
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  <span className="capitalize">{content.type}</span>
                  {content.duration && (
                    <span>{Math.floor(content.duration / 60)} min</span>
                  )}
                  {content.metadata?.difficulty && (
                    <span className="capitalize">{content.metadata.difficulty}</span>
                  )}
                  {content.isPremium && (
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold">
                      Premium
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowBookmarksPanel(!showBookmarksPanel)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Bookmarks"
              >
                <Bookmark size={20} />
              </button>
              <button
                onClick={() => setShowNotesPanel(!showNotesPanel)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Notes"
              >
                <Note size={20} />
              </button>
              <button
                onClick={shareContent}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Share"
              >
                <Share2 size={20} />
              </button>
              <button
                onClick={downloadContent}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Download for offline"
              >
                <Download size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          {renderContentPlayer()}
        </div>

        {/* Side Panels */}
        <div className="space-y-6">
          {/* Bookmarks Panel */}
          {showBookmarksPanel && (
            <div className="bg-white rounded-lg shadow-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Bookmarks</h3>
              {bookmarks.length > 0 ? (
                <div className="space-y-2">
                  {bookmarks.map((bookmark, index) => (
                    <div
                      key={index}
                      className="p-2 bg-gray-50 rounded text-sm"
                    >
                      <div className="font-medium text-gray-700">
                        {content.type === 'document' 
                          ? `Page ${bookmark.timestamp}`
                          : formatTime(bookmark.timestamp)
                        }
                      </div>
                      {bookmark.note && (
                        <div className="text-gray-500 text-xs mt-1">
                          {bookmark.note}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No bookmarks yet</p>
              )}
            </div>
          )}

          {/* Notes Panel */}
          {showNotesPanel && (
            <div className="bg-white rounded-lg shadow-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Notes</h3>
              <NoteInput
                contentId={contentId}
                onSave={handleNote}
                currentTime={userProgress?.currentTime || 0}
              />
              {notes.length > 0 && (
                <div className="mt-4 space-y-2">
                  {notes.slice(0, 5).map((note, index) => (
                    <div
                      key={index}
                      className="p-2 bg-gray-50 rounded text-sm"
                    >
                      <div className="font-medium text-gray-700">
                        {formatTime(note.timestamp)}
                      </div>
                      <div className="text-gray-600 mt-1">
                        {note.text}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Progress Info */}
          {userProgress && (
            <div className="bg-white rounded-lg shadow-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Your Progress</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Progress:</span>
                  <span className="font-medium">
                    {userProgress.completed ? 'Completed' : 'In Progress'}
                  </span>
                </div>
                {userProgress.timeSpent && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Time spent:</span>
                    <span className="font-medium">
                      {formatTime(userProgress.timeSpent)}
                    </span>
                  </div>
                )}
                {userProgress.watchTime && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Watch time:</span>
                    <span className="font-medium">
                      {formatTime(userProgress.watchTime)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const NoteInput = ({ contentId, onSave, currentTime }) => {
  const [text, setText] = useState('');
  const [timestamp, setTimestamp] = useState(currentTime);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (text.trim()) {
      onSave({
        text: text.trim(),
        timestamp,
        isPrivate: true,
        tags: []
      });
      setText('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add a note..."
        className="w-full p-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
        rows={3}
      />
      <div className="flex items-center justify-between">
        <input
          type="number"
          value={timestamp}
          onChange={(e) => setTimestamp(parseFloat(e.target.value))}
          placeholder="Timestamp"
          className="w-24 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          step="1"
        />
        <button
          type="submit"
          className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors"
        >
          Save Note
        </button>
      </div>
    </form>
  );
};

const formatTime = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` 
              : `${m}:${s.toString().padStart(2, '0')}`;
};

export default ContentPlayer;
