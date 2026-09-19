import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ThemeState {
  isDark: boolean;
  toggle: () => void;
  setDark: (isDark: boolean) => void;
}

const applyThemeToDOM = (isDark: boolean) => {
  if (typeof document !== 'undefined') {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      isDark: false,
      toggle: () =>
        set((s) => {
          const next = !s.isDark;
          applyThemeToDOM(next);
          return { isDark: next };
        }),
      setDark: (isDark: boolean) => {
        applyThemeToDOM(isDark);
        set({ isDark });
      },
    }),
    {
      name: 'worklane-theme',
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyThemeToDOM(state.isDark);
        }
      },
    }
  )
);
