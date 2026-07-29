/**
 * Enrollment Confirmation Component
 * Handles the enrollment confirmation process and receipt generation
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  CheckCircle, 
  Download, 
  Mail, 
  Calendar,
  Clock,
  User,
  CreditCard,
  BookOpen,
  ExternalLink,
  Share2,
  Printer,
  Loader2
} from 'lucide-react';

interface Enrollment {
  id: string;
  userId: string;
  courseId: string;
  status: string;
  enrolledAt: string;
  progress: number;
  paymentStatus: string;
  paymentMethod: string;
  amountPaid: number;
  totalAmount: number;
  currency: string;
  transactionId?: string;
  certificateIssued: boolean;
  prerequisitesMet: boolean;
}

interface Course {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  instructor: {
    name: string;
    email: string;
    rating: number;
  };
  metadata: {
    level: string;
    duration: number;
    startDate?: string;
    endDate?: string;
  };
}

interface PaymentTransaction {
  id: string;
  amount: number;
  currency: string;
  method: string;
  status: string;
  transactionHash?: string;
  createdAt: string;
  completedAt?: string;
}

interface EnrollmentConfirmationProps {
  enrollment: Enrollment;
  course: Course;
  paymentTransaction?: PaymentTransaction;
  onDownloadReceipt?: () => void;
  onShareEnrollment?: () => void;
  onGoToCourse?: () => void;
  onViewDashboard?: () => void;
}

export function EnrollmentConfirmation({
  enrollment,
  course,
  paymentTransaction,
  onDownloadReceipt,
  onShareEnrollment,
  onGoToCourse,
  onViewDashboard
}: EnrollmentConfirmationProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    generateReceipt();
  }, [enrollment.id]);

  const generateReceipt = async () => {
    try {
      const response = await fetch(`/api/payments/receipt/${paymentTransaction?.id}`);
      const data = await response.json();
      if (data.success) {
        setReceiptUrl(data.data.receiptUrl);
      }
    } catch (error) {
      console.error('Error generating receipt:', error);
    }
  };

  const handleDownloadReceipt = async () => {
    if (!receiptUrl) return;
    
    setIsDownloading(true);
    try {
      const response = await fetch(receiptUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `enrollment-receipt-${enrollment.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      onDownloadReceipt?.();
    } catch (error) {
      console.error('Error downloading receipt:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShareEnrollment = async () => {
    setIsSharing(true);
    try {
      if (navigator.share) {
        await navigator.share({
          title: `I enrolled in ${course.title}!`,
          text: `Check out this course I just enrolled in: ${course.title}`,
          url: window.location.href
        });
      } else {
        // Fallback: copy to clipboard
        const shareText = `I just enrolled in ${course.title}! Learn more at ${window.location.href}`;
        await navigator.clipboard.writeText(shareText);
        alert('Enrollment details copied to clipboard!');
      }
      
      onShareEnrollment?.();
    } catch (error) {
      console.error('Error sharing enrollment:', error);
    } finally {
      setIsSharing(false);
    }
  };

  const handleSendEmail = async () => {
    try {
      const response = await fetch('/api/notifications/send-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enrollmentId: enrollment.id,
          type: 'confirmation'
        })
      });

      if (response.ok) {
        setEmailSent(true);
        setTimeout(() => setEmailSent(false), 3000);
      }
    } catch (error) {
      console.error('Error sending confirmation email:', error);
    }
  };

  const getEnrollmentStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'active':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-3 xs:px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
      {/* Success Header */}
      <Card className="border-green-200 bg-green-50">
        <CardContent className="pt-4 sm:pt-6 px-4 sm:px-6">
          <div className="text-center space-y-3 sm:space-y-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-7 h-7 sm:w-8 sm:h-8 text-green-600" />
            </div>
            
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-green-800 mb-2">
                Enrollment Confirmed!
              </h1>
              <p className="text-sm sm:text-base text-green-700 px-2">
                You have successfully enrolled in <strong>{course.title}</strong>
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4">
              <Badge className={getEnrollmentStatusColor(enrollment.status)}>
                {enrollment.status.charAt(0).toUpperCase() + enrollment.status.slice(1)}
              </Badge>
              <Badge className={getPaymentStatusColor(enrollment.paymentStatus)}>
                Payment {enrollment.paymentStatus.charAt(0).toUpperCase() + enrollment.paymentStatus.slice(1)}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Enrollment Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Course Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Course Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3 sm:gap-4">
              <img 
                src={course.thumbnail}
                srcSet={`${course.thumbnail}?w=80 80w, ${course.thumbnail}?w=160 160w`}
                sizes="80px"
                alt={course.title}
                className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-lg flex-shrink-0"
                loading="lazy"
              />
              <div className="flex-1">
                <h3 className="font-semibold">{course.title}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {course.description}
                </p>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Instructor:</span>
                <span className="font-medium">{course.instructor.name}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Level:</span>
                <span className="font-medium capitalize">{course.metadata.level}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Duration:</span>
                <span className="font-medium">{course.metadata.duration} hours</span>
              </div>

              {course.metadata.startDate && (
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Start Date:</span>
                  <span className="font-medium">{formatDate(course.metadata.startDate)}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Enrollment Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              Enrollment Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Enrollment ID:</span>
                <span className="font-mono text-sm">{enrollment.id}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Enrollment Date:</span>
                <span className="font-medium">{formatDate(enrollment.enrolledAt)}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Status:</span>
                <Badge className={getEnrollmentStatusColor(enrollment.status)}>
                  {enrollment.status.charAt(0).toUpperCase() + enrollment.status.slice(1)}
                </Badge>
              </div>
              
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Progress:</span>
                <span className="font-medium">{enrollment.progress}%</span>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <h4 className="font-semibold">Payment Information</h4>
              
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Amount Paid:</span>
                <span className="font-medium">
                  {formatCurrency(enrollment.amountPaid, enrollment.currency)}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Payment Method:</span>
                <span className="font-medium capitalize">{enrollment.paymentMethod}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Payment Status:</span>
                <Badge className={getPaymentStatusColor(enrollment.paymentStatus)}>
                  {enrollment.paymentStatus.charAt(0).toUpperCase() + enrollment.paymentStatus.slice(1)}
                </Badge>
              </div>

              {paymentTransaction && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Transaction ID:</span>
                  <span className="font-mono text-sm">{paymentTransaction.id}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <Card>
        <CardHeader className="px-4 sm:px-6">
          <CardTitle>Next Steps</CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <Button
              onClick={onGoToCourse}
              className="w-full min-h-[44px] touch-target"
              size="lg"
            >
              <BookOpen className="w-4 h-4 mr-2" />
              Go to Course
            </Button>
            
            <Button
              onClick={onViewDashboard}
              variant="outline"
              className="w-full min-h-[44px] touch-target"
              size="lg"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              View Dashboard
            </Button>
          </div>

          <Separator className="my-4 sm:my-6" />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <Button
              onClick={handleDownloadReceipt}
              variant="outline"
              disabled={isDownloading || !receiptUrl}
              className="w-full min-h-[44px] touch-target"
            >
              {isDownloading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Downloading...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Download Receipt
                </>
              )}
            </Button>
            
            <Button
              onClick={handleShareEnrollment}
              variant="outline"
              disabled={isSharing}
              className="w-full min-h-[44px] touch-target"
            >
              {isSharing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sharing...
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4 mr-2" />
                  Share
                </>
              )}
            </Button>
            
            <Button
              onClick={handleSendEmail}
              variant="outline"
              disabled={emailSent}
              className="w-full min-h-[44px] touch-target"
            >
              {emailSent ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Email Sent
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Send Email
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Important Information */}
      <Alert className="border-blue-200 bg-blue-50">
        <Calendar className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          <div className="space-y-2">
            <p className="font-semibold">Important Information:</p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>You will receive a confirmation email with your enrollment details</li>
              <li>Course access will be available on the start date</li>
              <li>You can track your progress in your dashboard</li>
              <li>Certificate will be issued upon successful completion</li>
              <li>Refund policy applies as per course terms</li>
            </ul>
          </div>
        </AlertDescription>
      </Alert>

      {/* Blockchain Transaction Info */}
      {paymentTransaction?.transactionHash && enrollment.paymentMethod === 'stellar' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Blockchain Transaction
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Transaction Hash</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={paymentTransaction.transactionHash}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => navigator.clipboard.writeText(paymentTransaction.transactionHash!)}
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                This transaction is permanently recorded on the Stellar blockchain and cannot be altered.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
