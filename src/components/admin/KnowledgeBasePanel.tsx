import { useState } from 'react';
import { Bot, Shield } from 'lucide-react';
import { TtpManagementPanel } from '../TtpManagementPanel';
import { AiConfigPanel } from '../AiConfigPanel';

export function KnowledgeBasePanel() {
  const [activeTab, setActiveTab] = useState<'ttps' | 'ai'>('ttps');

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-gray-200 dark:border-slate-700 pb-0 overflow-x-auto overflow-y-hidden no-scrollbar">
        <button
          onClick={() => setActiveTab('ttps')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0 -mb-px ${
            activeTab === 'ttps'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400 dark:border-purple-400'
              : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
          }`}
        >
          <Shield className="w-4 h-4" />
          Base MITRE ATT&CK (TTPs)
        </button>
        <button
          onClick={() => setActiveTab('ai')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0 -mb-px ${
            activeTab === 'ai'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400 dark:border-purple-400'
              : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
          }`}
        >
          <Bot className="w-4 h-4" />
          Intelligence Artificielle Copilot
        </button>
      </div>

      <div className="animate-in fade-in">
        {activeTab === 'ttps' && <TtpManagementPanel />}
        {activeTab === 'ai' && <AiConfigPanel />}
      </div>
    </div>
  );
}
