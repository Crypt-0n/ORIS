import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../lib/api';
import { getIsolatedSystems } from '../../../../lib/diamondModelUtils';
import { SystemNode, LateralEdge, AttackerInfraNode, InfraLink, EmailMarker, LateralMovementGraphProps } from '../types';
import { computeVH, layoutNodesForce, layoutNodesChronological, VW } from '../layoutUtils';

export function useLateralMovementData({
  caseId,
  startDate,
  endDate,
  layoutMode = 'force',
}: LateralMovementGraphProps) {
  const [nodes, setNodes] = useState<SystemNode[]>([]);
  const [edges, setEdges] = useState<LateralEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [emailMarkers, setEmailMarkers] = useState<EmailMarker[]>([]);
  const [infraNodes, setInfraNodes] = useState<AttackerInfraNode[]>([]);
  const [infraLinks, setInfraLinks] = useState<InfraLink[]>([]);
  const [saving, setSaving] = useState(false);
  const [hasCustomLayout, setHasCustomLayout] = useState(false);

  const loadLayout = useCallback(async (currentNodes: SystemNode[], stixObjects: any[]): Promise<SystemNode[] | null> => {
    try {
      let hasAnyPosition = false;
      let xCounter = 1;
      const newNodes = currentNodes.map(n => {
        const stixObj = stixObjects.find((o: any) => o.id === n.id);
        if (stixObj?.x_oris_graph_position) {
          hasAnyPosition = true;
          return { ...n, x: stixObj.x_oris_graph_position.x, y: stixObj.x_oris_graph_position.y };
        }
        const fallbackX = 100 + (xCounter * 80) % (VW - 200);
        const fallbackY = 100 + Math.floor(xCounter / ((VW - 200) / 80)) * 80;
        xCounter++;
        return { ...n, x: fallbackX, y: fallbackY };
      });
      if (hasAnyPosition) {
        setHasCustomLayout(true);
        return newNodes;
      }
    } catch (err) {
      console.error('Error loading layout:', err);
    }
    return null;
  }, []);

  const saveLayout = async () => {
    setSaving(true);
    try {
      await Promise.all(nodes.map(n =>
        api.patch(`/stix/objects/${n.id}/visual`, {
          x_oris_graph_position: { x: n.x, y: n.y },
        })
      ));
      setHasCustomLayout(true);
    } catch (err) {
      console.error('Error saving layout:', err);
    }
    setSaving(false);
  };

  const resetLayout = async () => {
    try {
      await Promise.all(nodes.map(n =>
        api.patch(`/stix/objects/${n.id}/visual`, {
          x_oris_graph_position: null,
        })
      ));
    } catch (err) {
      console.error('Error resetting layout:', err);
    }

    const newNodes = [...nodes];
    if (layoutMode === 'chronological') {
      layoutNodesChronological(newNodes, edges, computeVH(newNodes.length));
    } else {
      layoutNodesForce(newNodes, edges, computeVH(newNodes.length));
    }
    setNodes(newNodes);
    setHasCustomLayout(false);
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);

        const [lateralRes, bundleRes] = await Promise.all([
          api.get(`/stix/lateral/${caseId}`),
          api.get(`/stix/bundle/${caseId}`)
        ]);

        const movements = lateralRes || [];
        const stixObjects = bundleRes?.objects || [];

        const sysIds = new Set<string>();
        movements.forEach((m: any) => {
          sysIds.add(m.source.id);
          sysIds.add(m.target.id);
        });

        getIsolatedSystems(stixObjects).forEach((o: any) => {
          if (o.type === 'infrastructure' || o.type === 'ipv4-addr' || o.type === 'domain-name') {
            sysIds.add(o.id);
          }
        });

        if (sysIds.size === 0) {
          setNodes([]);
          setEdges([]);
          setEmailMarkers([]);
          setInfraNodes([]);
          setInfraLinks([]);
          setLoading(false);
          return;
        }

        const systems = stixObjects.filter((o: any) => (o.type === 'infrastructure' || o.type === 'ipv4-addr' || o.type === 'domain-name') && sysIds.has(o.id));

        const graphNodes: SystemNode[] = systems.map((s: any) => {
          return {
            id: s.id,
            name: s.name || s.value || 'Unknown',
            systemType: s.infrastructure_types?.[0] || (s.type === 'domain-name' ? 'wan' : 'serveur'),
            x: 0,
            y: 0,
            hasMaliciousMalware: false,
            investigationStatus: null,
          };
        });

        let validMovements = movements;
        if (startDate || endDate) {
          validMovements = validMovements.filter((m: any) => {
            const dt = m.event_datetime;
            if (!dt) return true;
            const time = new Date(dt.includes('T') ? dt : dt.replace(' ', 'T') + 'Z').getTime();
            if (startDate && time < new Date(startDate).getTime()) return false;
            if (endDate && time > new Date(endDate).getTime()) return false;
            return true;
          });
        }

        const graphEdges: LateralEdge[] = validMovements.map((m: any, idx: number) => ({
          id: `edge-${idx}`,
          sourceId: m.source.id,
          targetId: m.target.id,
          description: m.relationship_type,
          datetime: m.event_datetime,
          eventType: 'lateral-movement',
          killChain: m.kill_chain_phases?.[0]?.kill_chain_name || null,
          pairIndex: 0,
          pairCount: 1,
          attackPatternName: m.attack_pattern_name || null,
          killChainPhases: m.kill_chain_phases || null,
        }));

        const pairCounts = new Map<string, number>();
        const pairIdx = new Map<string, number>();
        graphEdges.forEach(e => {
          const k = [e.sourceId, e.targetId].sort().join(':');
          pairCounts.set(k, (pairCounts.get(k) || 0) + 1);
        });
        graphEdges.forEach(e => {
          const k = [e.sourceId, e.targetId].sort().join(':');
          const idx = pairIdx.get(k) || 0;
          pairIdx.set(k, idx + 1);
          e.pairIndex = idx;
          e.pairCount = pairCounts.get(k) || 1;
        });

        setEmailMarkers([]);
        const infraNodesArr: AttackerInfraNode[] = [];
        const infraSystemLinks: InfraLink[] = [];

        const nodesWithSavedLayout = await loadLayout(graphNodes, stixObjects);

        let finalNodes;
        if (nodesWithSavedLayout) {
          finalNodes = nodesWithSavedLayout;
        } else {
          if (layoutMode === 'chronological') {
            layoutNodesChronological(graphNodes, graphEdges, computeVH(graphNodes.length));
          } else {
            layoutNodesForce(graphNodes, graphEdges, computeVH(graphNodes.length));
          }
          finalNodes = graphNodes;
        }

        setNodes(finalNodes);
        setEdges(graphEdges);
        setInfraNodes(infraNodesArr);
        setInfraLinks(infraSystemLinks);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching lateral movements:', err);
        setLoading(false);
      }
    })();
  }, [caseId, loadLayout, startDate, endDate, layoutMode]);

  return {
    nodes,
    edges,
    loading,
    emailMarkers,
    infraNodes,
    infraLinks,
    saving,
    hasCustomLayout,
    setNodes,
    setInfraNodes,
    saveLayout,
    resetLayout
  };
}
