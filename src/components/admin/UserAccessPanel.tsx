import React from 'react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { UserPlus, Trash2, Edit, AlertTriangle, X, Shield, Clock, Users } from 'lucide-react';
import { LoginHistory } from '../LoginHistory';

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

export function UserAccessPanel() {
  const { user: currentUser } = useAuth();
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === 'fr' ? 'fr-FR' : 'en-GB';

  const [activeTab, setActiveTab] = useState<'users' | 'connections'>('users');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUserForModal, setEditingUserForModal] = useState<UserProfile | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserProfile | null>(null);
  const [userFormData, setUserFormData] = useState({
    email: '',
    fullName: '',
    password: '',
    roles: [] as string[],
    beneficiaryIds: [] as string[]
  });
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchBeneficiaries();
  }, []);

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
    } catch (error) { console.error('Erreur:', error); }
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      await api.put(`/admin/users/${userId}`, { is_active: !currentStatus });
      fetchUsers();
    } catch (error) { console.error('Erreur:', error); }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    setDeleting(true);
    setError('');
    try {
      await api.delete(`/admin/users/${deletingUser.id}`);
      setDeletingUser(null);
      fetchUsers();
    } catch (err: any) {
      setError(err.message || t('admin.errorDeletingUser'));
    }
    setDeleting(false);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdating(true);
    setError('');

    try {
      if (editingUserForModal) {
        const payload: any = {
          email: userFormData.email,
          full_name: userFormData.fullName,
          roles: userFormData.roles,
          beneficiaryIds: userFormData.beneficiaryIds
        };
        if (userFormData.password) {
          payload.password = userFormData.password;
        }
        await api.put(`/admin/users/${editingUserForModal.id}`, payload);
      } else {
        await api.post('/admin/users', {
          email: userFormData.email,
          fullName: userFormData.fullName,
          password: userFormData.password,
          roles: userFormData.roles,
          beneficiaryIds: userFormData.beneficiaryIds
        });
      }
      setShowUserModal(false);
      fetchUsers();
    } catch (err: any) {
      setError(err.message || t('admin.errorSavingUser'));
    }
    setUpdating(false);
  };

  const getRoleBadges = (roles: string[]) => {
    if (!roles || roles.length === 0) return <span className="text-gray-500 text-xs italic">Aucun rôle</span>;

    return roles.map(role => {
      const roleConfigs: Record<string, { label: string; color: string; icon: any }> = {
        'admin': { label: 'Admin', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 ring-1 ring-purple-300 dark:ring-purple-700', icon: Shield },
      };
      
      const config = roleConfigs[role] || { 
        label: role, 
        color: 'bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-slate-300', 
        icon: Shield 
      };
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-slate-400">{t('admin.loading', 'Chargement...')}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-slate-700 pb-0">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0 -mb-px ${
            activeTab === 'users'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
          }`}
        >
          <Users className="w-4 h-4" />
          {t('admin.users', 'Utilisateurs Locaux')}
        </button>
        <button
          onClick={() => setActiveTab('connections')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0 -mb-px ${
            activeTab === 'connections'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
          }`}
        >
          <Clock className="w-4 h-4" />
          {t('admin.connections', 'Sessions & Logs')}
        </button>
      </div>

      {activeTab === 'users' && (
        <div className="animate-in fade-in flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">{t('admin.title', 'Administration')}</h2>
              <p className="text-sm sm:text-base text-gray-600 dark:text-slate-400 mt-1">{t('admin.subtitle', 'Gérez les comptes locaux.')}</p>
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
              {t('admin.newUser', 'Nouvel utilisateur')}
            </button>
          </div>

          <div className="hidden lg:block bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-800/50 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
              <thead className="bg-gray-50 dark:bg-slate-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    {t('admin.user', 'Utilisateur')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    {t('admin.roles', 'Rôles Système')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    {t('admin.status', 'Statut')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    {t('admin.createdAt', 'Créé le')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    {t('admin.actions', 'Actions')}
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
                        title={user.id === currentUser?.id ? t('admin.cannotDeactivateSelf', 'Impossible de désactiver votre compte') : ''}
                        className={`px-3 py-1 rounded-full text-xs font-medium ${user.is_active
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                          } ${user.id === currentUser?.id ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80 transition cursor-pointer'}`}
                      >
                        {user.is_active ? t('admin.active', 'Actif') : t('admin.inactive', 'Inactif')}
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
                          aria-label={`${t('admin.edit', 'Editer')} ${user.full_name}`}
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeletingUser(user)}
                          disabled={user.is_protected || user.id === currentUser?.id}
                          className="text-red-600 hover:text-red-900 dark:hover:text-red-400 transition disabled:opacity-30 disabled:cursor-not-allowed"
                          aria-label={`${t('admin.delete', 'Supprimer')} ${user.full_name}`}
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
                    <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">{t('admin.roles', 'Rôles')}</p>
                    <div className="flex flex-wrap gap-1">
                      {getRoleBadges(user.roles || [])}
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-slate-800">
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">{t('admin.status', 'Status')}</p>
                      <button
                        onClick={() => toggleUserStatus(user.id, user.is_active)}
                        disabled={user.id === currentUser?.id}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium ${user.is_active
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                          } ${user.id === currentUser?.id ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80 transition cursor-pointer'}`}
                      >
                        {user.is_active ? t('admin.active', 'Actif') : t('admin.inactive', 'Inactif')}
                      </button>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">{t('admin.createdAt', 'Créé le')}</p>
                      <p className="text-xs text-gray-700 dark:text-slate-300">
                        {new Date(user.created_at).toLocaleDateString(dateLocale)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'connections' && (
        <div className="animate-in fade-in bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-800/50 border border-gray-200 dark:border-slate-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-500 dark:text-slate-400" />
            <h3 className="text-base font-semibold text-gray-800 dark:text-white">Journal des connexions</h3>
          </div>
          <div className="p-4">
            <LoginHistory adminMode />
          </div>
        </div>
      )}

      {/* User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-lg max-w-lg w-full p-6 border border-gray-100 dark:border-slate-700 max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-800 dark:text-white">
                {editingUserForModal ? t('admin.editUser', 'Modifier l\'utilisateur') : t('admin.createUser', 'Créer un utilisateur')}
              </h3>
              <button 
                type="button" 
                onClick={() => setShowUserModal(false)} 
                className="text-gray-500 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-300 bg-gray-100 dark:bg-slate-800 p-1.5 rounded-full transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-4">
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">{t('admin.fullName', 'Nom complet')}</label>
                  <input
                    type="text"
                    required
                    autoComplete="name"
                    value={userFormData.fullName}
                    onChange={(e) => setUserFormData({ ...userFormData, fullName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-800 dark:text-white transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">{t('admin.email', 'Email')}</label>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={userFormData.email}
                    onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-800 dark:text-white transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    {t('admin.password', 'Mot de passe')} {editingUserForModal && <span className="text-gray-500 font-normal">({t('profile.newPasswordHint', 'optionnel')})</span>}
                  </label>
                  <input
                    type="password"
                    required={!editingUserForModal}
                    autoComplete="new-password"
                    value={userFormData.password}
                    onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-800 dark:text-white transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-3">{t('admin.roles', 'Rôles Globaux')}</label>
                
                <div className="px-1 mb-2">
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
                    <span className="ml-2 text-xs text-gray-500 dark:text-slate-500">(accès complet)</span>
                    {editingUserForModal?.id === currentUser?.id && (
                      <span className="ml-2 text-xs text-amber-500 dark:text-amber-400">🔒 Impossible de retirer votre propre rôle</span>
                    )}
                  </label>
                </div>
                <div className="p-3 rounded-lg border border-blue-100 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-900/10">
                  <p className="text-xs text-blue-600 dark:text-blue-400 italic">
                    ℹ️ Les rôles CERT / SOC (Analyste, Lecteur) se gèrent dans la vue <strong>Bénéficiaires & Clients</strong>, pour chaque organisation individuellement.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">{t('admin.beneficiaries', 'Appartenance Bénéficiaires')}</label>
                <div className="max-h-36 overflow-y-auto border border-gray-200 dark:border-slate-700 rounded-lg p-2 space-y-1 bg-gray-50/50 dark:bg-slate-800/30">
                  {beneficiaries.map(b => (
                    <label key={b.id} className="flex items-center p-2 hover:bg-white dark:hover:bg-slate-800 rounded transition cursor-pointer border border-transparent hover:border-gray-200 dark:hover:border-slate-700">
                      <input
                        type="checkbox"
                        checked={userFormData.beneficiaryIds.includes(b.id)}
                        onChange={(e) => {
                          const newIds = e.target.checked
                            ? [...userFormData.beneficiaryIds, b.id]
                            : userFormData.beneficiaryIds.filter(id => id !== b.id);
                          setUserFormData({ ...userFormData, beneficiaryIds: newIds });
                        }}
                        className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 mt-0.5"
                      />
                      <span className="ml-3 text-sm font-medium text-gray-700 dark:text-slate-300">{b.name}</span>
                    </label>
                  ))}
                  {beneficiaries.length === 0 && (
                    <p className="text-xs text-gray-500 italic p-3 text-center">{t('admin.noBeneficiaries', 'Aucun bénéficiaire configuré')}</p>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-6 border-t border-gray-100 dark:border-slate-800 mt-6">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition text-gray-700 dark:text-slate-300 font-medium"
                >
                  {t('admin.cancel', 'Annuler')}
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 font-medium"
                >
                  {updating ? t('admin.saving', 'Enregistrement...') : (editingUserForModal ? t('admin.save', 'Enregistrer') : t('admin.create', 'Créer'))}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-lg max-w-sm w-full p-6 border border-transparent dark:border-slate-700 shadow-xl">
            <div className="flex items-start gap-4 mb-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-white">{t('admin.deleteUser', 'Supprimer l\'utilisateur')}</h3>
                <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
                  {t('admin.deleteConfirm', 'Êtes-vous sûr de vouloir supprimer')} <strong>{deletingUser.full_name}</strong> ?
                </p>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm mb-4">
                {error}
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => { setDeletingUser(null); setError(''); }}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition text-gray-700 dark:text-slate-300 font-medium"
              >
                {t('admin.cancel', 'Annuler')}
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                disabled={deleting}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition disabled:opacity-50 font-medium"
              >
                {deleting ? t('admin.deleting', 'Suppression...') : t('admin.delete', 'Supprimer')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
