'use client';

import React, { useState } from 'react';

interface PasskeyRecoveryProps {
  onSuccess?: (token: string, userId: string) => void;
  onError?: (error: string) => void;
  onBackToLogin?: () => void;
}

export default function PasskeyRecovery({
  onSuccess,
  onError,
  onBackToLogin,
}: PasskeyRecoveryProps) {
  const [userId, setUserId] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        '/api/auth/passkeys/recovery/verify',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId,
            code: recoveryCode.trim().toUpperCase(),
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || 'Recovery code verification failed'
        );
      }

      const result = await response.json();
      onSuccess?.(result.token, result.userId);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Recovery failed';
      setError(message);
      onError?.(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md">
      <h3 className="text-lg font-semibold mb-4">Account Recovery</h3>
      <p className="text-sm text-gray-600 mb-4">
        Lost access to all your passkeys? Use a recovery code to regain access
        to your account.
      </p>

      <form onSubmit={handleRecover}>
        <div className="mb-4">
          <label
            htmlFor="recovery-userId"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            User ID or Email
          </label>
          <input
            id="recovery-userId"
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="Enter your user ID or email"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div className="mb-4">
          <label
            htmlFor="recovery-code"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Recovery Code
          </label>
          <input
            id="recovery-code"
            type="text"
            value={recoveryCode}
            onChange={(e) => setRecoveryCode(e.target.value)}
            placeholder="XXXX-XXXX-XXXX"
            required
            className="w-full px-3 py-2 font-mono border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase"
          />
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="animate-spin h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Recovering...
            </span>
          ) : (
            'Recover Account'
          )}
        </button>
      </form>

      {onBackToLogin && (
        <div className="mt-4 text-center">
          <button
            onClick={onBackToLogin}
            className="text-sm text-blue-600 hover:text-blue-800 underline"
          >
            Back to sign in
          </button>
        </div>
      )}
    </div>
  );
}
