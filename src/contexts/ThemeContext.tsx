import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'light' | 'dark';
export type ColorTheme = 'teal' | 'indigo' | 'rose' | 'blue';

interface ThemeContextType {
  theme: Theme;
  colorTheme: ColorTheme;
  toggleTheme: () => void;
  setColorTheme: (theme: ColorTheme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('oris-theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const [colorTheme, setColorThemeState] = useState<ColorTheme>(() => {
    const saved = localStorage.getItem('oris-colortheme') as ColorTheme;
    return saved && ['teal', 'indigo', 'rose', 'blue'].includes(saved) ? saved : 'teal';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('oris-theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', colorTheme);
    localStorage.setItem('oris-colortheme', colorTheme);
  }, [colorTheme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const setColorTheme = (newTheme: ColorTheme) => {
    setColorThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, colorTheme, toggleTheme, setColorTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
