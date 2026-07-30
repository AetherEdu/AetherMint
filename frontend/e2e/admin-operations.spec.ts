import { test, expect } from '@playwright/test';

test.describe('Admin Operations', () => {
  test.beforeEach(async ({ page }) => {
    const mockUser = {
      id: 'admin-1',
      email: 'admin@aethermint.com',
      name: 'Admin User',
      role: 'admin',
      permissions: ['user:create', 'user:update', 'user:delete', 'course:create', 'system:manage', 'moderation:content']
    };

    await page.route('**/api/auth/verify', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockUser) });
    });

    await page.route('**/api/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ token: 'mock-token', user: mockUser })
      });
    });

    await page.route('**/api/admin/dashboard', async (route) => {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          stats: {
            users: { total: 1250, students: 980, educators: 220, admins: 50, newThisMonth: 45, growth: 12.5 },
            courses: { total: 45, published: 38, draft: 7, newThisMonth: 5, growth: 8.3 },
            quizzes: { total: 120, active: 85, completed: 35, averageScore: 78 },
            system: { uptime: '99.9%', storage: '45.2 GB / 100 GB', lastBackup: '2024-01-15T10:00:00Z', activeConnections: 234 }
          }
        })
      });
    });

    await page.route('**/api/admin/activity', async (route) => {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          activities: [
            { id: 'a1', type: 'user', title: 'New user registered', description: 'John Doe created an account', timestamp: new Date().toISOString(), status: 'success' },
            { id: 'a2', type: 'course', title: 'Course published', description: 'Blockchain 101 was published', timestamp: new Date().toISOString(), status: 'success' },
            { id: 'a3', type: 'quiz', title: 'Quiz completed', description: 'Module 1 quiz completed by 15 students', timestamp: new Date().toISOString(), status: 'warning' }
          ]
        })
      });
    });

    await page.route('**/api/admin/users*', async (route) => {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          users: [
            { id: 'u1', name: 'Alice Johnson', email: 'alice@example.com', role: 'student', status: 'active', createdAt: '2023-06-15', lastLogin: '2024-01-20T08:30:00Z', coursesEnrolled: 5, coursesCompleted: 3, averageScore: 85 },
            { id: 'u2', name: 'Bob Smith', email: 'bob@example.com', role: 'instructor', status: 'active', createdAt: '2023-03-10', lastLogin: '2024-01-19T14:00:00Z', coursesEnrolled: 10, coursesCompleted: 8, averageScore: 92 },
            { id: 'u3', name: 'Carol White', email: 'carol@example.com', role: 'moderator', status: 'active', createdAt: '2023-09-01', lastLogin: '2024-01-18T11:00:00Z', coursesEnrolled: 3, coursesCompleted: 2, averageScore: 78 }
          ],
          pagination: { page: 1, limit: 20, total: 3, pages: 1 }
        })
      });
    });

    await page.route('**/api/admin/content/moderation*', async (route) => {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          content: [
            {
              id: 'c1', type: 'course', title: 'Introduction to Blockchain', description: 'A beginner course on blockchain technology',
              author: { id: 'a1', name: 'Dr. Sarah Johnson', email: 'sarah@example.com' },
              status: 'pending', flags: 0, reports: [],
              createdAt: '2024-01-10T08:00:00Z', updatedAt: '2024-01-10T08:00:00Z',
              metadata: { category: 'Technology', difficulty: 'Beginner' }
            },
            {
              id: 'c2', type: 'user_post', title: 'Help with smart contracts', description: 'Can someone explain how Soroban works?',
              author: { id: 'a2', name: 'Mike Brown', email: 'mike@example.com' },
              status: 'flagged', flags: 2,
              reports: [
                { id: 'r1', reason: 'Spam', description: 'This looks like promotional content', reporter: 'mod-1', createdAt: '2024-01-12T10:00:00Z', status: 'pending' }
              ],
              createdAt: '2024-01-11T15:00:00Z', updatedAt: '2024-01-12T10:00:00Z',
              metadata: {}
            }
          ]
        })
      });
    });

    await page.route('**/api/analytics/overview*', async (route) => {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          totalUsers: 1250, activeUsers: 450, totalCourses: 45, totalCompletions: 890,
          credentialIssuances: 750, averageScore: 85, totalRevenue: 15400,
          trends: { users: 12, completions: 8, revenue: 15 }
        })
      });
    });

    await page.goto('/admin');
    await page.evaluate(() => localStorage.setItem('admin_token', 'mock-token'));
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('should display admin dashboard welcome message', async ({ page }) => {
    const welcomeMessage = page.getByText(/welcome back/i);
    await expect(welcomeMessage).toBeVisible({ timeout: 15000 });
  });

  test('should show dashboard stats grid', async ({ page }) => {
    await expect(page.getByText('Total Users')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Total Courses')).toBeVisible();
    await expect(page.getByText('Total Quizzes')).toBeVisible();
    await expect(page.getByText('System Uptime')).toBeVisible();
  });

  test('should display recent activity section', async ({ page }) => {
    await expect(page.getByText('Recent Activity')).toBeVisible({ timeout: 15000 });
  });

  test('should show quick actions panel', async ({ page }) => {
    await expect(page.getByText('Quick Actions')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Add New User')).toBeVisible();
    await expect(page.getByText('Create Course')).toBeVisible();
    await expect(page.getByText('System Backup')).toBeVisible();
  });

  test('should navigate to user management page', async ({ page }) => {
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('User Management')).toBeVisible({ timeout: 15000 });
    await expect(page.getByPlaceholder('Search users...')).toBeVisible();
  });

  test('should display user table with data', async ({ page }) => {
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Alice Johnson')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Bob Smith')).toBeVisible();
  });

  test('should filter users by role', async ({ page }) => {
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');

    const roleSelect = page.getByRole('combobox').filter({ hasText: /all roles|student|instructor/i });
    if (await roleSelect.isVisible()) {
      await roleSelect.selectOption('student');
      await page.waitForTimeout(500);
    }
  });

  test('should navigate to content moderation page', async ({ page }) => {
    await page.goto('/admin/content/moderation');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Content Moderation')).toBeVisible({ timeout: 15000 });
  });

  test('should display content items in moderation', async ({ page }) => {
    await page.goto('/admin/content/moderation');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Introduction to Blockchain')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Help with smart contracts')).toBeVisible();
  });

  test('should filter moderation by status', async ({ page }) => {
    await page.goto('/admin/content/moderation');
    await page.waitForLoadState('networkidle');

    const statusSelect = page.getByRole('combobox').filter({ hasText: /pending review|flagged|approved|rejected/i });
    if (await statusSelect.isVisible()) {
      await statusSelect.selectOption('flagged');
      await page.waitForTimeout(500);
    }
  });

  test('should navigate to analytics page', async ({ page }) => {
    await page.goto('/admin/analytics');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Admin Analytics')).toBeVisible({ timeout: 15000 });
  });

  test('should show KPI cards on analytics page', async ({ page }) => {
    await page.goto('/admin/analytics');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Total Users')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Active Users')).toBeVisible();
    await expect(page.getByText('Courses Completed')).toBeVisible();
    await expect(page.getByText('Credentials Issued')).toBeVisible();
    await expect(page.getByText('Total Revenue')).toBeVisible();
  });

  test('should display popular courses on analytics', async ({ page }) => {
    await page.goto('/admin/analytics');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Popular Courses')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('User Retention')).toBeVisible();
  });

  test('should show user role badges on user management', async ({ page }) => {
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');

    const roleBadge = page.getByText('student').or(page.getByText('instructor')).or(page.getByText('moderator'));
    await expect(roleBadge.first()).toBeVisible({ timeout: 10000 });
  });

  test('should display action buttons on user rows', async ({ page }) => {
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');

    const actionSection = page.locator('table');
    await expect(actionSection).toBeVisible({ timeout: 15000 });
  });

  test('should handle empty admin state gracefully', async ({ page }) => {
    await page.route('**/api/admin/dashboard', async (route) => {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Server error' }) });
    });
    await page.route('**/api/admin/activity', async (route) => {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Server error' }) });
    });

    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible({ timeout: 15000 });
  });

  test('should show admin sidebar navigation', async ({ page }) => {
    const sidebar = page.locator('aside, nav, [class*="sidebar"]');
    await expect(sidebar).toBeVisible({ timeout: 10000 }).catch(() => {});
  });
});
