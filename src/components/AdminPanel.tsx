import { useState } from 'react';
import { AdminViewType, AdminSidebar } from './admin/AdminSidebar';
import { UserAccessPanel } from './admin/UserAccessPanel';
import { BeneficiariesPanel } from './admin/BeneficiariesPanel';
import { SystemOperationsPanel } from './admin/SystemOperationsPanel';
import { KnowledgeBasePanel } from './admin/KnowledgeBasePanel';

export function AdminPanel() {
  const [activeView, setActiveView] = useState<AdminViewType>('access');

  return (
    <div>
      <div className="flex flex-col lg:flex-row gap-6 min-h-[calc(100vh-8rem)]">
        <AdminSidebar activeView={activeView} onViewChange={setActiveView} />

        <div className="flex-1 min-w-0">
          {activeView === 'access' && <UserAccessPanel />}
          {activeView === 'beneficiaries' && <BeneficiariesPanel />}
          {activeView === 'system' && <SystemOperationsPanel />}
          {activeView === 'knowledge' && <KnowledgeBasePanel />}
        </div>
      </div>
    </div>
  );
}
