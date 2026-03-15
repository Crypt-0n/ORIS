import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { getUserTrigram } from '../lib/userUtils';
import { ActiveUsers } from './ActiveUsers';
import {
  ArrowLeft,
  Users,
  UserPlus,
  X,
  AlertCircle,
  CheckCircle,
  Lock,
  Edit,
  UserCog,
  Share2,
  Monitor,
  RotateCcw,
  Building,
  ArrowRightLeft,
  AlertTriangle,
  Bot,
} from 'lucide-react';
import { TasksList } from './TasksList';
import { TaskDetails } from './TaskDetails';
import { CloseCase } from './CloseCase';
import { EditCase } from './EditCase';
import { CaseAuditLog } from './CaseAuditLog';
import { InvestigationRecommendations } from './investigation/InvestigationRecommendations';
import { LateralMovementGraph } from './reporting/LateralMovementGraph';
import { ChronologicalTreeView } from './reporting/ChronologicalTreeView';
import { VisualTimeline } from './reporting/VisualTimeline';
import { ActivityPlot } from './reporting/ActivityPlot';
import { CaseReport } from './reporting/CaseReport';
import { DiamondModel } from './investigation/DiamondModel';
import { InvestigationAttackerInfra } from './investigation/InvestigationAttackerInfra';
import { CaseSidebar, CaseSectionSelect, type CaseSection } from './CaseSidebar';
import { AiChatPanel } from './investigation/AiChatPanel';
import { buildDiamondNodes } from '../lib/diamondModelUtils';
import { useTranslation } from "react-i18next";

interface CaseDetailsData {
  id: string;
  case_number: string;
  title: string;
  description: string;
  status: 'open' | 'closed';
  type?: 'alert' | 'case';
  closure_summary: string | null;
  closed_at: string | null;
  created_at: string;
  author_id: string;
  severity_id: string;
  tlp_id: string;
  pap_id: string;
  author: { full_name: string; email: string };
  severity: { label: string; color: string };
  tlp: { code: string; label: string; color: string };
  pap: { code: string; label: string; color: string };
  closed_by_user?: { full_name: string };
  kill_chain_type?: string | null;
  beneficiary_id: string;
  beneficiary_name: string;
}

interface TeamMember {
  id: string;
  user_id: string;
  user: { id: string; full_name: string; email: string };
}

interface CaseDetailsProps {
  caseId: string;
  onBack: () => void;
}

export function CaseDetails({ caseId, onBack }: CaseDetailsProps) {
  const { t } = useTranslation();
  const { user, hasRole, hasAnyRole } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [caseData, setCaseData] = useState<CaseDetailsData | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [beneficiaryMembers, setBeneficiaryMembers] = useState<Array<{ id: string; full_name: string; email: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showCloseCase, setShowCloseCase] = useState(false);
  const [showEditCase, setShowEditCase] = useState(false);
  const [showReassignLeader, setShowReassignLeader] = useState(false);
  const [showReopenCase, setShowReopenCase] = useState(false);
  const [reopeningCase, setReopeningCase] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [isAssignedToCase, setIsAssignedToCase] = useState(false);
  const [showCopiedMessage, setShowCopiedMessage] = useState(false);
  const [showAiChat, setShowAiChat] = useState(false);
  const [lateralTab, setLateralTab] = useState<'force' | 'chronological'>('force');
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiCaseContext, setAiCaseContext] = useState<any>(null);
  const [activeSection, setActiveSectionRaw] = useState<CaseSection>(() => {
    const param = searchParams.get('section');
    const valid: string[] = ['description', 'closure', 'tasks', 'team', 'diamond_model', 'visual_timeline', 'lateral_movement', 'attacker_infra', 'activity_plot', 'reports'];
    if (param && valid.includes(param)) return param as CaseSection;
    return 'description';
  });
  const setActiveSection = (section: CaseSection) => {
    if (section === 'reports') {
      setReportKey(k => k + 1);
    }
    setActiveSectionRaw(section);
    const params = new URLSearchParams(searchParams);
    params.delete('task');
    if (section === 'description') {
      params.delete('section');
    } else {
      params.set('section', section);
    }
    setSearchParams(params, { replace: true });
  };
  const [reportKey, setReportKey] = useState(0);
  const [showInvestigation] = useState(false);

  const isAlert = caseData?.type === 'alert';
  const showReporting = !isAlert;

  const selectedTaskId = searchParams.get('task');

  useEffect(() => {
    if (selectedTaskId) {
      setActiveSectionRaw('tasks');
    }
  }, [selectedTaskId]);

  useEffect(() => {
    api.get('/ai/status').then((r: any) => setAiEnabled(r?.enabled === true)).catch(() => setAiEnabled(false));
  }, []);

  // Fetch full case context for AI
  const fetchAiCaseContext = useCallback(async () => {
    try {
      const [events, systems, malware, accounts, indicators, exfiltrations] = await Promise.all([
        api.get(`/investigation/events/by-case/${caseId}`).catch(() => []),
        api.get(`/investigation/systems/by-case/${caseId}`).catch(() => []),
        api.get(`/investigation/malware/by-case/${caseId}`).catch(() => []),
        api.get(`/investigation/accounts/by-case/${caseId}`).catch(() => []),
        api.get(`/investigation/indicators/by-case/${caseId}`).catch(() => []),
        api.get(`/investigation/exfiltrations/by-case/${caseId}`).catch(() => []),
      ]);
      const evts = Array.isArray(events) ? events : [];
      const sys = Array.isArray(systems) ? systems : [];
      const mal = Array.isArray(malware) ? malware : [];
      const acct = Array.isArray(accounts) ? accounts : [];
      const ind = Array.isArray(indicators) ? indicators : [];
      const exf = Array.isArray(exfiltrations) ? exfiltrations : [];
      let diamondNodes: any[] = [];
      try {
        diamondNodes = buildDiamondNodes(evts as any, sys as any, ind as any, mal as any, acct as any, exf as any, caseData?.kill_chain_type ?? null);
      } catch { diamondNodes = []; }
      setAiCaseContext({
        caseTitle: caseData?.title || '',
        taskTitle: '',
        events: evts.map((e: any) => ({ description: e.notes || e.description || '', event_datetime: e.event_datetime, kill_chain: e.kill_chain })),
        systems: sys.map((s: any) => ({ name: s.name, system_type: s.system_type, investigation_status: s.investigation_status })),
        malware: mal.map((m: any) => ({ file_name: m.file_name, description: m.description })),
        accounts: acct.map((a: any) => ({ account_name: a.account_name, domain: a.domain, privileges: a.privileges })),
        indicators: ind.map((i: any) => ({ ip: i.ip, domain_name: i.domain_name, url: i.url, context: i.context })),
        exfiltrations: exf.map((x: any) => ({ file_name: x.file_name, content_description: x.content_description })),
        diamondNodes,
      });
    } catch (err) {
      console.error('[AI] Failed to fetch case context:', err);
    }
  }, [caseId, caseData]);

  useEffect(() => {
    if (showAiChat) {
      fetchAiCaseContext();
    }
  }, [showAiChat]);

  const handleShareCase = () => {
    const url = `${window.location.origin}/cases/${caseId}`;
    navigator.clipboard.writeText(url).then(() => {
      setShowCopiedMessage(true);
      setTimeout(() => setShowCopiedMessage(false), 2000);
    });
  };

  const isAuthor = caseData?.author_id === user?.id;
  const isAdmin = hasRole('admin');
  const isClosed = caseData?.status === 'closed';
  const canManageCase = isAuthor || isAdmin || (isAlert && isAssignedToCase);
  const canViewDetails = isAuthor || isAssignedToCase || isAlert;
  const isReadOnly = !hasAnyRole(['admin', 'team_leader', 'user', 'case_manager', 'case_user']) && !isAssignedToCase && !isAuthor;
  const effectivelyClosed = isClosed || isReadOnly;
  // Admin can view details if they are an admin, even if not assigned. 
  // However, we still want to distinguish "admin supervision" from "regular assigned access" for some UI parts if needed.
  const adminOnlyAccess = isAdmin && !isAuthor && !isAssignedToCase;

  useEffect(() => {
    fetchCaseDetails();
    fetchTeamMembers();
  }, [caseId]);

  useEffect(() => {
    if (caseData?.beneficiary_id) {
      fetchBeneficiaryMembers();
    }
  }, [caseData?.beneficiary_id]);

  const fetchCaseDetails = async () => {
    setLoading(true);
    try {
      const data = await api.get(`/cases/${caseId}`);
      setCaseData(data as unknown as CaseDetailsData);
    } catch (error) {
      console.error('Erreur:', error);
    }
    setLoading(false);
  };

  const fetchTeamMembers = async () => {
    try {
      const data = await api.get(`/cases/${caseId}`);
      if (data && data.case_assignments) {
        setTeamMembers(data.case_assignments as unknown as TeamMember[]);
        const isAssigned = data.case_assignments.some((member: any) => member.user_id === user?.id || member.user?.id === user?.id) || false;
        setIsAssignedToCase(isAssigned);
      }
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  const fetchBeneficiaryMembers = async () => {
    try {
      const data = await api.get(`/cases/${caseId}/beneficiary-members`);
      setBeneficiaryMembers(data || []);
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  const handleAddMember = async () => {
    if (!selectedUserId) return;
    try {
      await api.post('/case_assignments', { case_id: caseId, user_id: selectedUserId });
      fetchTeamMembers();
      setShowAddMember(false);
      setSelectedUserId('');
    } catch (error) {
      console.error(error);
    }
  };

  const handleRemoveMember = async (assignmentId: string) => {
    try {
      await api.delete(`/case_assignments/${assignmentId}`);
      fetchTeamMembers();
    } catch (error) {
      console.error(error);
    }
  };

  const handleReassignLeader = async () => {
    if (!selectedUserId) return;
    try {
      await api.put(`/cases/${caseId}`, { author_id: selectedUserId });
      fetchCaseDetails();
      setShowReassignLeader(false);
      setSelectedUserId('');
    } catch (error) {
      console.error(error);
    }
  };

  const handleReopenCase = async () => {
    if (!user) return;
    setReopeningCase(true);
    try {
      await api.put(`/cases/${caseId}`, {
        status: 'open',
        closed_at: null,
        closed_by: null,
        closure_summary: null,
      });
      setShowReopenCase(false);
      fetchCaseDetails();
    } catch (error) {
      console.error('Erreur:', error);
    }
    setReopeningCase(false);
  };

  const availableUsers = beneficiaryMembers.filter(
    (u: { id: string }) =>
      u.id !== caseData?.author_id &&
      !teamMembers.some(tm => (tm.user?.id || tm.user_id) === u.id)
  );

  if (loading || !caseData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-slate-400">{t('auto.chargement')}</div>
      </div>
    );
  }

  const renderTeamSection = () => (
    <>
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-800/50 p-6 border border-transparent dark:border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-gray-600 dark:text-slate-400" />
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white">{t('auto.equipe')}</h3>
          </div>
          {canManageCase && !isClosed && (
            <button
              onClick={() => setShowAddMember(true)}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
            >
              <UserPlus className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-medium" style={{ fontSize: '0.6rem' }}>
              {getUserTrigram(caseData.author.full_name)}
            </div>
            <div className="flex-1">
              <div className="font-medium text-gray-800 dark:text-white">{caseData.author.full_name}</div>
              <div className="text-xs text-gray-500 dark:text-slate-400">{caseData.author.email}</div>
              <div className="text-xs text-blue-600 dark:text-blue-400 font-medium mt-1">{t('auto.team_leader')}</div>
            </div>
            {isAdmin && !isClosed && (
              <button
                onClick={() => setShowReassignLeader(true)}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                title={t('auto.reassigner_le_team_leader')}
              >
                <UserCog className="w-5 h-5" />
              </button>
            )}
          </div>

          {teamMembers.map((member) => (
            <div key={member.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
              <div className="w-8 h-8 bg-gray-400 dark:bg-slate-600 rounded-full flex items-center justify-center text-white font-medium" style={{ fontSize: '0.6rem' }}>
                {getUserTrigram(member.user.full_name)}
              </div>
              <div className="flex-1">
                <div className="font-medium text-gray-800 dark:text-white">{member.user.full_name}</div>
                <div className="text-xs text-gray-500 dark:text-slate-400">{member.user.email}</div>
              </div>
              {canManageCase && !isClosed && (
                <button
                  onClick={() => handleRemoveMember(member.id)}
                  className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}

          {teamMembers.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-4">{t('auto.aucun_membre_assigne')}</p>
          )}
        </div>
      </div>
      {isClosed && isAdmin && (
        <div className="mt-6">
          <button
            onClick={() => setShowReopenCase(true)}
            className="bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 transition flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <RotateCcw className="w-4 h-4" />
            {t('auto.reouvrir_le_case')}</button>
        </div>
      )}
      <div className="mt-6">
        <CaseAuditLog caseId={caseId} />
      </div>
    </>
  );

  const renderActiveSection = () => {
    if (adminOnlyAccess || (!canViewDetails && activeSection === 'team' && isAdmin)) {
      return renderTeamSection();
    }

    if (!canViewDetails) {
      return (
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-800/50 p-6 border border-transparent dark:border-slate-800">
          <div className="flex items-center gap-3 mb-4 text-gray-400 dark:text-slate-500">
            <Lock className="w-6 h-6" />
            <h3 className="text-lg font-semibold">{t('auto.acces_restreint')}</h3>
          </div>
          <p className="text-gray-600 dark:text-slate-400">
            {t('auto.vous_n_etes_pas_assigne_a_ce_c')}</p>
        </div>
      );
    }

    switch (activeSection) {
      case 'description':
        return (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-800/50 p-6 border border-transparent dark:border-slate-800">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">{t('auto.description')}</h3>
              <div
                className="text-gray-700 dark:text-slate-300 rich-text-content"
                dangerouslySetInnerHTML={{ __html: caseData.description }}
              />
            </div>
            {!isClosed && !isReadOnly && (
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                {canManageCase && (
                  <button
                    onClick={() => setShowEditCase(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 w-full sm:w-auto"
                  >
                    <Edit className="w-4 h-4" />
                    {t('auto.modifier')}</button>
                )}
                {isAuthor && (
                  <button
                    onClick={() => setShowCloseCase(true)}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition flex items-center justify-center gap-2 w-full sm:w-auto"
                  >
                    <Lock className="w-4 h-4" />
                    {t('auto.cloturer_le_case')}</button>
                )}
                {isAlert && !isClosed && canManageCase && (
                  <button
                    onClick={async () => {
                      try {
                        await api.post(`/cases/${caseId}/convert`, {});
                        fetchCaseDetails();
                      } catch (error) {
                        console.error(error);
                      }
                    }}
                    className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition flex items-center justify-center gap-2 w-full sm:w-auto"
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                    Convertir en dossier
                  </button>
                )}
              </div>
            )}
            {isClosed && isAdmin && (
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <button
                  onClick={() => setShowReopenCase(true)}
                  className="bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 transition flex items-center justify-center gap-2 w-full sm:w-auto"
                >
                  <RotateCcw className="w-4 h-4" />
                  {t('auto.reouvrir_le_case')}</button>
              </div>
            )}
            {!isClosed && !isReadOnly && (
              <InvestigationRecommendations
                caseId={caseId}
              />
            )}
            <div className="mt-6">
              <CaseAuditLog caseId={caseId} />
            </div>
          </div>
        );

      case 'closure':
        return isClosed && caseData.closure_summary ? (
          <div className="bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-3">
              <Lock className="w-5 h-5 text-gray-600 dark:text-slate-400" />
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">{t('auto.synthese_de_cloture')}</h3>
            </div>
            <div
              className="mb-3 text-gray-700 dark:text-slate-300 rich-text-content"
              dangerouslySetInnerHTML={{ __html: caseData.closure_summary }}
            />
            <p className="text-sm text-gray-500 dark:text-slate-400">
              {t('auto.cloture_le')}{new Date(caseData.closed_at!).toLocaleDateString('fr-FR')}
              {caseData.closed_by_user && ` par ${caseData.closed_by_user.full_name}`}
            </p>
          </div>
        ) : (
          <p className="text-gray-500 dark:text-slate-400 text-center py-8">{t('auto.aucune_synthese_de_cloture')}</p>
        );

      case 'tasks':
        return (
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-800/50 p-6 border border-transparent dark:border-slate-800">
            {!selectedTaskId ? (
              <TasksList
                caseId={caseId}
                isClosed={effectivelyClosed}
                onTaskSelect={(taskId) => { const p = new URLSearchParams(searchParams); p.set('section', 'tasks'); p.set('task', taskId); setSearchParams(p); }}
              />
            ) : (
              <TaskDetails
                taskId={selectedTaskId}
                caseId={caseId}
                isClosed={effectivelyClosed}
                onBack={() => { const p = new URLSearchParams(searchParams); p.delete('task'); p.delete('tab'); setSearchParams(p); }}
                onDelete={() => { const p = new URLSearchParams(searchParams); p.delete('task'); p.delete('tab'); setSearchParams(p); }}
              />
            )}
          </div>
        );

      case 'team':
        return renderTeamSection();



      case 'visual_timeline':
        return (
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-800/50 p-6 border border-transparent dark:border-slate-800">
            <VisualTimeline caseId={caseId} killChainType={caseData.kill_chain_type ?? null} />
          </div>
        );

      case 'lateral_movement':
        return (
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-800/50 border border-transparent dark:border-slate-800">
            <div className="flex border-b border-gray-200 dark:border-slate-700 px-6 pt-2">
              <button
                onClick={() => setLateralTab('force')}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${lateralTab === 'force' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'}`}
              >
                {t('auto.graphe_reseau') || 'Graphe réseau'}
              </button>
              <button
                onClick={() => setLateralTab('chronological')}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${lateralTab === 'chronological' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'}`}
              >
                {t('auto.vue_chronologique') || 'Vue chronologique'}
              </button>
            </div>
            <div className={lateralTab === 'chronological' ? 'p-0' : 'p-6'}>
              {lateralTab === 'chronological' ? (
                <ChronologicalTreeView caseId={caseId} />
              ) : (
                <LateralMovementGraph caseId={caseId} layoutMode="force" />
              )}
            </div>
          </div>
        );

      case 'attacker_infra':
        return (
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-800/50 p-6 border border-transparent dark:border-slate-800">
            <InvestigationAttackerInfra caseId={caseId} isClosed={caseData?.status === 'closed'} />
          </div>
        );

      case 'activity_plot':
        return (
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-800/50 p-6 border border-transparent dark:border-slate-800">
            <ActivityPlot caseId={caseId} />
          </div>
        );

      case 'reports':
        return (
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-800/50 p-6 border border-transparent dark:border-slate-800">
            <CaseReport key={reportKey} caseId={caseId} />
          </div>
        );



      case 'diamond_model':
        return (
          <div className="bg-white dark:bg-slate-950 rounded-lg shadow dark:shadow-slate-800/50 p-6 border border-gray-200 dark:border-slate-800">
            <DiamondModel
              caseId={caseId}
              killChainType={caseData.kill_chain_type ?? null}
              isClosed={effectivelyClosed}
            />
          </div>
        );



      default: {
        const placeholderLabels: Record<string, string> = {
          visual_timeline: 'Timeline visuelle',
          lateral_movement: 'Mouvement lateral',
          activity_plot: 'Graphe d\'activite',
        };
        const label = placeholderLabels[activeSection] || activeSection;
        return (
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-800/50 p-6 border border-transparent dark:border-slate-800">
            <div className="flex flex-col items-center justify-center py-12 sm:py-16 text-gray-400 dark:text-slate-400">
              <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                <Monitor className="w-7 h-7" />
              </div>
              <p className="text-base font-medium mb-1">{label}</p>
              <p className="text-sm">{t('auto.cette_section_sera_disponible_')}</p>
            </div>
          </div>
        );
      }
    }
  };

  return (
    <div className="mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-4 sm:py-6">
      <div className="mb-4 sm:mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition flex-shrink-0 text-gray-600 dark:text-slate-400"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-sm font-mono text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-800 px-3 py-1 rounded">
                {caseData.case_number}
              </span>
              <button
                onClick={handleShareCase}
                className="text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition relative"
                title={t('auto.partager_le_lien_du_case')}
              >
                <Share2 className="w-4 h-4" />
                {showCopiedMessage && (
                  <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-gray-800 dark:bg-slate-700 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                    {t('auto.lien_copie')}</span>
                )}
              </button>
            </div>
            {canViewDetails ? (
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white mb-1">{caseData.title}</h2>
            ) : (
              <h2 className="text-xl sm:text-2xl font-bold text-gray-400 dark:text-slate-500 mb-1">{isAdmin ? caseData.title : t('auto.acces_restreint_1')}</h2>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {canViewDetails && (
                <>
                  <span
                    className="px-2 sm:px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 flex-shrink-0"
                    style={{ backgroundColor: `${caseData.severity.color}20`, color: caseData.severity.color }}
                  >
                    <AlertCircle className="w-3 h-3" />
                    {caseData.severity.label}
                  </span>
                  <span className="px-2 sm:px-3 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 flex items-center gap-1 flex-shrink-0">
                    <Building className="w-3 h-3" />
                    {caseData.beneficiary_name}
                  </span>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium flex-shrink-0 ${caseData.tlp.code === 'WHITE' ? 'border border-gray-400 dark:border-slate-500' : ''}`}
                    style={{
                      backgroundColor: caseData.tlp.code === 'WHITE' ? 'transparent' : '#000000',
                      color: caseData.tlp.code === 'WHITE' ? undefined : caseData.tlp.color,
                    }}
                  >
                    <span className={caseData.tlp.code === 'WHITE' ? 'text-gray-700 dark:text-slate-300' : ''}>
                      {caseData.tlp.label}
                    </span>
                  </span>
                  {caseData.pap && (
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium flex-shrink-0 ${caseData.pap.code === 'WHITE' ? 'border border-gray-400 dark:border-slate-500' : ''}`}
                      style={{
                        backgroundColor: caseData.pap.code === 'WHITE' ? 'transparent' : '#000000',
                        color: caseData.pap.code === 'WHITE' ? undefined : caseData.pap.color,
                      }}
                    >
                      <span className={caseData.pap.code === 'WHITE' ? 'text-gray-700 dark:text-slate-300' : ''}>
                        {caseData.pap.label}
                      </span>
                    </span>
                  )}
                </>
              )}
              {isClosed ? (
                <span className="px-2 sm:px-3 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-slate-300 flex items-center gap-1 flex-shrink-0">
                  <Lock className="w-3 h-3" />
                  {t('auto.cloture')}</span>
              ) : (
                <span className="px-2 sm:px-3 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 flex items-center gap-1 flex-shrink-0">
                  <CheckCircle className="w-3 h-3" />
                  {t('auto.ouvert')}</span>
              )}
              {isAlert && (
                <span className="px-2 sm:px-3 py-1 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400 flex items-center gap-1 flex-shrink-0">
                  <AlertTriangle className="w-3 h-3" />
                  Alerte
                </span>
              )}
              {(canViewDetails || isAdmin) && (
                <span className="text-gray-500 dark:text-slate-400 text-xs hidden sm:inline">
                  Créé le {caseData.created_at ? new Date(caseData.created_at).toLocaleDateString('fr-FR') : 'date inconnue'} par {caseData.author.full_name}
                </span>
              )}
            </div>
            <ActiveUsers caseId={caseId} />
          </div>
        </div>
      </div>

      {!adminOnlyAccess && (
        <CaseSectionSelect activeSection={activeSection} onSectionChange={setActiveSection} isClosed={isClosed} showInvestigation={showInvestigation} showReporting={showReporting} />
      )}

      <div className="flex gap-6">
        {!adminOnlyAccess && (
          <CaseSidebar activeSection={activeSection} onSectionChange={setActiveSection} isClosed={isClosed} showInvestigation={showInvestigation} showReporting={showReporting} />
        )}
        <div className="flex-1 min-w-0">
          {renderActiveSection()}
        </div>
      </div>

      {/* AI Chat Toggle & Panel */}
      {aiEnabled && (
        <>
          {!showAiChat && (
            <button
              onClick={() => setShowAiChat(true)}
              className="fixed right-0 top-1/2 -translate-y-1/2 z-40 bg-purple-600 hover:bg-purple-700 text-white px-1.5 py-4 rounded-l-lg shadow-lg transition-all hover:px-2.5 group"
              title="Assistant IA"
            >
              <Bot className="w-5 h-5" />
              <span className="hidden group-hover:block text-[10px] mt-1 whitespace-nowrap">IA</span>
            </button>
          )}
          {showAiChat && aiCaseContext && (
            <div className="fixed inset-0 z-50 flex">
              <div className="flex-1 bg-black/30" onClick={() => setShowAiChat(false)} />
              <div className="w-[420px] max-w-full h-full shadow-2xl">
                <AiChatPanel
                  context={{
                    ...aiCaseContext,
                    taskTitle: selectedTaskId ? `Tâche sélectionnée (ID: ${selectedTaskId})` : '(Vue globale du dossier)',
                  }}
                  onClose={() => setShowAiChat(false)}
                />
              </div>
            </div>
          )}
        </>
      )}

      {showAddMember && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-lg max-w-md w-full p-4 sm:p-6 my-8 border border-transparent dark:border-slate-700">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800 dark:text-white">{t('auto.ajouter_un_membre')}</h3>
              <button onClick={() => setShowAddMember(false)} className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  {t('auto.selectionner_un_utilisateur')}</label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                >
                  <option value="">{t('auto.choisir')}</option>
                  {availableUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowAddMember(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition text-gray-700 dark:text-slate-300"
                >
                  {t('auto.annuler')}</button>
                <button
                  onClick={handleAddMember}
                  disabled={!selectedUserId}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {t('auto.ajouter')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCloseCase && (
        <CloseCase
          caseId={caseId}
          initialSummary={caseData.closure_summary || ''}
          onClose={() => setShowCloseCase(false)}
          onSuccess={() => { setShowCloseCase(false); fetchCaseDetails(); }}
        />
      )}

      {showEditCase && caseData && (
        <EditCase
          caseId={caseId}
          initialData={{
            title: caseData.title,
            description: caseData.description,
            severity_id: caseData.severity_id,
            tlp_id: caseData.tlp_id,
            pap_id: caseData.pap_id,
            author_id: caseData.author_id,
            beneficiary_id: caseData.beneficiary_id,
          }}
          onClose={() => setShowEditCase(false)}
          onSuccess={() => { setShowEditCase(false); fetchCaseDetails(); }}
        />
      )}

      {showReopenCase && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-transparent dark:border-slate-700 rounded-lg max-w-md w-full p-6 shadow dark:shadow-slate-800/50">
            <div className="flex items-center gap-2 mb-4">
              <RotateCcw className="w-5 h-5 text-amber-600" />
              <h3 className="text-lg font-bold text-gray-800 dark:text-white">{t('auto.reouvrir_le_case')}</h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-slate-300 mb-6">
              {t('auto.le_case_sera_rouvert_et_la_syn')}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowReopenCase(false)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition dark:text-slate-300"
              >
                {t('auto.annuler')}</button>
              <button
                onClick={handleReopenCase}
                disabled={reopeningCase}
                className="flex-1 bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                {reopeningCase ? 'Reouverture...' : 'Reouvrir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showReassignLeader && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-lg max-w-md w-full p-4 sm:p-6 my-8 border border-transparent dark:border-slate-700">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800 dark:text-white">{t('auto.reassigner_le_team_leader')}</h3>
              <button onClick={() => setShowReassignLeader(false)} className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                <p className="text-sm text-yellow-800 dark:text-yellow-300">
                  {t('auto.le_team_leader_actuel_perdra_l')}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  {t('auto.nouveau_team_leader')}</label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                >
                  <option value="">{t('auto.choisir')}</option>
                  {beneficiaryMembers.filter((u: { id: string }) => u.id !== caseData?.author_id).map((u: any) => (
                    <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowReassignLeader(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition text-gray-700 dark:text-slate-300"
                >
                  {t('auto.annuler')}</button>
                <button
                  onClick={handleReassignLeader}
                  disabled={!selectedUserId}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {t('auto.reassigner')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
