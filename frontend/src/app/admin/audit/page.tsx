'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  Search,
  Filter,
  Download,
  Trash2,
  Eye,
  Calendar,
  User,
  Activity,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Clock,
  Database,
  FileCode,
  X,
  AlertTriangle
} from 'lucide-react';

interface AuditEntry {
  _id: string;
  actor: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress: string;
  userAgent?: string;
  result: 'success' | 'failure';
  errorMessage?: string;
  timestamp: string;
}

interface AuditStats {
  totalEntries: number;
  successCount: number;
  failureCount: number;
  actionCounts: Record<string, number>;
  topActors: Array<{ actor: string; count: number }>;
}

export default function AdminAuditLogPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);
  const [isPurgeModalOpen, setIsPurgeModalOpen] = useState(false);
  const [retentionDays, setRetentionDays] = useState(90);
  const [purging, setPurging] = useState(false);
  const [purgeMessage, setPurgeMessage] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAction, setSelectedAction] = useState('all');
  const [selectedResult, setSelectedResult] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Pagination
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  const fetchAuditLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(searchTerm && { search: searchTerm }),
        ...(selectedAction !== 'all' && { action: selectedAction }),
        ...(selectedResult !== 'all' && { result: selectedResult }),
        ...(dateFrom && { dateFrom }),
        ...(dateTo && { dateTo }),
      });

      const response = await fetch(`/api/admin/audit?${params}`);
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setLogs(result.data.entries || []);
          setPagination({
            page: result.data.page || 1,
            limit: 20,
            total: result.data.total || 0,
            totalPages: result.data.totalPages || 0,
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, searchTerm, selectedAction, selectedResult, dateFrom, dateTo]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/audit/stats');
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setStats(result.data);
        }
      }
    } catch (error) {
      console.error('Failed to fetch audit stats:', error);
    }
  }, []);

  useEffect(() => {
    fetchAuditLogs();
    fetchStats();
  }, [fetchAuditLogs, fetchStats]);

  const handleExport = async (format: 'csv' | 'json') => {
    try {
      const params = new URLSearchParams({
        format,
        ...(searchTerm && { search: searchTerm }),
        ...(selectedAction !== 'all' && { action: selectedAction }),
        ...(selectedResult !== 'all' && { result: selectedResult }),
        ...(dateFrom && { dateFrom }),
        ...(dateTo && { dateTo }),
      });

      const response = await fetch(`/api/admin/audit/export?${params}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit_logs_${new Date().toISOString().split('T')[0]}.${format}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } catch (error) {
      console.error(`Failed to export audit logs as ${format}:`, error);
    }
  };

  const handlePurgeLogs = async () => {
    try {
      setPurging(true);
      setPurgeMessage(null);

      const response = await fetch('/api/admin/audit/purge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ retentionDays }),
      });

      if (response.ok) {
        const resData = await response.json();
        setPurgeMessage(resData.message || 'Audit logs purged successfully.');
        fetchAuditLogs();
        fetchStats();
        setTimeout(() => {
          setIsPurgeModalOpen(false);
          setPurgeMessage(null);
        }, 2000);
      } else {
        setPurgeMessage('Failed to purge audit logs.');
      }
    } catch (error) {
      console.error('Failed to purge logs:', error);
      setPurgeMessage('Error occurred while purging logs.');
    } finally {
      setPurging(false);
    }
  };

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedAction('all');
    setSelectedResult('all');
    setDateFrom('');
    setDateTo('');
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const getActionBadgeClass = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes('CREATE') || act.includes('MINT')) return 'bg-green-100 text-green-800';
    if (act.includes('UPDATE') || act.includes('EDIT')) return 'bg-blue-100 text-blue-800';
    if (act.includes('DELETE') || act.includes('REVOKE') || act.includes('PURGE')) return 'bg-red-100 text-red-800';
    if (act.includes('LOGIN') || act.includes('AUTH')) return 'bg-purple-100 text-purple-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6 p-2 md:p-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldAlert className="w-7 h-7 text-blue-600" />
            Audit Logging & Activity Log
          </h1>
          <p className="text-sm text-gray-600">
            Searchable event log across actors, actions, timestamps, before/after details, and export controls.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => fetchAuditLogs()}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm text-gray-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>

          <button
            onClick={() => handleExport('csv')}
            className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>

          <button
            onClick={() => handleExport('json')}
            className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors"
          >
            <FileCode className="w-4 h-4" />
            Export JSON
          </button>

          <button
            onClick={() => setIsPurgeModalOpen(true)}
            className="flex items-center gap-2 px-3 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 text-sm font-medium transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Purge Logs
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Total Audit Entries</p>
              <h3 className="text-2xl font-bold text-gray-900">{stats.totalEntries.toLocaleString()}</h3>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Success Operations</p>
              <h3 className="text-2xl font-bold text-emerald-600">{stats.successCount.toLocaleString()}</h3>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-rose-50 text-rose-600 rounded-lg">
              <XCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Failed Operations</p>
              <h3 className="text-2xl font-bold text-rose-600">{stats.failureCount.toLocaleString()}</h3>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
              <User className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Active Actors</p>
              <h3 className="text-2xl font-bold text-gray-900">{stats.topActors.length}</h3>
            </div>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          <div className="relative col-span-1 sm:col-span-2">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search by actor, action, resource, error..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Actions</option>
            <option value="CREATE">CREATE</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DELETE">DELETE</option>
            <option value="READ">READ</option>
            <option value="LOGIN">LOGIN</option>
            <option value="LOGOUT">LOGOUT</option>
            <option value="MINT">MINT</option>
            <option value="REVOKE">REVOKE</option>
          </select>

          <select
            value={selectedResult}
            onChange={(e) => setSelectedResult(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Results</option>
            <option value="success">Success</option>
            <option value="failure">Failure</option>
          </select>

          <button
            onClick={resetFilters}
            className="flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Filter className="w-4 h-4" />
            Reset Filters
          </button>
        </div>

        {/* Date Range Row */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 pt-2 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span>From:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span>To:</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 font-medium text-gray-600">
              <tr>
                <th className="px-5 py-3">Timestamp</th>
                <th className="px-5 py-3">Actor</th>
                <th className="px-5 py-3">Action</th>
                <th className="px-5 py-3">Resource</th>
                <th className="px-5 py-3">Result</th>
                <th className="px-5 py-3">IP Address</th>
                <th className="px-5 py-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
                      Loading audit logs...
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-gray-500">
                    No audit records match the selected search criteria.
                  </td>
                </tr>
              ) : (
                logs.map((entry) => (
                  <tr key={entry._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 whitespace-nowrap text-gray-600 font-mono text-xs">
                      {new Date(entry.timestamp).toLocaleString()}
                    </td>
                    <td className="px-5 py-3 font-medium text-gray-900">
                      {entry.actor}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${getActionBadgeClass(entry.action)}`}>
                        {entry.action}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-700 font-mono text-xs">
                      {entry.resource} {entry.resourceId ? `(#${entry.resourceId})` : ''}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      {entry.result === 'success' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full text-xs font-medium">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Success
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full text-xs font-medium">
                          <XCircle className="w-3.5 h-3.5" />
                          Failure
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-500 font-mono text-xs">
                      {entry.ipAddress}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => setSelectedEntry(entry)}
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="px-5 py-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-gray-600">
            Showing Page <span className="font-semibold">{pagination.page}</span> of{' '}
            <span className="font-semibold">{pagination.totalPages || 1}</span> ({pagination.total} total logs)
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPagination(p => ({ ...p, page: Math.max(1, p.page - 1) }))}
              disabled={pagination.page <= 1}
              className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPagination(p => ({ ...p, page: Math.min(p.totalPages, p.page + 1) }))}
              disabled={pagination.page >= pagination.totalPages}
              className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Event Detail Modal (With Before / After Details) */}
      {selectedEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-gray-100">
            <div className="flex items-center justify-between pb-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-600" />
                Audit Event Detail
              </h2>
              <button
                onClick={() => setSelectedEntry(null)}
                className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl font-mono text-xs">
                <div>
                  <span className="text-gray-500 block">ID</span>
                  <span className="font-semibold text-gray-800">{selectedEntry._id}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Timestamp</span>
                  <span className="font-semibold text-gray-800">{new Date(selectedEntry.timestamp).toISOString()}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Actor</span>
                  <span className="font-semibold text-gray-800">{selectedEntry.actor}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Action</span>
                  <span className="font-semibold text-gray-800">{selectedEntry.action}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Resource</span>
                  <span className="font-semibold text-gray-800">{selectedEntry.resource}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Resource ID</span>
                  <span className="font-semibold text-gray-800">{selectedEntry.resourceId || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">IP Address</span>
                  <span className="font-semibold text-gray-800">{selectedEntry.ipAddress}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Result</span>
                  <span className={`font-semibold ${selectedEntry.result === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {selectedEntry.result.toUpperCase()}
                  </span>
                </div>
              </div>

              {selectedEntry.errorMessage && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs">
                  <span className="font-bold block">Error Message:</span>
                  {selectedEntry.errorMessage}
                </div>
              )}

              {/* Before/After Change Details */}
              <div>
                <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-1.5">
                  <FileCode className="w-4 h-4 text-blue-600" />
                  Event Change Payload & Details (Before / After)
                </h4>
                <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl text-xs font-mono overflow-x-auto">
                  {JSON.stringify(selectedEntry.details || {}, null, 2)}
                </pre>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setSelectedEntry(null)}
                className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 text-sm font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Retention Purge Control Modal */}
      {isPurgeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100">
            <div className="flex items-center gap-3 text-rose-600 pb-3 border-b border-gray-100">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-lg font-bold text-gray-900">Purge Audit Logs</h3>
            </div>

            <div className="mt-4 space-y-4 text-sm text-gray-600">
              <p>
                Configure log retention period. Audit log events older than the specified retention threshold will be permanently deleted.
              </p>

              <div>
                <label className="block font-medium text-gray-800 mb-1">
                  Retention Period (Days):
                </label>
                <select
                  value={retentionDays}
                  onChange={(e) => setRetentionDays(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={30}>30 Days</option>
                  <option value={60}>60 Days</option>
                  <option value={90}>90 Days (Default)</option>
                  <option value={180}>180 Days</option>
                  <option value={365}>365 Days</option>
                </select>
              </div>

              {purgeMessage && (
                <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded-lg font-medium">
                  {purgeMessage}
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setIsPurgeModalOpen(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePurgeLogs}
                disabled={purging}
                className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {purging ? 'Purging...' : 'Confirm Purge'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
