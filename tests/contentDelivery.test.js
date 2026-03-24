const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const Content = require('../models/Content');
const Course = require('../models/Course');
const User = require('../models/User');
const Progress = require('../models/Progress');
const Bookmark = require('../models/Bookmark');
const Note = require('../models/Note');

describe('Content Delivery System Tests', () => {
  let token, instructorToken, testUser, instructorUser, testCourse, testContent;

  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/starked-education-test');
    
    // Create test users
    testUser = new User({
      username: 'teststudent',
      email: 'student@test.com',
      password: 'password123',
      role: 'student'
    });
    await testUser.save();

    instructorUser = new User({
      username: 'testinstructor',
      email: 'instructor@test.com',
      password: 'password123',
      role: 'instructor'
    });
    await instructorUser.save();

    // Get tokens
    const studentResponse = await request(app)
      .post('/api/users/login')
      .send({ email: 'student@test.com', password: 'password123' });
    token = studentResponse.body.token;

    const instructorResponse = await request(app)
      .post('/api/users/login')
      .send({ email: 'instructor@test.com', password: 'password123' });
    instructorToken = instructorResponse.body.token;

    // Create test course
    testCourse = new Course({
      title: 'Test Course',
      description: 'A test course for content delivery',
      instructor: instructorUser._id,
      isPublished: true
    });
    await testCourse.save();
  });

  afterAll(async () => {
    // Clean up test data
    await User.deleteMany({});
    await Course.deleteMany({});
    await Content.deleteMany({});
    await Progress.deleteMany({});
    await Bookmark.deleteMany({});
    await Note.deleteMany({});
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clean up content before each test
    await Content.deleteMany({});
    await Progress.deleteMany({});
    await Bookmark.deleteMany({});
    await Note.deleteMany({});
  });

  describe('Content Management API', () => {
    beforeEach(async () => {
      // Create test content
      testContent = new Content({
        title: 'Test Video Content',
        description: 'A test video for learning',
        type: 'video',
        course: testCourse._id,
        module: new mongoose.Types.ObjectId(),
        order: 1,
        duration: 600,
        files: [{
          type: 'video',
          url: 'https://example.com/video.mp4',
          format: 'mp4',
          size: 50000000,
          quality: '1080p'
        }],
        metadata: {
          difficulty: 'beginner',
          tags: ['javascript', 'programming'],
          resolution: '1920x1080',
          bitrate: 5000
        },
        isPublished: true
      });
      await testContent.save();
    });

    test('GET /api/content/:id - should fetch content by ID', async () => {
      const response = await request(app)
        .get(`/api/content/${testContent._id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.title).toBe('Test Video Content');
      expect(response.body.type).toBe('video');
      expect(response.body.viewCount).toBe(1); // Should increment view count
    });

    test('GET /api/content/course/:courseId - should fetch course content', async () => {
      const response = await request(app)
        .get(`/api/content/course/${testCourse._id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0].title).toBe('Test Video Content');
    });

    test('GET /api/content/search - should search content', async () => {
      // Add more test content
      await Content.create({
        title: 'JavaScript Basics',
        description: 'Learn JavaScript fundamentals',
        type: 'video',
        course: testCourse._id,
        module: new mongoose.Types.ObjectId(),
        order: 2,
        isPublished: true,
        metadata: {
          tags: ['javascript', 'basics']
        }
      });

      const response = await request(app)
        .get('/api/content/search?q=javascript')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.content.length).toBe(2);
      expect(response.body.pagination).toBeDefined();
    });

    test('POST /api/content - should create new content (instructor only)', async () => {
      const newContent = {
        title: 'New Video Content',
        description: 'Another test video',
        type: 'video',
        course: testCourse._id,
        module: new mongoose.Types.ObjectId(),
        order: 2,
        duration: 300
      };

      const response = await request(app)
        .post('/api/content')
        .set('Authorization', `Bearer ${instructorToken}`)
        .send(newContent)
        .expect(201);

      expect(response.body.title).toBe('New Video Content');
      expect(response.body.type).toBe('video');
    });

    test('POST /api/content - should fail for non-instructor', async () => {
      const newContent = {
        title: 'New Video Content',
        description: 'Another test video',
        type: 'video',
        course: testCourse._id,
        module: new mongoose.Types.ObjectId(),
        order: 2
      };

      await request(app)
        .post('/api/content')
        .set('Authorization', `Bearer ${token}`)
        .send(newContent)
        .expect(403);
    });
  });

  describe('Progress Tracking', () => {
    beforeEach(async () => {
      testContent = new Content({
        title: 'Test Content for Progress',
        type: 'video',
        course: testCourse._id,
        module: new mongoose.Types.ObjectId(),
        order: 1,
        duration: 600,
        isPublished: true
      });
      await testContent.save();
    });

    test('POST /api/progress - should track progress', async () => {
      const progressData = {
        content: testContent._id,
        currentTime: 300,
        watchTime: 300,
        timeSpent: 300
      };

      const response = await request(app)
        .post('/api/progress')
        .set('Authorization', `Bearer ${token}`)
        .send(progressData)
        .expect(201);

      expect(response.body.content).toBe(testContent._id.toString());
      expect(response.body.currentTime).toBe(300);
    });

    test('GET /api/progress/content/:contentId - should get content progress', async () => {
      // Create progress first
      await Progress.create({
        user: testUser._id,
        content: testContent._id,
        currentTime: 300,
        watchTime: 300,
        completed: false
      });

      const response = await request(app)
        .get(`/api/progress/content/${testContent._id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.currentTime).toBe(300);
      expect(response.body.completed).toBe(false);
    });
  });

  describe('Bookmarks and Notes', () => {
    beforeEach(async () => {
      testContent = new Content({
        title: 'Test Content for Bookmarks',
        type: 'video',
        course: testCourse._id,
        module: new mongoose.Types.ObjectId(),
        order: 1,
        duration: 600,
        isPublished: true
      });
      await testContent.save();
    });

    test('POST /api/bookmarks - should create bookmark', async () => {
      const bookmarkData = {
        contentId: testContent._id,
        timestamp: 300,
        note: 'Important section'
      };

      const response = await request(app)
        .post('/api/bookmarks')
        .set('Authorization', `Bearer ${token}`)
        .send(bookmarkData)
        .expect(200);

      expect(response.body.content).toBe(testContent._id.toString());
      expect(response.body.timestamp).toBe(300);
      expect(response.body.note).toBe('Important section');
    });

    test('GET /api/bookmarks - should get user bookmarks', async () => {
      // Create bookmark first
      await Bookmark.create({
        user: testUser._id,
        content: testContent._id,
        timestamp: 300,
        note: 'Test bookmark'
      });

      const response = await request(app)
        .get('/api/bookmarks')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0].note).toBe('Test bookmark');
    });

    test('POST /api/bookmarks/notes - should create note', async () => {
      const noteData = {
        contentId: testContent._id,
        timestamp: 300,
        text: 'This is a test note',
        tags: ['important', 'review']
      };

      const response = await request(app)
        .post('/api/bookmarks/notes')
        .set('Authorization', `Bearer ${token}`)
        .send(noteData)
        .expect(201);

      expect(response.body.content).toBe(testContent._id.toString());
      expect(response.body.text).toBe('This is a test note');
      expect(response.body.tags).toEqual(['important', 'review']);
    });

    test('GET /api/bookmarks/notes - should get user notes', async () => {
      // Create note first
      await Note.create({
        user: testUser._id,
        content: testContent._id,
        timestamp: 300,
        text: 'Test note',
        tags: ['test']
      });

      const response = await request(app)
        .get('/api/bookmarks/notes')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0].text).toBe('Test note');
    });
  });

  describe('Offline Content Management', () => {
    beforeEach(async () => {
      testContent = new Content({
        title: 'Test Offline Content',
        type: 'video',
        course: testCourse._id,
        module: new mongoose.Types.ObjectId(),
        order: 1,
        duration: 600,
        files: [{
          type: 'video',
          url: 'https://example.com/video.mp4',
          format: 'mp4',
          size: 50000000
        }],
        isPublished: true
      });
      await testContent.save();
    });

    test('POST /api/offline/request - should request offline download', async () => {
      const requestData = {
        contentId: testContent._id,
        deviceId: 'test-device-123',
        quality: 'medium'
      };

      const response = await request(app)
        .post('/api/offline/request')
        .set('Authorization', `Bearer ${token}`)
        .send(requestData)
        .expect(201);

      expect(response.body.content).toBe(testContent._id.toString());
      expect(response.body.deviceId).toBe('test-device-123');
      expect(response.body.isDownloaded).toBe(false);
    });

    test('PUT /api/offline/:offlineId/progress - should update download progress', async () => {
      // Create offline content first
      const offlineContent = await request(app)
        .post('/api/offline/request')
        .set('Authorization', `Bearer ${token}`)
        .send({
          contentId: testContent._id,
          deviceId: 'test-device-123'
        });

      const progressData = {
        progress: 50,
        fileData: {
          type: 'video',
          localPath: '/local/path/video.mp4',
          size: 50000000,
          checksum: 'abc123'
        }
      };

      const response = await request(app)
        .put(`/api/offline/${offlineContent.body._id}/progress`)
        .set('Authorization', `Bearer ${token}`)
        .send(progressData)
        .expect(200);

      expect(response.body.downloadProgress).toBe(50);
      expect(response.body.cachedFiles).toHaveLength(1);
    });

    test('GET /api/offline/storage/:deviceId - should get storage usage', async () => {
      const response = await request(app)
        .get('/api/offline/storage/test-device-123')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.deviceId).toBe('test-device-123');
      expect(response.body.totalSize).toBeDefined();
      expect(response.body.fileCount).toBeDefined();
      expect(response.body.contentCount).toBeDefined();
    });
  });

  describe('Content Analytics', () => {
    beforeEach(async () => {
      testContent = new Content({
        title: 'Test Analytics Content',
        type: 'video',
        course: testCourse._id,
        module: new mongoose.Types.ObjectId(),
        order: 1,
        duration: 600,
        viewCount: 10,
        completionCount: 5,
        averageRating: 4.5,
        isPublished: true
      });
      await testContent.save();

      // Create some progress data
      await Progress.create([
        {
          user: testUser._id,
          content: testContent._id,
          currentTime: 600,
          watchTime: 600,
          completed: true,
          timeSpent: 600
        },
        {
          user: new mongoose.Types.ObjectId(),
          content: testContent._id,
          currentTime: 300,
          watchTime: 300,
          completed: false,
          timeSpent: 300
        }
      ]);
    });

    test('GET /api/content/:id/analytics - should get content analytics (instructor only)', async () => {
      const response = await request(app)
        .get(`/api/content/${testContent._id}/analytics`)
        .set('Authorization', `Bearer ${instructorToken}`)
        .expect(200);

      expect(response.body.content).toBeDefined();
      expect(response.body.analytics).toBeDefined();
      expect(response.body.analytics.totalViews).toBe(2);
      expect(response.body.analytics.completedViews).toBe(1);
    });

    test('GET /api/content/:id/analytics - should fail for non-instructor', async () => {
      await request(app)
        .get(`/api/content/${testContent._id}/analytics`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
  });

  describe('Content Recommendations', () => {
    beforeEach(async () => {
      // Create multiple content items
      await Content.create([
        {
          title: 'JavaScript Basics',
          type: 'video',
          course: testCourse._id,
          module: new mongoose.Types.ObjectId(),
          order: 1,
          metadata: { tags: ['javascript', 'basics'] },
          isPublished: true
        },
        {
          title: 'Advanced JavaScript',
          type: 'video',
          course: testCourse._id,
          module: new mongoose.Types.ObjectId(),
          order: 2,
          metadata: { tags: ['javascript', 'advanced'] },
          isPublished: true
        },
        {
          title: 'Python Basics',
          type: 'video',
          course: testCourse._id,
          module: new mongoose.Types.ObjectId(),
          order: 3,
          metadata: { tags: ['python', 'basics'] },
          isPublished: true
        }
      ]);

      // Create completed progress for user
      const jsContent = await Content.findOne({ title: 'JavaScript Basics' });
      await Progress.create({
        user: testUser._id,
        content: jsContent._id,
        completed: true
      });
    });

    test('GET /api/content/recommendations/:userId - should get recommendations', async () => {
      const response = await request(app)
        .get(`/api/content/recommendations/${testUser._id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      // Should recommend content with similar tags (JavaScript Advanced)
      expect(response.body.some(content => content.title === 'Advanced JavaScript')).toBe(true);
    });
  });

  describe('Performance Tests', () => {
    test('Content search should be performant with large dataset', async () => {
      // Create large dataset
      const contents = [];
      for (let i = 0; i < 100; i++) {
        contents.push({
          title: `Content ${i}`,
          description: `Description for content ${i}`,
          type: 'video',
          course: testCourse._id,
          module: new mongoose.Types.ObjectId(),
          order: i,
          metadata: {
            tags: [`tag${i % 10}`, 'common']
          },
          isPublished: true
        });
      }
      await Content.insertMany(contents);

      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/content/search?q=common')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Should respond within 1 second
      expect(responseTime).toBeLessThan(1000);
      expect(response.body.content.length).toBeGreaterThan(0);
    });

    test('Progress tracking should handle concurrent requests', async () => {
      const progressPromises = [];
      
      for (let i = 0; i < 50; i++) {
        progressPromises.push(
          request(app)
            .post('/api/progress')
            .set('Authorization', `Bearer ${token}`)
            .send({
              content: testContent._id,
              currentTime: i * 10,
              watchTime: i * 10
            })
        );
      }

      const results = await Promise.all(progressPromises);
      
      // All requests should succeed
      results.forEach(result => {
        expect([200, 201]).toContain(result.status);
      });
    });
  });

  describe('Security Tests', () => {
    test('Should prevent unauthorized access to content', async () => {
      await request(app)
        .get(`/api/content/${testContent._id}`)
        .expect(401);
    });

    test('Should prevent access to unpublished content', async () => {
      const unpublishedContent = new Content({
        title: 'Unpublished Content',
        type: 'video',
        course: testCourse._id,
        module: new mongoose.Types.ObjectId(),
        order: 1,
        isPublished: false
      });
      await unpublishedContent.save();

      await request(app)
        .get(`/api/content/${unpublishedContent._id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    test('Should prevent bookmark manipulation across users', async () => {
      // Create bookmark for test user
      const bookmark = await Bookmark.create({
        user: testUser._id,
        content: testContent._id,
        timestamp: 300
      });

      // Try to delete bookmark with different user token
      await request(app)
        .delete(`/api/bookmarks/${bookmark._id}`)
        .set('Authorization', `Bearer ${instructorToken}`)
        .expect(404); // Should not find bookmark for different user
    });
  });
});
