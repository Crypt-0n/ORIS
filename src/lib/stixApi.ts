/**
 * STIX 2.1 API client — wraps the existing ApiClient for STIX-specific endpoints.
 */
import { api } from './api';
import type { StixSDO, Relationship, StixBundle } from './stix.types';

// ─── STIX Objects ───────────────────────────────────────────────

export async function fetchStixObjects(caseId: string): Promise<StixSDO[]> {
    return api.get(`/stix/objects/by-case/${caseId}`);
}

export async function fetchStixObject(id: string): Promise<StixSDO> {
    return api.get(`/stix/objects/${id}`);
}

export async function createStixObject(caseId: string, data: Omit<StixSDO, 'spec_version'>): Promise<StixSDO> {
    return api.post('/stix/objects', { case_id: caseId, ...data });
}

export async function updateStixObject(id: string, data: StixSDO): Promise<StixSDO> {
    return api.put(`/stix/objects/${id}`, data);
}

export async function deleteStixObject(id: string): Promise<void> {
    await api.delete(`/stix/objects/${id}`);
}

// ─── STIX Relationships ─────────────────────────────────────────

export async function fetchStixRelationships(caseId: string): Promise<Relationship[]> {
    return api.get(`/stix/relationships/by-case/${caseId}`);
}

export async function createStixRelationship(caseId: string, data: Omit<Relationship, 'type'>): Promise<Relationship> {
    return api.post('/stix/relationships', { case_id: caseId, type: 'relationship', ...data });
}

export async function deleteStixRelationship(id: string): Promise<void> {
    await api.delete(`/stix/relationships/${id}`);
}

// ─── STIX Bundle ────────────────────────────────────────────────

export async function fetchStixBundle(caseId: string): Promise<StixBundle> {
    return api.get(`/stix/bundle/${caseId}`);
}

// ─── Helpers ────────────────────────────────────────────────────

export function generateStixId(type: string): string {
    return `${type}--${crypto.randomUUID()}`;
}

export function nowIso(): string {
    return new Date().toISOString();
}
