import React from 'react';
import { render, screen } from '@testing-library/react';
import StakingDashboard from '../StakingDashboard';

jest.mock('../../styles/features.css', () => ({}), { virtual: true });

describe('StakingDashboard', () => {
  it('renders the main title', () => {
    render(<StakingDashboard />);
    expect(screen.getByText('LEARNING TOKENOMICS & STAKING')).toBeInTheDocument();
  });

  it('shows balance', () => {
    render(<StakingDashboard />);
    expect(screen.getByText(/BALANCE:/)).toBeInTheDocument();
    expect(screen.getByText(/2,450.80 STARK/)).toBeInTheDocument();
  });

  it('renders token staking pool section', () => {
    render(<StakingDashboard />);
    expect(screen.getByText('Token Staking Pool')).toBeInTheDocument();
  });

  it('renders stake amount input', () => {
    render(<StakingDashboard />);
    const stakeInput = screen.getByDisplayValue('100');
    expect(stakeInput).toBeInTheDocument();
  });

  it('renders APY options', () => {
    render(<StakingDashboard />);
    expect(screen.getByText('APY Options')).toBeInTheDocument();
  });

  it('shows active stakes section', () => {
    render(<StakingDashboard />);
    expect(screen.getByText('Your Active Stakes')).toBeInTheDocument();
  });

  it('renders rewards section', () => {
    render(<StakingDashboard />);
    expect(screen.getByText('Rewards & Earnings')).toBeInTheDocument();
  });
});