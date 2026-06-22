import '@testing-library/jest-dom'
import React from 'react'

// Provide a valid Stellar receiver address so the strict env-var validator
// in next.config.js (`zod` schema) doesn't blow up the moment
// `next/jest` loads the config.
if (!process.env.NEXT_PUBLIC_STELLAR_RECEIVER_ADDRESS) {
  process.env.NEXT_PUBLIC_STELLAR_RECEIVER_ADDRESS =
    'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
}


// Mock performance monitoring modules
jest.mock('@/lib/performance-monitor', () => ({
  performanceMonitor: {
    getMetrics: jest.fn(() => []),
    getAlerts: jest.fn(() => []),
    getAverageMetrics: jest.fn(() => ({})),
    clearMetrics: jest.fn(),
    destroy: jest.fn(),
  },
}))

jest.mock('@/lib/performance-reporting', () => ({
  performanceReporting: {
    generateReport: jest.fn(() => ({
      timestamp: Date.now(),
      url: 'test-url',
      metrics: {},
      alerts: [],
      score: 85,
      recommendations: [],
    })),
    analyzeBundle: jest.fn(() => Promise.resolve({})),
    exportReport: jest.fn(() => '{}'),
    sendReportToService: jest.fn(() => Promise.resolve()),
    getHistoricalReports: jest.fn(() => []),
    saveReport: jest.fn(),
  },
}))

jest.mock('@/hooks/usePerformanceMonitoring', () => ({
  usePerformanceMonitoring: jest.fn(() => ({
    metrics: [],
    alerts: [],
    currentReport: null,
    isMonitoring: true,
    startMonitoring: jest.fn(),
    stopMonitoring: jest.fn(),
    generateReport: jest.fn(),
    clearData: jest.fn(),
    averageMetrics: {},
  })),
}))

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter() {
    return {
      route: '/',
      pathname: '/',
      query: '',
      asPath: '',
      push: jest.fn(),
      pop: jest.fn(),
      reload: jest.fn(),
      back: jest.fn(),
      prefetch: jest.fn(),
      beforePopState: jest.fn(),
      events: {
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
      },
    }
  },
}))

// Mock Next.js image
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props) => <img {...props} />,
}))

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
global.localStorage = localStorageMock

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

// Mock performance API for web vitals
global.PerformanceObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  disconnect: jest.fn(),
}))

global.performance = {
  ...global.performance,
  getEntriesByType: jest.fn(() => []),
  mark: jest.fn(),
  measure: jest.fn(),
  now: jest.fn(() => Date.now()),
}
