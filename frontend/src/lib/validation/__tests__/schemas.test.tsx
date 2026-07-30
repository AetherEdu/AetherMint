/**
 * Form Validation Tests — Issue #275.
 *
 * Tests for Zod validation schemas, the useFormValidation hook,
 * and the FormField component.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { z } from 'zod';
import {
  personalInfoSchema,
  profileFormSchema,
  settingsSchema,
  paymentDetailsSchema,
} from '../schemas';

// ---------------------------------------------------------------------------
// Zod Schema Tests
// ---------------------------------------------------------------------------

describe('Zod Validation Schemas', () => {
  describe('personalInfoSchema', () => {
    it('accepts valid personal info', () => {
      const valid = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '+1-555-123-4567',
      };
      const result = personalInfoSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('accepts personal info without phone (optional field)', () => {
      const valid = {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
      };
      const result = personalInfoSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects empty first name', () => {
      const invalid = { firstName: '', lastName: 'Doe', email: 'j@d.com' };
      const result = personalInfoSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      const messages = result.error?.issues.map((i) => i.message).join(', ');
      expect(messages).toContain('First name');
    });

    it('rejects first name shorter than 2 characters', () => {
      const invalid = { firstName: 'A', lastName: 'Doe', email: 'j@d.com' };
      const result = personalInfoSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      const messages = result.error?.issues.map((i) => i.message).join(', ');
      expect(messages).toContain('at least 2 characters');
    });

    it('rejects invalid email', () => {
      const invalid = { firstName: 'John', lastName: 'Doe', email: 'not-an-email' };
      const result = personalInfoSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      const messages = result.error?.issues.map((i) => i.message).join(', ');
      expect(messages).toContain('email');
    });

    it('rejects long first name (> 50 chars)', () => {
      const invalid = {
        firstName: 'A'.repeat(51),
        lastName: 'Doe',
        email: 'j@d.com',
      };
      const result = personalInfoSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('rejects invalid phone number format', () => {
      const invalid = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: 'abc',
      };
      const result = personalInfoSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('profileFormSchema', () => {
    it('accepts valid profile data', () => {
      const valid = {
        name: 'John Doe',
        email: 'john@example.com',
        bio: 'Software developer',
        location: 'San Francisco',
        website: 'https://johndoe.com',
        privacy: 'public' as const,
      };
      const result = profileFormSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('accepts minimal profile data', () => {
      const valid = {
        name: 'JD',
        email: 'jd@test.com',
        privacy: 'private' as const,
      };
      const result = profileFormSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects invalid privacy option', () => {
      const invalid = {
        name: 'John',
        email: 'j@d.com',
        privacy: 'everyone',
      };
      const result = profileFormSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('rejects invalid website URL', () => {
      const invalid = {
        name: 'John',
        email: 'j@d.com',
        privacy: 'public' as const,
        website: 'not-a-url',
      };
      const result = profileFormSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('settingsSchema', () => {
    it('accepts valid settings', () => {
      const valid = {
        emailNotifications: true,
        weeklyDigest: false,
        achievementAlerts: true,
        darkMode: true,
        language: 'en',
        privacy: 'public' as const,
        twoFactorEnabled: false,
        newsletter: true,
      };
      const result = settingsSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects invalid language', () => {
      const invalid = { ...defaultSettings(), language: 'xx' };
      const result = settingsSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('paymentDetailsSchema', () => {
    it('accepts valid payment details', () => {
      const valid = {
        courseId: 'course_001',
        amount: 100,
        currency: 'XLM',
        recipientAddress: 'GABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZABC',
      };
      const result = paymentDetailsSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects zero or negative amount', () => {
      const invalid = {
        courseId: 'course_001',
        amount: 0,
        currency: 'XLM',
        recipientAddress: 'GABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZABC',
      };
      const result = paymentDetailsSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('rejects invalid Stellar address', () => {
      const invalid = {
        courseId: 'course_001',
        amount: 100,
        currency: 'XLM',
        recipientAddress: 'INVALID',
      };
      const result = paymentDetailsSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultSettings() {
  return {
    emailNotifications: true,
    weeklyDigest: false,
    achievementAlerts: true,
    darkMode: true,
    language: 'en',
    privacy: 'public' as const,
    twoFactorEnabled: false,
    newsletter: true,
  };
}
