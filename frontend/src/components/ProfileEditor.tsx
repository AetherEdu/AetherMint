'use client';

import { useState, useEffect } from 'react';
import { useFormValidation } from '../lib/validation/useFormValidation';
import { profileFormSchema, type ProfileFormData } from '../lib/validation/schemas';
import { UserProfile } from '../types/profile';
import { useProfile } from '../hooks/useProfile';
import { User, MapPin, Globe, Lock, Save, X, Camera, AlertCircle } from 'lucide-react';

interface ProfileEditorProps {
  onClose?: () => void;
  onSuccess?: () => void;
}

export function ProfileEditor({ onClose, onSuccess }: ProfileEditorProps) {
  const { profile, updateProfile, loading } = useProfile();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
    errorAnnouncementId,
    errorAnnouncement,
    resetForm,
  } = useFormValidation<ProfileFormData>({
    schema: profileFormSchema,
    persistenceKey: 'profile-editor',
    mode: 'onChange',
    onSubmit: async (data) => {
      setIsSubmitting(true);
      setSubmitError(null);

      try {
        if (!profile) {
          setSubmitError('No profile data available');
          return;
        }

        const response = await updateProfile(data);

        if (response.success) {
          onSuccess?.();
          onClose?.();
        } else {
          setSubmitError(response.message || 'Failed to update profile');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
        setSubmitError(errorMessage);
        console.error('Profile update error:', error);
      } finally {
        setIsSubmitting(false);
      }
    },
  });

  useEffect(() => {
    if (profile) {
      reset({
        name: profile.name || '',
        email: profile.email || '',
        bio: profile.bio || '',
        location: profile.location || '',
        website: profile.website || '',
        privacy: profile.privacy || 'public'
      });
      setAvatarPreview(profile.avatar || null);
    }
  }, [profile, reset]);

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCancel = () => {
    resetForm();
    setAvatarPreview(profile?.avatar || null);
    setSubmitError(null);
    onClose?.();
  };

  if (!profile) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl border border-gray-200 dark:border-slate-700">
      {/* Header */}
      <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-slate-700">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
          Edit Profile
        </h2>
        <button
          onClick={handleCancel}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 min-w-[44px] min-h-[44px] flex items-center justify-center touch-target"
          aria-label="Close editor"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Accessible error announcement for screen readers (Issue #275) */}
      {errorAnnouncement && (
        <div id={errorAnnouncementId} className="sr-only" aria-live="assertive" aria-atomic="true" role="alert">
          {errorAnnouncement}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5 sm:space-y-6">
        {/* Avatar Section */}
        <div className="flex items-center gap-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center overflow-hidden">
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Avatar preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-2xl font-bold text-white">
                  {profile.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <label
              htmlFor="avatar-upload"
              className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full cursor-pointer hover:bg-blue-700 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <Camera className="h-4 w-4" />
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </label>
          </div>
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white">Profile Picture</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Upload a new avatar image
            </p>
          </div>
        </div>

        {/* Basic Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
            <User className="h-5 w-5" />
            Basic Information
          </h3>

          {/* Name */}
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Name *
            </label>
            <input
              id="name"
              type="text"
              {...register('name')}
              className={`w-full px-4 py-3 sm:py-2.5 text-base border rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.name ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-slate-600'
              }`}
              placeholder="Enter your name"
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? 'name-error' : undefined}
            />
            {errors.name && (
              <p id="name-error" role="alert" aria-live="assertive" className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                {errors.name.message}
              </p>
            )}
          </div>

          {/* Email */}
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Email *
            </label>
            <input
              id="email"
              type="email"
              {...register('email')}
              className={`w-full px-4 py-3 sm:py-2.5 text-base border rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.email ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-slate-600'
              }`}
              placeholder="your.email@example.com"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'email-error' : undefined}
            />
            {errors.email && (
              <p id="email-error" role="alert" aria-live="assertive" className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Bio */}
          <div>
            <label
              htmlFor="bio"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Bio
            </label>
            <textarea
              id="bio"
              rows={3}
              {...register('bio')}
              className={`w-full px-4 py-3 sm:py-2.5 text-base border rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none ${
                errors.bio ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-slate-600'
              }`}
              placeholder="Tell us about yourself..."
              aria-invalid={!!errors.bio}
              aria-describedby={errors.bio ? 'bio-error' : undefined}
            />
            {errors.bio && (
              <p id="bio-error" role="alert" aria-live="assertive" className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                {errors.bio.message}
              </p>
            )}
          </div>
        </div>

        {/* Location and Website */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Additional Information
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Location */}
            <div>
              <label
                htmlFor="location"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2"
              >
                <MapPin className="h-4 w-4" />
                Location
              </label>
              <input
                id="location"
                type="text"
                {...register('location')}
                className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.location ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-slate-600'
                }`}
                placeholder="City, Country"
                aria-invalid={!!errors.location}
              />
              {errors.location && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.location.message}</p>
              )}
            </div>

            {/* Website */}
            <div>
              <label
                htmlFor="website"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2"
              >
                <Globe className="h-4 w-4" />
                Website
              </label>
              <input
                id="website"
                type="url"
                {...register('website')}
                className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.website ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-slate-600'
                }`}
                placeholder="https://yourwebsite.com"
                aria-invalid={!!errors.website}
              />
              {errors.website && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.website.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Privacy Settings */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Privacy Settings
          </h3>

          <div>
            <label
              htmlFor="privacy"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Profile Visibility
            </label>
            <select
              id="privacy"
              {...register('privacy')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="public">Public - Anyone can view your profile</option>
              <option value="friends-only">Friends Only - Only friends can view</option>
              <option value="private">Private - Only you can view your profile</option>
            </select>
          </div>
        </div>

        {/* Submit Error */}
        {submitError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4" role="alert" aria-live="assertive">
            <p className="text-sm text-red-600 dark:text-red-400">{submitError}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col xs:flex-row justify-end gap-3 pt-4 border-t border-gray-200 dark:border-slate-700">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-3 sm:py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-900 dark:text-white font-medium hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors min-h-[44px] touch-target"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!isDirty || isSubmitting || loading}
            className="px-4 py-3 sm:py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 min-h-[44px] touch-target"
          >
            <Save className="h-4 w-4" />
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
