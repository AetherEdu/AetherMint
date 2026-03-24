import { NextRequest, NextResponse } from 'next/server';
import { EnrollmentData, ApiResponse } from '@/types/enrollment';
import { stellarService } from '@/lib/stellar';

// In a real application, you would use a database
// For this example, we'll use in-memory storage
const enrollments: EnrollmentData[] = [];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const enrollment: EnrollmentData = body;

    // Validate required fields
    if (!enrollment.studentId || !enrollment.courseId || !enrollment.walletAddress) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: {
          message: 'Missing required enrollment fields',
          code: 'MISSING_FIELDS'
        }
      }, { status: 400 });
    }

    // Validate payment details
    if (!enrollment.paymentDetails || !enrollment.paymentDetails.transactionHash) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: {
          message: 'Payment information is required',
          code: 'MISSING_PAYMENT'
        }
      }, { status: 400 });
    }

    // Verify the transaction on Stellar network
    try {
      const transaction = await stellarService.validateTransaction(
        enrollment.paymentDetails.transactionHash
      );

      if (!transaction) {
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          error: {
            message: 'Invalid transaction hash',
            code: 'INVALID_TRANSACTION'
          }
        }, { status: 400 });
      }

      if (transaction.status !== 'success') {
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          error: {
            message: 'Transaction was not successful',
            code: 'TRANSACTION_FAILED'
          }
        }, { status: 400 });
      }

      // Verify transaction details match enrollment
      if (transaction.from !== enrollment.walletAddress) {
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          error: {
            message: 'Transaction source address does not match wallet address',
            code: 'ADDRESS_MISMATCH'
          }
        }, { status: 400 });
      }

      // Check if amount matches course price (in a real app, you'd fetch course details)
      if (transaction.amount !== enrollment.paymentDetails.amount) {
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          error: {
            message: 'Payment amount does not match course price',
            code: 'AMOUNT_MISMATCH'
          }
        }, { status: 400 });
      }

    } catch (error) {
      console.error('Transaction validation error:', error);
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: {
          message: 'Failed to validate transaction',
          code: 'VALIDATION_ERROR'
        }
      }, { status: 500 });
    }

    // Check for duplicate enrollment
    const existingEnrollment = enrollments.find(
      e => e.studentId === enrollment.studentId && e.courseId === enrollment.courseId
    );

    if (existingEnrollment) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: {
          message: 'Already enrolled in this course',
          code: 'DUPLICATE_ENROLLMENT'
        }
      }, { status: 409 });
    }

    // Generate enrollment ID
    const enrollmentId = `ENR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create enrollment record
    const newEnrollment: EnrollmentData = {
      ...enrollment,
      id: enrollmentId,
      enrollmentDate: new Date().toISOString(),
      status: 'confirmed'
    };

    // Save enrollment (in real app, save to database)
    enrollments.push(newEnrollment);

    // Log enrollment for analytics
    console.log('New enrollment created:', {
      enrollmentId,
      courseId: enrollment.courseId,
      studentId: enrollment.studentId,
      transactionHash: enrollment.paymentDetails.transactionHash,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json<ApiResponse<EnrollmentData>>({
      success: true,
      data: newEnrollment,
      message: 'Enrollment successful'
    });

  } catch (error) {
    console.error('Enrollment API error:', error);
    
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: {
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');
    const courseId = searchParams.get('courseId');

    let filteredEnrollments = enrollments;

    if (studentId) {
      filteredEnrollments = filteredEnrollments.filter(e => e.studentId === studentId);
    }

    if (courseId) {
      filteredEnrollments = filteredEnrollments.filter(e => e.courseId === courseId);
    }

    return NextResponse.json<ApiResponse<EnrollmentData[]>>({
      success: true,
      data: filteredEnrollments,
      message: 'Enrollments retrieved successfully'
    });

  } catch (error) {
    console.error('Get enrollments API error:', error);
    
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: {
        message: 'Failed to retrieve enrollments',
        code: 'RETRIEVAL_ERROR'
      }
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const enrollmentId = searchParams.get('enrollmentId');

    if (!enrollmentId) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: {
          message: 'Enrollment ID is required',
          code: 'MISSING_ENROLLMENT_ID'
        }
      }, { status: 400 });
    }

    const enrollmentIndex = enrollments.findIndex(e => e.id === enrollmentId);

    if (enrollmentIndex === -1) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: {
          message: 'Enrollment not found',
          code: 'ENROLLMENT_NOT_FOUND'
        }
      }, { status: 404 });
    }

    const deletedEnrollment = enrollments.splice(enrollmentIndex, 1)[0];

    console.log('Enrollment deleted:', {
      enrollmentId: deletedEnrollment.id,
      courseId: deletedEnrollment.courseId,
      studentId: deletedEnrollment.studentId,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json<ApiResponse<EnrollmentData>>({
      success: true,
      data: deletedEnrollment,
      message: 'Enrollment deleted successfully'
    });

  } catch (error) {
    console.error('Delete enrollment API error:', error);
    
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: {
        message: 'Failed to delete enrollment',
        code: 'DELETION_ERROR'
      }
    }, { status: 500 });
  }
}
