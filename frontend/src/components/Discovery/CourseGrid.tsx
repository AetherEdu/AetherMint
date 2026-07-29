import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Course } from './types';
import SearchBar from './SearchBar';
import FilterPanel from './FilterPanel';
import CourseCard from './CourseCard';
import { SkeletonCard, EmptyState, ErrorDisplay } from '../LoadingFallback';

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
    <div className="flex flex-col lg:flex-row gap-4">
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
          <div className="grid grid-cols-1 xs:grid-cols-2 gap-3 sm:gap-4">
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
            >
              Load more
            </button>
          )}
          {!isLoading && !hasMore && courseList.length > 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 py-4">All courses loaded</p>
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
