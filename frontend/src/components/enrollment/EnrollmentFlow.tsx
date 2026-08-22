/**
 * Enrollment Flow Component
 * Handles the complete course enrollment process
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Users, 
  CreditCard, 
  BookOpen,
  ArrowRight,
  ArrowLeft,
  Loader2
} from 'lucide-react';

interface Course {
  id: string;
  title: string;
  description: string;
  price: number;
  originalPrice?: number;
  thumbnail: string;
  instructor: {
    name: string;
    rating: number;
  };
  metadata: {
    level: string;
    duration: number;
    maxStudents: number;
    isPublished: boolean;
  };
  enrollmentCount: number;
  rating: number;
  prerequisites: string[];
}

interface EnrollmentStep {
  id: string;
  title: string;
  description: string;
  component: React.ComponentType<any>;
  isValid?: () => boolean;
  canSkip?: boolean;
}

interface EnrollmentFlowProps {
  course: Course;
  onEnrollmentComplete?: (enrollment: any) => void;
  onEnrollmentError?: (error: string) => void;
}

type EnrollmentStepId = 'overview' | 'prerequisites' | 'payment' | 'confirmation' | 'complete';

export function EnrollmentFlow({ 
  course, 
  onEnrollmentComplete, 
  onEnrollmentError 
}: EnrollmentFlowProps) {
  const [currentStep, setCurrentStep] = useState<EnrollmentStepId>('overview');
  const [enrollmentData, setEnrollmentData] = useState<any>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [courseCapacity, setCourseCapacity] = useState<any>(null);
  const [userPrerequisites, setUserPrerequisites] = useState<any>(null);

  useEffect(() => {
    fetchCourseCapacity();
    fetchUserPrerequisites();
  }, [course.id]);

  const fetchCourseCapacity = async () => {
    try {
      const response = await fetch(`/api/enrollments/capacity/${course.id}`);
      const data = await response.json();
      if (data.success) {
        setCourseCapacity(data.data);
      }
    } catch (error) {
      console.error('Error fetching course capacity:', error);
    }
  };

  const fetchUserPrerequisites = async () => {
    try {
      const response = await fetch('/api/enrollments/validate-prerequisites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId: course.id })
      });
      const data = await response.json();
      if (data.success) {
        setUserPrerequisites(data.data);
      }
    } catch (error) {
      console.error('Error fetching prerequisites:', error);
    }
  };

  const steps: EnrollmentStep[] = [
    {
      id: 'overview',
      title: 'Course Overview',
      description: 'Review course details and enrollment information',
      component: OverviewStep,
      isValid: () => true
    },
    {
      id: 'prerequisites',
      title: 'Prerequisites Check',
      description: 'Verify you meet the course requirements',
      component: PrerequisitesStep,
      isValid: () => userPrerequisites?.valid || false,
      canSkip: course.prerequisites.length === 0
    },
    {
      id: 'payment',
      title: 'Payment',
      description: 'Choose payment method and complete enrollment',
      component: PaymentStep,
      isValid: () => enrollmentData.paymentIntent?.id || false
    },
    {
      id: 'confirmation',
      title: 'Confirmation',
      description: 'Review your enrollment details',
      component: ConfirmationStep,
      isValid: () => true
    },
    {
      id: 'complete',
      title: 'Enrollment Complete',
      description: 'Your enrollment has been processed',
      component: CompleteStep,
      isValid: () => true
    }
  ];

  const currentStepIndex = steps.findIndex(step => step.id === currentStep);
  const currentStepData = steps[currentStepIndex];
  const CurrentStepComponent = currentStepData.component;

  const canProceed = currentStepData.isValid?.() ?? true;
  const canGoBack = currentStepIndex > 0;

  const handleNext = async () => {
    if (!canProceed) return;

    if (currentStep === 'confirmation') {
      await processEnrollment();
    } else {
      const nextStep = steps[currentStepIndex + 1];
      setCurrentStep(nextStep.id as EnrollmentStepId);
    }
  };

  const handleBack = () => {
    if (canGoBack) {
      const prevStep = steps[currentStepIndex - 1];
      setCurrentStep(prevStep.id as EnrollmentStepId);
    }
  };

  const processEnrollment = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/enrollments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: course.id,
          paymentMethod: enrollmentData.paymentMethod,
          paymentDetails: enrollmentData.paymentDetails
        })
      });

      const data = await response.json();

      if (data.success) {
        setEnrollmentData(prev => ({ ...prev, enrollment: data.data.enrollment }));
        setCurrentStep('complete');
        onEnrollmentComplete?.(data.data);
      } else {
        setError(data.message || 'Enrollment failed');
        onEnrollmentError?.(data.message || 'Enrollment failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Enrollment failed';
      setError(errorMessage);
      onEnrollmentError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const getStepStatus = (stepId: EnrollmentStepId) => {
    const stepIndex = steps.findIndex(step => step.id === stepId);
    if (stepIndex < currentStepIndex) return 'completed';
    if (stepIndex === currentStepIndex) return 'current';
    return 'upcoming';
  };

  const isCourseFull = courseCapacity && 
    courseCapacity.currentEnrollments >= courseCapacity.maxStudents;

  return (
    <div className="max-w-4xl mx-auto px-3 xs:px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
      {/* Progress Indicator */}
      <Card>
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="text-center text-lg sm:text-xl">Enrollment Process</CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          <div className="flex items-center justify-between mb-4 sm:mb-6 overflow-x-auto hide-scrollbar">
            {steps.map((step, index) => {
              const status = getStepStatus(step.id as EnrollmentStepId);
              return (
                <div key={step.id} className="flex items-center flex-shrink-0">
                  <div className="flex flex-col items-center">
                    <div className={`
                      w-8 h-8 sm:w-10 sm:h-10 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center
                      ${status === 'completed' ? 'bg-green-500 text-white' : ''}
                      ${status === 'current' ? 'bg-blue-500 text-white' : ''}
                      ${status === 'upcoming' ? 'bg-gray-200 text-gray-500' : ''}
                    `}>
                      {status === 'completed' ? (
                        <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                      ) : (
                        <span className="text-xs sm:text-sm font-medium">{index + 1}</span>
                      )}
                    </div>
                    <span className="text-[10px] xs:text-xs mt-1 sm:mt-2 text-center">
                      {step.title}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`
                      w-6 sm:w-12 md:w-16 h-1 mx-1 sm:mx-2
                      ${status === 'completed' ? 'bg-green-500' : 'bg-gray-200'}
                    `} />
                  )}
                </div>
              );
            })}
          </div>
          <Progress value={(currentStepIndex / (steps.length - 1)) * 100} className="w-full" />
        </CardContent>
      </Card>

      {/* Course Capacity Alert */}
      {isCourseFull && (
        <Alert className="border-orange-200 bg-orange-50">
          <AlertCircle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            This course is currently full. You will be added to the waitlist.
            Current waitlist: {courseCapacity?.waitlistCount || 0} students.
          </AlertDescription>
        </Alert>
      )}

      {/* Error Alert */}
      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Current Step Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {currentStepData.title}
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {currentStepData.description}
          </p>
        </CardHeader>
        <CardContent>
          <CurrentStepComponent
            course={course}
            enrollmentData={enrollmentData}
            setEnrollmentData={setEnrollmentData}
            courseCapacity={courseCapacity}
            userPrerequisites={userPrerequisites}
            isCourseFull={isCourseFull}
          />
        </CardContent>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex flex-col xs:flex-row justify-between gap-3">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={!canGoBack || isLoading}
          className="flex items-center gap-2 min-h-[44px] w-full xs:w-auto touch-target"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>

        <Button
          onClick={handleNext}
          disabled={!canProceed || isLoading}
          className="flex items-center gap-2 min-h-[44px] w-full xs:w-auto touch-target"
        >
          {currentStep === 'confirmation' ? (
            <>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  Complete Enrollment
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </>
          ) : (
            <>
              Next
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// Overview Step Component
function OverviewStep({ 
  course, 
  courseCapacity, 
  isCourseFull 
}: { 
  course: Course; 
  courseCapacity: any; 
  isCourseFull: boolean; 
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        <div>
          <img 
            src={course.thumbnail} 
            srcSet={`${course.thumbnail}?w=400 400w, ${course.thumbnail}?w=800 800w`}
            sizes="(max-width: 768px) 100vw, 400px"
            alt={course.title}
            className="w-full h-40 sm:h-48 object-cover rounded-lg"
            loading="lazy"
          />
        </div>
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">{course.title}</h3>
            <p className="text-muted-foreground">{course.description}</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground">Instructor:</span>
              <span className="font-medium">{course.instructor.name}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground">Rating:</span>
              <Badge variant="secondary">{course.rating.toFixed(1)}</Badge>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">Level: {course.metadata.level}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">Duration: {course.metadata.duration} hours</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">
                {courseCapacity?.currentEnrollments || course.enrollmentCount} / {course.metadata.maxStudents} students
              </span>
            </div>
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h4 className="font-semibold">Pricing</h4>
        <div className="flex items-center gap-4">
          <div className="text-3xl font-bold">${course.price}</div>
          {course.originalPrice && course.originalPrice > course.price && (
            <>
              <div className="text-xl text-muted-foreground line-through">
                ${course.originalPrice}
              </div>
              <Badge className="bg-green-100 text-green-800">
                Save ${course.originalPrice - course.price}
              </Badge>
            </>
          )}
        </div>
      </div>

      {isCourseFull && (
        <Alert className="border-blue-200 bg-blue-50">
          <Clock className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            <strong>Waitlist Available:</strong> You'll be notified when a spot becomes available.
            Estimated wait time: 2-3 weeks based on current trends.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

// Prerequisites Step Component
function PrerequisitesStep({ 
  course, 
  userPrerequisites 
}: { 
  course: Course; 
  userPrerequisites: any; 
}) {
  if (course.prerequisites.length === 0) {
    return (
      <Alert className="border-green-200 bg-green-50">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800">
          This course has no prerequisites. You're ready to enroll!
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-semibold mb-2">Course Prerequisites</h4>
        <p className="text-sm text-muted-foreground mb-4">
          Please ensure you meet the following requirements before enrolling:
        </p>
      </div>

      <div className="space-y-3">
        {course.prerequisites.map((prereq, index) => {
          const isCompleted = userPrerequisites?.completed?.includes(prereq);
          return (
            <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
              {isCompleted ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <AlertCircle className="w-5 h-5 text-orange-500" />
              )}
              <div className="flex-1">
                <div className="font-medium">{prereq}</div>
                <div className="text-sm text-muted-foreground">
                  {isCompleted ? 'Completed' : 'Not completed'}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {userPrerequisites && (
        <Alert className={
          userPrerequisites.valid 
            ? 'border-green-200 bg-green-50' 
            : 'border-orange-200 bg-orange-50'
        }>
          {userPrerequisites.valid ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <AlertCircle className="h-4 w-4 text-orange-600" />
          )}
          <AlertDescription className={
            userPrerequisites.valid 
              ? 'text-green-800' 
              : 'text-orange-800'
          }>
            {userPrerequisites.valid 
              ? 'All prerequisites have been met! You can proceed with enrollment.'
              : `Missing prerequisites: ${userPrerequisites.missing?.join(', ')}`
            }
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

// Payment Step Component
function PaymentStep({ 
  course, 
  enrollmentData, 
  setEnrollmentData 
}: { 
  course: Course; 
  enrollmentData: any; 
  setEnrollmentData: any; 
}) {
  const [selectedMethod, setSelectedMethod] = useState<string>('stellar');
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePaymentMethodSelect = async (method: string) => {
    setSelectedMethod(method);
    setEnrollmentData(prev => ({ ...prev, paymentMethod: method }));

    if (method === 'stellar') {
      await createStellarPaymentIntent();
    }
  };

  const createStellarPaymentIntent = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/payments/stellar/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enrollmentId: 'temp', // Will be updated after enrollment creation
          courseId: course.id,
          amount: course.price,
          assetCode: 'XLM',
          fromAddress: enrollmentData.stellarAddress
        })
      });

      const data = await response.json();
      if (data.success) {
        setEnrollmentData(prev => ({ 
          ...prev, 
          paymentIntent: data.data,
          paymentDetails: {
            amount: course.price,
            currency: 'USD',
            courseId: course.id
          }
        }));
      }
    } catch (error) {
      console.error('Error creating payment intent:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h4 className="font-semibold mb-4">Select Payment Method</h4>
        <div className="grid gap-3 sm:gap-4">
          <div 
            className={`p-3 sm:p-4 border rounded-lg cursor-pointer transition-colors min-h-[44px] flex items-center ${
              selectedMethod === 'stellar' 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-200 hover:border-gray-300 active:bg-gray-50'
            }`}
            onClick={() => handlePaymentMethodSelect('stellar')}
            role="button"
            tabIndex={0}
            aria-pressed={selectedMethod === 'stellar'}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handlePaymentMethodSelect('stellar')}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 min-w-[44px] min-h-[44px] bg-blue-100 rounded-full flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="font-medium text-sm sm:text-base">Stellar (XLM)</div>
                <div className="text-xs sm:text-sm text-muted-foreground">
                  Fast, low-cost blockchain payments
                </div>
              </div>
            </div>
          </div>

          <div 
            className={`p-3 sm:p-4 border rounded-lg cursor-pointer transition-colors min-h-[44px] flex items-center ${
              selectedMethod === 'credit_card' 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-200 hover:border-gray-300 active:bg-gray-50'
            }`}
            onClick={() => handlePaymentMethodSelect('credit_card')}
            role="button"
            tabIndex={0}
            aria-pressed={selectedMethod === 'credit_card'}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handlePaymentMethodSelect('credit_card')}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 min-w-[44px] min-h-[44px] bg-green-100 rounded-full flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="font-medium text-sm sm:text-base">Credit Card</div>
                <div className="text-xs sm:text-sm text-muted-foreground">
                  Visa, Mastercard, American Express
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Separator />

      <div>
        <h4 className="font-semibold mb-2">Order Summary</h4>
        <div className="space-y-2 p-4 bg-gray-50 rounded-lg">
          <div className="flex justify-between">
            <span>Course:</span>
            <span className="font-medium">{course.title}</span>
          </div>
          <div className="flex justify-between">
            <span>Price:</span>
            <span className="font-medium">${course.price}</span>
          </div>
          {course.originalPrice && course.originalPrice > course.price && (
            <div className="flex justify-between text-green-600">
              <span>Discount:</span>
              <span className="font-medium">-${course.originalPrice - course.price}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between text-lg font-bold">
            <span>Total:</span>
            <span>${course.price}</span>
          </div>
        </div>
      </div>

      {selectedMethod === 'stellar' && enrollmentData.paymentIntent && (
        <Alert className="border-blue-200 bg-blue-50">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            Stellar payment will be processed in the next step. You'll need to sign the transaction with your wallet.
          </AlertDescription>
        </Alert>
      )}

      {isProcessing && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Setting up payment...
        </div>
      )}
    </div>
  );
}

// Confirmation Step Component
function ConfirmationStep({ 
  course, 
  enrollmentData 
}: { 
  course: Course; 
  enrollmentData: any; 
}) {
  return (
    <div className="space-y-6">
      <Alert className="border-green-200 bg-green-50">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800">
          Please review your enrollment details before completing the process.
        </AlertDescription>
      </Alert>

      <div className="space-y-4">
        <h4 className="font-semibold">Enrollment Summary</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <div className="space-y-3">
            <h5 className="font-medium">Course Information</h5>
            <div className="space-y-2 text-xs sm:text-sm">
              <div className="flex justify-between">
                <span>Course:</span>
                <span>{course.title}</span>
              </div>
              <div className="flex justify-between">
                <span>Instructor:</span>
                <span>{course.instructor.name}</span>
              </div>
              <div className="flex justify-between">
                <span>Duration:</span>
                <span>{course.metadata.duration} hours</span>
              </div>
              <div className="flex justify-between">
                <span>Level:</span>
                <span>{course.metadata.level}</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h5 className="font-medium">Payment Information</h5>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Payment Method:</span>
                <span className="capitalize">{enrollmentData.paymentMethod}</span>
              </div>
              <div className="flex justify-between">
                <span>Amount:</span>
                <span>${course.price}</span>
              </div>
              <div className="flex justify-between">
                <span>Status:</span>
                <Badge variant="outline">Pending</Badge>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Separator />

      <div className="text-sm text-muted-foreground">
        <p>By completing this enrollment, you agree to:</p>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>The course terms and conditions</li>
          <li>The refund policy applicable to this course</li>
          <li>Payment processing terms</li>
        </ul>
      </div>
    </div>
  );
}

// Complete Step Component
function CompleteStep({ 
  course, 
  enrollmentData 
}: { 
  course: Course; 
  enrollmentData: any; 
}) {
  return (      <div className="text-center space-y-4 sm:space-y-6 px-2">
      <div className="w-14 h-14 sm:w-16 sm:h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
        <CheckCircle className="w-7 h-7 sm:w-8 sm:h-8 text-green-600" />
      </div>
      
      <div>
        <h3 className="text-xl sm:text-2xl font-bold text-green-800 mb-2">
          Enrollment Successful!
        </h3>
        <p className="text-sm sm:text-base text-muted-foreground px-2">
          You have successfully enrolled in {course.title}
        </p>
      </div>

      <div className="space-y-3 sm:space-y-4 p-4 sm:p-6 bg-gray-50 rounded-lg text-left max-w-md mx-auto">
        <h5 className="font-semibold">Enrollment Details</h5>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Enrollment ID:</span>
            <span className="font-mono">{enrollmentData.enrollment?.id}</span>
          </div>
          <div className="flex justify-between">
            <span>Course:</span>
            <span>{course.title}</span>
          </div>
          <div className="flex justify-between">
            <span>Status:</span>
            <Badge className="bg-green-100 text-green-800">
              {enrollmentData.enrollment?.status || 'Confirmed'}
            </Badge>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <Button className="w-full min-h-[44px] touch-target">
          Go to Course
        </Button>
        <Button variant="outline" className="w-full min-h-[44px] touch-target">
          View My Enrollments
        </Button>
      </div>

      <p className="text-xs sm:text-sm text-muted-foreground px-2">
        You will receive a confirmation email shortly with your enrollment details.
      </p>
    </div>
  );
}
