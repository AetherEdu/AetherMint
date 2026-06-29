'use client';

import { useState, useMemo } from 'react';
import { Credential } from '../types/profile';
import { useProfile } from '../hooks/useProfile';
import { EmptyState } from './LoadingFallback';
import { 
  Award, 
  CheckCircle, 
  Clock, 
  XCircle, 
  AlertCircle,
  ExternalLink,
  Download,
  Plus,
  Search,
  Filter,
  Calendar,
  Building,
  Tag,
  FileText,
  Shield
} from 'lucide-react';

interface CredentialListProps {
  credentials?: Credential[];
  showAddButton?: boolean;
  compact?: boolean;
  filterable?: boolean;
  searchable?: boolean;
}

const VERIFICATION_STATUS_CONFIG = {
  verified: {
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    borderColor: 'border-green-200 dark:border-green-800',
    icon: CheckCircle,
    label: 'Verified'
  },
  pending: {
    color: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
    borderColor: 'border-yellow-200 dark:border-yellow-800',
    icon: Clock,
    label: 'Pending'
  },
  rejected: {
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    borderColor: 'border-red-200 dark:border-red-800',
    icon: XCircle,
    label: 'Rejected'
  },
  expired: {
    color: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-50 dark:bg-gray-900/20',
    borderColor: 'border-gray-200 dark:border-gray-800',
    icon: AlertCircle,
    label: 'Expired'
  }
};

const CREDENTIAL_TYPE_CONFIG = {
  certificate: {
    icon: Award,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20'
  },
  badge: {
    icon: Tag,
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-900/20'
  },
  degree: {
    icon: FileText,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-900/20'
  },
  license: {
    icon: Shield,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-900/20'
  }
};

export function CredentialList({ 
  credentials: propCredentials,
  showAddButton = true,
  compact = false,
  filterable = true,
  searchable = true
}: CredentialListProps) {
  const { credentials: hookCredentials, addCredential, updateCredentialStatus } = useProfile();
  const credentials = propCredentials || hookCredentials;
  
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // Get unique statuses and types
  const statuses = ['all', 'verified', 'pending', 'rejected', 'expired'];
  const types = ['all', 'certificate', 'badge', 'degree', 'license'];

  // Filter credentials
  const filteredCredentials = useMemo(() => {
    return (credentials || []).filter(credential => {
      // Search filter
      if (searchQuery && !credential.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !credential.issuer.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !credential.skills.some(skill => skill.toLowerCase().includes(searchQuery.toLowerCase()))) {
        return false;
      }

      // Status filter
      if (selectedStatus !== 'all' && credential.verificationStatus !== selectedStatus) {
        return false;
      }

      // Type filter
      if (selectedType !== 'all' && credential.type !== selectedType) {
        return false;
      }

      return true;
    });
  }, [credentials, searchQuery, selectedStatus, selectedType]);

  // Statistics
  const stats = useMemo(() => {
    const creds = credentials || [];
    const total = creds.length;
    const verified = creds.filter(c => c.verificationStatus === 'verified').length;
    const pending = creds.filter(c => c.verificationStatus === 'pending').length;
    const expired = creds.filter(c => c.verificationStatus === 'expired').length;

    return { total, verified, pending, expired };
  }, [credentials]);

  const handleVerifyCredential = async (credentialId: string) => {
    await updateCredentialStatus(credentialId, 'pending');
  };

  const handleDownloadCredential = (credential: Credential) => {
    // In a real app, this would download the actual document
    const url = credential.documentUrl || credential.verificationUrl;
    if (url) {
      window.open(url, '_blank');
    }
  };

  if (compact) {
    return (
      <div className="space-y-3">
        {filteredCredentials.length === 0 ? (
          <EmptyState
            icon={<Award className="h-6 w-6" />}
            title="No credentials yet"
            description="Add credentials to showcase your achievements."
            action={showAddButton ? { label: 'Add Credential', onClick: () => setShowAddForm(true) } : undefined}
          />
        ) : (
          <>
            {filteredCredentials.slice(0, 3).map((credential) => {
              const statusConfig = VERIFICATION_STATUS_CONFIG[credential.verificationStatus];
              const typeConfig = CREDENTIAL_TYPE_CONFIG[credential.type];
              const StatusIcon = statusConfig.icon;
              const TypeIcon = typeConfig.icon;
              return (
                <div
                  key={credential.id}
                  className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700"
                >
                  <div className={`p-2 rounded-lg ${typeConfig.bgColor}`}>
                    <TypeIcon className={`h-5 w-5 ${typeConfig.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 dark:text-white truncate">{credential.title}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{credential.issuer}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <StatusIcon className={`h-4 w-4 ${statusConfig.color}`} />
                  </div>
                </div>
              );
            })}
            {credentials.length > 3 && (
              <div className="text-center text-sm text-gray-600 dark:text-gray-400">
                +{credentials.length - 3} more credentials
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-lg p-6 border border-green-200 dark:border-green-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Award className="h-6 w-6 text-blue-500" />
            Credentials
          </h2>
          {showAddButton && (
            <button
              onClick={() => setShowAddForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Credential
            </button>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {stats.total}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Total</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {stats.verified}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Verified</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {stats.pending}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Pending</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">
              {stats.expired}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Expired</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      {(filterable || searchable) && (
        <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            {searchable && (
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search credentials..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}

            {/* Filters */}
            {filterable && (
              <div className="flex gap-2">
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm"
                >
                  {statuses.map(status => (
                    <option key={status} value={status}>
                      {status === 'all' ? 'All Statuses' : status.charAt(0).toUpperCase() + status.slice(1)}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm"
                >
                  {types.map(type => (
                    <option key={type} value={type}>
                      {type === 'all' ? 'All Types' : type.charAt(0).toUpperCase() + type.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Credential List */}
      <div className="space-y-4">
        {filteredCredentials.map((credential) => {
          const statusConfig = VERIFICATION_STATUS_CONFIG[credential.verificationStatus];
          const typeConfig = CREDENTIAL_TYPE_CONFIG[credential.type];
          const StatusIcon = statusConfig.icon;
          const TypeIcon = typeConfig.icon;

          return (
            <div
              key={credential.id}
              className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start gap-4">
                {/* Type Icon */}
                <div className={`p-3 rounded-lg ${typeConfig.bgColor}`}>
                  <TypeIcon className={`h-6 w-6 ${typeConfig.color}`} />
                </div>

                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                        {credential.title}
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-1">
                          <Building className="h-4 w-4" />
                          <span>{credential.issuer}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>Issued {new Date(credential.issueDate).toLocaleDateString()}</span>
                        </div>
                        {credential.expiryDate && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            <span>Expires {new Date(credential.expiryDate).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className={`px-3 py-1 rounded-full border ${statusConfig.bgColor} ${statusConfig.borderColor} ${statusConfig.color} flex items-center gap-1`}>
                      <StatusIcon className="h-4 w-4" />
                      <span className="text-sm font-medium">{statusConfig.label}</span>
                    </div>
                  </div>

                  {/* Skills */}
                  {credential.skills.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Skills</h4>
                      <div className="flex flex-wrap gap-2">
                        {credential.skills.map((skill, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded text-xs"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-4 border-t border-gray-200 dark:border-slate-700">
                    {credential.verificationUrl && (
                      <button
                        onClick={() => window.open(credential.verificationUrl, '_blank')}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Verify
                      </button>
                    )}
                    {credential.documentUrl && (
                      <button
                        onClick={() => handleDownloadCredential(credential)}
                        className="px-3 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1"
                      >
                        <Download className="h-3 w-3" />
                        Download
                      </button>
                    )}
                    {credential.verificationStatus === 'rejected' && (
                      <button
                        onClick={() => handleVerifyCredential(credential.id)}
                        className="px-3 py-1 text-sm bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
                      >
                        Re-submit for Verification
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredCredentials.length === 0 && (
        <EmptyState
          icon={<Award className="h-8 w-8" />}
          title={
            searchQuery || selectedStatus !== 'all' || selectedType !== 'all'
              ? 'No credentials match your filters'
              : 'No credentials yet'
          }
          description={
            searchQuery || selectedStatus !== 'all' || selectedType !== 'all'
              ? 'Try adjusting your search or filter criteria.'
              : 'Add your first credential to start building your verified portfolio.'
          }
          action={
            !searchQuery && selectedStatus === 'all' && selectedType === 'all' && showAddButton
              ? { label: 'Add Credential', onClick: () => setShowAddForm(true) }
              : searchQuery || selectedStatus !== 'all' || selectedType !== 'all'
              ? { label: 'Clear filters', onClick: () => { setSearchQuery(''); setSelectedStatus('all'); setSelectedType('all'); } }
              : undefined
          }
        />
      )}

      {/* Add Credential Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Add New Credential
              </h3>
              {/* Add credential form would go here */}
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Credential addition form would be implemented here with file upload and form fields.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Save Credential
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
