import React from 'react';
import { render, screen } from '@testing-library/react';
import { ProfileStats } from '../ProfileStats';

const mockStats = {
  completedCourses: 5,
  totalCourses: 10,
  totalAchievements: 8,
  rareAchievements: 2,
  studyStreak: 7,
  totalStudyHours: 120,
  totalCertificates: 3,
  verifiedCredentials: 10,
  pendingCredentials: 2,
  inProgressCourses: 3,
  averageCompletionTime: 14,
  rank: 42,
  percentile: 85,
};

describe('ProfileStats', () => {
  describe('default view', () => {
    it('renders main stat cards', () => {
      render(<ProfileStats stats={mockStats} />);
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('8')).toBeInTheDocument();
      expect(screen.getByText('7')).toBeInTheDocument();
      expect(screen.getByText('120')).toBeInTheDocument();
    });

    it('displays completion rate', () => {
      render(<ProfileStats stats={mockStats} />);
      expect(screen.getByText('50% Complete')).toBeInTheDocument();
    });

    it('shows ranking section when showRanking is true', () => {
      render(<ProfileStats stats={mockStats} showRanking />);
      expect(screen.getByText('Ranking & Performance')).toBeInTheDocument();
    });

    it('hides ranking section when showRanking is false', () => {
      render(<ProfileStats stats={mockStats} showRanking={false} />);
      expect(screen.queryByText('Ranking & Performance')).not.toBeInTheDocument();
    });

    it('shows progress overview when showProgress is true', () => {
      render(<ProfileStats stats={mockStats} showProgress />);
      expect(screen.getByText('Progress Overview')).toBeInTheDocument();
    });

    it('hides progress overview when showProgress is false', () => {
      render(<ProfileStats stats={mockStats} showProgress={false} />);
      expect(screen.queryByText('Progress Overview')).not.toBeInTheDocument();
    });

    it('shows detailed stats', () => {
      render(<ProfileStats stats={mockStats} />);
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('shows performance score', () => {
      render(<ProfileStats stats={mockStats} />);
      expect(screen.getByText('Performance Score')).toBeInTheDocument();
    });

    it('shows global rank', () => {
      render(<ProfileStats stats={mockStats} />);
      expect(screen.getByText('#42')).toBeInTheDocument();
    });

    it('shows certificates count', () => {
      render(<ProfileStats stats={mockStats} />);
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  describe('compact view', () => {
    it('renders compact stat cards', () => {
      render(<ProfileStats stats={mockStats} compact />);
      expect(screen.getByText('5/10')).toBeInTheDocument();
      expect(screen.getByText('8')).toBeInTheDocument();
      expect(screen.getByText('7')).toBeInTheDocument();
      expect(screen.getByText('120')).toBeInTheDocument();
    });
  });

  describe('null stats', () => {
    it('renders with zero values when stats is null', () => {
      render(<ProfileStats stats={null} />);
      const zeroes = screen.getAllByText('0');
      expect(zeroes.length).toBeGreaterThan(0);
    });

    it('renders compact view with zeroes when stats is null', () => {
      render(<ProfileStats stats={null} compact />);
      const zeroes = screen.getAllByText('0');
      expect(zeroes.length).toBeGreaterThan(0);
    });
  });
});