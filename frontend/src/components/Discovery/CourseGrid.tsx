import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DiscoveryCourse, SortOption } from './types';
import SearchBar from './SearchBar';
import CourseCard from './CourseCard';

const DEFAULT_PAGE_SIZE = 12;

export const CourseGrid: React.FC = () => {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortOption>('relevance');

  const [courses, setCourses] = useState<DiscoveryCourse[]>([]);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (sort) params.set('sort', sort);
    params.set('limit', String(DEFAULT_PAGE_SIZE));
    params.set('page', String(page));
    return params.toString();
  }, [query, sort, page]);

  useEffect(() => {
    const controller = new AbortController();
    const qs = buildQuery();
    setIsLoading(true);
    fetch(`/api/courses?${qs}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data: { items: DiscoveryCourse[]; total?: number }) => {
        const items = data.items || [];
        if (page === 1) setCourses(items);
        else setCourses((prev) => [...prev, ...items]);
        setHasMore(items.length === DEFAULT_PAGE_SIZE);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        console.error('Failed to load courses', err);
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [buildQuery, page]);

  // reset page when query/filters change
  useEffect(() => { setPage(1); }, [query, sort]);

  const loadMore = () => setPage((p) => p + 1);

  const courseList = useMemo(() => courses, [courses]);

  return (
    <div style={{display: 'flex', gap: 16}}>
      <main style={{flex: 1}} aria-labelledby="course-grid-title">
        <h2 id="course-grid-title" className="sr-only">Course results</h2>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12}}>
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

        <label className="sr-only" htmlFor="course-grid-sort">Sort courses</label>
        <select
          id="course-grid-sort"
          value={sort}
          onChange={(event) => setSort(event.target.value as SortOption)}
          style={{marginBottom: 12, padding: '8px 12px'}}
        >
          <option value="relevance">Relevance</option>
          <option value="newest">Newest</option>
          <option value="popular">Popular</option>
          <option value="duration">Duration</option>
        </select>

        <section aria-live="polite" aria-busy={isLoading}>
          {isLoading && page === 1 ? (
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12}}>
              {Array.from({length: 6}).map((_, i) => (
                <div key={i} style={{background: '#fafafa', height: 100, borderRadius: 8}} aria-hidden="true" />
              ))}
            </div>
          ) : (
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12}} role="list" aria-label="Courses">
              {courseList.map((c) => (
                <CourseCard key={c.id} course={c} view="grid" />
              ))}
            </div>
          )}
        </section>

        <div style={{marginTop: 12, textAlign: 'center'}}>
          {isLoading && page > 1 && <div>Loading more…</div>}
          {!isLoading && hasMore && (
            <button onClick={loadMore} style={{padding: '8px 12px'}} aria-label="Load more courses">Load more</button>
          )}
          {!isLoading && !hasMore && courses.length > 0 && <div style={{color: '#666'}}>End of results</div>}
          {!isLoading && courses.length === 0 && <div style={{color: '#666'}}>No courses found</div>}
        </div>
      </main>
    </div>
  );
};

export default CourseGrid;
