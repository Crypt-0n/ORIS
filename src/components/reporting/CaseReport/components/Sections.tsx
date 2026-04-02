import { sanitizeHtml } from '../../../../lib/sanitize';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import {
  Monitor, Server, Smartphone, Tablet, Tv, Router, Cpu, HelpCircle,
  ShieldCheck, ShieldAlert, ShieldX, ShieldQuestion, AlertTriangle, KeyRound,
  Bug, Network, PackageOpen, Clock
} from 'lucide-react';
import { SectionHeader, formatDateTime, formatDateTimeShort } from './SharedUI';
import {
  ReportSystem,
  ReportCompromisedAccount,
  ReportNetworkIndicator,
  ReportMalware,
  ReportExfiltration,
  AuditLog
} from '../types';

const SYSTEM_TYPE_ICONS: Record<string, typeof Monitor> = {
  ordinateur: Monitor,
  serveur: Server,
  telephone: Smartphone,
  tablette: Tablet,
  tv: Tv,
  equipement_reseau: Router,
  equipement_iot: Cpu,
  autre: HelpCircle,
};

const INVESTIGATION_STATUS_REPORT: Record<string, { label: string; icon: typeof ShieldCheck; bg: string; text: string; border: string }> = {
  clean: { label: 'Sain', icon: ShieldCheck, bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  compromised: { label: 'Compromis / Accede', icon: ShieldAlert, bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  infected: { label: 'Infecte', icon: ShieldX, bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  unknown: { label: 'Inconnu', icon: ShieldQuestion, bg: 'bg-gray-50', text: 'text-gray-500', border: 'border-gray-200' },
};

export function SystemsSection({ systems, title }: { systems: (ReportSystem & { computedStatus?: string })[]; title: string }) {
  const { t } = useTranslation();
  const filtered = systems.filter(s => s.computedStatus === 'compromised' || s.computedStatus === 'infected');
  if (filtered.length === 0) return null;
  const SectionIcon = ShieldAlert;
  
  return (
    <div className="px-8 py-6 border-t border-gray-100">
      <SectionHeader icon={SectionIcon} title={title} />
      <div className="mt-4 space-y-2">
        {filtered.map(sys => {
          const TypeIcon = SYSTEM_TYPE_ICONS[sys.system_type] || HelpCircle;
          const statusCfg = INVESTIGATION_STATUS_REPORT[sys.computedStatus || 'unknown'] || INVESTIGATION_STATUS_REPORT.unknown;
          const StatusIcon = statusCfg?.icon;
          return (
            <div key={sys.id} className={`flex items-start gap-3 rounded-lg border p-3 ${statusCfg ? `${statusCfg.bg} ${statusCfg.border}` : 'bg-slate-50 border-slate-200'}`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${statusCfg?.bg || 'bg-gray-100'}`}>
                <TypeIcon className={`w-4 h-4 ${statusCfg?.text || 'text-gray-500'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-gray-800">{sys.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 border border-gray-200">
                    {t(`report.system_types.${sys.system_type}`, { defaultValue: sys.system_type })}
                  </span>
                  {statusCfg && StatusIcon && (
                    <span className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border font-medium ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}>
                      <StatusIcon className="w-2.5 h-2.5" /> {statusCfg.label}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                  {sys.owner && <span className="text-xs text-gray-500">{t('auto.proprietaire_38')}{sys.owner}</span>}
                  {Array.isArray(sys.ip_addresses) && sys.ip_addresses.length > 0 && (
                    <span className="text-xs text-gray-500 font-mono">
                      {sys.ip_addresses.map((ip: { ip: string }) => ip.ip).filter(Boolean).join(', ')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AttackerInfraSection({ items }: { items: any[] }) {
  const { t } = useTranslation();
  if (items.length === 0) return null;

  const INFRA_TYPE_LABELS: Record<string, string> = {
    c2_server: 'Serveur C2', vpn: 'VPN', relay: 'Relais / Proxy',
    phishing_server: 'Serveur de phishing', exfil_server: "Serveur d'exfiltration",
    hosting: 'Hébergement', domain_registrar: 'Registrar / DNS', autre: 'Autre',
  };

  return (
    <div className="px-8 py-6 border-t border-gray-100">
      <SectionHeader icon={AlertTriangle} title={t('auto.systemes_utilises_par_l_attaqu')} />
      <div className="mt-4 space-y-2">
        {items.map((item: any) => {
          const ips = typeof item.ip_addresses === 'string' ? JSON.parse(item.ip_addresses) : (item.ip_addresses || []);
          const validIps = ips.filter((ip: any) => ip.ip?.trim());
          return (
            <div key={item.id} className="flex items-start gap-3 rounded-lg border p-3 bg-slate-50 border-slate-200">
              <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-4 h-4 text-slate-700" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-gray-800">{item.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-200">
                    {INFRA_TYPE_LABELS[item.infra_type] || item.infra_type}
                  </span>
                </div>
                {item.description && (
                  <p className="text-xs text-gray-600 mt-1">{item.description}</p>
                )}
                {validIps.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {validIps.map((ip: any, i: number) => (
                      <span key={i} className="text-[11px] font-mono bg-gray-100 text-gray-700 px-2 py-0.5 rounded border border-gray-200">
                        {ip.ip}{ip.mask ? ip.mask : ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CompromisedAccountsSection({ accounts }: { accounts: ReportCompromisedAccount[] }) {
  const { t, i18n } = useTranslation();
  if (accounts.length === 0) return null;
  return (
    <div className="px-8 py-6 border-t border-gray-100">
      <SectionHeader icon={KeyRound} title={t('auto.comptes_compromis')} />
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-3 py-2 font-semibold text-gray-600">{t('auto.compte_39')}</th>
              <th className="text-left px-3 py-2 font-semibold text-gray-600">{t('auto.privileges')}</th>
              <th className="text-left px-3 py-2 font-semibold text-gray-600">{t('auto.premiere_activite')}</th>
              <th className="text-left px-3 py-2 font-semibold text-gray-600">{t('auto.derniere_activite')}</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a, i) => (
              <tr key={a.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-3 py-2 font-mono font-medium text-gray-800">
                  {a.domain ? `${a.domain}\\${a.account_name}` : a.account_name}
                  {a.sid && <span className="block text-[10px] text-gray-500 font-normal">{a.sid}</span>}
                </td>
                <td className="px-3 py-2 text-gray-700">{t(`report.privileges.${a.privileges}`, { defaultValue: a.privileges })}</td>
                <td className="px-3 py-2 text-gray-600">{a.first_malicious_activity ? formatDateTime(a.first_malicious_activity, i18n.language) : <span className="text-gray-500 italic">N/A</span>}</td>
                <td className="px-3 py-2 text-gray-600">{a.last_malicious_activity ? formatDateTime(a.last_malicious_activity, i18n.language) : <span className="text-gray-500 italic">N/A</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function MalwareSection({ items }: { items: ReportMalware[] }) {
  const { t, i18n } = useTranslation();
  if (items.length === 0) return null;
  return (
    <div className="px-8 py-6 border-t border-gray-100">
      <SectionHeader icon={Bug} title={t('auto.malwares_et_outils')} />
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-3 py-2 font-semibold text-gray-600">{t('auto.fichier')}</th>
              <th className="text-left px-3 py-2 font-semibold text-gray-600">{t('auto.statut')}</th>
              <th className="text-left px-3 py-2 font-semibold text-gray-600">{t('auto.systeme_40')}</th>
              <th className="text-left px-3 py-2 font-semibold text-gray-600">{t('auto.date_creation')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((m, i) => (
              <tr key={m.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-3 py-2">
                  <span className="font-mono font-medium text-gray-800">{m.file_name}</span>
                  {m.file_path && <span className="block text-[10px] text-gray-500">{m.file_path}</span>}
                </td>
                <td className="px-3 py-2">
                  {m.is_malicious === true ? (
                    <span className="flex items-center gap-1 text-red-600 font-medium"><AlertTriangle className="w-3 h-3" /> {t('auto.malveillant')}</span>
                  ) : m.is_malicious === false ? (
                    <span className="text-gray-500">{t('auto.outil_legitime')}</span>
                  ) : (
                    <span className="flex items-center gap-1 text-amber-600 font-medium"><HelpCircle className="w-3 h-3" /> {t('auto.inconnu', 'Inconnu')}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-gray-600">{m.system_name || <span className="text-gray-500 italic">N/A</span>}</td>
                <td className="px-3 py-2 text-gray-600">{m.creation_date ? formatDateTime(m.creation_date, i18n.language) : <span className="text-gray-500 italic">N/A</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function NetworkIndicatorsSection({ indicators }: { indicators: ReportNetworkIndicator[] }) {
  const { t, i18n } = useTranslation();
  if (indicators.length === 0) return null;
  return (
    <div className="px-8 py-6 border-t border-gray-100">
      <SectionHeader icon={Network} title={t('auto.indicateurs_reseau')} />
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-3 py-2 font-semibold text-gray-600">{t('auto.indicateur_41')}</th>
              <th className="text-left px-3 py-2 font-semibold text-gray-600">{t('auto.port')}</th>
              <th className="text-left px-3 py-2 font-semibold text-gray-600">{t('auto.malware_associe')}</th>
              <th className="text-left px-3 py-2 font-semibold text-gray-600">{t('auto.premiere_activite')}</th>
              <th className="text-left px-3 py-2 font-semibold text-gray-600">{t('auto.derniere_activite')}</th>
            </tr>
          </thead>
          <tbody>
            {indicators.map((ind, i) => (
              <tr key={ind.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-3 py-2 font-mono text-gray-800">
                  {ind.ip && <span className="block">{ind.ip}</span>}
                  {ind.domain_name && <span className="block">{ind.domain_name}</span>}
                  {ind.url && <span className="block text-[10px] break-all">{ind.url}</span>}
                </td>
                <td className="px-3 py-2 text-gray-600">{ind.port ?? <span className="text-gray-500 italic">N/A</span>}</td>
                <td className="px-3 py-2 text-gray-600">{ind.malware_file_name || <span className="text-gray-500 italic">N/A</span>}</td>
                <td className="px-3 py-2 text-gray-600">{ind.first_activity ? formatDateTime(ind.first_activity, i18n.language) : <span className="text-gray-500 italic">N/A</span>}</td>
                <td className="px-3 py-2 text-gray-600">{ind.last_activity ? formatDateTime(ind.last_activity, i18n.language) : <span className="text-gray-500 italic">N/A</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ExfiltrationsSection({ exfiltrations }: { exfiltrations: ReportExfiltration[] }) {
  const { t, i18n } = useTranslation();
  if (exfiltrations.length === 0) return null;
  return (
    <div className="px-8 py-6 border-t border-gray-100">
      <SectionHeader icon={PackageOpen} title={t('auto.exfiltrations')} />
      <div className="mt-4 space-y-2">
        {exfiltrations.map((e) => (
          <div key={e.id} className="rounded-lg border border-orange-200 bg-orange-50 p-3">
            <div className="flex flex-wrap items-start gap-x-6 gap-y-1">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-orange-500 flex-shrink-0" />
                <span className="text-xs font-semibold text-gray-800">
                  {e.exfiltration_date ? formatDateTime(e.exfiltration_date, i18n.language) : <span className="italic text-gray-500">{t('auto.date_inconnue')}</span>}
                </span>
              </div>
              {e.file_name && (
                <span className="text-xs font-mono text-gray-700">
                  {e.file_name} {e.file_size != null && <span className="text-gray-500 ml-1">({e.file_size} {e.file_size_unit || ''})</span>}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-0.5 mt-1.5 text-xs text-gray-600">
              {e.source_system_name && <span>{t('auto.source')}<span className="font-medium">{e.source_system_name}</span></span>}
              {e.exfil_system_name && <span>{t('auto.via')}<span className="font-medium">{e.exfil_system_name}</span></span>}
              {e.destination_system_name && <span>{t('auto.destination_42')}<span className="font-medium">{e.destination_system_name}</span></span>}
            </div>
            {e.content_description && (
              <div className="mt-2 text-xs text-gray-600 rich-text-content" dangerouslySetInnerHTML={{ __html: sanitizeHtml(e.content_description) }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ActivityHistorySection({ logs }: { logs: AuditLog[] }) {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  if (logs.length === 0) return null;

  const handleEntryClick = (log: AuditLog) => {
    const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
    const taskId = log.entity_type === 'task' ? log.entity_id : details?.task_id;

    if (taskId) {
      const params = new URLSearchParams(searchParams);
      params.set('section', 'tasks');
      params.set('task', taskId);

      if (log.action.includes('highlight')) {
        params.set('tab', 'events');
        if (details.event_id) params.set('target', details.event_id);
      } else if (log.action.includes('comment')) {
        params.set('tab', 'comments');
        if (details.comment_id) params.set('target', details.comment_id);
      } else if (log.action.includes('file')) {
        params.set('tab', 'files');
      }

      setSearchParams(params);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="px-8 py-6 border-t border-gray-100">
      <SectionHeader icon={Clock} title={t('report.history')} />
      <div className="mt-4 space-y-2">
        {logs.map((log) => {
          const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
          const taskId = log.entity_type === 'task' ? log.entity_id : details?.task_id;
          const isClickable = !!taskId;

          return (
            <div
              key={log.id}
              onClick={() => isClickable && handleEntryClick(log)}
              className={`flex items-start gap-3 text-xs py-2 border-b border-gray-50 last:border-0 ${isClickable ? 'cursor-pointer hover:bg-gray-50 p-1 -mx-1 rounded transition-colors' : ''}`}
            >
              <span className="text-gray-500 font-mono whitespace-nowrap">{formatDateTimeShort(log.created_at, i18n.language)}</span>
              <span className="text-gray-700">
                {String(t(details.changes ? `audit.actions.${log.action}_with_changes` : `audit.actions.${log.action}`, {
                  user: details.user_full_name || details.performed_by_name || 'System',
                  ...details,
                  changes: details.changes ? details.changes.split(', ').map((c: string) => t(`audit.fields.${c.trim()}`)).join(', ') : ''
                }))}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
