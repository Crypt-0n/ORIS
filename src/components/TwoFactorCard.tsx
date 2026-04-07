import { useState } from 'react';
import { ShieldCheck, ShieldOff, Loader2, Copy, Check } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

export function TwoFactorCard() {
  const { profile, refreshProfile } = useAuth();
  const isEnabled = !!profile?.totp_enabled;

  const [step, setStep] = useState<'idle' | 'setup' | 'disable'>('idle');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSetup = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.post('/auth/2fa/setup', {});
      setQrCode(data.qrCode);
      setSecret(data.secret);
      setStep('setup');
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de la configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleEnable = async () => {
    if (code.length < 6) return;
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/2fa/enable', { code });
      await refreshProfile();
      setStep('idle');
      setCode('');
      setQrCode('');
      setSecret('');
    } catch (err: any) {
      setError(err?.message || 'Code invalide');
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    if (code.length < 6) return;
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/2fa/disable', { code });
      await refreshProfile();
      setStep('idle');
      setCode('');
    } catch (err: any) {
      setError(err?.message || 'Code invalide');
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-white mb-3 flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-blue-500" />
        Authentification à deux facteurs (2FA)
      </h3>

      {step === 'idle' && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className={`px-2.5 py-1 rounded-full text-xs font-medium ${
              isEnabled
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400'
            }`}>
              {isEnabled ? '✓ Activé' : 'Désactivé'}
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-4">
            {isEnabled
              ? 'Votre compte est protégé par l\'authentification à deux facteurs.'
              : 'Ajoutez une couche de sécurité supplémentaire avec Google Authenticator ou toute app TOTP.'}
          </p>

          {isEnabled ? (
            <button
              onClick={() => { setStep('disable'); setCode(''); setError(''); }}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition"
            >
              <ShieldOff className="w-4 h-4" />
              Désactiver le 2FA
            </button>
          ) : (
            <button
              onClick={handleSetup}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg transition disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              Configurer le 2FA
            </button>
          )}
        </div>
      )}

      {step === 'setup' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-slate-400">
            1. Scannez ce QR code avec votre application d'authentification
          </p>

          <div className="flex justify-center p-4 bg-white rounded-lg">
            <img src={qrCode} alt="QR Code 2FA" className="w-48 h-48" />
          </div>

          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">
              Ou entrez manuellement cette clé :
            </p>
            <div className="flex items-center justify-center gap-2">
              <code className="text-xs font-mono bg-gray-100 dark:bg-slate-800 px-3 py-1.5 rounded text-gray-700 dark:text-slate-300 select-all">
                {secret}
              </code>
              <button
                onClick={copySecret}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 rounded transition"
                title="Copier"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-gray-500" />}
              </button>
            </div>
          </div>

          <div>
            <p className="text-sm text-gray-600 dark:text-slate-400 mb-2">
              2. Entrez le code à 6 chiffres pour confirmer
            </p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
              className="w-full px-4 py-2.5 text-center text-xl font-mono tracking-[0.4em] border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="000000"
              autoFocus
            />
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-3 py-2 rounded-lg text-xs">
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleEnable}
              disabled={loading || code.length < 6}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              Activer
            </button>
            <button
              onClick={() => { setStep('idle'); setCode(''); setError(''); }}
              className="px-4 py-2 text-sm text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {step === 'disable' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-slate-400">
            Entrez un code de votre application d'authentification pour désactiver le 2FA.
          </p>

          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
            className="w-full px-4 py-2.5 text-center text-xl font-mono tracking-[0.4em] border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            placeholder="000000"
            autoFocus
          />

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-3 py-2 rounded-lg text-xs">
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleDisable}
              disabled={loading || code.length < 6}
              className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldOff className="w-4 h-4" />}
              Désactiver
            </button>
            <button
              onClick={() => { setStep('idle'); setCode(''); setError(''); }}
              className="px-4 py-2 text-sm text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
