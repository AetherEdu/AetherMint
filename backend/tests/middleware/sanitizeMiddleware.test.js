/**
 * File Upload Validation Middleware Tests
 * Tests MIME type validation, extension blocking, size limits, and file validation.
 */

const {
  validateFile,
  validateUploadedFiles,
  BLOCKED_EXTENSIONS,
} = require('../../src/middleware/sanitizeMiddleware');

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

const createMockFile = (overrides = {}) => ({
  originalname: 'test.pdf',
  mimetype: 'application/pdf',
  size: 1024 * 100, // 100KB
  buffer: Buffer.from('test'),
  ...overrides,
});

// ────────────────────────────────────────────────────────────────────────────
// validateFile Tests
// ────────────────────────────────────────────────────────────────────────────

describe('validateFile', () => {
  test('should accept valid PDF file', () => {
    const file = createMockFile();
    const result = validateFile(file);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  test('should accept valid PNG image', () => {
    const file = createMockFile({ originalname: 'photo.png', mimetype: 'image/png' });
    const result = validateFile(file);
    expect(result.valid).toBe(true);
  });

  test('should accept valid JPEG image', () => {
    const file = createMockFile({ originalname: 'photo.jpg', mimetype: 'image/jpeg' });
    const result = validateFile(file);
    expect(result.valid).toBe(true);
  });

  test('should reject .exe files', () => {
    const file = createMockFile({ originalname: 'virus.exe', mimetype: 'application/x-msdownload' });
    const result = validateFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('not allowed');
  });

  test('should reject files with blocked .php extension', () => {
    const file = createMockFile({ originalname: 'shell.php', mimetype: 'text/plain' });
    const result = validateFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('.php');
  });

  test('should reject files with blocked .sh extension', () => {
    const file = createMockFile({ originalname: 'script.sh', mimetype: 'application/x-sh' });
    const result = validateFile(file);
    expect(result.valid).toBe(false);
  });

  test('should reject files with mismatched extension/MIME type', () => {
    const file = createMockFile({ originalname: 'doc.pdf', mimetype: 'application/msword' });
    const result = validateFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('does not match');
  });

  test('should reject empty files', () => {
    const file = createMockFile({ size: 0 });
    const result = validateFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Empty');
  });

  test('should reject oversized files', () => {
    // Over 50MB
    const file = createMockFile({ size: 51 * 1024 * 1024 });
    const result = validateFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Too large');
  });

  test('should reject unsupported MIME types', () => {
    const file = createMockFile({ originalname: 'data.bin', mimetype: 'application/octet-stream' });
    const result = validateFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Unsupported');
  });

  test('should return error for null/undefined file', () => {
    expect(validateFile(null).valid).toBe(false);
    expect(validateFile(undefined).valid).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// validateUploadedFiles Tests
// ────────────────────────────────────────────────────────────────────────────

describe('validateUploadedFiles', () => {
  test('should accept a request with a single valid file', () => {
    const req = { file: createMockFile() };
    const result = validateUploadedFiles(req);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('should accept a request with multiple valid files', () => {
    const req = {
      files: [
        createMockFile({ originalname: 'a.pdf' }),
        createMockFile({ originalname: 'b.png', mimetype: 'image/png' }),
      ],
    };
    const result = validateUploadedFiles(req);
    expect(result.valid).toBe(true);
  });

  test('should reject a request with a blocked file', () => {
    const req = { file: createMockFile({ originalname: 'bad.exe' }) };
    const result = validateUploadedFiles(req);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('should skip validation when no files are present', () => {
    const req = {};
    const result = validateUploadedFiles(req);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('should collect errors from multiple invalid files', () => {
    const req = {
      files: [
        createMockFile({ originalname: 'bad.exe' }),
        createMockFile({ originalname: 'empty.pdf', size: 0 }),
      ],
    };
    const result = validateUploadedFiles(req);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(2);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Blocked Extensions Coverage
// ────────────────────────────────────────────────────────────────────────────

describe('Blocked Extensions', () => {
  test('should block all common executable extensions', () => {
    const dangerous = ['.exe', '.bat', '.cmd', '.sh', '.php', '.py', '.pl'];
    for (const ext of dangerous) {
      const file = createMockFile({ originalname: `file${ext}`, mimetype: 'text/plain' });
      const result = validateFile(file);
      expect(result.valid).toBe(false);
    }
  });
});
