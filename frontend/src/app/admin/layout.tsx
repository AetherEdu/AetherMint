import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import AdminSidebar from '@/components/Admin/AdminSidebar';
import AdminHeader from '@/components/Admin/AdminHeader';
import { AuthProvider } from '@/contexts/AuthContext';

const inter = Inter({ subsets: ['latin'] });

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
      <div className={`min-h-screen bg-gray-50 ${inter.className}`}>
        <div className="flex flex-col md:flex-row">
          <nav aria-label="Admin navigation">
            <AdminSidebar />
          </nav>
          <div className="flex-1">
            <header aria-label="Admin header">
              <AdminHeader />
            </header>
            <main
              id="main-content"
              role="main"
              tabIndex={-1}
              className="p-6 focus:outline-none"
            >
              {children}
            </main>
          </div>
        </div>
      </div>
    </AuthProvider>
  );
}