import React from 'react';

import { Server, Globe, User, Target, MapPin, Bug, Fingerprint, AlertTriangle, Pencil } from 'lucide-react';

interface TaskLinkedStixObjectProps {
  linkedStixObject: any;
  caseStixObjects: any[];
  setEditingStixObject: (val: boolean) => void;
}

export function TaskLinkedStixObject({
  linkedStixObject, caseStixObjects, setEditingStixObject
}: TaskLinkedStixObjectProps) {
  if (!linkedStixObject) return null;

  return (
    <div className="bg-gradient-to-r from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-900/10 rounded-lg shadow dark:shadow-slate-800/50 border border-blue-100 dark:border-blue-800/50 p-6 overflow-hidden relative">
      
      {/* Background Icon */}
      <div className="absolute -right-4 -bottom-4 opacity-[0.03] dark:opacity-[0.05] pointer-events-none">
        {(linkedStixObject.type === 'infrastructure' || linkedStixObject.type === 'malware') ? <Server className="w-48 h-48" /> : 
         (linkedStixObject.type === 'ipv4-addr' || linkedStixObject.type === 'domain-name') ? <Globe className="w-48 h-48" /> : 
         linkedStixObject.type === 'user-account' ? <User className="w-48 h-48" /> : <Target className="w-48 h-48" />}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 relative z-10">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
            {linkedStixObject.type === 'infrastructure' ? <Server className="w-6 h-6 text-blue-600 dark:text-blue-400" /> :
             linkedStixObject.type === 'malware' ? <Bug className="w-6 h-6 text-red-600 dark:text-red-400" /> :
             linkedStixObject.type === 'user-account' ? <User className="w-6 h-6 text-emerald-600 dark:text-emerald-400" /> :
             linkedStixObject.type === 'ipv4-addr' ? <MapPin className="w-6 h-6 text-sky-600 dark:text-sky-400" /> :
             linkedStixObject.type === 'domain-name' ? <Globe className="w-6 h-6 text-violet-600 dark:text-violet-400" /> :
             <Target className="w-6 h-6 text-slate-600 dark:text-slate-400" />}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
                Objet Technique STIX ({linkedStixObject.type})
              </span>
              {(linkedStixObject.labels || []).map((label: string, idx: number) => (
                <span key={idx} className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  label.toLowerCase().includes('clean') || label.toLowerCase().includes('sain') ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                  label.toLowerCase().includes('malicious') || label.toLowerCase().includes('malveillant') ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                }`}>
                  {label}
                </span>
              ))}
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white break-all">
              {linkedStixObject.name || linkedStixObject.value || linkedStixObject.user_id || linkedStixObject.id}
            </h3>
            {linkedStixObject.description && (
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 max-w-2xl">
                {linkedStixObject.description}
              </p>
            )}
            
            {/* Indicators like Hash, User */}
            <div className="flex flex-wrap gap-4 mt-4">
              {linkedStixObject.hashes && Object.entries(linkedStixObject.hashes).map(([hashType, hashVal]) => (
                <div key={hashType} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 bg-white/50 dark:bg-slate-800/50 px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700">
                  <Fingerprint className="w-3.5 h-3.5" />
                  <span className="font-semibold">{hashType}:</span>
                  <span className="font-mono tracking-tight">{String(hashVal)}</span>
                </div>
              ))}
              {linkedStixObject.account_login && (
                <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 bg-white/50 dark:bg-slate-800/50 px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700">
                  <User className="w-3.5 h-3.5" />
                  <span className="font-semibold">Login:</span>
                  <span>{linkedStixObject.account_login}</span>
                </div>
              )}
            </div>
            
            {(() => {
               // Use STIX relationships pointing from/to the linkedStixObject to find sub-enrichments
               const relationships = caseStixObjects.filter(o => o.type === 'relationship' && (o.source_ref === linkedStixObject.id || o.target_ref === linkedStixObject.id));
               const relatedIds = new Set(relationships.map(r => r.source_ref === linkedStixObject.id ? r.target_ref : r.source_ref));
               const enrichments = caseStixObjects.filter(o => relatedIds.has(o.id) && !['observed-data', 'relationship', 'report', 'note', 'grouping'].includes(o.type));
               
               // Filter out 'indicator' if an SCO (like ipv4) with the exact same value already exists in the same task
               const displayEnrichments = enrichments.filter(e => {
                  if (e.type === 'indicator') {
                     return !enrichments.some(other => other.id !== e.id && (other.value === e.name || other.name === e.name));
                  }
                  return true;
               });
               
               if (displayEnrichments.length === 0) return null;
               
               return (
                   <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-blue-200/50 dark:border-blue-800/30">
                      {displayEnrichments.map(enr => {
                         let ValIcon = Target;
                         const t = enr.type;
                         if (t === 'ipv4-addr') ValIcon = Globe;
                         if (t === 'domain-name') ValIcon = Globe;
                         if (t === 'url') ValIcon = Globe;
                         if (t === 'indicator') ValIcon = AlertTriangle;
                         
                         return (
                           <div key={enr.id} className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 shadow-sm px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700">
                              <ValIcon className={`w-3.5 h-3.5 ${
                                t === 'ipv4-addr' ? 'text-blue-500' :
                                t === 'domain-name' ? 'text-indigo-500' :
                                t === 'url' ? 'text-violet-500' :
                                t === 'indicator' ? 'text-orange-500' : 'text-slate-400'
                              }`} />
                              <span className="uppercase text-[9px] opacity-60 tracking-wider font-bold">
                                {t === 'ipv4-addr' ? 'IP' : t === 'domain-name' ? 'DOM' : t}
                              </span>
                              <span className="font-mono">{enr.name || enr.value || enr.id}</span>
                           </div>
                         );
                      })}
                   </div>
               );
            })()}
          </div>
        </div>
        
        <div className="flex-shrink-0">
          <button
            onClick={() => setEditingStixObject(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 dark:text-blue-300 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 rounded-lg transition"
          >
            <Pencil className="w-4 h-4" />
            Modifier l'élément
          </button>
        </div>
      </div>
    </div>
  );
}
