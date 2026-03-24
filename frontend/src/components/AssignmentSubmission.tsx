/**
 * Assignment Submission Component
 * Handles various types of assignment submissions with rich text editor and file uploads
 */

import React, { useState, useCallback, useRef } from 'react';
import { 
  Upload, 
  FileText, 
  Code, 
  Video, 
  Music, 
  Clock, 
  AlertCircle,
  CheckCircle,
  Save,
  Send,
  X,
  File
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Assignment {
  id: string;
  title: string;
  description: string;
  instructions: string;
  type: 'quiz' | 'essay' | 'code' | 'project' | 'video' | 'file_upload' | 'text_submission';
  submissionTypes: string[];
  maxPoints: number;
  dueDate: Date;
  allowLateSubmissions: boolean;
  latePolicy?: string;
  maxFileSize?: number;
  maxFiles?: number;
  allowedFileTypes?: string[];
  timeLimit?: number;
}

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string;
  file?: File;
}

interface AssignmentSubmissionProps {
  assignment: Assignment;
  existingSubmission?: any;
  onSubmit: (submissionData: any) => Promise<void>;
  onSaveDraft: (submissionData: any) => Promise<void>;
}

export default function AssignmentSubmission({ 
  assignment, 
  existingSubmission, 
  onSubmit, 
  onSaveDraft 
}: AssignmentSubmissionProps) {
  const [submissionData, setSubmissionData] = useState({
    textContent: existingSubmission?.textContent || '',
    codeSubmission: existingSubmission?.codeSubmission || { language: '', code: '' },
    files: existingSubmission?.files || [],
    videoSubmission: existingSubmission?.videoSubmission || null,
    audioSubmission: existingSubmission?.audioSubmission || null
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>(existingSubmission?.files || []);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isLate = new Date() > new Date(assignment.dueDate);
  const canSubmit = assignment.allowLateSubmissions || !isLate;

  const handleTextChange = (content: string) => {
    setSubmissionData(prev => ({ ...prev, textContent: content }));
  };

  const handleCodeChange = (field: 'language' | 'code', value: string) => {
    setSubmissionData(prev => ({
      ...prev,
      codeSubmission: { ...prev.codeSubmission, [field]: value }
    }));
  };

  const handleFileUpload = useCallback((files: FileList | null) => {
    if (!files) return;

    const newFiles: UploadedFile[] = [];
    const maxSize = assignment.maxFileSize ? assignment.maxFileSize * 1024 * 1024 : 100 * 1024 * 1024; // Default 100MB
    const maxFiles = assignment.maxFiles || 10;

    Array.from(files).forEach((file) => {
      if (uploadedFiles.length + newFiles.length >= maxFiles) {
        toast.error(`Maximum ${maxFiles} files allowed`);
        return;
      }

      if (file.size > maxSize) {
        toast.error(`File ${file.name} exceeds maximum size limit`);
        return;
      }

      // Check file type if restrictions exist
      if (assignment.allowedFileTypes && assignment.allowedFileTypes.length > 0) {
        const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
        if (!assignment.allowedFileTypes.includes(fileExtension)) {
          toast.error(`File type ${fileExtension} is not allowed`);
          return;
        }
      }

      newFiles.push({
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        size: file.size,
        type: file.type,
        file
      });
    });

    setUploadedFiles(prev => [...prev, ...newFiles]);
  }, [uploadedFiles, assignment.maxFileSize, assignment.maxFiles, assignment.allowedFileTypes]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files);
    }
  }, [handleFileUpload]);

  const removeFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      toast.error('Submission is not allowed');
      return;
    }

    // Validate submission based on assignment requirements
    if (assignment.submissionTypes.includes('text') && !submissionData.textContent.trim()) {
      toast.error('Text content is required');
      return;
    }

    if (assignment.submissionTypes.includes('file') && uploadedFiles.length === 0) {
      toast.error('At least one file must be uploaded');
      return;
    }

    if (assignment.submissionTypes.includes('code') && !submissionData.codeSubmission.code.trim()) {
      toast.error('Code submission is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const submissionPayload = {
        ...submissionData,
        files: uploadedFiles
      };

      await onSubmit(submissionPayload);
      toast.success('Assignment submitted successfully!');
    } catch (error) {
      toast.error('Failed to submit assignment');
      console.error('Submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveDraft = async () => {
    setIsSaving(true);
    try {
      const draftPayload = {
        ...submissionData,
        files: uploadedFiles
      };

      await onSaveDraft(draftPayload);
      toast.success('Draft saved successfully');
    } catch (error) {
      toast.error('Failed to save draft');
      console.error('Save draft error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <File className="w-4 h-4 text-green-500" />;
    if (type.startsWith('video/')) return <Video className="w-4 h-4 text-blue-500" />;
    if (type.startsWith('audio/')) return <Music className="w-4 h-4 text-purple-500" />;
    if (type.includes('pdf') || type.includes('document')) return <FileText className="w-4 h-4 text-red-500" />;
    if (type.includes('javascript') || type.includes('python') || type.includes('java')) return <Code className="w-4 h-4 text-orange-500" />;
    return <File className="w-4 h-4 text-gray-500" />;
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      {/* Assignment Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{assignment.title}</h1>
        <p className="text-gray-600 mb-4">{assignment.description}</p>
        
        {/* Assignment Info */}
        <div className="flex flex-wrap gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-500" />
            <span className={`text-sm ${isLate ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
              Due: {new Date(assignment.dueDate).toLocaleString()}
              {isLate && ' (Late)'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Max Points: {assignment.maxPoints}</span>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">Instructions</h3>
          <div className="text-blue-800 whitespace-pre-wrap">{assignment.instructions}</div>
        </div>
      </div>

      {/* Submission Types */}
      {assignment.submissionTypes.includes('text') && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Text Submission
          </h3>
          <textarea
            value={submissionData.textContent}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder="Enter your text submission here..."
            className="w-full h-64 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
        </div>
      )}

      {assignment.submissionTypes.includes('code') && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Code className="w-5 h-5" />
            Code Submission
          </h3>
          <div className="space-y-3">
            <select
              value={submissionData.codeSubmission.language}
              onChange={(e) => handleCodeChange('language', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select programming language</option>
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
              <option value="java">Java</option>
              <option value="cpp">C++</option>
              <option value="c">C</option>
              <option value="php">PHP</option>
              <option value="ruby">Ruby</option>
              <option value="go">Go</option>
              <option value="rust">Rust</option>
            </select>
            <textarea
              value={submissionData.codeSubmission.code}
              onChange={(e) => handleCodeChange('code', e.target.value)}
              placeholder="Enter your code here..."
              className="w-full h-64 p-4 font-mono text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>
        </div>
      )}

      {assignment.submissionTypes.includes('file') && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Upload className="w-5 h-5" />
            File Upload
          </h3>
          
          {/* File Upload Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">
              Drag and drop files here, or click to select files
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Max file size: {assignment.maxFileSize || 100}MB, Max files: {assignment.maxFiles || 10}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={(e) => handleFileUpload(e.target.files)}
              className="hidden"
              accept={assignment.allowedFileTypes?.join(',')}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Select Files
            </button>
          </div>

          {/* Uploaded Files List */}
          {uploadedFiles.length > 0 && (
            <div className="mt-4">
              <h4 className="font-semibold mb-2">Uploaded Files</h4>
              <div className="space-y-2">
                {uploadedFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {getFileIcon(file.type)}
                      <div>
                        <p className="font-medium text-gray-900">{file.name}</p>
                        <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFile(file.id)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Status Messages */}
      {!canSubmit && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <div>
            <p className="font-semibold text-red-900">Submission Closed</p>
            <p className="text-red-700">
              This assignment is past due and late submissions are not allowed.
            </p>
          </div>
        </div>
      )}

      {isLate && canSubmit && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-3">
          <Clock className="w-5 h-5 text-yellow-600" />
          <div>
            <p className="font-semibold text-yellow-900">Late Submission</p>
            <p className="text-yellow-700">
              This assignment is late. {assignment.latePolicy && 'A late penalty may be applied.'}
            </p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-between items-center">
        <button
          onClick={handleSaveDraft}
          disabled={isSaving || isSubmitting}
          className="flex items-center gap-2 px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {isSaving ? 'Saving...' : 'Save Draft'}
        </button>

        <button
          onClick={handleSubmit}
          disabled={!canSubmit || isSubmitting || isSaving}
          className="flex items-center gap-2 px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
          {isSubmitting ? 'Submitting...' : 'Submit Assignment'}
        </button>
      </div>
    </div>
  );
}
