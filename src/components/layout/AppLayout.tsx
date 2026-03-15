import { ReactNode } from 'react';
import { Topbar } from './Topbar';
import { BottomBar } from './BottomBar';
import { OfflineBanner } from '../OfflineBanner';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <Topbar />
      <OfflineBanner />
      <main className="pt-14 pb-20 lg:pb-0 min-h-screen overflow-x-clip">
        {children}
      </main>
      <BottomBar />
    </div>
  );
}
