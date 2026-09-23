/**
 * Waitlist Manager Component
 * Handles waitlist management for students and educators
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  Clock, 
  Users, 
  AlertCircle, 
  CheckCircle,
  Calendar,
  TrendingUp,
  UserX,
  UserPlus,
  Bell,
  Settings,
  Loader2,
  BarChart3,
  ExternalLink,
  Info
} from 'lucide-react';

interface WaitlistEntry {
  id: string;
  userId: string;
  courseId: string;
  position: number;
  addedAt: string;
  notifiedAt?: string;
  expiresAt?: string;
  status: 'active' | 'notified' | 'expired' | 'removed';
  user?: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  course?: {
    id: string;
    title: string;
    thumbnail: string;
    instructor: string;
  };
}

interface WaitlistStats {
  totalWaitlisted: number;
  averageWaitTime: number;
  conversionRate: number;
  dropoffRate: number;
  priorityDistribution: { condition: string; count: number }[];
  estimatedTimeToEnrollment: number;
}

interface WaitlistManagerProps {
  courseId?: string;
  userId?: string;
  viewMode?: 'student' | 'educator' | 'admin';
  onWaitlistUpdate?: () => void;
  className?: string;
}

export function WaitlistManager({ 
  courseId, 
  userId, 
  viewMode = 'student',
  onWaitlistUpdate,
  className 
}: WaitlistManagerProps) {
  const [waitlistEntries, setWaitlistEntries] = useState<WaitlistEntry[]>([]);
  const [stats, setStats] = useState<WaitlistStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchWaitlistData();
  }, [courseId, userId, viewMode]);

  const fetchWaitlistData = async () => {
    setIsLoading(true);
    try {
      let endpoint = '/api/enrollments/waitlist';
      
      if (courseId && viewMode === 'educator') {
        endpoint = `/api/enrollments/waitlist/${courseId}`;
      } else if (userId && viewMode === 'student') {
        endpoint = `/api/enrollments/waitlist/user/${userId}`;
      }

      const response = await fetch(endpoint);
      const data = await response.json();
      
      if (data.success) {
        setWaitlistEntries(data.data);
      }

      // Fetch stats
      const statsResponse = await fetch(`${endpoint}/stats`);
      const statsData = await statsResponse.json();
      if (statsData.success) {
        setStats(statsData.data);
      }
    } catch (error) {
      console.error('Error fetching waitlist data:', error);
      setError('Failed to load waitlist data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinWaitlist = async (courseId: string) => {
    setIsUpdating(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/enrollments/waitlist/${courseId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();
      
      if (data.success) {
        setSuccess(`Added to waitlist at position ${data.data.position}`);
        fetchWaitlistData();
        onWaitlistUpdate?.();
      } else {
        setError(data.message || 'Failed to join waitlist');
      }
    } catch (error) {
      setError('Failed to join waitlist');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleLeaveWaitlist = async (entryId: string) => {
    setIsUpdating(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/enrollments/waitlist/${entryId}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      
      if (data.success) {
        setSuccess('Removed from waitlist');
        fetchWaitlistData();
        onWaitlistUpdate?.();
      } else {
        setError(data.message || 'Failed to leave waitlist');
      }
    } catch (error) {
      setError('Failed to leave waitlist');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleNotifyWaitlist = async (courseId: string, positions: number) => {
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/enrollments/waitlist/${courseId}/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positions })
      });

      const data = await response.json();
      
      if (data.success) {
        setSuccess(`Notified ${data.data.notified} students`);
        fetchWaitlistData();
      } else {
        setError(data.message || 'Failed to notify waitlist');
      }
    } catch (error) {
      setError('Failed to notify waitlist');
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-blue-100 text-blue-800';
      case 'notified':
        return 'bg-green-100 text-green-800';
      case 'expired':
        return 'bg-red-100 text-red-800';
      case 'removed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatWaitTime = (days: number) => {
    if (days < 7) return `${days} days`;
    if (days < 30) return `${Math.round(days / 7)} weeks`;
    return `${Math.round(days / 30)} months`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin mr-3" />
        Loading waitlist data...
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Alerts */}
      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            {success}
          </AlertDescription>
        </Alert>
      )}

      {/* Student View */}
      {viewMode === 'student' && (
        <>
          {stats && (
            <div className="grid md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Waitlist Position</p>
                      <p className="text-2xl font-bold">
                        {waitlistEntries.length > 0 ? waitlistEntries[0].position : 'N/A'}
                      </p>
                    </div>
                    <Users className="h-8 w-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Est. Wait Time</p>
                      <p className="text-2xl font-bold">
                        {stats.estimatedTimeToEnrollment 
                          ? formatWaitTime(stats.estimatedTimeToEnrollment)
                          : 'N/A'
                        }
                      </p>
                    </div>
                    <Clock className="h-8 w-8 text-purple-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Conversion Rate</p>
                      <p className="text-2xl font-bold">{stats.conversionRate}%</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Waitlist Entries */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                My Waitlist Entries
              </CardTitle>
            </CardHeader>
            <CardContent>
              {waitlistEntries.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Waitlist Entries</h3>
                  <p className="text-muted-foreground mb-4">
                    You're not currently on any waitlists
                  </p>
                  {courseId && (
                    <Button
                      onClick={() => handleJoinWaitlist(courseId)}
                      disabled={isUpdating}
                    >
                      {isUpdating ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Joining...
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4 mr-2" />
                          Join Waitlist
                        </>
                      )}
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {waitlistEntries.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        {entry.course?.thumbnail && (
                          <img
                            src={entry.course.thumbnail}
                            alt={entry.course.title}
                            className="w-16 h-16 object-cover rounded-lg"
                          />
                        )}
                        <div>
                          <h4 className="font-semibold">{entry.course?.title}</h4>
                          <p className="text-sm text-muted-foreground">
                            Position: #{entry.position}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Added: {formatDate(entry.addedAt)}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(entry.status)}>
                          {entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
                        </Badge>
                        
                        {entry.status === 'active' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleLeaveWaitlist(entry.id)}
                            disabled={isUpdating}
                          >
                            <UserX className="w-4 h-4 mr-1" />
                            Leave
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Educator/Admin View */}
      {(viewMode === 'educator' || viewMode === 'admin') && (
        <>
          {/* Stats Overview */}
          {stats && (
            <div className="grid md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Waitlisted</p>
                      <p className="text-2xl font-bold">{stats.totalWaitlisted}</p>
                    </div>
                    <Users className="h-8 w-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Avg Wait Time</p>
                      <p className="text-2xl font-bold">
                        {formatWaitTime(stats.averageWaitTime)}
                      </p>
                    </div>
                    <Clock className="h-8 w-8 text-purple-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Conversion Rate</p>
                      <p className="text-2xl font-bold">{stats.conversionRate}%</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Dropoff Rate</p>
                      <p className="text-2xl font-bold">{stats.dropoffRate}%</p>
                    </div>
                    <UserX className="h-8 w-8 text-red-500" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Waitlist Management */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Waitlist Management
                </CardTitle>
                <div className="flex gap-2">
                  {courseId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleNotifyWaitlist(courseId, 3)}
                      disabled={isUpdating}
                    >
                      <Bell className="w-4 h-4 mr-1" />
                      Notify Next 3
                    </Button>
                  )}
                  <Button variant="outline" size="sm">
                    <Settings className="w-4 h-4 mr-1" />
                    Settings
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {waitlistEntries.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Waitlist Entries</h3>
                  <p className="text-muted-foreground">
                    No students are currently on the waitlist
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {waitlistEntries.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="font-bold text-blue-600">#{entry.position}</span>
                        </div>
                        
                        {entry.user?.avatar && (
                          <img
                            src={entry.user.avatar}
                            alt={entry.user.name}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        )}
                        
                        <div>
                          <h4 className="font-semibold">{entry.user?.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {entry.user?.email}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Added: {formatDate(entry.addedAt)}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(entry.status)}>
                          {entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
                        </Badge>
                        
                        {entry.status === 'active' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleLeaveWaitlist(entry.id)}
                            disabled={isUpdating}
                          >
                            <UserX className="w-4 h-4 mr-1" />
                            Remove
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Waitlist Analytics */}
          {stats && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Waitlist Analytics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold mb-3">Priority Distribution</h4>
                    <div className="space-y-2">
                      {stats.priorityDistribution.map((item, index) => (
                        <div key={index} className="flex justify-between text-sm">
                          <span>{item.condition}</span>
                          <span className="font-medium">{item.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-3">Performance Metrics</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Conversion Rate</span>
                        <span className="font-medium">{stats.conversionRate}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Dropoff Rate</span>
                        <span className="font-medium">{stats.dropoffRate}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Average Wait Time</span>
                        <span className="font-medium">
                          {formatWaitTime(stats.averageWaitTime)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Info Alert */}
      <Alert className="border-blue-200 bg-blue-50">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          <div className="space-y-2">
            <p className="font-semibold">Waitlist Information:</p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Students are enrolled in order of their waitlist position</li>
              <li>You'll be notified when a spot becomes available</li>
              <li>Students have 48 hours to accept enrollment offers</li>
              <li>Priority may be given based on enrollment conditions</li>
            </ul>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
}
