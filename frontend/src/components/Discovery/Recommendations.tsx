import CourseCard from './CourseCard';
import React from 'react';
import { RecommendationItem } from './types';

export const Recommendations: React.FC<{
  title: string;
  subtitle: string;
  items: RecommendationItem[];
  onSelect: (course: RecommendationItem) => void;
}> = ({ title, subtitle, items, onSelect }) => {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-sm uppercase tracking-[0.18em] text-slate-500">
        Recommendations
      </div>
      <h2
        className="mt-1 text-2xl font-semibold text-slate-900"
        style={{ fontFamily: 'Space Grotesk, IBM Plex Sans, sans-serif' }}
      >
        {title}
      </h2>
      <p className="mt-2 text-sm text-slate-600">{subtitle}</p>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {items.map((c) => (
          <div key={c.id} className="space-y-3">
            <CourseCard
              course={c}
              isSelected={false}
              onFindSimilar={() => onSelect(c)}
              onPreview={() => onSelect(c)}
              onSave={() => onSelect(c)}
              view="grid"
            />
            <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-950">
              {c.reason}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default Recommendations;
