'use client';

import React, { useState, useEffect } from 'react';

interface PasskeyDevice {
  id: string;
  deviceName: string;
  createdAt: string;
  lastUsedAt: string;
  transports: string[];
}

interface PasskeyDeviceManagementProps {
  token: string;
  onRevokeSuccess?: (deviceName: string) => void;
  onError?: (error: string) => void;
}

export default function PasskeyDeviceManagement({
  token,
  onRevokeSuccess,
  onError,
}: PasskeyDeviceManagementProps) {
  const [devices, setDevices] = useState<PasskeyDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const fetchDevices = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/auth/passkeys/devices', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch devices');
      }

      const data = await response.json();
      setDevices(data.devices || []);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load devices';
      setError(message);
      onError?.(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, [token]);

  const handleRevoke = async (credentialId: string, deviceName: string) => {
    if (
      !window.confirm(
        `Are you sure you want to revoke "${deviceName}"? You will no longer be able to use this device to sign in.`
      )
    ) {
      return;
    }

    try {
      setRevokingId(credentialId);
      const response = await fetch(
        `/api/auth/passkeys/devices/${credentialId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to revoke device');
      }

      // Remove the device from the local list
      setDevices((prev) => prev.filter((d) => d.id !== credentialId));
      onRevokeSuccess?.(deviceName);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to revoke device';
      setError(message);
      onError?.(message);
    } finally {
      setRevokingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTransportIcon = (transport: string) => {
    switch (transport) {
      case 'internal':
        return '📱'; // Built-in authenticator (fingerprint, face)
      case 'usb':
        return '🔑'; // USB security key
      case 'ble':
        return '📶'; // Bluetooth
      case 'nfc':
        return '📡'; // NFC
      case 'hybrid':
        return '🔗'; // Hybrid (QR code)
      default:
        return '🔐';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <svg
          className="animate-spin h-6 w-6 text-blue-600"
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
        <span className="ml-2 text-gray-600">Loading devices...</span>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Registered Passkeys</h3>
        <button
          onClick={fetchDevices}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {devices.length === 0 ? (
        <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg text-center">
          <svg
            className="w-12 h-12 text-gray-400 mx-auto mb-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
            />
          </svg>
          <p className="text-gray-600 mb-2">No passkeys registered yet</p>
          <p className="text-sm text-gray-500">
            Register a passkey to enable passwordless sign-in.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {devices.map((device) => (
            <div
              key={device.id}
              className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">
                    {getTransportIcon(device.transports[0] || 'internal')}
                  </span>
                  <div>
                    <h4 className="font-medium text-gray-900">
                      {device.deviceName}
                    </h4>
                    <div className="text-sm text-gray-500">
                      <span>Added {formatDate(device.createdAt)}</span>
                      {device.lastUsedAt && (
                        <span className="ml-2">
                          · Last used {formatDate(device.lastUsedAt)}
                        </span>
                      )}
                    </div>
                    {device.transports.length > 0 && (
                      <div className="mt-1 flex gap-1">
                        {device.transports.map((transport) => (
                          <span
                            key={transport}
                            className="inline-block px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded"
                          >
                            {transport}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleRevoke(device.id, device.deviceName)}
                  disabled={revokingId === device.id}
                  className="px-3 py-1.5 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                >
                  {revokingId === device.id ? 'Revoking...' : 'Revoke'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
