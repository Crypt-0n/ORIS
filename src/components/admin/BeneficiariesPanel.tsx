import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { Building, Edit, Trash2, UserPlus, Crown, X } from 'lucide-react';

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

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
}

export function BeneficiariesPanel() {
  const { t } = useTranslation();

  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [selectedBeneficiary, setSelectedBeneficiary] = useState<Beneficiary | null>(null);
  const [beneficiaryMembers, setBeneficiaryMembers] = useState<BeneficiaryMember[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [showBeneficiaryModal, setShowBeneficiaryModal] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [editingBeneficiary, setEditingBeneficiary] = useState<Beneficiary | null>(null);
  const [beneficiaryFormData, setBeneficiaryFormData] = useState({ name: '', description: '' });
  const [memberFormData, setMemberFormData] = useState({ user_id: '' });
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchBeneficiaries();
    fetchUsers(); // Needed for add member dropdown
  }, []);

  const fetchBeneficiaries = async () => {
    setLoading(true);
    try {
      const data = await api.get('/admin/beneficiaries');
      setBeneficiaries(data || []);
      // Refresh current selection if it exists
      if (selectedBeneficiary) {
        const updatedSelection = data?.find((b: any) => b.id === selectedBeneficiary.id);
        if (updatedSelection) setSelectedBeneficiary(updatedSelection);
      }
    } catch (error) { console.error('Erreur:', error); }
    setLoading(false);
  };

  const fetchBeneficiaryMembers = async (beneficiaryId: string) => {
    try {
      const data = await api.get(`/admin/beneficiaries/${beneficiaryId}/members`);
      setBeneficiaryMembers(data || []);
    } catch (error) { console.error('Erreur:', error); }
  };

  const fetchUsers = async () => {
    try {
      const data = await api.get('/admin/users');
      setUsers(data || []);
    } catch (error) { console.error('Erreur:', error); }
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
      setShowBeneficiaryModal(false);
      fetchBeneficiaries();
    } catch (error) { console.error('Erreur:', error); }
    setUpdating(false);
  };

  const handleDeleteBeneficiary = async (id: string) => {
    if (!confirm(t('admin.confirmDeleteBeneficiary', 'Supprimer ce bénéficiaire ?'))) return;
    try {
      await api.delete(`/admin/beneficiaries/${id}`);
      if (selectedBeneficiary?.id === id) setSelectedBeneficiary(null);
      fetchBeneficiaries();
    } catch (error) { console.error('Erreur:', error); }
  };

  const addMemberToBeneficiary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBeneficiary) return;
    try {
      await api.post(`/admin/beneficiaries/${selectedBeneficiary.id}/members`, memberFormData);
      setShowMemberModal(false);
      fetchBeneficiaryMembers(selectedBeneficiary.id);
      fetchBeneficiaries();
    } catch (error) { console.error('Erreur:', error); }
  };

  const removeMemberFromBeneficiary = async (memberId: string) => {
    if (!selectedBeneficiary) return;
    try {
      await api.delete(`/admin/beneficiaries/${selectedBeneficiary.id}/members/${memberId}`);
      fetchBeneficiaryMembers(selectedBeneficiary.id);
      fetchBeneficiaries();
    } catch (error) { console.error('Erreur:', error); }
  };

  const toggleTeamLead = async (memberId: string, currentStatus: boolean) => {
    if (!selectedBeneficiary) return;
    try {
      await api.put(`/admin/beneficiaries/${selectedBeneficiary.id}/members/${memberId}/team-lead`, { is_team_lead: !currentStatus });
      fetchBeneficiaryMembers(selectedBeneficiary.id);
    } catch (error) { console.error('Erreur:', error); }
  };

  const updateMemberRole = async (memberId: string, currentRoles: string[], clickedRole: string) => {
    if (!selectedBeneficiary) return;
    try {
      const newRoles = currentRoles.includes(clickedRole) ? currentRoles.filter(r => r !== clickedRole) : [...currentRoles, clickedRole];
      await api.put(`/admin/beneficiaries/${selectedBeneficiary.id}/members/${memberId}/role`, { role: JSON.stringify(newRoles) });
      fetchBeneficiaryMembers(selectedBeneficiary.id);
    } catch (error) { console.error('Erreur:', error); }
  };

  if (loading && beneficiaries.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-slate-400">{t('admin.loading', 'Chargement...')}</div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">{t('admin.beneficiaries', 'Bénéficiaires & Clients')}</h2>
        <p className="text-sm sm:text-base text-gray-600 dark:text-slate-400 mt-1">Gérez les organisations et leurs membres associés à votre plateforme.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white text-sm">{t('admin.beneficiaries', 'Bénéficiaires')}</h3>
            <button
              onClick={() => {
                setEditingBeneficiary(null);
                setBeneficiaryFormData({ name: '', description: '' });
                setShowBeneficiaryModal(true);
              }}
              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-sm"
              title={t('admin.addBeneficiary', 'Ajouter') || "Add"}
              aria-label={t('admin.addBeneficiary', 'Ajouter') || "Add"}
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
                  className={`p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800 transition ${selectedBeneficiary?.id === b.id ? 'bg-blue-50 dark:bg-blue-900/20 shadow-inner' : ''}`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                        {b.name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 max-w-[180px] break-words">{b.description || '—'}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 px-2.5 py-1 rounded-full border border-gray-200 dark:border-slate-700">
                        {b.member_count} {b.member_count > 1 ? 'membres' : 'membre'}
                      </span>
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingBeneficiary(b);
                            setBeneficiaryFormData({ name: b.name, description: b.description || '' });
                            setShowBeneficiaryModal(true);
                          }}
                          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 rounded transition"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteBeneficiary(b.id);
                          }}
                          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 dark:hover:text-red-400 rounded transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {beneficiaries.length === 0 && (
                <div className="p-8 text-center text-gray-500 dark:text-slate-400 italic">
                  {t('admin.noBeneficiaries', 'Aucun bénéficiaire')}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          {selectedBeneficiary ? (
            <div className="bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-800/50 border border-gray-200 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center bg-gray-50/50 dark:bg-slate-800/30">
                <div>
                  <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                    <Building className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    {selectedBeneficiary.name}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">{t('admin.manageMembers', 'Gérer les permissions des comptes au sein de cette entité')}</p>
                </div>
                <button
                  onClick={() => setShowMemberModal(true)}
                  className="flex items-center gap-2 bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 transition text-sm shadow-sm"
                >
                  <UserPlus className="w-4 h-4 flex-shrink-0" />
                  <span className="hidden sm:inline">{t('admin.addMember', 'Ajouter')}</span>
                </button>
              </div>

              <div className="overflow-x-auto text-sm sm:text-base min-h-[400px]">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                  <thead className="bg-white dark:bg-slate-900">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">{t('admin.user', 'Membre')}</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">CERT</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">SOC</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Team Lead</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-800 bg-gray-50/30 dark:bg-slate-800/10">
                    {beneficiaryMembers.map((m) => {
                      const memberRoles: string[] = (() => { try { return JSON.parse(m.role || '[]'); } catch { return []; } })();
                      return (
                      <tr key={m.id} className="hover:bg-white dark:hover:bg-slate-800 transition">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {m.is_team_lead && <Crown className="w-4 h-4 text-amber-500 flex-shrink-0" />}
                            <div>
                              <div className="font-semibold text-gray-900 dark:text-slate-200 text-sm">{m.full_name}</div>
                              <div className="text-[11px] text-gray-500 dark:text-slate-500 mt-0.5">{m.email}</div>
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
                                className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide font-bold transition-all ${memberRoles.includes(r.id)
                                  ? `bg-${r.color}-100 text-${r.color}-800 dark:bg-${r.color}-900/40 dark:text-${r.color}-300 ring-1 ring-${r.color}-300 dark:ring-${r.color}-600`
                                  : 'bg-white text-gray-500 dark:bg-slate-800/50 dark:text-slate-600 hover:bg-gray-100 border border-gray-200 dark:border-slate-700'}`}
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
                                className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide font-bold transition-all ${memberRoles.includes(r.id)
                                  ? `bg-${r.color}-100 text-${r.color}-800 dark:bg-${r.color}-900/40 dark:text-${r.color}-300 ring-1 ring-${r.color}-300 dark:ring-${r.color}-600`
                                  : 'bg-white text-gray-500 dark:bg-slate-800/50 dark:text-slate-600 hover:bg-gray-100 border border-gray-200 dark:border-slate-700'}`}
                              >{r.label}</button>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          <button
                            onClick={() => toggleTeamLead(m.id, !!m.is_team_lead)}
                            title={m.is_team_lead ? 'Retirer le rôle Team Lead' : 'Promouvoir Team Lead'}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] uppercase tracking-wider font-bold transition-all shadow-sm ${m.is_team_lead
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 border-amber-300 dark:border-amber-700 dark:text-amber-300 hover:bg-amber-200 border'
                              : 'bg-white text-gray-500 dark:bg-slate-800/50 dark:text-slate-500 hover:bg-gray-50 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700'
                            }`}
                          >
                            <Crown className="w-3.5 h-3.5" />
                            {m.is_team_lead ? 'Team Lead' : 'Membre'}
                          </button>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => removeMemberFromBeneficiary(m.id)}
                            className="p-1.5 bg-white border border-gray-200 dark:border-slate-700 rounded text-red-400 hover:bg-red-50 hover:text-red-600 dark:bg-slate-800 dark:hover:bg-red-900/30 transition shadow-sm"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                      );
                    })}
                    {beneficiaryMembers.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-gray-500 dark:text-slate-400 italic">
                          {t('admin.noMembers', 'Ce bénéficiaire n\'a aucun membre associé.')}
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
              <h3 className="text-lg font-medium text-gray-800 dark:text-white mb-2">{t('admin.selectBeneficiary', 'Sélectionnez un bénéficiaire')}</h3>
              <p className="text-sm text-gray-500 dark:text-slate-400">{t('admin.selectBeneficiaryDesc', 'Cliquez sur une organisation listée à gauche pour gérer qui a le droit d\'y accéder.')}</p>
            </div>
          )}
        </div>
      </div>

      {showBeneficiaryModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-lg max-w-md w-full p-6 border border-gray-200 dark:border-slate-700 shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <Building className="w-5 h-5" />
                {editingBeneficiary ? t('admin.editBeneficiary', 'Édition du bénéficiaire') : t('admin.addBeneficiary', 'Nouveau bénéficiaire')}
              </h3>
              <button 
                type="button" 
                onClick={() => setShowBeneficiaryModal(false)} 
                className="text-gray-500 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-300 bg-gray-100 dark:bg-slate-800 p-1.5 rounded-full transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveBeneficiary} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">{t('admin.beneficiaryName', 'Nom du groupe / entité')}</label>
                <input
                  type="text"
                  required
                  value={beneficiaryFormData.name}
                  onChange={(e) => setBeneficiaryFormData({ ...beneficiaryFormData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-800 dark:text-white transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">{t('admin.description', 'Description')}</label>
                <textarea
                  value={beneficiaryFormData.description}
                  onChange={(e) => setBeneficiaryFormData({ ...beneficiaryFormData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-800 dark:text-white transition"
                  rows={3}
                />
              </div>
              <div className="flex gap-3 pt-6 border-t border-gray-100 dark:border-slate-800 mt-6">
                <button
                  type="button"
                  onClick={() => setShowBeneficiaryModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition dark:text-slate-300 font-medium"
                >
                  {t('admin.cancel', 'Annuler')}
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 font-medium"
                >
                  {updating ? t('admin.saving', 'Enregistrement...') : t('admin.save', 'Enregistrer')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showMemberModal && selectedBeneficiary && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-lg max-w-md w-full p-6 border border-gray-200 dark:border-slate-700 shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5" />
                {t('admin.addMember', 'Lier un compte')}
              </h3>
              <button 
                type="button" 
                onClick={() => setShowMemberModal(false)} 
                className="text-gray-500 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-300 bg-gray-100 dark:bg-slate-800 p-1.5 rounded-full transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={addMemberToBeneficiary} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Choisir parmi les {users.length} comptes locaux</label>
                <select
                  required
                  value={memberFormData.user_id}
                  onChange={(e) => setMemberFormData({ ...memberFormData, user_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-800 dark:text-white transition"
                >
                  <option value="">{t('admin.chooseUser', '-- Sélectionner --')}</option>
                  {users
                    .filter(u => !beneficiaryMembers.some(m => m.user_id === u.id))
                    .map((u) => (
                      <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>
                    ))
                  }
                </select>
                <p className="text-xs text-slate-500 mt-2">
                  ℹ️ L'attribution des rôles (Lecteur, Analyste, TeamLead) se fait une fois le compte ajouté.
                </p>
              </div>
              <div className="flex gap-3 pt-6 border-t border-gray-100 dark:border-slate-800 mt-6">
                <button
                  type="button"
                  onClick={() => setShowMemberModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition dark:text-slate-300 font-medium"
                >
                  {t('admin.cancel', 'Annuler')}
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-medium"
                >
                  {t('admin.add', 'Ajouter à l\'entité')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
