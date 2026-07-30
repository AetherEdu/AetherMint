import { z } from 'zod';

// Define validation schemas
const EmailSchema = z.string().email({ message: 'Invalid email format' });

const AssignmentSchema = z.object({
  title: z.string().min(3, { message: 'Title must be at least 3 characters' }),
  description: z.string().optional(),
  dueDate: z.string().datetime({ message: 'Invalid due date format' }),
  courseId: z.string().uuid({ message: 'Invalid course ID' }),
});

const SubmissionSchema = z.object({
  studentId: z.string().uuid({ message: 'Invalid student ID' }),
  content: z.string().min(1, { message: 'Content is required' }),
  assignmentId: z.string().uuid({ message: 'Invalid assignment ID' }),
});

/**
 * Validate data against a Zod schema
 */
export const validateSchema = (schema: z.ZodSchema, data: unknown): { isValid: boolean; errors: string[] } => {
  try {
    schema.parse(data);
    return { isValid: true, errors: [] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        isValid: false,
        errors: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
      };
    }
    return { isValid: false, errors: ['Validation failed'] };
  }
};

/**
 * Validate email address
 */
export const isEmail = (email: string): boolean => {
  return EmailSchema.safeParse(email).success;
};

/**
 * Validate assignment data
 */
export const validateAssignment = (data: unknown): { isValid: boolean; errors: string[] } => {
  return validateSchema(AssignmentSchema, data);
};

/**
 * Validate submission data
 */
export const validateSubmission = (data: unknown): { isValid: boolean; errors: string[] } => {
  return validateSchema(SubmissionSchema, data);
};

/**
 * Validate course data
 */
export const validateCourse = (data: unknown): { isValid: boolean; errors: string[] } => {
  const CourseSchema = z.object({
    title: z.string().min(3, { message: 'Title must be at least 3 characters' }),
    description: z.string().min(10, { message: 'Description must be at least 10 characters' }),
    instructorId: z.string().uuid({ message: 'Invalid instructor ID' }),
    price: z.number().min(0, { message: 'Price must be non-negative' }),
  });
  return validateSchema(CourseSchema, data);
};