'use client';

/**
 * MobileNavShell
 * -------------------------------------------------------------------------
 * Client wrapper that mounts the app-router mobile navigation in
 * `app/layout.tsx`. `MobileNav` needs the current path and a navigate
 * callback; both come from the client-only `next/navigation` hooks, which
 * can't run in the Server Component layout directly. Mirrors the
 * `PWAClientShell` pattern: a tiny client boundary owned by the layout.
 */

import { usePathname, useRouter } from 'next/navigation';
import { MobileNav } from './MobileNav';

export default function MobileNavShell() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <MobileNav
      currentPath={pathname ?? '/'}
      onNavigate={(path) => router.push(path)}
    />
  );
}
