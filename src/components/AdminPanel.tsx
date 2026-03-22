import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { UserPlus, Shield, User, Trash2, X, Edit, AlertTriangle, Settings, Building, Users, Lock, Clock, HardDrive, Webhook, Crown, Bot, ChevronDown } from 'lucide-react';
import { KILL_CHAIN_DEFINITIONS, KillChainType } from '../lib/killChainDefinitions';
import { LoginHistory } from './LoginHistory';
import { BackupPanel } from './BackupPanel';
import { WebhooksPanel } from './WebhooksPanel';
import { AiConfigPanel } from './AiConfigPanel';
import { TtpManagementPanel } from './TtpManagementPanel';

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  roles: string[];
  is_active: boolean;
  is_protected: boolean;
  beneficiary_ids: string[];
  created_at: string;
}

interface Beneficiary {
  id: string;
  name: string;
  description: string;
  member_count: number;
}

interface BeneficiaryMember {
  id: string;
  beneficiary_id: string;
  user_id: string;
  full_name: string;
  email: string;
  is_team_lead: boolean;
  role?: string;
}

export function AdminPanel() {
  const { user: currentUser } = useAuth();
  const { t, i18n } = useTranslation();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'beneficiaries' | 'config' | 'connections' | 'backup' | 'webhooks' | 'ai' | 'ttps'>('users');
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [selectedBeneficiary, setSelectedBeneficiary] = useState<Beneficiary | null>(null);
  const [beneficiaryMembers, setBeneficiaryMembers] = useState<BeneficiaryMember[]>([]);
  const [showBeneficiaryModal, setShowBeneficiaryModal] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [editingBeneficiary, setEditingBeneficiary] = useState<Beneficiary | null>(null);
  const [beneficiaryFormData, setBeneficiaryFormData] = useState({ name: '', description: '' });
  const [memberFormData, setMemberFormData] = useState({ user_id: '' });
  const [loading, setLoading] = useState(true);
  const [deletingUser, setDeletingUser] = useState<UserProfile | null>(null);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUserForModal, setEditingUserForModal] = useState<UserProfile | null>(null);
  const [userFormData, setUserFormData] = useState({
    email: '',
    fullName: '',
    password: '',
    roles: [] as string[],
    beneficiaryIds: [] as string[]
  });
  const [deleting, setDeleting] = useState(false);

  const [defaultKillChainType, setDefaultKillChainType] = useState<KillChainType>('cyber_kill_chain');
  const [allowApiTokens, setAllowApiTokens] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [sessionLockEnabled, setSessionLockEnabled] = useState(false);
  const [sessionLockTimeout, setSessionLockTimeout] = useState(5);

  useEffect(() => {
    fetchUsers();
    fetchConfig();
    fetchBeneficiaries();
  }, []);

  const fetchConfig = async () => {
    try {
      const data = await api.get('/admin/config');
      if (data) {
        for (const row of data) {

          if (row.key === 'default_kill_chain_type') setDefaultKillChainType((row.value as KillChainType) || 'cyber_kill_chain');
          if (row.key === 'allow_api_tokens') setAllowApiTokens(row.value === 'true');
          if (row.key === 'session_lock_enabled') setSessionLockEnabled(row.value === 'true');
          if (row.key === 'session_lock_timeout') setSessionLockTimeout(parseInt(row.value, 10) || 5);
        }
      }
    } catch (err) { console.error(err); }
  };



  const toggleAllowApiTokens = async () => {
    const newValue = !allowApiTokens;
    setSavingConfig(true);
    try {
      await api.put('/admin/config', { key: 'allow_api_tokens', value: String(newValue) });
      setAllowApiTokens(newValue);
    } catch (err) { console.error(err); }
    setSavingConfig(false);
  };

  const saveKillChainType = async (type: KillChainType) => {
    setSavingConfig(true);
    try {
      await api.put('/admin/config', { key: 'default_kill_chain_type', value: type });
      setDefaultKillChainType(type);
    } catch (err) { console.error(err); }
    setSavingConfig(false);
  };

  const toggleSessionLock = async () => {
    const newValue = !sessionLockEnabled;
    setSavingConfig(true);
    try {
      await api.put('/admin/config', { key: 'session_lock_enabled', value: String(newValue) });
      setSessionLockEnabled(newValue);
    } catch (err) { console.error(err); }
    setSavingConfig(false);
  };

  const saveSessionLockTimeout = async (minutes: number) => {
    setSavingConfig(true);
    try {
      await api.put('/admin/config', { key: 'session_lock_timeout', value: String(minutes) });
      setSessionLockTimeout(minutes);
    } catch (err) { console.error(err); }
    setSavingConfig(false);
  };


  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await api.get('/admin/users');
      setUsers(data || []);
    } catch (error) { console.error('Erreur:', error); }
    setLoading(false);
  };

  const fetchBeneficiaries = async () => {
    try {
      const data = await api.get('/admin/beneficiaries');
      setBeneficiaries(data || []);
    } catch (err) { console.error(err); }
  };

  const fetchBeneficiaryMembers = async (id: string) => {
    try {
      const data = await api.get(`/admin/beneficiaries/${id}/members`);
      setBeneficiaryMembers(data || []);
    } catch (err) { console.error(err); }
  };

  const handleSaveBeneficiary = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdating(true);
    try {
      if (editingBeneficiary) {
        await api.put(`/admin/beneficiaries/${editingBeneficiary.id}`, beneficiaryFormData);
      } else {
        await api.post('/admin/beneficiaries', beneficiaryFormData);
      }
      fetchBeneficiaries();
      setShowBeneficiaryModal(false);
      setEditingBeneficiary(null);
      setBeneficiaryFormData({ name: '', description: '' });
    } catch (err) { console.error(err); }
    setUpdating(false);
  };

  const handleDeleteBeneficiary = async (id: string) => {
    if (!window.confirm(t('admin.confirmDeleteBeneficiary') || 'Are you sure?')) return;
    try {
      await api.delete(`/admin/beneficiaries/${id}`);
      fetchBeneficiaries();
      if (selectedBeneficiary?.id === id) setSelectedBeneficiary(null);
    } catch (err) { console.error(err); }
  };

  const addMemberToBeneficiary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBeneficiary) return;
    try {
      await api.post(`/admin/beneficiaries/${selectedBeneficiary.id}/members`, memberFormData);
      fetchBeneficiaryMembers(selectedBeneficiary.id);
      setMemberFormData({ user_id: '' });
      setShowMemberModal(false);
    } catch (err) { console.error(err); }
  };

  const removeMemberFromBeneficiary = async (memberId: string) => {
    try {
      await api.delete(`/admin/beneficiaries/members/${memberId}`);
      if (selectedBeneficiary) fetchBeneficiaryMembers(selectedBeneficiary.id);
    } catch (err) { console.error(err); }
  };

  const toggleTeamLead = async (memberId: string, currentValue: boolean) => {
    try {
      await api.put(`/admin/beneficiaries/members/${memberId}/team-lead`, { is_team_lead: !currentValue });
      if (selectedBeneficiary) fetchBeneficiaryMembers(selectedBeneficiary.id);
    } catch (err) { console.error(err); }
  };

  const updateMemberRole = async (memberId: string, currentRoles: string[], toggleRole: string) => {
    try {
      let newRoles: string[];
      if (currentRoles.includes(toggleRole)) {
        newRoles = currentRoles.filter(r => r !== toggleRole);
      } else {
        newRoles = [...currentRoles];
        // Analyst and viewer are mutually exclusive within the same type
        if (toggleRole === 'case_analyst') newRoles = newRoles.filter(r => r !== 'case_viewer');
        if (toggleRole === 'case_viewer') newRoles = newRoles.filter(r => r !== 'case_analyst');
        if (toggleRole === 'alert_analyst') newRoles = newRoles.filter(r => r !== 'alert_viewer');
        if (toggleRole === 'alert_viewer') newRoles = newRoles.filter(r => r !== 'alert_analyst');
        newRoles.push(toggleRole);
      }
      await api.put(`/admin/beneficiaries/members/${memberId}/role`, { roles: newRoles });
      if (selectedBeneficiary) fetchBeneficiaryMembers(selectedBeneficiary.id);
    } catch (err) { console.error(err); }
  };


  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      await api.put(`/admin/users/${userId}`, { is_active: !currentStatus });
      fetchUsers();
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdating(true);
    setError('');

    try {
      if (editingUserForModal) {
        await api.put(`/admin/users/${editingUserForModal.id}`, {
          email: userFormData.email,
          full_name: userFormData.fullName,
          roles: userFormData.roles,
          password: userFormData.password || undefined,
          beneficiaryIds: userFormData.beneficiaryIds
        });
      } else {
        await api.post('/admin/users', userFormData);
      }
      fetchUsers();
      setShowUserModal(false);
      setEditingUserForModal(null);
      setUserFormData({ email: '', fullName: '', password: '', roles: [], beneficiaryIds: [] });
    } catch (err: any) {
      setError(err.message || t('admin.errorCreate'));
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    setDeleting(true);

    try {
      await api.delete(`/admin/users/${deletingUser.id}`);
      setDeletingUser(null);
      fetchUsers();
    } catch (err: any) {
      setError(err.message || t('admin.errorDelete'));
      setDeletingUser(null);
    } finally {
      setDeleting(false);
    }
  };


  const getRoleBadges = (roles: string[]) => {
    const sortOrder = ['admin', 'case_analyst', 'alert_analyst', 'case_viewer', 'alert_viewer'];
    const sortedRoles = [...roles].sort((a, b) => sortOrder.indexOf(a) - sortOrder.indexOf(b));

    return sortedRoles.map(role => {
      const config = {
        admin: { label: 'Admin', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', icon: Shield },
        case_analyst: { label: 'Analyste CERT', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300', icon: Shield },
        case_viewer: { label: 'Lecteur CERT', color: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300', icon: User },
        alert_analyst: { label: 'Analyste SOC', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300', icon: Shield },
        alert_viewer: { label: 'Lecteur SOC', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300', icon: User },
      }[role] || { label: role, color: 'bg-gray-100 text-gray-800', icon: User };

      const Icon = config.icon;

      return (
        <span
          key={role}
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}
        >
          <Icon className="w-3 h-3" />
          {config.label}
        </span>
      );
    });
  };

  const dateLocale = i18n.language === 'fr' ? 'fr-FR' : 'en-GB';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-slate-400">{t('admin.loading')}</div>
      </div>
    );
  }

  const sidebarItems: { key: typeof activeTab; label: string; icon: typeof Users; color?: string }[] = [
    { key: 'users', label: t('admin.users'), icon: Users },
    { key: 'beneficiaries', label: t('admin.beneficiaries'), icon: Building },
    { key: 'config', label: t('admin.config'), icon: Settings },
    { key: 'connections', label: 'Connexions', icon: Clock },
    { key: 'backup', label: 'Backups', icon: HardDrive },
    { key: 'webhooks', label: 'Webhooks', icon: Webhook },
    { key: 'ai', label: 'IA', icon: Bot, color: 'purple' },
    { key: 'ttps', label: 'TTPs', icon: Shield, color: 'emerald' },
  ];

  return (
    <div>
      {/* Mobile nav — dropdown at top, full width */}
      <div className="lg:hidden mb-4">
        <div className="relative">
          <select
            value={activeTab}
            onChange={e => setActiveTab(e.target.value as typeof activeTab)}
            className="w-full appearance-none bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 pr-10 text-sm font-medium text-gray-800 dark:text-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none cursor-pointer"
            aria-label={t('admin.navigation')}
          >
            {sidebarItems.map(item => (
              <option key={item.key} value={item.key}>{item.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-slate-400 pointer-events-none" />
        </div>
      </div>

      <div className="flex gap-6 min-h-[calc(100vh-8rem)]">
        {/* Sidebar — desktop */}
        <nav className="hidden lg:flex flex-col w-56 flex-shrink-0">
          <div className="sticky top-24 bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
            {sidebarItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.key;
              const activeColor = item.color === 'purple'
                ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-l-purple-500'
                : item.color === 'emerald'
                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-l-emerald-500'
                : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-l-blue-500';
              return (
                <button
                  key={item.key}
                  onClick={() => setActiveTab(item.key)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all border-l-3 ${
                    isActive
                      ? `${activeColor} border-l-[3px]`
                      : 'border-l-[3px] border-l-transparent text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-4.5 h-4.5 flex-shrink-0" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Content area */}
        <div className="flex-1 min-w-0">

      {activeTab === 'users' && (
        <>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">{t('admin.title')}</h2>
              <p className="text-sm sm:text-base text-gray-600 dark:text-slate-400 mt-1">{t('admin.subtitle')}</p>
            </div>
            <button
              onClick={() => {
                setEditingUserForModal(null);
                setUserFormData({ email: '', fullName: '', password: '', roles: [], beneficiaryIds: [] });
                setShowUserModal(true);
              }}
              className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition shadow-sm font-medium"
            >
              <UserPlus className="w-4 h-4" />
              {t('admin.newUser')}
            </button>
          </div>

          <div className="hidden lg:block bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-800/50 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
              <thead className="bg-gray-50 dark:bg-slate-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    {t('admin.user')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    {t('admin.roles')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    {t('admin.status')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    {t('admin.createdAt')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    {t('admin.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-700">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-slate-800">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{user.full_name}</span>
                        </div>
                        <div className="text-sm text-gray-500 dark:text-slate-400">{user.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {getRoleBadges(user.roles || [])}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => toggleUserStatus(user.id, user.is_active)}
                        disabled={user.id === currentUser?.id}
                        title={user.id === currentUser?.id ? t('admin.cannotDeactivateSelf') : ''}
                        className={`px-3 py-1 rounded-full text-xs font-medium ${user.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                          } ${user.id === currentUser?.id ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80 transition cursor-pointer'}`}
                      >
                        {user.is_active ? t('admin.active') : t('admin.inactive')}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-slate-400">
                      {new Date(user.created_at).toLocaleDateString(dateLocale)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditingUserForModal(user);
                            setUserFormData({
                              email: user.email,
                              fullName: user.full_name,
                              password: '',
                              roles: user.roles || [],
                              beneficiaryIds: user.beneficiary_ids || []
                            });
                            setShowUserModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-900 dark:hover:text-blue-400 transition"
                          aria-label={`${t('admin.edit')} ${user.full_name}`}
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeletingUser(user)}
                          disabled={user.is_protected || user.id === currentUser?.id}
                          className="text-red-600 hover:text-red-900 dark:hover:text-red-400 transition disabled:opacity-30 disabled:cursor-not-allowed"
                          aria-label={`${t('admin.delete')} ${user.full_name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="lg:hidden space-y-3">
            {users.map((user) => (
              <div key={user.id} className="bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-800/50 border border-transparent dark:border-slate-800 p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate">{user.full_name}</h3>
                    <p className="text-sm text-gray-500 dark:text-slate-400 truncate">{user.email}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                    <button
                      onClick={() => {
                        setEditingUserForModal(user);
                        setUserFormData({
                          email: user.email,
                          fullName: user.full_name,
                          password: '',
                          roles: user.roles || [],
                          beneficiaryIds: user.beneficiary_ids || []
                        });
                        setShowUserModal(true);
                      }}
                      className="text-blue-600 hover:text-blue-900 dark:hover:text-blue-400 transition p-2"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeletingUser(user)}
                      disabled={user.is_protected || user.id === currentUser?.id}
                      className="text-red-600 hover:text-red-900 dark:hover:text-red-400 transition p-2 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">{t('admin.roles')}</p>
                    <div className="flex flex-wrap gap-1">
                      {getRoleBadges(user.roles || [])}
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-slate-800">
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">{t('admin.status')}</p>
                      <button
                        onClick={() => toggleUserStatus(user.id, user.is_active)}
                        disabled={user.id === currentUser?.id}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium ${user.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                          } ${user.id === currentUser?.id ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80 transition cursor-pointer'}`}
                      >
                        {user.is_active ? t('admin.active') : t('admin.inactive')}
                      </button>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">{t('admin.createdAt')}</p>
                      <p className="text-xs text-gray-700 dark:text-slate-300">
                        {new Date(user.created_at).toLocaleDateString(dateLocale)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {activeTab === 'beneficiaries' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white">{t('admin.beneficiaries')}</h3>
              <button
                onClick={() => {
                  setEditingBeneficiary(null);
                  setBeneficiaryFormData({ name: '', description: '' });
                  setShowBeneficiaryModal(true);
                }}
                className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                title={t('admin.addBeneficiary') || "Add"}
                aria-label={t('admin.addBeneficiary') || "Add"}
              >
                <Building className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-800/50 border border-gray-200 dark:border-slate-700 overflow-hidden text-sm sm:text-base">
              <div className="divide-y divide-gray-200 dark:divide-slate-700">
                {beneficiaries.map((b) => (
                  <div
                    key={b.id}
                    onClick={() => {
                      setSelectedBeneficiary(b);
                      fetchBeneficiaryMembers(b.id);
                    }}
                    className={`p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800 transition ${selectedBeneficiary?.id === b.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold text-gray-800 dark:text-white">{b.name}</div>
                        <div className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 line-clamp-1">{b.description}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 px-2 py-0.5 rounded-full">
                          {b.member_count}
                        </span>
                        <div className="flex gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingBeneficiary(b);
                              setBeneficiaryFormData({ name: b.name, description: b.description || '' });
                              setShowBeneficiaryModal(true);
                            }}
                            className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteBeneficiary(b.id);
                            }}
                            className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {beneficiaries.length === 0 && (
                  <div className="p-8 text-center text-gray-500 dark:text-slate-400">
                    {t('admin.noBeneficiaries')}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            {selectedBeneficiary ? (
              <div className="bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-800/50 border border-gray-200 dark:border-slate-700 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white">{selectedBeneficiary.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-slate-400">{t('admin.manageMembers')}</p>
                  </div>
                  <button
                    onClick={() => setShowMemberModal(true)}
                    className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition text-sm"
                  >
                    <UserPlus className="w-4 h-4" />
                    {t('admin.addMember')}
                  </button>
                </div>

                <div className="overflow-x-auto text-sm sm:text-base">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                    <thead className="bg-gray-50 dark:bg-slate-800">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">{t('admin.user')}</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">CERT</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">SOC</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Team Lead</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">{t('admin.actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                      {beneficiaryMembers.map((m) => {
                        const memberRoles: string[] = (() => { try { return JSON.parse(m.role || '[]'); } catch { return []; } })();
                        return (
                        <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-slate-800">
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-slate-300">
                            <div className="flex items-center gap-2">
                              {m.is_team_lead && <Crown className="w-4 h-4 text-amber-500 flex-shrink-0" />}
                              <div>
                                <div className="font-medium">{m.full_name}</div>
                                <div className="text-xs text-gray-500 dark:text-slate-500">{m.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-center">
                            <div className="flex flex-col gap-1 items-center">
                              {[
                                { id: 'case_analyst', label: 'Analyste', color: 'indigo' },
                                { id: 'case_viewer', label: 'Lecteur', color: 'slate' },
                              ].map(r => (
                                <button key={r.id} onClick={() => updateMemberRole(m.id, memberRoles, r.id)}
                                  className={`px-2 py-0.5 rounded-full text-xs font-medium transition ${memberRoles.includes(r.id)
                                    ? `bg-${r.color}-100 text-${r.color}-800 dark:bg-${r.color}-900/30 dark:text-${r.color}-300 ring-1 ring-${r.color}-300 dark:ring-${r.color}-700`
                                    : 'bg-gray-50 text-gray-400 dark:bg-slate-800 dark:text-slate-600 hover:bg-gray-100'}`}
                                >{r.label}</button>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-center">
                            <div className="flex flex-col gap-1 items-center">
                              {[
                                { id: 'alert_analyst', label: 'Analyste', color: 'orange' },
                                { id: 'alert_viewer', label: 'Lecteur', color: 'amber' },
                              ].map(r => (
                                <button key={r.id} onClick={() => updateMemberRole(m.id, memberRoles, r.id)}
                                  className={`px-2 py-0.5 rounded-full text-xs font-medium transition ${memberRoles.includes(r.id)
                                    ? `bg-${r.color}-100 text-${r.color}-800 dark:bg-${r.color}-900/30 dark:text-${r.color}-300 ring-1 ring-${r.color}-300 dark:ring-${r.color}-700`
                                    : 'bg-gray-50 text-gray-400 dark:bg-slate-800 dark:text-slate-600 hover:bg-gray-100'}`}
                                >{r.label}</button>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-center">
                            <button
                              onClick={() => toggleTeamLead(m.id, !!m.is_team_lead)}
                              title={m.is_team_lead ? 'Retirer le rôle Team Lead' : 'Promouvoir Team Lead'}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition ${m.is_team_lead
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 hover:bg-amber-200'
                                : 'bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-500 hover:bg-gray-200 dark:hover:bg-slate-700'
                              }`}
                            >
                              <Crown className="w-3.5 h-3.5" />
                              {m.is_team_lead ? 'Team Lead' : 'Membre'}
                            </button>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              onClick={() => removeMemberFromBeneficiary(m.id)}
                              className="text-red-400 hover:text-red-600 transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                        );
                      })}
                      {beneficiaryMembers.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-slate-400">
                            {t('admin.noMembers')}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-800/20 border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-lg p-12 text-center">
                <Building className="w-12 h-12 text-gray-300 dark:text-slate-700 mb-4" />
                <h3 className="text-lg font-medium text-gray-800 dark:text-white mb-2">{t('admin.selectBeneficiary')}</h3>
                <p className="text-sm text-gray-500 dark:text-slate-400">{t('admin.selectBeneficiaryDesc')}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'config' && (
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-800/50 border border-gray-200 dark:border-slate-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-500 dark:text-slate-400" />
            <h3 className="text-base font-semibold text-gray-800 dark:text-white">{t('admin.config')}</h3>
          </div>
          <div className="px-6 py-5 space-y-6">

            <div className="flex items-center justify-between border-t border-gray-100 dark:border-slate-700/60 pt-5">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-slate-300">{t('admin.allowApiTokensTitle')}</p>
                <p className="text-xs text-gray-500 dark:text-slate-500 mt-0.5">{t('admin.allowApiTokensDesc')}</p>
              </div>
              <button
                type="button"
                disabled={savingConfig}
                onClick={toggleAllowApiTokens}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${allowApiTokens ? 'bg-blue-600' : 'bg-gray-300 dark:bg-slate-600'
                  }`}
                aria-label={t('admin.allowApiTokensTitle')}
                role="switch"
                aria-checked={allowApiTokens}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${allowApiTokens ? 'translate-x-5' : 'translate-x-0'
                    }`}
                />
              </button>
            </div>

            <div className="border-t border-gray-100 dark:border-slate-700/60 pt-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                    <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-slate-300">{t('admin.sessionLockTitle')}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-500 mt-0.5">{t('admin.sessionLockDesc')}</p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={savingConfig}
                  onClick={toggleSessionLock}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${sessionLockEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-slate-600'
                    }`}
                  aria-label={t('admin.sessionLockTitle')}
                  role="switch"
                  aria-checked={sessionLockEnabled}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${sessionLockEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                  />
                </button>
              </div>

              {sessionLockEnabled && (
                <div className="mt-4 ml-0 sm:ml-12 flex flex-wrap items-center gap-3">
                  <Clock className="w-4 h-4 text-gray-500 dark:text-slate-400 flex-shrink-0" />
                  <label className="text-sm text-gray-600 dark:text-slate-400 whitespace-nowrap">{t('admin.sessionLockTimeout')}</label>
                  <select
                    value={sessionLockTimeout}
                    onChange={(e) => saveSessionLockTimeout(Number(e.target.value))}
                    disabled={savingConfig}
                    className="px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-slate-200 disabled:opacity-50"
                  >
                    {[1, 2, 5, 10, 15, 30, 60].map(m => (
                      <option key={m} value={m}>{m} {t('admin.minutes')}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="border-t border-gray-100 dark:border-slate-700/60 pt-5">
              <div className="mb-3">
                <p className="text-sm font-medium text-gray-700 dark:text-slate-300">{t('admin.defaultKillChain')}</p>
                <p className="text-xs text-gray-500 dark:text-slate-500 mt-0.5">{t('admin.defaultKillChainDesc')}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(Object.keys(KILL_CHAIN_DEFINITIONS) as KillChainType[]).map((type) => {
                  const def = KILL_CHAIN_DEFINITIONS[type];
                  const isSelected = defaultKillChainType === type;
                  const label = t(`killChain.${type}_label`);
                  const description = t(`killChain.${type}_desc`);
                  return (
                    <button
                      key={type}
                      type="button"
                      disabled={savingConfig}
                      onClick={() => saveKillChainType(type)}
                      className={`text-left p-3 rounded-lg border-2 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${isSelected
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-gray-300 dark:hover:border-slate-600'
                        }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className={`text-sm font-semibold leading-tight ${isSelected ? 'text-blue-700 dark:text-blue-400' : 'text-gray-800 dark:text-slate-200'}`}>
                          {label}
                        </span>
                        {isSelected && (
                          <span className="flex-shrink-0 w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center mt-0.5">
                            <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 8" fill="none">
                              <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-slate-400">{description}</p>
                      <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mt-1.5">{def.phases.length} {t('auto.phases')}</p>
                    </button>
                  );
                })}
              </div>


            </div>
          </div>
        </div>
      )}

      {activeTab === 'connections' && (
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-800/50 border border-gray-200 dark:border-slate-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-500 dark:text-slate-400" />
            <h3 className="text-base font-semibold text-gray-800 dark:text-white">Journal des connexions</h3>
          </div>
          <div className="p-4">
            <LoginHistory adminMode />
          </div>
        </div>
      )}

      {activeTab === 'backup' && <BackupPanel />}

      {activeTab === 'webhooks' && <WebhooksPanel />}

      {activeTab === 'ai' && <AiConfigPanel />}
      {activeTab === 'ttps' && <TtpManagementPanel />}

      {showUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-lg max-w-lg w-full p-6 border border-transparent dark:border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-800 dark:text-white">
                {editingUserForModal ? t('admin.editUser') : t('admin.createUser')}
              </h3>
              <button onClick={() => setShowUserModal(false)} className="text-gray-500 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-4">
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm mb-4">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">{t('admin.fullName')}</label>
                  <input
                    type="text"
                    required
                    value={userFormData.fullName}
                    onChange={(e) => setUserFormData({ ...userFormData, fullName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">{t('admin.email')}</label>
                  <input
                    type="email"
                    required
                    value={userFormData.email}
                    onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    {t('admin.password')} {editingUserForModal && <span className="text-gray-400 font-normal">({t('profile.newPasswordHint') || 'optionnel'})</span>}
                  </label>
                  <input
                    type="password"
                    required={!editingUserForModal}
                    value={userFormData.password}
                    onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-3">{t('admin.roles')}</label>
                
                {/* Admin */}
                <div className="mb-3 px-1">
                  <label className={`inline-flex items-center ${editingUserForModal?.id === currentUser?.id ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                    <input
                      type="checkbox"
                      checked={userFormData.roles.includes('admin')}
                      disabled={editingUserForModal?.id === currentUser?.id && userFormData.roles.includes('admin')}
                      onChange={(e) => {
                        const newRoles = e.target.checked
                          ? [...userFormData.roles, 'admin']
                          : userFormData.roles.filter(r => r !== 'admin');
                        setUserFormData({ ...userFormData, roles: newRoles });
                      }}
                      className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 disabled:opacity-50"
                    />
                    <span className="ml-2 text-sm font-medium text-gray-700 dark:text-slate-300">Admin</span>
                    <span className="ml-2 text-xs text-gray-400">(accès complet)</span>
                    {editingUserForModal?.id === currentUser?.id && (
                      <span className="ml-2 text-xs text-amber-500 dark:text-amber-400">🔒 Impossible de retirer votre propre rôle admin</span>
                    )}
                  </label>
                </div>

                <div className="mt-3 p-3 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/30">
                  <p className="text-xs text-gray-500 dark:text-slate-400 italic">
                    ℹ️ Les rôles CERT / SOC (Analyste, Lecteur) se gèrent dans l’onglet <strong>Bénéficiaires</strong>, pour chaque bénéficiaire individuellement.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">{t('admin.beneficiaries')}</label>
                <div className="max-h-32 overflow-y-auto border border-gray-200 dark:border-slate-700 rounded-lg p-2 space-y-1">
                  {beneficiaries.map(b => (
                    <label key={b.id} className="flex items-center p-1.5 hover:bg-gray-50 dark:hover:bg-slate-800 rounded transition cursor-pointer">
                      <input
                        type="checkbox"
                        checked={userFormData.beneficiaryIds.includes(b.id)}
                        onChange={(e) => {
                          const newIds = e.target.checked
                            ? [...userFormData.beneficiaryIds, b.id]
                            : userFormData.beneficiaryIds.filter(id => id !== b.id);
                          setUserFormData({ ...userFormData, beneficiaryIds: newIds });
                        }}
                        className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                      />
                      <span className="ml-2 text-sm text-gray-700 dark:text-slate-300">{b.name}</span>
                    </label>
                  ))}
                  {beneficiaries.length === 0 && (
                    <p className="text-xs text-gray-500 italic p-2">{t('admin.noBeneficiaries')}</p>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-6 border-t border-gray-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition text-gray-700 dark:text-slate-300"
                >
                  {t('admin.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 font-medium"
                >
                  {updating ? t('admin.saving') : (editingUserForModal ? t('admin.save') : t('admin.create'))}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deletingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-lg max-w-sm w-full p-4 sm:p-6 border border-transparent dark:border-slate-700">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-white">{t('admin.deleteUser')}</h3>
                <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
                  {t('admin.deleteConfirm')} <strong>{deletingUser.full_name}</strong> ({deletingUser.email})
                </p>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm mb-4">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setDeletingUser(null); setError(''); }}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition text-gray-700 dark:text-slate-300"
              >
                {t('admin.cancel')}
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                disabled={deleting}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition disabled:opacity-50"
              >
                {deleting ? t('admin.deleting') : t('admin.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showBeneficiaryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-lg max-w-md w-full p-6 border border-transparent dark:border-slate-700">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-800 dark:text-white">
                {editingBeneficiary ? t('admin.editBeneficiary') : t('admin.addBeneficiary')}
              </h3>
              <button onClick={() => setShowBeneficiaryModal(false)} className="text-gray-500 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveBeneficiary} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">{t('admin.beneficiaryName')}</label>
                <input
                  type="text"
                  required
                  value={beneficiaryFormData.name}
                  onChange={(e) => setBeneficiaryFormData({ ...beneficiaryFormData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">{t('admin.description')}</label>
                <textarea
                  value={beneficiaryFormData.description}
                  onChange={(e) => setBeneficiaryFormData({ ...beneficiaryFormData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-800 dark:text-white"
                  rows={3}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowBeneficiaryModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition dark:text-slate-300"
                >
                  {t('admin.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {updating ? t('admin.saving') : t('admin.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showMemberModal && selectedBeneficiary && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-lg max-w-md w-full p-6 border border-transparent dark:border-slate-700">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-800 dark:text-white">{t('admin.addMember')}</h3>
              <button onClick={() => setShowMemberModal(false)} className="text-gray-500 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={addMemberToBeneficiary} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">{t('admin.selectUser')}</label>
                <select
                  required
                  value={memberFormData.user_id}
                  onChange={(e) => setMemberFormData({ ...memberFormData, user_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-800 dark:text-white"
                >
                  <option value="">{t('admin.chooseUser')}</option>
                  {users
                    .filter(u => !beneficiaryMembers.some(m => m.user_id === u.id))
                    .map((u) => (
                      <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>
                    ))
                  }
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowMemberModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition dark:text-slate-300"
                >
                  {t('admin.cancel')}
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                >
                  {t('admin.add')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>{/* content area */}
      </div>{/* flex container */}
    </div>
  );
}
