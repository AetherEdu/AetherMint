import React, { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut, Search } from 'lucide-react';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const DocumentViewer = ({ 
  content, 
  onProgress, 
  onBookmark, 
  onPageChange,
  bookmarks = [],
  startPage = 1 
}) => {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(startPage);
  const [scale, setScale] = useState(1.0);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    if (onPageChange) {
      onPageChange(pageNumber);
    }
  }, [pageNumber, onPageChange]);

  useEffect(() => {
    if (onProgress) {
      onProgress({
        currentPage: pageNumber,
        totalPages: numPages,
        progress: numPages ? (pageNumber / numPages) * 100 : 0
      });
    }
  }, [pageNumber, numPages, onProgress]);

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
  };

  const changePage = (offset) => {
    setPageNumber(prevPageNumber => Math.min(Math.max(1, prevPageNumber + offset), numPages));
  };

  const previousPage = () => changePage(-1);
  const nextPage = () => changePage(1);

  const zoomIn = () => setScale(prevScale => Math.min(prevScale + 0.2, 3.0));
  const zoomOut = () => setScale(prevScale => Math.max(prevScale - 0.2, 0.5));

  const addBookmark = () => {
    if (onBookmark) {
      onBookmark({
        contentId: content._id,
        timestamp: pageNumber, // Using page number as timestamp for documents
        note: `Page ${pageNumber}`
      });
    }
  };

  const downloadDocument = () => {
    const documentFile = content.files.find(f => f.type === 'document');
    if (documentFile && documentFile.url) {
      const link = document.createElement('a');
      link.href = documentFile.url;
      link.download = `${content.title}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const documentFile = content.files?.find(f => f.type === 'document');

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{content.title}</h3>
            <p className="text-sm text-gray-600">{content.description}</p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
              title="Search"
            >
              <Search size={20} />
            </button>
            <button
              onClick={downloadDocument}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
              title="Download"
            >
              <Download size={20} />
            </button>
            <button
              onClick={addBookmark}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
              title="Bookmark current page"
            >
              <Download size={20} />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        {showSearch && (
          <div className="mt-4">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search in document..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              onClick={previousPage}
              disabled={pageNumber <= 1}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={20} />
            </button>
            
            <span className="text-sm text-gray-600">
              Page {pageNumber} of {numPages || '--'}
            </span>
            
            <button
              onClick={nextPage}
              disabled={pageNumber >= (numPages || 1)}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={zoomOut}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
            >
              <ZoomOut size={20} />
            </button>
            
            <span className="text-sm text-gray-600">
              {Math.round(scale * 100)}%
            </span>
            
            <button
              onClick={zoomIn}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
            >
              <ZoomIn size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* PDF Viewer */}
      <div className="p-4 bg-gray-50 overflow-auto" style={{ maxHeight: '70vh' }}>
        {documentFile ? (
          <div className="flex justify-center">
            <Document
              file={documentFile.url}
              onLoadSuccess={onDocumentLoadSuccess}
              className="shadow-lg"
            >
              <Page 
                pageNumber={pageNumber} 
                scale={scale}
                className="mb-4"
              />
            </Document>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="text-gray-400 mb-2">No document file available</div>
              <p className="text-sm text-gray-500">Please upload a document to view it here.</p>
            </div>
          </div>
        )}
      </div>

      {/* Bookmarks Panel */}
      {bookmarks.length > 0 && (
        <div className="border-t border-gray-200 p-4">
          <h4 className="font-semibold text-gray-900 mb-3">Bookmarks</h4>
          <div className="space-y-2">
            {bookmarks.map((bookmark, index) => (
              <button
                key={index}
                onClick={() => setPageNumber(bookmark.timestamp)}
                className="flex items-center justify-between w-full p-2 text-left hover:bg-gray-100 rounded transition-colors"
              >
                <span className="text-sm text-gray-700">
                  {bookmark.note || `Page ${bookmark.timestamp}`}
                </span>
                <span className="text-xs text-gray-500">
                  Page {bookmark.timestamp}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentViewer;
