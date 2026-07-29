import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VoiceControl } from '../VoiceControl';

jest.mock('../hooks/useVoiceRecognition', () => ({
  useVoiceRecognition: jest.fn(),
}));

jest.mock('../services/voiceCommandProcessor', () => ({
  VoiceCommandProcessor: {
    parse: jest.fn(),
  },
}));

import { useVoiceRecognition } from '../hooks/useVoiceRecognition';
import { VoiceCommandProcessor } from '../services/voiceCommandProcessor';

describe('VoiceControl', () => {
  const mockStartListening = jest.fn();
  const mockStopListening = jest.fn();
  const mockResetTranscript = jest.fn();

  const defaultState = {
    isListening: false,
    transcript: '',
    interimTranscript: '',
    startListening: mockStartListening,
    stopListening: mockStopListening,
    resetTranscript: mockResetTranscript,
    error: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useVoiceRecognition as jest.Mock).mockReturnValue(defaultState);
  });

  it('renders microphone button when not listening', () => {
    render(<VoiceControl />);
    expect(screen.getByLabelText('Activate voice control')).toBeInTheDocument();
  });

  it('shows listening state', () => {
    (useVoiceRecognition as jest.Mock).mockReturnValue({ ...defaultState, isListening: true });
    render(<VoiceControl />);
    expect(screen.getByLabelText('Deactivate voice control')).toBeInTheDocument();
  });

  it('starts listening when mic button is clicked', async () => {
    const user = userEvent.setup();
    render(<VoiceControl />);
    await user.click(screen.getByLabelText('Activate voice control'));
    expect(mockStartListening).toHaveBeenCalled();
  });

  it('stops listening when mic off button is clicked', async () => {
    (useVoiceRecognition as jest.Mock).mockReturnValue({ ...defaultState, isListening: true });
    const user = userEvent.setup();
    render(<VoiceControl />);
    await user.click(screen.getByLabelText('Deactivate voice control'));
    expect(mockStopListening).toHaveBeenCalled();
  });

  it('shows transcript when available', () => {
    (useVoiceRecognition as jest.Mock).mockReturnValue({ ...defaultState, transcript: 'Hello' });
    render(<VoiceControl />);
    expect(screen.getByText(/Hello/)).toBeInTheDocument();
  });

  it('shows interim transcript', () => {
    (useVoiceRecognition as jest.Mock).mockReturnValue({ ...defaultState, interimTranscript: 'speaking...' });
    render(<VoiceControl />);
    expect(screen.getByText(/speaking/)).toBeInTheDocument();
  });

  it('shows error state', () => {
    (useVoiceRecognition as jest.Mock).mockReturnValue({ ...defaultState, error: 'Microphone not found' });
    render(<VoiceControl />);
    expect(screen.getByText(/Microphone not found/)).toBeInTheDocument();
  });
});