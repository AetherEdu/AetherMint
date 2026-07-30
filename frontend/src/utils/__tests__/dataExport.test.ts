/**
 * Tests for the data export utility.
 */

import {
  escapeCSVField,
  convertToCSV,
  convertToJSON,
  generateExportFilename,
  exportData,
} from '../dataExport';

// Mock URL.createObjectURL and revokeObjectURL
const mockCreateObjectURL = jest.fn(() => 'blob:test-url');
const mockRevokeObjectURL = jest.fn();
URL.createObjectURL = mockCreateObjectURL;
URL.revokeObjectURL = mockRevokeObjectURL;

// Mock document.createElement for download link
const mockClick = jest.fn();
const mockAppendChild = jest.fn();
const mockRemoveChild = jest.fn();
const originalCreateElement = document.createElement.bind(document);

beforeEach(() => {
  jest.clearAllMocks();
  document.createElement = jest.fn((tag: string) => {
    if (tag === 'a') {
      return {
        href: '',
        download: '',
        click: mockClick,
      } as unknown as HTMLAnchorElement;
    }
    return originalCreateElement(tag);
  }) as typeof document.createElement;
  document.body.appendChild = mockAppendChild;
  document.body.removeChild = mockRemoveChild;
});

afterEach(() => {
  document.createElement = originalCreateElement;
});

describe('escapeCSVField', () => {
  it('returns empty string for null/undefined', () => {
    expect(escapeCSVField(null)).toBe('');
    expect(escapeCSVField(undefined)).toBe('');
  });

  it('returns the string value for simple values', () => {
    expect(escapeCSVField('hello')).toBe('hello');
    expect(escapeCSVField(42)).toBe('42');
    expect(escapeCSVField(true)).toBe('true');
  });

  it('wraps values containing commas in double-quotes', () => {
    expect(escapeCSVField('hello, world')).toBe('"hello, world"');
  });

  it('wraps values containing newlines in double-quotes', () => {
    expect(escapeCSVField('line1\nline2')).toBe('"line1\nline2"');
  });

  it('escapes double-quotes by doubling them', () => {
    expect(escapeCSVField('say "hello"')).toBe('"say ""hello"""');
  });

  it('handles mixed special characters', () => {
    expect(escapeCSVField('a,"b"\nc')).toBe('"a,""b""\nc"');
  });
});

describe('convertToCSV', () => {
  it('returns empty string for empty data', () => {
    expect(convertToCSV([])).toBe('');
  });

  it('generates CSV with header and one row', () => {
    const data = [{ name: 'Alice', score: 95 }];
    const result = convertToCSV(data);
    expect(result).toBe('name,score\nAlice,95');
  });

  it('generates CSV with multiple rows', () => {
    const data = [
      { name: 'Alice', score: 95 },
      { name: 'Bob', score: 87 },
    ];
    const result = convertToCSV(data);
    expect(result).toBe('name,score\nAlice,95\nBob,87');
  });

  it('respects custom column order', () => {
    const data = [{ name: 'Alice', score: 95, grade: 'A' }];
    const result = convertToCSV(data, ['grade', 'name', 'score']);
    expect(result).toBe('grade,name,score\nA,Alice,95');
  });

  it('uses custom column labels', () => {
    const data = [{ name: 'Alice', score: 95 }];
    const result = convertToCSV(data, undefined, {
      name: 'Student Name',
      score: 'Final Score',
    });
    expect(result).toBe('Student Name,Final Score\nAlice,95');
  });

  it('escapes special characters in data', () => {
    const data = [{ name: 'Smith, John', note: 'Passed "with honors"' }];
    const result = convertToCSV(data);
    expect(result).toBe(
      'name,note\n"Smith, John","Passed ""with honors"""',
    );
  });

  it('handles numeric and boolean values', () => {
    const data = [{ id: 1, active: true, score: 99.5 }];
    const result = convertToCSV(data);
    expect(result).toBe('id,active,score\n1,true,99.5');
  });

  it('handles null and undefined values', () => {
    const data = [{ name: 'Alice', middle: null, suffix: undefined }];
    const result = convertToCSV(data);
    expect(result).toBe('name,middle,suffix\nAlice,,');
  });
});

describe('convertToJSON', () => {
  it('returns pretty-printed JSON string', () => {
    const data = { name: 'Alice', scores: [1, 2, 3] };
    const result = convertToJSON(data);
    const parsed = JSON.parse(result);
    expect(parsed).toEqual(data);
    expect(result).toContain('\n');
    expect(result).toContain('  ');
  });

  it('handles arrays', () => {
    const data = [{ id: 1 }, { id: 2 }];
    const result = convertToJSON(data);
    const parsed = JSON.parse(result);
    expect(parsed).toEqual(data);
  });

  it('handles empty objects', () => {
    const result = convertToJSON({});
    expect(JSON.parse(result)).toEqual({});
  });
});

describe('generateExportFilename', () => {
  it('generates a CSV filename with current date', () => {
    const filename = generateExportFilename('analytics', 'csv');
    expect(filename).toMatch(/^analytics-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it('generates a JSON filename with current date', () => {
    const filename = generateExportFilename('credentials', 'json');
    expect(filename).toMatch(/^credentials-\d{4}-\d{2}-\d{2}\.json$/);
  });
});

describe('exportData', () => {
  it('warns and returns early for empty data', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    exportData({ data: [], format: 'csv', filename: 'test' });
    expect(warnSpy).toHaveBeenCalledWith('No data to export');
    warnSpy.mockRestore();
  });

  it('exports CSV and triggers download', () => {
    const data = [{ name: 'Alice', score: 95 }];
    exportData({ data, format: 'csv', filename: 'test' });
    expect(mockCreateObjectURL).toHaveBeenCalled();
    expect(mockClick).toHaveBeenCalled();
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:test-url');
  });

  it('exports JSON and triggers download', () => {
    const data = [{ name: 'Alice', score: 95 }];
    exportData({ data, format: 'json', filename: 'test' });
    expect(mockCreateObjectURL).toHaveBeenCalled();
    expect(mockClick).toHaveBeenCalled();
  });

  it('warns for large datasets', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const data = Array.from({ length: 15000 }, (_, i) => ({
      id: i,
      name: `User ${i}`,
    }));
    exportData({ data, format: 'csv', filename: 'large' });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('15000 rows'),
    );
    warnSpy.mockRestore();
  });

  it('throws for unsupported format', () => {
    const data = [{ name: 'Alice' }];
    expect(() =>
      exportData({
        data,
        // @ts-expect-error - testing runtime behavior for invalid format
        format: 'unknown' as ExportFormat,
        filename: 'test',
      }),
    ).toThrow('Unsupported export format');
  });
});
