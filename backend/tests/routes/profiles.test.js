const request = require('supertest');
const app = require('../../src/index');
const userData = require('../fixtures/userData');

// Mock the userService
jest.mock('../../src/services/userService', () => ({
  userService: {
    getProfile: jest.fn(),
    updateProfile: jest.fn(),
    getSettings: jest.fn(),
    updateSettings: jest.fn(),
    getAchievements: jest.fn(),
    getProfileStats: jest.fn()
  }
}));

const { userService } = require('../../src/services/userService');

describe('Profile API Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/users/profile/:address', () => {
    it('should return user profile for valid address', async () => {
      const mockProfile = userData.users.validUser;
      userService.getProfile.mockResolvedValue(mockProfile);

      const response = await request(app)
        .get(`/api/users/profile/${mockProfile.address}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockProfile);
      expect(userService.getProfile).toHaveBeenCalledWith(mockProfile.address);
    });

    it('should return 404 for non-existent profile', async () => {
      userService.getProfile.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/users/profile/GD5DJ3B7MHLRWGS7QKXYYEJZRGFQMVJ7T7S6DLPNHP5TGB7FZ7NBHJVP');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Profile not found');
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should return 500 for server errors', async () => {
      userService.getProfile.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/users/profile/GD5DJ3B7MHLRWGS7QKXYYEJZRGFQMVJ7T7S6DLPNHP5TGB7FZ7NBHJVP');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INTERNAL_ERROR');
    });

    it('should validate address parameter', async () => {
      const response = await request(app)
        .get('/api/users/profile/invalid-address');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('should reject empty address parameter', async () => {
      const response = await request(app)
        .get('/api/users/profile/');

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/users/profile/:address', () => {
    it('should update user profile successfully', async () => {
      const mockProfile = userData.users.validUser;
      const updateData = {
        username: 'updateduser',
        email: 'updated@example.com',
        bio: 'Updated bio'
      };
      const updatedProfile = { ...mockProfile, ...updateData };

      userService.updateProfile.mockResolvedValue(updatedProfile);

      const response = await request(app)
        .put(`/api/users/profile/${mockProfile.address}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(updatedProfile);
      expect(userService.updateProfile).toHaveBeenCalledWith(mockProfile.address, updateData);
    });

    it('should validate username length', async () => {
      const response = await request(app)
        .put('/api/users/profile/GD5DJ3B7MHLRWGS7QKXYYEJZRGFQMVJ7T7S6DLPNHP5TGB7FZ7NBHJVP')
        .send({ username: 'ab' }); // Too short

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors.some(e => e.param === 'username')).toBe(true);
    });

    it('should validate email format', async () => {
      const response = await request(app)
        .put('/api/users/profile/GD5DJ3B7MHLRWGS7QKXYYEJZRGFQMVJ7T7S6DLPNHP5TGB7FZ7NBHJVP')
        .send({ email: 'invalid-email' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors.some(e => e.param === 'email')).toBe(true);
    });

    it('should validate bio length', async () => {
      const response = await request(app)
        .put('/api/users/profile/GD5DJ3B7MHLRWGS7QKXYYEJZRGFQMVJ7T7S6DLPNHP5TGB7FZ7NBHJVP')
        .send({ bio: 'a'.repeat(501) }); // Too long

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors.some(e => e.param === 'bio')).toBe(true);
    });

    it('should validate address parameter', async () => {
      const response = await request(app)
        .put('/api/users/profile/invalid-address')
        .send({ username: 'validuser' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should handle partial updates', async () => {
      const mockProfile = userData.users.validUser;
      const partialUpdate = { username: 'newusername' };
      const updatedProfile = { ...mockProfile, ...partialUpdate };

      userService.updateProfile.mockResolvedValue(updatedProfile);

      const response = await request(app)
        .put(`/api/users/profile/${mockProfile.address}`)
        .send(partialUpdate);

      expect(response.status).toBe(200);
      expect(response.body.username).toBe('newusername');
    });

    it('should return 500 for server errors during update', async () => {
      userService.updateProfile.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .put('/api/users/profile/GD5DJ3B7MHLRWGS7QKXYYEJZRGFQMVJ7T7S6DLPNHP5TGB7FZ7NBHJVP')
        .send({ username: 'testuser' });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('GET /api/users/settings/:userId', () => {
    it('should return user settings', async () => {
      const mockSettings = {
        theme: 'dark',
        notifications: true,
        language: 'en',
        privacy: {
          profileVisibility: 'public',
          showAchievements: true
        }
      };
      userService.getSettings.mockResolvedValue(mockSettings);

      const response = await request(app)
        .get('/api/users/settings/user-123');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockSettings);
      expect(userService.getSettings).toHaveBeenCalledWith('user-123');
    });

    it('should validate userId parameter', async () => {
      const response = await request(app)
        .get('/api/users/settings/');

      expect(response.status).toBe(404);
    });

    it('should return 500 for server errors', async () => {
      userService.getSettings.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/users/settings/user-123');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('PUT /api/users/settings/:userId', () => {
    it('should update user settings successfully', async () => {
      const settingsData = {
        theme: 'light',
        notifications: false,
        language: 'es'
      };
      const updatedSettings = { ...settingsData, userId: 'user-123' };

      userService.updateSettings.mockResolvedValue(updatedSettings);

      const response = await request(app)
        .put('/api/users/settings/user-123')
        .send(settingsData);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(updatedSettings);
      expect(userService.updateSettings).toHaveBeenCalledWith('user-123', settingsData);
    });

    it('should validate settings object', async () => {
      const response = await request(app)
        .put('/api/users/settings/user-123')
        .send('invalid-settings'); // Not an object

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should validate userId parameter', async () => {
      const response = await request(app)
        .put('/api/users/settings/')
        .send({ theme: 'dark' });

      expect(response.status).toBe(404);
    });

    it('should return 500 for server errors during update', async () => {
      userService.updateSettings.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .put('/api/users/settings/user-123')
        .send({ theme: 'dark' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
    });
  });

  describe('GET /api/users/profile/:address/achievements', () => {
    it('should return user achievements', async () => {
      const mockAchievements = [
        {
          id: 'ach1',
          title: 'First Course Completed',
          description: 'Completed your first course',
          earnedAt: new Date('2024-01-15'),
          icon: '🎓',
          rarity: 'common'
        },
        {
          id: 'ach2',
          title: 'Blockchain Expert',
          description: 'Completed all blockchain courses',
          earnedAt: new Date('2024-02-20'),
          icon: '🔗',
          rarity: 'rare'
        }
      ];
      userService.getAchievements.mockResolvedValue(mockAchievements);

      const response = await request(app)
        .get('/api/users/profile/GD5DJ3B7MHLRWGS7QKXYYEJZRGFQMVJ7T7S6DLPNHP5TGB7FZ7NBHJVP/achievements');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockAchievements);
      expect(userService.getAchievements).toHaveBeenCalledWith('GD5DJ3B7MHLRWGS7QKXYYEJZRGFQMVJ7T7S6DLPNHP5TGB7FZ7NBHJVP');
    });

    it('should return empty array for user with no achievements', async () => {
      userService.getAchievements.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/users/profile/GD5DJ3B7MHLRWGS7QKXYYEJZRGFQMVJ7T7S6DLPNHP5TGB7FZ7NBHJVP/achievements');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should return 500 for server errors', async () => {
      userService.getAchievements.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/users/profile/GD5DJ3B7MHLRWGS7QKXYYEJZRGFQMVJ7T7S6DLPNHP5TGB7FZ7NBHJVP/achievements');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
    });
  });

  describe('GET /api/users/profile/:address/stats', () => {
    it('should return user profile statistics', async () => {
      const mockStats = {
        totalCourses: 5,
        completedCourses: 3,
        totalStudyTime: 7200, // seconds
        averageScore: 85.5,
        streakDays: 7,
        lastActive: new Date('2024-03-01'),
        achievementsCount: 8,
        certificatesCount: 3,
        rank: 'intermediate'
      };
      userService.getProfileStats.mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/users/profile/GD5DJ3B7MHLRWGS7QKXYYEJZRGFQMVJ7T7S6DLPNHP5TGB7FZ7NBHJVP/stats');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockStats);
      expect(userService.getProfileStats).toHaveBeenCalledWith('GD5DJ3B7MHLRWGS7QKXYYEJZRGFQMVJ7T7S6DLPNHP5TGB7FZ7NBHJVP');
    });

    it('should return 500 for server errors', async () => {
      userService.getProfileStats.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/users/profile/GD5DJ3B7MHLRWGS7QKXYYEJZRGFQMVJ7T7S6DLPNHP5TGB7FZ7NBHJVP/stats');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed JSON in request body', async () => {
      const response = await request(app)
        .put('/api/users/profile/GD5DJ3B7MHLRWGS7QKXYYEJZRGFQMVJ7T7S6DLPNHP5TGB7FZ7NBHJVP')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}');

      expect(response.status).toBe(400);
    });

    it('should handle extremely long usernames', async () => {
      const response = await request(app)
        .put('/api/users/profile/GD5DJ3B7MHLRWGS7QKXYYEJZRGFQMVJ7T7S6DLPNHP5TGB7FZ7NBHJVP')
        .send({ username: 'a'.repeat(1000) });

      expect(response.status).toBe(400);
      expect(response.body.errors.some(e => e.param === 'username')).toBe(true);
    });

    it('should handle special characters in bio', async () => {
      const mockProfile = userData.users.validUser;
      const bioWithSpecialChars = 'Bio with émojis 🎓 and spëcial charß!';
      const updatedProfile = { ...mockProfile, bio: bioWithSpecialChars };

      userService.updateProfile.mockResolvedValue(updatedProfile);

      const response = await request(app)
        .put(`/api/users/profile/${mockProfile.address}`)
        .send({ bio: bioWithSpecialChars });

      expect(response.status).toBe(200);
      expect(response.body.bio).toBe(bioWithSpecialChars);
    });

    it('should handle concurrent profile updates', async () => {
      const mockProfile = userData.users.validUser;
      const updateData1 = { username: 'user1' };
      const updateData2 = { username: 'user2' };

      userService.updateProfile
        .mockResolvedValueOnce({ ...mockProfile, ...updateData1 })
        .mockResolvedValueOnce({ ...mockProfile, ...updateData2 });

      const [response1, response2] = await Promise.all([
        request(app).put(`/api/users/profile/${mockProfile.address}`).send(updateData1),
        request(app).put(`/api/users/profile/${mockProfile.address}`).send(updateData2)
      ]);

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(userService.updateSettings).toHaveBeenCalledTimes(2);
    });
  });
});
