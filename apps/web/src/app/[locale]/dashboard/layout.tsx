'use client';

import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Toaster } from 'sonner';

import { Header } from './header';
import { Sidebar } from './sidebar';

import { CommandPalette } from '@/components/command-palette';
import { NotificationsProvider } from '@/components/notifications-provider';
import { useTheme } from '@/components/theme-provider';
import { TourProvider } from '@/components/tour/tour-provider';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  return (
    <NotificationsProvider>
      <TourProvider>
        <div className="flex h-screen overflow-hidden bg-background">
          {/* Mobile backdrop */}
          {mobileMenuOpen && (
            <div
              className="fixed inset-0 z-40 bg-foreground-inverse/50 backdrop-blur-sm lg:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
          )}

          {/* Sidebar */}
          <div
            className={`
          fixed inset-y-0 left-0 z-50 transform transition-all duration-300 ease-out
          lg:relative lg:translate-x-0
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
          ${sidebarCollapsed ? 'lg:w-[72px]' : 'lg:w-[260px]'}
        `}
          >
            <Sidebar
              collapsed={sidebarCollapsed}
              onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
              onMobileClose={() => setMobileMenuOpen(false)}
            />
          </div>

          {/* Main content */}
          <div className="flex flex-1 flex-col overflow-hidden">
            <Header
              onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
              sidebarCollapsed={sidebarCollapsed}
              onSidebarToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
            />
            <main className="flex-1 overflow-y-auto">
              <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
                {children}
              </div>
            </main>
          </div>
        </div>
        <CommandPalette />
        <Toaster
          position="top-right"
          closeButton
          richColors
          theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
        />
      </TourProvider>
    </NotificationsProvider>
  );
}
