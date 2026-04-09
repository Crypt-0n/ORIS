import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <>
      {/* Red gradient border overlay — no layout shift */}
      <div
        className="fixed inset-0 z-[60] pointer-events-none"
        style={{
          boxShadow: 'inset 0 0 0 3px rgba(220, 38, 38, 0.7), inset 0 0 12px 2px rgba(220, 38, 38, 0.25)',
        }}
      />

      {/* Small floating badge top-center */}
      <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[61] animate-pulse">
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-600 text-white text-xs font-medium shadow-lg shadow-red-500/30">
          <WifiOff className="w-3 h-3" />
          Hors ligne
        </div>
      </div>
    </>
  );
}
