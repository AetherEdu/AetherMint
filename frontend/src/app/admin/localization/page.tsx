'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  Languages,
  Plus,
  RefreshCw,
  Globe,
  CheckCircle,
  Clock,
  AlertTriangle,
  FileText,
  ArrowRight,
} from 'lucide-react';

interface LocaleRegistry {
  defaultLocale: string;
  locales: string[];
}

interface Translation {
  id: string;
  entityType: string;
  entityId: string;
  locale: string;
  sourceRevision: number;
  fields: Record<string, string>;
  status: string;
  assigneeId?: string;
  reviewerId?: string;
  publishedAt?: string;
}

interface ResolvedContent {
  locale: string;
  value: string | Record<string, string>;
  isFallback: boolean;
  status: string;
  sourceRevision: number;
}

const ENTITY_TYPES = [
  { value: 'lesson', label: 'Lesson' },
  { value: 'quiz', label: 'Quiz' },
  { value: 'assignment', label: 'Assignment' },
  { value: 'resource', label: 'Resource' },
  { value: 'video', label: 'Video' },
  { value: 'document', label: 'Document' },
  { value: 'transcript', label: 'Transcript' },
];

const STATUS_META: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-gray-100 text-gray-700' },
  in_progress: { label: 'In progress', className: 'bg-blue-100 text-blue-700' },
  in_review: { label: 'In review', className: 'bg-yellow-100 text-yellow-700' },
  published: { label: 'Published', className: 'bg-green-100 text-green-700' },
  outdated: { label: 'Outdated', className: 'bg-red-100 text-red-700' },
};

export default function LocalizationAdmin() {
  const { hasPermission } = useAuth();
  const [registry, setRegistry] = useState<LocaleRegistry | null>(null);
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolved, setResolved] = useState<ResolvedContent | null>(null);

  // Create-translation form state
  const [entityType, setEntityType] = useState('lesson');
  const [entityId, setEntityId] = useState('');
  const [locale, setLocale] = useState('');
  const [fieldKey, setFieldKey] = useState('title');
  const [fieldValue, setFieldValue] = useState('');
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Resolve form state
  const [resolveEntityType, setResolveEntityType] = useState('lesson');
  const [resolveEntityId, setResolveEntityId] = useState('');
  const [resolveLocale, setResolveLocale] = useState('');
  const [resolveField, setResolveField] = useState('title');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [localesRes, translationsRes] = await Promise.all([
        fetch('/api/localization/locales'),
        fetch('/api/localization/translations'),
      ]);

      if (localesRes.ok) {
        const localesData = await localesRes.json();
        setRegistry(localesData.data);
        setLocale((current) => current || localesData.data.locales.find((l: string) => l !== localesData.data.defaultLocale) || '');
        setResolveLocale((current) => current || localesData.data.locales.find((l: string) => l !== localesData.data.defaultLocale) || '');
      }
      if (translationsRes.ok) {
        const translationsData = await translationsRes.json();
        setTranslations(translationsData.data?.translations || []);
      }
    } catch (error) {
      console.error('Failed to fetch localization data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const createTranslation = async () => {
    if (!entityId || !locale || !fieldValue) {
      setMessage('Entity ID, locale, and a translated value are required.');
      return;
    }

    try {
      setCreating(true);
      setMessage(null);
      const response = await fetch('/api/localization/translations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType,
          entityId,
          locale,
          fields: { [fieldKey]: fieldValue },
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setMessage(`Translation created (${data.data.id}).`);
        setEntityId('');
        setFieldValue('');
        fetchData();
      } else {
        setMessage(data.message || 'Failed to create translation.');
      }
    } catch (error) {
      console.error('Failed to create translation:', error);
      setMessage('Failed to create translation.');
    } finally {
      setCreating(false);
    }
  };

  const resolveContent = async () => {
    if (!resolveEntityId || !resolveLocale) {
      setResolved(null);
      return;
    }

    try {
      const params = new URLSearchParams({
        entityType: resolveEntityType,
        entityId: resolveEntityId,
        locale: resolveLocale,
      });
      if (resolveField) params.set('field', resolveField);

      const response = await fetch(`/api/localization/resolve?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setResolved(data.data);
      } else {
        const data = await response.json();
        setResolved(null);
        setMessage(data.message || 'Failed to resolve content.');
      }
    } catch (error) {
      console.error('Failed to resolve content:', error);
      setResolved(null);
    }
  };

  const renderFieldSummary = (fields: Record<string, string>) => {
    const entries = Object.entries(fields).slice(0, 3);
    return entries.length === 0 ? '—' : entries.map(([k, v]) => `${k}: ${v}`).join(' · ');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Localization</h1>
          <p className="text-gray-600">
            Manage course-content translations across locales with fallback to the default locale.
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {message && (
        <div className="p-3 bg-blue-50 text-blue-700 rounded-lg text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {message}
        </div>
      )}

      {/* Locale registry */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Languages className="w-5 h-5 text-blue-600" />
          Supported Locales
        </h2>
        <div className="flex flex-wrap gap-2">
          {(registry?.locales || []).map((l) => (
            <span
              key={l}
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                l === registry?.defaultLocale
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {l}
              {l === registry?.defaultLocale ? ' (default)' : ''}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Create translation */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-green-600" />
            Request a Translation
          </h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Entity type</label>
                <select
                  value={entityType}
                  onChange={(e) => setEntityType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {ENTITY_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Target locale</label>
                <select
                  value={locale}
                  onChange={(e) => setLocale(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {(registry?.locales || [])
                    .filter((l) => l !== registry?.defaultLocale)
                    .map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Entity ID</label>
              <input
                type="text"
                value={entityId}
                onChange={(e) => setEntityId(e.target.value)}
                placeholder="e.g. lesson-1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Field</label>
                <input
                  type="text"
                  value={fieldKey}
                  onChange={(e) => setFieldKey(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Translated value</label>
                <input
                  type="text"
                  value={fieldValue}
                  onChange={(e) => setFieldValue(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <button
              onClick={createTranslation}
              disabled={creating || !hasPermission('content:create')}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              {creating ? 'Creating...' : 'Create Translation'}
            </button>
          </div>
        </div>

        {/* Resolve with fallback */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Globe className="w-5 h-5 text-purple-600" />
            Resolve Content (with fallback)
          </h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Entity type</label>
                <select
                  value={resolveEntityType}
                  onChange={(e) => setResolveEntityType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {ENTITY_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Locale</label>
                <select
                  value={resolveLocale}
                  onChange={(e) => setResolveLocale(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {(registry?.locales || []).map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Entity ID</label>
                <input
                  type="text"
                  value={resolveEntityId}
                  onChange={(e) => setResolveEntityId(e.target.value)}
                  placeholder="e.g. lesson-1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Field (optional)</label>
                <input
                  type="text"
                  value={resolveField}
                  onChange={(e) => setResolveField(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <button
              onClick={resolveContent}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <ArrowRight className="w-4 h-4" />
              Resolve
            </button>

            {resolved && (
              <div
                className={`p-4 rounded-lg text-sm ${
                  resolved.isFallback ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {resolved.isFallback ? (
                    <AlertTriangle className="w-4 h-4 text-yellow-600" />
                  ) : (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  )}
                  <span className="font-medium">
                    {resolved.isFallback
                      ? `Falling back to default locale (${resolved.locale})`
                      : `Resolved from ${resolved.locale}`}
                  </span>
                </div>
                <p className="text-gray-700 break-words">
                  {typeof resolved.value === 'string' ? resolved.value : JSON.stringify(resolved.value)}
                </p>
                <p className="text-xs text-gray-500 mt-1">Source revision: {resolved.sourceRevision}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Translations list */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-gray-600" />
          Translations
        </h2>
        {loading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 rounded animate-pulse"></div>
            ))}
          </div>
        ) : translations.length === 0 ? (
          <p className="text-gray-500 text-sm">No translations yet. Request one to get started.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-200">
                  <th className="py-2 pr-4">Entity</th>
                  <th className="py-2 pr-4">Locale</th>
                  <th className="py-2 pr-4">Content</th>
                  <th className="py-2 pr-4">Rev</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2">Assignee</th>
                </tr>
              </thead>
              <tbody>
                {translations.map((t) => {
                  const meta = STATUS_META[t.status] || STATUS_META.draft;
                  return (
                    <tr key={t.id} className="border-b border-gray-100">
                      <td className="py-2 pr-4">
                        <div className="font-medium text-gray-800">{t.entityId}</div>
                        <div className="text-xs text-gray-500">{t.entityType}</div>
                      </td>
                      <td className="py-2 pr-4">
                        <span className="font-medium">{t.locale}</span>
                      </td>
                      <td className="py-2 pr-4 text-gray-600">{renderFieldSummary(t.fields)}</td>
                      <td className="py-2 pr-4 text-gray-600">{t.sourceRevision}</td>
                      <td className="py-2 pr-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${meta.className}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="py-2 text-gray-600">{t.assigneeId || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {loading && (
        <div className="text-xs text-gray-400 flex items-center gap-2">
          <Clock className="w-3 h-3" />
          Loading localization data...
        </div>
      )}
    </div>
  );
}
