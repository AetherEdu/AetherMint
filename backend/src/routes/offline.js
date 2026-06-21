const express = require('express');
const router = express.Router();
const OfflineContent = require('../models/OfflineContent');
const Content = require('../models/Content');
const auth = require('../middleware/auth');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Get all offline content for a user
router.get('/', auth, async (req, res) => {
  try {
    const { deviceId } = req.query;
    
    if (!deviceId) {
      return res.status(400).json({ error: 'Device ID is required' });
    }
    
    const offlineContent = await OfflineContent.find({
      user: req.user.id,
      deviceId
    })
    .populate('content', 'title type duration files metadata')
    .sort({ lastAccessed: -1 });
    
    res.json(offlineContent);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Request content for offline download
router.post('/request', auth, async (req, res) => {
  try {
    const { contentId, deviceId, quality = 'medium' } = req.body;
    
    if (!contentId || !deviceId) {
      return res.status(400).json({ error: 'Content ID and Device ID are required' });
    }
    
    const content = await Content.findById(contentId);
    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }
    
    // Check if content allows offline download
    if (content.isPremium) {
      // Add premium validation logic here
      // For now, allow premium content for offline download
    }
    
    // Check if already downloaded
    const existing = await OfflineContent.findOne({
      user: req.user.id,
      content: contentId,
      deviceId
    });
    
    if (existing) {
      return res.json(existing);
    }
    
    // Create offline content record
    const offlineContent = new OfflineContent({
      user: req.user.id,
      content: contentId,
      deviceId,
      cachedFiles: [],
      isDownloaded: false,
      downloadProgress: 0
    });
    
    await offlineContent.save();
    await offlineContent.populate('content', 'title type duration files metadata');
    
    res.status(201).json(offlineContent);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update download progress
router.put('/:offlineId/progress', auth, async (req, res) => {
  try {
    const { progress, fileData } = req.body;
    
    const offlineContent = await OfflineContent.findOne({
      _id: req.params.offlineId,
      user: req.user.id
    });
    
    if (!offlineContent) {
      return res.status(404).json({ error: 'Offline content not found' });
    }
    
    offlineContent.downloadProgress = Math.min(100, Math.max(0, progress));
    
    if (fileData) {
      const existingFile = offlineContent.cachedFiles.find(
        f => f.type === fileData.type
      );
      
      if (existingFile) {
        existingFile.localPath = fileData.localPath;
        existingFile.size = fileData.size;
        existingFile.checksum = fileData.checksum;
      } else {
        offlineContent.cachedFiles.push(fileData);
      }
    }
    
    if (offlineContent.downloadProgress === 100) {
      offlineContent.isDownloaded = true;
    }
    
    await offlineContent.save();
    res.json(offlineContent);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark content as accessed
router.put('/:offlineId/access', auth, async (req, res) => {
  try {
    const offlineContent = await OfflineContent.findOneAndUpdate(
      {
        _id: req.params.offlineId,
        user: req.user.id
      },
      { 
        lastAccessed: new Date(),
        $inc: { 'content.viewCount': 1 }
      },
      { new: true }
    ).populate('content', 'title type duration');
    
    if (!offlineContent) {
      return res.status(404).json({ error: 'Offline content not found' });
    }
    
    res.json(offlineContent);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete offline content
router.delete('/:offlineId', auth, async (req, res) => {
  try {
    const offlineContent = await OfflineContent.findOneAndDelete({
      _id: req.params.offlineId,
      user: req.user.id
    });
    
    if (!offlineContent) {
      return res.status(404).json({ error: 'Offline content not found' });
    }
    
    // Optionally delete actual files from filesystem
    offlineContent.cachedFiles.forEach(file => {
      if (file.localPath && fs.existsSync(file.localPath)) {
        try {
          fs.unlinkSync(file.localPath);
        } catch (err) {
          console.error('Failed to delete file:', err);
        }
      }
    });
    
    res.json({ message: 'Offline content deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get storage usage for a device
router.get('/storage/:deviceId', auth, async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    const offlineContent = await OfflineContent.find({
      user: req.user.id,
      deviceId,
      isDownloaded: true
    });
    
    let totalSize = 0;
    let fileCount = 0;
    
    offlineContent.forEach(item => {
      item.cachedFiles.forEach(file => {
        totalSize += file.size || 0;
        fileCount++;
      });
    });
    
    res.json({
      totalSize,
      fileCount,
      contentCount: offlineContent.length,
      deviceId
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
