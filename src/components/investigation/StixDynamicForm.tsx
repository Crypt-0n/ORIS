import React from 'react';
import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Server, User, Bug, Globe, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { TLP_MARKING_DEFINITIONS, PAP_MARKING_DEFINITIONS, RELATIONSHIP_TYPES } from '../../lib/stix.types';
import { Tooltip } from '../common/Tooltip';
import { OffCanvas } from '../common/OffCanvas';

interface StixDynamicFormProps {
  caseId: string;
  taskId?: string;
  onClose: () => void;
  onCreated: () => void;
  initialData?: any;
}

type StixCategory = 'infrastructure' | 'user-account' | 'malware' | 'ipv4-addr' | 'domain-name' | 'url';

const CATEGORIES: { key: StixCategory; label: string; icon: typeof Server; color: string; desc: string }[] = [
  { key: 'infrastructure', label: 'Système / Infrastructure', icon: Server, color: 'text-teal-600 dark:text-teal-400', desc: 'Serveur, poste de travail ou équipement réseau compromis ou lié à l\'attaque.' },
  { key: 'malware', label: 'Malware / Outil', icon: Bug, color: 'text-red-600 dark:text-red-400', desc: 'Logiciel malveillant, script, ou outil utilisé par l\'attaquant (ex: Mimikatz, CobaltStrike).' },
  { key: 'user-account', label: 'Compte Utilisateur compromis', icon: User, color: 'text-amber-600 dark:text-amber-400', desc: 'Identifiant d\'un utilisateur dont les accès ont été usurpés.' },
  { key: 'ipv4-addr', label: 'Adresse IP', icon: Globe, color: 'text-blue-600 dark:text-blue-400', desc: 'IP malveillante, C2 ou point de rebond.' },
  { key: 'domain-name', label: 'Nom de domaine', icon: Globe, color: 'text-indigo-600 dark:text-indigo-400', desc: 'Domaine utilisé pour l\'attaque, phishing ou C2.' },
  { key: 'url', label: 'URL Compromise', icon: Globe, color: 'text-violet-600 dark:text-violet-400', desc: 'Lien exact vers un fichier malveillant ou page de phishing.' },
];

export function StixDynamicForm({ caseId, taskId, onClose, onCreated, initialData }: StixDynamicFormProps) {
  const { t } = useTranslation();
  const [category, setCategory] = useState<StixCategory | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [infraType, setInfraType] = useState('server');
  const [accountName, setAccountName] = useState('');
  const [domain, setDomain] = useState('');
  const [malwareFamily, setMalwareFamily] = useState('');
  const [sha256, setSha256] = useState('');
  const [md5, setMd5] = useState('');
  const [indicatorValue, setIndicatorValue] = useState(''); // Used for Edit
  
  // Multi-indicator states for Creation
  const [ipv4Val, setIpv4Val] = useState('');
  const [ipv4Rel, setIpv4Rel] = useState('indicates');
  const [domainVal, setDomainVal] = useState('');
  const [domainRel, setDomainRel] = useState('indicates');
  const [urlVal, setUrlVal] = useState('');
  const [urlRel, setUrlRel] = useState('indicates');

  // Enrichment fields
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [labelsStr, setLabelsStr] = useState('');
  const [tlp, setTlp] = useState<string>('');
  const [pap, setPap] = useState<string>('');
  const [killChainName, setKillChainName] = useState('mitre_attack');
  const [phaseName, setPhaseName] = useState('');

  // Prefill form in edit mode
  useEffect(() => {
    if (initialData) {
      if (initialData.type === 'infrastructure') {
        setCategory('infrastructure');
        setName(initialData.name || '');
        setDescription(initialData.description || '');
        setInfraType(initialData.infrastructure_types?.[0] || 'server');
      } else if (initialData.type === 'user-account') {
        setCategory('user-account');
        setAccountName(initialData.user_id || initialData.account_name || '');
        const domainMatch = initialData.display_name?.split('@')[1];
        if (domainMatch) setDomain(domainMatch);
      } else if (initialData.type === 'malware') {
        setCategory('malware');
        setName(initialData.name || '');
        setDescription(initialData.description || '');
        setMalwareFamily(initialData.malware_types?.[0] || '');
        if (initialData.hashes) {
          setSha256(initialData.hashes['SHA-256'] || '');
          setMd5(initialData.hashes['MD5'] || '');
        }
      } else if (['ipv4-addr', 'domain-name', 'url'].includes(initialData.type)) {
        setCategory(initialData.type as StixCategory);
        setIndicatorValue(initialData.value || '');
      } else if (initialData.type === 'indicator') {
        const subType = initialData.pattern?.includes('ipv4-addr') ? 'ipv4-addr' :
            initialData.pattern?.includes('url') ? 'url' : 'domain-name';
        setCategory(subType as StixCategory);
        setIndicatorValue(initialData.name || '');
      }

      if (initialData.labels) setLabelsStr(initialData.labels.join(', '));
      if (initialData.object_marking_refs) {
        const tlpRef = initialData.object_marking_refs.find((ref: string) => Object.values(TLP_MARKING_DEFINITIONS).includes(ref as any));
        if (tlpRef) setTlp(tlpRef);
        const papRef = initialData.object_marking_refs.find((ref: string) => Object.values(PAP_MARKING_DEFINITIONS).includes(ref as any));
        if (papRef) setPap(papRef);
      }
      if (initialData.kill_chain_phases?.[0]) {
        setKillChainName(initialData.kill_chain_phases[0].kill_chain_name);
        setPhaseName(initialData.kill_chain_phases[0].phase_name);
      }
    }
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category) return;

    setSaving(true);
    setError(null);

    try {
      let stix_type = category as string;
      let data: any = {};

      if (category === 'infrastructure') {
        if (!name.trim()) { setError('Le nom est requis'); setSaving(false); return; }
        data = { name: name.trim(), description: description.trim(), infrastructure_type: infraType };
      }

      if (category === 'user-account') {
        if (!accountName.trim()) { setError("Le nom de compte est requis"); setSaving(false); return; }
        data = { account_name: accountName.trim(), domain: domain.trim(), display_name: `${accountName.trim()}${domain.trim() ? '@' + domain.trim() : ''}` };
      }

      if (category === 'malware') {
        if (!name.trim()) { setError('Le nom est requis'); setSaving(false); return; }
        data = {
          name: name.trim(),
          description: description.trim(),
          file_name: name.trim(),
          malware_types: malwareFamily.trim() ? [malwareFamily.trim()] : ['unknown'],
          sha256: sha256.trim() || undefined,
          md5: md5.trim() || undefined,
        };
      }

      if (['ipv4-addr', 'domain-name', 'url'].includes(category)) {
        if (!indicatorValue.trim()) { setError('La valeur est requise'); setSaving(false); return; }
        stix_type = category;
        data = { value: indicatorValue.trim() };
      }

      // Add optional linked indicators to any object creation/update
      if (!['ipv4-addr', 'domain-name', 'url'].includes(category)) {
        if (ipv4Val.trim()) { data.ipv4 = ipv4Val.trim(); data.ipv4_rel = ipv4Rel; }
        if (domainVal.trim()) { data.domain = domainVal.trim(); data.domain_rel = domainRel; }
        if (urlVal.trim()) { data.url = urlVal.trim(); data.url_rel = urlRel; }
      }

      const labels = labelsStr.split(',').map(s => s.trim()).filter(Boolean);
      const enrichment = {
        ...(labels.length > 0 ? { labels } : {}),
        ...(tlp ? { tlp } : {}),
        ...(pap ? { pap } : {}),
        ...(killChainName && phaseName ? { kill_chain_name: killChainName, phase_name: phaseName } : {}),
      };

      data = { ...data, ...enrichment };

      if (initialData) {
        await api.put(`/investigation/stix/${initialData.id}`, {
          case_id: caseId,
          stix_type,
          data,
        });
      } else {
        await api.post('/investigation/stix', {
          case_id: caseId,
          ...(taskId ? { task_id: taskId } : {}),
          stix_type,
          data,
        });
      }

      onCreated();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de la création');
    } finally {
      setSaving(false);
    }
  };

  return (
    <OffCanvas
      isOpen={true}
      onClose={onClose}
      title={initialData ? t('auto.modifier_element_technique', 'Modifier un élément technique') : t('auto.ajouter_element_technique', 'Ajouter un élément technique')}
      width="md"
    >
      <div className="p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Category selector */}
          {!category ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-slate-300 mb-4">
                {t('auto.choisir_type_element', 'Quel type d\'élément souhaitez-vous ajouter ?')}
              </p>
              {CATEGORIES.map(cat => {
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setCategory(cat.key)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 hover:border-purple-400 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/10 transition text-left group"
                  >
                    <div className="p-2 rounded-lg bg-gray-100 dark:bg-slate-800 group-hover:bg-purple-100 dark:group-hover:bg-purple-900/30 transition">
                      <Icon className={`w-5 h-5 ${cat.color}`} />
                    </div>
                    <span className="text-sm font-medium text-gray-700 dark:text-slate-300 flex-1">
                      {cat.label}
                    </span>
                    <Tooltip content={cat.desc} position="left" />
                  </button>
                );
              })}
            </div>
          ) : (
            <>
              {/* Back to category selection (only if not editing) */}
              {!initialData && (
                <button
                  type="button"
                  onClick={() => { setCategory(null); setError(null); }}
                  className="text-sm text-purple-600 dark:text-purple-400 hover:underline"
                >
                  ← {t('auto.changer_type', 'Changer de type')}
                </button>
              )}

              {/* Dynamic fields per category */}
              {category === 'infrastructure' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      {t('auto.nom_hostname', 'Nom (Hostname)')} *
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-70 disabled:cursor-not-allowed"
                      placeholder="SRV-DC01"
                      autoFocus={!initialData}
                      disabled={!!initialData}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      {t('auto.type_systeme', 'Type de système')}
                    </label>
                    <select
                      value={infraType}
                      onChange={e => setInfraType(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-white"
                    >
                      <option value="server">Serveur</option>
                      <option value="workstation">Poste de travail</option>
                      <option value="network">Équipement réseau</option>
                      <option value="cloud">Cloud</option>
                      <option value="unknown">Autre</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      {t('auto.description')}
                    </label>
                    <textarea
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-white"
                      placeholder="Description optionnelle..."
                    />
                  </div>
                </div>
              )}

              {category === 'user-account' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      {t('auto.nom_utilisateur', 'Nom d\'utilisateur')} *
                    </label>
                    <input
                      type="text"
                      value={accountName}
                      onChange={e => setAccountName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-70 disabled:cursor-not-allowed"
                      placeholder="admin.user"
                      autoFocus={!initialData}
                      disabled={!!initialData}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      {t('auto.domaine', 'Domaine')}
                    </label>
                    <input
                      type="text"
                      value={domain}
                      onChange={e => setDomain(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-white disabled:opacity-70 disabled:cursor-not-allowed"
                      placeholder="CORP.LOCAL"
                      disabled={!!initialData}
                    />
                  </div>
                </div>
              )}

              {category === 'malware' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      {t('auto.nom', 'Nom')} *
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-70 disabled:cursor-not-allowed"
                      placeholder="cobalt_strike.exe"
                      autoFocus={!initialData}
                      disabled={!!initialData}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      {t('auto.famille', 'Famille')}
                    </label>
                    <input
                      type="text"
                      value={malwareFamily}
                      onChange={e => setMalwareFamily(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-white"
                      placeholder="CobaltStrike"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">SHA-256</label>
                      <input
                        type="text"
                        value={sha256}
                        onChange={e => setSha256(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-white text-xs font-mono"
                        placeholder="e3b0c4..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">MD5</label>
                      <input
                        type="text"
                        value={md5}
                        onChange={e => setMd5(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-white text-xs font-mono"
                        placeholder="d41d8c..."
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      {t('auto.description')}
                    </label>
                    <textarea
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-white"
                    />
                  </div>
                </div>
              )}

              {['ipv4-addr', 'domain-name', 'url'].includes(category) && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      {category === 'ipv4-addr' ? 'Adresse IP' : category === 'domain-name' ? 'Nom de Domaine' : 'URL Compromise'} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={indicatorValue}
                      onChange={e => setIndicatorValue(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-white focus:ring-2 focus:ring-purple-500 font-mono disabled:opacity-70 disabled:cursor-not-allowed"
                      placeholder={category === 'ipv4-addr' ? 'ex: 192.168.1.1' : category === 'domain-name' ? 'ex: malicious.com' : 'ex: https://malicious.com/payload'}
                      required
                      autoFocus={!initialData}
                      disabled={!!initialData}
                    />
                  </div>
                </div>
              )}

              {/* Advanced Enrichment Options */}
              <div className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden mt-4 mb-4">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800/50 flex items-center justify-between text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition focus:outline-none"
                >
                  <span>Options avancées / Enrichissement</span>
                  {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {showAdvanced && (
                  <div className="p-4 bg-white dark:bg-slate-800/50 space-y-4 border-t border-gray-200 dark:border-slate-700">
                    <div className="grid grid-cols-2 gap-4">
                      {/* TLP */}
                      <div>
                        <label className="text-xs font-medium text-gray-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                          Marquage TLP
                          <Tooltip content="Traffic Light Protocol : Indique le niveau de confidentialité et de partage autorisé pour cette information." iconSize={12} />
                        </label>
                        <select
                          value={tlp}
                          onChange={e => setTlp(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800/80 text-gray-800 dark:text-white text-sm focus:ring-2 focus:ring-purple-500"
                        >
                          <option value="">Aucun</option>
                          {Object.entries(TLP_MARKING_DEFINITIONS).map(([level, ref]) => (
                            <option key={level} value={ref}>TLP: {level}</option>
                          ))}
                        </select>
                      </div>
                      {/* PAP */}
                      <div>
                        <label className="text-xs font-medium text-gray-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                          Marquage PAP
                          <Tooltip content="Permissible Actions Protocol : Définit ce que le destinataire a le droit de faire techniquement avec cette information (ex: l'utiliser pour bloquer activement une menace)." iconSize={12} />
                        </label>
                        <select
                          value={pap}
                          onChange={e => setPap(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800/80 text-gray-800 dark:text-white text-sm focus:ring-2 focus:ring-purple-500"
                        >
                          <option value="">Aucun</option>
                          {Object.entries(PAP_MARKING_DEFINITIONS).map(([level, ref]) => (
                            <option key={level} value={ref}>PAP: {level}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {/* Tags / Labels */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
                        Tags / Labels STIX (séparés par des virgules)
                      </label>
                      <input
                        type="text"
                        value={labelsStr}
                        onChange={e => setLabelsStr(e.target.value)}
                        placeholder="APT28, phishing, campagne-2026..."
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800/80 text-gray-800 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                    {/* Kill Chain (for Malware / Indicator) */}
                    {(category === 'malware' || ['ipv4-addr', 'domain-name', 'url'].includes(category as string)) && (
                      <div className="pt-2">
                        <label className="text-xs font-medium text-gray-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                          Phase Kill Chain MITRE
                          <Tooltip content="Permet de positionner l'outil ou le fichier à une étape précise d'une attaque (ex: Mouvement latéral, Exfiltration)." iconSize={12} />
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <input
                            type="text"
                            value={killChainName}
                            onChange={e => setKillChainName(e.target.value)}
                            placeholder="Nom (ex: mitre_attack)"
                            className="w-full px-2 py-1.5 rounded-md border border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/50 text-gray-500 dark:text-slate-400 text-xs"
                            disabled
                          />
                          <input
                            type="text"
                            value={phaseName}
                            onChange={e => setPhaseName(e.target.value)}
                            placeholder="Phase (ex: att_lateral_movement)"
                            className="w-full px-2 py-1.5 rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-white text-xs focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                    )}
                    
                    {(!category || !['ipv4-addr', 'domain-name', 'url'].includes(category)) && (
                      <div className="pt-4 border-t border-gray-200 dark:border-slate-700 space-y-3">
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Indicateurs Associés (Optionnels)</h4>
                          <p className="text-xs text-gray-500 dark:text-slate-400">Ces indicateurs seront créés et liés automatiquement à votre objet principal ({category}).</p>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
                              Adresse IP liée
                            </label>
                            <div className="flex gap-2">
                              <select 
                                value={ipv4Rel} 
                                onChange={e => setIpv4Rel(e.target.value)}
                                className="w-1/3 px-2 py-1.5 rounded-md border border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 text-gray-700 dark:text-slate-300 text-xs focus:ring-2 focus:ring-purple-500"
                              >
                                {RELATIONSHIP_TYPES.map(rt => <option key={rt.value} value={rt.value}>{rt.label}</option>)}
                              </select>
                              <input
                                type="text"
                                value={ipv4Val}
                                onChange={e => setIpv4Val(e.target.value)}
                                className="flex-1 px-2 py-1.5 rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-white font-mono text-xs focus:ring-2 focus:ring-purple-500"
                                placeholder="ex: 1.2.3.4"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
                              Domaine lié
                            </label>
                            <div className="flex gap-2">
                              <select 
                                value={domainRel} 
                                onChange={e => setDomainRel(e.target.value)}
                                className="w-1/3 px-2 py-1.5 rounded-md border border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 text-gray-700 dark:text-slate-300 text-xs focus:ring-2 focus:ring-purple-500"
                              >
                                {RELATIONSHIP_TYPES.map(rt => <option key={rt.value} value={rt.value}>{rt.label}</option>)}
                              </select>
                              <input
                                type="text"
                                value={domainVal}
                                onChange={e => setDomainVal(e.target.value)}
                                className="flex-1 px-2 py-1.5 rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-white font-mono text-xs focus:ring-2 focus:ring-purple-500"
                                placeholder="ex: evil.com"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
                              URL compromise liée
                            </label>
                            <div className="flex gap-2">
                              <select 
                                value={urlRel} 
                                onChange={e => setUrlRel(e.target.value)}
                                className="w-1/3 px-2 py-1.5 rounded-md border border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 text-gray-700 dark:text-slate-300 text-xs focus:ring-2 focus:ring-purple-500"
                              >
                                {RELATIONSHIP_TYPES.map(rt => <option key={rt.value} value={rt.value}>{rt.label}</option>)}
                              </select>
                              <input
                                type="text"
                                value={urlVal}
                                onChange={e => setUrlVal(e.target.value)}
                                className="flex-1 px-2 py-1.5 rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-white font-mono text-xs focus:ring-2 focus:ring-purple-500"
                                placeholder="ex: https://evil.com/payload"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {error && (
                <div className="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
                  {error}
                </div>
              )}

              {/* Submit */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition text-sm"
                >
                  {t('auto.annuler')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-orange-600 text-white hover:bg-orange-700 transition text-sm disabled:opacity-50 flex items-center gap-2 shadow-sm"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {saving ? (initialData ? t('auto.modification_en_cours', 'Modification...') : t('auto.creation_en_cours', 'Création...')) : (initialData ? t('auto.mettre_a_jour', 'Mettre à jour') : t('auto.creer', 'Créer'))}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </OffCanvas>
  );
}
