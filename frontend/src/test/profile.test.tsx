import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ProfileEditor } from '../components/ProfileEditor'
import { AchievementDisplay } from '../components/AchievementDisplay'
import { CredentialList } from '../components/CredentialList'
import { ProfileStats } from '../components/ProfileStats'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { testProfile, testAchievements, testCredentials, testStats } from '../test-profile'

// Suppress console.error during ErrorBoundary tests since React logs caught errors
let consoleErrorSpy: jest.SpyInstance;
beforeEach(() => {
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  consoleErrorSpy.mockRestore();
});

// Mock the useProfile hook
jest.mock('../hooks/useProfile', () => ({
  useProfile: () => ({
    profile: testProfile,
    achievements: testAchievements,
    credentials: testCredentials,
    stats: testStats,
    loading: false,
    error: null,
    updateProfile: jest.fn(),
    reloadProfile: jest.fn(),
  }),
}))

describe('Profile Components', () => {
  describe('ErrorBoundary', () => {
    it('renders children when there is no error', () => {
      render(
        <ErrorBoundary>
          <div>Test Content</div>
        </ErrorBoundary>
      )
      expect(screen.getByText('Test Content')).toBeInTheDocument()
    })

    it('displays error UI when there is an error', () => {
      const ThrowError = () => {
        throw new Error('Test error')
      }
      
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      )
      
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
      expect(screen.getByText('Try Again')).toBeInTheDocument()
    })
  })

  describe('AchievementDisplay', () => {
    it('renders achievements correctly', () => {
      render(<AchievementDisplay achievements={testAchievements} />)
      
      expect(screen.getByText('First Steps')).toBeInTheDocument()
      expect(screen.getByText('Week Warrior')).toBeInTheDocument()
    })

    it('handles empty achievements array', () => {
      render(<AchievementDisplay achievements={[]} />)
      
      expect(screen.getByText('No achievements found')).toBeInTheDocument()
    })

    it('filters achievements by category', () => {
      render(<AchievementDisplay achievements={testAchievements} filterable={true} />)
      
      const categoryFilter = screen.getByText('Category')
      expect(categoryFilter).toBeInTheDocument()
    })
  })

  describe('CredentialList', () => {
    it('renders credentials correctly', () => {
      render(<CredentialList credentials={testCredentials} />)
      
      expect(screen.getByText('TypeScript Certification')).toBeInTheDocument()
      expect(screen.getByText('React Developer')).toBeInTheDocument()
    })

    it('handles empty credentials array', () => {
      render(<CredentialList credentials={[]} />)
      
      expect(screen.getByText('No credentials found')).toBeInTheDocument()
    })
  })

  describe('ProfileStats', () => {
    it('renders statistics correctly', () => {
      render(<ProfileStats stats={testStats} />)
      
      expect(screen.getByText('12')).toBeInTheDocument() // completedCourses
      expect(screen.getByText('7')).toBeInTheDocument() // studyStreak
    })

    it('handles null stats gracefully', () => {
      render(<ProfileStats stats={null} />)
      
      // Should not crash and should show 0 for all stats
      expect(screen.getByText('0')).toBeInTheDocument()
    })
  })

  describe('ProfileEditor', () => {
    it('renders form fields correctly', () => {
      render(<ProfileEditor />)
      
      expect(screen.getByLabelText('Name')).toBeInTheDocument()
      expect(screen.getByLabelText('Email')).toBeInTheDocument()
      expect(screen.getByLabelText('Bio')).toBeInTheDocument()
    })

    it('validates form inputs', async () => {
      render(<ProfileEditor />)
      
      const submitButton = screen.getByText('Save Changes')
      fireEvent.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText('Name is required')).toBeInTheDocument()
      })
    })
  })
})
