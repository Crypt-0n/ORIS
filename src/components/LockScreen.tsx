import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Lock, LogOut, Eye, EyeOff, AlertCircle, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { UserAvatar } from './UserAvatar';
import { useTranslation } from 'react-i18next';

export function LockScreen() {
  const { t } = useTranslation();
  const { profile, unlockSession, signOut } = useAuth();
  const hasPin = profile?.has_pin ?? false;

  const [pin, setPin] = useState<string[]>(Array(6).fill(''));
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  const pinRefs = useRef<(HTMLInputElement | null)[]>([]);
  const passwordRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (hasPin) {
      pinRefs.current[0]?.focus();
    } else {
      passwordRef.current?.focus();
    }
  }, [hasPin]);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 600);
  };

  const handleUnlock = async (value: string) => {
    setLoading(true);
    setError('');
    try {
      await unlockSession(value);
    } catch (err: any) {
      setError(hasPin ? t('lockScreen.invalidPin') : t('lockScreen.invalidPassword'));
      triggerShake();
      if (hasPin) {
        setPin(Array(6).fill(''));
        setTimeout(() => pinRefs.current[0]?.focus(), 100);
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePinChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newPin = [...pin];
    newPin[index] = value.slice(-1);
    setPin(newPin);
    setError('');

    if (value && index < 5) {
      pinRefs.current[index + 1]?.focus();
    }

    // Auto-submit when 4+ digits entered and a new digit was just typed
    if (value) {
      const filled = newPin.filter(d => d !== '').length;
      if (filled >= 4) {
        const combined = newPin.join('');
        // Small delay to let the UI update
        setTimeout(() => handleUnlock(combined), 150);
      }
    }
  };

  const handlePinKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      const newPin = [...pin];
      newPin[index - 1] = '';
      setPin(newPin);
      pinRefs.current[index - 1]?.focus();
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    handleUnlock(password);
  };

  const handleSignOut = () => {
    signOut();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
      <div className="absolute inset-0 backdrop-blur-sm" />

      {/* Animated background shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* Lock card */}
      <div
        className={`relative w-full max-w-sm mx-4 transition-transform ${shake ? 'animate-[shake_0.6s_ease-in-out]' : ''}`}
      >
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8 shadow-2xl">
          {/* User avatar */}
          <div className="flex flex-col items-center mb-8">
            <div className="mb-4 ring-4 ring-blue-500/30 rounded-full shadow-lg shadow-blue-500/20">
              <UserAvatar name={profile?.full_name} avatarUrl={profile?.avatar_url} size="xl" />
            </div>
            <h2 className="text-xl font-bold text-white">
              {profile?.full_name || '—'}
            </h2>
            <p className="text-sm text-white/60 mt-1">{t('lockScreen.sessionLocked')}</p>
          </div>

          {/* Lock icon with badge */}
          <div className="flex justify-center mb-6">
            <div className="p-3 rounded-full bg-amber-500/20 border border-amber-500/30">
              <Lock className="w-6 h-6 text-amber-400" />
            </div>
          </div>

          {hasPin ? (
            /* PIN mode */
            <form onSubmit={e => e.preventDefault()}>
              <p className="text-center text-sm text-white/70 mb-4">{t('lockScreen.enterPin')}</p>
              <div className="flex justify-center gap-2.5 mb-6">
                {pin.map((digit, i) => (
                  <input
                    key={i}
                    ref={el => { pinRefs.current[i] = el; }}
                    type="password"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handlePinChange(i, e.target.value)}
                    onKeyDown={e => handlePinKeyDown(i, e)}
                    disabled={loading}
                    autoComplete="one-time-code"
                    className={`w-11 h-13 text-center text-xl font-bold rounded-xl border-2 transition-all duration-200 outline-none
                      ${digit ? 'border-blue-500 bg-blue-500/20 text-white' : 'border-white/20 bg-white/5 text-white'}
                      focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30 focus:bg-white/10
                      disabled:opacity-50 disabled:cursor-not-allowed`}
                    style={{ caretColor: 'transparent' }}
                  />
                ))}
              </div>
            </form>
          ) : (
            /* Password mode */
            <form onSubmit={handlePasswordSubmit}>
              <p className="text-center text-sm text-white/70 mb-4">{t('lockScreen.enterPassword')}</p>
              <div className="relative mb-6">
                <input
                  ref={passwordRef}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  disabled={loading}
                  placeholder={t('lockScreen.passwordPlaceholder')}
                  className="w-full px-4 py-3 pr-12 rounded-xl border-2 border-white/20 bg-white/5 text-white placeholder-white/30 outline-none transition-all duration-200
                    focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30 focus:bg-white/10
                    disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <button
                type="submit"
                disabled={loading || !password.trim()}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                {loading ? t('lockScreen.unlocking') : t('lockScreen.unlock')}
              </button>
            </form>
          )}

          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 mt-4 p-3 rounded-lg bg-red-500/20 border border-red-500/30">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {/* Sign out */}
          <div className="mt-6 pt-6 border-t border-white/10 text-center">
            <button
              onClick={handleSignOut}
              disabled={loading}
              className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white/80 transition-colors disabled:opacity-50"
            >
              <LogOut className="w-4 h-4" />
              {t('lockScreen.signOut')}
            </button>
          </div>
        </div>
      </div>

      {/* Shake animation keyframes */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-6px); }
          20%, 40%, 60%, 80% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}
