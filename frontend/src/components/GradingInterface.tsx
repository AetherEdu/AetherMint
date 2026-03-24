/**
 * Instructor Grading Interface
 * Comprehensive grading dashboard with rubric support and annotations
 */

import React, { useState } from 'react';
import { 
  FileText, 
  Download, 
  MessageSquare, 
  CheckCircle, 
  AlertCircle,
  Save,
  Send,
  Plus,
  X,
  Edit3,
  Eye
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Submission {
  id: string;
  studentName: string;
  studentId: string;
  submittedAt: Date;
  isLate: boolean;
  textContent?: string;
  files: Array<{
    id: string;
    name: string;
    size: number;
    type: string;
    url: string;
  }>;
  codeSubmission?: {
    language: string;
    code: string;
  };
  plagiarismScore?: number;
}

interface Grade {
  id: string;
  totalPoints: number;
  earnedPoints: number;
  percentage: number;
  letterGrade?: string;
  feedback?: string;
  privateFeedback?: string;
  rubricGrades?: Array<{
    criterionId: string;
    levelId: string;
    points: number;
    feedback?: string;
  }>;
  annotations?: Array<{
    id: string;
    type: string;
    content: string;
    position: any;
  }>;
  gradedAt?: Date;
}

interface Rubric {
  id: string;
  title: string;
  totalPoints: number;
  criteria: Array<{
    id: string;
    title: string;
    description: string;
    maxPoints: number;
    levels: Array<{
      id: string;
      name: string;
      description: string;
      points: number;
    }>;
  }>;
}

interface GradingInterfaceProps {
  submission: Submission;
  assignment: {
    id: string;
    title: string;
    maxPoints: number;
    rubric?: Rubric;
  };
  existingGrade?: Grade;
  onGrade: (gradeData: any) => Promise<void>;
  onSaveDraft: (gradeData: any) => Promise<void>;
}

export default function GradingInterface({
  submission,
  assignment,
  existingGrade,
  onGrade,
  onSaveDraft
}: GradingInterfaceProps) {
  const [gradeData, setGradeData] = useState({
    totalPoints: assignment.maxPoints,
    earnedPoints: existingGrade?.earnedPoints || 0,
    feedback: existingGrade?.feedback || '',
    privateFeedback: existingGrade?.privateFeedback || '',
    rubricGrades: existingGrade?.rubricGrades || [],
    annotations: existingGrade?.annotations || []
  });

  const [isGrading, setIsGrading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'submission' | 'rubric' | 'feedback'>('submission');

  const handlePointsChange = (value: number) => {
    if (value >= 0 && value <= gradeData.totalPoints) {
      setGradeData(prev => ({ ...prev, earnedPoints: value }));
    }
  };

  const handleRubricGrade = (criterionId: string, levelId: string, points: number, feedback?: string) => {
    setGradeData(prev => ({
      ...prev,
      rubricGrades: prev.rubricGrades.map(g => 
        g.criterionId === criterionId 
          ? { ...g, levelId, points, feedback }
          : g
      )
    }));
  };

  const calculateTotalFromRubric = () => {
    return gradeData.rubricGrades.reduce((sum, grade) => sum + grade.points, 0);
  };

  const percentage = gradeData.totalPoints > 0 ? (gradeData.earnedPoints / gradeData.totalPoints) * 100 : 0;
  const letterGrade = getLetterGrade(percentage);

  const handleSubmitGrade = async () => {
    setIsGrading(true);
    try {
      await onGrade({
        ...gradeData,
        percentage,
        letterGrade
      });
      toast.success('Grade submitted successfully!');
    } catch (error) {
      toast.error('Failed to submit grade');
    } finally {
      setIsGrading(false);
    }
  };

  const handleSaveDraft = async () => {
    setIsSaving(true);
    try {
      await onSaveDraft(gradeData);
      toast.success('Draft saved');
    } catch (error) {
      toast.error('Failed to save draft');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="mb-6 pb-4 border-b">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{assignment.title}</h1>
            <p className="text-gray-600">Student: {submission.studentName}</p>
            <p className="text-sm text-gray-500">
              Submitted: {submission.submittedAt.toLocaleString()}
              {submission.isLate && ' (Late)'}
            </p>
          </div>
          
          {/* Grade Summary */}
          <div className="text-right">
            <div className="text-3xl font-bold text-blue-600">{percentage.toFixed(1)}%</div>
            <div className="text-lg text-gray-600">{letterGrade}</div>
            <div className="text-sm text-gray-500">
              {gradeData.earnedPoints} / {gradeData.totalPoints} points
            </div>
          </div>
        </div>
      </div>

      {/* Plagiarism Warning */}
      {submission.plagiarismScore && submission.plagiarismScore > 0.3 && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <div>
            <p className="font-semibold text-red-900">High Similarity Detected</p>
            <p className="text-red-700">
              {(submission.plagiarismScore * 100).toFixed(1)}% similarity found. Review carefully.
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex space-x-1 mb-6">
        {(['submission', 'rubric', 'feedback'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg transition-colors ${
              activeTab === tab 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'submission' && (
        <div className="space-y-6">
          {/* Text Content */}
          {submission.textContent && (
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Text Submission
              </h3>
              <div className="p-4 bg-gray-50 rounded-lg whitespace-pre-wrap">
                {submission.textContent}
              </div>
            </div>
          )}

          {/* Code Submission */}
          {submission.codeSubmission && (
            <div>
              <h3 className="text-lg font-semibold mb-3">Code Submission</h3>
              <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                <div className="text-sm text-gray-400 mb-2">
                  Language: {submission.codeSubmission.language}
                </div>
                <pre className="font-mono text-sm">
                  <code>{submission.codeSubmission.code}</code>
                </pre>
              </div>
            </div>
          )}

          {/* Files */}
          {submission.files.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3">Submitted Files</h3>
              <div className="space-y-2">
                {submission.files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-gray-500" />
                      <span className="font-medium">{file.name}</span>
                      <span className="text-sm text-gray-500">
                        ({(file.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    </div>
                    <button className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg">
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'rubric' && assignment.rubric && (
        <div className="space-y-6">
          <h3 className="text-lg font-semibold">Grading Rubric</h3>
          {assignment.rubric.criteria.map((criterion) => {
            const currentGrade = gradeData.rubricGrades.find(g => g.criterionId === criterion.id);
            
            return (
              <div key={criterion.id} className="border rounded-lg p-4">
                <h4 className="font-semibold mb-2">{criterion.title}</h4>
                <p className="text-gray-600 text-sm mb-3">{criterion.description}</p>
                
                <div className="space-y-2">
                  {criterion.levels.map((level) => (
                    <label
                      key={level.id}
                      className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                        currentGrade?.levelId === level.id 
                          ? 'bg-blue-50 border border-blue-200' 
                          : 'bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`criterion-${criterion.id}`}
                        checked={currentGrade?.levelId === level.id}
                        onChange={() => handleRubricGrade(criterion.id, level.id, level.points)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="font-medium">{level.name}</div>
                        <div className="text-sm text-gray-600">{level.description}</div>
                      </div>
                      <div className="font-semibold text-blue-600">{level.points} pts</div>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'feedback' && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Student Feedback (Visible to student)
            </label>
            <textarea
              value={gradeData.feedback}
              onChange={(e) => setGradeData(prev => ({ ...prev, feedback: e.target.value }))}
              placeholder="Enter feedback for the student..."
              className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Private Notes (Only visible to instructors)
            </label>
            <textarea
              value={gradeData.privateFeedback}
              onChange={(e) => setGradeData(prev => ({ ...prev, privateFeedback: e.target.value }))}
              placeholder="Enter private notes..."
              className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-between items-center mt-8 pt-6 border-t">
        <button
          onClick={handleSaveDraft}
          disabled={isSaving || isGrading}
          className="flex items-center gap-2 px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {isSaving ? 'Saving...' : 'Save Draft'}
        </button>

        <button
          onClick={handleSubmitGrade}
          disabled={isGrading || isSaving}
          className="flex items-center gap-2 px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
          {isGrading ? 'Submitting...' : 'Submit Grade'}
        </button>
      </div>
    </div>
  );
}

function getLetterGrade(percentage: number): string {
  if (percentage >= 97) return 'A+';
  if (percentage >= 93) return 'A';
  if (percentage >= 90) return 'A-';
  if (percentage >= 87) return 'B+';
  if (percentage >= 83) return 'B';
  if (percentage >= 80) return 'B-';
  if (percentage >= 77) return 'C+';
  if (percentage >= 73) return 'C';
  if (percentage >= 70) return 'C-';
  if (percentage >= 67) return 'D+';
  if (percentage >= 63) return 'D';
  if (percentage >= 60) return 'D-';
  return 'F';
}
