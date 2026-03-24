import React, { useState, useEffect } from 'react';
import AceEditor from 'react-ace';
import 'ace-builds/src-noconflict/mode-javascript';
import 'ace-builds/src-noconflict/mode-python';
import 'ace-builds/src-noconflict/mode-java';
import 'ace-builds/src-noconflict/mode-c_cpp';
import 'ace-builds/src-noconflict/mode-html';
import 'ace-builds/src-noconflict/mode-css';
import 'ace-builds/src-noconflict/theme-monokai';
import 'ace-builds/src-noconflict/theme-github';
import 'ace-builds/src-noconflict/ext-language_tools';
import { Play, Save, Download, Copy, Check, Settings, RotateCcw } from 'lucide-react';

const CodeEditor = ({ 
  content, 
  onProgress, 
  onBookmark, 
  onCodeChange,
  bookmarks = [],
  initialCode = '',
  language = 'javascript',
  theme = 'monokai'
}) => {
  const [code, setCode] = useState(initialCode || content.metadata?.code || '');
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fontSize, setFontSize] = useState(14);
  const [showSettings, setShowSettings] = useState(false);
  const [wordWrap, setWordWrap] = useState(false);

  useEffect(() => {
    if (onCodeChange) {
      onCodeChange(code);
    }
  }, [code, onCodeChange]);

  useEffect(() => {
    if (onProgress) {
      onProgress({
        codeLength: code.length,
        lines: code.split('\n').length
      });
    }
  }, [code, onProgress]);

  const runCode = async () => {
    setIsRunning(true);
    setOutput('Running code...');
    
    try {
      // This would connect to a code execution service
      // For now, we'll simulate code execution
      const result = await simulateCodeExecution(code, language);
      setOutput(result);
    } catch (error) {
      setOutput(`Error: ${error.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const simulateCodeExecution = (code, lang) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        // Simple simulation for demo purposes
        if (lang === 'javascript') {
          try {
            // Safe eval simulation (in production, use a proper sandbox)
            const result = eval(code);
            resolve(`Output: ${result}`);
          } catch (error) {
            resolve(`Error: ${error.message}`);
          }
        } else {
          resolve(`Code execution for ${lang} would run here.\nOutput would appear in this console.`);
        }
      }, 1000);
    });
  };

  const resetCode = () => {
    setCode(initialCode || content.metadata?.code || '');
    setOutput('');
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy code:', error);
    }
  };

  const downloadCode = () => {
    const extension = getFileExtension(language);
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${content.title}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const addBookmark = () => {
    if (onBookmark) {
      onBookmark({
        contentId: content._id,
        timestamp: Date.now(), // Using timestamp for code
        note: `Code bookmark - ${new Date().toLocaleTimeString()}`
      });
    }
  };

  const getFileExtension = (lang) => {
    const extensions = {
      javascript: 'js',
      python: 'py',
      java: 'java',
      c_cpp: 'cpp',
      html: 'html',
      css: 'css'
    };
    return extensions[lang] || 'txt';
  };

  const getLanguageMode = (lang) => {
    const modes = {
      javascript: 'javascript',
      python: 'python',
      java: 'java',
      c_cpp: 'c_cpp',
      html: 'html',
      css: 'css'
    };
    return modes[lang] || 'javascript';
  };

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
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
              title="Settings"
            >
              <Settings size={20} />
            </button>
            <button
              onClick={addBookmark}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
              title="Add bookmark"
            >
              <Download size={20} />
            </button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Language
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                >
                  <option value="javascript">JavaScript</option>
                  <option value="python">Python</option>
                  <option value="java">Java</option>
                  <option value="c_cpp">C/C++</option>
                  <option value="html">HTML</option>
                  <option value="css">CSS</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Theme
                </label>
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                >
                  <option value="monokai">Monokai</option>
                  <option value="github">GitHub</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Font Size
                </label>
                <input
                  type="number"
                  min="10"
                  max="24"
                  value={fontSize}
                  onChange={(e) => setFontSize(parseInt(e.target.value))}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                />
              </div>
            </div>
            <div className="mt-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={wordWrap}
                  onChange={(e) => setWordWrap(e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Word Wrap</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Editor Toolbar */}
      <div className="border-b border-gray-200 p-2 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              onClick={runCode}
              disabled={isRunning}
              className="flex items-center space-x-1 px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 transition-colors disabled:opacity-50"
            >
              <Play size={16} />
              <span className="text-sm">{isRunning ? 'Running...' : 'Run'}</span>
            </button>
            <button
              onClick={resetCode}
              className="flex items-center space-x-1 px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
            >
              <RotateCcw size={16} />
              <span className="text-sm">Reset</span>
            </button>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={copyCode}
              className="flex items-center space-x-1 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              <span className="text-sm">{copied ? 'Copied!' : 'Copy'}</span>
            </button>
            <button
              onClick={downloadCode}
              className="flex items-center space-x-1 px-3 py-1 bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors"
            >
              <Download size={16} />
              <span className="text-sm">Download</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2" style={{ height: '500px' }}>
        {/* Code Editor */}
        <div className="border-r border-gray-200">
          <AceEditor
            mode={getLanguageMode(language)}
            theme={theme}
            value={code}
            onChange={setCode}
            fontSize={fontSize}
            showPrintMargin={false}
            showGutter={true}
            highlightActiveLine={true}
            setOptions={{
              enableBasicAutocompletion: true,
              enableLiveAutocompletion: true,
              enableSnippets: true,
              showLineNumbers: true,
              tabSize: 2,
              wrap: wordWrap
            }}
            style={{ width: '100%', height: '100%' }}
          />
        </div>

        {/* Output Console */}
        <div className="bg-gray-900 text-green-400 p-4 overflow-auto font-mono text-sm">
          <div className="mb-2 text-gray-400 border-b border-gray-700 pb-2">
            Output Console
          </div>
          <pre className="whitespace-pre-wrap">
            {output || 'Click "Run" to execute your code...'}
          </pre>
        </div>
      </div>

      {/* Bookmarks */}
      {bookmarks.length > 0 && (
        <div className="border-t border-gray-200 p-4">
          <h4 className="font-semibold text-gray-900 mb-3">Code Bookmarks</h4>
          <div className="space-y-2">
            {bookmarks.map((bookmark, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2 bg-gray-50 rounded"
              >
                <span className="text-sm text-gray-700">{bookmark.note}</span>
                <span className="text-xs text-gray-500">
                  {new Date(bookmark.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CodeEditor;
