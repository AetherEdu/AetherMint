export interface Course {
  id: string;
  title: string;
  description: string;
  instructor: string;
  price: number;
  currency: string;
  duration: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  category: string;
  thumbnail?: string;
  prerequisites?: string[];
  learningObjectives?: string[];
  maxStudents?: number;
  currentEnrollments?: number;
  startDate?: string;
  endDate?: string;
}

export interface WalletInfo {
  publicKey: string;
  network: 'testnet' | 'mainnet';
  connected: boolean;
  walletType?: string;
  balance?: number;
}

export interface PaymentDetails {
  courseId: string;
  amount: number;
  currency: string;
  recipientAddress: string;
  memo?: string;
  transactionHash?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  timestamp: string;
}

export interface EnrollmentData {
  studentId: string;
  courseId: string;
  walletAddress: string;
  paymentDetails: PaymentDetails;
  enrollmentDate: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  personalInfo?: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
}

export interface EnrollmentStep {
  id: string;
  title: string;
  description: string;
  component: React.ComponentType<any>;
  validation?: (data: any) => boolean;
  isCompleted: boolean;
}

export interface EnrollmentState {
  currentStep: number;
  steps: EnrollmentStep[];
  course: Course | null;
  wallet: WalletInfo | null;
  enrollment: EnrollmentData | null;
  isLoading: boolean;
  error: string | null;
}

export interface PaymentProcessorProps {
  course: Course;
  wallet: WalletInfo | null;
  onPaymentSuccess: (transactionHash: string) => void;
  onPaymentError: (error: string) => void;
  onPaymentPending: () => void;
}

export interface WalletConnectorProps {
  onWalletConnect: (wallet: WalletInfo) => void;
  onWalletDisconnect: () => void;
  network: 'testnet' | 'mainnet';
}

export interface EnrollmentFormProps {
  course: Course;
  wallet: WalletInfo | null;
  onEnrollmentComplete: (enrollment: EnrollmentData) => void;
  onEnrollmentError: (error: string) => void;
}

export interface TransactionReceipt {
  transactionHash: string;
  status: 'success' | 'failed' | 'pending';
  timestamp: string;
  blockNumber?: number;
  fee?: number;
  amount?: number;
  from: string;
  to: string;
  memo?: string;
}

export interface EnrollmentConfirmation {
  enrollmentId: string;
  transactionReceipt: TransactionReceipt;
  courseAccessGranted: boolean;
  certificateEligibility: boolean;
  nextSteps: string[];
}

export interface ErrorResponse {
  message: string;
  code?: string;
  details?: any;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ErrorResponse;
  message?: string;
}
