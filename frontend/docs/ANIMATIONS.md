# Animation System — AetherMint Frontend

> Implements GitHub Issue #283: **[Frontend] Implement animated page transitions and micro-interactions**

## Overview

All animations use **framer-motion** (already a project dependency, v10) and respect the user's `prefers-reduced-motion` OS setting per WCAG 2.1 SC 2.3.3.

---

## Components & Hooks

### `useReducedMotion` — `src/hooks/useReducedMotion.ts`

Reactive hook that reads the `prefers-reduced-motion: reduce` media query.

```tsx
import { useReducedMotion } from '@/hooks/useReducedMotion';

function MyComponent() {
  const reduced = useReducedMotion();
  // Skip animation when `reduced` is true
}
```

---

### `useScrollReveal` — `src/hooks/useScrollReveal.ts`

IntersectionObserver hook that returns `[ref, isVisible]`. Immediately resolves to `true` when reduced-motion is active so content is never hidden.

```tsx
import { useScrollReveal } from '@/hooks/useScrollReveal';

function Section() {
  const [ref, isVisible] = useScrollReveal<HTMLDivElement>({ threshold: 0.1 });
  return <div ref={ref} style={{ opacity: isVisible ? 1 : 0 }}>...</div>;
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `threshold` | `0.15` | Fraction of element visible before triggering |
| `rootMargin` | `"0px 0px -40px 0px"` | IntersectionObserver margin |
| `once` | `true` | Stop observing after first reveal |

---

### `<PageTransition>` — `src/components/PageTransition.tsx`

Fade + upward-slide entrance animation. Wraps `AnimatePresence` + `motion.div`.

**App Router** — already wired in `src/app/layout.tsx`:
```tsx
<PageTransition>{children}</PageTransition>
```

**Pages Router** — already wired in `src/pages/_app.tsx`:
```tsx
<PageTransition routeKey={router.asPath}>
  <Component {...pageProps} />
</PageTransition>
```

| Prop | Type | Description |
|------|------|-------------|
| `routeKey` | `string?` | Unique key for AnimatePresence (use `router.asPath` in Pages Router) |
| `className` | `string?` | Applied to the wrapper element |

Reduced-motion: renders a plain `<div>` with no animation.

---

### `<LoadingSpinner>` — `src/components/ui/LoadingSpinner.tsx`

Branded spinner with a blue → indigo SVG gradient arc. Replaces the generic `Loader2` icon for prominent loading states.

```tsx
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

<LoadingSpinner size="md" label="Loading credentials…" showLabel />
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `size` | `"sm" \| "md" \| "lg" \| "xl"` | `"md"` | 20 / 32 / 48 / 64 px |
| `label` | `string` | `"Loading…"` | Accessible ARIA label |
| `showLabel` | `boolean` | `false` | Renders visible text below spinner |

Reduced-motion: falls back to a CSS `border-t-transparent` spin (no framer-motion).  
Accessibility: `role="status"` + visually-hidden `<span>` for screen readers.

---

### `<ScrollReveal>` — `src/components/ScrollReveal.tsx`

Drop-in wrapper that animates children in as they scroll into view.

```tsx
import { ScrollReveal } from '@/components/ScrollReveal';

<ScrollReveal direction="up" delay={0.1}>
  <CourseCard ... />
</ScrollReveal>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `direction` | `"up" \| "down" \| "left" \| "right" \| "none"` | `"up"` | Translate direction |
| `delay` | `number` | `0` | Seconds before animation begins (good for stagger) |
| `duration` | `number` | `0.45` | Animation duration in seconds |
| `threshold` | `number` | `0.15` | Visibility fraction before reveal |
| `className` | `string?` | — | Applied to the wrapper |

Reduced-motion: `useScrollReveal` immediately returns `isVisible = true`, so elements are rendered visible with no translate/fade.

---

### `animatedToast` — `src/components/ui/animatedToast.tsx`

Wrapper around `react-hot-toast` with branded success / error / info / warning styles and a slide-in animation.

```tsx
import { animatedToast } from '@/components/ui/animatedToast';

animatedToast.success('Credential issued!');
animatedToast.error('Transaction failed.');
animatedToast.info('Syncing with Stellar network…');
animatedToast.warning('Wallet not connected.');
```

All methods accept an optional second argument (`ToastOptions`) forwarded to `react-hot-toast`.

Reduced-motion: omits the CSS keyframe animation, showing the toast instantly.

---

### `<Button>` (updated) — `src/components/ui/button.tsx`

The existing `Button` component now adds framer-motion micro-interactions:

- **Hover**: `scale(1.02)` over 150 ms
- **Active / tap**: `scale(0.97)`
- **Focus**: unchanged — handled by existing `:focus-visible` CSS in `globals.css`

No API changes. The `asChild` Radix Slot pattern is preserved.  
Reduced-motion: degrades to a plain `<button>` with no scale transitions.

---

## Stagger Pattern

To stagger multiple `<ScrollReveal>` items (e.g., a card grid):

```tsx
{courses.map((course, i) => (
  <ScrollReveal key={course.id} direction="up" delay={i * 0.05}>
    <CourseCard course={course} />
  </ScrollReveal>
))}
```

---

## Accessibility

| Concern | Implementation |
|---------|----------------|
| `prefers-reduced-motion` | All components check `useReducedMotion()` / framer-motion's `useReducedMotion()` and skip or simplify animations |
| Screen reader loading states | `LoadingSpinner` uses `role="status"` + `<span className="sr-only">` |
| Toast announcements | `animatedToast` renders with `role="status" aria-live="polite"` |
| Focus indicators | Unchanged — managed by existing `:focus-visible` CSS in `globals.css` |

---

## Testing

New tests live in `src/components/__tests__/animations.test.tsx` (28 tests).

Run:
```bash
npm test -- --testPathPattern animations.test
```
