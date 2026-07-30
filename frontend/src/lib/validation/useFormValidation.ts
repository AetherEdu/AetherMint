/**
 * useFormValidation — Issue #275.
 *
 * A reusable hook that bridges Zod schemas with react-hook-form,
 * providing:
 *   - Real-time inline validation feedback as the user types
 *   - Accessible error announcements via aria-live regions
 *   - Consistent error message patterns
 *   - Form progress preservation in sessionStorage
 */

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useForm,
  UseFormProps,
  FieldValues,
  UseFormReturn,
  ValidationMode,
  Resolver,
  FieldErrors,
} from 'react-hook-form';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseFormValidationOptions<T extends FieldValues> {
  /** The Zod schema that defines validation rules. */
  schema: z.ZodSchema<T>;
  /** Default values for the form fields. */
  defaultValues?: UseFormProps<T>['defaultValues'];
  /** Key used for persisting form progress in sessionStorage. If omitted, no persistence. */
  persistenceKey?: string;
  /** When to trigger validation: 'onChange' (real-time), 'onBlur', 'onSubmit', or 'all'. */
  mode?: keyof ValidationMode | 'all';
  /** Callback invoked with the validated data on successful submission. */
  onSubmit: (data: T) => Promise<void> | void;
}

export interface UseFormValidationReturn<T extends FieldValues>
  extends Omit<UseFormReturn<T>, 'handleSubmit'> {
  /** An id for the aria-live region that announces errors to screen readers. */
  errorAnnouncementId: string;
  /** A concatenated error message for the aria-live region. */
  errorAnnouncement: string;
  /** Resets the form to its original default values and clears persisted state. */
  resetForm: () => void;
  /** Whether there is persisted form data available to restore. */
  hasPersistedData: boolean;
  /**
   * An augmented handleSubmit that:
   *  1. Runs Zod validation
   *  2. Calls the user's onSubmit callback
   *  3. Clears persisted progress on success
   * Usage: <form onSubmit={handleSubmit}> — do NOT pass a callback.
   */
  handleSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Zod → react-hook-form Resolver
// ---------------------------------------------------------------------------

/**
 * Converts a Zod schema into a react-hook-form Resolver.
 * Does not require @hookform/resolvers/zod.
 */
const zodResolver =
  <T extends FieldValues>(schema: z.ZodSchema<T>): Resolver<T> =>
  async (values) => {
    const result = schema.safeParse(values);
    if (result.success) {
      return { values: result.data, errors: {} as FieldErrors<T> };
    }
    const fieldErrors: Record<string, { type: string; message: string }> = {};
    for (const issue of result.error.issues) {
      const field = issue.path.join('.');
      if (!fieldErrors[field]) {
        fieldErrors[field] = { type: issue.code, message: issue.message };
      }
    }
    // Cast is safe: react-hook-form accepts this shape at runtime
    return { values: {} as T, errors: fieldErrors as unknown as FieldErrors<T> };
  };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Read persisted form data from sessionStorage, returning undefined on failure.
 */
const loadPersistedData = <T,>(key: string): T | undefined => {
  try {
    const stored = sessionStorage.getItem(`form-progress:${key}`);
    if (stored) return JSON.parse(stored) as T;
  } catch {
    // Ignore corrupt data
  }
  return undefined;
};

/**
 * Save form data to sessionStorage.
 */
const savePersistedData = <T,>(key: string, data: T): void => {
  try {
    sessionStorage.setItem(`form-progress:${key}`, JSON.stringify(data));
  } catch {
    // Ignore storage errors
  }
};

/**
 * Remove persisted form data from sessionStorage.
 */
const clearPersistedData = (key: string): void => {
  try {
    sessionStorage.removeItem(`form-progress:${key}`);
  } catch {
    // Ignore
  }
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useFormValidation<T extends FieldValues>({
  schema,
  defaultValues,
  persistenceKey,
  mode = 'onChange',
  onSubmit,
}: UseFormValidationOptions<T>): UseFormValidationReturn<T> {
  // Load persisted data on the very first render (state initializer)
  const [persistedDefaults] = useState<T | undefined>(() =>
    persistenceKey ? loadPersistedData<T>(persistenceKey) : undefined,
  );

  const effectiveDefaults =
    (persistedDefaults as UseFormProps<T>['defaultValues']) ?? defaultValues;

  const form = useForm<T>({
    resolver: useMemo(() => zodResolver(schema), [schema]),
    defaultValues: effectiveDefaults,
    mode: mode === 'all' ? 'all' : mode,
    criteriaMode: 'all',
  });

  const {
    formState: { errors, isDirty },
    watch,
    reset,
  } = form;

  // Persist form progress on every change
  const watchedValues = watch();

  useEffect(() => {
    if (!persistenceKey || !isDirty) return;
    savePersistedData(persistenceKey, watchedValues);
  }, [persistenceKey, watchedValues, isDirty]);

  // --- Aria-live error announcements ---
  const errorAnnouncementId = `form-errors-${persistenceKey ?? 'anonymous'}`;

  const errorAnnouncement = Object.entries(errors)
    .map(([field, error]) => {
      const message =
        error && typeof error === 'object' && 'message' in error
          ? (error as { message?: string }).message
          : undefined;
      return message ? `${field}: ${message}` : '';
    })
    .filter(Boolean)
    .join('. ');

  // --- Handlers ---
  const resetForm = useCallback(() => {
    reset(defaultValues);
    if (persistenceKey) clearPersistedData(persistenceKey);
  }, [reset, defaultValues, persistenceKey]);

  const hasPersistedData = !!persistedDefaults;

  // --- Augmented handleSubmit ---
  // This wraps form.handleSubmit so callers use <form onSubmit={handleSubmit}>
  // without needing to pass a separate callback.
  const augmentedHandleSubmit = useCallback(
    (e?: React.BaseSyntheticEvent) =>
      form.handleSubmit(async (data: T) => {
        await onSubmit(data);
        if (persistenceKey) clearPersistedData(persistenceKey);
      })(e),
    [form, onSubmit, persistenceKey],
  );

  return {
    ...form,
    handleSubmit: augmentedHandleSubmit,
    errorAnnouncementId,
    errorAnnouncement,
    resetForm,
    hasPersistedData,
  };
}

export default useFormValidation;
