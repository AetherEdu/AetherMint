'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Course, WalletInfo, EnrollmentData, EnrollmentConfirmation } from '@/types/enrollment';
import EnrollmentForm from '@/components/EnrollmentForm';
import { 
  BookOpen, 
  Clock, 
  Users, 
  Star, 
  CheckCircle,
  ArrowLeft,
  Download,
  Share2,
  Calendar
} from 'lucide-react';

const EnrollmentPage: React.FC = () => {
  const params = useParams();
  const router = useRouter();
  const courseId = params.courseId as string;

  const [course, setCourse] = useState<Course | null>(null);
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enrollmentComplete, setEnrollmentComplete] = useState(false);
  const [enrollmentData, setEnrollmentData] = useState<EnrollmentData | null>(null);

  useEffect(() => {
    fetchCourseDetails();
  }, [courseId]);

  const fetchCourseDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      // In a real application, you would fetch from your API
      // For this example, we'll use mock data
      const mockCourse: Course = {
        id: courseId,
        title: 'Introduction to Blockchain Development',
        description: 'Learn the fundamentals of blockchain technology and smart contract development using Stellar and other platforms.',
        instructor: 'Dr. Sarah Johnson',
        price: 50.0,
        currency: 'XLM',
        duration: '8 weeks',
        level: 'beginner',
        category: 'Blockchain',
        thumbnail: '/course-thumbnails/blockchain-intro.jpg',
        prerequisites: ['Basic programming knowledge', 'Understanding of web technologies'],
        learningObjectives: [
          'Understand blockchain fundamentals',
          'Build smart contracts on Stellar',
          'Develop decentralized applications',
          'Implement wallet integrations'
        ],
        maxStudents: 100,
        currentEnrollments: 45,
        startDate: '2024-04-01',
        endDate: '2024-05-26'
      };

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setCourse(mockCourse);
    } catch (error) {
      console.error('Error fetching course details:', error);
      setError('Failed to load course details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleWalletConnect = (walletInfo: WalletInfo) => {
    setWallet(walletInfo);
  };

  const handleWalletDisconnect = () => {
    setWallet(null);
  };

  const handleEnrollmentComplete = (enrollment: EnrollmentData) => {
    setEnrollmentData(enrollment);
    setEnrollmentComplete(true);
  };

  const handleEnrollmentError = (errorMessage: string) => {
    setError(errorMessage);
  };

  const downloadCertificate = () => {
    // In a real application, this would generate and download a certificate
    const certificateData = {
      studentName: `${enrollmentData?.personalInfo?.firstName} ${enrollmentData?.personalInfo?.lastName}`,
      courseTitle: course?.title,
      instructor: course?.instructor,
      completionDate: new Date().toLocaleDateString(),
      certificateId: `CERT_${enrollmentData?.id}`
    };

    const blob = new Blob([JSON.stringify(certificateData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `certificate-${courseId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const shareEnrollment = async () => {
    if (navigator.share && course) {
      try {
        await navigator.share({
          title: `Enrolled in ${course.title}`,
          text: `I've just enrolled in ${course.title} on AetherMint Education!`,
          url: window.location.href
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading course details...</p>
        </div>
      </div>
    );
  }

  if (error && !course) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-900 mb-2">Error Loading Course</h2>
            <p className="text-red-700 mb-4">{error}</p>
            <button
              onClick={() => router.back()}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (enrollmentComplete && enrollmentData && course) {
    return (
      <div className="min-h-screen bg-gray-50 py-6 sm:py-8 md:py-12">
        <div className="max-w-4xl mx-auto px-3 xs:px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            {/* Success Header */}
            <div className="bg-gradient-to-r from-green-600 to-green-700 px-4 sm:px-6 md:px-8 py-6 sm:py-8 text-center">
              <CheckCircle className="w-12 h-12 sm:w-16 sm:h-16 text-white mx-auto mb-3 sm:mb-4" />
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Enrollment Successful!</h1>
              <p className="text-sm sm:text-base text-green-100 px-2">You're now enrolled in {course.title}</p>
            </div>

            {/* Confirmation Details */}
            <div className="px-4 sm:px-6 md:px-8 py-6 sm:py-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
                {/* Course Information */}
                <div>
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4">Course Information</h2>
                  <div className="bg-gray-50 rounded-xl sm:rounded-lg p-4 sm:p-5 space-y-3 sm:space-y-4">
                    <div className="flex items-start space-x-3">
                      <BookOpen className="w-5 h-5 text-gray-600 mt-0.5 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-sm sm:text-base text-gray-900 break-words">{course.title}</p>
                        <p className="text-xs sm:text-sm text-gray-600">with {course.instructor}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Clock className="w-5 h-5 text-gray-600 flex-shrink-0" />
                      <div>
                        <p className="text-sm sm:text-base text-gray-900">{course.duration}</p>
                        <p className="text-xs text-gray-600">Duration</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <Calendar className="w-5 h-5 text-gray-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm sm:text-base text-gray-900 break-words">
                          {new Date(course.startDate || '').toLocaleDateString()} - {new Date(course.endDate || '').toLocaleDateString()}
                        </p>
                        <p className="text-xs text-gray-600">Course Period</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Users className="w-5 h-5 text-gray-600 flex-shrink-0" />
                      <div>
                        <p className="text-sm sm:text-base text-gray-900">{course.currentEnrollments}/{course.maxStudents} students</p>
                        <p className="text-xs text-gray-600">Class Size</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Enrollment Details */}
                <div>
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4">Enrollment Details</h2>
                  <div className="bg-blue-50 rounded-xl sm:rounded-lg p-4 sm:p-5 space-y-3 sm:space-y-4">
                    <div>
                      <p className="text-xs sm:text-sm text-gray-600">Enrollment ID</p>
                      <p className="font-mono text-sm font-medium break-all">{enrollmentData.id}</p>
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm text-gray-600">Student</p>
                      <p className="font-medium text-sm sm:text-base">
                        {enrollmentData.personalInfo?.firstName} {enrollmentData.personalInfo?.lastName}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm text-gray-600">Email</p>
                      <p className="font-medium text-sm sm:text-base break-all">{enrollmentData.personalInfo?.email}</p>
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm text-gray-600">Payment Amount</p>
                      <p className="font-medium text-sm sm:text-base">{course.price} {course.currency}</p>
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm text-gray-600">Transaction</p>
                      <p className="font-mono text-xs break-all">{enrollmentData.paymentDetails.transactionHash}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Next Steps */}
              <div className="mt-6 sm:mt-8 bg-yellow-50 border border-yellow-200 rounded-xl sm:rounded-lg p-4 sm:p-5">
                <h3 className="font-semibold text-yellow-900 mb-2 text-sm sm:text-base">What&apos;s Next?</h3>
                <ul className="text-xs sm:text-sm text-yellow-800 space-y-1.5">
                  <li>• Check your email for course access credentials</li>
                  <li>• Join the course Discord community</li>
                  <li>• Download the course materials</li>
                  <li>• Mark your calendar for the first session</li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4">
                <button
                  onClick={downloadCertificate}
                  className="w-full sm:flex-1 min-h-[44px] bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-colors font-medium text-sm sm:text-base flex items-center justify-center space-x-2 active:scale-[0.98]"
                >
                  <Download className="w-5 h-5 flex-shrink-0" />
                  <span>Download Certificate</span>
                </button>
                <button
                  onClick={shareEnrollment}
                  className="w-full sm:flex-1 min-h-[44px] bg-gray-600 text-white px-6 py-3 rounded-xl hover:bg-gray-700 transition-colors font-medium text-sm sm:text-base flex items-center justify-center space-x-2 active:scale-[0.98]"
                >
                  <Share2 className="w-5 h-5 flex-shrink-0" />
                  <span>Share Achievement</span>
                </button>
                <button
                  onClick={() => router.push('/courses')}
                  className="w-full sm:flex-1 min-h-[44px] bg-white border-2 border-gray-300 text-gray-700 px-6 py-3 rounded-xl hover:bg-gray-50 transition-colors font-medium text-sm sm:text-base active:scale-[0.98]"
                >
                  Browse More Courses
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!course) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Course Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-3 xs:px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex items-center space-x-4 mb-3 sm:mb-4">
            <button
              onClick={() => router.back()}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center space-x-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 px-3 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Back</span>
            </button>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
            <div className="lg:col-span-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 break-words">{course.title}</h1>
              <p className="text-sm sm:text-base md:text-lg text-gray-600 mb-4">{course.description}</p>
              
              <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-gray-600">
                <div className="flex items-center space-x-1">
                  <Star className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                  <span>4.8 (234 reviews)</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Users className="w-4 h-4 flex-shrink-0" />
                  <span>{course.currentEnrollments} students</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Clock className="w-4 h-4 flex-shrink-0" />
                  <span>{course.duration}</span>
                </div>
              </div>
            </div>
            
            <div className="lg:col-span-1">
              <div className="bg-gray-50 rounded-xl sm:rounded-lg p-4 sm:p-6">
                <div className="text-center mb-4 sm:mb-6">
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900">{course.price} {course.currency}</p>
                  <p className="text-xs sm:text-sm text-gray-600">One-time payment</p>
                </div>
                
                <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <span className="text-xs sm:text-sm text-gray-700">Lifetime access</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <span className="text-xs sm:text-sm text-gray-700">Certificate of completion</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <span className="text-xs sm:text-sm text-gray-700">30-day money back guarantee</span>
                  </div>
                </div>
                
                <div className="bg-blue-50 border border-blue-200 rounded-xl sm:rounded-lg p-3 sm:p-4">
                  <p className="text-xs sm:text-sm text-blue-800 text-center">
                    <strong>Instructor:</strong> {course.instructor}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enrollment Form */}
      <div className="max-w-7xl mx-auto px-3 xs:px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <EnrollmentForm
          course={course}
          wallet={wallet}
          onEnrollmentComplete={handleEnrollmentComplete}
          onEnrollmentError={handleEnrollmentError}
        />
      </div>
    </div>
  );
};

export default EnrollmentPage;
