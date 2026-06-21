/**
 * Ambient module declarations for libraries whose TypeScript types are not
 * present or are only available at runtime. These stubs are intentionally
 * permissive so consumers can be type-checked without depending on the
 * original packages.
 */

declare module 'brainflow';
declare module 'react-day-picker';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string;
          alt?: string;
          'camera-controls'?: boolean | string;
          'auto-rotate'?: boolean | string;
          'shadow-intensity'?: number | string;
          ar?: boolean | string;
          'environment-image'?: string;
          exposure?: number | string;
          poster?: string;
          loading?: 'auto' | 'eager' | 'lazy' | string;
          reveal?: 'auto' | 'manual' | string;
        },
        HTMLElement
      >;
    }
  }
}

export {};
