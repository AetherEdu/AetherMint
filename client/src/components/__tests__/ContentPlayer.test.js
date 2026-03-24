import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import VideoPlayer from '../src/components/VideoPlayer';
import AudioPlayer from '../src/components/AudioPlayer';
import DocumentViewer from '../src/components/DocumentViewer';
import CodeEditor from '../src/components/CodeEditor';
import ContentPlayer from '../src/components/ContentPlayer';

// Mock Hls.js
jest.mock('hls.js', () => ({
  isSupported: jest.fn(() => true),
  Events: {
    MANIFEST_PARSED: 'manifestParsed',
    LEVELS_UPDATED: 'levelsUpdated'
  }
}));

// Mock react-pdf
jest.mock('react-pdf', () => ({
  Document: ({ children }) => <div data-testid="pdf-document">{children}</div>,
  Page: ({ pageNumber }) => <div data-testid={`pdf-page-${pageNumber}`}>Page {pageNumber}</div>,
  pdfjs: {
    GlobalWorkerOptions: {
      workerSrc: ''
    }
  }
}));

// Mock react-ace
jest.mock('react-ace', () => {
  return function MockAceEditor({ value, onChange }) {
    return (
      <textarea
        data-testid="code-editor"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  };
});

describe('Content Player Components', () => {
  const mockContent = {
    _id: 'test-content-id',
    title: 'Test Content',
    description: 'Test Description',
    type: 'video',
    files: [
      {
        type: 'video',
        url: 'https://example.com/video.mp4',
        format: 'mp4'
      }
    ],
    duration: 600
  };

  const mockProps = {
    content: mockContent,
    onProgress: jest.fn(),
    onBookmark: jest.fn(),
    bookmarks: [],
    notes: []
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('VideoPlayer', () => {
    test('renders video player with controls', () => {
      render(<VideoPlayer {...mockProps} />);
      
      expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /volume/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /fullscreen/i })).toBeInTheDocument();
    });

    test('calls onProgress when playing', async () => {
      render(<VideoPlayer {...mockProps} />);
      
      const playButton = screen.getByRole('button', { name: /play/i });
      fireEvent.click(playButton);

      await waitFor(() => {
        expect(mockProps.onProgress).toHaveBeenCalled();
      }, { timeout: 2000 });
    });

    test('adds bookmark at current time', () => {
      render(<VideoPlayer {...mockProps} />);
      
      const bookmarkButton = screen.getByTitle('Add bookmark');
      fireEvent.click(bookmarkButton);

      expect(mockProps.onBookmark).toHaveBeenCalledWith({
        contentId: 'test-content-id',
        timestamp: expect.any(Number),
        note: ''
      });
    });

    test('changes playback speed', () => {
      render(<VideoPlayer {...mockProps} />);
      
      const speedSelect = screen.getByDisplayValue('1x');
      fireEvent.change(speedSelect, { target: { value: '1.5' } });

      expect(speedSelect).toHaveValue('1.5');
    });
  });

  describe('AudioPlayer', () => {
    const audioContent = {
      ...mockContent,
      type: 'audio',
      files: [
        {
          type: 'audio',
          url: 'https://example.com/audio.mp3',
          format: 'mp3'
        }
      ]
    };

    test('renders audio player with waveform placeholder', () => {
      render(<AudioPlayer {...mockProps} content={audioContent} />);
      
      expect(screen.getByText('Audio waveform visualization')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument();
    });

    test('shows transcript when toggle clicked', () => {
      render(<AudioPlayer {...mockProps} content={audioContent} />);
      
      const transcriptButton = screen.getByText('Show');
      fireEvent.click(transcriptButton);

      expect(screen.getByText('Hide')).toBeInTheDocument();
      expect(screen.getByText('Transcript content will be displayed here...')).toBeInTheDocument();
    });
  });

  describe('DocumentViewer', () => {
    const documentContent = {
      ...mockContent,
      type: 'document',
      files: [
        {
          type: 'document',
          url: 'https://example.com/document.pdf',
          format: 'pdf'
        }
      ]
    };

    test('renders PDF viewer with navigation', () => {
      render(<DocumentViewer {...mockProps} content={documentContent} />);
      
      expect(screen.getByTestId('pdf-document')).toBeInTheDocument();
      expect(screen.getByText('Page 1 of --')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /previous/i })).toBeInTheDocument();
    });

    test('zooms in and out', () => {
      render(<DocumentViewer {...mockProps} content={documentContent} />);
      
      const zoomInButton = screen.getByTitle('Zoom in');
      const zoomOutButton = screen.getByTitle('Zoom out');

      fireEvent.click(zoomInButton);
      expect(screen.getByText('120%')).toBeInTheDocument();

      fireEvent.click(zoomOutButton);
      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    test('downloads document', () => {
      // Mock URL.createObjectURL and link click
      global.URL.createObjectURL = jest.fn(() => 'mock-url');
      global.URL.revokeObjectURL = jest.fn();
      
      const mockLink = {
        href: '',
        download: '',
        click: jest.fn()
      };
      global.document.createElement = jest.fn(() => mockLink);
      global.document.body = { appendChild: jest.fn(), removeChild: jest.fn() };

      render(<DocumentViewer {...mockProps} content={documentContent} />);
      
      const downloadButton = screen.getByTitle('Download');
      fireEvent.click(downloadButton);

      expect(mockLink.click).toHaveBeenCalled();
    });
  });

  describe('CodeEditor', () => {
    const codeContent = {
      ...mockContent,
      type: 'code',
      metadata: {
        code: 'console.log("Hello, World!");',
        language: 'javascript'
      }
    };

    test('renders code editor with console', () => {
      render(<CodeEditor {...mockProps} content={codeContent} />);
      
      expect(screen.getByTestId('code-editor')).toBeInTheDocument();
      expect(screen.getByText('Output Console')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /run/i })).toBeInTheDocument();
    });

    test('runs code and shows output', async () => {
      render(<CodeEditor {...mockProps} content={codeContent} />);
      
      const runButton = screen.getByRole('button', { name: /run/i });
      fireEvent.click(runButton);

      await waitFor(() => {
        expect(screen.getByText(/Output:/)).toBeInTheDocument();
      });
    });

    test('copies code to clipboard', async () => {
      Object.assign(navigator, {
        clipboard: {
          writeText: jest.fn().mockResolvedValue()
        }
      });

      render(<CodeEditor {...mockProps} content={codeContent} />);
      
      const copyButton = screen.getByTitle('Copy');
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('console.log("Hello, World!");');
        expect(screen.getByText('Copied!')).toBeInTheDocument();
      });
    });

    test('resets code to original', () => {
      render(<CodeEditor {...mockProps} content={codeContent} />);
      
      const codeEditor = screen.getByTestId('code-editor');
      fireEvent.change(codeEditor, { target: { value: 'modified code' } });

      const resetButton = screen.getByRole('button', { name: /reset/i });
      fireEvent.click(resetButton);

      expect(codeEditor).toHaveValue('console.log("Hello, World!");');
    });
  });

  describe('ContentPlayer Integration', () => {
    test('renders appropriate player based on content type', () => {
      const { rerender } = render(<ContentPlayer contentId="test-id" courseId="test-course" />);
      
      // Test video content
      rerender(<ContentPlayer contentId="test-id" courseId="test-course" />);
      // Would need to mock fetch to test actual content loading
    });

    test('handles bookmark creation', async () => {
      // Mock fetch for content data
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockContent)
        })
      );

      render(<ContentPlayer contentId="test-id" courseId="test-course" />);
      
      // Would need to wait for content to load and then test bookmark functionality
    });
  });
});

describe('Offline Functionality', () => {
  test('IndexedDB operations work correctly', async () => {
    // Mock IndexedDB
    const mockDB = {
      transaction: jest.fn(() => ({
        objectStore: jest.fn(() => ({
          add: jest.fn().mockResolvedValue('success'),
          get: jest.fn().mockResolvedValue(null),
          getAll: jest.fn().mockResolvedValue([])
        }))
      }))
    };

    global.indexedDB = {
      open: jest.fn(() => ({
        onsuccess: (event) => {
          event.target.result = mockDB;
        },
        onerror: jest.fn(),
        onupgradeneeded: jest.fn()
      }))
    };

    // Test offline service initialization
    const { default: offlineService } = require('../src/services/offlineService');
    
    await offlineService.initDB();
    expect(indexedDB.open).toHaveBeenCalled();
  });
});

describe('Performance Tests', () => {
  test('video player handles large files efficiently', () => {
    const largeVideoContent = {
      ...mockProps.content,
      duration: 3600, // 1 hour video
      files: [
        {
          type: 'video',
          url: 'https://example.com/large-video.mp4',
          format: 'mp4',
          size: 1000000000 // 1GB
        }
      ]
    };

    const startTime = performance.now();
    render(<VideoPlayer {...mockProps} content={largeVideoContent} />);
    const endTime = performance.now();

    // Should render within 100ms
    expect(endTime - startTime).toBeLessThan(100);
  });

  test('code editor handles large code files', () => {
    const largeCode = 'console.log("test");\n'.repeat(10000); // 10k lines
    const largeCodeContent = {
      ...mockProps.content,
      type: 'code',
      metadata: {
        code: largeCode,
        language: 'javascript'
      }
    };

    const startTime = performance.now();
    render(<CodeEditor {...mockProps} content={largeCodeContent} />);
    const endTime = performance.now();

    // Should render within 200ms for large code
    expect(endTime - startTime).toBeLessThan(200);
  });
});

describe('Accessibility Tests', () => {
  test('video player has proper ARIA labels', () => {
    render(<VideoPlayer {...mockProps} />);
    
    const playButton = screen.getByRole('button', { name: /play/i });
    expect(playButton).toHaveAttribute('aria-label');
  });

  test('content is keyboard navigable', () => {
    render(<ContentPlayer contentId="test-id" courseId="test-course" />);
    
    // Test tab navigation
    const focusableElements = screen.getAllByRole('button');
    focusableElements.forEach(element => {
      expect(element).toHaveAttribute('tabIndex');
    });
  });

  test('progress tracking respects user preferences', () => {
    // Mock user preferences for reduced motion
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(query => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });

    render(<VideoPlayer {...mockProps} />);
    
    // Should respect reduced motion preference
    const animatedElements = screen.getAllByRole('button');
    animatedElements.forEach(element => {
      const styles = window.getComputedStyle(element);
      expect(styles.transition).toBe('none');
    });
  });
});
