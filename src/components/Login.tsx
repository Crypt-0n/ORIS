import React from 'react';
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { LogIn, ShieldCheck } from 'lucide-react';
import { Logo } from './Logo';

export function Login() {
  const { signIn, verify2FA } = useAuth();
  const { t } = useTranslation();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 2FA state
  const [needs2FA, setNeeds2FA] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const totpInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(formData.email, formData.password);
    } catch (err: any) {
      if (err.requires_2fa) {
        setNeeds2FA(true);
        setTempToken(err.temp_token);
        setTimeout(() => totpInputRef.current?.focus(), 100);
      } else {
        setError(t('login.invalidCredentials'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await verify2FA(tempToken, totpCode);
    } catch (err: any) {
      setError(err?.message || 'Code invalide');
      setTotpCode('');
    } finally {
      setLoading(false);
    }
  };

  // Auto-submit when 6 digits entered
  useEffect(() => {
    if (totpCode.replace(/\s/g, '').length === 6 && needs2FA && !loading) {
      handleVerify2FA({ preventDefault: () => {} } as React.FormEvent);
    }
  }, [totpCode]);

  if (needs2FA) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-md w-full p-8">
          <div className="flex justify-center mb-6">
            <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30">
              <ShieldCheck className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
          </div>

          <h1 className="text-xl font-bold text-center text-gray-800 dark:text-white mb-2">
            {t('login.twoFactor.title')}
          </h1>
          <p className="text-center text-gray-600 dark:text-slate-400 mb-6 text-sm">
            {t('login.twoFactor.subtitle')}
          </p>

          <form onSubmit={handleVerify2FA} className="space-y-4">
            <div>
              <label htmlFor="totp-code" className="sr-only">Code TOTP</label>
              <input
                id="totp-code"
                ref={totpInputRef}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/[^0-9]/g, ''))}
                className="w-full px-4 py-3 text-center text-2xl font-mono tracking-[0.5em] border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="000000"
                aria-label="Code de vérification à 6 chiffres"
                autoFocus
              />
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || totpCode.length < 6}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              {loading ? t('login.twoFactor.verifying') : t('login.twoFactor.verify')}
            </button>

            <button
              type="button"
              onClick={() => { setNeeds2FA(false); setTotpCode(''); setTempToken(''); setError(''); }}
              className="w-full text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300 transition"
            >
              {t('login.twoFactor.backToLogin')}
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-md w-full p-8">
        <div className="flex justify-center mb-6">
          <Logo size="lg" />
        </div>

        <h1 className="text-2xl font-bold text-center text-gray-800 dark:text-white mb-2">
          ORIS
        </h1>
        <p className="text-center text-gray-600 dark:text-slate-400 mb-6">
          {t('login.subtitle')}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              {t('login.email')}
            </label>
            <input
              id="login-email"
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoComplete="email"
            />
          </div>

          <div>
            <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              {t('login.password')}
            </label>
            <input
              id="login-password"
              type="password"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <LogIn className="w-4 h-4" />
            {loading ? t('login.signingIn') : t('login.signIn')}
          </button>
        </form>
      </div>
    </main>
  );
}
