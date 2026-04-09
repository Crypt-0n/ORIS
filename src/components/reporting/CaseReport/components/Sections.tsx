import {
  AlertTriangle, Bug, Shield, User, Globe, File as FileIcon, Server
} from 'lucide-react';
import { SectionHeader } from './SharedUI';



const TYPE_CONFIG: Record<string, { label: string; icon: any; color: string; bgColor: string; borderColor: string }> = {
  'infrastructure': { label: 'Système', icon: Server, color: 'text-teal-600 dark:text-teal-400', bgColor: 'bg-teal-50 dark:bg-teal-900/20', borderColor: 'border-teal-200 dark:border-teal-800' },
  'malware': { label: 'Malware', icon: Bug, color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-50 dark:bg-red-900/20', borderColor: 'border-red-200 dark:border-red-800' },
  'user-account': { label: 'Compte', icon: User, color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-50 dark:bg-amber-900/20', borderColor: 'border-amber-200 dark:border-amber-800' },
  'indicator': { label: 'Indicateur', icon: AlertTriangle, color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-50 dark:bg-orange-900/20', borderColor: 'border-orange-200 dark:border-orange-800' },
  'ipv4-addr': { label: 'IPv4', icon: Globe, color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-900/20', borderColor: 'border-blue-200 dark:border-blue-800' },
  'domain-name': { label: 'Domaine', icon: Globe, color: 'text-indigo-600 dark:text-indigo-400', bgColor: 'bg-indigo-50 dark:bg-indigo-900/20', borderColor: 'border-indigo-200 dark:border-indigo-800' },
  'url': { label: 'URL', icon: Globe, color: 'text-violet-600 dark:text-violet-400', bgColor: 'bg-violet-50 dark:bg-violet-900/20', borderColor: 'border-violet-200 dark:border-violet-800' },
  'file': { label: 'Fichier', icon: FileIcon, color: 'text-gray-600 dark:text-gray-500', bgColor: 'bg-gray-50 dark:bg-gray-900/20', borderColor: 'border-gray-200 dark:border-gray-800' },
};

const DISPLAY_TYPES = ['infrastructure', 'malware', 'user-account', 'indicator', 'ipv4-addr', 'domain-name', 'url', 'file'];

function getObjectLabel(obj: any): string {
  return obj.name || obj.value || obj.display_name || obj.user_id || obj.id;
}

export function StixElementsGroupedSection({ elementsMap, title }: { elementsMap: Record<string, any[]>; title: string }) {
  if (Object.keys(elementsMap).length === 0) return null;

  return (
    <div className="px-8 py-6 border-t border-gray-100">
      <SectionHeader icon={Shield} title={title} />
      <div className="mt-6 space-y-6">
        {DISPLAY_TYPES.filter(type => elementsMap[type] && elementsMap[type].length > 0).map(type => {
          const config = TYPE_CONFIG[type] || TYPE_CONFIG['file'];
          const Icon = config.icon;
          const items = elementsMap[type];
          return (
            <div key={type}>
              <h3 className={`text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-1.5 ${config.color}`}>
                <Icon className="w-4 h-4" />
                {config.label} ({items.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {items.map(obj => (
                  <div key={obj.id} className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border bg-white ${config.borderColor}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {getObjectLabel(obj)}
                      </p>
                      {obj.description && (
                         <p className="text-xs text-gray-500 line-clamp-2 mt-0.5" title={obj.description}>
                           {obj.description}
                         </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

