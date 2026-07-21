import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { Button } from '../components/ui/button';

// ─── Form Input Component ────────────────────────────────────────────────────

interface InputProps {
  id: string;
  label: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  hint?: string;
  autoComplete?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

function FormInput({
  id,
  label,
  type = 'text',
  placeholder,
  required = false,
  disabled = false,
  error,
  hint,
  autoComplete,
  value,
  onChange,
}: InputProps) {
  const errorId = error ? `${id}-error` : undefined;
  const hintId = hint ? `${id}-hint` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="space-y-1">
      <label
        htmlFor={id}
        className="block text-sm sm:text-base font-medium text-gray-700 dark:text-gray-300"
      >
        {label}
        {required && (
          <span aria-hidden="true" className="text-red-500 ml-0.5">
            *
          </span>
        )}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        autoComplete={autoComplete}
        aria-describedby={describedBy}
        aria-invalid={error ? 'true' : undefined}
        aria-required={required ? 'true' : undefined}
        className={`w-full px-4 py-3 sm:py-2.5 text-base border rounded-xl sm:rounded-lg transition-colors
          focus:ring-2 focus:ring-blue-500 focus:border-blue-500
          disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50 dark:disabled:bg-gray-800
          ${
            error
              ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
              : 'border-gray-300 dark:border-gray-600'
          }
          dark:bg-gray-800 dark:text-white`}
      />
      {hint && !error && (
        <p id={hintId} className="text-xs text-gray-500 dark:text-gray-400">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// ─── Form Select Component ───────────────────────────────────────────────────

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  id: string;
  label: string;
  options: SelectOption[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  hint?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}

function FormSelect({
  id,
  label,
  options,
  placeholder,
  required = false,
  disabled = false,
  error,
  hint,
  value,
  onChange,
}: SelectProps) {
  const errorId = error ? `${id}-error` : undefined;
  const hintId = hint ? `${id}-hint` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="space-y-1">
      <label
        htmlFor={id}
        className="block text-sm sm:text-base font-medium text-gray-700 dark:text-gray-300"
      >
        {label}
        {required && (
          <span aria-hidden="true" className="text-red-500 ml-0.5">
            *
          </span>
        )}
      </label>
      <select
        id={id}
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
        aria-describedby={describedBy}
        aria-invalid={error ? 'true' : undefined}
        aria-required={required ? 'true' : undefined}
        className={`w-full px-4 py-3 sm:py-2.5 text-base border rounded-xl sm:rounded-lg bg-white dark:bg-gray-800
          transition-colors focus:ring-2 focus:ring-blue-500 focus:border-blue-500
          disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50 dark:disabled:bg-gray-800
          ${
            error
              ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
              : 'border-gray-300 dark:border-gray-600'
          }
          dark:text-white`}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint && !error && (
        <p id={hintId} className="text-xs text-gray-500 dark:text-gray-400">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// ─── Form Checkbox Component ─────────────────────────────────────────────────

interface CheckboxProps {
  id: string;
  label: string;
  description?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  checked?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

function FormCheckbox({
  id,
  label,
  description,
  required = false,
  disabled = false,
  error,
  checked,
  onChange,
}: CheckboxProps) {
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [description ? `${id}-description` : undefined, errorId]
    .filter(Boolean)
    .join(' ') || undefined;

  return (
    <div className="space-y-1">
      <div className="flex items-start gap-3">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={onChange}
          required={required}
          disabled={disabled}
          aria-describedby={describedBy}
          aria-invalid={error ? 'true' : undefined}
          aria-required={required ? 'true' : undefined}
          className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600
            focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
            disabled:opacity-50 disabled:cursor-not-allowed
            dark:border-gray-600 dark:bg-gray-800"
        />
        <div className="min-w-0">
          <label
            htmlFor={id}
            className={`text-sm font-medium ${
              disabled ? 'text-gray-400' : 'text-gray-700 dark:text-gray-300'
            }`}
          >
            {label}
            {required && (
              <span aria-hidden="true" className="text-red-500 ml-0.5">
                *
              </span>
            )}
          </label>
          {description && (
            <p id={`${id}-description`} className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {description}
            </p>
          )}
        </div>
      </div>
      {error && (
        <p id={errorId} className="text-xs text-red-600 dark:text-red-400 pl-7" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// ─── Meta ────────────────────────────────────────────────────────────────────

const meta: Meta = {
  title: 'Form Components',
  tags: ['autodocs'],
};

export default meta;

// ─── Input Stories ───────────────────────────────────────────────────────────

export const TextInput: StoryObj = {
  name: 'Input — Default',
  render: () => (
    <div className="max-w-md space-y-6 p-4">
      <FormInput
        id="firstName"
        label="First Name"
        placeholder="Enter your first name"
        required
      />
      <FormInput
        id="email"
        label="Email Address"
        type="email"
        placeholder="your.email@example.com"
        required
        autoComplete="email"
      />
      <FormInput
        id="phone"
        label="Phone Number"
        type="tel"
        placeholder="+1 (555) 123-4567"
        hint="Optional — used for course notifications"
        autoComplete="tel"
      />
    </div>
  ),
};

export const TextInputStates: StoryObj = {
  name: 'Input — States',
  render: function Render() {
    const [value, setValue] = React.useState('jane.doe@example.com');
    return (
      <div className="max-w-md space-y-6 p-4">
        <FormInput id="default" label="Default Input" placeholder="Type something..." />
        <FormInput
          id="withValue"
          label="With Value"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <FormInput id="disabled" label="Disabled Input" placeholder="Cannot edit" disabled />
        <FormInput
          id="withError"
          label="With Error"
          defaultValue="invalid-email"
          error="Please enter a valid email address."
        />
        <FormInput
          id="withHint"
          label="With Hint"
          placeholder="Enter your name"
          hint="We'll use this on your certificates."
        />
      </div>
    );
  },
};

// ─── Select Stories ──────────────────────────────────────────────────────────

export const SelectInput: StoryObj = {
  name: 'Select — Default',
  render: () => (
    <div className="max-w-md space-y-6 p-4">
      <FormSelect
        id="difficulty"
        label="Course Level"
        options={[
          { value: 'beginner', label: 'Beginner' },
          { value: 'intermediate', label: 'Intermediate' },
          { value: 'advanced', label: 'Advanced' },
          { value: 'expert', label: 'Expert' },
        ]}
        placeholder="Select difficulty level"
        required
      />
      <FormSelect
        id="category"
        label="Course Category"
        options={[
          { value: 'blockchain', label: 'Blockchain' },
          { value: 'smart-contracts', label: 'Smart Contracts' },
          { value: 'defi', label: 'DeFi' },
          { value: 'cryptography', label: 'Cryptography' },
        ]}
        hint="Choose the primary category for your course"
      />
    </div>
  ),
};

export const SelectStates: StoryObj = {
  name: 'Select — States',
  render: () => (
    <div className="max-w-md space-y-6 p-4">
      <FormSelect
        id="default"
        label="Default Select"
        options={[
          { value: 'option1', label: 'Option 1' },
          { value: 'option2', label: 'Option 2' },
          { value: 'option3', label: 'Option 3' },
        ]}
        placeholder="Choose an option"
      />
      <FormSelect
        id="withValue"
        label="With Value"
        options={[
          { value: 'option1', label: 'Option 1' },
          { value: 'option2', label: 'Option 2' },
        ]}
        value="option2"
        onChange={() => {}}
      />
      <FormSelect
        id="disabled"
        label="Disabled Select"
        options={[{ value: 'locked', label: 'Locked' }]}
        disabled
      />
      <FormSelect
        id="withError"
        label="With Error"
        options={[
          { value: '', label: '—' },
          { value: 'valid', label: 'Valid Option' },
        ]}
        error="Please select a valid option."
      />
    </div>
  ),
};

// ─── Checkbox Stories ────────────────────────────────────────────────────────

export const CheckboxInput: StoryObj = {
  name: 'Checkbox — Default',
  render: () => (
    <div className="max-w-md space-y-6 p-4">
      <FormCheckbox
        id="terms"
        label="I accept the terms and conditions"
        description="By enrolling, you agree to the platform's terms of service."
        required
      />
      <FormCheckbox
        id="newsletter"
        label="Send me updates about new courses"
        description="We'll email you once a month. You can unsubscribe anytime."
      />
      <FormCheckbox
        id="publicProfile"
        label="Make my learning profile public"
        description="Other students can see your achievements and course progress."
        checked
        onChange={() => {}}
      />
    </div>
  ),
};

export const CheckboxStates: StoryObj = {
  name: 'Checkbox — States',
  render: () => (
    <div className="max-w-md space-y-6 p-4">
      <FormCheckbox id="unchecked" label="Unchecked" />
      <FormCheckbox id="checked" label="Checked" checked onChange={() => {}} />
      <FormCheckbox
        id="disabled"
        label="Disabled"
        description="This option is not available"
        disabled
      />
      <FormCheckbox
        id="disabledChecked"
        label="Disabled & Checked"
        description="This setting is locked"
        disabled
        checked
        onChange={() => {}}
      />
      <FormCheckbox
        id="withError"
        label="I agree to the terms"
        error="You must accept the terms to continue."
      />
    </div>
  ),
};

// ─── Complete Form Example ───────────────────────────────────────────────────

export const CompleteFormExample: StoryObj = {
  name: 'Complete Form Example',
  render: () => (
    <div className="max-w-lg mx-auto bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-6 shadow-sm">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">Course Enrollment</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormInput id="firstName" label="First Name" placeholder="First name" required />
        <FormInput id="lastName" label="Last Name" placeholder="Last name" required />
      </div>

      <FormInput
        id="emailAddress"
        label="Email Address"
        type="email"
        placeholder="your.email@example.com"
        required
        autoComplete="email"
      />

      <FormSelect
        id="courseLevel"
        label="Preferred Course Level"
        options={[
          { value: 'beginner', label: 'Beginner' },
          { value: 'intermediate', label: 'Intermediate' },
          { value: 'advanced', label: 'Advanced' },
        ]}
        placeholder="Select level"
        required
      />

      <FormCheckbox
        id="acceptTerms"
        label="I agree to the terms and conditions"
        description="Read our Terms of Service and Privacy Policy."
        required
      />
      <FormCheckbox
        id="emailUpdates"
        label="Send me course recommendations"
        description="Based on my interests and learning history."
      />

      <div className="flex gap-3 pt-2">
        <Button variant="default">Submit Enrollment</Button>
        <Button variant="outline">Cancel</Button>
      </div>
    </div>
  ),
};
