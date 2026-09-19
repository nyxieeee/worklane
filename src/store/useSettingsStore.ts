import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid } from '../utils';
import { supabaseService } from '../services/supabaseService';

export interface CustomLabel {
  id: string;
  name: string;
  color: string;
}

interface SettingsState {
  labelMode: 'text' | 'dot';
  customLabels: CustomLabel[];
  setLabelMode: (mode: 'text' | 'dot') => void;
  loadCustomLabelsFromCloud: (userEmail?: string) => Promise<void>;
  addLabel: (name: string, color: string, userEmail?: string) => void;
  removeLabel: (id: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      labelMode: 'text',
      customLabels: [],
      setLabelMode: (mode) => set({ labelMode: mode }),

      loadCustomLabelsFromCloud: async (userEmail?: string) => {
        try {
          const cloudLabels = await supabaseService.getCustomLabels(userEmail);
          if (!cloudLabels || cloudLabels.length === 0) return;

          set(s => {
            const labelMap = new Map<string, CustomLabel>();
            // Keep local
            s.customLabels.forEach(l => labelMap.set(l.id, l));
            // Merge cloud
            cloudLabels.forEach(l => labelMap.set(l.id, l));
            return { customLabels: Array.from(labelMap.values()) };
          });
        } catch (err) {
          console.warn('[useSettingsStore] Error loading custom labels:', err);
        }
      },

      addLabel: (name, color, userEmail?: string) => {
        const newLabel: CustomLabel = { id: uid(), name: name.trim(), color };
        set(s => ({
          customLabels: [...s.customLabels, newLabel],
        }));
        supabaseService.upsertCustomLabel(newLabel, userEmail);
      },

      removeLabel: (id) => {
        set(s => ({
          customLabels: s.customLabels.filter(l => l.id !== id),
        }));
        supabaseService.deleteCustomLabel(id);
      },
    }),
    { name: 'worklane_settings_v1' }
  )
);
