'use client';

import React, { useState } from 'react';
import {
  startRegistration,
  browserSupportsWebAuthn,
} from '@simplewebauthn/browser';

interface PasskeyRegistrationProps {
  token: string;
  onSuccess?: (credentialId: string) => void;
  onError?: (error: string) => void;
}

interface RecoveryCodesDisplayProps {
  codes: string[];
  onClose: () => void;
}

function RecoveryCodesDisplay({ codes, onClose }: RecoveryCodesDisplayProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(codes.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = codes.join('\n');
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        <svg
          className="w-5 h-5 text-yellow-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
        <h3 className="text-lg font-semibold text-yellow-800">
          Save Your Recovery Codes
        </h3>
      </div>
      <p className="text-sm text-yellow-700 mb-3">
        Store these codes in a safe place. Each code can only be used once to
        recover your account if you lose access to your passkeys.
      </p>
      <div className="grid grid-cols-2 gap-2 mb-3">
        {codes.map((code, index) => (
          <div
            key={index}
            className="font-mono text-sm bg-white px-3 py-1.5 rounded border border-yellow-300"
          >
            {code}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          onClick={copyToClipboard}
          className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors text-sm"
        >
          {copied ? 'Copied!' : 'Copy All Codes'}
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors text-sm"
        >
          I've Saved These Codes
        </button>
      </div>
    </div>
  );
}

export default function PasskeyRegistration({
  token,
  onSuccess,
  onError,
}: PasskeyRegistrationProps) {
  const [deviceName, setDeviceName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [step, setStep] = useState<'form' | 'recovering'>('form');

  const supportsWebAuthn = browserSupportsWebAuthn();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!supportsWebAuthn) {
      setError(
        'Your browser does not support WebAuthn. Please use a modern browser.'
      );
      setLoading(false);
      return;
    }

    try {
      // Step 1: Get registration options from the server
      const optionsResponse = await fetch(
        '/api/auth/passkeys/register/options',
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!optionsResponse.ok) {
        const errorData = await optionsResponse.json();
        throw new Error(
          errorData.message || 'Failed to get registration options'
        );
      }

      const { options } = await optionsResponse.json();

      // Step 2: Start the browser registration ceremony
      const registrationResponse = await startRegistration(options);

      // Step 3: Verify the registration with the server
      const verifyResponse = await fetch(
        '/api/auth/passkeys/register/verify',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            deviceName: deviceName || 'Unnamed Device',
            response: registrationResponse,
            challenge: options.challenge,
          }),
        }
      );

      if (!verifyResponse.ok) {
        const errorData = await verifyResponse.json();
        throw new Error(errorData.message || 'Registration verification failed');
      }

      const result = await verifyResponse.json();

      // Show recovery codes if this is the first passkey
      if (result.recoveryCodes && result.recoveryCodes.length > 0) {
        setRecoveryCodes(result.recoveryCodes);
        setStep('recovering');
      } else {
        onSuccess?.(result.credentialId);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Registration failed';
      setError(message);
      onError?.(message);
    } finally {
      setLoading(false);
    }
  };

  if (!supportsWebAuthn) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-700">
          Your browser does not support WebAuthn passkeys. Please use a modern
          browser like Chrome, Firefox, Safari, or Edge.
        </p>
      </div>
    );
  }

  if (step === 'recovering' && recoveryCodes) {
    return (
      <RecoveryCodesDisplay
        codes={recoveryCodes}
        onClose={() => onSuccess?.('')}
      />
    );
  }

  return (
    <div className="max-w-md">
      <h3 className="text-lg font-semibold mb-4">Register a Passkey</h3>
      <p className="text-sm text-gray-600 mb-4">
        Add a passkey for passwordless sign-in. Your device will handle
        authentication using biometrics, PIN, or security key.
      </p>

      <form onSubmit={handleRegister}>
        <div className="mb-4">
          <label
            htmlFor="deviceName"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Device Name
          </label>
          <input
            id="deviceName"
            type="text"
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
            placeholder="e.g., iPhone 14, YubiKey 5, MacBook Pro"
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
              Registering...
            </span>
          ) : (
            'Register Passkey'
          )}
        </button>
      </form>
    </div>
  );
}
