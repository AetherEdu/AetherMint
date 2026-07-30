/**
 * FormField — Issue #275.
 *
 * A reusable form field wrapper that provides:
 *   - Consistent visual styling across all forms
 *   - Inline real-time validation error display
 *   - Accessible error announcements via aria-describedby
 *   - Proper label/input association
 *   - Support for text, email, tel, url, textarea, and select inputs
 */

'use client';

import React, { forwardRef } from 'react';
import { AlertCircle } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** The label text displayed above the input. */
  label: string;
  /** Error message to display below the input. */
  error?: string;
  /** Hint text displayed below the label but above the input. */
  hint?: string;
  /** Whether the field is required (adds visual indicator). */
  required?: boolean;
  /** The element to render: 'input', 'textarea', or 'select'. */
  as?: 'input' | 'textarea' | 'select';
  /** For textarea: number of visible rows. */
  rows?: number;
  /** For select: option elements. */
  children?: React.ReactNode;
  /** Additional class names for the container. */
  containerClassName?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const FormField = forwardRef<
  HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  FormFieldProps
>(
  (
    {
      label,
      error,
      hint,
      required = false,
      as = 'input',
      rows,
      children,
      containerClassName = '',
      className = '',
      id,
      ...props
    },
    ref,
  ) => {
    const fieldId = id ?? `field-${label.toLowerCase().replace(/\s+/g, '-')}`;
    const errorId = `${fieldId}-error`;
    const hintId = `${fieldId}-hint`;

    const describedBy = [
      error ? errorId : null,
      hint ? hintId : null,
    ]
      .filter(Boolean)
      .join(' ') || undefined;

    const baseInputClasses =
      'w-full px-4 py-3 sm:py-2.5 text-base border rounded-xl sm:rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white transition-colors duration-150 ' +
      'focus:outline-none focus:ring-2 focus:ring-offset-0 ' +
      (error
        ? 'border-red-400 dark:border-red-500 focus:ring-red-500 focus:border-red-500'
        : 'border-gray-300 dark:border-slate-600 focus:ring-blue-500 focus:border-blue-500');

    const Component = as;

    return (
      <div className={`space-y-1.5 ${containerClassName}`}>
        {/* Label */}
        <label
          htmlFor={fieldId}
          className="block text-sm sm:text-base font-medium text-gray-700 dark:text-gray-300"
        >
          {label}
          {required && (
            <span className="text-red-500 ml-0.5" aria-hidden="true">
              *
            </span>
          )}
        </label>

        {/* Hint */}
        {hint && !error && (
          <p id={hintId} className="text-xs text-gray-500 dark:text-gray-400">
            {hint}
          </p>
        )}

        {/* Input / Textarea / Select */}
        {Component === 'textarea' ? (
          <textarea
            ref={ref as React.Ref<HTMLTextAreaElement>}
            id={fieldId}
            rows={rows ?? 3}
            className={`${baseInputClasses} resize-none ${className}`}
            aria-describedby={describedBy}
            aria-invalid={!!error}
            aria-required={required}
            {...(props as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
          />
        ) : Component === 'select' ? (
          <select
            ref={ref as React.Ref<HTMLSelectElement>}
            id={fieldId}
            className={`${baseInputClasses} ${className}`}
            aria-describedby={describedBy}
            aria-invalid={!!error}
            aria-required={required}
            {...(props as React.SelectHTMLAttributes<HTMLSelectElement>)}
          >
            {children}
          </select>
        ) : (
          <input
            ref={ref as React.Ref<HTMLInputElement>}
            id={fieldId}
            className={`${baseInputClasses} ${className}`}
            aria-describedby={describedBy}
            aria-invalid={!!error}
            aria-required={required}
            {...props}
          />
        )}

        {/* Error message with aria-live */}
        {error && (
          <div
            id={errorId}
            role="alert"
            aria-live="assertive"
            className="flex items-start gap-1.5 mt-1 text-sm text-red-600 dark:text-red-400"
          >
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}
      </div>
    );
  },
);

FormField.displayName = 'FormField';

export default FormField;
