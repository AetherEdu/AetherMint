'use client';

/**
 * Local LucideIcon-compatible icon stubs.
 *
 * `lucide-react` does not export icon names referenced by several
 * feature components (`Vr`, `Ar`, `Flask`, `Pinch`, `Swipe`, `Weight`).
 * Rather than switching icon libraries we provide lightweight
 * forwardRef-wrapped SVG renderers that honor the standard Lucide
 * props (`size`, `color`, `strokeWidth`) so existing call sites work
 * unchanged.
 */

import * as React from 'react';
import type { LucideProps, LucideIcon } from 'lucide-react';

function normalize(props: LucideProps) {
  const { size, color, strokeWidth, className, ...rest } = props;
  const px = typeof size === 'number' ? size : 24;
  return {
    width: px,
    height: px,
    color,
    strokeWidth,
    className,
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    ...rest,
  } as const;
}

const VrFwd = React.forwardRef<SVGSVGElement, LucideProps>(function Vr(props, ref) {
  return (
    <svg ref={ref} {...normalize(props)}>
      <path d="M3 10c0-1.1.9-2 2-2h4l2-2h2l2 2h4a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3l-3-3h-2l-3 3H5a2 2 0 0 1-2-2z" />
      <circle cx="8" cy="14" r="1.2" />
      <circle cx="16" cy="14" r="1.2" />
    </svg>
  );
});
VrFwd.displayName = 'Vr';
export const Vr = VrFwd as LucideIcon;

const ArFwd = React.forwardRef<SVGSVGElement, LucideProps>(function Ar(props, ref) {
  return (
    <svg ref={ref} {...normalize(props)}>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 12h18" />
    </svg>
  );
});
ArFwd.displayName = 'Ar';
export const Ar = ArFwd as LucideIcon;

const FlaskFwd = React.forwardRef<SVGSVGElement, LucideProps>(function Flask(props, ref) {
  return (
    <svg ref={ref} {...normalize(props)}>
      <path d="M10 2v6L4 18a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3l-6-10V2" />
      <path d="M8 2h8" />
    </svg>
  );
});
FlaskFwd.displayName = 'Flask';
export const Flask = FlaskFwd as LucideIcon;

const PinchFwd = React.forwardRef<SVGSVGElement, LucideProps>(function Pinch(props, ref) {
  return (
    <svg ref={ref} {...normalize(props)}>
      <path d="M12 3v9" />
      <path d="m9 9 3 3 3-3" />
      <path d="M5 13v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
    </svg>
  );
});
PinchFwd.displayName = 'Pinch';
export const Pinch = PinchFwd as LucideIcon;

const SwipeFwd = React.forwardRef<SVGSVGElement, LucideProps>(function Swipe(props, ref) {
  return (
    <svg ref={ref} {...normalize(props)}>
      <path d="M4 12h12" />
      <path d="m13 8 3 4-3 4" />
    </svg>
  );
});
SwipeFwd.displayName = 'Swipe';
export const Swipe = SwipeFwd as LucideIcon;

const WeightFwd = React.forwardRef<SVGSVGElement, LucideProps>(function Weight(props, ref) {
  return (
    <svg ref={ref} {...normalize(props)}>
      <path d="M6 7h12l-1 13H7z" />
      <path d="M9 7V4h6v3" />
    </svg>
  );
});
WeightFwd.displayName = 'Weight';
export const Weight = WeightFwd as LucideIcon;
