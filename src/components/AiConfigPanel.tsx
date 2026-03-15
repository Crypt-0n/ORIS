import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Bot, Check, AlertTriangle, Loader2, Eye, EyeOff } from 'lucide-react';

interface AiProvider {
  id: string;
  label: string;
  defaultUrl: string;
  defaultModel: string;
  format: string;
  models: string[];
}

interface AiConfig {
  ai_enabled: string;
  ai_provider: string;
  ai_api_url: string;
  ai_api_key: string;
  ai_model: string;
  ai_temperature: string;
  ai_max_tokens: string;
  ai_system_prompt: string;
}

export function AiConfigPanel() {
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [config, setConfig] = useState<AiConfig>({
    ai_enabled: 'false',
    ai_provider: '',
    ai_api_url: '',
    ai_api_key: '',
    ai_model: '',
    ai_temperature: '0.3',
    ai_max_tokens: '2048',
    ai_system_prompt: '',
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [provData, cfgData] = await Promise.all([
          api.get('/ai/providers'),
          api.get('/ai/config'),
        ]);
        setProviders(provData);
        setConfig((prev) => ({ ...prev, ...cfgData }));
      } catch { /* config not set yet */ }
    })();
  }, []);

  const selectedProvider = providers.find((p) => p.id === config.ai_provider);

  const handleProviderChange = (providerId: string) => {
    const prov = providers.find((p) => p.id === providerId);
    if (prov) {
      setConfig((prev) => ({
        ...prev,
        ai_provider: providerId,
        ai_api_url: prev.ai_api_url && prev.ai_provider !== providerId ? prev.ai_api_url : prov.defaultUrl,
        ai_model: prev.ai_model && prev.ai_provider !== providerId ? prev.ai_model : prov.defaultModel,
      }));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await api.put('/ai/config', config);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch { /* error */ }
    setSaving(false);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.post('/ai/test', {});
      setTestResult({ ok: true, msg: res.response?.slice(0, 100) || 'Connexion réussie' });
    } catch (err: any) {
      setTestResult({ ok: false, msg: err?.message || 'Échec de la connexion' });
    }
    setTesting(false);
  };

  const isEnabled = config.ai_enabled === 'true';

  return (
    <div className="space-y-6">
      {/* Header with Enable/Disable */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bot className="w-6 h-6 text-purple-500" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Intelligence Artificielle</h3>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Configure un provider IA pour assister les analystes
            </p>
          </div>
        </div>
        <button
          onClick={async () => {
            const newVal = isEnabled ? 'false' : 'true';
            setConfig((prev) => ({ ...prev, ai_enabled: newVal }));
            try { await api.put('/ai/config', { ai_enabled: newVal }); } catch { /* ignore */ }
          }}
          className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors duration-200 focus:outline-none ${
            isEnabled ? 'bg-purple-600' : 'bg-gray-300 dark:bg-slate-600'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${
              isEnabled ? 'translate-x-8' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {!isEnabled && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <p className="text-sm text-gray-600 dark:text-slate-400">
            L'IA est désactivée. Activez-la pour permettre aux analystes d'utiliser l'assistant IA dans les dossiers.
          </p>
        </div>
      )}

      {/* Provider Selection */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
            Provider
          </label>
          <select
            value={config.ai_provider}
            onChange={(e) => handleProviderChange(e.target.value)}
            className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="">-- Sélectionner --</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
            Modèle
          </label>
          {selectedProvider && selectedProvider.models.length > 0 ? (
            <select
              value={config.ai_model}
              onChange={(e) => setConfig((prev) => ({ ...prev, ai_model: e.target.value }))}
              className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              {selectedProvider.models.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
              {config.ai_model && !selectedProvider.models.includes(config.ai_model) && (
                <option value={config.ai_model}>{config.ai_model} (custom)</option>
              )}
            </select>
          ) : (
            <input
              type="text"
              value={config.ai_model}
              onChange={(e) => setConfig((prev) => ({ ...prev, ai_model: e.target.value }))}
              placeholder="ex: gpt-4o"
              className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          )}
        </div>
      </div>

      {/* URL */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
          URL de l'API
        </label>
        <input
          type="text"
          value={config.ai_api_url}
          onChange={(e) => setConfig((prev) => ({ ...prev, ai_api_url: e.target.value }))}
          placeholder={selectedProvider?.defaultUrl || 'https://api.openai.com/v1'}
          className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white font-mono focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        />
      </div>

      {/* API Key */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
          Clé API
        </label>
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={config.ai_api_key}
            onChange={(e) => setConfig((prev) => ({ ...prev, ai_api_key: e.target.value }))}
            placeholder="sk-..."
            className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 pr-10 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white font-mono focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
          >
            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {config.ai_provider === 'ollama' && (
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
            Ollama ne nécessite pas de clé API (sauf si un reverse-proxy l'exige).
          </p>
        )}
      </div>

      {/* Temperature + Max Tokens */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
            Température <span className="text-gray-400 font-normal">({config.ai_temperature})</span>
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={config.ai_temperature}
            onChange={(e) => setConfig((prev) => ({ ...prev, ai_temperature: e.target.value }))}
            className="w-full accent-purple-500"
          />
          <div className="flex justify-between text-xs text-gray-400">
            <span>Précis</span>
            <span>Créatif</span>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
            Max tokens
          </label>
          <input
            type="number"
            value={config.ai_max_tokens}
            onChange={(e) => setConfig((prev) => ({ ...prev, ai_max_tokens: e.target.value }))}
            min="256"
            max="16384"
            step="256"
            className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* System Prompt */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
          Prompt système <span className="text-gray-400 font-normal">(optionnel)</span>
        </label>
        <textarea
          value={config.ai_system_prompt}
          onChange={(e) => setConfig((prev) => ({ ...prev, ai_system_prompt: e.target.value }))}
          rows={4}
          placeholder="Tu es un analyste CTI senior..."
          className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2 border-t border-gray-200 dark:border-slate-700">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : null}
          {saved ? 'Enregistré !' : 'Enregistrer'}
        </button>
        <button
          onClick={handleTest}
          disabled={testing || !config.ai_provider}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-50 transition"
        >
          {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
          Tester la connexion
        </button>

        {testResult && (
          <span className={`text-sm ${testResult.ok ? 'text-emerald-600' : 'text-red-500'}`}>
            {testResult.ok ? '✓' : '✗'} {testResult.msg}
          </span>
        )}
      </div>
    </div>
  );
}
