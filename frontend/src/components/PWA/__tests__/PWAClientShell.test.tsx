import React from 'react';
import { render, screen } from '@testing-library/react';
import PWAClientShell from '../PWAClientShell';

// Dynamic imports need mocking
jest.mock('../ServiceWorkerManager', () => ({
  ServiceWorkerManager: () => null,
}));

jest.mock('../OfflineIndicator', () => ({
  OfflineIndicator: () => null,
}));

describe('PWAClientShell', () => {
  it('renders without crashing', () => {
    const { container } = render(<PWAClientShell />);
    expect(container).toBeInTheDocument();
  });
});