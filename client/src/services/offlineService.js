// Offline Content Management Service
class OfflineContentService {
  constructor() {
    this.dbName = 'StarkedEducationOffline';
    this.dbVersion = 1;
    this.db = null;
    this.deviceId = this.getDeviceId();
  }

  getDeviceId() {
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
      deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
  }

  async initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Content store
        if (!db.objectStoreNames.contains('content')) {
          const contentStore = db.createObjectStore('content', { keyPath: 'id' });
          contentStore.createIndex('courseId', 'courseId', { unique: false });
          contentStore.createIndex('type', 'type', { unique: false });
          contentStore.createIndex('downloadedAt', 'downloadedAt', { unique: false });
        }

        // Progress store
        if (!db.objectStoreNames.contains('progress')) {
          const progressStore = db.createObjectStore('progress', { keyPath: ['contentId', 'deviceId'] });
          progressStore.createIndex('contentId', 'contentId', { unique: false });
          progressStore.createIndex('deviceId', 'deviceId', { unique: false });
        }

        // Bookmarks store
        if (!db.objectStoreNames.contains('bookmarks')) {
          const bookmarksStore = db.createObjectStore('bookmarks', { keyPath: 'id', autoIncrement: true });
          bookmarksStore.createIndex('contentId', 'contentId', { unique: false });
          bookmarksStore.createIndex('deviceId', 'deviceId', { unique: false });
        }

        // Notes store
        if (!db.objectStoreNames.contains('notes')) {
          const notesStore = db.createObjectStore('notes', { keyPath: 'id', autoIncrement: true });
          notesStore.createIndex('contentId', 'contentId', { unique: false });
          notesStore.createIndex('deviceId', 'deviceId', { unique: false });
        }

        // Files store (for actual file blobs)
        if (!db.objectStoreNames.contains('files')) {
          const filesStore = db.createObjectStore('files', { keyPath: 'id' });
          filesStore.createIndex('contentId', 'contentId', { unique: false });
        }
      };
    });
  }

  async downloadContent(content, files) {
    if (!this.db) await this.initDB();

    const transaction = this.db.transaction(['content', 'files'], 'readwrite');
    const contentStore = transaction.objectStore('content');
    const filesStore = transaction.objectStore('files');

    try {
      // Store content metadata
      const contentData = {
        id: content._id,
        ...content,
        downloadedAt: new Date(),
        deviceId: this.deviceId,
        isDownloaded: false,
        downloadProgress: 0
      };

      await contentStore.add(contentData);

      // Download and store files
      const filePromises = files.map(async (file) => {
        try {
          const response = await fetch(file.url);
          const blob = await response.blob();
          
          const fileData = {
            id: `${content._id}_${file.type}`,
            contentId: content._id,
            type: file.type,
            blob: blob,
            size: blob.size,
            downloadedAt: new Date()
          };

          await filesStore.add(fileData);
          return { success: true, type: file.type };
        } catch (error) {
          console.error(`Failed to download ${file.type}:`, error);
          return { success: false, type: file.type, error };
        }
      });

      const results = await Promise.all(filePromises);
      const successCount = results.filter(r => r.success).length;
      
      // Update content with download status
      contentData.isDownloaded = successCount === files.length;
      contentData.downloadProgress = (successCount / files.length) * 100;
      
      await contentStore.put(contentData);

      return {
        success: successCount === files.length,
        downloadedFiles: successCount,
        totalFiles: files.length,
        results
      };

    } catch (error) {
      console.error('Download failed:', error);
      throw error;
    }
  }

  async getOfflineContent(contentId) {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['content', 'files'], 'readonly');
      const contentStore = transaction.objectStore('content');
      const filesStore = transaction.objectStore('files');

      const contentRequest = contentStore.get(contentId);
      contentRequest.onsuccess = () => {
        const content = contentRequest.result;
        
        if (!content) {
          resolve(null);
          return;
        }

        // Get associated files
        const filesRequest = filesStore.index('contentId').getAll(contentId);
        filesRequest.onsuccess = () => {
          const files = filesRequest.result.map(file => ({
            type: file.type,
            blob: file.blob,
            size: file.size,
            url: URL.createObjectURL(file.blob)
          }));

          resolve({
            ...content,
            files
          });
        };
      };

      contentRequest.onerror = () => reject(contentRequest.error);
    });
  }

  async getAllOfflineContent() {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['content'], 'readonly');
      const store = transaction.objectStore('content');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async updateProgress(contentId, progressData) {
    if (!this.db) await this.initDB();

    const transaction = this.db.transaction(['progress'], 'readwrite');
    const store = transaction.objectStore('progress');

    const progressRecord = {
      contentId,
      deviceId: this.deviceId,
      ...progressData,
      updatedAt: new Date()
    };

    return new Promise((resolve, reject) => {
      const request = store.put(progressRecord);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getProgress(contentId) {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['progress'], 'readonly');
      const store = transaction.objectStore('progress');
      const request = store.get([contentId, this.deviceId]);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async addBookmark(contentId, timestamp, note = '') {
    if (!this.db) await this.initDB();

    const transaction = this.db.transaction(['bookmarks'], 'readwrite');
    const store = transaction.objectStore('bookmarks');

    const bookmark = {
      contentId,
      deviceId: this.deviceId,
      timestamp,
      note,
      createdAt: new Date()
    };

    return new Promise((resolve, reject) => {
      const request = store.add(bookmark);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getBookmarks(contentId) {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['bookmarks'], 'readonly');
      const store = transaction.objectStore('bookmarks');
      const index = store.index('contentId');
      const request = index.getAll(contentId);

      request.onsuccess = () => {
        const bookmarks = request.result.filter(b => b.deviceId === this.deviceId);
        resolve(bookmarks);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async addNote(contentId, timestamp, text, tags = []) {
    if (!this.db) await this.initDB();

    const transaction = this.db.transaction(['notes'], 'readwrite');
    const store = transaction.objectStore('notes');

    const note = {
      contentId,
      deviceId: this.deviceId,
      timestamp,
      text,
      tags,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return new Promise((resolve, reject) => {
      const request = store.add(note);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getNotes(contentId) {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['notes'], 'readonly');
      const store = transaction.objectStore('notes');
      const index = store.index('contentId');
      const request = index.getAll(contentId);

      request.onsuccess = () => {
        const notes = request.result.filter(n => n.deviceId === this.deviceId);
        resolve(notes);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getStorageUsage() {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['files'], 'readonly');
      const store = transaction.objectStore('files');
      const request = store.getAll();

      request.onsuccess = () => {
        const files = request.result.filter(f => f.deviceId === this.deviceId);
        const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);
        
        resolve({
          totalSize,
          fileCount: files.length,
          contentCount: new Set(files.map(f => f.contentId)).size
        });
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteOfflineContent(contentId) {
    if (!this.db) await this.initDB();

    const transaction = this.db.transaction(['content', 'files', 'progress', 'bookmarks', 'notes'], 'readwrite');
    
    const stores = ['content', 'files', 'progress', 'bookmarks', 'notes'].map(name => 
      transaction.objectStore(name)
    );

    const promises = stores.map(store => {
      return new Promise((resolve, reject) => {
        if (store.name === 'files') {
          const index = store.index('contentId');
          const request = index.openCursor(IDBKeyRange.only(contentId));
          
          request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
              // Revoke object URL if it exists
              if (cursor.value.blob) {
                URL.revokeObjectURL(cursor.value.blob);
              }
              cursor.delete();
              cursor.continue();
            } else {
              resolve();
            }
          };
          request.onerror = () => reject(request.error);
        } else {
          const request = store.delete(contentId);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        }
      });
    });

    try {
      await Promise.all(promises);
      return true;
    } catch (error) {
      console.error('Failed to delete offline content:', error);
      throw error;
    }
  }

  async syncWithServer() {
    // Sync offline data with server when online
    if (!navigator.onLine) {
      return { success: false, reason: 'Offline' };
    }

    try {
      const offlineContent = await this.getAllOfflineContent();
      const syncPromises = [];

      // Sync progress
      for (const content of offlineContent) {
        const progress = await this.getProgress(content.id);
        if (progress) {
          syncPromises.push(
            fetch('/api/progress/sync', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
              },
              body: JSON.stringify(progress)
            })
          );
        }
      }

      // Sync bookmarks and notes
      const bookmarks = await this.getBookmarks();
      const notes = await this.getNotes();

      // Add sync logic for bookmarks and notes...

      await Promise.all(syncPromises);
      return { success: true, synced: syncPromises.length };
    } catch (error) {
      console.error('Sync failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Cleanup expired content
  async cleanupExpiredContent() {
    if (!this.db) await this.initDB();

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['content'], 'readwrite');
      const store = transaction.objectStore('content');
      const index = store.index('downloadedAt');
      const request = index.openCursor(IDBKeyRange.upperBound(thirtyDaysAgo));

      const expiredContent = [];

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          expiredContent.push(cursor.value.id);
          cursor.delete();
          cursor.continue();
        } else {
          // Clean up associated files
          this.cleanupExpiredFiles(expiredContent).then(() => {
            resolve(expiredContent.length);
          }).catch(reject);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  async cleanupExpiredFiles(contentIds) {
    const transaction = this.db.transaction(['files'], 'readwrite');
    const store = transaction.objectStore('files');

    for (const contentId of contentIds) {
      const index = store.index('contentId');
      const request = index.openCursor(IDBKeyRange.only(contentId));

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          // Revoke object URL if it exists
          if (cursor.value.blob) {
            URL.revokeObjectURL(cursor.value.blob);
          }
          cursor.delete();
          cursor.continue();
        }
      };
    }
  }
}

// Singleton instance
const offlineService = new OfflineContentService();

export default offlineService;
