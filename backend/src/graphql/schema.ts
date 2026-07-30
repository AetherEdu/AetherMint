import { gql } from 'apollo-server-express';

export const typeDefs = gql`
  scalar DateTime
  scalar JSON

  enum UserRole {
    student
    educator
    instructor
    admin
    moderator
  }

  enum EnrollmentStatus {
    pending
    confirmed
    active
    completed
    cancelled
    suspended
    refunded
    expired
  }

  enum PaymentStatus {
    pending
    processing
    completed
    failed
    refunded
    partially_refunded
  }

  enum PaymentMethod {
    stellar
    credit_card
    bank_transfer
    crypto
    installment
  }

  enum CourseLevel {
    beginner
    intermediate
    advanced
  }

  enum CourseSortBy {
    relevance
    rating
    price_low
    price_high
    newest
    popular
  }

  type User {
    id: ID!
    email: String
    username: String!
    role: UserRole!
    bio: String
    avatarUrl: String
    address: String
    reputation: Int
    createdAt: DateTime
    updatedAt: DateTime
    achievements: [Achievement!]!
    credentials: [Credential!]!
    enrollments: [Enrollment!]!
    stats: UserStats
  }

  type UserStats {
    totalCourses: Int!
    totalCredentials: Int!
    totalAchievements: Int!
    reputation: Int!
  }

  type Instructor {
    id: ID!
    name: String!
    bio: String
    avatar: String
    rating: Float
  }

  type CourseCategory {
    id: ID!
    name: String!
    description: String
  }

  type CourseMetadata {
    level: CourseLevel!
    duration: Float!
    language: String!
    subtitle: String
    prerequisiteCourses: [ID!]!
    maxStudents: Int!
    isPublished: Boolean!
    createdAt: DateTime
    updatedAt: DateTime
  }

  type Course {
    id: ID!
    title: String!
    description: String!
    shortDescription: String
    category: CourseCategory
    instructor: Instructor
    price: Float!
    originalPrice: Float
    discount: Float
    rating: Float!
    ratingCount: Int!
    enrollmentCount: Int!
    thumbnail: String
    coverImage: String
    tags: [String!]!
    skills: [String!]!
    objectives: [String!]!
    metadata: CourseMetadata
    searchScore: Float
  }

  type CourseConnection {
    courses: [Course!]!
    total: Int!
    page: Int!
    limit: Int!
    hasMore: Boolean!
  }

  type Credential {
    id: ID!
    credentialId: String!
    issuer: String!
    recipient: String!
    credentialHash: String!
    metadata: String
    releaseTime: DateTime!
    createdAt: DateTime!
    isReleased: Boolean!
    isRevoked: Boolean!
    revokeReason: String
    scheduleId: String
  }

  type Enrollment {
    id: ID!
    userId: ID!
    courseId: ID!
    status: EnrollmentStatus!
    enrolledAt: DateTime!
    updatedAt: DateTime!
    completedAt: DateTime
    expiresAt: DateTime
    progress: Float!
    paymentStatus: PaymentStatus!
    paymentMethod: PaymentMethod!
    amountPaid: Float!
    totalAmount: Float!
    currency: String!
    transactionId: String
    stellarTransactionHash: String
    certificateIssued: Boolean!
    certificateId: String
    waitlistPosition: Int
    prerequisitesMet: Boolean!
    notes: String
    user: User
    course: Course
  }

  type Achievement {
    id: ID!
    userId: ID
    badgeId: String
    name: String!
    title: String
    description: String!
    icon: String
    badgeUrl: String
    rarity: String
    category: String
    points: Int
    earnedAt: DateTime
    earnedDate: DateTime
    isEarned: Boolean
    verified: Boolean
  }

  type Analytics {
    userId: ID
    courseId: ID
    recentActivity: JSON
    learningTrend: JSON
    completionRate: Float
    totalEnrollments: Int
    averageProgress: Float
    lastUpdated: DateTime
    raw: JSON
  }

  input CourseFilterInput {
    query: String
    category: String
    level: CourseLevel
    minPrice: Float
    maxPrice: Float
    rating: Float
    language: String
    instructor: String
    tags: [String!]
    sortBy: CourseSortBy
    page: Int
    limit: Int
  }

  input EnrollInCourseInput {
    courseId: ID!
    paymentMethod: PaymentMethod = stellar
    amount: Float = 0
    currency: String = "XLM"
  }

  input IssueCredentialInput {
    issuer: String!
    recipient: String!
    credentialHash: String!
    metadata: String!
    releaseTime: DateTime!
  }

  type Query {
    user(id: ID!): User
    courses(filter: CourseFilterInput): CourseConnection!
    course(id: ID!): Course
    credential(hash: String!): Credential
    enrollment(userId: ID!, courseId: ID!): Enrollment
    enrollments(userId: ID, courseId: ID, page: Int, limit: Int): [Enrollment!]!
    achievements(userId: ID!): [Achievement!]!
    analytics(userId: ID, courseId: ID): Analytics
  }

  type Mutation {
    enrollInCourse(input: EnrollInCourseInput!): Enrollment!
    issueCredential(input: IssueCredentialInput!): Credential!
  }
`;
