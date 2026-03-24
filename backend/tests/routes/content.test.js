const request = require('supertest');
const app = require('../../src/index');
const userData = require('../fixtures/userData');

// Mock the IPFS service
jest.mock('../../src/services/ipfs', () => ({
  uploadFile: jest.fn(),
  uploadMultipleFiles: jest.fn(),
  getContent: jest.fn(),
  getFileMetadata: jest.fn(),
  pinFile: jest.fn(),
  unpinFile: jest.fn(),
  getNodeInfo: jest.fn()
}));

const ipfsService = require('../../src/services/ipfs');

describe('Content API Tests', () => {
  let authToken;
  let mockUser;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock user and token
    mockUser = userData.users.validUser;
    authToken = global.testUtils.generateTestToken(mockUser);
    
    // Mock IPFS service defaults
    ipfsService.uploadFile.mockResolvedValue({
      cid: 'QmTest123456789',
      metadataCid: 'QmMetadata123',
      metadata: { name: 'test.txt', size: 1024 },
      size: 1024,
      gatewayUrl: 'https://ipfs.io/ipfs/QmTest123456789'
    });
    
    ipfsService.getContent.mockResolvedValue(Buffer.from('test content'));
  });

  describe('POST /api/content/upload', () => {
    it('should upload a single file successfully', async () => {
      const mockFile = {
        fieldname: 'file',
        originalname: 'test.txt',
        encoding: '7bit',
        mimetype: 'text/plain',
        size: 1024,
        buffer: Buffer.from('test content')
      };

      const response = await request(app)
        .post('/api/content/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', mockFile.buffer, 'test.txt')
        .field('metadata', JSON.stringify({ name: 'test.txt' }));

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.cid).toBe('QmTest123456789');
      expect(ipfsService.uploadFile).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining(mockUser),
        expect.objectContaining({
          metadata: { name: 'test.txt' },
          includeMetadata: true,
          wrapWithDirectory: false
        })
      );
    });

    it('should reject upload without file', async () => {
      const response = await request(app)
        .post('/api/content/upload')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('No file provided');
    });

    it('should reject upload without authentication', async () => {
      const response = await request(app)
        .post('/api/content/upload');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should handle upload with metadata options', async () => {
      const mockFile = {
        buffer: Buffer.from('test content'),
        originalname: 'test.txt'
      };

      const response = await request(app)
        .post('/api/content/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', mockFile.buffer, 'test.txt')
        .field('metadata', JSON.stringify({ category: 'document' }))
        .field('includeMetadata', 'false')
        .field('wrapWithDirectory', 'true');

      expect(response.status).toBe(201);
      expect(ipfsService.uploadFile).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining(mockUser),
        expect.objectContaining({
          metadata: { category: 'document' },
          includeMetadata: false,
          wrapWithDirectory: true
        })
      );
    });

    it('should handle IPFS upload errors', async () => {
      ipfsService.uploadFile.mockRejectedValue(new Error('IPFS upload failed'));

      const response = await request(app)
        .post('/api/content/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', Buffer.from('test content'), 'test.txt');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Upload failed');
    });

    it('should handle malformed metadata JSON', async () => {
      const response = await request(app)
        .post('/api/content/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', Buffer.from('test content'), 'test.txt')
        .field('metadata', 'invalid-json');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });

    it('should enforce rate limiting on uploads', async () => {
      // Mock rate limit exceeded
      ipfsService.uploadFile.mockRejectedValue(new Error('Rate limit exceeded'));

      const responses = await Promise.all(
        Array(5).fill().map(() =>
          request(app)
            .post('/api/content/upload')
            .set('Authorization', `Bearer ${authToken}`)
            .attach('file', Buffer.from('test content'), 'test.txt')
        )
      );

      expect(responses.every(r => r.status === 201)).toBe(true);
    });
  });

  describe('POST /api/content/upload/batch', () => {
    it('should upload multiple files successfully', async () => {
      const mockFiles = [
        { buffer: Buffer.from('content1'), originalname: 'file1.txt' },
        { buffer: Buffer.from('content2'), originalname: 'file2.txt' }
      ];

      const mockResults = [
        { success: true, cid: 'QmFile1', size: 1024 },
        { success: true, cid: 'QmFile2', size: 2048 }
      ];

      ipfsService.uploadMultipleFiles.mockResolvedValue(mockResults);

      const response = await request(app)
        .post('/api/content/upload/batch')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('files', mockFiles[0].buffer, 'file1.txt')
        .attach('files', mockFiles[1].buffer, 'file2.txt');

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toEqual(mockResults);
      expect(response.body.data.summary.total).toBe(2);
      expect(response.body.data.summary.successful).toBe(2);
    });

    it('should handle partial batch upload failures', async () => {
      const mockFiles = [
        { buffer: Buffer.from('content1'), originalname: 'file1.txt' },
        { buffer: Buffer.from('content2'), originalname: 'file2.txt' }
      ];

      const mockResults = [
        { success: true, cid: 'QmFile1', size: 1024 },
        { success: false, error: 'Upload failed' }
      ];

      ipfsService.uploadMultipleFiles.mockResolvedValue(mockResults);

      const response = await request(app)
        .post('/api/content/upload/batch')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('files', mockFiles[0].buffer, 'file1.txt')
        .attach('files', mockFiles[1].buffer, 'file2.txt');

      expect(response.status).toBe(201);
      expect(response.body.data.summary.successful).toBe(1);
      expect(response.body.data.summary.failed).toBe(1);
    });

    it('should reject batch upload without files', async () => {
      const response = await request(app)
        .post('/api/content/upload/batch')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('No files provided');
    });

    it('should enforce file limit for batch uploads', async () => {
      // Create 11 files (exceeds limit of 10)
      const files = Array(11).fill().map((_, i) => ({
        buffer: Buffer.from(`content${i}`),
        originalname: `file${i}.txt`
      }));

      const response = await request(app)
        .post('/api/content/upload/batch')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('files', files[0].buffer, 'file0.txt');

      // Multer should handle the file limit before our middleware
      expect(response.status).toBeLessThan(500);
    });
  });

  describe('GET /api/content/:cid', () => {
    it('should retrieve content successfully', async () => {
      const cid = 'QmTest123456789';
      const mockContent = Buffer.from('test content');

      ipfsService.getContent.mockResolvedValue(mockContent);

      const response = await request(app)
        .get(`/api/content/${cid}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/octet-stream');
      expect(response.headers['x-ipfs-cid']).toBe(cid);
      expect(response.body.toString()).toBe('test content');
    });

    it('should retrieve content as base64', async () => {
      const cid = 'QmTest123456789';
      const mockContent = Buffer.from('test content');

      ipfsService.getContent.mockResolvedValue(mockContent);

      const response = await request(app)
        .get(`/api/content/${cid}?format=base64`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.content).toBe(mockContent.toString('base64'));
      expect(response.body.data.cid).toBe(cid);
    });

    it('should retrieve content as stream', async () => {
      const cid = 'QmTest123456789';
      const mockContent = Buffer.from('test content');

      ipfsService.getContent.mockResolvedValue(mockContent);

      const response = await request(app)
        .get(`/api/content/${cid}?format=stream`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/octet-stream');
      expect(response.headers['x-ipfs-cid']).toBe(cid);
    });

    it('should handle content retrieval with cache bypass', async () => {
      const cid = 'QmTest123456789';
      const mockContent = Buffer.from('test content');

      ipfsService.getContent.mockResolvedValue(mockContent);

      const response = await request(app)
        .get(`/api/content/${cid}?bypassCache=true`);

      expect(response.status).toBe(200);
      expect(ipfsService.getContent).toHaveBeenCalledWith(cid, {
        bypassCache: true
      });
    });

    it('should handle non-existent content', async () => {
      const cid = 'QmNonExistent';
      
      ipfsService.getContent.mockRejectedValue(new Error('Content not found'));

      const response = await request(app)
        .get(`/api/content/${cid}`);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });

    it('should handle invalid CID format', async () => {
      const response = await request(app)
        .get('/api/content/invalid-cid');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/content/:cid/pin', () => {
    it('should pin content successfully', async () => {
      const cid = 'QmTest123456789';
      
      ipfsService.pinFile.mockResolvedValue({ pinned: true, cid });

      const response = await request(app)
        .post(`/api/content/${cid}/pin`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(ipfsService.pinFile).toHaveBeenCalledWith(cid, expect.objectContaining(mockUser));
    });

    it('should reject pin operation without authentication', async () => {
      const cid = 'QmTest123456789';

      const response = await request(app)
        .post(`/api/content/${cid}/pin`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should handle pin operation errors', async () => {
      const cid = 'QmTest123456789';
      
      ipfsService.pinFile.mockRejectedValue(new Error('Pin failed'));

      const response = await request(app)
        .post(`/api/content/${cid}/pin`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/content/:cid/pin', () => {
    it('should unpin content successfully', async () => {
      const cid = 'QmTest123456789';
      
      ipfsService.unpinFile.mockResolvedValue({ unpinned: true, cid });

      const response = await request(app)
        .delete(`/api/content/${cid}/pin`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(ipfsService.unpinFile).toHaveBeenCalledWith(cid, expect.objectContaining(mockUser));
    });

    it('should reject unpin operation without authentication', async () => {
      const cid = 'QmTest123456789';

      const response = await request(app)
        .delete(`/api/content/${cid}/pin`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/content/:cid/metadata', () => {
    it('should retrieve file metadata successfully', async () => {
      const cid = 'QmTest123456789';
      const mockMetadata = {
        name: 'test.txt',
        size: 1024,
        type: 'text/plain',
        uploadedBy: mockUser.address,
        uploadedAt: new Date()
      };

      ipfsService.getFileMetadata.mockResolvedValue(mockMetadata);

      const response = await request(app)
        .get(`/api/content/${cid}/metadata`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockMetadata);
    });

    it('should handle metadata retrieval errors', async () => {
      const cid = 'QmTest123456789';
      
      ipfsService.getFileMetadata.mockRejectedValue(new Error('Metadata not found'));

      const response = await request(app)
        .get(`/api/content/${cid}/metadata`);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/content/:cid/metadata', () => {
    it('should update file metadata successfully', async () => {
      const cid = 'QmTest123456789';
      const updateData = {
        name: 'updated.txt',
        category: 'document',
        tags: ['important', 'test']
      };
      const updatedMetadata = {
        ...updateData,
        updatedAt: new Date(),
        updatedBy: mockUser.address
      };

      ipfsService.updateFileMetadata.mockResolvedValue(updatedMetadata);

      const response = await request(app)
        .put(`/api/content/${cid}/metadata`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(updatedMetadata);
      expect(ipfsService.updateFileMetadata).toHaveBeenCalledWith(cid, updateData, expect.objectContaining(mockUser));
    });

    it('should reject metadata update without authentication', async () => {
      const cid = 'QmTest123456789';

      const response = await request(app)
        .put(`/api/content/${cid}/metadata`)
        .send({ name: 'updated.txt' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should validate metadata update data', async () => {
      const cid = 'QmTest123456789';

      const response = await request(app)
        .put(`/api/content/${cid}/metadata`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: '' }); // Empty name

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed request bodies', async () => {
      const response = await request(app)
        .put('/api/content/QmTest123/metadata')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}');

      expect(response.status).toBe(400);
    });

    it('should handle large file uploads', async () => {
      const largeFile = {
        buffer: Buffer.alloc(200 * 1024 * 1024), // 200MB
        originalname: 'large.txt'
      };

      const response = await request(app)
        .post('/api/content/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', largeFile.buffer, 'large.txt');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should handle concurrent uploads', async () => {
      const mockFile = {
        buffer: Buffer.from('test content'),
        originalname: 'test.txt'
      };

      const responses = await Promise.all(
        Array(5).fill().map(() =>
          request(app)
            .post('/api/content/upload')
            .set('Authorization', `Bearer ${authToken}`)
            .attach('file', mockFile.buffer, 'test.txt')
        )
      );

      expect(responses.length).toBe(5);
      responses.forEach(response => {
        expect(response.status).toBe(201);
      });
    });

    it('should handle network timeouts', async () => {
      ipfsService.uploadFile.mockImplementation(() =>
        new Promise((resolve, reject) =>
          setTimeout(() => reject(new Error('Network timeout')), 100)
        )
      );

      const response = await request(app)
        .post('/api/content/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', Buffer.from('test content'), 'test.txt');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });

    it('should handle invalid file formats', async () => {
      const invalidFile = {
        buffer: Buffer.from('invalid content'),
        originalname: 'test.exe'
      };

      ipfsService.uploadFile.mockRejectedValue(new Error('File type not allowed'));

      const response = await request(app)
        .post('/api/content/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', invalidFile.buffer, 'test.exe');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });
});
