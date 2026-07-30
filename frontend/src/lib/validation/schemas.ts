/**
 * Zod Validation Schemas — Issue #275.
 *
 * Centralised Zod schemas for all user-input forms in the application.
 * These schemas provide both runtime validation and TypeScript type inference
 * through Zod's `z.infer` utility.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared / reusable schemas
// ---------------------------------------------------------------------------

/** Simple non-empty string trimmed of whitespace. */
const requiredString = (fieldName: string) =>
  z.string().trim().min(1, `${fieldName} is required`);

/** Email address pattern (reasonably permissive). */
const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .email('Please enter a valid email address');

/** Phone number: optional, but if provided must match a loose international pattern. */
const phoneSchema = z
  .string()
  .trim()
  .regex(/^[+]?[\d\s().-]{7,20}$/, 'Please enter a valid phone number')
  .optional()
  .or(z.literal(''));

/** URL: optional, but if provided must start with http(s). */
const urlSchema = z
  .string()
  .trim()
  .url('Please enter a valid URL (e.g. https://example.com)')
  .optional()
  .or(z.literal(''));

// ---------------------------------------------------------------------------
// Personal Information (Enrollment step 1)
// ---------------------------------------------------------------------------

export const personalInfoSchema = z.object({
  firstName: requiredString('First name')
    .min(2, 'First name must be at least 2 characters')
    .max(50, 'First name cannot exceed 50 characters'),
  lastName: requiredString('Last name')
    .min(2, 'Last name must be at least 2 characters')
    .max(50, 'Last name cannot exceed 50 characters'),
  email: emailSchema,
  phone: phoneSchema,
});

export type PersonalInfo = z.infer<typeof personalInfoSchema>;

// ---------------------------------------------------------------------------
// Profile Editor
// ---------------------------------------------------------------------------

export const profileFormSchema = z.object({
  name: requiredString('Name')
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name cannot exceed 50 characters'),
  email: emailSchema,
  bio: z
    .string()
    .trim()
    .max(500, 'Bio cannot exceed 500 characters')
    .optional()
    .or(z.literal('')),
  location: z
    .string()
    .trim()
    .max(100, 'Location cannot exceed 100 characters')
    .optional()
    .or(z.literal('')),
  website: urlSchema,
  privacy: z.enum(['public', 'private', 'friends-only'], {
    required_error: 'Please select a privacy setting',
  }),
});

export type ProfileFormData = z.infer<typeof profileFormSchema>;

// ---------------------------------------------------------------------------
// Course Enrollment (full submission payload)
// ---------------------------------------------------------------------------

export const enrollmentDataSchema = z.object({
  studentId: requiredString('Student ID'),
  courseId: requiredString('Course ID'),
  walletAddress: requiredString('Wallet address')
    .min(56, 'Must be a valid Stellar public key')
    .max(56, 'Must be a valid Stellar public key'),
  personalInfo: personalInfoSchema,
  transactionHash: z.string().min(1, 'Transaction hash is required'),
});

export type EnrollmentDataValidated = z.infer<typeof enrollmentDataSchema>;

// ---------------------------------------------------------------------------
// Notification Preferences
// ---------------------------------------------------------------------------

export const notificationPreferencesSchema = z.object({
  course: z.object({
    enabled: z.boolean(),
    sound: z.boolean(),
    desktop: z.boolean(),
  }),
  message: z.object({
    enabled: z.boolean(),
    sound: z.boolean(),
    desktop: z.boolean(),
  }),
  system: z.object({
    enabled: z.boolean(),
    sound: z.boolean(),
    desktop: z.boolean(),
  }),
  achievement: z.object({
    enabled: z.boolean(),
    sound: z.boolean(),
    desktop: z.boolean(),
  }),
  quietHours: z.object({
    enabled: z.boolean(),
    start: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format (HH:MM)'),
    end: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format (HH:MM)'),
  }),
});

export type NotificationPreferencesValidated = z.infer<typeof notificationPreferencesSchema>;

// ---------------------------------------------------------------------------
// Settings Panel
// ---------------------------------------------------------------------------

export const settingsSchema = z.object({
  emailNotifications: z.boolean(),
  weeklyDigest: z.boolean(),
  achievementAlerts: z.boolean(),
  darkMode: z.boolean(),
  language: z.enum(['en', 'es', 'fr', 'de', 'ja'], {
    required_error: 'Please select a language',
  }),
  privacy: z.enum(['public', 'private', 'friends-only'], {
    required_error: 'Please select a privacy level',
  }),
  twoFactorEnabled: z.boolean(),
  newsletter: z.boolean(),
});

export type SettingsValidated = z.infer<typeof settingsSchema>;

// ---------------------------------------------------------------------------
// Payment Details
// ---------------------------------------------------------------------------

export const paymentDetailsSchema = z.object({
  courseId: requiredString('Course ID'),
  amount: z.number().positive('Amount must be greater than 0'),
  currency: requiredString('Currency'),
  recipientAddress: requiredString('Recipient address')
    .min(56, 'Must be a valid Stellar public key')
    .max(56, 'Must be a valid Stellar public key'),
});

export type PaymentDetailsValidated = z.infer<typeof paymentDetailsSchema>;

// ---------------------------------------------------------------------------
// Helper: create a partial schema for step-by-step forms
// ---------------------------------------------------------------------------

/**
 * Creates a "partial" version of a Zod object schema where every field is
 * optional. Useful for multi-step forms where not all fields are filled at once.
 */
export const partialSchema = <T extends z.ZodRawShape>(schema: z.ZodObject<T>) =>
  schema.partial();

// ---------------------------------------------------------------------------
// Helper: derive TypeScript type from any schema
// ---------------------------------------------------------------------------

export type InferSchema<T extends z.ZodTypeAny> = z.infer<T>;
