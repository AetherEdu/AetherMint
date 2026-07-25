'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle, AlertTriangle, ExternalLink, Shield, Eye, Keyboard, Volume2, Accessibility } from 'lucide-react';

export default function AccessibilityPage() {
  const [lastUpdated, setLastUpdated] = useState('');

  useEffect(() => {
    setLastUpdated(new Date().toISOString().split('T')[0]);
    document.title = 'Accessibility Statement - AetherMint Education';
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <main id="main-content" tabIndex={-1} role="main" aria-labelledby="accessibility-heading">
        <div className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <Accessibility className="w-8 h-8 text-blue-600" aria-hidden="true" />
              <h1 id="accessibility-heading" className="text-3xl sm:text-4xl font-bold text-gray-900">
                Accessibility Statement
              </h1>
            </div>
            <p className="text-gray-600 text-lg">
              AetherMint Education is committed to ensuring digital accessibility for people with disabilities.
              We are continually improving the user experience for everyone and applying the relevant accessibility standards.
            </p>
            {lastUpdated && (
              <p className="text-sm text-gray-500 mt-2">
                Last updated: <time dateTime={lastUpdated}>{lastUpdated}</time>
              </p>
            )}
          </div>

          {/* Conformance Status */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8" aria-labelledby="conformance-heading">
            <h2 id="conformance-heading" className="text-2xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CheckCircle className="w-6 h-6 text-green-500" aria-hidden="true" />
              Conformance Status
            </h2>
            <p className="text-gray-700 mb-4">
              The Web Content Accessibility Guidelines (WCAG) defines requirements for designers and developers
              to improve accessibility for people with disabilities. It defines three levels of conformance:
              Level A, Level AA, and Level AAA.
            </p>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-800 font-medium">
                AetherMint Education is partially conformant with WCAG 2.1 Level AA.
              </p>
              <p className="text-green-700 text-sm mt-1">
                Partially conformant means that some parts of the content do not yet fully conform to the accessibility standard.
              </p>
            </div>
          </section>

          {/* Accessibility Features */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8" aria-labelledby="features-heading">
            <h2 id="features-heading" className="text-2xl font-semibold text-gray-900 mb-6">Accessibility Features</h2>
            
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="flex gap-3">
                <Keyboard className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" aria-hidden="true" />
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Keyboard Navigation</h3>
                  <p className="text-gray-600 text-sm">
                    Full keyboard navigation support with visible focus indicators, logical tab order,
                    and skip-to-content links for efficient access.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Eye className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" aria-hidden="true" />
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Screen Reader & Visual</h3>
                  <p className="text-gray-600 text-sm">
                    ARIA landmarks, labels, and live regions for screen reader compatibility.
                    High contrast mode, dyslexia-friendly fonts, and color blindness support.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Volume2 className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" aria-hidden="true" />
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Audio & Visual Aids</h3>
                  <p className="text-gray-600 text-sm">
                    Text-to-speech support, audio descriptions for visual content,
                    captions and transcripts for video content.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Shield className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" aria-hidden="true" />
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Adaptive Settings</h3>
                  <p className="text-gray-600 text-sm">
                    Customizable font sizes, text spacing, reduced motion, simplified interface mode,
                    and extended timeouts for all interactive elements.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Measures Taken */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8" aria-labelledby="measures-heading">
            <h2 id="measures-heading" className="text-2xl font-semibold text-gray-900 mb-4">Measures to Support Accessibility</h2>
            <p className="text-gray-700 mb-4">
              AetherMint Education takes the following measures to ensure accessibility:
            </p>
            <ul className="space-y-3" role="list">
              {[
                'Accessibility is part of our internal policies and continuous integration pipeline.',
                'Automated axe-core audits run on every pull request to catch regressions.',
                'Regular manual keyboard navigation audits of all user flows.',
                'Screen reader testing with NVDA, JAWS, and VoiceOver across all pages.',
                'Color contrast validation against WCAG 2.1 AA requirements.',
                'Focus management for modals, drawers, and dynamically rendered content.',
                'Accessibility training provided to all developers and content creators.',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <span className="text-gray-700">{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Known Limitations */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8" aria-labelledby="limitations-heading">
            <h2 id="limitations-heading" className="text-2xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-yellow-500" aria-hidden="true" />
              Known Limitations
            </h2>
            <p className="text-gray-700 mb-4">
              Despite our best efforts, users may experience some issues. Known limitations include:
            </p>
            <ul className="space-y-3" role="list">
              {[
                'Some third-party embedded content (e.g., wallet integrations) may not fully meet WCAG standards.',
                'Interactive 3D/VR components may have limited screen reader support due to WebGL constraints.',
                'Older course content uploaded before our accessibility initiative may lack complete alt text.',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <span className="text-gray-700">{item}</span>
                </li>
              ))}
            </ul>
            <p className="text-gray-600 text-sm mt-4">
              We are actively working to address these limitations. If you encounter an accessibility barrier,
              please contact us so we can prioritize a fix.
            </p>
          </section>

          {/* Technical Information */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8" aria-labelledby="technical-heading">
            <h2 id="technical-heading" className="text-2xl font-semibold text-gray-900 mb-4">Technical Specifications</h2>
            <div className="space-y-3 text-gray-700">
              <p>
                Accessibility of AetherMint Education relies on the following technologies to work with
                the particular combination of web browser and any assistive technologies or plugins installed:
              </p>
              <ul className="list-disc list-inside space-y-1">
                <li>HTML5</li>
                <li>WAI-ARIA</li>
                <li>CSS</li>
                <li>JavaScript (React/Next.js)</li>
                <li>Web Speech API (for text-to-speech)</li>
              </ul>
              <p>
                These technologies are relied upon for conformance with the accessibility standards used.
              </p>
            </div>
          </section>

          {/* Assessment Approach */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8" aria-labelledby="assessment-heading">
            <h2 id="assessment-heading" className="text-2xl font-semibold text-gray-900 mb-4">Assessment Approach</h2>
            <p className="text-gray-700 mb-4">
              AetherMint Education assessed the accessibility of this platform by the following approaches:
            </p>
            <ul className="space-y-3" role="list">
              {[
                'Automated accessibility testing via axe-core integrated into our CI/CD pipeline.',
                'Manual keyboard-only navigation testing across all user flows.',
                'Screen reader compatibility testing with NVDA, JAWS, and VoiceOver.',
                'Color contrast analysis using WCAG 2.1 AA ratio requirements (4.5:1 for normal text, 3:1 for large text).',
                'Focus order verification for all interactive components including modals, drawers, and dynamic content.',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <span className="text-gray-700">{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Feedback & Contact */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8" aria-labelledby="feedback-heading">
            <h2 id="feedback-heading" className="text-2xl font-semibold text-gray-900 mb-4">Feedback & Contact</h2>
            <p className="text-gray-700 mb-4">
              We welcome your feedback on the accessibility of AetherMint Education.
              Please let us know if you encounter accessibility barriers:
            </p>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">Email:</span>
                <a href="mailto:accessibility@aethermint.com" className="text-blue-600 hover:text-blue-800 underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded">
                  accessibility@aethermint.com
                </a>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">GitHub:</span>
                <a
                  href="https://github.com/AetherEdu/AetherMint/issues/new"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline inline-flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
                >
                  Open an accessibility issue
                  <ExternalLink className="w-3 h-3" aria-hidden="true" />
                  <span className="sr-only">(opens in new tab)</span>
                </a>
              </div>
            </div>
            <p className="text-gray-600 text-sm mt-4">
              We aim to respond to accessibility feedback within 3 business days and to propose
              a solution within 10 business days.
            </p>
          </section>

          {/* Quick Links */}
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Back to Home
            </Link>
            <Link
              href="/settings"
              className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              Accessibility Settings
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
