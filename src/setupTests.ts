import '@testing-library/jest-dom';
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

// Extends Vitest's expect method with methods from react-testing-library
expect.extend(matchers as any);

// Mock global APIs and libraries that cause issues in jsdom
vi.mock('html2canvas', () => ({
  default: vi.fn().mockResolvedValue({
    toDataURL: () => 'data:image/png;base64,mockedbase64'
  })
}));

// Provide a mock for matchMedia (often missing in jsdom but used by Tailwind/charts)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Provide a mock for ResizeObserver
class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserver;

// Cleanup after each test case (e.g. clearing jsdom)
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
