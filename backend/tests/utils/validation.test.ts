import { validateSchema, isEmail, validateAssignment, validateSubmission, validateCourse } from '../../src/utils/validation';
import { z } from 'zod';

describe('Validation Utilities', () => {
  describe('validateSchema', () => {
    it('should return valid for correct data', () => {
      const schema = z.object({ name: z.string() });
      const result = validateSchema(schema, { name: 'test' });
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should return errors for invalid data', () => {
      const schema = z.object({ age: z.number().min(18) });
      const result = validateSchema(schema, { age: 16 });
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('isEmail', () => {
    it('should return true for valid email', () => {
      expect(isEmail('test@example.com')).toBe(true);
      expect(isEmail('user.name@domain.co')).toBe(true);
    });

    it('should return false for invalid email', () => {
      expect(isEmail('invalid')).toBe(false);
      expect(isEmail('test@')).toBe(false);
      expect(isEmail('@domain.com')).toBe(false);
    });
  });

  describe('validateAssignment', () => {
    it('should validate valid assignment data', () => {
      const validData = {
        title: 'Test Assignment',
        dueDate: '2024-12-31T23:59:59Z',
        courseId: '123e4567-e89b-12d3-a456-426614174000',
      };
      const result = validateAssignment(validData);
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid assignment data', () => {
      const invalidData = {
        title: 'T', // too short
        dueDate: 'invalid',
      };
      const result = validateAssignment(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(expect.any(Number));
    });
  });
});