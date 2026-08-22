'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Course, WalletInfo, EnrollmentData } from '@/types/enrollment';
import Skeleton from '@/components/Skeleton';

const TestEnrollmentPage: React.FC = () => {
  const router = useRouter();
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const mockCourse: Course = {
    id: 'test-course-123',
    title: 'Test Course for Enrollment Flow',
    description: 'This is a test course to verify the enrollment functionality',
    instructor: 'Test Instructor',
    price: 10.0,
    currency: 'XLM',
    duration: '4 weeks',
    level: 'beginner',
    category: 'Testing',
    maxStudents: 50,
    currentEnrollments: 25,
    startDate: '2024-04-01',
    endDate: '2024-04-28'
  };

  const mockWallet: WalletInfo = {
    publicKey: 'GD5DJQD5KEYHFZKN5UZ4LJNEZKXDWQK5V4L5QW6Q5Q5Q5Q5Q5Q5Q5Q5',
    network: 'testnet',
    connected: true,
    walletType: 'xbull',
    balance: 100.0
  };

  const addResult = (message: string, isError: boolean = false) => {
    setTestResults(prev => [...prev, `${isError ? '❌' : '✅'} ${message}`]);
  };

  const testEnrollmentFlow = async () => {
    setIsRunning(true);
    setTestResults([]);

    try {
      // Test 1: Validate course data
      addResult('Testing course data validation...');
      if (!mockCourse.id || !mockCourse.title || !mockCourse.price) {
        throw new Error('Invalid course data');
      }
      addResult('Course data validation passed');

      // Test 2: Validate wallet data
      addResult('Testing wallet data validation...');
      if (!mockWallet.publicKey || !mockWallet.connected) {
        throw new Error('Invalid wallet data');
      }
      addResult('Wallet data validation passed');

      // Test 3: Test API endpoint structure
      addResult('Testing API endpoint...');
      try {
        const response = await fetch('/api/enroll', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            studentId: mockWallet.publicKey,
            courseId: mockCourse.id,
            walletAddress: mockWallet.publicKey,
            paymentDetails: {
              courseId: mockCourse.id,
              amount: mockCourse.price,
              currency: mockCourse.currency,
              recipientAddress: 'TEST_RECIPIENT_ADDRESS',
              transactionHash: 'TEST_TX_HASH_12345',
              status: 'completed',
              timestamp: new Date().toISOString()
            },
            enrollmentDate: new Date().toISOString(),
            status: 'confirmed',
            personalInfo: {
              firstName: 'Test',
              lastName: 'Student',
              email: 'test@example.com'
            }
          }),
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            addResult('API endpoint test passed');
            addResult(`Enrollment ID: ${result.data.id}`);
          } else {
            throw new Error(result.error?.message || 'API returned error');
          }
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (error) {
        addResult(`API test failed: ${error instanceof Error ? error.message : 'Unknown error'}`, true);
      }

      // Test 4: Test GET endpoint
      addResult('Testing GET endpoint...');
      try {
        const getResponse = await fetch(`/api/enroll?studentId=${mockWallet.publicKey}`);
        if (getResponse.ok) {
          const getResult = await getResponse.json();
          if (getResult.success && Array.isArray(getResult.data)) {
            addResult('GET endpoint test passed');
            addResult(`Found ${getResult.data.length} enrollments`);
          } else {
            throw new Error('Invalid response format');
          }
        } else {
          throw new Error(`HTTP ${getResponse.status}`);
        }
      } catch (error) {
        addResult(`GET endpoint test failed: ${error instanceof Error ? error.message : 'Unknown error'}`, true);
      }

      // Test 5: Test component imports
      addResult('Testing component imports...');
      try {
        const EnrollmentForm = (await import('@/components/EnrollmentForm')).default;
        const WalletConnector = (await import('@/components/WalletConnector')).default;
        const PaymentProcessor = (await import('@/components/PaymentProcessor')).default;
        addResult('Component imports successful');
      } catch (error) {
        addResult(`Component import failed: ${error instanceof Error ? error.message : 'Unknown error'}`, true);
      }

      // Test 6: Test Stellar utilities
      addResult('Testing Stellar utilities...');
      try {
        const { stellarService, formatStellarBalance, isValidStellarAddress } = await import('@/lib/stellar');
        
        // Test balance formatting
        const formattedBalance = formatStellarBalance(10.5);
        if (formattedBalance.includes('XLM')) {
          addResult('Balance formatting works');
        } else {
          throw new Error('Balance formatting failed');
        }

        // Test address validation
        const validAddress = isValidStellarAddress(mockWallet.publicKey);
        const invalidAddress = isValidStellarAddress('invalid_address');
        
        if (validAddress && !invalidAddress) {
          addResult('Address validation works');
        } else {
          throw new Error('Address validation failed');
        }

        addResult('Stellar utilities test passed');
      } catch (error) {
        addResult(`Stellar utilities test failed: ${error instanceof Error ? error.message : 'Unknown error'}`, true);
      }

      addResult('🎉 All tests completed!');

    } catch (error) {
      addResult(`Test suite failed: ${error instanceof Error ? error.message : 'Unknown error'}`, true);
    } finally {
      setIsRunning(false);
    }
  };

  const navigateToEnrollment = () => {
    router.push(`/enroll/${mockCourse.id}`);
  };

  const testInProgress = isRunning && testResults.length === 0;

  return (
    <div className="min-h-screen bg-gray-50 py-6 sm:py-8 md:py-12">
      <div className="max-w-4xl mx-auto px-3 xs:px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 md:p-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Enrollment Flow Test</h1>
          <p className="text-sm sm:text-base text-gray-600 mb-6 sm:mb-8">
            Test the complete enrollment functionality including API endpoints, components, and utilities.
          </p>

          {/* Show skeleton while tests are initializing */}
          {testInProgress ? (
            <div className="mb-8" role="region" aria-label="Test execution in progress" aria-busy="true">
              <div className="bg-blue-50 rounded-lg p-6 mb-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-4 h-4 bg-blue-500 rounded-full animate-pulse" aria-hidden="true" />
                  <h2 className="text-lg font-semibold text-blue-900">Running Tests</h2>
                </div>
                <div className="space-y-3">
                  <Skeleton variant="list-item" lines={1} hasAvatar={false} aria-label="Test step loading" />
                  <Skeleton variant="list-item" lines={1} hasAvatar={false} aria-label="Test step loading" />
                  <Skeleton variant="list-item" lines={1} hasAvatar={false} aria-label="Test step loading" />
                  <Skeleton variant="text" lines={2} aria-label="Test results loading" />
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              <div className="bg-blue-50 rounded-lg p-6">
                <h2 className="text-lg font-semibold text-blue-900 mb-4">Test Data</h2>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">Course ID:</span> {mockCourse.id}
                  </div>
                  <div>
                    <span className="font-medium">Course Title:</span> {mockCourse.title}
                  </div>
                  <div>
                    <span className="font-medium">Price:</span> {mockCourse.price} {mockCourse.currency}
                  </div>
                  <div>
                    <span className="font-medium">Wallet Address:</span> {mockWallet.publicKey.slice(0, 20)}...
                  </div>
                  <div>
                    <span className="font-medium">Network:</span> {mockWallet.network}
                  </div>
                </div>
              </div>

              <div className="bg-green-50 rounded-lg p-6">
                <h2 className="text-lg font-semibold text-green-900 mb-4">Test Coverage</h2>
                <ul className="space-y-1 text-sm text-green-800">
                  <li>• Course data validation</li>
                  <li>• Wallet connection validation</li>
                  <li>• API POST endpoint</li>
                  <li>• API GET endpoint</li>
                  <li>• Component imports</li>
                  <li>• Stellar utilities</li>
                </ul>
              </div>
            </div>
          )}

          <div className="flex flex-col xs:flex-row gap-3 sm:gap-4 mb-6 sm:mb-8">
            <button
              onClick={testEnrollmentFlow}
              disabled={isRunning}
              className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center space-x-2"
              aria-label={isRunning ? 'Tests are running' : 'Run enrollment tests'}
            >
              {isRunning ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                  <span>Running Tests...</span>
                </>
              ) : (
                'Run Tests'
              )}
            </button>
            <button
              onClick={navigateToEnrollment}
              className="w-full xs:flex-1 min-h-[44px] bg-green-600 text-white px-6 py-3 rounded-xl hover:bg-green-700 transition-colors font-medium text-sm sm:text-base active:scale-[0.98]"
            >
              Test Live Enrollment
            </button>
          </div>

          {testResults.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-6" role="region" aria-label="Test results">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Test Results
                {isRunning && (
                  <span className="ml-2 text-sm font-normal text-blue-600">
                    <span className="inline-block w-3 h-3 bg-blue-500 rounded-full animate-pulse mr-1" aria-hidden="true" />
                    In progress...
                  </span>
                )}
              </h2>
              <div className="space-y-2 max-h-96 overflow-y-auto" role="log" aria-label="Test result log" aria-live="polite">
                {testResults.map((result, index) => (
                  <div
                    key={index}
                    className={`text-sm font-mono p-2 rounded transition-opacity ${
                      result.includes('✅') ? 'bg-green-100 text-green-800' :
                      result.includes('❌') ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}
                    role="status"
                    aria-label={result.replace(/[✅❌🎉]/g, '').trim()}
                  >
                    {result}
                  </div>
                ))}
                {isRunning && (
                  <div className="text-sm font-mono p-2 rounded bg-blue-100 text-blue-800 animate-pulse" role="status" aria-label="Test in progress">
                    <span className="inline-block w-3 h-3 bg-blue-500 rounded-full animate-pulse mr-2" aria-hidden="true" />
                    Running next test...
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mt-6 sm:mt-8 bg-yellow-50 border border-yellow-200 rounded-xl sm:rounded-lg p-4 sm:p-5">
            <h3 className="font-semibold text-yellow-900 mb-2 text-sm sm:text-base">Important Notes</h3>
            <ul className="text-xs sm:text-sm text-yellow-800 space-y-1.5">
              <li>• Tests use mock data and may not reflect real blockchain interactions</li>
              <li>• Stellar transaction validation requires a valid transaction hash</li>
              <li>• Live enrollment requires a connected wallet with sufficient balance</li>
              <li>• Make sure to set NEXT_PUBLIC_STELLAR_RECEIVER_ADDRESS in your environment</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestEnrollmentPage;
