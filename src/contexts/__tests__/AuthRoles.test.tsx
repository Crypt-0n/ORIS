import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthContext';
import { api } from '../../lib/api';

vi.mock('../../lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    setToken: vi.fn(),
  }
}));

/**
 * RBAC Frontend Tests — validates role parsing, hasRole, hasAnyRole,
 * and the canSeeCases/canSeeAlerts flags from AuthContext for every user profile type.
 */

// Test component that exposes all role-related state
const RoleTestComponent = () => {
    const { profile, loading, hasRole, hasAnyRole } = useAuth();
    if (loading) return <div>Loading...</div>;
    if (!profile) return <div>Not authenticated</div>;
    return (
        <div>
            <span data-testid="roles">{JSON.stringify(profile.roles)}</span>
            <span data-testid="is-admin">{hasRole('admin') ? 'yes' : 'no'}</span>
            <span data-testid="is-case-analyst">{hasRole('case_analyst') ? 'yes' : 'no'}</span>
            <span data-testid="is-alert-analyst">{hasRole('alert_analyst') ? 'yes' : 'no'}</span>
            <span data-testid="has-any-analyst">{hasAnyRole(['case_analyst', 'alert_analyst']) ? 'yes' : 'no'}</span>
            <span data-testid="can-see-cases">{profile.canSeeCases ? 'yes' : 'no'}</span>
            <span data-testid="can-see-alerts">{profile.canSeeAlerts ? 'yes' : 'no'}</span>
        </div>
    );
};

function renderWithProfile(profileData: Record<string, any>) {
    vi.mocked(api.get).mockResolvedValueOnce({ user: profileData });
    return render(
        <AuthProvider>
            <RoleTestComponent />
        </AuthProvider>
    );
}

describe('AuthContext — RBAC Role Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        sessionStorage.clear();
    });

    // ── Admin Profile ──
    it('admin profile → hasRole(admin)=true, canSeeCases=true, canSeeAlerts=true', async () => {
        renderWithProfile({
            id: '1', email: 'admin@oris.local',
            role: '["admin"]', is_active: true,
            canSeeCases: true, canSeeAlerts: true,
        });
        await waitFor(() => {
            expect(screen.getByTestId('is-admin')).toHaveTextContent('yes');
            expect(screen.getByTestId('can-see-cases')).toHaveTextContent('yes');
            expect(screen.getByTestId('can-see-alerts')).toHaveTextContent('yes');
        });
    });

    // ── Case Analyst ──
    it('case_analyst profile → hasRole(case_analyst)=true, canSeeCases=true, canSeeAlerts=false', async () => {
        renderWithProfile({
            id: '2', email: 'analyst@oris.local',
            role: '["case_analyst"]', is_active: true,
            canSeeCases: true, canSeeAlerts: false,
        });
        await waitFor(() => {
            expect(screen.getByTestId('is-case-analyst')).toHaveTextContent('yes');
            expect(screen.getByTestId('is-admin')).toHaveTextContent('no');
            expect(screen.getByTestId('can-see-cases')).toHaveTextContent('yes');
            expect(screen.getByTestId('can-see-alerts')).toHaveTextContent('no');
        });
    });

    // ── Alert Analyst ──
    it('alert_analyst profile → hasRole(alert_analyst)=true, canSeeAlerts=true, canSeeCases=false', async () => {
        renderWithProfile({
            id: '3', email: 'alert@oris.local',
            role: '["alert_analyst"]', is_active: true,
            canSeeCases: false, canSeeAlerts: true,
        });
        await waitFor(() => {
            expect(screen.getByTestId('is-alert-analyst')).toHaveTextContent('yes');
            expect(screen.getByTestId('is-case-analyst')).toHaveTextContent('no');
            expect(screen.getByTestId('can-see-cases')).toHaveTextContent('no');
            expect(screen.getByTestId('can-see-alerts')).toHaveTextContent('yes');
        });
    });

    // ── Combined Roles ──
    it('case_analyst + alert_analyst → hasAnyRole=true for both', async () => {
        renderWithProfile({
            id: '4', email: 'dual@oris.local',
            role: '["case_analyst","alert_analyst"]', is_active: true,
            canSeeCases: true, canSeeAlerts: true,
        });
        await waitFor(() => {
            expect(screen.getByTestId('has-any-analyst')).toHaveTextContent('yes');
            expect(screen.getByTestId('is-case-analyst')).toHaveTextContent('yes');
            expect(screen.getByTestId('is-alert-analyst')).toHaveTextContent('yes');
            expect(screen.getByTestId('can-see-cases')).toHaveTextContent('yes');
            expect(screen.getByTestId('can-see-alerts')).toHaveTextContent('yes');
        });
    });

    // ── Viewer (no analyst roles) ──
    it('case_viewer → hasAnyRole([case_analyst, alert_analyst])=false', async () => {
        renderWithProfile({
            id: '5', email: 'viewer@oris.local',
            role: '["case_viewer"]', is_active: true,
            canSeeCases: true, canSeeAlerts: false,
        });
        await waitFor(() => {
            expect(screen.getByTestId('has-any-analyst')).toHaveTextContent('no');
            expect(screen.getByTestId('is-admin')).toHaveTextContent('no');
            expect(screen.getByTestId('can-see-cases')).toHaveTextContent('yes');
        });
    });

    // ── Role Parsing Edge Cases ──
    it('role as raw string (non-JSON) → treated as single role', async () => {
        renderWithProfile({
            id: '6', email: 'raw@oris.local',
            role: 'admin', is_active: true,
            canSeeCases: true, canSeeAlerts: true,
        });
        await waitFor(() => {
            expect(screen.getByTestId('is-admin')).toHaveTextContent('yes');
            expect(screen.getByTestId('roles')).toHaveTextContent('["admin"]');
        });
    });

    it('null role → defaults to [user]', async () => {
        renderWithProfile({
            id: '7', email: 'null@oris.local',
            role: null, is_active: true,
            canSeeCases: false, canSeeAlerts: false,
        });
        await waitFor(() => {
            expect(screen.getByTestId('roles')).toHaveTextContent('["user"]');
            expect(screen.getByTestId('is-admin')).toHaveTextContent('no');
        });
    });

    it('role as array (already parsed) → passthrough', async () => {
        renderWithProfile({
            id: '8', email: 'array@oris.local',
            role: ['admin', 'case_analyst'], is_active: true,
            canSeeCases: true, canSeeAlerts: true,
        });
        await waitFor(() => {
            expect(screen.getByTestId('is-admin')).toHaveTextContent('yes');
            expect(screen.getByTestId('is-case-analyst')).toHaveTextContent('yes');
        });
    });

    // ── No authentication ──
    it('no session → profile is null, hasRole returns false', async () => {
        vi.mocked(api.get).mockRejectedValueOnce(new Error('No session'));
        render(
            <AuthProvider>
                <RoleTestComponent />
            </AuthProvider>
        );
        await waitFor(() => {
            expect(screen.getByText('Not authenticated')).toBeInTheDocument();
        });
    });
});
