export interface SystemNode {
  id: string;
  name: string;
  systemType: string;
  x: number;
  y: number;
  hasMaliciousMalware: boolean;
  investigationStatus: string | null;
}

export interface LateralEdge {
  id: string;
  sourceId: string;
  targetId: string;
  description: string;
  datetime: string;
  eventType: string;
  killChain: string | null;
  pairIndex: number;
  pairCount: number;
  attackPatternName?: string | null;
  killChainPhases?: { kill_chain_name: string; phase_name: string }[] | null;
}

export interface EmailMarker {
  id: string;
  systemId: string;
  description: string;
  datetime: string;
  killChain: string | null;
}

export interface AttackerInfraNode {
  id: string;
  name: string;
  x: number;
  y: number;
}

export interface InfraLink {
  infraId: string;
  systemId: string;
}

export interface LateralMovementGraphProps {
  caseId: string;
  killChainType?: string;
  startDate?: string;
  endDate?: string;
  isReportView?: boolean;
  forceTheme?: 'light' | 'dark';
  layoutMode?: 'force' | 'chronological';
}
