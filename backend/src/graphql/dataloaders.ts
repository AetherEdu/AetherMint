import DataLoader from 'dataloader';
import { userService } from '../services/userService';
import { EnrollmentService } from '../services/EnrollmentService';
import { timeLockCredentialService } from '../services/timeLockCredentialService';
import { TimeLockedCredential } from '../models/TimeLockedCredential';
import { Course } from '../models/Course';
import { Enrollment } from '../models/Enrollment';
import { ITimeLockedCredential } from '../models/TimeLockedCredential';
import { UserProfile, Achievement } from '../models/User';

export const enrollmentService = new EnrollmentService();

export interface GraphQLDataLoaders {
  userById: DataLoader<string, UserProfile | null>;
  courseById: DataLoader<string, Course | null>;
  enrollmentById: DataLoader<string, Enrollment | null>;
  enrollmentByUserCourse: DataLoader<string, Enrollment | null>;
  enrollmentsByUserId: DataLoader<string, Enrollment[]>;
  credentialsByRecipient: DataLoader<string, ITimeLockedCredential[]>;
  credentialByHash: DataLoader<string, ITimeLockedCredential | null>;
  achievementsByUserId: DataLoader<string, Achievement[]>;
}

export function userCourseKey(userId: string, courseId: string): string {
  return `${userId}::${courseId}`;
}

function stubCourse(id: string): Course {
  return {
    id,
    title: `Course ${id}`,
    description: '',
    shortDescription: '',
    category: { id: 'unknown', name: 'Unknown', description: '' },
    instructor: { id: 'unknown', name: 'Unknown', bio: '', avatar: '', rating: 0 },
    price: 0,
    rating: 0,
    ratingCount: 0,
    reviews: [],
    enrollmentCount: 0,
    thumbnail: '',
    coverImage: '',
    tags: [],
    skills: [],
    objectives: [],
    curriculum: [],
    metadata: {
      level: 'beginner',
      duration: 0,
      language: 'en',
      subtitle: '',
      prerequisiteCourses: [],
      maxStudents: 0,
      isPublished: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };
}

export function createDataLoaders(): GraphQLDataLoaders {
  const userById = new DataLoader<string, UserProfile | null>(async (ids) => {
    return Promise.all(ids.map((id) => userService.getProfile(id)));
  });

  const courseById = new DataLoader<string, Course | null>(async (ids) => {
    return ids.map((id) => stubCourse(id));
  });

  const enrollmentById = new DataLoader<string, Enrollment | null>(async (ids) => {
    return Promise.all(ids.map((id) => enrollmentService.getEnrollmentById(id)));
  });

  const enrollmentByUserCourse = new DataLoader<string, Enrollment | null>(
    async (keys) => {
      return Promise.all(
        keys.map((key) => {
          const [userId, courseId] = key.split('::');
          return enrollmentService.getUserEnrollmentForCourse(userId, courseId);
        })
      );
    }
  );

  const enrollmentsByUserId = new DataLoader<string, Enrollment[]>(async (userIds) => {
    return Promise.all(
      userIds.map(async (userId) => {
        const result = await enrollmentService.getEnrollments({
          userId,
          page: 1,
          limit: 100,
        });
        return result.enrollments;
      })
    );
  });

  const credentialsByRecipient = new DataLoader<string, ITimeLockedCredential[]>(
    async (recipients) => {
      return Promise.all(
        recipients.map((recipient) =>
          timeLockCredentialService.getCredentialsByRecipient(recipient).catch(() => [])
        )
      );
    }
  );

  const credentialByHash = new DataLoader<string, ITimeLockedCredential | null>(
    async (hashes) => {
      return Promise.all(
        hashes.map((hash) => TimeLockedCredential.findOne({ credentialHash: hash }))
      );
    }
  );

  const achievementsByUserId = new DataLoader<string, Achievement[]>(async (userIds) => {
    return Promise.all(
      userIds.map((userId) => userService.getAchievements(userId).catch(() => []))
    );
  });

  return {
    userById,
    courseById,
    enrollmentById,
    enrollmentByUserCourse,
    enrollmentsByUserId,
    credentialsByRecipient,
    credentialByHash,
    achievementsByUserId,
  };
}
