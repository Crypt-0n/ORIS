import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../lib/api';

interface KillChainContextType {
  activeKillChain: string;
  loading: boolean;
  error: Error | null;
}

const KillChainContext = createContext<KillChainContextType | undefined>(undefined);

export const KillChainProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeKillChain, setActiveKillChain] = useState<string>('mitre_attack');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const data = await api.get('/config');
        if (data && data.default_kill_chain_type) {
          setActiveKillChain(data.default_kill_chain_type);
        }
      } catch (err) {
        console.error('Failed to load active kill chain from /api/config', err);
        setError(err instanceof Error ? err : new Error('Unknown error loading config'));
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, []);

  return (
    <KillChainContext.Provider value={{ activeKillChain, loading, error }}>
      {children}
    </KillChainContext.Provider>
  );
};

export const useKillChain = (): KillChainContextType => {
  const context = useContext(KillChainContext);
  if (context === undefined) {
    throw new Error('useKillChain must be used within a KillChainProvider');
  }
  return context;
};
