'use client';

import React, { useState, useEffect } from 'react';
import {
  startAuthentication,
  browserSupportsWebAuthn,
} from '@simplewebauthn/browser';

interface PasskeyMFAProps {
  token: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
  onSkip?: () => void;
}

export default function PasskeyMFA({
  token,
  onSuccess,
  onError,
  onSkip,
}: PasskeyMFAProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supportsWebAuthn = browserSupportsWebAuthn();

  const handleVerify = async () => {
    setLoading(true);
    setError(null);

    if (!supportsWebAuthn) {
      setError('Your browser does not support WebAuthn passkeys.');
      setLoading(false);
      return;
    }

    try {
      // Step 1: Get MFA options from the server
      const optionsResponse = await fetch(
        '/api/auth/passkeys/mfa/options',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!optionsResponse.ok) {
        const errorData = await optionsResponse.json();
        throw new Error(
          errorData.message || 'Failed to get MFA options'
        );
      }

      const { options, challenge } = await optionsResponse.json();

      // Step 2: Start the browser authentication ceremony
      const authenticationResponse = await startAuthentication(options);

      // Step 3: Verify the MFA response with the server
      const verifyResponse = await fetch(
        '/api/auth/passkeys/mfa/verify',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
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
          errorData.message || 'MFA verification failed'
        );
      }

      const result = await verifyResponse.json();

      if (result.verified) {
        onSuccess?.();
      } else {
        throw new Error('MFA verification failed');
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'MFA verification failed';
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
            Your browser does not support WebAuthn passkeys for MFA.
          </p>
        </div>
        {onSkip && (
          <button
            onClick={onSkip}
            className="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
          >
            Skip MFA
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-md">
      <h3 className="text-lg font-semibold mb-4">Verify with Passkey</h3>
      <p className="text-sm text-gray-600 mb-4">
        Use your passkey as a second factor to complete sign-in.
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <button
        onClick={handleVerify}
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
            Verifying...
          </span>
        ) : (
          'Verify with Passkey'
        )}
      </button>

      {onSkip && (
        <div className="mt-4 text-center">
          <button
            onClick={onSkip}
            className="text-sm text-gray-600 hover:text-gray-800 underline"
          >
            Skip for now
          </button>
        </div>
      )}
    </div>
  );
}
