// src/lib/api.ts
// Security: session is carried exclusively via HttpOnly cookie (oris_jwt).
// No token is stored in localStorage to prevent XSS-based session theft.

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

class ApiClient {
    /**
     * @deprecated Token is now managed by HttpOnly cookie. This method is kept
     * only for logout (clearing in-memory state). Never store tokens in localStorage.
     */
    setToken(_token: string | null) {
        // No-op: session is managed by HttpOnly cookie set by the backend.
        // localStorage is intentionally NOT used to prevent XSS token theft.
    }

    async request(endpoint: string, options: RequestInit & { isFormData?: boolean } = {}) {
        const url = `${API_URL}${endpoint}`;

        const headers: Record<string, string> = {
            ...(options.headers as Record<string, string> || {}),
        };

        if (!options.isFormData) {
            headers['Content-Type'] = 'application/json';
        }

        // Authentication is handled by the HttpOnly cookie sent automatically
        // via credentials: 'include'. No Authorization header needed.
        const response = await fetch(url, {
            ...options,
            credentials: 'include',
            headers,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `API Error: ${response.statusText}`);
        }

        // Return empty object for 204 No Content
        if (response.status === 204) {
            return {};
        }

        return response.json();
    }

    get(endpoint: string, options?: RequestInit) {
        return this.request(endpoint, { method: 'GET', ...options });
    }

    post(endpoint: string, data: any) {
        const isFormData = data instanceof FormData;
        return this.request(endpoint, {
            method: 'POST',
            body: isFormData ? data : JSON.stringify(data),
            isFormData,
        });
    }

    put(endpoint: string, data: any) {
        const isFormData = data instanceof FormData;
        return this.request(endpoint, {
            method: 'PUT',
            body: isFormData ? data : JSON.stringify(data),
            isFormData,
        });
    }

    delete(endpoint: string) {
        return this.request(endpoint, { method: 'DELETE' });
    }

    patch(endpoint: string, data: any) {
        return this.request(endpoint, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    }

    async download(endpoint: string) {
        const url = `${API_URL}${endpoint}`;
        const headers: Record<string, string> = {};
        
        const response = await fetch(url, {
            method: 'GET',
            credentials: 'include',
            headers,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `API Error: ${response.statusText}`);
        }

        return response.blob();
    }
}

export const api = new ApiClient();
