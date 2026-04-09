import React from 'react';
import { X, Monitor, Bug, KeyRound, Globe, DatabaseZap, Shield, Skull } from 'lucide-react';

export type LinkedObjectType = 'system' | 'malware' | 'account' | 'network' | 'exfiltration' | 'ttp' | 'attacker_infra';

export interface LinkedObject {
  id: string;
  label: string;
  type: LinkedObjectType;
}

const TYPE_CONFIG: Record<LinkedObjectType, { icon: React.ElementType; bg: string; text: string; border: string }> = {
  system: { icon: Monitor, bg: 'bg-teal-50 dark:bg-teal-900/20', text: 'text-teal-700 dark:text-teal-300', border: 'border-teal-200 dark:border-teal-800' },
  malware: { icon: Bug, bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-300', border: 'border-red-200 dark:border-red-800' },
  account: { icon: KeyRound, bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800' },
  network: { icon: Globe, bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800' },
  exfiltration: { icon: DatabaseZap, bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-200 dark:border-orange-800' },
  ttp: { icon: Shield, bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800' },
  attacker_infra: { icon: Skull, bg: 'bg-rose-50 dark:bg-rose-900/20', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-200 dark:border-rose-800' },
};

interface LinkedObjectTagProps {
  object: LinkedObject;
  onRemove?: (id: string) => void;
  readonly?: boolean;
}

export function LinkedObjectTag({ object, onRemove, readonly }: LinkedObjectTagProps) {
  const cfg = TYPE_CONFIG[object.type];
  const Icon = cfg.icon;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <Icon className="w-3 h-3 flex-shrink-0" />
      <span className="max-w-[120px] truncate">{object.label}</span>
      {!readonly && onRemove && (
        <button
          type="button"
          onClick={() => onRemove(object.id)}
          className="ml-0.5 hover:opacity-70 flex-shrink-0"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  );
}
