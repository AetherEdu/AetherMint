'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  startAuthentication,
  startRegistration,
  browserSupportsWebAuthn,
} from '@simplewebauthn/browser';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  loginWithPasskey: (username?: string) => Promise<void>;
  registerPasskey: (deviceName: string) => Promise<{ credentialId: string; recoveryCodes?: string[] }>;
  verifyMFA: () => Promise<boolean>;
  logout: () => void;
  loading: boolean;
  isAuthenticated: boolean;
  hasPermission: (permission: string) => boolean;
  supportsPasskeys: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session on mount
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('admin_token');
        if (token) {
          // Verify token with backend
          const response = await fetch('/api/auth/verify', {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          if (response.ok) {
            const userData = await response.json();
            setUser(userData);
          } else {
            localStorage.removeItem('admin_token');
          }
        }
      } catch (error) {
        console.error('Auth check failed:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        throw new Error('Login failed');
      }

      const { token, user: userData } = await response.json();
      localStorage.setItem('admin_token', token);
      setUser(userData);
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('admin_token');
    setUser(null);
  };

  const hasPermission = (permission: string): boolean => {
    return user?.permissions.includes(permission) || false;
  };

  const supportsPasskeys = browserSupportsWebAuthn();

  const loginWithPasskey = async (username?: string) => {
    try {
      // Get authentication options
      const optionsResponse = await fetch('/api/auth/passkeys/login/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });

      if (!optionsResponse.ok) {
        throw new Error('Failed to get passkey options');
      }

      const { options, challenge } = await optionsResponse.json();

      // Start browser authentication
      const authResponse = await startAuthentication(options);

      // Verify with server
      const verifyResponse = await fetch('/api/auth/passkeys/login/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: authResponse, challenge }),
      });

      if (!verifyResponse.ok) {
        throw new Error('Passkey verification failed');
      }

      const { token, userId } = await verifyResponse.json();
      localStorage.setItem('admin_token', token);

      // Fetch user profile
      const profileResponse = await fetch('/api/auth/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (profileResponse.ok) {
        const { user: userData } = await profileResponse.json();
        setUser(userData);
      }
    } catch (error) {
      throw error;
    }
  };

  const registerPasskey = async (deviceName: string) => {
    const currentToken = localStorage.getItem('admin_token');
    if (!currentToken) throw new Error('Not authenticated');

    // Get registration options
    const optionsResponse = await fetch('/api/auth/passkeys/register/options', {
      headers: { Authorization: `Bearer ${currentToken}` },
    });

    if (!optionsResponse.ok) {
      throw new Error('Failed to get registration options');
    }

    const { options } = await optionsResponse.json();

    // Start browser registration
    const regResponse = await startRegistration(options);

    // Verify with server
    const verifyResponse = await fetch('/api/auth/passkeys/register/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${currentToken}`,
      },
      body: JSON.stringify({
        deviceName,
        response: regResponse,
        challenge: options.challenge,
      }),
    });

    if (!verifyResponse.ok) {
      throw new Error('Registration verification failed');
    }

    const result = await verifyResponse.json();
    return { credentialId: result.credentialId, recoveryCodes: result.recoveryCodes };
  };

  const verifyMFA = async (): Promise<boolean> => {
    const currentToken = localStorage.getItem('admin_token');
    if (!currentToken) return false;

    try {
      // Get MFA options
      const optionsResponse = await fetch('/api/auth/passkeys/mfa/options', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentToken}`,
        },
      });

      if (!optionsResponse.ok) return false;

      const { options, challenge } = await optionsResponse.json();

      // Start browser authentication
      const authResponse = await startAuthentication(options);

      // Verify MFA
      const verifyResponse = await fetch('/api/auth/passkeys/mfa/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentToken}`,
        },
        body: JSON.stringify({ response: authResponse, challenge }),
      });

      if (!verifyResponse.ok) return false;

      const result = await verifyResponse.json();
      return result.verified === true;
    } catch {
      return false;
    }
  };

  const value: AuthContextType = {
    user,
    login,
    loginWithPasskey,
    registerPasskey,
    verifyMFA,
    logout,
    loading,
    isAuthenticated: !!user,
    hasPermission,
    supportsPasskeys,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
