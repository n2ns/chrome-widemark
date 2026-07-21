import { create } from 'zustand';

export interface ModalFieldsVal {
  title?: string;
  url?: string;
  color?: string;
  icon?: string;
}

export type ModalField = 'title' | 'url' | 'folderStyle';

export interface OpenModalOptions {
  title: string;
  message?: string;
  mode?: 'confirm' | 'alert' | 'input';
  submitLabel?: string;
  cancelLabel?: string;
  showFields?: ModalField[];
  fieldsVal?: ModalFieldsVal;
}

interface ActiveModal extends OpenModalOptions {
  resolve: (result: unknown) => void;
}

interface ModalStore {
  active: ActiveModal | null;
  openCustomModal: (options: OpenModalOptions) => Promise<unknown>;
  showConfirmDialog: (options: { title: string; message: string; confirmLabel?: string; cancelLabel?: string }) => Promise<boolean>;
  showInfoDialog: (options: { title: string; message: string; confirmLabel?: string }) => Promise<void>;
  submit: (result: unknown) => void;
  cancel: () => void;
}

export const useModalStore = create<ModalStore>((set, get) => ({
  active: null,

  openCustomModal: (options) =>
    new Promise((resolve) => {
      // Settle any modal still open so its promise never dangles.
      const prev = get().active;
      if (prev) prev.resolve(false);
      set({ active: { ...options, resolve } });
    }),

  showConfirmDialog: ({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel' }) =>
    get().openCustomModal({ title, message, mode: 'confirm', submitLabel: confirmLabel, cancelLabel }) as Promise<boolean>,

  showInfoDialog: ({ title, message, confirmLabel = 'OK' }) =>
    get().openCustomModal({ title, message, mode: 'alert', submitLabel: confirmLabel }) as Promise<void>,

  submit: (result) => {
    const active = get().active;
    if (active) {
      active.resolve(result);
      set({ active: null });
    }
  },

  cancel: () => {
    const active = get().active;
    if (active) {
      active.resolve(false);
      set({ active: null });
    }
  },
}));
