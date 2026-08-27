'use client';

import React, { useState } from 'react';
import {
  startAuthentication,
  browserSupportsWebAuthn,
} from '@simplewebauthn/browser';

interface PasskeyLoginProps {
  onSuccess?: (token: string, userId: string) => void;
  onError?: (error: string) => void;
  onFallbackToPassword?: () => void;
}

export default function PasskeyLogin({
  onSuccess,
  onError,
  onFallbackToPassword,
}: PasskeyLoginProps) {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supportsWebAuthn = browserSupportsWebAuthn();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!supportsWebAuthn) {
      setError(
        'Your browser does not support WebAuthn. Please use password login.'
      );
      setLoading(false);
      return;
    }

    try {
      // Step 1: Get authentication options from the server
      const optionsResponse = await fetch(
        '/api/auth/passkeys/login/options',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ username }),
        }
      );

      if (!optionsResponse.ok) {
        const errorData = await optionsResponse.json();
        throw new Error(
          errorData.message || 'Failed to get authentication options'
        );
      }

      const { options, challenge } = await optionsResponse.json();

      // Step 2: Start the browser authentication ceremony
      const authenticationResponse = await startAuthentication(options);

      // Step 3: Verify the authentication with the server
      const verifyResponse = await fetch(
        '/api/auth/passkeys/login/verify',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            response: authenticationResponse,
            challenge,
          }),
        }
      );

      if (!verifyResponse.ok) {
        const errorData = await verifyResponse.json();
        throw new Error(
          errorData.message || 'Authentication verification failed'
        );
      }

      const result = await verifyResponse.json();
      onSuccess?.(result.token, result.userId);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Authentication failed';
      setError(message);
      onError?.(message);
    } finally {
      setLoading(false);
    }
  };

  if (!supportsWebAuthn) {
    return (
      <div className="max-w-md">
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
          <p className="text-yellow-700 text-sm">
            Your browser does not support WebAuthn passkeys.
          </p>
        </div>
        {onFallbackToPassword && (
          <button
            onClick={onFallbackToPassword}
            className="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
          >
            Sign in with Password
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-md">
      <h3 className="text-lg font-semibold mb-4">Sign in with Passkey</h3>
      <p className="text-sm text-gray-600 mb-4">
        Use your passkey to sign in without a password. Your device will
        handle authentication using biometrics, PIN, or security key.
      </p>

      <form onSubmit={handleLogin}>
        <div className="mb-4">
          <label
            htmlFor="passkey-username"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Email or Username
          </label>
          <input
            id="passkey-username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your email or username"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
              Authenticating...
            </span>
          ) : (
            'Sign in with Passkey'
          )}
        </button>
      </form>

      {onFallbackToPassword && (
        <div className="mt-4 text-center">
          <button
            onClick={onFallbackToPassword}
            className="text-sm text-blue-600 hover:text-blue-800 underline"
          >
            Sign in with password instead
          </button>
        </div>
      )}
    </div>
  );
}
