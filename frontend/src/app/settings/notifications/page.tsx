'use client';

import React, { useState } from 'react';
import PreferencesPanel from '@/components/Notifications/PreferencesPanel';
import { useNotifications } from '@/hooks/useNotifications';
import { Bell, Shield, Info } from 'lucide-react';
import { Skeleton, SkeletonText } from '@/components/Skeleton';

export default function NotificationSettingsPage() {
    // Using a hardcoded userId for demo purposes. 
    // In a real app, this would come from an auth context.
    const { preferences, updatePreferences, isLoading, subscribeToPushNotifications } = useNotifications('user-123');
    const [pushStatus, setPushStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const handlePushSubscription = async () => {
        try {
            await subscribeToPushNotifications();
            setPushStatus({
                type: 'success',
                message: 'Successfully subscribed to push notifications!',
            });
        } catch (error) {
            setPushStatus({
                type: 'error',
                message: 'Failed to subscribe to push notifications. Please check your browser settings.',
            });
        }
    };

    return (
        <div className="max-w-4xl mx-auto py-8 px-4">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Notification Settings</h1>
                <p className="text-gray-600 mt-2">
                    Manage how and when you receive notifications from AetherMint.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Main Content */}
                <div className="md:col-span-2 space-y-8">
                    <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        {isLoading ? (
                            <div
                                role="status"
                                aria-live="polite"
                                aria-busy="true"
                                aria-label="Loading notification preferences"
                                className="p-6 space-y-6"
                            >
                                {Array.from({ length: 4 }).map((_, index) => (
                                    <div key={index} className="flex items-center justify-between gap-4">
                                        <div className="flex-1 space-y-2">
                                            <Skeleton variant="text" width="40%" />
                                            <SkeletonText lines={1} />
                                        </div>
                                        <Skeleton variant="list-item" width="3rem" height="1.5rem" />
                                    </div>
                                ))}
                                <span className="sr-only">Loading notification preferences…</span>
                            </div>
                        ) : (
                            <PreferencesPanel
                                preferences={preferences}
                                onUpdatePreferences={updatePreferences}
                            />
                        )}
                    </section>

                    {/* Device Settings */}
                    <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <Shield size={22} className="text-blue-600" />
                            <h2 className="text-xl font-semibold text-gray-900">Push Notifications</h2>
                        </div>
                        <p className="text-gray-600 mb-6">
                            Enable push notifications to stay updated even when you're not on the site.
                        </p>
                        <button
                            onClick={handlePushSubscription}
                            className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                        >
                            <Bell size={18} />
                            Enable Browser Push
                        </button>
                        <div role="status" aria-live="polite" className="mt-4">
                            {pushStatus && (
                                <p
                                    className={
                                        pushStatus.type === 'success'
                                            ? 'text-sm text-green-700'
                                            : 'text-sm text-red-700'
                                    }
                                >
                                    {pushStatus.message}
                                </p>
                            )}
                        </div>
                    </section>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    <div className="bg-blue-50 rounded-xl p-6 border border-blue-100">
                        <div className="flex items-center gap-2 mb-3 text-blue-800">
                            <Info size={18} />
                            <h3 className="font-semibold">Need help?</h3>
                        </div>
                        <p className="text-sm text-blue-700 leading-relaxed">
                            Notifications help you stay on track with your learning goals. We recommend keeping "Course Updates" and "System Alerts" enabled.
                        </p>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                        <h3 className="font-semibold text-gray-900 mb-2">Privacy Note</h3>
                        <p className="text-sm text-gray-600 leading-relaxed">
                            We never share your contact information with third parties. Your notification data is used solely for platform updates.
                        </p>
                    </div>
                </div>
            </div>

            {isLoading && (
                <div
                    role="status"
                    aria-live="polite"
                    aria-busy="true"
                    className="fixed inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center z-50"
                >
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    <span className="sr-only">Loading notification settings…</span>
                </div>
            )}
        </div>
    );
}
