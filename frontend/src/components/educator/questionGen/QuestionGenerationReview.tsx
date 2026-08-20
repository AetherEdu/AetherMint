'use client';

import React, { useCallback, useEffect, useState } from 'react';

export type ReviewStatus = 'pending' | 'approved' | 'rejected';
export type GeneratedQuestionType = 'multiple-choice' | 'true-false';

export interface GeneratedOption {
  id: string;
  text: string;
  isCorrect: boolean;
  explanation?: string;
}

export interface GeneratedQuestion {
  id: string;
  type: GeneratedQuestionType;
  question: string;
  options: GeneratedOption[];
  difficulty: 'easy' | 'medium' | 'hard';
  qualityScore: number;
  qualityFlags: string[];
  reviewStatus: ReviewStatus;
  sourceExcerpt: string;
}

interface GenerationJob {
  id: string;
  title: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  questions: GeneratedQuestion[];
  error?: string;
  importedQuizId?: string;
}

interface QuestionGenerationReviewProps {
  jobId: string;
  apiBasePath?: string;
  onImported?: (quizId: string) => void;
}

const statusClasses: Record<ReviewStatus, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-rose-100 text-rose-800',
};

const QuestionGenerationReview: React.FC<QuestionGenerationReviewProps> = ({
  jobId,
  apiBasePath = '/api/question-generation',
  onImported,
}) => {
  const [job, setJob] = useState<GenerationJob | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftQuestion, setDraftQuestion] = useState('');
  const [draftOptions, setDraftOptions] = useState<GeneratedOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadJob = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch(`${apiBasePath}/${jobId}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Unable to load generation job');
      setJob(payload.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load generation job');
    } finally {
      setLoading(false);
    }
  }, [apiBasePath, jobId]);

  useEffect(() => {
    void loadJob();
  }, [loadJob]);

  const toggleSelected = (questionId: string) => {
    setSelected(current => current.includes(questionId)
      ? current.filter(id => id !== questionId)
      : [...current, questionId]);
  };

  const reviewSelected = async (status: Exclude<ReviewStatus, 'pending'>) => {
    if (selected.length === 0) return;
    setSaving(true);
    try {
      const response = await fetch(`${apiBasePath}/${jobId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionIds: selected, status }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Unable to update review status');
      setJob(payload.data);
      setSelected([]);
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'Unable to update review status');
    } finally {
      setSaving(false);
    }
  };

  const startEditing = (question: GeneratedQuestion) => {
    setEditingId(question.id);
    setDraftQuestion(question.question);
    setDraftOptions(question.options.map(option => ({ ...option })));
  };

  const saveQuestion = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      const response = await fetch(`${apiBasePath}/${jobId}/questions/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: draftQuestion, options: draftOptions }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Unable to save question');
      setJob(current => current ? {
        ...current,
        questions: current.questions.map(question => question.id === editingId ? payload.data : question),
      } : current);
      setEditingId(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save question');
    } finally {
      setSaving(false);
    }
  };

  const importApproved = async () => {
    setSaving(true);
    try {
      const response = await fetch(`${apiBasePath}/${jobId}/import`, { method: 'POST' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Approve questions before importing');
      setJob(current => current ? { ...current, importedQuizId: payload.data.id } : current);
      onImported?.(payload.data.id);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Unable to import quiz');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="rounded-lg bg-slate-50 p-6 text-slate-600">Loading generated questions…</p>;
  if (error && !job) return <p role="alert" className="rounded-lg bg-rose-50 p-6 text-rose-700">{error}</p>;
  if (!job) return null;

  const approvedCount = job.questions.filter(question => question.reviewStatus === 'approved').length;
  const lowConfidenceCount = job.questions.filter(question => question.qualityFlags.includes('low-confidence')).length;

  return (
    <section aria-labelledby="question-generation-review-title" className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-indigo-600">Question review</p>
          <h2 id="question-generation-review-title" className="text-2xl font-bold text-slate-900">{job.title}</h2>
          <p className="mt-1 text-sm text-slate-600">Every question stays staged until an educator approves it.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{approvedCount} approved</span>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800">{lowConfidenceCount} need attention</span>
          <span className="rounded-full bg-blue-100 px-3 py-1 text-blue-800">{job.progress}% complete</span>
        </div>
      </div>

      {job.status !== 'completed' && (
        <div className="rounded-lg bg-blue-50 p-4 text-blue-800" role="status" aria-live="polite">
          {job.status === 'failed' ? job.error || 'Generation failed.' : `Generation is ${job.status}. You can keep this page open while it completes.`}
          {job.status !== 'failed' && <button type="button" className="ml-3 underline" onClick={() => void loadJob()}>Refresh</button>}
        </div>
      )}

      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

      {job.questions.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 pb-4">
          <span className="text-sm font-medium text-slate-700">Selected: {selected.length}</span>
          <button type="button" disabled={saving || selected.length === 0} onClick={() => void reviewSelected('approved')} className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Approve selected</button>
          <button type="button" disabled={saving || selected.length === 0} onClick={() => void reviewSelected('rejected')} className="rounded-md bg-rose-600 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Reject selected</button>
          <a href={`${apiBasePath}/${jobId}/export`} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">Export approved</a>
          <button type="button" disabled={saving || approvedCount === 0 || Boolean(job.importedQuizId)} onClick={() => void importApproved()} className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{job.importedQuizId ? 'Imported into quiz' : 'Import approved quiz'}</button>
        </div>
      )}

      <div className="space-y-4">
        {job.questions.map(question => (
          <article key={question.id} className="rounded-lg border border-slate-200 p-4">
            <div className="flex gap-3">
              <input
                type="checkbox"
                checked={selected.includes(question.id)}
                onChange={() => toggleSelected(question.id)}
                aria-label={`Select question: ${question.question}`}
                className="mt-1 h-4 w-4"
              />
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">{question.type}</span>
                  <span className="rounded-full bg-violet-100 px-2 py-1 text-violet-800">{question.difficulty}</span>
                  <span className={`rounded-full px-2 py-1 ${statusClasses[question.reviewStatus]}`}>{question.reviewStatus}</span>
                  <span className="text-slate-500">Quality {Math.round(question.qualityScore * 100)}%</span>
                </div>

                {editingId === question.id ? (
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-slate-700">Question text
                      <textarea value={draftQuestion} onChange={event => setDraftQuestion(event.target.value)} rows={3} className="mt-1 w-full rounded-md border border-slate-300 p-2" />
                    </label>
                    {draftOptions.map((option, index) => (
                      <label key={option.id} className="block text-sm text-slate-700">Option {index + 1}
                        <input value={option.text} onChange={event => setDraftOptions(current => current.map(item => item.id === option.id ? { ...item, text: event.target.value } : item))} className="mt-1 w-full rounded-md border border-slate-300 p-2" />
                      </label>
                    ))}
                    <div className="flex gap-2">
                      <button type="button" disabled={saving} onClick={() => void saveQuestion()} className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white">Save changes</button>
                      <button type="button" onClick={() => setEditingId(null)} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h3 className="text-lg font-semibold text-slate-900">{question.question}</h3>
                    <ul className="space-y-1 text-sm text-slate-700">
                      {question.options.map(option => <li key={option.id} className={option.isCorrect ? 'font-semibold text-emerald-700' : ''}>{option.isCorrect ? '✓ ' : '○ '}{option.text}</li>)}
                    </ul>
                    <p className="text-sm text-slate-500"><span className="font-medium">Source:</span> {question.sourceExcerpt}</p>
                    {question.qualityFlags.length > 0 && <p className="text-sm text-amber-700"><span className="font-medium">Review flags:</span> {question.qualityFlags.join(', ')}</p>}
                    <button type="button" onClick={() => startEditing(question)} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700">Edit before review</button>
                  </>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

export default QuestionGenerationReview;
