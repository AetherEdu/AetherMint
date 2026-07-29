import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EnrollmentConfirmation } from '../EnrollmentConfirmation';

jest.mock('@/components/ui/card', () => ({
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, className }: any) => (
    <button onClick={onClick} disabled={disabled} className={className}>{children}</button>
  ),
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className }: any) => <span className={className}>{children}</span>,
}));

jest.mock('@/components/ui/alert', () => ({
  Alert: ({ children }: any) => <div>{children}</div>,
  AlertDescription: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/components/ui/separator', () => ({
  Separator: () => <hr />,
}));

jest.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input {...props} />,
}));

jest.mock('@/components/ui/label', () => ({
  Label: ({ children }: any) => <label>{children}</label>,
}));

global.fetch = jest.fn();

const mockEnrollment = {
  id: 'enr-123',
  userId: 'user-1',
  courseId: 'course-1',
  status: 'confirmed',
  enrolledAt: '2024-01-15T10:00:00Z',
  progress: 0,
  paymentStatus: 'completed',
  paymentMethod: 'stellar',
  amountPaid: 150,
  totalAmount: 150,
  currency: 'USD',
  transactionId: 'tx-abc',
  certificateIssued: false,
  prerequisitesMet: true,
};

const mockCourse = {
  id: 'course-1',
  title: 'Mastering Stellar',
  description: 'Learn Stellar development',
  thumbnail: '/thumb.jpg',
  instructor: { name: 'Dr. Smith', email: 'dr@example.com', rating: 4.5 },
  metadata: { level: 'intermediate', duration: 40, startDate: '2024-02-01' },
};

describe('EnrollmentConfirmation', () => {
  const onDownloadReceipt = jest.fn();
  const onShareEnrollment = jest.fn();
  const onGoToCourse = jest.fn();
  const onViewDashboard = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      json: () => Promise.resolve({ success: true, data: { receiptUrl: '/receipt.pdf' } }),
      blob: () => Promise.resolve(new Blob()),
      ok: true,
    });
  });

  it('renders confirmation header', async () => {
    render(
      <EnrollmentConfirmation
        enrollment={mockEnrollment}
        course={mockCourse}
        onGoToCourse={onGoToCourse}
        onViewDashboard={onViewDashboard}
      />
    );
    await waitFor(() => {
      expect(screen.getByText('Enrollment Confirmed!')).toBeInTheDocument();
    });
  });

  it('shows course title in success message', async () => {
    render(
      <EnrollmentConfirmation
        enrollment={mockEnrollment}
        course={mockCourse}
        onGoToCourse={onGoToCourse}
        onViewDashboard={onViewDashboard}
      />
    );
    await waitFor(() => {
      expect(screen.getByText(/Mastering Stellar/)).toBeInTheDocument();
    });
  });

  it('displays enrollment status badges', async () => {
    render(
      <EnrollmentConfirmation
        enrollment={mockEnrollment}
        course={mockCourse}
        onGoToCourse={onGoToCourse}
        onViewDashboard={onViewDashboard}
      />
    );
    await waitFor(() => {
      expect(screen.getByText('Confirmed')).toBeInTheDocument();
      expect(screen.getByText('Payment Completed')).toBeInTheDocument();
    });
  });

  it('shows course information section', async () => {
    render(
      <EnrollmentConfirmation
        enrollment={mockEnrollment}
        course={mockCourse}
        onGoToCourse={onGoToCourse}
        onViewDashboard={onViewDashboard}
      />
    );
    await waitFor(() => {
      expect(screen.getByText('Course Information')).toBeInTheDocument();
      expect(screen.getByText('Dr. Smith')).toBeInTheDocument();
    });
  });

  it('shows enrollment details section', async () => {
    render(
      <EnrollmentConfirmation
        enrollment={mockEnrollment}
        course={mockCourse}
        onGoToCourse={onGoToCourse}
        onViewDashboard={onViewDashboard}
      />
    );
    await waitFor(() => {
      expect(screen.getByText('Enrollment Details')).toBeInTheDocument();
    });
  });

  it('shows payment information', async () => {
    render(
      <EnrollmentConfirmation
        enrollment={mockEnrollment}
        course={mockCourse}
        onGoToCourse={onGoToCourse}
        onViewDashboard={onViewDashboard}
      />
    );
    await waitFor(() => {
      expect(screen.getByText('$150.00')).toBeInTheDocument();
    });
  });

  it('shows next steps section', async () => {
    render(
      <EnrollmentConfirmation
        enrollment={mockEnrollment}
        course={mockCourse}
        onGoToCourse={onGoToCourse}
        onViewDashboard={onViewDashboard}
      />
    );
    await waitFor(() => {
      expect(screen.getByText('Go to Course')).toBeInTheDocument();
      expect(screen.getByText('View Dashboard')).toBeInTheDocument();
    });
  });

  it('calls onGoToCourse when button clicked', async () => {
    render(
      <EnrollmentConfirmation
        enrollment={mockEnrollment}
        course={mockCourse}
        onGoToCourse={onGoToCourse}
        onViewDashboard={onViewDashboard}
      />
    );
    await waitFor(() => {
      fireEvent.click(screen.getByText('Go to Course'));
      expect(onGoToCourse).toHaveBeenCalled();
    });
  });

  it('shows download receipt button', async () => {
    render(
      <EnrollmentConfirmation
        enrollment={mockEnrollment}
        course={mockCourse}
        onGoToCourse={onGoToCourse}
        onViewDashboard={onViewDashboard}
      />
    );
    await waitFor(() => {
      expect(screen.getByText('Download Receipt')).toBeInTheDocument();
    });
  });

  it('shows share button', async () => {
    render(
      <EnrollmentConfirmation
        enrollment={mockEnrollment}
        course={mockCourse}
        onGoToCourse={onGoToCourse}
        onViewDashboard={onViewDashboard}
      />
    );
    await waitFor(() => {
      expect(screen.getByText('Share')).toBeInTheDocument();
    });
  });

  it('shows send email button', async () => {
    render(
      <EnrollmentConfirmation
        enrollment={mockEnrollment}
        course={mockCourse}
        onGoToCourse={onGoToCourse}
        onViewDashboard={onViewDashboard}
      />
    );
    await waitFor(() => {
      expect(screen.getByText('Send Email')).toBeInTheDocument();
    });
  });

  it('shows important information section', async () => {
    render(
      <EnrollmentConfirmation
        enrollment={mockEnrollment}
        course={mockCourse}
        onGoToCourse={onGoToCourse}
        onViewDashboard={onViewDashboard}
      />
    );
    await waitFor(() => {
      expect(screen.getByText('Important Information:')).toBeInTheDocument();
    });
  });

  it('shows blockchain transaction info for stellar payments', async () => {
    const paymentTx = {
      id: 'ptx-1',
      amount: 150,
      currency: 'XLM',
      method: 'stellar',
      status: 'completed',
      transactionHash: 'stellar-tx-hash-abc',
      createdAt: '2024-01-15T10:00:00Z',
      completedAt: '2024-01-15T10:01:00Z',
    };
    render(
      <EnrollmentConfirmation
        enrollment={mockEnrollment}
        course={mockCourse}
        paymentTransaction={paymentTx}
        onGoToCourse={onGoToCourse}
        onViewDashboard={onViewDashboard}
      />
    );
    await waitFor(() => {
      expect(screen.getByText('Blockchain Transaction')).toBeInTheDocument();
    });
  });
});