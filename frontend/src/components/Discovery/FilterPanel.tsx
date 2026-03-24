import {
  AlertRecord,
  DiscoveryFacets,
  DiscoveryFilters,
  SavedSearch,
  SearchHistoryEntry,
  SortOption,
  ViewMode,
} from './types';

import React from 'react';

const toggleValue = (list: string[], value: string) =>
  list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];

const facetSection = (
  label: string,
  values: { value: string; count: number }[] | undefined,
  selected: string[],
  onToggle: (value: string) => void,
) => (
  <div>
    <div className="text-xs uppercase tracking-[0.16em] text-slate-500">
      {label}
    </div>
    <div className="mt-3 flex flex-wrap gap-2">
      {(values || []).map((item) => {
        const active = selected.includes(item.value);
        return (
          <button
            key={item.value}
            className={`rounded-full px-3 py-1.5 text-sm transition ${active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            onClick={() => onToggle(item.value)}
          >
            {item.value} · {item.count}
          </button>
        );
      })}
    </div>
  </div>
);

export const FilterPanel: React.FC<{
  filters: DiscoveryFilters;
  facets?: DiscoveryFacets;
  history: SearchHistoryEntry[];
  savedSearches: SavedSearch[];
  alerts: AlertRecord[];
  onChange: (next: Partial<DiscoveryFilters>) => void;
  onApplySavedSearch: (savedSearch: SavedSearch) => void;
  onApplyHistory: (entry: SearchHistoryEntry) => void;
}> = ({
  filters,
  facets,
  history,
  savedSearches,
  alerts,
  onChange,
  onApplySavedSearch,
  onApplyHistory,
}) => {
  const handleSortChange = (sortBy: SortOption) =>
    onChange({ sortBy, page: 1 });
  const handleViewChange = (view: ViewMode) => onChange({ view });

  return (
    <aside className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-sm uppercase tracking-[0.18em] text-slate-500">
          Filters
        </div>
        <h2
          className="mt-1 text-2xl font-semibold text-slate-900"
          style={{ fontFamily: 'Space Grotesk, IBM Plex Sans, sans-serif' }}
        >
          Faceted navigation
        </h2>

        <div className="mt-5 space-y-5">
          {facetSection(
            'Categories',
            facets?.categories,
            filters.categories,
            (value) =>
              onChange({
                categories: toggleValue(filters.categories, value),
                page: 1,
              }),
          )}
          {facetSection('Levels', facets?.levels, filters.levels, (value) =>
            onChange({ levels: toggleValue(filters.levels, value), page: 1 }),
          )}
          {facetSection(
            'Languages',
            facets?.languages,
            filters.languages,
            (value) =>
              onChange({
                languages: toggleValue(filters.languages, value),
                page: 1,
              }),
          )}
          {facetSection('Topic tags', facets?.tags, filters.tags, (value) =>
            onChange({ tags: toggleValue(filters.tags, value), page: 1 }),
          )}
        </div>

        <div className="mt-6 grid gap-4">
          <label className="text-sm text-slate-700">
            <div className="mb-2 font-medium">Minimum rating</div>
            <input
              className="w-full"
              type="range"
              min={0}
              max={5}
              step={0.5}
              value={filters.minRating}
              onChange={(event) =>
                onChange({ minRating: Number(event.target.value), page: 1 })
              }
            />
            <div className="mt-1 text-xs text-slate-500">
              {filters.minRating.toFixed(1)} and above
            </div>
          </label>

          <label className="text-sm text-slate-700">
            <div className="mb-2 font-medium">Max price</div>
            <input
              className="w-full"
              type="range"
              min={0}
              max={150}
              step={5}
              value={filters.maxPrice}
              onChange={(event) =>
                onChange({ maxPrice: Number(event.target.value), page: 1 })
              }
            />
            <div className="mt-1 text-xs text-slate-500">
              Up to ${filters.maxPrice}
            </div>
          </label>

          <label className="text-sm text-slate-700">
            <div className="mb-2 font-medium">Max duration</div>
            <input
              className="w-full"
              type="range"
              min={1}
              max={16}
              step={1}
              value={filters.maxDuration}
              onChange={(event) =>
                onChange({ maxDuration: Number(event.target.value), page: 1 })
              }
            />
            <div className="mt-1 text-xs text-slate-500">
              Up to {filters.maxDuration} hours
            </div>
          </label>

          <label className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input
              checked={filters.freeOnly}
              type="checkbox"
              onChange={(event) =>
                onChange({ freeOnly: event.target.checked, page: 1 })
              }
            />
            Show only free courses
          </label>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div>
            <div className="mb-2 text-xs uppercase tracking-[0.16em] text-slate-500">
              Sort
            </div>
            <select
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
              onChange={(event) =>
                handleSortChange(event.target.value as SortOption)
              }
              value={filters.sortBy}
            >
              <option value="relevance">Relevance</option>
              <option value="popular">Most popular</option>
              <option value="rating">Highest rated</option>
              <option value="newest">Newest</option>
              <option value="duration">Shortest duration</option>
              <option value="price-low">Lowest price</option>
              <option value="price-high">Highest price</option>
            </select>
          </div>

          <div>
            <div className="mb-2 text-xs uppercase tracking-[0.16em] text-slate-500">
              View
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(['grid', 'list'] as ViewMode[]).map((view) => (
                <button
                  key={view}
                  className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${filters.view === view ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                  onClick={() => handleViewChange(view)}
                >
                  {view}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-xs uppercase tracking-[0.16em] text-slate-500">
          Saved Searches
        </div>
        <div className="mt-4 space-y-3">
          {savedSearches.length === 0 ? (
            <p className="text-sm text-slate-500">No saved searches yet.</p>
          ) : null}
          {savedSearches.map((savedSearch) => (
            <button
              key={savedSearch.id}
              className="block w-full rounded-2xl bg-slate-50 px-4 py-3 text-left transition hover:bg-amber-50"
              onClick={() => onApplySavedSearch(savedSearch)}
            >
              <div className="text-sm font-medium text-slate-900">
                {savedSearch.name}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {savedSearch.query}
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-xs uppercase tracking-[0.16em] text-slate-500">
          Recent Searches
        </div>
        <div className="mt-4 space-y-3">
          {history.length === 0 ? (
            <p className="text-sm text-slate-500">
              Search history will appear here.
            </p>
          ) : null}
          {history.slice(0, 5).map((item) => (
            <button
              key={item.id}
              className="block w-full rounded-2xl border border-slate-200 px-4 py-3 text-left transition hover:border-slate-400"
              onClick={() => onApplyHistory(item)}
            >
              <div className="text-sm font-medium text-slate-900">
                {item.query || 'Discovery browse'}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {item.total} results
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-xs uppercase tracking-[0.16em] text-slate-500">
          Active Alerts
        </div>
        <div className="mt-4 space-y-3">
          {alerts.length === 0 ? (
            <p className="text-sm text-slate-500">
              No search alerts configured.
            </p>
          ) : null}
          {alerts.map((alert) => (
            <div key={alert.id} className="rounded-2xl bg-slate-50 px-4 py-3">
              <div className="text-sm font-medium text-slate-900">
                {alert.query}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {alert.frequency} via {alert.channel}
              </div>
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
};

export default FilterPanel;
