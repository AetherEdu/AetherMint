import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Accessibility Statement',
  description:
    'Our commitment to digital accessibility and WCAG 2.1 AA conformance.',
};

const LAST_REVIEWED = 'January 15, 2025';

export default function AccessibilityPage() {
  return (
    <main
      id="main-content"
      className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8"
    >
      <header className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          Accessibility Statement
        </h1>
        <p className="mt-4 text-base text-gray-600">
          We are committed to ensuring digital accessibility for people with
          disabilities. We continually improve the user experience for everyone
          and apply the relevant accessibility standards.
        </p>
        <p className="mt-2 text-sm text-gray-500">
          <span className="font-medium">Last reviewed:</span>{' '}
          <time dateTime="2025-01-15">{LAST_REVIEWED}</time>
        </p>
      </header>

      <section aria-labelledby="conformance-heading" className="mb-10">
        <h2
          id="conformance-heading"
          className="text-2xl font-semibold text-gray-900"
        >
          Conformance Status
        </h2>
        <p className="mt-3 text-base text-gray-700">
          The{' '}
          <a
            href="https://www.w3.org/WAI/standards-guidelines/wcag/"
            className="text-blue-700 underline hover:text-blue-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            target="_blank"
            rel="noopener noreferrer"
          >
            Web Content Accessibility Guidelines (WCAG) 2.1
          </a>{' '}
          defines requirements for designers and developers to improve
          accessibility for people with disabilities. It defines three levels of
          conformance: Level A, Level AA, and Level AAA.
        </p>
        <p className="mt-3 text-base text-gray-700">
          This website is{' '}
          <strong>partially conformant with WCAG 2.1 Level AA</strong>. Partially
          conformant means that some parts of the content do not fully conform
          to the accessibility standard. Known limitations are listed below.
        </p>
      </section>

      <section aria-labelledby="measures-heading" className="mb-10">
        <h2
          id="measures-heading"
          className="text-2xl font-semibold text-gray-900"
        >
          Measures We Take
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-6 text-base text-gray-700">
          <li>
            Automated accessibility testing with axe-core is integrated into our
            continuous integration pipeline.
          </li>
          <li>
            Manual keyboard navigation audits are performed across all core user
            flows.
          </li>
          <li>
            Screen reader compatibility is verified using assistive technologies
            such as NVDA, JAWS, and VoiceOver.
          </li>
          <li>
            Color contrast is checked against WCAG 2.1 AA contrast ratio
            requirements.
          </li>
          <li>
            Focus management is implemented for modals, drawers, and dynamically
            loaded content.
          </li>
        </ul>
      </section>

      <section aria-labelledby="limitations-heading" className="mb-10">
        <h2
          id="limitations-heading"
          className="text-2xl font-semibold text-gray-900"
        >
          Known Limitations
        </h2>
        <p className="mt-3 text-base text-gray-700">
          Despite our best efforts, some limitations may exist. Below is a
          description of known limitations and potential solutions. Please
          contact us if you encounter an issue not listed here.
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-6 text-base text-gray-700">
          <li>
            Some third-party embedded content may not fully conform to WCAG 2.1
            AA. We are working with vendors to improve conformance.
          </li>
          <li>
            Certain legacy documents and downloadable files may not be fully
            accessible. Accessible alternatives are available upon request.
          </li>
          <li>
            Some complex data visualizations may have limited screen reader
            support. Text-based summaries are provided where possible.
          </li>
        </ul>
      </section>

      <section aria-labelledby="feedback-heading" className="mb-10">
        <h2
          id="feedback-heading"
          className="text-2xl font-semibold text-gray-900"
        >
          Feedback and Contact
        </h2>
        <p className="mt-3 text-base text-gray-700">
          We welcome your feedback on the accessibility of this website. If you
          encounter accessibility barriers or need content in an alternative
          format, please contact us:
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-6 text-base text-gray-700">
          <li>
            Email:{' '}
            <a
              href="mailto:accessibility@example.com"
              className="text-blue-700 underline hover:text-blue-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              accessibility@example.com
            </a>
          </li>
          <li>
            Phone:{' '}
            <a
              href="tel:+18005550100"
              className="text-blue-700 underline hover:text-blue-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              +1 (800) 555-0100
            </a>
          </li>
        </ul>
        <p className="mt-3 text-base text-gray-700">
          We aim to respond to accessibility feedback within 5 business days.
        </p>
      </section>

      <section aria-labelledby="enforcement-heading" className="mb-10">
        <h2
          id="enforcement-heading"
          className="text-2xl font-semibold text-gray-900"
        >
          Enforcement
        </h2>
        <p className="mt-3 text-base text-gray-700">
          If you are not satisfied with our response, you may escalate your
          concern through the appropriate regulatory or enforcement channels in
          your jurisdiction.
        </p>
      </section>

      <footer className="border-t border-gray-200 pt-6">
        <p className="text-sm text-gray-500">
          This statement was last reviewed on{' '}
          <time dateTime="2025-01-15">{LAST_REVIEWED}</time>.
        </p>
        <p className="mt-2 text-sm text-gray-500">
          <Link
            href="/"
            className="text-blue-700 underline hover:text-blue-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            Return to home
          </Link>
        </p>
      </footer>
    </main>
  );
}