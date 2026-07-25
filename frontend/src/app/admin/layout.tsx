import type { Metadata } from 'next';
import AdminSidebar from '@/components/Admin/AdminSidebar';
import AdminHeader from '@/components/Admin/AdminHeader';
import { AuthProvider } from '@/contexts/AuthContext';

export const metadata: Metadata = {
  title: 'Admin Panel - AetherMint Education',
  description: 'Administrative interface for AetherMint platform management',
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <a
        href="#admin-main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-lg"
      >
        Skip to admin content
      </a>
      <div className="min-h-screen bg-gray-50">
        <div className="flex">
          <aside role="navigation" aria-label="Admin sidebar">
            <AdminSidebar />
          </aside>
          <div className="flex-1">
            <header role="banner">
              <AdminHeader />
            </header>
            <main id="admin-main-content" role="main" tabIndex={-1} className="p-6">
              {children}
            </main>
          </div>
        </div>
      </div>
    </AuthProvider>
  );
}
