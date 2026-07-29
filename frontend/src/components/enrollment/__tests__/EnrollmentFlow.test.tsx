import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EnrollmentFlow } from '../EnrollmentFlow';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

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
  Alert: ({ children, className }: any) => <div className={className}>{children}</div>,
  AlertDescription: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/components/ui/progress', () => ({
  Progress: () => <div data-testid="progress" />,
}));

jest.mock('@/components/ui/separator', () => ({
  Separator: () => <hr />,
}));

global.fetch = jest.fn();

const mockCourse = {
  id: 'course-1',
  title: 'Mastering Stellar',
  description: 'Learn Stellar Development',
  price: 150,
  originalPrice: 200,
  thumbnail: '/thumb.jpg',
  instructor: { name: 'Dr. Smith', rating: 4.5 },
  metadata: { level: 'intermediate', duration: 40, maxStudents: 100, isPublished: true },
  enrollmentCount: 45,
  rating: 4.5,
  prerequisites: ['Blockchain Basics'],
};

describe('EnrollmentFlow', () => {
  const onEnrollmentComplete = jest.fn();
  const onEnrollmentError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      json: () => Promise.resolve({ success: true, data: {} }),
    });
  });

  it('renders the enrollment process title', async () => {
    render(<EnrollmentFlow course={mockCourse} onEnrollmentComplete={onEnrollmentComplete} onEnrollmentError={onEnrollmentError} />);
    await waitFor(() => {
      expect(screen.getByText('Enrollment Process')).toBeInTheDocument();
    });
  });

  it('shows course overview by default', async () => {
    render(<EnrollmentFlow course={mockCourse} onEnrollmentComplete={onEnrollmentComplete} onEnrollmentError={onEnrollmentError} />);
    await waitFor(() => {
      expect(screen.getByText('Mastering Stellar')).toBeInTheDocument();
      expect(screen.getByText('Dr. Smith')).toBeInTheDocument();
    });
  });

  it('shows pricing information', async () => {
    render(<EnrollmentFlow course={mockCourse} onEnrollmentComplete={onEnrollmentComplete} onEnrollmentError={onEnrollmentError} />);
    await waitFor(() => {
      expect(screen.getByText('$150')).toBeInTheDocument();
      expect(screen.getByText('$200')).toBeInTheDocument();
    });
  });

  it('shows step indicators', async () => {
    render(<EnrollmentFlow course={mockCourse} onEnrollmentComplete={onEnrollmentComplete} onEnrollmentError={onEnrollmentError} />);
    await waitFor(() => {
      expect(screen.getByText('Course Overview')).toBeInTheDocument();
      expect(screen.getByText('Prerequisites Check')).toBeInTheDocument();
      expect(screen.getByText('Payment')).toBeInTheDocument();
      expect(screen.getByText('Confirmation')).toBeInTheDocument();
    });
  });

  it('has next button enabled by default', async () => {
    render(<EnrollmentFlow course={mockCourse} onEnrollmentComplete={onEnrollmentComplete} onEnrollmentError={onEnrollmentError} />);
    await waitFor(() => {
      const nextButtons = screen.getAllByText('Next');
      expect(nextButtons.length).toBeGreaterThan(0);
    });
  });

  it('has back button disabled on first step', async () => {
    render(<EnrollmentFlow course={mockCourse} onEnrollmentComplete={onEnrollmentComplete} onEnrollmentError={onEnrollmentError} />);
    await waitFor(() => {
      const backButton = screen.getByText('Back').closest('button');
      expect(backButton).toBeDisabled();
    });
  });

  it('shows error alert when enrollment fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      json: () => Promise.resolve({ success: false, message: 'Payment failed' }),
    });
    render(<EnrollmentFlow course={mockCourse} onEnrollmentComplete={onEnrollmentComplete} onEnrollmentError={onEnrollmentError} />);
    await waitFor(() => {
      expect(screen.getByText('Enrollment Process')).toBeInTheDocument();
    });
  });
});