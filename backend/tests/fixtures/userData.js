// Test user data fixtures
module.exports = {
  users: {
    validUser: {
      address: 'GD5DJ3B7MHLRWGS7QKXYYEJZRGFQMVJ7T7S6DLPNHP5TGB7FZ7NBHJVP',
      username: 'testuser',
      email: 'test@example.com',
      role: 'instructor',
      bio: 'Test user bio',
      avatar: 'https://example.com/avatar.jpg',
      preferences: {
        theme: 'dark',
        notifications: true,
        language: 'en'
      }
    },
    
    invalidUser: {
      address: 'invalid-address',
      username: 'a', // too short
      email: 'invalid-email',
      bio: 'a'.repeat(501) // too long
    },
    
    adminUser: {
      address: 'GD7YEH5CKZ5J5WDF5Z5J5WDF5Z5J5WDF5Z5J5WDF5Z5J5WDF5Z5J5WDF',
      username: 'admin',
      email: 'admin@example.com',
      role: 'admin',
      permissions: ['manage_users', 'manage_content', 'manage_system']
    }
  },
  
  // Test course data fixtures
  courses: {
    validCourse: {
      title: 'Introduction to Blockchain',
      description: 'Learn the fundamentals of blockchain technology',
      content: {
        sections: [
          {
            id: 'section1',
            title: 'What is Blockchain?',
            content: 'Blockchain is a distributed ledger technology...',
            type: 'text',
            order: 1
          },
          {
            id: 'section2',
            title: 'Cryptographic Basics',
            content: 'Cryptography forms the backbone of blockchain security...',
            type: 'video',
            order: 2,
            metadata: {
              duration: 1200,
              url: 'https://example.com/video.mp4'
            }
          }
        ]
      },
      category: 'blockchain',
      level: 'beginner',
      duration: 3600, // 1 hour in seconds
      price: 0.1, // in XLM
      instructor: 'GD5DJ3B7MHLRWGS7QKXYYEJZRGFQMVJ7T7S6DLPNHP5TGB7FZ7NBHJVP',
      tags: ['blockchain', 'cryptocurrency', 'technology'],
      prerequisites: [],
      learningObjectives: [
        'Understand blockchain fundamentals',
        'Learn about cryptographic principles',
        'Explore real-world applications'
      ]
    },
    
    invalidCourse: {
      title: 'a', // too short
      description: 'short', // too short
      content: null, // missing content
      category: '', // empty
      level: 'invalid', // invalid level
      duration: -1, // negative
      price: 'invalid' // not a number
    },
    
    advancedCourse: {
      title: 'Advanced Smart Contract Development',
      description: 'Deep dive into smart contract programming',
      content: {
        sections: [
          {
            id: 'section1',
            title: 'Solidity Fundamentals',
            content: 'Solidity programming language basics...',
            type: 'code',
            order: 1,
            metadata: {
              language: 'solidity',
              code: 'pragma solidity ^0.8.0;'
            }
          }
        ]
      },
      category: 'smart-contracts',
      level: 'advanced',
      duration: 7200,
      price: 0.5,
      instructor: 'GD7YEH5CKZ5J5WDF5Z5J5WDF5Z5J5WDF5Z5J5WDF5Z5J5WDF5Z5J5WDF',
      tags: ['solidity', 'smart-contracts', 'defi'],
      prerequisites: ['blockchain-basics', 'programming-fundamentals']
    }
  },
  
  // Test credential data fixtures
  credentials: {
    validCredential: {
      type: 'course_completion',
      title: 'Blockchain Fundamentals Certificate',
      description: 'Successfully completed the blockchain fundamentals course',
      recipient: 'GD5DJ3B7MHLRWGS7QKXYYEJZRGFQMVJ7T7S6DLPNHP5TGB7FZ7NBHJVP',
      issuer: 'GD7YEH5CKZ5J5WDF5Z5J5WDF5Z5J5WDF5Z5J5WDF5Z5J5WDF5Z5J5WDF',
      issueDate: new Date('2024-01-15'),
      expiryDate: new Date('2025-01-15'),
      metadata: {
        courseId: 'course_123',
        courseTitle: 'Introduction to Blockchain',
        score: 95,
        grade: 'A',
        verificationCode: 'VC123456789'
      },
      signature: 'mock-signature-123456789',
      ipfsHash: 'QmTest123456789'
    },
    
    expiredCredential: {
      type: 'course_completion',
      title: 'Expired Certificate',
      description: 'This certificate has expired',
      recipient: 'GD5DJ3B7MHLRWGS7QKXYYEJZRGFQMVJ7T7S6DLPNHP5TGB7FZ7NBHJVP',
      issuer: 'GD7YEH5CKZ5J5WDF5Z5J5WDF5Z5J5WDF5Z5J5WDF5Z5J5WDF5Z5J5WDF',
      issueDate: new Date('2023-01-15'),
      expiryDate: new Date('2023-12-15'), // Already expired
      metadata: {
        courseId: 'course_456',
        courseTitle: 'Old Course'
      }
    },
    
    invalidCredential: {
      type: 'invalid_type',
      title: '', // empty
      description: 'short', // too short
      recipient: 'invalid-address',
      issuer: 'invalid-address',
      issueDate: 'invalid-date',
      expiryDate: 'invalid-date'
    }
  },
  
  // Test authentication data
  auth: {
    validLogin: {
      address: 'GD5DJ3B7MHLRWGS7QKXYYEJZRGFQMVJ7T7S6DLPNHP5TGB7FZ7NBHJVP',
      signature: 'valid-signature-123456789',
      message: 'Login to StarkEd Education',
      timestamp: Date.now()
    },
    
    invalidLogin: {
      address: 'invalid-address',
      signature: 'invalid-signature',
      message: '',
      timestamp: Date.now()
    },
    
    expiredLogin: {
      address: 'GD5DJ3B7MHLRWGS7QKXYYEJZRGFQMVJ7T7S6DLPNHP5TGB7FZ7NBHJVP',
      signature: 'valid-signature-123456789',
      message: 'Login to StarkEd Education',
      timestamp: Date.now() - 300000 // 5 minutes ago (expired)
    }
  },
  
  // Test version control data
  versions: {
    validVersion: {
      contentId: 'content_123',
      title: 'Updated Course Content',
      description: 'Updated course content with new sections',
      content: {
        sections: [
          {
            id: 'section1',
            title: 'Updated Section',
            content: 'Updated content here...',
            order: 1
          }
        ]
      },
      changes: ['Updated introduction', 'Added new examples', 'Fixed typos'],
      createdBy: 'GD5DJ3B7MHLRWGS7QKXYYEJZRGFQMVJ7T7S6DLPNHP5TGB7FZ7NBHJVP'
    },
    
    invalidVersion: {
      contentId: '', // empty
      title: 'a', // too short
      description: 'short', // too short
      content: null, // missing
      changes: [], // empty
      createdBy: 'invalid-address'
    }
  },
  
  // Helper functions
  helpers: {
    generateUser: (overrides = {}) => ({
      ...module.exports.users.validUser,
      address: global.testUtils.generateStellarAddress(),
      ...overrides
    }),
    
    generateCourse: (overrides = {}) => ({
      ...module.exports.courses.validCourse,
      ...overrides
    }),
    
    generateCredential: (overrides = {}) => ({
      ...module.exports.credentials.validCredential,
      recipient: global.testUtils.generateStellarAddress(),
      ...overrides
    }),
    
    generateVersion: (overrides = {}) => ({
      ...module.exports.versions.validVersion,
      ...overrides
    })
  }
};
