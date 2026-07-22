import { create } from 'zustand';

interface OperationsStore {
  bookmarkMutationBusy: boolean;
  cleanupBusy: boolean;
  cleanupStatus: string;
  tryBeginMutation: () => boolean;
  finishMutation: () => void;
  tryBeginCleanup: () => boolean;
  finishCleanup: (status: string) => void;
  setCleanupStatus: (status: string) => void;
}

// Destructive operations outlive ActionsView when the user switches views.
// Keeping their lock/status here prevents a remount from starting a second job.
export const useOperationsStore = create<OperationsStore>((set, get) => ({
  bookmarkMutationBusy: false,
  cleanupBusy: false,
  cleanupStatus: '',
  tryBeginMutation: () => {
    if (get().bookmarkMutationBusy) return false;
    set({ bookmarkMutationBusy: true });
    return true;
  },
  finishMutation: () => set({ bookmarkMutationBusy: false }),
  tryBeginCleanup: () => {
    if (get().bookmarkMutationBusy) return false;
    set({ bookmarkMutationBusy: true, cleanupBusy: true, cleanupStatus: '' });
    return true;
  },
  finishCleanup: (cleanupStatus) => set({ bookmarkMutationBusy: false, cleanupBusy: false, cleanupStatus }),
  setCleanupStatus: (cleanupStatus) => set({ cleanupStatus }),
}));
