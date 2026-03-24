import {
  AlertRecord,
  CuratorRecommendation,
  DiscoveryCourse,
  DiscoveryFilters,
  DiscoverySearchResponse,
  LearningPath,
  RecommendationItem,
  SavedSearch,
  SearchAnalyticsSnapshot,
  SearchHistoryEntry,
} from './types';
import {
  BellRing,
  Compass,
  Layers3,
  Mic,
  Search as SearchIcon,
  Sparkles,
  Wand2,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

import CourseCard from './CourseCard';
import FilterPanel from './FilterPanel';
import Recommendations from './Recommendations';
import SearchBar from './SearchBar';
import { discoveryApi } from '../../lib/discoveryApi';

const createSessionId = () =>
  `discovery_${Math.random().toString(36).slice(2, 10)}`;

const defaultFilters: DiscoveryFilters = {
  query: '',
  categories: [],
  levels: [],
  languages: [],
  tags: [],
  minRating: 0,
  maxPrice: 150,
  maxDuration: 16,
  freeOnly: false,
  sortBy: 'relevance',
  view: 'grid',
  page: 1,
  limit: 12,
};

const formatPrice = (value: number) => (value === 0 ? 'Free' : `$${value}`);

export const DiscoveryExperience: React.FC = () => {
  const [sessionId, setSessionId] = useState('browser_pending');
  const [filters, setFilters] = useState<DiscoveryFilters>(defaultFilters);
  const [searchData, setSearchData] = useState<DiscoverySearchResponse | null>(
    null,
  );
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>(
    [],
  );
  const [trending, setTrending] = useState<DiscoveryCourse[]>([]);
  const [learningPaths, setLearningPaths] = useState<LearningPath[]>([]);
  const [curators, setCurators] = useState<CuratorRecommendation[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [history, setHistory] = useState<SearchHistoryEntry[]>([]);
  const [analytics, setAnalytics] = useState<SearchAnalyticsSnapshot | null>(
    null,
  );
  const [selectedCourse, setSelectedCourse] = useState<DiscoveryCourse | null>(
    null,
  );
  const [similarCourses, setSimilarCourses] = useState<DiscoveryCourse[]>([]);
  const [isLoadingSearch, setIsLoadingSearch] = useState(true);
  const [isSavingSearch, setIsSavingSearch] = useState(false);
  const [isCreatingAlert, setIsCreatingAlert] = useState(false);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  useEffect(() => {
    const storedSessionId =
      window.sessionStorage.getItem('starked-discovery-session') ||
      createSessionId();
    window.sessionStorage.setItem('starked-discovery-session', storedSessionId);
    setSessionId(storedSessionId);
  }, []);

  useEffect(() => {
    if (sessionId === 'browser_pending') {
      return;
    }

    let cancelled = false;
    setIsLoadingSearch(true);

    const timer = window.setTimeout(async () => {
      try {
        const [
          searchResult,
          recommendationResult,
          trendingResult,
          pathResult,
          curatorResult,
          historyResult,
          savedResult,
          alertsResult,
          analyticsResult,
        ] = await Promise.all([
          discoveryApi.search(filters, sessionId),
          discoveryApi.recommendations(sessionId),
          discoveryApi.trending(),
          discoveryApi.learningPaths(filters.query, sessionId),
          discoveryApi.curators(),
          discoveryApi.history(sessionId),
          discoveryApi.savedSearches(sessionId),
          discoveryApi.alerts(sessionId),
          discoveryApi.analytics(),
        ]);

        if (cancelled) {
          return;
        }

        setSearchData(searchResult);
        setSelectedCourse(
          (current) => current || searchResult.results[0] || null,
        );
        setRecommendations(recommendationResult.items);
        setTrending(trendingResult.items);
        setLearningPaths(pathResult.items);
        setCurators(curatorResult.items);
        setHistory(historyResult.items);
        setSavedSearches(savedResult.items);
        setAlerts(alertsResult.items);
        setAnalytics(analyticsResult);
      } catch (error) {
        if (!cancelled) {
          setBannerMessage(
            'Search service is unavailable. Verify the backend is running on NEXT_PUBLIC_API_BASE_URL.',
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSearch(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [filters, sessionId]);

  useEffect(() => {
    if (!filters.query || sessionId === 'browser_pending') {
      setSuggestions([]);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const data = await discoveryApi.suggestions(filters.query, sessionId);
        if (!cancelled) {
          setSuggestions(data.suggestions);
        }
      } catch (error) {
        if (!cancelled) {
          setSuggestions([]);
        }
      }
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [filters.query, sessionId]);

  useEffect(() => {
    if (!selectedCourse) {
      setSimilarCourses([]);
      return;
    }

    let cancelled = false;
    discoveryApi
      .similar(selectedCourse.id)
      .then((result) => {
        if (!cancelled) {
          setSimilarCourses(result.items);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSimilarCourses([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedCourse]);

  const updateFilters = (next: Partial<DiscoveryFilters>) => {
    setFilters((current) => ({ ...current, ...next, page: next.page || 1 }));
  };

  const handleSelectCourse = async (course: DiscoveryCourse) => {
    setSelectedCourse(course);

    if (searchData?.searchId) {
      try {
        await discoveryApi.recordClick({
          searchId: searchData.searchId,
          resultId: course.id,
          action: 'preview',
          sessionId,
        });
      } catch (error) {
        return;
      }
    }
  };

  const handleApplySavedSearch = (savedSearch: SavedSearch) => {
    setFilters({
      ...defaultFilters,
      ...savedSearch.filters,
      query: savedSearch.query,
      page: 1,
      limit: defaultFilters.limit,
    });
  };

  const handleSaveSearch = async () => {
    if (!filters.query) {
      setBannerMessage('Enter a query before saving a search.');
      return;
    }

    setIsSavingSearch(true);

    try {
      const savedSearch = await discoveryApi.saveSearch({
        name: `Saved: ${filters.query}`,
        query: filters.query,
        filters,
        alertEnabled: false,
        sessionId,
      });

      setSavedSearches((current) => [savedSearch, ...current].slice(0, 6));
      setBannerMessage(`Saved search for “${filters.query}”.`);
    } catch (error) {
      setBannerMessage('Failed to save search.');
    } finally {
      setIsSavingSearch(false);
    }
  };

  const handleCreateAlert = async () => {
    if (!filters.query) {
      setBannerMessage('Run a search before creating an alert.');
      return;
    }

    setIsCreatingAlert(true);

    try {
      const alert = await discoveryApi.createAlert({
        query: filters.query,
        filters,
        frequency: 'weekly',
        channel: 'in-app',
        sessionId,
      });

      setAlerts((current) => [alert, ...current].slice(0, 6));
      setBannerMessage(`Weekly alert created for “${filters.query}”.`);
    } catch (error) {
      setBannerMessage('Failed to create alert.');
    } finally {
      setIsCreatingAlert(false);
    }
  };

  const handleVoiceSearch = async (transcript: string) => {
    try {
      const response = await discoveryApi.voiceSearch(
        transcript,
        filters,
        sessionId,
      );
      setFilters((current) => ({
        ...current,
        query: response.normalizedQuery,
        page: 1,
      }));
      setSearchData(response.result);
      setSelectedCourse(response.result.results[0] || null);
      setBannerMessage(
        `Voice search interpreted as “${response.normalizedQuery}”.`,
      );
    } catch (error) {
      setBannerMessage('Voice search failed.');
    }
  };

  const resultCountLabel = `${searchData?.total || 0} results`;

  return (
    <div
      className="min-h-screen bg-[#f4efe6] text-slate-900"
      style={{ fontFamily: 'IBM Plex Sans, Avenir Next, sans-serif' }}
    >
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.35),_transparent_28%),linear-gradient(135deg,#17324d_0%,#284a68_45%,#3c6c84_100%)] p-8 text-white shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm uppercase tracking-[0.2em] text-amber-100">
                <Sparkles size={16} />
                Advanced Search and Discovery
              </div>
              <h1
                className="max-w-2xl text-4xl font-semibold leading-tight sm:text-5xl"
                style={{
                  fontFamily: 'Space Grotesk, IBM Plex Sans, sans-serif',
                }}
              >
                Search courses like a strategist, not a keyword typist.
              </h1>
              <p className="mt-4 max-w-2xl text-base text-slate-100/90 sm:text-lg">
                Full-text search, AI-assisted ranking, recommendations, learning
                paths, voice input, and faceted discovery in one working
                surface.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-200">
                  Indexed
                </div>
                <div className="mt-2 text-2xl font-semibold">
                  {searchData?.analytics.indexedDocuments || 0}
                </div>
              </div>
              <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-200">
                  Latency
                </div>
                <div className="mt-2 text-2xl font-semibold">
                  {searchData?.analytics.processingTimeMs || 0}ms
                </div>
              </div>
              <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-200">
                  Variant
                </div>
                <div className="mt-2 text-2xl font-semibold">
                  {searchData?.variant || 'control'}
                </div>
              </div>
              <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-200">
                  Saved
                </div>
                <div className="mt-2 text-2xl font-semibold">
                  {savedSearches.length}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 rounded-[24px] border border-white/10 bg-white/95 p-4 text-slate-900 shadow-xl">
            <SearchBar
              value={filters.query}
              suggestions={suggestions}
              resultCountLabel={resultCountLabel}
              onChange={(query) => updateFilters({ query })}
              onSubmit={(query) => updateFilters({ query })}
              onSelectSuggestion={(query) => updateFilters({ query })}
              onVoiceSearch={handleVoiceSearch}
            />
          </div>
        </section>

        {bannerMessage ? (
          <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {bannerMessage}
          </div>
        ) : null}

        <section className="mt-8 grid gap-8 lg:grid-cols-[320px_minmax(0,1fr)_340px]">
          <FilterPanel
            filters={filters}
            facets={searchData?.facets}
            history={history}
            savedSearches={savedSearches}
            alerts={alerts}
            onChange={updateFilters}
            onApplySavedSearch={handleApplySavedSearch}
            onApplyHistory={(item) =>
              updateFilters({ ...item.filters, query: item.query, page: 1 })
            }
          />

          <div className="space-y-6">
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-sm uppercase tracking-[0.18em] text-slate-500">
                    Search Results
                  </div>
                  <div
                    className="mt-1 text-2xl font-semibold"
                    style={{
                      fontFamily: 'Space Grotesk, IBM Plex Sans, sans-serif',
                    }}
                  >
                    {resultCountLabel}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-sm text-slate-600">
                    <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1">
                      <Compass size={14} />
                      Full-text + semantic ranking
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1">
                      <Layers3 size={14} />
                      Faceted navigation
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1">
                      <Mic size={14} />
                      Voice search enabled
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-950"
                    disabled={isSavingSearch}
                    onClick={handleSaveSearch}
                  >
                    {isSavingSearch ? 'Saving…' : 'Save search'}
                  </button>
                  <button
                    className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-950"
                    disabled={isCreatingAlert}
                    onClick={handleCreateAlert}
                  >
                    {isCreatingAlert ? 'Creating…' : 'Create alert'}
                  </button>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {isLoadingSearch
                  ? Array.from({ length: 6 }).map((_, index) => (
                      <div
                        key={index}
                        className="h-72 animate-pulse rounded-[24px] bg-slate-100"
                      />
                    ))
                  : searchData?.results.map((course) => (
                      <CourseCard
                        key={course.id}
                        course={course}
                        view={filters.view}
                        isSelected={selectedCourse?.id === course.id}
                        onPreview={() => handleSelectCourse(course)}
                        onSave={handleSaveSearch}
                        onFindSimilar={() => setSelectedCourse(course)}
                      />
                    ))}
              </div>

              {!isLoadingSearch && searchData?.results.length === 0 ? (
                <div className="mt-6 rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-600">
                  No matches found. Try a broader query, remove a filter, or use
                  voice search.
                </div>
              ) : null}
            </div>

            <Recommendations
              title="Personalized Recommendations"
              subtitle="Behavioral ranking, collaborative signals, and trending lift"
              items={recommendations}
              onSelect={handleSelectCourse}
            />

            <section className="grid gap-6 xl:grid-cols-2">
              <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm uppercase tracking-[0.18em] text-slate-500">
                      Trending Content
                    </div>
                    <h2
                      className="mt-1 text-2xl font-semibold"
                      style={{
                        fontFamily: 'Space Grotesk, IBM Plex Sans, sans-serif',
                      }}
                    >
                      What learners are opening now
                    </h2>
                  </div>
                  <Wand2 className="text-amber-500" size={22} />
                </div>

                <div className="mt-5 space-y-3">
                  {trending.map((course, index) => (
                    <button
                      key={course.id}
                      className="flex w-full items-center gap-4 rounded-2xl border border-slate-200 p-3 text-left transition hover:border-slate-400"
                      onClick={() => handleSelectCourse(course)}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                        {index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-slate-900">
                          {course.title}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {course.category} ·{' '}
                          {course.enrollmentCount.toLocaleString()} learners
                        </div>
                      </div>
                      <div className="text-sm font-medium text-amber-700">
                        {course.rating.toFixed(1)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-sm uppercase tracking-[0.18em] text-slate-500">
                  Learning Paths
                </div>
                <h2
                  className="mt-1 text-2xl font-semibold"
                  style={{
                    fontFamily: 'Space Grotesk, IBM Plex Sans, sans-serif',
                  }}
                >
                  Suggested paths, not isolated courses
                </h2>

                <div className="mt-5 space-y-4">
                  {learningPaths.map((path) => (
                    <div
                      key={path.id}
                      className="rounded-[24px] bg-slate-50 p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">
                            {path.title}
                          </div>
                          <p className="mt-2 text-sm text-slate-600">
                            {path.description}
                          </p>
                        </div>
                        <div className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900">
                          {path.durationHours}h
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {path.skills.map((skill) => (
                          <span
                            key={skill}
                            className="rounded-full bg-white px-3 py-1 text-xs text-slate-700"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-sm uppercase tracking-[0.18em] text-slate-500">
                Expert Curators
              </div>
              <h2
                className="mt-1 text-2xl font-semibold"
                style={{
                  fontFamily: 'Space Grotesk, IBM Plex Sans, sans-serif',
                }}
              >
                Recommendations with a point of view
              </h2>
              <div className="mt-5 grid gap-4 lg:grid-cols-3">
                {curators.map((curator) => (
                  <div
                    key={curator.id}
                    className="rounded-[24px] border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="text-sm font-semibold text-slate-900">
                      {curator.name}
                    </div>
                    <div className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-500">
                      {curator.title}
                    </div>
                    <p className="mt-3 text-sm text-slate-600">
                      {curator.focus}
                    </p>
                    <div className="mt-4 space-y-2">
                      {curator.picks.map((course) => (
                        <button
                          key={course.id}
                          className="flex w-full items-center justify-between rounded-2xl bg-white px-3 py-2 text-left text-sm transition hover:bg-amber-50"
                          onClick={() => handleSelectCourse(course)}
                        >
                          <span className="pr-3 font-medium text-slate-800">
                            {course.title}
                          </span>
                          <span className="shrink-0 text-xs text-slate-500">
                            {formatPrice(course.price)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-sm uppercase tracking-[0.18em] text-slate-500">
                <SearchIcon size={16} />
                Result Preview
              </div>

              {selectedCourse ? (
                <div className="mt-4">
                  <img
                    alt={selectedCourse.title}
                    className="h-48 w-full rounded-[24px] object-cover"
                    src={selectedCourse.thumbnail}
                  />
                  <h2
                    className="mt-4 text-2xl font-semibold"
                    style={{
                      fontFamily: 'Space Grotesk, IBM Plex Sans, sans-serif',
                    }}
                  >
                    {selectedCourse.title}
                  </h2>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span className="rounded-full bg-slate-100 px-3 py-1">
                      {selectedCourse.category}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1">
                      {selectedCourse.level}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1">
                      {selectedCourse.durationHours}h
                    </span>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-600">
                    {selectedCourse.preview || selectedCourse.description}
                  </p>

                  <div className="mt-4 rounded-[20px] bg-slate-50 p-4">
                    <div className="text-xs uppercase tracking-[0.14em] text-slate-500">
                      Why this ranked
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedCourse.matchReasons.map((reason) => (
                        <span
                          key={reason}
                          className="rounded-full bg-white px-3 py-1 text-xs text-slate-700"
                        >
                          {reason}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 rounded-[20px] border border-slate-200 p-4">
                    <div className="text-sm font-semibold text-slate-900">
                      Social proof
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                      {selectedCourse.socialProof.reviewSnippet}
                    </p>
                    <div className="mt-3 text-xs text-slate-500">
                      {selectedCourse.socialProof.enrollmentLabel}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {selectedCourse.socialProof.ratingLabel}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-[24px] bg-slate-50 p-6 text-sm text-slate-600">
                  Choose a result to inspect it here.
                </div>
              )}
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-sm uppercase tracking-[0.18em] text-slate-500">
                Similar Content
              </div>
              <h2
                className="mt-1 text-xl font-semibold"
                style={{
                  fontFamily: 'Space Grotesk, IBM Plex Sans, sans-serif',
                }}
              >
                More like this
              </h2>
              <div className="mt-4 space-y-3">
                {similarCourses.map((course) => (
                  <button
                    key={course.id}
                    className="w-full rounded-2xl border border-slate-200 p-3 text-left transition hover:border-slate-400"
                    onClick={() => handleSelectCourse(course)}
                  >
                    <div className="text-sm font-semibold text-slate-900">
                      {course.title}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {course.category} · {course.rating.toFixed(1)} rating
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-sm uppercase tracking-[0.18em] text-slate-500">
                <BellRing size={16} />
                Analytics Snapshot
              </div>
              {analytics ? (
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="text-slate-500">Searches</div>
                    <div className="mt-1 text-xl font-semibold text-slate-900">
                      {analytics.totalSearches}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="text-slate-500">Avg time</div>
                    <div className="mt-1 text-xl font-semibold text-slate-900">
                      {analytics.averageProcessingTimeMs}ms
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="text-slate-500">Saved searches</div>
                    <div className="mt-1 text-xl font-semibold text-slate-900">
                      {analytics.savedSearchCount}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="text-slate-500">Alerts</div>
                    <div className="mt-1 text-xl font-semibold text-slate-900">
                      {analytics.alertCount}
                    </div>
                  </div>
                </div>
              ) : null}
            </section>
          </aside>
        </section>
      </div>
    </div>
  );
};

export default DiscoveryExperience;
