import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { X, Lock } from 'lucide-react';
import { RichTextEditor } from './RichTextEditor';

interface CloseCaseProps {
  caseId: string;
  initialSummary?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function CloseCase({ caseId, initialSummary = '', onClose, onSuccess }: CloseCaseProps) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [summary, setSummary] = useState(initialSummary);
  const [error, setError] = useState('');
  const [closing, setClosing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !summary.trim()) return;

    setError('');
    setClosing(true);

    try {
      await api.put(`/cases/${caseId}`, {
        status: 'closed',
        closure_summary: summary.trim(),
        closed_at: new Date().toISOString(),
        closed_by: user.id,
      });

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('closeCase.error'));
    } finally {
      setClosing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-transparent dark:border-slate-700 rounded-lg max-w-2xl w-full p-4 sm:p-6 my-8 max-h-[calc(100vh-4rem)] overflow-y-auto shadow dark:shadow-slate-800/50">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <Lock className="w-6 h-6 text-red-600" />
            <h3 className="text-xl font-bold text-gray-800 dark:text-white">{t('closeCase.title')}</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
          <p
            className="text-sm text-yellow-800 dark:text-yellow-300"
            dangerouslySetInnerHTML={{ __html: t('closeCase.warning') }}
          />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              {t('closeCase.summary')}
            </label>
            <RichTextEditor
              value={summary}
              onChange={setSummary}
              placeholder={t('closeCase.summaryPlaceholder')}
            />
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
              {t('closeCase.summaryHint')}
            </p>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition dark:text-slate-300"
            >
              {t('closeCase.cancel')}
            </button>
            <button
              type="submit"
              disabled={closing || !summary.trim()}
              className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" />
              {closing ? t('closeCase.closing') : t('closeCase.close')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
