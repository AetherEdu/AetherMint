import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { BookOpen, Copy, Check, ExternalLink, Download, Share2 } from 'lucide-react';

const InteractiveTextContent = ({ 
  content, 
  onProgress, 
  onBookmark, 
  bookmarks = [],
  onNote,
  notes = []
}) => {
  const [readingProgress, setReadingProgress] = useState(0);
  const [copiedCode, setCopiedCode] = useState('');
  const [showTableOfContents, setShowTableOfContents] = useState(true);
  const [activeSection, setActiveSection] = useState('');

  useEffect(() => {
    // Track reading progress
    const handleScroll = () => {
      const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
      const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const scrolled = (winScroll / height) * 100;
      setReadingProgress(scrolled);
      
      if (onProgress) {
        onProgress({
          readingProgress: scrolled,
          timeSpent: 1 // Track time spent reading
        });
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [onProgress]);

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCode(text);
      setTimeout(() => setCopiedCode(''), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const addBookmark = () => {
    if (onBookmark) {
      onBookmark({
        contentId: content._id,
        timestamp: readingProgress, // Use reading progress as timestamp
        note: `Reading progress: ${Math.round(readingProgress)}%`
      });
    }
  };

  const extractTableOfContents = (markdown) => {
    const headings = markdown.match(/^#{1,6}\s+(.+)$/gm) || [];
    return headings.map((heading, index) => {
      const level = heading.match(/^#+/)[0].length;
      const text = heading.replace(/^#+\s+/, '');
      const id = `heading-${index}`;
      return { level, text, id };
    });
  };

  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setActiveSection(id);
    }
  };

  const markdownContent = content.description || '';
  const tableOfContents = extractTableOfContents(markdownContent);

  const customComponents = {
    h1: ({ children, ...props }) => (
      <h1 id={props.id} className="text-3xl font-bold text-gray-900 mb-6 mt-8" {...props}>
        {children}
      </h1>
    ),
    h2: ({ children, ...props }) => (
      <h2 id={props.id} className="text-2xl font-semibold text-gray-900 mb-4 mt-6" {...props}>
        {children}
      </h2>
    ),
    h3: ({ children, ...props }) => (
      <h3 id={props.id} className="text-xl font-semibold text-gray-900 mb-3 mt-5" {...props}>
        {children}
      </h3>
    ),
    h4: ({ children, ...props }) => (
      <h4 id={props.id} className="text-lg font-semibold text-gray-900 mb-2 mt-4" {...props}>
        {children}
      </h4>
    ),
    p: ({ children }) => (
      <p className="text-gray-700 leading-relaxed mb-4">{children}</p>
    ),
    ul: ({ children }) => (
      <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal list-inside text-gray-700 mb-4 space-y-2">{children}</ol>
    ),
    li: ({ children }) => (
      <li className="ml-4">{children}</li>
    ),
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-blue-500 pl-4 py-2 mb-4 bg-blue-50 italic text-gray-700">
        {children}
      </blockquote>
    ),
    code: ({ inline, children, ...props }) => {
      if (inline) {
        return (
          <code className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-sm font-mono" {...props}>
            {children}
          </code>
        );
      }
      
      const codeString = String(children).replace(/\n$/, '');
      const isCopied = copiedCode === codeString;
      
      return (
        <div className="relative mb-4">
          <div className="flex items-center justify-between bg-gray-800 text-gray-300 px-4 py-2 text-sm font-mono rounded-t">
            <span>code</span>
            <button
              onClick={() => copyToClipboard(codeString)}
              className="flex items-center space-x-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
            >
              {isCopied ? <Check size={14} /> : <Copy size={14} />}
              <span className="text-xs">{isCopied ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>
          <SyntaxHighlighter
            style={tomorrow}
            language="javascript"
            PreTag="div"
            className="!rounded-t-none !mt-0"
            {...props}
          >
            {codeString}
          </SyntaxHighlighter>
        </div>
      );
    },
    a: ({ href, children }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:text-blue-800 underline flex items-center space-x-1 inline-flex"
      >
        {children}
        <ExternalLink size={14} />
      </a>
    ),
    img: ({ src, alt, ...props }) => (
      <img
        src={src}
        alt={alt}
        className="max-w-full h-auto rounded-lg shadow-md my-4"
        {...props}
      />
    ),
    table: ({ children }) => (
      <div className="overflow-x-auto mb-4">
        <table className="min-w-full border border-gray-300 rounded-lg overflow-hidden">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="bg-gray-100">{children}</thead>
    ),
    th: ({ children }) => (
      <th className="px-4 py-2 text-left font-semibold text-gray-900 border-b border-gray-300">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="px-4 py-2 text-gray-700 border-b border-gray-300">{children}</td>
    ),
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Reading Progress Bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-gray-200 z-50">
        <div
          className="h-full bg-blue-500 transition-all duration-300"
          style={{ width: `${readingProgress}%` }}
        />
      </div>

      {/* Header */}
      <div className="bg-white rounded-lg shadow-lg mb-6 sticky top-4 z-40">
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <BookOpen size={24} className="text-green-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">{content.title}</h1>
                <p className="text-gray-600">{content.description?.substring(0, 150)}...</p>
                <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                  <span className="capitalize">{content.type}</span>
                  {content.metadata?.wordCount && (
                    <span>{content.metadata.wordCount} words</span>
                  )}
                  <span>~{Math.ceil(content.metadata?.wordCount / 200)} min read</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowTableOfContents(!showTableOfContents)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Table of Contents"
              >
                <BookOpen size={20} />
              </button>
              <button
                onClick={addBookmark}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Add bookmark"
              >
                <Download size={20} />
              </button>
              <button
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Share"
              >
                <Share2 size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Table of Contents */}
        {showTableOfContents && tableOfContents.length > 0 && (
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-lg p-4 sticky top-24">
              <h3 className="font-semibold text-gray-900 mb-4">Table of Contents</h3>
              <nav className="space-y-2">
                {tableOfContents.map((heading, index) => (
                  <button
                    key={index}
                    onClick={() => scrollToSection(heading.id)}
                    className={`block w-full text-left px-3 py-2 rounded transition-colors ${
                      activeSection === heading.id
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                    style={{ paddingLeft: `${(heading.level - 1) * 12 + 12}px` }}
                  >
                    {heading.text}
                  </button>
                ))}
              </nav>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className={`${showTableOfContents && tableOfContents.length > 0 ? 'lg:col-span-3' : 'lg:col-span-4'}`}>
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="prose prose-lg max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={customComponents}
              >
                {markdownContent}
              </ReactMarkdown>
            </div>

            {/* Interactive Elements */}
            <div className="mt-8 pt-8 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Interactive Elements</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Practice Exercises */}
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-2">Practice Exercises</h4>
                  <p className="text-sm text-blue-700 mb-3">
                    Test your understanding with interactive exercises
                  </p>
                  <button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm">
                    Start Exercises
                  </button>
                </div>

                {/* Discussion */}
                <div className="bg-green-50 rounded-lg p-4">
                  <h4 className="font-medium text-green-900 mb-2">Join Discussion</h4>
                  <p className="text-sm text-green-700 mb-3">
                    Discuss this content with other learners
                  </p>
                  <button className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors text-sm">
                    View Discussion
                  </button>
                </div>

                {/* Related Content */}
                <div className="bg-purple-50 rounded-lg p-4">
                  <h4 className="font-medium text-purple-900 mb-2">Related Content</h4>
                  <p className="text-sm text-purple-700 mb-3">
                    Explore related topics and continue learning
                  </p>
                  <button className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors text-sm">
                    Explore More
                  </button>
                </div>

                {/* Quiz */}
                <div className="bg-yellow-50 rounded-lg p-4">
                  <h4 className="font-medium text-yellow-900 mb-2">Take Quiz</h4>
                  <p className="text-sm text-yellow-700 mb-3">
                    Test your knowledge with a quick quiz
                  </p>
                  <button className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors text-sm">
                    Start Quiz
                  </button>
                </div>
              </div>
            </div>

            {/* Notes Section */}
            {notes.length > 0 && (
              <div className="mt-8 pt-8 border-t border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Notes</h3>
                <div className="space-y-3">
                  {notes.map((note, index) => (
                    <div key={index} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-500">
                          Progress: {Math.round(note.timestamp)}%
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(note.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-gray-700">{note.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InteractiveTextContent;
