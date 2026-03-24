import { Mic, Search, Sparkles, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

type SpeechRecognitionShape = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult:
    | ((event: {
        results: ArrayLike<ArrayLike<{ transcript: string }>>;
      }) => void)
    | null;
  onerror: (() => void) | null;
};

declare global {
  interface Window {
    webkitSpeechRecognition?: new () => SpeechRecognitionShape;
    SpeechRecognition?: new () => SpeechRecognitionShape;
  }
}

export const SearchBar: React.FC<{
  value: string;
  suggestions: string[];
  resultCountLabel: string;
  onChange: (query: string) => void;
  onSubmit: (query: string) => void;
  onSelectSuggestion: (query: string) => void;
  onVoiceSearch: (transcript: string) => void;
}> = ({
  value,
  suggestions,
  resultCountLabel,
  onChange,
  onSubmit,
  onSelectSuggestion,
  onVoiceSearch,
}) => {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionShape | null>(null);

  useEffect(() => {
    const Recognition =
      typeof window === 'undefined'
        ? undefined
        : window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      recognitionRef.current = null;
      return;
    }

    const recognition = new Recognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript || '';
      setIsListening(false);
      if (transcript) {
        onVoiceSearch(transcript);
      }
    };
    recognition.onerror = () => setIsListening(false);
    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
    };
  }, [onVoiceSearch]);

  const handleStartVoice = () => {
    if (!recognitionRef.current) {
      return;
    }

    setIsListening(true);
    recognitionRef.current.start();
  };

  return (
    <div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            size={18}
          />
          <input
            aria-label="Search courses"
            className="w-full rounded-[18px] border border-slate-200 bg-white py-4 pl-12 pr-12 text-base text-slate-900 outline-none transition focus:border-slate-400"
            placeholder="Search courses, skills, reviews, or learning paths"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                onSubmit(value.trim());
              }
            }}
          />
          {value ? (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              onClick={() => onChange('')}
            >
              <X size={16} />
            </button>
          ) : null}
        </div>

        <button
          className="inline-flex items-center justify-center gap-2 rounded-[18px] bg-slate-900 px-5 py-4 text-sm font-medium text-white transition hover:bg-slate-700"
          onClick={() => onSubmit(value.trim())}
        >
          <Sparkles size={16} />
          Search
        </button>

        <button
          className="inline-flex items-center justify-center gap-2 rounded-[18px] border border-slate-200 px-5 py-4 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-950"
          disabled={!recognitionRef.current || isListening}
          onClick={handleStartVoice}
        >
          <Mic size={16} />
          {isListening ? 'Listening…' : 'Voice'}
        </button>
      </div>

      <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              className="rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-amber-100 hover:text-amber-950"
              onClick={() => onSelectSuggestion(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>

        <div className="text-sm text-slate-500">{resultCountLabel}</div>
      </div>
    </div>
  );
};

export default SearchBar;
