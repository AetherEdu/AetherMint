'use client';

import React, { useState, useEffect } from 'react';
import { EnrollmentFormProps, EnrollmentStep, EnrollmentData, WalletInfo, TransactionReceipt } from '@/types/enrollment';
import WalletConnector from './WalletConnector';
import PaymentProcessor from './PaymentProcessor';
import { 
  User, 
  CreditCard, 
  CheckCircle, 
  ArrowRight, 
  ArrowLeft,
  BookOpen,
  FileCheck,
  AlertCircle,
  Loader2
} from 'lucide-react';

const EnrollmentForm: React.FC<EnrollmentFormProps> = ({
  course,
  wallet,
  onEnrollmentComplete,
  onEnrollmentError
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [enrollmentData, setEnrollmentData] = useState<Partial<EnrollmentData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transactionHash, setTransactionHash] = useState<string | null>(null);

  const [personalInfo, setPersonalInfo] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: ''
  });

  const steps: EnrollmentStep[] = [
    {
      id: 'personal-info',
      title: 'Personal Information',
      description: 'Provide your contact details',
      component: PersonalInfoStep,
      validation: (data) => {
        const info = data.personalInfo;
        return info.firstName && info.lastName && info.email && 
               info.email.includes('@') && info.email.includes('.');
      },
      isCompleted: false
    },
    {
      id: 'wallet-connection',
      title: 'Connect Wallet',
      description: 'Connect your Stellar wallet for payment',
      component: WalletStep,
      validation: (data) => data.wallet && data.wallet.connected,
      isCompleted: false
    },
    {
      id: 'payment',
      title: 'Payment',
      description: 'Complete the course payment',
      component: PaymentStep,
      validation: (data) => data.transactionHash && data.wallet,
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
    // Update steps completion status
    const updatedSteps = steps.map((step, index) => {
      let isCompleted = false;
      
      switch (step.id) {
        case 'personal-info':
          isCompleted = step.validation({ personalInfo });
          break;
        case 'wallet-connection':
          isCompleted = step.validation({ wallet });
          break;
        case 'payment':
          isCompleted = !!transactionHash;
          break;
        case 'confirmation':
          isCompleted = index < currentStep;
          break;
      }
      
      return { ...step, isCompleted };
    });
    
    // Update the steps state if needed
  }, [personalInfo, wallet, transactionHash, currentStep]);

  const handleNext = () => {
    const currentStepData = steps[currentStep];
    
    if (currentStepData.validation) {
      let isValid = false;
      
      switch (currentStepData.id) {
        case 'personal-info':
          isValid = currentStepData.validation({ personalInfo });
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
      setCurrentStep(currentStep + 1);
    } else {
      handleSubmit();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      setError(null);
    }
  };

  const handlePaymentSuccess = (txHash: string) => {
    setTransactionHash(txHash);
    setEnrollmentData(prev => ({
      ...prev,
      paymentDetails: {
        courseId: course.id,
        amount: course.price,
        currency: course.currency,
        recipientAddress: process.env.NEXT_PUBLIC_STELLAR_RECEIVER_ADDRESS || '',
        transactionHash: txHash,
        status: 'completed',
        timestamp: new Date().toISOString()
      }
    }));
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
          recipientAddress: process.env.NEXT_PUBLIC_STELLAR_RECEIVER_ADDRESS || '',
          transactionHash: transactionHash || '',
          status: 'completed',
          timestamp: new Date().toISOString()
        },
        enrollmentDate: new Date().toISOString(),
        status: 'confirmed',
        personalInfo
      };

      // Call API to save enrollment
      const response = await fetch('/api/enroll', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(enrollment),
      });

      if (!response.ok) {
        throw new Error('Failed to save enrollment');
      }

      const result = await response.json();
      
      if (result.success) {
        onEnrollmentComplete(enrollment);
      } else {
        throw new Error(result.error?.message || 'Enrollment failed');
      }

    } catch (error: any) {
      console.error('Enrollment submission error:', error);
      const errorMessage = error.message || 'Failed to complete enrollment';
      setError(errorMessage);
      onEnrollmentError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const CurrentStepComponent = steps[currentStep].component;

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg">
      {/* Progress Steps */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex items-center">
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium
                  ${index < currentStep ? 'bg-green-600 text-white' : 
                    index === currentStep ? 'bg-blue-600 text-white' : 
                    'bg-gray-200 text-gray-600'}
                `}>
                  {index < currentStep ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    index + 1
                  )}
                </div>
                <div className="ml-3 hidden sm:block">
                  <p className={`text-sm font-medium ${
                    index <= currentStep ? 'text-gray-900' : 'text-gray-500'
                  }`}>
                    {step.title}
                  </p>
                  <p className="text-xs text-gray-500">{step.description}</p>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-px mx-4 ${
                  index < currentStep ? 'bg-green-600' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {steps[currentStep].title}
          </h2>
          <p className="text-gray-600">{steps[currentStep].description}</p>
        </div>

        <CurrentStepComponent
          course={course}
          wallet={wallet}
          personalInfo={personalInfo}
          onPersonalInfoChange={setPersonalInfo}
          onPaymentSuccess={handlePaymentSuccess}
          onPaymentError={handlePaymentError}
          onPaymentPending={handlePaymentPending}
          transactionHash={transactionHash}
        />

        {error && (
          <div className="mt-4 flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-lg">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="mt-6 flex justify-between">
          <button
            onClick={handlePrevious}
            disabled={currentStep === 0}
            className="flex items-center space-x-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>

          <button
            onClick={handleNext}
            disabled={isSubmitting}
            className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing...</span>
              </>
            ) : currentStep === steps.length - 1 ? (
              <>
                <FileCheck className="w-4 h-4" />
                <span>Complete Enrollment</span>
              </>
            ) : (
              <>
                <span>Next</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// Step Components
const PersonalInfoStep: React.FC<any> = ({ personalInfo, onPersonalInfoChange }) => {
  const handleChange = (field: string, value: string) => {
    onPersonalInfoChange(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            First Name *
          </label>
          <input
            type="text"
            value={personalInfo.firstName}
            onChange={(e) => handleChange('firstName', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter your first name"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Last Name *
          </label>
          <input
            type="text"
            value={personalInfo.lastName}
            onChange={(e) => handleChange('lastName', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter your last name"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Email Address *
        </label>
        <input
          type="email"
          value={personalInfo.email}
          onChange={(e) => handleChange('email', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="your.email@example.com"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Phone Number (Optional)
        </label>
        <input
          type="tel"
          value={personalInfo.phone}
          onChange={(e) => handleChange('phone', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="+1 (555) 123-4567"
        />
      </div>
    </div>
  );
};

const WalletStep: React.FC<any> = ({ course, wallet, onWalletConnect, onWalletDisconnect }) => {
  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center space-x-2 mb-2">
          <BookOpen className="w-5 h-5 text-blue-600" />
          <h4 className="font-medium text-blue-900">Why connect your wallet?</h4>
        </div>
        <ul className="text-sm text-blue-800 space-y-1">
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

const PaymentStep: React.FC<any> = ({ course, wallet, onPaymentSuccess, onPaymentError, onPaymentPending, transactionHash }) => {
  if (transactionHash) {
    return (
      <div className="text-center py-8">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Payment Completed</h3>
        <p className="text-gray-600">Your payment has been successfully processed.</p>
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

const ConfirmationStep: React.FC<any> = ({ course, wallet, personalInfo, transactionHash }) => {
  return (
    <div className="space-y-6">
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h4 className="font-medium text-green-900 mb-3">Enrollment Summary</h4>
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Student Name:</span>
              <p className="font-medium">{personalInfo.firstName} {personalInfo.lastName}</p>
            </div>
            <div>
              <span className="text-gray-600">Email:</span>
              <p className="font-medium">{personalInfo.email}</p>
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
              <p className="font-mono text-xs">{transactionHash?.slice(0, 20)}...</p>
            </div>
          </div>
        </div>
      </div>

      <div className="text-center">
        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Ready to Enroll!</h3>
        <p className="text-gray-600">
          Please review your information above and click "Complete Enrollment" to finalize your registration.
        </p>
      </div>
    </div>
  );
};

export default EnrollmentForm;
