import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useLateralMovementData } from '../useLateralMovementData';
import { api } from '../../../../../lib/api';

vi.mock('../../../../../lib/api', () => ({
  api: {
    get: vi.fn(),
  }
}));

describe('useLateralMovementData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devrait retourner l\'état initial de chargement et valeurs vides', () => {
    (api.get as any).mockImplementation(() => new Promise(() => {}));
    const { result } = renderHook(() => useLateralMovementData({ caseId: 'case-1' }));

    expect(result.current.loading).toBe(true);
    expect(result.current.nodes.length).toBe(0);
    expect(result.current.edges.length).toBe(0);
  });

  it('devrait retourner aucun noeud si aucun mouvement ou objet trouvé', async () => {
    (api.get as any).mockResolvedValueOnce([]); // lateral
    (api.get as any).mockResolvedValueOnce({ objects: [] }); // bundle

    const { result } = renderHook(() => useLateralMovementData({ caseId: 'case-1' }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.nodes.length).toBe(0);
    expect(result.current.edges.length).toBe(0);
  });

  it('devrait agréger les sources et cibles en noeuds uniques', async () => {
    const mockLateral = [
      {
        id: 'rel-1',
        source: { id: 'sys-1' },
        target: { id: 'sys-2' },
        event_datetime: '2024-01-01T12:00:00Z',
        relationship_type: 'connected-to',
      }
    ];

    const mockBundle = {
      objects: [
        { type: 'infrastructure', id: 'sys-1', name: 'Server A', infrastructure_types: ['serveur'] },
        { type: 'infrastructure', id: 'sys-2', name: 'Endpoint B', infrastructure_types: ['ordinateur'] },
      ]
    };

    (api.get as any).mockResolvedValueOnce(mockLateral);
    (api.get as any).mockResolvedValueOnce(mockBundle);

    const { result } = renderHook(() => useLateralMovementData({ caseId: 'case-1', layoutMode: 'force' }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.nodes.length).toBe(2);
    expect(result.current.nodes.find(n => n.id === 'sys-1')?.name).toBe('Server A');
    expect(result.current.nodes.find(n => n.id === 'sys-2')?.name).toBe('Endpoint B');
    expect(result.current.edges.length).toBe(1);
    expect(result.current.edges[0].sourceId).toBe('sys-1');
    expect(result.current.edges[0].targetId).toBe('sys-2');
  });

  it('devrait appliquer le mode layout chronologique', async () => {
    const mockLateral = [
      { id: 'rel-1', source: { id: 'sys-1' }, target: { id: 'sys-2' }, event_datetime: '2024-01-01T12:00:00Z' }
    ];
    const mockBundle = {
      objects: [
        { type: 'infrastructure', id: 'sys-1', name: 'Sys 1' },
        { type: 'infrastructure', id: 'sys-2', name: 'Sys 2' }
      ]
    };

    (api.get as any).mockResolvedValueOnce(mockLateral);
    (api.get as any).mockResolvedValueOnce(mockBundle);

    const { result } = renderHook(() => useLateralMovementData({ caseId: 'case-1', layoutMode: 'chronological' }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // In chronological layout, y axis indicates time. sys-1 should be above sys-2. (y is higher visually meaning lower value)
    const y1 = result.current.nodes.find(n => n.id === 'sys-1')?.y || 0;
    const y2 = result.current.nodes.find(n => n.id === 'sys-2')?.y || 0;
    
    expect(y1).toBeLessThan(y2);
  });
});
