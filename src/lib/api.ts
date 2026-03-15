// src/lib/api.ts

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

class ApiClient {
    private token: string | null = null;

    setToken(token: string | null) {
        this.token = token;
        if (token) {
            localStorage.setItem('oris_token', token);
        } else {
            localStorage.removeItem('oris_token');
        }
    }

    getToken() {
        if (!this.token) {
            this.token = localStorage.getItem('oris_token');
        }
        return this.token;
    }

    async request(endpoint: string, options: RequestInit & { isFormData?: boolean } = {}) {
        const url = `${API_URL}${endpoint}`;
        const token = this.getToken();

        const headers: Record<string, string> = {
            ...(options.headers as Record<string, string> || {}),
        };

        if (!options.isFormData) {
            headers['Content-Type'] = 'application/json';
        }

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(url, {
            ...options,
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

    get(endpoint: string) {
        return this.request(endpoint, { method: 'GET' });
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
}

export const api = new ApiClient();
