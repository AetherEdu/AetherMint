'use client';

import React, { useState, useEffect } from 'react';
import { EnrollmentFormProps, EnrollmentStep, EnrollmentData } from '@/types/enrollment';
import { env } from '@/lib/env';
import { personalInfoSchema, type PersonalInfo } from '@/lib/validation/schemas';
import FormField from './FormField';
import WalletConnector from './WalletConnector';
import PaymentProcessor from './PaymentProcessor';
import Skeleton from './Skeleton';
import {
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  BookOpen,
  FileCheck,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// ---------------------------------------------------------------------------
// Progress persistence key for sessionStorage (Issue #275)
// ---------------------------------------------------------------------------

const PROGRESS_KEY = 'enrollment-form';

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const EnrollmentForm: React.FC<EnrollmentFormProps> = ({
  course,
  wallet,
  onEnrollmentComplete,
  onEnrollmentError
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transactionHash, setTransactionHash] = useState<string | null>(null);

  const [isInitializing, setIsInitializing] = useState(true);
  const [isTransitioningStep, setIsTransitioningStep] = useState(false);

  // --- Form validation for personal info step ---
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [personalInfo, setPersonalInfo] = useState<PersonalInfo>(() => {
    // Restore persisted progress on mount (Issue #275)
    try {
      const stored = sessionStorage.getItem(`form-progress:${PROGRESS_KEY}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { firstName: parsed.firstName || '', lastName: parsed.lastName || '', email: parsed.email || '', phone: parsed.phone || '' };
      }
    } catch { /* ignore */ }
    return { firstName: '', lastName: '', email: '', phone: '' };
  });

  // Persist progress on every change
  useEffect(() => {
    try {
      sessionStorage.setItem(`form-progress:${PROGRESS_KEY}`, JSON.stringify(personalInfo));
    } catch { /* ignore */ }
  }, [personalInfo]);

  const validateField = (field: keyof PersonalInfo, value: string) => {
    const updated = { ...personalInfo, [field]: value };
    const result = personalInfoSchema.safeParse(updated);
    if (result.success) {
      setFieldErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
      return true;
    }
    const fieldIssue = result.error.issues.find(issue => issue.path[0] === field);
    if (fieldIssue) {
      setFieldErrors(prev => ({ ...prev, [field]: fieldIssue.message }));
    } else {
      setFieldErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    return !fieldIssue;
  };

  const handlePersonalInfoChange = (field: keyof PersonalInfo, value: string) => {
    const updated = { ...personalInfo, [field]: value };
    setPersonalInfo(updated);
    // Real-time inline validation (Issue #275)
    validateField(field, value);
  };

  const isPersonalInfoValid = (): boolean => {
    const result = personalInfoSchema.safeParse(personalInfo);
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const field = String(issue.path[0]);
        if (!errors[field]) errors[field] = issue.message;
      }
      setFieldErrors(errors);
      return false;
    }
    setFieldErrors({});
    return true;
  };

  const steps: EnrollmentStep[] = [
    {
      id: 'personal-info',
      title: 'Personal Information',
      description: 'Provide your contact details',
      component: PersonalInfoStep,
      validation: () => isPersonalInfoValid(),
      isCompleted: false
    },
    {
      id: 'wallet-connection',
      title: 'Connect Wallet',
      description: 'Connect your Stellar wallet for payment',
      component: WalletStep,
      validation: (data: any) => data.wallet && data.wallet.connected,
      isCompleted: false
    },
    {
      id: 'payment',
      title: 'Payment',
      description: 'Complete the course payment',
      component: PaymentStep,
      validation: (data: any) => data.transactionHash && data.wallet,
      isCompleted: false
    },
    {
      id: 'confirmation',
      title: 'Confirmation',
      description: 'Review and confirm your enrollment',
      component: ConfirmationStep,
      validation: () => true,
      isCompleted: false
    }
  ];

  useEffect(() => {
    const timer = setTimeout(() => setIsInitializing(false), 200);
    return () => clearTimeout(timer);
  }, []);

  // --- Error announcement for screen readers (Issue #275) ---
  const errorAnnouncement = Object.entries(fieldErrors)
    .map(([field, msg]) => `${field}: ${msg}`)
    .join('. ') || (error || '');

  const handleNext = () => {
    const currentStepData = steps[currentStep];

    if (currentStepData.validation) {
      let isValid = false;

      switch (currentStepData.id) {
        case 'personal-info':
          isValid = isPersonalInfoValid();
          break;
        case 'wallet-connection':
          isValid = currentStepData.validation({ wallet });
          break;
        case 'payment':
          isValid = !!transactionHash;
          break;
        default:
          isValid = true;
      }

      if (!isValid) {
        setError('Please complete the current step before proceeding');
        return;
      }
    }

    setError(null);

    if (currentStep < steps.length - 1) {
      setIsTransitioningStep(true);
      setTimeout(() => {
        setCurrentStep(currentStep + 1);
        setIsTransitioningStep(false);
      }, 100);
    } else {
      handleSubmit();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setIsTransitioningStep(true);
      setTimeout(() => {
        setCurrentStep(currentStep - 1);
        setError(null);
        setIsTransitioningStep(false);
      }, 100);
    }
  };

  const handlePaymentSuccess = (txHash: string) => {
    setTransactionHash(txHash);
  };

  const handlePaymentError = (errorMessage: string) => {
    setError(errorMessage);
    onEnrollmentError(errorMessage);
  };

  const handlePaymentPending = () => {
    setError(null);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const enrollment: EnrollmentData = {
        studentId: wallet?.publicKey || '',
        courseId: course.id,
        walletAddress: wallet?.publicKey || '',
        paymentDetails: {
          courseId: course.id,
          amount: course.price,
          currency: course.currency,
          recipientAddress: env.NEXT_PUBLIC_STELLAR_RECEIVER_ADDRESS,
          transactionHash: transactionHash || '',
          status: 'completed',
          timestamp: new Date().toISOString()
        },
        enrollmentDate: new Date().toISOString(),
        status: 'confirmed',
        personalInfo
      };

      const response = await fetch('/api/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(enrollment),
      });

      if (!response.ok) throw new Error('Failed to save enrollment');

      const result = await response.json();

      if (result.success) {
        // Clear persisted progress on successful enrollment (Issue #275)
        sessionStorage.removeItem(`form-progress:${PROGRESS_KEY}`);
        onEnrollmentComplete(enrollment);
      } else {
        throw new Error(result.error?.message || 'Enrollment failed');
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to complete enrollment';
      setError(errorMessage);
      onEnrollmentError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const CurrentStepComponent = steps[currentStep].component;

  // --- Initialization skeleton ---
  if (isInitializing) {
    return (
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg" role="region" aria-label="Loading enrollment form" aria-busy="true">
        <nav aria-label="Enrollment progress" className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            {steps.map((_, index) => (
              <div key={index} className="flex items-center flex-1">
                <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse" aria-hidden="true" />
                <div className="ml-3 flex-1 hidden sm:block">
                  <div className="h-3 bg-gray-200 animate-pulse rounded w-20" aria-hidden="true" />
                  <div className="h-2 bg-gray-200 animate-pulse rounded w-16 mt-1" aria-hidden="true" />
                </div>
                {index < steps.length - 1 && (
                  <div className="flex-1 h-px mx-4 bg-gray-200" aria-hidden="true" />
                )}
              </div>
            ))}
          </div>
        </nav>
        <div className="p-6">
          <div className="mb-6">
            <div className="h-7 bg-gray-200 animate-pulse rounded w-48 mb-2" aria-hidden="true" />
            <div className="h-4 bg-gray-200 animate-pulse rounded w-64" aria-hidden="true" />
          </div>
          <Skeleton variant="card" lines={4} aria-label="Loading enrollment form" />
        </div>
        <span className="sr-only" role="status">Loading enrollment form...</span>
      </div>
    );
  }

  // --- Transition skeleton ---
  if (isTransitioningStep) {
    return (
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg" role="region" aria-label="Loading next step" aria-busy="true">
        <nav aria-label="Enrollment progress" className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center flex-1">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                  index < currentStep ? 'bg-green-600 text-white' :
                  index === currentStep ? 'bg-blue-600 text-white' :
                  'bg-gray-200 text-gray-600'
                }`} aria-label={`Step ${index + 1}: ${step.title}`}>
                  {index < currentStep ? <CheckCircle className="w-5 h-5" aria-hidden="true" /> : <span aria-hidden="true">{index + 1}</span>}
                </div>
                <div className="ml-3 hidden sm:block">
                  <p className={`text-sm font-medium ${index <= currentStep ? 'text-gray-900' : 'text-gray-500'}`}>{step.title}</p>
                </div>
                {index < steps.length - 1 && (
                  <div className={`flex-1 h-px mx-4 ${index < currentStep ? 'bg-green-600' : 'bg-gray-200'}`} aria-hidden="true" />
                )}
              </div>
            ))}
          </div>
        </nav>
        <div className="p-6">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" aria-hidden="true" />
              <p className="text-gray-500 animate-pulse" role="status">Loading {steps[currentStep]?.title || 'next step'}...</p>
            </div>
          </div>
        </div>
        <span className="sr-only" role="status">Loading next step, please wait...</span>
      </div>
    );
  }

  return (
    <ErrorBoundary variant="payment" errorTitle="Payment Error" errorMessage="There was a problem processing your payment. Please verify your balance and try again.">
      {/* Accessible error announcements for screen readers (Issue #275) */}
      {errorAnnouncement && (
        <div className="sr-only" aria-live="assertive" aria-atomic="true" role="alert">
          {errorAnnouncement}
        </div>
      )}

      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg w-full" role="form" aria-label="Course enrollment form">
        {/* Progress Steps */}
        <nav aria-label="Enrollment progress" className="px-4 sm:px-6 py-4 border-b border-gray-200 overflow-x-auto scrollbar-hide">
          <div className="flex items-center justify-between min-w-0" role="list">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center flex-shrink-0" role="listitem">
                <div className="flex items-center">
                  <div
                    className={`w-10 h-10 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-sm font-medium ${
                      index < currentStep ? 'bg-green-600 text-white' : index === currentStep ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                    }`}
                    aria-current={index === currentStep ? 'step' : undefined}
                    aria-label={`Step ${index + 1}: ${step.title}${index < currentStep ? ' (completed)' : index === currentStep ? ' (current)' : ''}`}
                  >
                    {index < currentStep ? <CheckCircle className="w-5 h-5" aria-hidden="true" /> : <span aria-hidden="true">{index + 1}</span>}
                  </div>
                  <div className="ml-2 sm:ml-3 hidden sm:block">
                    <p className={`text-xs sm:text-sm font-medium ${index <= currentStep ? 'text-gray-900' : 'text-gray-500'}`}>{step.title}</p>
                    <p className="text-xs text-gray-500 hidden md:block">{step.description}</p>
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <div className={`flex-shrink-0 w-8 sm:w-12 md:w-16 h-px mx-2 sm:mx-4 ${index < currentStep ? 'bg-green-600' : 'bg-gray-200'}`} aria-hidden="true" />
                )}
              </div>
            ))}
          </div>
        </nav>

        {/* Step Content */}
        <div className="p-4 sm:p-6 md:p-8" role="region" aria-label={`Step ${currentStep + 1}: ${steps[currentStep].title}`}>
          <div className="mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">{steps[currentStep].title}</h2>
            <p className="text-sm sm:text-base text-gray-600">{steps[currentStep].description}</p>
          </div>

          <CurrentStepComponent
            course={course}
            wallet={wallet}
            personalInfo={personalInfo}
            fieldErrors={fieldErrors}
            onPersonalInfoChange={handlePersonalInfoChange}
            onPaymentSuccess={handlePaymentSuccess}
            onPaymentError={handlePaymentError}
            onPaymentPending={handlePaymentPending}
            transactionHash={transactionHash}
          />

          {error && (
            <div className="mt-4 flex items-start space-x-2 text-red-600 bg-red-50 p-3 sm:p-4 rounded-lg" role="alert" aria-live="assertive">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
              <span className="text-sm" id="enrollment-error">{error}</span>
            </div>
          )}

          {/* Navigation */}
          <div className="mt-6 flex flex-col xs:flex-row justify-between gap-3">
            <button
              onClick={handlePrevious}
              disabled={currentStep === 0 || isSubmitting}
              className="flex items-center space-x-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Go to previous step"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              <span>Previous</span>
            </button>
            <button
              onClick={handleNext}
              disabled={isSubmitting || isTransitioningStep}
              className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label={isSubmitting ? 'Processing enrollment' : currentStep === steps.length - 1 ? 'Complete enrollment' : 'Go to next step'}
            >
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /><span>Processing...</span></>
              ) : currentStep === steps.length - 1 ? (
                <><FileCheck className="w-4 h-4" aria-hidden="true" /><span>Complete Enrollment</span></>
              ) : (
                <><span>Next</span><ArrowRight className="w-4 h-4" aria-hidden="true" /></>
              )}
            </button>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

// ---------------------------------------------------------------------------
// Step: Personal Information — uses FormField with inline validation (Issue #275)
// ---------------------------------------------------------------------------

const PersonalInfoStep: React.FC<any> = ({ personalInfo, fieldErrors, onPersonalInfoChange }) => {
  return (
    <div className="space-y-4 sm:space-y-5" role="group" aria-label="Personal information">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
        <FormField
          id="firstName"
          label="First Name"
          required
          value={personalInfo.firstName}
          onChange={(e) => onPersonalInfoChange('firstName', (e.target as HTMLInputElement).value)}
          placeholder="Enter your first name"
          error={fieldErrors?.firstName}
          autoComplete="given-name"
        />
        <FormField
          id="lastName"
          label="Last Name"
          required
          value={personalInfo.lastName}
          onChange={(e) => onPersonalInfoChange('lastName', (e.target as HTMLInputElement).value)}
          placeholder="Enter your last name"
          error={fieldErrors?.lastName}
          autoComplete="family-name"
        />
      </div>
      <FormField
        id="email"
        label="Email Address"
        type="email"
        required
        value={personalInfo.email}
        onChange={(e) => onPersonalInfoChange('email', (e.target as HTMLInputElement).value)}
        placeholder="your.email@example.com"
        error={fieldErrors?.email}
        autoComplete="email"
      />
      <FormField
        id="phone"
        label="Phone Number"
        type="tel"
        value={personalInfo.phone}
        onChange={(e) => onPersonalInfoChange('phone', (e.target as HTMLInputElement).value)}
        placeholder="+1 (555) 123-4567"
        hint="Optional"
        error={fieldErrors?.phone}
        autoComplete="tel"
      />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Step: Wallet Connection
// ---------------------------------------------------------------------------

const WalletStep: React.FC<any> = ({ wallet, onWalletConnect, onWalletDisconnect }) => {
  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="bg-blue-50 border border-blue-200 rounded-xl sm:rounded-lg p-4 sm:p-5">
        <div className="flex items-start sm:items-center space-x-2 mb-2">
          <BookOpen className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5 sm:mt-0" />
          <h4 className="font-medium text-blue-900 text-sm sm:text-base">Why connect your wallet?</h4>
        </div>
        <ul className="text-xs sm:text-sm text-blue-800 space-y-1.5 pl-7">
          <li>• Secure payment processing with Stellar blockchain</li>
          <li>• Instant transaction confirmation</li>
          <li>• Decentralized and transparent payment records</li>
        </ul>
      </div>
      <WalletConnector
        onWalletConnect={onWalletConnect}
        onWalletDisconnect={onWalletDisconnect}
        network="testnet"
      />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Step: Payment
// ---------------------------------------------------------------------------

const PaymentStep: React.FC<any> = ({ course, wallet, onPaymentSuccess, onPaymentError, onPaymentPending, transactionHash }) => {
  if (transactionHash) {
    return (
      <div className="text-center py-8 sm:py-12 px-4">
        <CheckCircle className="w-12 h-12 sm:w-16 sm:h-16 text-green-500 mx-auto mb-4" />
        <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">Payment Completed</h3>
        <p className="text-sm sm:text-base text-gray-600">Your payment has been successfully processed.</p>
      </div>
    );
  }

  return (
    <PaymentProcessor
      course={course}
      wallet={wallet}
      onPaymentSuccess={onPaymentSuccess}
      onPaymentError={onPaymentError}
      onPaymentPending={onPaymentPending}
    />
  );
};

// ---------------------------------------------------------------------------
// Step: Confirmation
// ---------------------------------------------------------------------------

const ConfirmationStep: React.FC<any> = ({ course, personalInfo, transactionHash }) => {
  return (
    <div className="space-y-6">
      <div className="bg-green-50 border border-green-200 rounded-xl sm:rounded-lg p-4 sm:p-6">
        <h4 className="font-medium text-green-900 mb-3 text-sm sm:text-base">Enrollment Summary</h4>
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 text-sm sm:text-base">
            <div>
              <span className="text-gray-600">Student Name:</span>
              <p className="font-medium">{personalInfo.firstName} {personalInfo.lastName}</p>
            </div>
            <div>
              <span className="text-gray-600">Email:</span>
              <p className="font-medium break-all">{personalInfo.email}</p>
            </div>
            <div>
              <span className="text-gray-600">Course:</span>
              <p className="font-medium">{course.title}</p>
            </div>
            <div>
              <span className="text-gray-600">Instructor:</span>
              <p className="font-medium">{course.instructor}</p>
            </div>
            <div>
              <span className="text-gray-600">Amount Paid:</span>
              <p className="font-medium">{course.price} {course.currency}</p>
            </div>
            <div>
              <span className="text-gray-600">Transaction:</span>
              <p className="font-mono text-xs break-all">{transactionHash?.slice(0, 20)}...</p>
            </div>
          </div>
        </div>
      </div>
      <div className="text-center px-4">
        <CheckCircle className="w-10 h-10 sm:w-12 sm:h-12 text-green-500 mx-auto mb-3" />
        <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">Ready to Enroll!</h3>
        <p className="text-sm sm:text-base text-gray-600">
          Please review your information above and click &quot;Complete Enrollment&quot; to finalize your registration.
        </p>
      </div>
    </div>
  );
};

export default EnrollmentForm;
