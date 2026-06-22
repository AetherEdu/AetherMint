import { BookmarkPlus, Eye, Network } from 'lucide-react';
import { DiscoveryCourse, ViewMode } from './types';

import React from 'react';

const truncate = (s = '', n = 120) =>
  s.length > n ? `${s.slice(0, n).trim()}…` : s;

export const CourseCard: React.FC<{
  course: DiscoveryCourse;
  view: ViewMode;
  isSelected?: boolean;
  onPreview?: () => void;
  onSave?: () => void;
  onFindSimilar?: () => void;
}> = ({ course, view, isSelected, onPreview, onSave, onFindSimilar }) => {
  const headingId = `course-${course.id}-title`;

  return (
    <article
      aria-describedby={`course-${course.id}-meta course-${course.id}-description`}
      aria-labelledby={headingId}
      role="listitem"
      className={`rounded-[24px] border p-4 transition ${isSelected ? 'border-amber-400 bg-amber-50/60 shadow-[0_18px_60px_rgba(245,158,11,0.12)]' : 'border-slate-200 bg-white hover:border-slate-400'}`}
    >
      <div
        className={`${view === 'list' ? 'flex-row' : 'flex-col'} flex gap-4`}
      >
        <img
          src={course.thumbnail || '/placeholder-course.png'}
          alt={course.title}
          loading="lazy"
          className={`${view === 'list' ? 'h-28 w-40' : 'h-40 w-full'} rounded-[20px] object-cover`}
        />
        <div className="flex flex-1 flex-col">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-slate-500">
                {course.category}
              </div>
              <h3 id={headingId} className="mt-1 text-lg font-semibold text-slate-950">
                {course.title}
              </h3>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700" aria-label={`Rating ${course.rating.toFixed(1)} out of 5`}>
              {course.rating.toFixed(1)}
            </div>
          </div>

          <div id={`course-${course.id}-meta`} className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
            <span>{course.provider}</span>
            <span aria-hidden="true">·</span>
            <span>{course.durationHours}h</span>
            <span aria-hidden="true">·</span>
            <span>{course.level}</span>
            <span aria-hidden="true">·</span>
            <span>{course.price === 0 ? 'Free' : `$${course.price}`}</span>
          </div>

          <p id={`course-${course.id}-description`} className="mt-3 text-sm leading-6 text-slate-600">
            {truncate(
              course.preview || course.description,
              view === 'list' ? 200 : 136,
            )}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {(course.tags || []).slice(0, 4).map((t) => (
              <span
                key={t}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700"
              >
                {t}
              </span>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {course.matchReasons.slice(0, 2).map((reason) => (
              <span
                key={reason}
                className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-900"
              >
                {reason}
              </span>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
              onClick={onPreview}
              aria-label={`Preview ${course.title}`}
            >
              <Eye size={15} aria-hidden="true" />
              Preview
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-950"
              onClick={onSave}
              aria-label={`Save ${course.title}`}
            >
              <BookmarkPlus size={15} aria-hidden="true" />
              Save
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-950"
              onClick={onFindSimilar}
              aria-label={`Find courses similar to ${course.title}`}
            >
              <Network size={15} aria-hidden="true" />
              Similar
            </button>
          </div>
        </div>
      </div>
    </article>
  );
};

export default CourseCard;
