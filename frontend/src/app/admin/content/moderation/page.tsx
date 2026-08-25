'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Search,
  Filter,
  Flag,
  MessageSquare,
  FileText,
  Image,
  Video,
  MoreVertical,
  Ban,
  Check,
  BookOpen,
  X,
  Brain,
  BarChart3,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Activity,
  Gavel,
  FileWarning,
  Scale,
} from 'lucide-react';

// --- Types ---

interface RiskScoreBreakdown {
  overall: number;
  policyScores: Array<{
    policyType: string;
    score: number;
    confidence: number;
    keywords: string[];
    matchedPatterns: string[];
  }>;
  textRisk: number;
  metadataRisk: number;
  userHistoryRisk: number;
  similarityRisk: number;
  confidence: number;
  modelVersion: string;
}

interface ModerationItem {
  id: string;
  contentId: string;
  contentType: string;
  title: string;
  description: string;
  content: string;
  authorId: string;
  authorName: string;
  authorEmail: string;
  status: string;
  riskScore: RiskScoreBreakdown | null;
  severity: string;
  flags: number;
  reports: ModerationReport[];
  assignedModeratorId: string | null;
  moderatorNotes: string;
  decision: ModerationDecision | null;
  appeal: Appeal | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  scoredAt: string | null;
  reviewedAt: string | null;
  resolvedAt: string | null;
}

interface ModerationReport {
  id: string;
  reason: string;
  description: string;
  reporterId: string;
  reporterName: string;
  createdAt: string;
  status: string;
}

interface ModerationDecision {
  id: string;
  moderatorId: string;
  moderatorName: string;
  action: string;
  reason: string;
  notes: string;
  createdAt: string;
  modelFeedback: {
    predictionCorrect: boolean;
    actualSeverity: string;
    predictedSeverity: string;
    improvementNotes: string;
    misclassifiedPolicies: string[];
  };
}

interface Appeal {
  id: string;
  moderationId: string;
  submitterId: string;
  submitterName: string;
  reason: string;
  explanation: string;
  evidence: AppealEvidence[];
  status: string;
  decision: AppealDecision | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

interface AppealEvidence {
  id: string;
  type: 'text' | 'file' | 'url' | 'reference';
  description: string;
  value: string;
}

interface AppealDecision {
  id: string;
  reviewerId: string;
  reviewerName: string;
  decision: string;
  reason: string;
  notes: string;
  createdAt: string;
}

interface ModerationStats {
  total: number;
  pending: number;
  queued: number;
  inReview: number;
  approved: number;
  rejected: number;
  flagged: number;
  autoApproved: number;
  autoRejected: number;
  averageRiskScore: number;
  averageReviewTime: number;
  modelAccuracy: number;
  appeals: {
    total: number;
    pending: number;
    approved: number;
    denied: number;
  };
}

// --- Tab types ---
type ModerationTab = 'queue' | 'items' | 'appeals' | 'stats';

// --- Component ---

export default function ContentModeration() {
  const { hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<ModerationTab>('queue');
  const [items, setItems] = useState<ModerationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState<ModerationItem | null>(null);
  const [stats, setStats] = useState<ModerationStats | null>(null);
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [decisionReason, setDecisionReason] = useState('');
  const [decisionNotes, setDecisionNotes] = useState('');
  const [appealDecision, setAppealDecision] = useState('');
  const [appealReason, setAppealReason] = useState('');
  const [expandedRiskScores, setExpandedRiskScores] = useState<Set<string>>(new Set());
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [showAppealReviewModal, setShowAppealReviewModal] = useState(false);
  const [selectedAction, setSelectedAction] = useState<string>('approve');

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        ...(selectedStatus !== 'all' && { status: selectedStatus }),
        ...(selectedType !== 'all' && { contentType: selectedType }),
        ...(searchTerm && { search: searchTerm }),
        limit: '50',
      });

      const response = await fetch(`/api/moderation/items?${params}`);
      if (response.ok) {
        const data = await response.json();
        setItems(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch items:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedStatus, selectedType, searchTerm]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/moderation/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  }, []);

  const fetchAppeals = useCallback(async () => {
    try {
      const response = await fetch('/api/moderation/appeals');
      if (response.ok) {
        const data = await response.json();
        setAppeals(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch appeals:', error);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'items') fetchItems();
    else if (activeTab === 'stats') fetchStats();
    else if (activeTab === 'appeals') fetchAppeals();
    else if (activeTab === 'queue') fetchItems();
  }, [activeTab, fetchItems, fetchStats, fetchAppeals, selectedStatus, selectedType, searchTerm]);

  const handleClaimNext = async () => {
    try {
      const response = await fetch('/api/moderation/queue/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        const data = await response.json();
        if (data.data) {
          setSelectedItem(data.data);
          setShowDecisionModal(true);
        }
        fetchItems();
      }
    } catch (error) {
      console.error('Failed to claim item:', error);
    }
  };

  const handleMakeDecision = async () => {
    if (!selectedItem || !decisionReason) return;

    try {
      const response = await fetch(`/api/moderation/items/${selectedItem.id}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: selectedAction,
          reason: decisionReason,
          notes: decisionNotes,
          predictionCorrect: false,
          actualSeverity: selectedItem.severity,
          predictedSeverity: selectedItem.severity,
        }),
      });

      if (response.ok) {
        setShowDecisionModal(false);
        setSelectedItem(null);
        setDecisionReason('');
        setDecisionNotes('');
        fetchItems();
        fetchStats();
      }
    } catch (error) {
      console.error('Failed to make decision:', error);
    }
  };

  const handleReviewAppeal = async (appealId: string) => {
    if (!appealDecision || !appealReason) return;

    try {
      const response = await fetch(`/api/moderation/appeals/${appealId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision: appealDecision,
          reason: appealReason,
        }),
      });

      if (response.ok) {
        setShowAppealReviewModal(false);
        setAppealDecision('');
        setAppealReason('');
        fetchAppeals();
        fetchItems();
      }
    } catch (error) {
      console.error('Failed to review appeal:', error);
    }
  };

  const handleRescoreItem = async (itemId: string) => {
    try {
      const response = await fetch(`/api/moderation/items/${itemId}/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        fetchItems();
      }
    } catch (error) {
      console.error('Failed to rescore:', error);
    }
  };

  const toggleRiskScore = (itemId: string) => {
    setExpandedRiskScores((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  // --- Helper functions ---

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'course': return <BookOpen className="w-4 h-4" />;
      case 'quiz': return <FileText className="w-4 h-4" />;
      case 'user_post': return <MessageSquare className="w-4 h-4" />;
      case 'comment': return <MessageSquare className="w-4 h-4" />;
      case 'file': return <Image className="w-4 h-4" />;
      case 'video': return <Video className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-slate-100 text-slate-800';
      case 'scoring': return 'bg-blue-100 text-blue-800';
      case 'queued': return 'bg-yellow-100 text-yellow-800';
      case 'in_review': return 'bg-purple-100 text-purple-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'flagged': return 'bg-orange-100 text-orange-800';
      case 'auto_approved': return 'bg-emerald-100 text-emerald-800';
      case 'auto_rejected': return 'bg-rose-100 text-rose-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-700 bg-red-100 border-red-300';
      case 'high': return 'text-orange-700 bg-orange-100 border-orange-300';
      case 'medium': return 'text-yellow-700 bg-yellow-100 border-yellow-300';
      case 'low': return 'text-green-700 bg-green-100 border-green-300';
      default: return 'text-gray-700 bg-gray-100 border-gray-300';
    }
  };

  const getRiskScoreColor = (score: number) => {
    if (score >= 75) return 'text-red-600';
    if (score >= 50) return 'text-orange-600';
    if (score >= 25) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getRiskScoreBarColor = (score: number) => {
    if (score >= 75) return 'bg-red-500';
    if (score >= 50) return 'bg-orange-500';
    if (score >= 25) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const formatStatus = (status: string) => status.replace(/_/g, ' ');

  // --- Render ---

  if (loading && items.length === 0) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-20 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <Shield className="w-7 h-7 text-blue-600" />
            ML-Assisted Moderation
          </h1>
          <p className="text-gray-600 mt-1">AI-powered content screening with human review queue</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleClaimNext}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Gavel className="w-4 h-4" />
            Claim Next Review
          </button>
          <button
            onClick={fetchStats}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Quick Stats Bar */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <div className="bg-white rounded-lg shadow-sm p-3 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
            <div className="text-xs text-gray-500">Total</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-3 text-center">
            <div className="text-2xl font-bold text-yellow-600">{stats.queued}</div>
            <div className="text-xs text-gray-500">Queued</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-3 text-center">
            <div className="text-2xl font-bold text-purple-600">{stats.inReview}</div>
            <div className="text-xs text-gray-500">In Review</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-3 text-center">
            <div className="text-2xl font-bold text-emerald-600">{stats.autoApproved + stats.autoRejected}</div>
            <div className="text-xs text-gray-500">Auto-Decided</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-3 text-center">
            <div className="text-2xl font-bold text-orange-600">{stats.flagged}</div>
            <div className="text-xs text-gray-500">Flagged</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-3 text-center">
            <div className="text-2xl font-bold" style={{ color: stats.modelAccuracy >= 0.7 ? '#059669' : '#dc2626' }}>
              {(stats.modelAccuracy * 100).toFixed(0)}%
            </div>
            <div className="text-xs text-gray-500">Model Accuracy</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-3 text-center">
            <div className="text-2xl font-bold text-indigo-600">{stats.appeals.pending}</div>
            <div className="text-xs text-gray-500">Appeals</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-4 px-6">
            {([
              { id: 'queue', label: 'Review Queue', icon: Clock },
              { id: 'items', label: 'All Items', icon: FileText },
              { id: 'appeals', label: 'Appeals', icon: Scale },
              { id: 'stats', label: 'Analytics', icon: BarChart3 },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Filters */}
          {(activeTab === 'items' || activeTab === 'queue') && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search content..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Statuses</option>
                <option value="queued">Queued</option>
                <option value="in_review">In Review</option>
                <option value="auto_approved">Auto-Approved</option>
                <option value="auto_rejected">Auto-Rejected</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="flagged">Flagged</option>
              </select>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Types</option>
                <option value="course">Courses</option>
                <option value="quiz">Quizzes</option>
                <option value="user_post">User Posts</option>
                <option value="comment">Comments</option>
                <option value="file">Files</option>
              </select>
              <button
                onClick={fetchItems}
                className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Filter className="w-4 h-4" />
                Apply Filters
              </button>
            </div>
          )}

          {/* Queue / Items Tab */}
          {(activeTab === 'queue' || activeTab === 'items') && (
            <div className="space-y-4">
              {items.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">No items to review</p>
                  <p className="text-sm">The queue is clear. Great work!</p>
                </div>
              ) : (
                items.map((item) => (
                  <div key={item.id} className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        {/* Title row */}
                        <div className="flex items-center gap-3 mb-3 flex-wrap">
                          {getTypeIcon(item.contentType)}
                          <h3 className="text-lg font-semibold text-gray-800">{item.title}</h3>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(item.status)}`}>
                            {formatStatus(item.status)}
                          </span>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getSeverityColor(item.severity)}`}>
                            {item.severity}
                          </span>
                          {item.flags > 0 && (
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                              <Flag className="w-3 h-3 inline mr-1" />
                              {item.flags} flags
                            </span>
                          )}
                        </div>

                        {/* Description */}
                        <p className="text-gray-600 mb-3 line-clamp-2">{item.description}</p>

                        {/* Meta info */}
                        <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                          <span>By: {item.authorName}</span>
                          <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                        </div>

                        {/* ML Risk Score */}
                        {item.riskScore && (
                          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                            <button
                              onClick={() => toggleRiskScore(item.id)}
                              className="flex items-center gap-2 text-sm font-medium text-gray-700 w-full"
                            >
                              <Brain className="w-4 h-4 text-purple-600" />
                              ML Risk Score
                              <span className={`font-bold ${getRiskScoreColor(item.riskScore.overall)}`}>
                                {item.riskScore.overall.toFixed(1)}%
                              </span>
                              <span className="text-xs text-gray-400">
                                (confidence: {(item.riskScore.confidence * 100).toFixed(0)}%)
                              </span>
                              {expandedRiskScores.has(item.id) ? (
                                <ChevronUp className="w-4 h-4 ml-auto" />
                              ) : (
                                <ChevronDown className="w-4 h-4 ml-auto" />
                              )}
                            </button>

                            {/* Risk bar */}
                            <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all ${getRiskScoreBarColor(item.riskScore.overall)}`}
                                style={{ width: `${Math.min(100, item.riskScore.overall)}%` }}
                              />
                            </div>

                            {expandedRiskScores.has(item.id) && (
                              <div className="mt-3 space-y-2">
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">Text Risk:</span>
                                    <span className="font-medium">{item.riskScore.textRisk.toFixed(1)}%</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">Metadata Risk:</span>
                                    <span className="font-medium">{item.riskScore.metadataRisk.toFixed(1)}%</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">User History:</span>
                                    <span className="font-medium">{item.riskScore.userHistoryRisk.toFixed(1)}%</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">Similarity:</span>
                                    <span className="font-medium">{item.riskScore.similarityRisk.toFixed(1)}%</span>
                                  </div>
                                </div>
                                {item.riskScore.policyScores.length > 0 && (
                                  <div>
                                    <p className="text-xs font-medium text-gray-600 mb-1">Policy Violations:</p>
                                    {item.riskScore.policyScores
                                      .filter((p) => p.score > 0)
                                      .sort((a, b) => b.score - a.score)
                                      .slice(0, 5)
                                      .map((policy) => (
                                        <div key={policy.policyType} className="flex justify-between text-xs mb-1">
                                          <span className="text-gray-600">{policy.policyType.replace(/_/g, ' ')}</span>
                                          <span className={`font-medium ${getRiskScoreColor(policy.score)}`}>
                                            {policy.score.toFixed(1)}% ({policy.keywords.length} keywords)
                                          </span>
                                        </div>
                                      ))}
                                  </div>
                                )}
                                {item.riskScore.policyScores.some((p) => p.matchedPatterns.length > 0) && (
                                  <details className="text-xs">
                                    <summary className="text-gray-500 cursor-pointer">Matched patterns</summary>
                                    <div className="mt-1 flex flex-wrap gap-1">
                                      {item.riskScore.policyScores
                                        .flatMap((p) => p.matchedPatterns)
                                        .slice(0, 15)
                                        .map((pattern, i) => (
                                          <span key={i} className="px-1.5 py-0.5 bg-red-50 text-red-700 rounded text-xs">
                                            {pattern}
                                          </span>
                                        ))}
                                    </div>
                                  </details>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Decision details */}
                        {item.decision && (
                          <div className="mt-3 p-3 bg-blue-50 rounded-lg text-sm">
                            <p className="font-medium text-blue-800">
                              <Gavel className="w-4 h-4 inline mr-1" />
                              Decision: {item.decision.action} by {item.decision.moderatorName}
                            </p>
                            <p className="text-blue-700 mt-1">{item.decision.reason}</p>
                            {item.decision.modelFeedback && !item.decision.modelFeedback.predictionCorrect && (
                              <p className="text-orange-600 mt-1 text-xs">
                                <AlertTriangle className="w-3 h-3 inline mr-1" />
                                ML prediction was incorrect — feedback recorded for retraining
                              </p>
                            )}
                          </div>
                        )}

                        {/* Appeal info */}
                        {item.appeal && (
                          <div className="mt-3 p-3 bg-indigo-50 rounded-lg text-sm">
                            <p className="font-medium text-indigo-800">
                              <Scale className="w-4 h-4 inline mr-1" />
                              Appeal: {item.appeal.status} by {item.appeal.submitterName}
                            </p>
                            <p className="text-indigo-700 mt-1">{item.appeal.reason}</p>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => setSelectedItem(item)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="View details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {item.riskScore && (
                          <button
                            onClick={() => handleRescoreItem(item.id)}
                            className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                            title="Re-score with ML"
                          >
                            <Brain className="w-4 h-4" />
                          </button>
                        )}
                        {hasPermission('moderation:content') && item.status === 'queued' && (
                          <>
                            <button
                              onClick={() => {
                                setSelectedItem(item);
                                setShowDecisionModal(true);
                                setSelectedAction('approve');
                              }}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="Approve"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedItem(item);
                                setShowDecisionModal(true);
                                setSelectedAction('reject');
                              }}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Reject"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Appeals Tab */}
          {activeTab === 'appeals' && (
            <div className="space-y-4">
              {appeals.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Scale className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">No appeals</p>
                  <p className="text-sm">No content appeals have been submitted yet.</p>
                </div>
              ) : (
                appeals.map((appeal) => (
                  <div key={appeal.id} className="bg-white border border-gray-200 rounded-lg p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <Scale className="w-5 h-5 text-indigo-600" />
                          <h3 className="font-semibold">Appeal by {appeal.submitterName}</h3>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            appeal.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            appeal.status === 'approved' || appeal.status === 'reversed' ? 'bg-green-100 text-green-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {appeal.status}
                          </span>
                        </div>
                        <p className="text-gray-600 mb-2"><strong>Reason:</strong> {appeal.reason}</p>
                        <p className="text-gray-600 mb-2"><strong>Explanation:</strong> {appeal.explanation}</p>
                        {appeal.evidence.length > 0 && (
                          <div className="mb-2">
                            <p className="text-sm font-medium text-gray-700">Evidence ({appeal.evidence.length}):</p>
                            {appeal.evidence.map((ev, i) => (
                              <div key={i} className="text-sm text-gray-600 ml-4">• {ev.description}</div>
                            ))}
                          </div>
                        )}
                        <p className="text-xs text-gray-400">Submitted: {new Date(appeal.createdAt).toLocaleString()}</p>
                        {appeal.decision && (
                          <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                            <p className="font-medium">Review Decision: {appeal.decision.decision} by {appeal.decision.reviewerName}</p>
                            <p className="text-gray-600">{appeal.decision.reason}</p>
                          </div>
                        )}
                      </div>
                      {appeal.status === 'pending' && hasPermission('moderation:content') && (
                        <button
                          onClick={() => {
                            setSelectedItem({
                              id: appeal.moderationId,
                              appeal,
                            } as ModerationItem);
                            setShowAppealReviewModal(true);
                          }}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Review Appeal"
                        >
                          <Gavel className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Stats Tab */}
          {activeTab === 'stats' && stats && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
                  <div className="text-3xl font-bold text-blue-700">{stats.total}</div>
                  <div className="text-sm text-blue-600">Total Items</div>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4">
                  <div className="text-3xl font-bold text-green-700">{(stats.modelAccuracy * 100).toFixed(1)}%</div>
                  <div className="text-sm text-green-600">Model Accuracy</div>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4">
                  <div className="text-3xl font-bold text-purple-700">{stats.autoApproved + stats.autoRejected}</div>
                  <div className="text-sm text-purple-600">Auto Decisions</div>
                </div>
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4">
                  <div className="text-3xl font-bold text-orange-700">{stats.averageReviewTime.toFixed(1)}m</div>
                  <div className="text-sm text-orange-600">Avg Review Time</div>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div className="flex justify-between p-3 bg-gray-50 rounded"><span>In Queue:</span><span className="font-bold">{stats.queued}</span></div>
                <div className="flex justify-between p-3 bg-gray-50 rounded"><span>In Review:</span><span className="font-bold">{stats.inReview}</span></div>
                <div className="flex justify-between p-3 bg-gray-50 rounded"><span>Flagged:</span><span className="font-bold">{stats.flagged}</span></div>
                <div className="flex justify-between p-3 bg-gray-50 rounded"><span>Approved:</span><span className="font-bold">{stats.approved}</span></div>
                <div className="flex justify-between p-3 bg-gray-50 rounded"><span>Rejected:</span><span className="font-bold">{stats.rejected}</span></div>
                <div className="flex justify-between p-3 bg-gray-50 rounded"><span>Avg Risk Score:</span><span className="font-bold">{stats.averageRiskScore.toFixed(1)}%</span></div>
              </div>
              {stats.appeals && (
                <div className="bg-white border rounded-lg p-4">
                  <h3 className="font-semibold mb-3">Appeal Statistics</h3>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                    <div className="text-center p-2 bg-gray-50 rounded"><div className="font-bold">{stats.appeals.total}</div><div className="text-gray-500">Total</div></div>
                    <div className="text-center p-2 bg-yellow-50 rounded"><div className="font-bold text-yellow-700">{stats.appeals.pending}</div><div className="text-gray-500">Pending</div></div>
                    <div className="text-center p-2 bg-green-50 rounded"><div className="font-bold text-green-700">{stats.appeals.approved}</div><div className="text-gray-500">Approved</div></div>
                    <div className="text-center p-2 bg-red-50 rounded"><div className="font-bold text-red-700">{stats.appeals.denied}</div><div className="text-gray-500">Denied</div></div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {selectedItem && !showDecisionModal && !showAppealReviewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="w-6 h-6 text-blue-600" />
                <h2 className="text-xl font-semibold">Content Review Detail</h2>
              </div>
              <button onClick={() => setSelectedItem(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><strong>Status:</strong> {formatStatus(selectedItem.status)}</div>
                <div><strong>Type:</strong> {selectedItem.contentType}</div>
                <div><strong>Severity:</strong> {selectedItem.severity}</div>
                <div><strong>Flags:</strong> {selectedItem.flags}</div>
                <div><strong>Author:</strong> {selectedItem.authorName}</div>
                <div><strong>Created:</strong> {new Date(selectedItem.createdAt).toLocaleString()}</div>
              </div>
              <div>
                <strong>Content:</strong>
                <p className="mt-1 p-3 bg-gray-50 rounded text-sm whitespace-pre-wrap">{selectedItem.content}</p>
              </div>
              {selectedItem.riskScore && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Brain className="w-4 h-4 text-purple-600" />
                    ML Risk Analysis ({(selectedItem.riskScore.confidence * 100).toFixed(0)}% confidence)
                  </h4>
                  <div className="space-y-2 text-sm">
                    {selectedItem.riskScore.policyScores.map((p) => (
                      <div key={p.policyType} className="flex items-center gap-2">
                        <span className="w-32 text-gray-600">{p.policyType.replace(/_/g, ' ')}:</span>
                        <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                          <div className={`h-1.5 rounded-full ${getRiskScoreBarColor(p.score)}`} style={{ width: `${p.score}%` }} />
                        </div>
                        <span className="w-12 text-right font-medium">{p.score.toFixed(0)}%</span>
                      </div>
                    ))}
                    {selectedItem.riskScore.policyScores.some((p) => p.keywords.length > 0) && (
                      <div className="mt-2">
                        <p className="text-xs text-gray-500 mb-1">Detected keywords:</p>
                        <div className="flex flex-wrap gap-1">
                          {[...new Set(selectedItem.riskScore.policyScores.flatMap((p) => p.keywords))].slice(0, 30).map((kw, i) => (
                            <span key={i} className="px-1.5 py-0.5 bg-yellow-50 text-yellow-800 rounded text-xs">{kw}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Decision Modal */}
      {showDecisionModal && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-lg w-full mx-4">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Gavel className="w-5 h-5 text-blue-600" />
                Moderation Decision
              </h2>
              <p className="text-sm text-gray-600 mt-1">{selectedItem.title}</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Action</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { action: 'approve', label: 'Approve', icon: Check, color: 'bg-green-100 text-green-800 border-green-300' },
                    { action: 'reject', label: 'Reject', icon: XCircle, color: 'bg-red-100 text-red-800 border-red-300' },
                    { action: 'flag_for_review', label: 'Flag', icon: Flag, color: 'bg-orange-100 text-orange-800 border-orange-300' },
                    { action: 'escalate', label: 'Escalate', icon: AlertTriangle, color: 'bg-purple-100 text-purple-800 border-purple-300' },
                    { action: 'warn_user', label: 'Warn User', icon: FileWarning, color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
                    { action: 'request_edit', label: 'Request Edit', icon: MessageSquare, color: 'bg-blue-100 text-blue-800 border-blue-300' },
                  ].map(({ action, label, icon: Icon, color }) => (
                    <button
                      key={action}
                      onClick={() => setSelectedAction(action)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${color} ${
                        selectedAction === action ? 'ring-2 ring-offset-1' : ''
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Reason *</label>
                <textarea
                  value={decisionReason}
                  onChange={(e) => setDecisionReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Explain your decision..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Notes</label>
                <textarea
                  value={decisionNotes}
                  onChange={(e) => setDecisionNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  placeholder="Optional internal notes..."
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
              <button
                onClick={() => { setShowDecisionModal(false); setDecisionReason(''); setDecisionNotes(''); }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleMakeDecision}
                disabled={!decisionReason}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Submit Decision
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Appeal Review Modal */}
      {showAppealReviewModal && selectedItem?.appeal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-lg w-full mx-4">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Scale className="w-5 h-5 text-indigo-600" />
                Review Appeal
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 p-3 rounded text-sm">
                <p><strong>Appeal by:</strong> {selectedItem.appeal.submitterName}</p>
                <p><strong>Reason:</strong> {selectedItem.appeal.reason}</p>
                <p><strong>Explanation:</strong> {selectedItem.appeal.explanation}</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Decision</label>
                <select
                  value={appealDecision}
                  onChange={(e) => setAppealDecision(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Select decision...</option>
                  <option value="approved">Approve (reverse rejection)</option>
                  <option value="denied">Deny (uphold rejection)</option>
                  <option value="reversed">Reverse Decision</option>
                  <option value="upheld">Uphold Original</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Reason *</label>
                <textarea
                  value={appealReason}
                  onChange={(e) => setAppealReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={3}
                  placeholder="Explain your appeal decision..."
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
              <button
                onClick={() => { setShowAppealReviewModal(false); setAppealDecision(''); setAppealReason(''); }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReviewAppeal(selectedItem!.appeal!.id)}
                disabled={!appealDecision || !appealReason}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Submit Appeal Decision
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}