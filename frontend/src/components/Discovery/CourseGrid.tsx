import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Course } from './types';
import SearchBar from './SearchBar';
import FilterPanel from './FilterPanel';
import CourseCard from './CourseCard';
import { SkeletonCard, EmptyState, ErrorDisplay } from '../LoadingFallback';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import CourseCard from './CourseCard';
import SearchBar from './SearchBar';
import { DiscoveryCourse, SortOption } from './types';

const DEFAULT_PAGE_SIZE = 12;

export const CourseGrid: React.FC = () => {
  const [query, setQuery] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<'relevance' | 'newest' | 'popular' | 'duration'>('relevance');

  const [courses, setCourses] = useState<Course[]>([]);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch('/api/categories')
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (mounted && Array.isArray(data)) setCategories(data); })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);
  const [sort, setSort] = useState<SortOption>('relevance');
  const [courses, setCourses] = useState<DiscoveryCourse[]>([]);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (sort) params.set('sort', sort);
    params.set('limit', String(DEFAULT_PAGE_SIZE));
    params.set('page', String(page));
    return params.toString();
  }, [query, sort, page]);

  const loadCourses = useCallback(() => {
    const controller = new AbortController();
    const qs = buildQuery();
    setIsLoading(true);
    setError(null);
    fetch(`/api/courses?${qs}`, { signal: controller.signal })
      .then(r => r.json())
      .then((data: { items: Course[]; total?: number }) => {
        if (page === 1) setCourses(data.items || []);
        else setCourses(prev => [...prev, ...(data.items || [])]);
        setHasMore((data.items || []).length === DEFAULT_PAGE_SIZE);
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        setError('Failed to load courses. Please try again.');
      .then((response) => response.json())
      .then((data: { items: DiscoveryCourse[]; total?: number }) => {
        const items = data.items || [];
        if (page === 1) setCourses(items);
        else setCourses((current) => [...current, ...items]);
        setHasMore(items.length === DEFAULT_PAGE_SIZE);
      })
      .catch((error) => {
        if (error.name === 'AbortError') return;
        console.error('Failed to load courses', error);
      })
      .finally(() => setIsLoading(false));
    return controller;
  }, [buildQuery, page]);

  useEffect(() => {
    const controller = loadCourses();
    return () => controller.abort();
  }, [loadCourses]);

  useEffect(() => {
    setPage(1);
  }, [query, sort]);

  const loadMore = () => setPage((current) => current + 1);
  const courseList = useMemo(() => courses, [courses]);

  const toggleCategory = (cat: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  const handleRetry = () => { setPage(1); setError(null); loadCourses(); };

  const courseList = useMemo(() => courses, [courses]);
  const isFirstLoad = isLoading && page === 1;

  return (
    <div className="flex gap-4">
      <FilterPanel
        categories={categories}
        selected={selected}
        onToggleCategory={toggleCategory}
        sort={sort as any}
        onSortChange={s => setSort(s)}
      />

      <main className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-4">
          <SearchBar onSearch={setQuery} initial={query} />
        </div>

        {error && (
          <ErrorDisplay
            message={error}
            onRetry={handleRetry}
            className="mb-4"
          />
        )}

        {isFirstLoad ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : !error && courseList.length === 0 ? (
          <EmptyState
            icon={<Search className="h-8 w-8" />}
            title="No courses found"
            description={query || selected.size ? 'Try adjusting your search or filters.' : 'No courses are available yet.'}
            action={query || selected.size ? { label: 'Clear filters', onClick: () => { setQuery(''); setSelected(new Set()); } } : undefined}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {courseList.map(c => <CourseCard key={c.id} course={c} />)}
          </div>
        )}

        <div className="mt-4 text-center">
          {isLoading && page > 1 && (
            <div className="flex justify-center gap-2 py-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <SkeletonCard key={i} className="h-6 w-24 !p-0 border-0" />
              ))}
            </div>
          )}
          {!isLoading && hasMore && courseList.length > 0 && (
            <button
              onClick={() => setPage(p => p + 1)}
              className="px-5 py-2 text-sm font-medium text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
  const focusCourseCard = (index: number) => {
    cardRefs.current[index]?.focus();
  };

  const handleCourseCardKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>, index: number) => {
      const lastIndex = courseList.length - 1;

      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        focusCourseCard(index === lastIndex ? 0 : index + 1);
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        focusCourseCard(index === 0 ? lastIndex : index - 1);
      } else if (event.key === 'Home') {
        event.preventDefault();
        focusCourseCard(0);
      } else if (event.key === 'End') {
        event.preventDefault();
        focusCourseCard(lastIndex);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        (document.getElementById('course-grid-sort') as HTMLSelectElement | null)?.focus();
      }
    },
    [courseList.length],
  );

  return (
    <div style={{ display: 'flex', gap: 16 }}>
      <main style={{ flex: 1 }} aria-labelledby="course-grid-title">
        <h2 id="course-grid-title" className="sr-only">
          Course results
        </h2>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <SearchBar
            value={query}
            suggestions={[]}
            resultCountLabel={`${courses.length} courses loaded`}
            onChange={setQuery}
            onSubmit={setQuery}
            onSelectSuggestion={setQuery}
            onVoiceSearch={setQuery}
          />
        </div>

        <label className="sr-only" htmlFor="course-grid-sort">
          Sort courses
        </label>
        <select
          id="course-grid-sort"
          value={sort}
          onChange={(event) => setSort(event.target.value as SortOption)}
          style={{ marginBottom: 12, padding: '8px 12px' }}
        >
          <option value="relevance">Relevance</option>
          <option value="newest">Newest</option>
          <option value="popular">Popular</option>
          <option value="duration">Duration</option>
        </select>

        <section aria-live="polite" aria-busy={isLoading}>
          {isLoading && page === 1 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  style={{ background: '#fafafa', height: 100, borderRadius: 8 }}
                  aria-hidden="true"
                />
              ))}
            </div>
          ) : (
            <div
              style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}
              role="list"
              aria-label="Courses"
            >
              {courseList.map((course, index) => (
                <CourseCard
                  key={course.id}
                  ref={(node) => {
                    cardRefs.current[index] = node;
                  }}
                  course={course}
                  view="grid"
                  onKeyDown={(event) => handleCourseCardKeyDown(event, index)}
                />
              ))}
            </div>
          )}
        </section>

        <div style={{ marginTop: 12, textAlign: 'center' }}>
          {isLoading && page > 1 && <div aria-live="polite">Loading more...</div>}
          {!isLoading && hasMore && (
            <button
              type="button"
              onClick={loadMore}
              style={{ padding: '8px 12px' }}
              aria-label="Load more courses"
            >
              Load more
            </button>
          )}
          {!isLoading && !hasMore && courseList.length > 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 py-4">All courses loaded</p>
          {!isLoading && !hasMore && courses.length > 0 && (
            <div style={{ color: '#666' }}>End of results</div>
          )}
          {!isLoading && courses.length === 0 && (
            <div style={{ color: '#666' }}>No courses found</div>
          )}
        </div>
      </main>
    </div>
  );
};

export default CourseGrid;
