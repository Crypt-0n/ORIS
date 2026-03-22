import { useState, useEffect } from 'react';
import { User, Mail, Shield, Lock, Eye, EyeOff, Check, AlertCircle, Globe, Key, Trash2, Hash, Camera, X, Info } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { UserAvatar } from './UserAvatar';
import { LoginHistory } from './LoginHistory';
import { TwoFactorCard } from './TwoFactorCard';
import { NotificationPreferencesCard } from './NotificationPreferencesCard';
import { useTranslation } from "react-i18next";
import { Link } from 'react-router-dom';

export function UserProfile() {
  const { t } = useTranslation();
  const { user, profile } = useAuth();

  return (
    <div className="space-y-6 min-w-0 overflow-x-hidden">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('auto.mon_profil')}</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
          {t('auto.informations_personnelles_et_p')}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 min-w-0 overflow-hidden">
        <ProfileInfoCard user={user} profile={profile} />
        <div className="space-y-6 min-w-0 overflow-hidden">
          <LanguageCard />
          <TwoFactorCard />
          <NotificationPreferencesCard />
          <PinCodeCard />
          <ApiTokensCard />
          <ChangePasswordCard />
        </div>
      </div>

      {/* Login history */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-5 overflow-hidden">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-white mb-3 flex items-center gap-2">
          <Shield className="w-4 h-4 text-blue-500" />
          Journal des connexions
        </h3>
        <LoginHistory />
      </div>

      {/* About link */}
      <div className="flex justify-center">
        <Link
          to="/about"
          className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-300 transition"
        >
          <Info className="w-4 h-4" />
          {t('nav.about')}
        </Link>
      </div>
    </div>
  );
}

function ApiTokensCard() {
  const { t } = useTranslation();
  const [tokens, setTokens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    checkAllowed();
  }, []);

  const checkAllowed = async () => {
    try {
      const { allowApiTokens } = await api.get('/auth/config/allow-api-tokens');
      setAllowed(allowApiTokens);
      if (allowApiTokens) {
        fetchTokens();
      }
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const fetchTokens = async () => {
    try {
      const data = await api.get('/auth/api-tokens');
      setTokens(data || []);
    } catch (err) { console.error(err); }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTokenName.trim()) return;
    setGenerating(true);
    setError('');
    try {
      const res = await api.post('/auth/api-tokens', { name: newTokenName });
      setGeneratedToken(res.token);
      setNewTokenName('');
      fetchTokens();
    } catch (err: any) {
      setError(err.message || 'Error generating token');
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm(t('profile.apiTokens.revokeConfirm'))) return;
    try {
      await api.delete(`/auth/api-tokens/${id}`);
      fetchTokens();
    } catch (err) { console.error(err); }
  };

  if (loading) return null;
  if (!allowed) return null;

  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-4 sm:p-6 overflow-hidden">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-gray-100 dark:bg-slate-800">
          <Key className="w-4 h-4 text-gray-500 dark:text-slate-400" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">{t('profile.apiTokens.title')}</h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{t('profile.apiTokens.subtitle')}</p>
        </div>
      </div>

      {generatedToken ? (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-xs font-bold text-blue-800 dark:text-blue-300 mb-2">{t('profile.apiTokens.generatedTitle')}</p>
          <div className="flex gap-2">
            <code className="flex-1 bg-white dark:bg-slate-900 p-2 rounded border border-blue-200 dark:border-blue-800 text-xs overflow-x-auto">
              {generatedToken}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(generatedToken);
              }}
              className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
              title={t('auto.copier')}
            >
              <Check className="w-4 h-4" />
            </button>
          </div>
          <p className="mt-2 text-[10px] text-blue-600 dark:text-blue-400">{t('profile.apiTokens.generatedWarning')}</p>
          <button
            onClick={() => setGeneratedToken(null)}
            className="mt-3 text-xs font-medium text-blue-800 dark:text-blue-300 hover:underline"
          >
            {t('auto.fermer')}
          </button>
        </div>
      ) : (
        <form onSubmit={handleGenerate} className="mb-6 flex gap-2">
          <input
            type="text"
            value={newTokenName}
            onChange={(e) => setNewTokenName(e.target.value)}
            placeholder={t('profile.apiTokens.placeholder')}
            className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={generating || !newTokenName.trim()}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {generating ? '...' : t('auto.generer')}
          </button>
        </form>
      )}

      {error && <p className="mb-4 text-xs text-red-600">{error}</p>}

      <div className="space-y-3">
        {tokens.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">{t('profile.apiTokens.noTokens')}</p>
        ) : (
          tokens.map((token) => (
            <div key={token.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800/50 rounded-lg border border-gray-100 dark:border-slate-700/50">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-slate-200 truncate">{token.name}</p>
                <p className="text-[10px] text-gray-500 dark:text-slate-400">
                  {t('auto.cree_le')} {new Date(token.created_at).toLocaleDateString()}
                  {token.last_used_at && ` • ${t('auto.utilise_le')} ${new Date(token.last_used_at).toLocaleDateString()}`}
                </p>
              </div>
              <button
                onClick={() => handleRevoke(token.id)}
                className="p-2 text-gray-400 hover:text-red-600 transition"
                title={t('auto.revoquer')}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ProfileInfoCard({
  user,
  profile,
}: {
  user: ReturnType<typeof useAuth>['user'];
  profile: ReturnType<typeof useAuth>['profile'];
}) {
  const { t } = useTranslation();
  const { refreshProfile } = useAuth();
  const [uploading, setUploading] = useState(false);

  const roleLabels: Record<string, string> = {
    admin: t('admin.roleAdmin'),
    team_leader: t('admin.roleTeamLeader'),
    analyst: t('admin.roleUser'),
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const res = await fetch('/api/auth/avatar', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${api.getToken()}` },
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      await refreshProfile();
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const handleAvatarDelete = async () => {
    setUploading(true);
    try {
      await api.delete('/auth/avatar');
      await refreshProfile();
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-4 sm:p-6 overflow-hidden">
      <div className="flex items-center gap-4 mb-6">
        <div className="relative group">
          <UserAvatar name={profile?.full_name} avatarUrl={profile?.avatar_url} size="lg" />
          <label
            className={`absolute inset-0 rounded-full flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer ${uploading ? 'opacity-100' : ''}`}
          >
            <Camera className="w-5 h-5 text-white" />
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleAvatarUpload}
              className="hidden"
              disabled={uploading}
            />
          </label>
          {profile?.avatar_url && (
            <button
              onClick={handleAvatarDelete}
              disabled={uploading}
              className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity shadow"
              title={t('profile.avatar.remove')}
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white truncate">
            {profile?.full_name || '—'}
          </h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 truncate">
            {user?.email || '—'}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <InfoRow icon={User} label={t('profile.fullName')} value={profile?.full_name || '—'} />
        <InfoRow icon={Mail} label={t('profile.email')} value={user?.email || '—'} />
        <InfoRow
          icon={Shield}
          label={t('profile.role')}
          value={
            profile?.roles && profile.roles.length > 0
              ? profile.roles.map(r => roleLabels[r] || r).join(', ')
              : '—'
          }
        />

        <div className="pt-3 mt-3 border-t border-gray-100 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 dark:text-slate-400">{t('auto.statut')}</span>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${profile?.is_active
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${profile?.is_active ? 'bg-emerald-500' : 'bg-red-500'
                }`} />
              {profile?.is_active ? t('admin.active') : t('admin.inactive')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof User;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-lg bg-gray-100 dark:bg-slate-800 flex-shrink-0">
        <Icon className="w-4 h-4 text-gray-500 dark:text-slate-400" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 dark:text-slate-400">{label}</p>
        <p className="text-sm font-medium text-gray-800 dark:text-slate-200 truncate">{value}</p>
      </div>
    </div>
  );
}

function LanguageCard() {
  const { t, i18n } = useTranslation();
  const current = i18n.language;

  const handleChange = (lang: string) => {
    i18n.changeLanguage(lang);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-4 sm:p-6 overflow-hidden">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-gray-100 dark:bg-slate-800">
          <Globe className="w-4 h-4 text-gray-500 dark:text-slate-400" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">{t('settings.language.title')}</h2>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => handleChange('fr')}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${current === 'fr'
            ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-400'
            : 'border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800'
            }`}
        >
          🇫🇷 Français
        </button>
        <button
          onClick={() => handleChange('en')}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${current === 'en'
            ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-400'
            : 'border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800'
            }`}
        >
          🇬🇧 English
        </button>
      </div>
    </div>
  );
}

function PinCodeCard() {
  const { t } = useTranslation();
  const { profile, refreshProfile } = useAuth();
  const hasPin = profile?.has_pin ?? false;

  const [currentPassword, setCurrentPassword] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  const isValid = currentPassword.length >= 1 && /^\d{4,6}$/.test(pin) && pin === confirmPin;

  const handleSetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.put('/auth/pin', { currentPassword, pin });
      setSuccess(t('profile.pin.setSuccess'));
      setCurrentPassword('');
      setPin('');
      setConfirmPin('');
      setShowForm(false);
      refreshProfile();
    } catch (err: any) {
      setError(err.message || t('profile.pin.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleRemovePin = async () => {
    const pwd = prompt(t('profile.pin.confirmRemove'));
    if (!pwd) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.put('/auth/pin', { currentPassword: pwd, remove: true });
      setSuccess(t('profile.pin.removeSuccess'));
      refreshProfile();
    } catch (err: any) {
      setError(err.message || t('profile.pin.error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-4 sm:p-6 overflow-hidden">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-gray-100 dark:bg-slate-800">
          <Hash className="w-4 h-4 text-gray-500 dark:text-slate-400" />
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">{t('profile.pin.title')}</h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{t('profile.pin.subtitle')}</p>
        </div>
        {hasPin && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
            {t('profile.pin.active')}
          </span>
        )}
      </div>

      {success && (
        <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
          <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
          <p className="text-sm text-emerald-700 dark:text-emerald-400">{success}</p>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {!showForm ? (
        <div className="flex gap-2">
          <button
            onClick={() => { setShowForm(true); setSuccess(''); setError(''); }}
            className="flex-1 py-2 px-4 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            {hasPin ? t('profile.pin.change') : t('profile.pin.set')}
          </button>
          {hasPin && (
            <button
              onClick={handleRemovePin}
              disabled={saving}
              className="py-2 px-4 rounded-lg text-sm font-medium text-red-600 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
            >
              {t('profile.pin.remove')}
            </button>
          )}
        </div>
      ) : (
        <form onSubmit={handleSetPin} className="space-y-3">
          <input type="hidden" autoComplete="username" value={profile?.email || ''} />
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1.5">
              {t('profile.currentPassword')}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder={t('auto.entrez_votre_mot_de_passe_actu')}
                autoComplete="current-password"
                className="w-full px-3 py-2 pr-10 text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-300 transition"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1.5">
              {t('profile.pin.label')}
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={e => { if (/^\d*$/.test(e.target.value)) setPin(e.target.value); }}
              placeholder="••••"
              autoComplete="off"
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1.5">
              {t('profile.pin.confirm')}
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={confirmPin}
              onChange={e => { if (/^\d*$/.test(e.target.value)) setConfirmPin(e.target.value); }}
              placeholder="••••"
              autoComplete="off"
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
            />
          </div>
          {pin.length > 0 && (pin.length < 4 || pin.length > 6) && (
            <p className="text-xs text-amber-600 dark:text-amber-400">{t('profile.pin.lengthHint')}</p>
          )}
          {confirmPin.length > 0 && confirmPin !== pin && (
            <p className="text-xs text-red-600 dark:text-red-400">{t('profile.pin.mismatch')}</p>
          )}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => { setShowForm(false); setCurrentPassword(''); setPin(''); setConfirmPin(''); setError(''); }}
              className="flex-1 py-2 px-4 rounded-lg text-sm font-medium border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
            >
              {t('admin.cancel')}
            </button>
            <button
              type="submit"
              disabled={!isValid || saving}
              className="flex-1 py-2 px-4 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? t('profile.saving') : t('profile.pin.save')}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function ChangePasswordCard() {
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const { user } = useAuth();

  const isValid =
    currentPassword.length >= 1 &&
    newPassword.length >= 6 &&
    confirmPassword === newPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || !user) return;

    setError('');
    setSuccess(false);
    setSaving(true);

    try {
      await api.put('/auth/password', {
        currentPassword,
        newPassword
      });

      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auto.mot_de_passe_incorrect'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-4 sm:p-6 overflow-hidden">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-gray-100 dark:bg-slate-800">
          <Lock className="w-4 h-4 text-gray-500 dark:text-slate-400" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">{t('auto.modifier_le_mot_de_passe')}</h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            {t('auto.minimum_6_caracteres_requis')}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="hidden" autoComplete="username" value={user?.email || ''} />
        <PasswordField
          label={t('profile.currentPassword')}
          value={currentPassword}
          onChange={setCurrentPassword}
          show={showCurrent}
          onToggle={() => setShowCurrent(!showCurrent)}
          placeholder={t('auto.entrez_votre_mot_de_passe_actu')}
          autoComplete="current-password"
        />
        <PasswordField
          label={t('profile.newPassword')}
          value={newPassword}
          onChange={setNewPassword}
          show={showNew}
          onToggle={() => setShowNew(!showNew)}
          placeholder={t('auto.minimum_6_caracteres')}
          autoComplete="new-password"
        />
        <PasswordField
          label={t('profile.confirmPassword')}
          value={confirmPassword}
          onChange={setConfirmPassword}
          show={showConfirm}
          onToggle={() => setShowConfirm(!showConfirm)}
          placeholder={t('auto.repetez_le_nouveau_mot_de_pass')}
          autoComplete="new-password"
        />

        {newPassword.length > 0 && newPassword.length < 6 && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            {t('auto.le_mot_de_passe_doit_contenir_')}</p>
        )}
        {confirmPassword.length > 0 && confirmPassword !== newPassword && (
          <p className="text-xs text-red-600 dark:text-red-400">
            {t('auto.les_mots_de_passe_ne_correspon')}</p>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
            <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            <p className="text-sm text-emerald-700 dark:text-emerald-400">
              {t('auto.mot_de_passe_modifie_avec_succ')}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={!isValid || saving}
          className="w-full py-2.5 px-4 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? t('profile.saving') : t('profile.changePassword')}
        </button>
      </form>
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  show,
  onToggle,
  placeholder,
  autoComplete = 'off',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  placeholder: string;
  autoComplete?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="w-full px-3 py-2 pr-10 text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-300 transition"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
