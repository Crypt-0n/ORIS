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

const TestComponent = () => {
    const { user, loading, hasRole } = useAuth();
    if (loading) return <div>Loading...</div>;
    if (!user) return <div>Not authenticated</div>;
    return (
        <div>
            <span data-testid="user-email">{user.email}</span>
            <span data-testid="is-admin">{hasRole('admin') ? 'true' : 'false'}</span>
        </div>
    );
};

describe('AuthContext', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        sessionStorage.clear();
    });

    it('should show loading initially and "Not authenticated" if no session', async () => {
        vi.mocked(api.get).mockRejectedValueOnce(new Error('No session'));
        render(
            <AuthProvider>
                <TestComponent />
            </AuthProvider>
        );
        expect(screen.getByText('Loading...')).toBeInTheDocument();
        await waitFor(() => {
            expect(screen.getByText('Not authenticated')).toBeInTheDocument();
        });
    });

    it('should correctly authenticate user and map roles', async () => {
        vi.mocked(api.get).mockResolvedValueOnce({
            user: {
                id: '123',
                email: 'admin@oris.local',
                role: '["user", "admin"]',
                is_active: true
            }
        });

        render(
            <AuthProvider>
                <TestComponent />
            </AuthProvider>
        );
        
        await waitFor(() => {
            expect(screen.getByTestId('user-email')).toHaveTextContent('admin@oris.local');
            expect(screen.getByTestId('is-admin')).toHaveTextContent('true');
        });
    });
});
