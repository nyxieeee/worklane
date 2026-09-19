import { create } from 'zustand';

export interface ConfirmConfig {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'primary' | 'warning';
  icon?: 'trash' | 'logout' | 'alert' | 'info';
  onConfirm: () => void;
  onCancel?: () => void;
}

interface ConfirmState {
  config: ConfirmConfig | null;
  isOpen: boolean;
  showConfirm: (config: ConfirmConfig) => void;
  closeConfirm: () => void;
}

export const useConfirmStore = create<ConfirmState>((set) => ({
  config: null,
  isOpen: false,
  showConfirm: (config) => set({ config, isOpen: true }),
  closeConfirm: () => set({ isOpen: false, config: null }),
}));
