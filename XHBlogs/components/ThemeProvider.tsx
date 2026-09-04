"use client";
import { createContext, useContext, useEffect } from 'react';

const ThemeContext = createContext({ isDark: false });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    localStorage.removeItem('blog-theme');
  }, []);

  return (
    <ThemeContext.Provider value={{ isDark: false }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
