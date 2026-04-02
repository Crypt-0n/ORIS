import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { KillChainProvider } from './contexts/KillChainContext';
import { HelmetProvider } from 'react-helmet-async';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Simple i18n initialization for tests
i18n
  .use(initReactI18next)
  .init({
    lng: 'fr',
    fallbackLng: 'fr',
    resources: {
      fr: {
        translation: {
          'auto.chargement': 'Chargement en cours...',
          'auto.impossible_de_charger_le_rappo': 'Impossible de charger le rapport.',
          'auto.aucun_mouvement_entre_systemes': 'Aucun mouvement entre systèmes'
        }
      }
    },
    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
    }
  });

// Wrap components with necessary providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <HelmetProvider>
      <I18nextProvider i18n={i18n}>
        <ThemeProvider>
          <KillChainProvider>
            <BrowserRouter>
              {children}
            </BrowserRouter>
          </KillChainProvider>
        </ThemeProvider>
      </I18nextProvider>
    </HelmetProvider>
  );
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) => render(ui, { wrapper: AllTheProviders, ...options });

export * from '@testing-library/react';
export { customRender as render };
