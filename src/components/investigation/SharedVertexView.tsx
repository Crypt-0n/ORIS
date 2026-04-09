import React from 'react';
import { useMemo } from 'react';
import { Link2, User, Server, Bug, Shield, Globe, Monitor, KeyRound, DatabaseZap } from 'lucide-react';
import type { DiamondNode } from '../../lib/diamondModelUtils';
import type { LinkedObject } from './LinkedObjectTag';
import { useTranslation } from "react-i18next";

interface SharedVertexViewProps {
  nodes: DiamondNode[];
  allSystems?: { id: string; label: string; type: string }[];
  onSelectNode: (id: string) => void;
  selectedNodeId: string | null;
}

type AxisKey = 'adversary' | 'infrastructure' | 'capability' | 'victim';

interface SharedVertex {
  objectId: string;
  objectLabel: string;
  objectType: LinkedObject['type'];
  axis: AxisKey;
  linkedNodes: DiamondNode[];
}

const AXIS_CONFIG: Record<AxisKey, { label: string; icon: React.ElementType; hexColor: string }> = {
  adversary: { label: 'Adversaire', icon: User, hexColor: '#ef4444' },
  infrastructure: { label: 'Infrastructure', icon: Server, hexColor: '#f97316' },
  capability: { label: 'Capacite', icon: Bug, hexColor: '#eab308' },
  victim: { label: 'Victime', icon: Shield, hexColor: '#22c55e' },
};

const OBJECT_TYPE_ICONS: Record<string, React.ElementType> = {
  system: Monitor,
  malware: Bug,
  account: KeyRound,
  network: Globe,
  exfiltration: DatabaseZap,
};

function buildSharedVertices(nodes: DiamondNode[]): SharedVertex[] {
  const axes: AxisKey[] = ['adversary', 'infrastructure', 'capability', 'victim'];
  const map = new Map<string, SharedVertex>();

  for (const axis of axes) {
    for (const node of nodes) {
      for (const obj of node.axes[axis]) {
        const key = `${axis}::${obj.id}`;
        if (!map.has(key)) {
          map.set(key, {
            objectId: obj.id,
            objectLabel: obj.label,
            objectType: obj.type,
            axis,
            linkedNodes: [],
          });
        }
        const entry = map.get(key)!;
        if (!entry.linkedNodes.some((n) => n.id === node.id)) {
          entry.linkedNodes.push(node);
        }
      }
    }
  }

  return Array.from(map.values())
    .filter((v) => v.linkedNodes.length >= 2)
    .sort((a, b) => {
      if (b.linkedNodes.length !== a.linkedNodes.length) return b.linkedNodes.length - a.linkedNodes.length;
      return a.objectLabel.localeCompare(b.objectLabel);
    });
}

function formatDate(dt: string | null): string {
  if (!dt) return '';
  return new Date(dt).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function SharedVertexView({ nodes, allSystems, onSelectNode, selectedNodeId }: SharedVertexViewProps) {
    const { t } = useTranslation();
    void allSystems; // Placeholder pour future implémentation
  const vertices = useMemo(() => buildSharedVertices(nodes), [nodes]);

  const grouped = useMemo(() => {
    const result: Partial<Record<AxisKey, SharedVertex[]>> = {};
    for (const v of vertices) {
      if (!result[v.axis]) result[v.axis] = [];
      result[v.axis]!.push(v);
    }
    return result;
  }, [vertices]);

  const axisOrder: AxisKey[] = ['adversary', 'infrastructure', 'capability', 'victim'];

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500">
        <Link2 className="w-8 h-8 mb-3 opacity-30" />
        <p className="text-sm">{t('auto.aucun_evenement_dans_le_modele')}</p>
      </div>
    );
  }

  if (vertices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500">
        <Link2 className="w-8 h-8 mb-3 opacity-30" />
        <p className="text-sm">{t('auto.aucun_sommet_commun_detecte_en')}</p>
        <p className="text-xs mt-1 text-slate-400 dark:text-slate-600">{t('auto.deux_diamants_doivent_partager')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-xs text-slate-500">
        {t('auto.deux_diamants_sont_lies_s_ils_')}</p>

      {axisOrder.map((axis) => {
        const group = grouped[axis];
        if (!group || group.length === 0) return null;
        const { label, icon: AxisIcon, hexColor } = AXIS_CONFIG[axis];

        return (
          <section key={axis}>
            <div className="flex items-center gap-2 mb-3">
              <AxisIcon className="w-4 h-4" style={{ color: hexColor }} />
              <h4 className="text-sm font-semibold text-gray-800 dark:text-slate-200">{label}</h4>
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: `${hexColor}22`, color: hexColor, border: `1px solid ${hexColor}44` }}
              >
                {group.length} {t('auto.sommet')}{group.length > 1 ? 's' : ''}
              </span>
            </div>

            <div className="space-y-3">
              {group.map((vertex) => {
                const ObjIcon = OBJECT_TYPE_ICONS[vertex.objectType] || Bug;
                return (
                  <div
                    key={`${vertex.axis}-${vertex.objectId}`}
                    className="bg-gray-50 dark:bg-slate-800/60 border rounded-xl overflow-hidden"
                    style={{ borderColor: `${hexColor}33` }}
                  >
                    <div
                      className="flex items-center gap-2.5 px-4 py-2.5"
                      style={{ borderBottom: `1px solid ${hexColor}22`, backgroundColor: `${hexColor}0d` }}
                    >
                      <div
                        className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${hexColor}22` }}
                      >
                        <ObjIcon className="w-3.5 h-3.5" style={{ color: hexColor }} />
                      </div>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{vertex.objectLabel}</span>
                      <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
                        <Link2 className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                          {vertex.linkedNodes.length} {t('auto.diamants_lies')}</span>
                      </div>
                    </div>

                    <div className="p-3 grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
                      {vertex.linkedNodes.map((node, i) => {
                        const isSelected = selectedNodeId === node.id;
                        const otherAxes = (Object.keys(node.axes) as AxisKey[]).filter((a) => a !== vertex.axis);
                        return (
                          <button
                            key={node.id}
                            onClick={() => onSelectNode(node.id)}
                            className="flex flex-col gap-2 p-2.5 rounded-lg border text-left transition bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800"
                            style={{
                              borderColor: isSelected ? node.killChainHexColor : undefined,
                              backgroundColor: isSelected ? `${node.killChainHexColor}18` : undefined,
                            }}
                          >
                            <div className="flex items-start gap-2.5">
                              <div
                                className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0 mt-0.5"
                                style={{ backgroundColor: node.killChainHexColor }}
                              >
                                {i + 1}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                                  <span
                                    className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                                    style={{
                                      backgroundColor: `${node.killChainHexColor}30`,
                                      color: node.killChainHexColor,
                                    }}
                                  >
                                    {node.killChainPhaseLabel}
                                  </span>
                                  {node.eventDatetime && (
                                    <span className="text-[9px] text-slate-400 dark:text-slate-600">{formatDate(node.eventDatetime)}</span>
                                  )}
                                </div>
                                <p className="text-[10px] text-gray-700 dark:text-slate-300 leading-tight line-clamp-2">{node.label}</p>
                              </div>
                            </div>

                            <div className="border-t border-gray-200 dark:border-slate-700/50 pt-2 space-y-1">
                              {otherAxes.map((a) => {
                                const cfg = AXIS_CONFIG[a];
                                const AxisIc = cfg.icon;
                                const items = node.axes[a];
                                if (items.length === 0) return null;
                                return (
                                  <div key={a} className="flex items-start gap-1.5">
                                    <AxisIc className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: cfg.hexColor }} />
                                    <div className="flex flex-wrap gap-1 min-w-0">
                                      {items.map((obj) => {
                                        const OIc = OBJECT_TYPE_ICONS[obj.type] || Bug;
                                        return (
                                          <span
                                            key={obj.id}
                                            className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full truncate max-w-[140px]"
                                            style={{
                                              backgroundColor: `${cfg.hexColor}18`,
                                              color: cfg.hexColor,
                                              border: `1px solid ${cfg.hexColor}33`,
                                            }}
                                          >
                                            <OIc className="w-2.5 h-2.5 flex-shrink-0" />
                                            {obj.label}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      <div className="bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-700/50 rounded-xl p-4">
        <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3">{t('auto.legende')}</h4>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {axisOrder.map((axis) => {
            const { label, icon: Icon, hexColor } = AXIS_CONFIG[axis];
            return (
              <div key={axis} className="flex items-center gap-2">
                <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: hexColor }} />
                <p className="text-[10px] text-slate-500 dark:text-slate-400">{label}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
